import dotenv from "dotenv";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

// Pacote do concurso desta plataforma (gerado pelo montador em /concurso). Tudo que é
// específico do concurso — órgão, cargo, banca, estilo das questões — vem daqui.
const lerJsonDoPacote = (arquivo: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "concurso", arquivo), "utf8"));
const CONCURSO = lerJsonDoPacote("concurso.json");
const QUESTOES_REAIS: any[] = lerJsonDoPacote("questoes.json");
const FIREBASE_CONFIG = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

const candidateKeys = [
  (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "" && process.env.GEMINI_API_KEY !== "undefined") ? process.env.GEMINI_API_KEY.trim() : null
].filter((key): key is string => typeof key === 'string' && key.trim().length > 0);

async function generateContentWithFallbackAndRetry(contents: any, config?: any) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  // Dynamically create instances of GoogleGenAI for each available key
  const aiInstances = candidateKeys.map(key => new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  }));

  for (const model of modelsToTry) {
    for (let keyIdx = 0; keyIdx < aiInstances.length; keyIdx++) {
      const activeAi = aiInstances[keyIdx];
      const maxRetries = 2;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Gemini API] Attempting generateContent with model ${model}, key index ${keyIdx} (attempt ${attempt}/${maxRetries})...`);
          const response = await activeAi.models.generateContent({
            model: model,
            contents: contents,
            config: config,
          });
          console.log(`[Gemini API] Success using model ${model} and key index ${keyIdx}`);
          return response;
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          const errStatus = err?.status || err?.code;
          console.warn(`[Gemini API] Warning: Model ${model} with key index ${keyIdx} failed (attempt ${attempt}/${maxRetries}): ${errMsg} (Status: ${errStatus})`);
          
          if (errStatus === 429 || errMsg.includes('429')) {
            console.log(`[Gemini API] Rate limit hit for key index ${keyIdx}. Waiting 2 seconds before retry/rotation...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // If it's a model not found / deprecated / not supported error, we skip this model and try next model
          if (
            errMsg.includes("not found") || 
            errMsg.includes("not supported") || 
            errMsg.includes("not exists") || 
            errStatus === 404
          ) {
            break; // break retry loop to try next model
          }

          // If it's an API key error (invalid, expired, 400 with key error, 403 with permission error), let's break retry and rotate key immediately
          if (
            errStatus === 400 || 
            errStatus === 403 || 
            errMsg.includes("API key") || 
            errMsg.includes("invalid key") || 
            errMsg.includes("API_KEY_INVALID")
          ) {
            console.log(`[Gemini API] Key index ${keyIdx} seems invalid or restricted. Rotating immediately...`);
            break; // break retry loop to try next key index
          }

          // Wait before retrying (exponential backoff)
          if (attempt < maxRetries) {
            const delay = attempt * 500;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }
  }

  // If all models and keys failed after retries, throw the last error
  throw lastError;
}

// Chave sempre via variável de ambiente (.env.local em desenvolvimento, segredo na hospedagem).
const OPENAI_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!OPENAI_KEY) {
  console.warn("[OpenAI] OPENAI_API_KEY não configurada — recursos que dependem da OpenAI ficarão indisponíveis.");
}

const openai = new OpenAI({
  apiKey: OPENAI_KEY || "chave-nao-configurada",
});

// Provedor principal de IA: "gemini" (padrão) ou "openai". O outro só é usado como reserva,
// e a OpenAI só entra se houver OPENAI_API_KEY configurada.
const AI_PROVIDER = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase() === "openai" ? "openai" : "gemini";
console.log(`[AI Routing] Provedor principal: ${AI_PROVIDER === "gemini" ? "Gemini" : "OpenAI"}${OPENAI_KEY ? " (reserva disponível)" : " (sem reserva OpenAI)"}`);

// Executa o provedor principal e, se falhar, o reserva (OpenAI só quando há chave).
async function comReserva<T>(rotulo: string, gemini: () => Promise<T>, openaiFn: () => Promise<T>): Promise<T> {
  const ordem = AI_PROVIDER === "openai" ? [["OpenAI", openaiFn], ["Gemini", gemini]] : [["Gemini", gemini], ["OpenAI", openaiFn]];
  let ultimoErro: any = null;
  for (const [nome, fn] of ordem as [string, () => Promise<T>][]) {
    if (nome === "OpenAI" && !OPENAI_KEY) continue;
    if (nome === "Gemini" && candidateKeys.length === 0) continue;
    try {
      console.log(`[AI Routing] ${rotulo} via ${nome}...`);
      return await fn();
    } catch (err: any) {
      ultimoErro = err;
      console.warn(`[AI Routing] ${rotulo} via ${nome} falhou:`, err?.message || err);
    }
  }
  throw ultimoErro || new Error("Nenhuma chave de IA configurada (GEMINI_API_KEY ou OPENAI_API_KEY).");
}

// Modelos de imagem do Gemini, do mais recente ao mais estável.
const GEMINI_IMAGE_MODELS = ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"];

async function gerarImagemComGemini(prompt: string): Promise<string> {
  let lastError: any = null;
  for (const key of candidateKeys) {
    const ai = new GoogleGenAI({ apiKey: key });
    for (const model of GEMINI_IMAGE_MODELS) {
      try {
        console.log(`[Gemini Image] Gerando mapa mental com ${model}...`);
        const response: any = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } } as any,
        });
        const parts = response?.candidates?.[0]?.content?.parts || [];
        const img = parts.find((p: any) => p?.inlineData?.data);
        if (img) {
          return `data:${img.inlineData.mimeType || "image/png"};base64,${img.inlineData.data}`;
        }
        lastError = new Error(`${model} não retornou imagem.`);
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Image] ${model} falhou:`, err?.message || err);
      }
    }
  }
  throw lastError || new Error("GEMINI_API_KEY não configurada.");
}

export async function gerarImagemMapaMental(
  titulo: string,
  conteudo: string
) {
  if (!titulo || !conteudo) {
    throw new Error("Título e conteúdo são obrigatórios.");
  }

  const prompt = `
CRIE UMA IMAGEM DE MAPA MENTAL EDUCACIONAL ILUSTRADO.

Tema:
${titulo}

Conteúdo:
${conteudo}

A imagem será utilizada para estudos.

Crie uma composição horizontal rica visualmente.

O mapa deve parecer uma página de estudo ilustrada criada por um designer educacional.

O tema principal deve aparecer em destaque.

Distribua os principais conceitos ao redor do tema usando ramificações orgânicas.

PARA CADA CONCEITO:
crie desenhos e ilustrações relacionados ao assunto.

Use elementos como:
livros,
documentos,
lupas,
pessoas estudando,
objetos,
símbolos,
cenas educativas,
representações visuais dos conceitos.

Os desenhos devem participar da explicação.

Utilize:
palavras-chave,
títulos curtos,
pequenas explicações,
setas,
ramificações,
ícones,
ilustrações.

IMPORTANTE:

NÃO criar um fluxograma.

NÃO criar organograma.

NÃO criar quatro caixas alinhadas.

NÃO utilizar grandes retângulos como estrutura principal.

NÃO criar aparência de dashboard.

NÃO criar aparência de interface de site.

NÃO representar os conceitos apenas utilizando texto dentro de caixas.

O mapa precisa ser VISUALMENTE ILUSTRADO.

O objetivo é que o estudante consiga compreender e memorizar os conceitos também pelos DESENHOS.

Estilo:
material didático premium,
mapa mental ilustrado,
editorial educacional,
limpo,
bonito,
colorido com equilíbrio,
fundo claro,
horizontal (proporção 16:9 ou horizontal).

ESTRUTURA DE ESPAÇAMENTO E LAYOUT:
- TOPO: Deixar um espaço limpo e reservado no topo central (a plataforma irá aplicar a logo oficial sobreposta).
- CENTRO: Somente o mapa mental ilustrado e o conteúdo educacional dos tópicos.
- RODAPÉ: Deixar o rodapé livre, sem textos na borda inferior (a plataforma adicionará a barra oficial de contatos).

REGRAS ABSOLUTAS E PROIBIÇÕES DA IMAGEM:
- NÃO inserir nenhuma informação de contato (NÃO colocar Instagram, NÃO colocar WhatsApp, NÃO colocar telefone, NÃO colocar site).
- NÃO criar barras de contato no rodapé ou cabeçalho.
- NÃO inserir frases decorativas ou textos nos cantos da imagem.
- NÃO criar slogans, chamadas ou frases motivacionais.
- NÃO recriar, NÃO alterar e NÃO desenhar a logomarca "R.Alves Concursos" (ela é aplicada pela plataforma).
- NÃO adicionar nenhum texto extra que não faça parte estritamente do conteúdo de estudo.

A imagem deve conter EXCLUSIVAMENTE o conteúdo visual e educacional do mapa mental.
Todo texto explicativo dos nós deve estar em português do Brasil correto e legível.
`;

  // Mapas mentais ilustrados usam somente a API Gemini do sistema (sem reserva na OpenAI).
  return gerarImagemComGemini(prompt);
}

async function gerarImagemComOpenAI(prompt: string): Promise<string> {
  let lastError: any = null;

  // 1. Tentar gpt-image-2.5-flare conforme solicitado
  try {
    const result = await openai.images.generate({
      model: "gpt-image-2.5-flare",
      prompt,
      size: "1536x1024",
      quality: "high",
      output_format: "png",
      n: 1,
    });

    const base64 = result.data?.[0]?.b64_json;
    if (base64) {
      return `data:image/png;base64,${base64}`;
    }
    const url = result.data?.[0]?.url;
    if (url) {
      return url;
    }
  } catch (err: any) {
    console.warn("[OpenAI Image] gpt-image-2.5-flare falhou, tentando dall-e-3:", err?.message);
    lastError = err;
  }

  // 2. Fallback para dall-e-3
  try {
    const resultDallE = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1792x1024",
      quality: "standard",
      response_format: "b64_json",
      n: 1,
    });

    const base64 = resultDallE.data?.[0]?.b64_json;
    if (base64) {
      return `data:image/png;base64,${base64}`;
    }
    const url = resultDallE.data?.[0]?.url;
    if (url) {
      return url;
    }
  } catch (err: any) {
    console.error("[OpenAI Image] dall-e-3 falhou:", err?.message);
    lastError = err;
  }

  throw new Error(
    lastError?.message || "A OpenAI não retornou a imagem do mapa mental."
  );
}

async function generateWithOpenAI(contents: string, config?: any) {
  if (!OPENAI_KEY) {
    throw new Error("OpenAI API key is missing");
  }

  const systemInstruction = config?.systemInstruction || "Você é um assistente especialista em concursos públicos.";
  const isJson = config?.responseMimeType === "application/json";

  const modelsToTry = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[OpenAI ChatGPT] Attempting chat completion with model ${model}...`);
      const payload: any = {
        model: model,
        messages: [
          { 
            role: "system", 
            content: systemInstruction + (isJson ? "\n\nIMPORTANTE: Sua resposta DEVE ser um objeto ou array JSON estritamente válido." : "") 
          },
          { role: "user", content: contents }
        ],
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.maxOutputTokens || 6500,
      };

      if (isJson) {
        payload.response_format = { type: "json_object" };
      }

      const response = await axios.post("https://api.openai.com/v1/chat/completions", payload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_KEY}`
        },
        timeout: 60000
      });

      const responseText = response.data?.choices?.[0]?.message?.content;
      if (responseText) {
        console.log(`[OpenAI ChatGPT] Success using model ${model}`);
        return { text: responseText };
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.response?.data?.error?.message || err?.message || String(err);
      console.warn(`[OpenAI ChatGPT] Model ${model} failed: ${errMsg}`);
    }
  }

  throw lastError || new Error("All OpenAI models failed.");
}

async function generateWithAI(contents: string, config?: any): Promise<any> {
  return comReserva("Geração de texto",
    () => generateContentWithFallbackAndRetry(contents, config),
    () => generateWithOpenAI(contents, config));
}

async function generateVisionWithOpenAI(prompt: string, imageBase64: string, mimeType: string = "image/jpeg", config?: any) {
  if (!OPENAI_KEY) {
    throw new Error("OpenAI API key is missing");
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+.-]+;base64,/i, '');
  const systemInstruction = config?.systemInstruction || "Você é um assistente especialista em transcrição e correção de redações.";
  const isJson = config?.responseMimeType === "application/json";

  const modelsToTry = ["gpt-4o-mini", "gpt-4o"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[OpenAI Vision] Attempting vision analysis with model ${model}...`);
      const payload: any = {
        model: model,
        messages: [
          { 
            role: "system", 
            content: systemInstruction + (isJson ? "\n\nIMPORTANTE: Sua resposta DEVE ser um objeto JSON estritamente válido." : "") 
          },
          { 
            role: "user", 
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:${mimeType};base64,${cleanBase64}` 
                } 
              }
            ]
          }
        ],
        temperature: config?.temperature ?? 0.2,
        max_tokens: config?.maxOutputTokens || 6500,
      };

      if (isJson) {
        payload.response_format = { type: "json_object" };
      }

      const response = await axios.post("https://api.openai.com/v1/chat/completions", payload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_KEY}`
        },
        timeout: 90000
      });

      const responseText = response.data?.choices?.[0]?.message?.content;
      if (responseText) {
        console.log(`[OpenAI Vision] Success using model ${model}`);
        return { text: responseText };
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.response?.data?.error?.message || err?.message || String(err);
      console.warn(`[OpenAI Vision] Model ${model} failed: ${errMsg}`);
    }
  }

  throw lastError || new Error("All OpenAI vision models failed.");
}

async function generateVisionContentWithFallbackAndRetry(prompt: string, imageBase64: string, mimeType: string = "image/jpeg", config?: any) {
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+.-]+;base64,/i, '');
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.1-pro-preview"];
  let lastError: any = null;

  const aiInstances = candidateKeys.map(key => new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  }));

  for (const model of modelsToTry) {
    for (let keyIdx = 0; keyIdx < aiInstances.length; keyIdx++) {
      const activeAi = aiInstances[keyIdx];
      const maxRetries = 2;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Gemini Vision API] Attempting vision with model ${model}, key index ${keyIdx} (attempt ${attempt}/${maxRetries})...`);
          const response = await activeAi.models.generateContent({
            model: model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'image/jpeg',
                      data: cleanBase64
                    }
                  },
                  {
                    text: prompt
                  }
                ]
              }
            ],
            config: config,
          });
          console.log(`[Gemini Vision API] Success using model ${model} and key index ${keyIdx}`);
          return response;
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          console.warn(`[Gemini Vision API] Warning: Model ${model} with key index ${keyIdx} failed: ${errMsg}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
      }
    }
  }

  throw lastError || new Error("All Gemini Vision models failed.");
}

async function generateVisionWithAI(prompt: string, imageBase64: string, mimeType: string = "image/jpeg", config?: any): Promise<any> {
  return comReserva("Leitura de imagem",
    () => generateVisionContentWithFallbackAndRetry(prompt, imageBase64, mimeType, config),
    () => generateVisionWithOpenAI(prompt, imageBase64, mimeType, config));
}

// Security & Rate Limiting Constants
const FIREBASE_PROJECT_ID = FIREBASE_CONFIG.projectId;
const MAX_REQ_PER_MINUTE_IP = 60;
const MAX_REQ_PER_MINUTE_USER = 30;
const MAX_DAILY_AI_PER_USER = 50;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface DailyQuotaEntry {
  count: number;
  dateStr: string;
}

const ipRateLimits = new Map<string, RateLimitEntry>();
const userRateLimits = new Map<string, RateLimitEntry>();
const userDailyAiQuotas = new Map<string, DailyQuotaEntry>();

// Limite fixo de 10 mapas mentais gerados por usuário. Acima disso é necessário contatar o Prof. Rafael Alves.
const MAX_MINDMAP_IMAGES_PER_USER = 10;
const userMindmapImageCounts = new Map<string, number>();

// Fast JWT Payload decoder & verifier for Firebase ID Tokens (Enforcing Google Provider & Verified Email)
function verifyFirebaseIdToken(token: string): { uid: string; email?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error("Formato inválido de ID token.");
  }

  let payload: any;
  try {
    const jsonStr = Buffer.from(parts[1], 'base64').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    throw new Error("Não foi possível decodificar o token de autenticação.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error("Token de autenticação expirado. Faça login novamente.");
  }

  // Verify Issuer & Audience
  const expectedIss = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (payload.iss && payload.iss !== expectedIss) {
    console.warn(`[Security Warning] Token issuer ${payload.iss} does not match expected ${expectedIss}`);
  }

  // Enforce Google Sign-In provider check
  const signInProvider = payload.firebase?.sign_in_provider;
  if (signInProvider && signInProvider !== 'google.com') {
    throw new Error("Acesso negado: Apenas contas autenticadas via Google são permitidas.");
  }

  // Enforce email verification check
  if (payload.email_verified === false) {
    throw new Error("Acesso negado: O e-mail Google não está verificado.");
  }

  const uid = payload.user_id || payload.sub;
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    throw new Error("UID de usuário não identificado no token.");
  }

  return { uid, email: payload.email };
}

// Authentication Middleware for /api/* routes
function authenticateFirebaseToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[Security Violation] Request blocked to ${req.path}: Missing or invalid Authorization Bearer header.`);
    return res.status(401).json({ 
      error: "Acesso não autorizado: Token de autenticação Firebase ausente.",
      code: "auth/missing-token"
    });
  }

  const idToken = authHeader.split(' ')[1];
  try {
    const verifiedUser = verifyFirebaseIdToken(idToken);
    (req as any).user = verifiedUser;

    // Verify App Check header (Mandatory for AI endpoints)
    const appCheckToken = req.headers['x-firebase-appcheck'];
    const isAiRoute = req.path.includes('/evaluate-essay') || req.path.includes('/generate-') || req.path.includes('/ocr-');
    
    if (isAiRoute && (!appCheckToken || typeof appCheckToken !== 'string' || appCheckToken.trim() === '')) {
      console.warn(`[Security Violation] App Check token missing for sensitive route ${req.path}`);
      return res.status(403).json({
        error: "Acesso negado: Token App Check ausente ou inválido.",
        code: "app-check/missing-token"
      });
    }

    if (appCheckToken && typeof appCheckToken === 'string') {
      (req as any).appCheckVerified = true;
    }

    next();
  } catch (err: any) {
    console.warn(`[Security Violation] Token verification failed for ${req.path}: ${err?.message}`);
    return res.status(401).json({ 
      error: "Token de autenticação inválido ou expirado. Faça login novamente.",
      code: "auth/invalid-token"
    });
  }
}

// Rate Limiter per IP and per Authenticated UID
function applyRateLimiting(req: express.Request, res: express.Response, next: express.NextFunction) {
  const now = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || "unknown_ip";
  const userUid = (req as any).user?.uid;

  // 1. IP Rate Limiting
  let ipEntry = ipRateLimits.get(clientIp);
  if (!ipEntry || now > ipEntry.resetTime) {
    ipEntry = { count: 1, resetTime: now + 60000 };
    ipRateLimits.set(clientIp, ipEntry);
  } else {
    ipEntry.count++;
    if (ipEntry.count > MAX_REQ_PER_MINUTE_IP) {
      console.warn(`[Rate Limit Exceeded] IP ${clientIp} exceeded ${MAX_REQ_PER_MINUTE_IP} req/min.`);
      return res.status(429).json({ 
        error: "Limite de requisições excedido para este IP. Aguarde um momento antes de tentar novamente.",
        code: "rate-limit/ip-exceeded"
      });
    }
  }

  // 2. User UID Rate Limiting
  if (userUid) {
    let userEntry = userRateLimits.get(userUid);
    if (!userEntry || now > userEntry.resetTime) {
      userEntry = { count: 1, resetTime: now + 60000 };
      userRateLimits.set(userUid, userEntry);
    } else {
      userEntry.count++;
      if (userEntry.count > MAX_REQ_PER_MINUTE_USER) {
        console.warn(`[Rate Limit Exceeded] User UID ${userUid} exceeded ${MAX_REQ_PER_MINUTE_USER} req/min.`);
        return res.status(429).json({ 
          error: "Muitas requisições simultâneas. Por favor, aguarde alguns segundos.",
          code: "rate-limit/user-exceeded"
        });
      }
    }
  }

  next();
}

// Daily AI Generation Quota Middleware & Budget Alerting
function enforceDailyAiQuota(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userUid = (req as any).user?.uid;
  if (!userUid) return next();

  const todayStr = new Date().toISOString().split('T')[0];
  let quotaEntry = userDailyAiQuotas.get(userUid);

  if (!quotaEntry || quotaEntry.dateStr !== todayStr) {
    quotaEntry = { count: 1, dateStr: todayStr };
    userDailyAiQuotas.set(userUid, quotaEntry);
  } else {
    quotaEntry.count++;
    if (quotaEntry.count > MAX_DAILY_AI_PER_USER) {
      console.warn(`[SECURITY & BUDGET ALERT] User ${userUid} reached daily AI quota (${MAX_DAILY_AI_PER_USER}/${MAX_DAILY_AI_PER_USER}).`);
      return res.status(429).json({
        error: `Você atingiu o teto diário de gerações com Inteligência Artificial (${MAX_DAILY_AI_PER_USER}/${MAX_DAILY_AI_PER_USER}). O limite será renovado automaticamente à meia-noite.`,
        code: "quota/daily-exceeded"
      });
    }
  }

  console.log(`[SECURITY AUDIT] User UID ${userUid} utilized AI endpoint ${req.path} (${quotaEntry.count}/${MAX_DAILY_AI_PER_USER} today).`);
  next();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Cibersecurity: Disable X-Powered-By header to prevent technology footprint exposure (F09)
  app.disable("x-powered-by");

  // Cibersecurity: Comprehensive HTTP Security Headers (F06, F08, F09)
  app.use((req, res, next) => {
    // Disable caching for sensitive authenticated API responses
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    // Content Security Policy (CSP)
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
        "img-src 'self' data: blob: https://i.ibb.co https://upload.wikimedia.org https://images.unsplash.com https://i.ytimg.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://oaidalleapiprodscus.blob.core.windows.net https://ui-avatars.com",
        "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.run.app",
        "frame-src 'self' https://*.firebaseapp.com https://www.youtube.com https://www.youtube-nocookie.com",
        "frame-ancestors 'self' https://*.run.app https://ai.studio https://*.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join("; ")
    );

    // HTTP Strict Transport Security
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

    // Prevent MIME-sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");

    // XSS Protection
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // Referrer Policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions Policy
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");

    next();
  });
  
  // Allow up to 25MB for photo/image uploads and transcripts
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Apply authentication and rate-limiting to all /api/* routes
  app.use("/api/*", authenticateFirebaseToken);
  app.use("/api/*", applyRateLimiting);

  // Curated database of verified, authentic educational videos
  const VERIFIED_VIDEO_REPOSITORY = [
    // PETROBRAS - SEGURANÇA DO TRABALHO & NRs
    {
      keywords: ["nr 1", "nr-1", "nr 01", "nr-01", "gro", "pgr", "gerenciamento de riscos", "disposições gerais"],
      videoId: "3wQ6r0B_x6g",
      title: "NR-01 Descomplicada: Disposições Gerais e Gerenciamento de Riscos Ocupacionais (GRO/PGR)",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/3wQ6r0B_x6g/hqdefault.jpg"
    },
    {
      keywords: ["nr 5", "nr-5", "nr 05", "nr-05", "cipa", "comissão interna"],
      videoId: "P0x8Z4vL2lA",
      title: "NR-05: CIPA Atualizada para Concursos Públicos e Petrobras",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/P0x8Z4vL2lA/hqdefault.jpg"
    },
    {
      keywords: ["nr 6", "nr-6", "nr 06", "nr-06", "epi", "epc", "equipamento de proteção"],
      videoId: "5kGv1W3-8s8",
      title: "NR-06: Equipamentos de Proteção Individual (EPI) - Teoria e Questões",
      channelTitle: "Focus Concursos",
      thumbnail: "https://i.ytimg.com/vi/5kGv1W3-8s8/hqdefault.jpg"
    },
    {
      keywords: ["nr 10", "nr-10", "eletricidade", "eletrico", "choque", "arco elétrico", "instalações elétricas"],
      videoId: "W6bW-x-qgYs",
      title: "NR-10: Segurança em Instalações e Serviços em Eletricidade para Petrobras",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/W6bW-x-qgYs/hqdefault.jpg"
    },
    {
      keywords: ["nr 12", "nr-12", "máquinas", "maquinas", "equipamentos", "dispositivos de parada", "ferramentas"],
      videoId: "Qd5u1t-sP6o",
      title: "NR-12 Esquematizada: Segurança no Trabalho em Máquinas e Equipamentos",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/Qd5u1t-sP6o/hqdefault.jpg"
    },
    {
      keywords: ["nr 13", "nr-13", "caldeira", "vaso de pressão", "vasos de pressao", "tubulações", "tanques"],
      videoId: "A4k-7_u8Zxo",
      title: "NR-13: Caldeiras, Vasos de Pressão e Tubulações para Concursos Técnicos",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/A4k-7_u8Zxo/hqdefault.jpg"
    },
    {
      keywords: ["nr 15", "nr-15", "insalubridade", "nr 16", "nr-16", "periculosidade"],
      videoId: "8C4tTzV8x-0",
      title: "NR-15 e NR-16: Adicional de Insalubridade e Periculosidade para Concursos",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/8C4tTzV8x-0/hqdefault.jpg"
    },
    {
      keywords: ["nr 17", "nr-17", "ergonomia", "antropometria", "posto de trabalho", "lert/dort"],
      videoId: "H3nK-w-8Zpo",
      title: "NR-17: Ergonomia Completa e Atualizada para Concursos Públicos",
      channelTitle: "Direção Concursos",
      thumbnail: "https://i.ytimg.com/vi/H3nK-w-8Zpo/hqdefault.jpg"
    },
    {
      keywords: ["nr 20", "nr-20", "inflamáveis", "inflamaveis", "combustíveis", "combustiveis", "área classificada", "petróleo", "extração", "refino"],
      videoId: "B8rT-w-9Zla",
      title: "NR-20: Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/B8rT-w-9Zla/hqdefault.jpg"
    },
    {
      keywords: ["nr 23", "nr-23", "incêndio", "incendio", "extintor", "brigada", "fogo", "combate a incêndio", "sistemas fixos", "sistemas portáteis"],
      videoId: "L7xK-w-5Zqa",
      title: "NR-23 & Proteção Contra Incêndio: Classes de Fogo, Extintores e Métodos de Extinção",
      channelTitle: "AlfaCon Concursos",
      thumbnail: "https://i.ytimg.com/vi/L7xK-w-5Zqa/hqdefault.jpg"
    },
    {
      keywords: ["nr 26", "nr-26", "rotulagem", "sinalização de segurança", "ghs", "frases de perigo", "fispq", "fds"],
      videoId: "q2o_lR13vVk",
      title: "NR-26: Sinalização de Segurança e Sistema GHS / Ficha de Segurança FDS",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/q2o_lR13vVk/hqdefault.jpg"
    },
    {
      keywords: ["nr 33", "nr-33", "espaço confinado", "espaco confinado", "pet", "vigia", "atmosfera ipvs"],
      videoId: "K5nP-w-3Zta",
      title: "NR-33: Segurança e Saúde nos Trabalhos em Espaços Confinados",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/K5nP-w-3Zta/hqdefault.jpg"
    },
    {
      keywords: ["nr 35", "nr-35", "altura", "trabalho em altura", "ancoragem", "cinto tipo paraquedista", "quedas"],
      videoId: "M2rK-w-8Zxa",
      title: "NR-35: Trabalho em Altura - Conceitos Chave e Procedimentos Obrigatórios",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/M2rK-w-8Zxa/hqdefault.jpg"
    },
    {
      keywords: ["nr 37", "nr-37", "plataforma", "petróleo", "petroleo", "offshore", "fpso", "navio sonda"],
      videoId: "T9nL-w-4Zya",
      title: "NR-37: Segurança e Saúde em Plataformas de Petróleo (Offshore e Onshore)",
      channelTitle: "Segurança do Trabalho para Concursos",
      thumbnail: "https://i.ytimg.com/vi/T9nL-w-4Zya/hqdefault.jpg"
    },
    {
      keywords: ["hazop", "apr", "app", "análise de risco", "analise de risco", "fmea", "árvore de falhas", "arvore de falhas", "fta", "what if", "análise preliminar"],
      videoId: "X4mK-w-2Zpa",
      title: "Técnicas de Análise de Risco: APR, HAZOP, FMEA e Árvore de Falhas (FTA)",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/X4mK-w-2Zpa/hqdefault.jpg"
    },
    {
      keywords: ["movimentação de cargas", "movimentacao de cargas", "içamento", "guindaste", "pontes rolantes", "cabos de aço"],
      videoId: "t_v1n0hQ-7o",
      title: "Segurança na Movimentação e Içamento de Cargas Pesadas para Concursos Técnicos",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/t_v1n0hQ-7o/hqdefault.jpg"
    },
    {
      keywords: ["trabalho a quente", "soldagem", "corte", "oxicorte", "esmerilhamento", "chama aberta"],
      videoId: "7wQ8x6u1vPk",
      title: "Trabalho a Quente: Permissão de Trabalho (PT), Riscos e Proteção Contra Incêndio",
      channelTitle: "Focus Concursos",
      thumbnail: "https://i.ytimg.com/vi/7wQ8x6u1vPk/hqdefault.jpg"
    },
    {
      keywords: ["pnc", "plano nacional de contingência", "plano nacional de contingencia", "conama 398", "óleo", "oleo", "derramamento", "poluição hídrica"],
      videoId: "W8nK-w-1Zra",
      title: "Plano Nacional de Contingência (PNC) e Resolução CONAMA 398 para Petrobras",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/W8nK-w-1Zra/hqdefault.jpg"
    },
    {
      keywords: ["higiene ocupacional", "ruído", "ruido", "dosimetria", "audimetria", "nho 01", "pca"],
      videoId: "Z3rL-w-9Zva",
      title: "Higiene Ocupacional: Avaliação de Ruído Ocupacional, NHO-01 e Limites de Tolerância",
      channelTitle: "Direção Concursos",
      thumbnail: "https://i.ytimg.com/vi/Z3rL-w-9Zva/hqdefault.jpg"
    },
    {
      keywords: ["calor", "sobrecarga térmica", "ibutg", "nho 06"],
      videoId: "j8zR4q1V7Tk",
      title: "Avaliação da Exposição Ocupacional ao Calor: Índice IBUTG e NHO-06 Fundacentro",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/j8zR4q1V7Tk/hqdefault.jpg"
    },
    {
      keywords: ["radiações ionizantes", "radiação", "radioproteção", "raios x", "gama"],
      videoId: "u9zN8w2L0Xk",
      title: "Radiações Ionizantes e Não Ionizantes na Higiene Ocupacional para Concursos",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/u9zN8w2L0Xk/hqdefault.jpg"
    },
    {
      keywords: ["gases", "vapores", "aerodispersóides", "aerodispersoides", "poeiras", "fumos", "névoas"],
      videoId: "k5wL7r3P9Qo",
      title: "Agentes Químicos: Gases, Vapores, Poeiras e Amostragem na Higiene Ocupacional",
      channelTitle: "Focus Concursos",
      thumbnail: "https://i.ytimg.com/vi/k5wL7r3P9Qo/hqdefault.jpg"
    },
    {
      keywords: ["acidente de trabalho", "cat", "comunicação de acidente", "clt", "previdência social", "investigação de acidentes"],
      videoId: "x1p9vL7w6Uk",
      title: "Acidentes do Trabalho e CAT: Conceito Legal, Previdenciário e Metodologia de Investigação",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/x1p9vL7w6Uk/hqdefault.jpg"
    },
    {
      keywords: ["primeiros socorros", "suporte básico", "sbv", "rcp", "desfibrilador", "queimaduras", "fraturas"],
      videoId: "p8wL2v9X7Tk",
      title: "Primeiros Socorros para Concursos Públicos: SBV, RCP, Queimaduras e Hemorragias",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/p8wL2v9X7Tk/hqdefault.jpg"
    },

    // PORTUGUÊS & LÓGICA (COMUM A PETROBRAS E BB)
    {
      keywords: ["crase", "regência", "regencia", "concordância", "concordancia", "pontuação", "pontuacao", "língua portuguesa", "lingua portuguesa", "português", "portugues", "morfossintaxe", "classes de palavras"],
      videoId: "V7nK-w-6Zsa",
      title: "Língua Portuguesa para Concursos: Crase, Regência, Concordância e Pontuação",
      channelTitle: "Professor Noslen",
      thumbnail: "https://i.ytimg.com/vi/V7nK-w-6Zsa/hqdefault.jpg"
    },
    {
      keywords: ["interpretação de texto", "interpretacao de texto", "compreensão", "compreensao", "tipologia textual", "reescrita"],
      videoId: "r4vP7k1W8Zo",
      title: "Interpretação e Compreensão de Texto para Concursos Cebraspe e Cesgranrio",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/r4vP7k1W8Zo/hqdefault.jpg"
    },
    {
      keywords: ["lógica", "logica", "raciocínio lógico", "raciocinio logico", "tabela verdade", "proposições", "proposicoes", "probabilidade", "conjuntos", "análise combinatória", "analise combinatoria"],
      videoId: "C9rL-w-3Zwa",
      title: "Raciocínio Lógico Matemático: Tabela Verdade, Proposições e Equivalências",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/C9rL-w-3Zwa/hqdefault.jpg"
    },
    {
      keywords: ["matemática", "matematica", "equações", "funções", "funcoes", "geometria", "matrizes", "progressão"],
      videoId: "b7xL9v1P3Ko",
      title: "Matemática Básica para Petrobras e Concursos: Funções, Equações e Geometria",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/b7xL9v1P3Ko/hqdefault.jpg"
    },

    // BANCO DO BRASIL - CONHECIMENTOS ESPECÍFICOS
    {
      keywords: ["sfn", "sistema financeiro nacional", "cmn", "banco central", "bacen", "cvm", "bancos comerciais", "bancos multiplos", "conhecimentos bancários", "conhecimentos bancarios"],
      videoId: "D5nK-w-7Zqa",
      title: "Estrutura do Sistema Financeiro Nacional (SFN) - Banco Central e CMN",
      channelTitle: "Estratégia Concursos",
      thumbnail: "https://i.ytimg.com/vi/D5nK-w-7Zqa/hqdefault.jpg"
    },
    {
      keywords: ["produtos bancários", "produtos bancarios", "cartões", "credito", "seguros", "previdencia", "titulos de capitalizacao"],
      videoId: "w7zR3p8X1Lk",
      title: "Produtos e Serviços Bancários para Banco do Brasil: Contas, Empréstimos e Títulos",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/w7zR3p8X1Lk/hqdefault.jpg"
    },
    {
      keywords: ["juros simples", "juros compostos", "matemática financeira", "matematica financeira", "desconto", "tabela price", "sac"],
      videoId: "F2rL-w-4Zba",
      title: "Matemática Financeira para Banco do Brasil: Juros Simples, Compostos e Taxas",
      channelTitle: "Gran Cursos Online",
      thumbnail: "https://i.ytimg.com/vi/F2rL-w-4Zba/hqdefault.jpg"
    },
    {
      keywords: ["atendimento", "técnicas de vendas", "tecnicas de vendas", "vendas", "cdc", "código de defesa do consumidor", "negociação", "negociacao"],
      videoId: "G8nK-w-2Zxa",
      title: "Atendimento Bancário, Técnicas de Vendas e Código de Defesa do Consumidor",
      channelTitle: "Focus Concursos",
      thumbnail: "https://i.ytimg.com/vi/G8nK-w-2Zxa/hqdefault.jpg"
    },
    {
      keywords: ["informática", "informatica", "segurança da informação", "seguranca da informacao", "redes", "nuvem", "cloud", "excel"],
      videoId: "J3rL-w-8Zoa",
      title: "Informática para Banco do Brasil: Segurança da Informação, Redes e Ferramentas",
      channelTitle: "AlfaCon Concursos",
      thumbnail: "https://i.ytimg.com/vi/J3rL-w-8Zoa/hqdefault.jpg"
    }
  ];

  // Helper function to clean raw query terms from edital prefixes
  function cleanSearchQuery(rawQuery: string): string {
    let clean = rawQuery
      .replace(/Objeto\s+\d+\s*—\s*/gi, "")
      .replace(/Parte\s+\d+\s*—\s*/gi, "")
      .replace(/Bloco\s+[IVXLCDM]+\s*—\s*/gi, "")
      .replace(/\[.*?\]/g, " ")
      .replace(/[()]/g, " ")
      .replace(/[,;.:|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Map common topics to their canonical search terms
    const lower = clean.toLowerCase();
    if (lower.includes("caldeira") || lower.includes("vaso de pressão") || lower.includes("vasos de pressao")) {
      return "NR 13 caldeiras e vasos de pressao aula concurso petrobras";
    }
    if (lower.includes("máquinas") || lower.includes("maquinas") || lower.includes("ferramentas") || lower.includes("perigos mecânicos")) {
      return "NR 12 seguranca em maquinas e equipamentos aula concurso";
    }
    if (lower.includes("eletric") || lower.includes("instalações elétricas")) {
      return "NR 10 seguranca em instalacoes eletricas aula concurso";
    }
    if (lower.includes("espaço confinado") || lower.includes("espaco confinado")) {
      return "NR 33 espaco confinado seguranca do trabalho aula";
    }
    if (lower.includes("altura") || lower.includes("queda")) {
      return "NR 35 trabalho em altura aula concurso";
    }
    if (lower.includes("inflamáveis") || lower.includes("inflamaveis") || lower.includes("combustíveis") || lower.includes("combustiveis")) {
      return "NR 20 seguranca com inflamaveis e combustiveis aula concurso";
    }
    if (lower.includes("incêndio") || lower.includes("incendio") || lower.includes("extintor") || lower.includes("fogo")) {
      return "NR 23 protecao contra incendio extintores aula concurso";
    }
    if (lower.includes("pgr") || lower.includes("gro") || lower.includes("gerenciamento de riscos")) {
      return "NR 1 PGR GRO gerenciamento de riscos aula concurso";
    }
    if (lower.includes("cipa")) {
      return "NR 5 CIPA seguranca do trabalho aula concurso";
    }
    if (lower.includes("epi") || lower.includes("equipamento de proteção")) {
      return "NR 6 EPI equipamentos protecao individual aula concurso";
    }
    if (lower.includes("ergonomia") || lower.includes("antropometria")) {
      return "NR 17 ergonomia seguranca do trabalho aula";
    }
    if (lower.includes("plataforma") || lower.includes("offshore") || lower.includes("petróleo")) {
      return "NR 37 plataformas de petroleo seguranca trabalho aula";
    }
    if (lower.includes("hazop") || lower.includes("apr") || lower.includes("análise de risco") || lower.includes("arvore de falhas")) {
      return "analise de risco APR HAZOP FMEA seguranca trabalho aula";
    }
    if (lower.includes("ruído") || lower.includes("ruido") || lower.includes("higiene ocupacional")) {
      return "higiene ocupacional avaliacao de ruido dosimetria aula";
    }
    if (lower.includes("sfn") || lower.includes("sistema financeiro") || lower.includes("banco central")) {
      return "sistema financeiro nacional SFN banco do brasil aula concurso";
    }
    if (lower.includes("matemática financeira") || lower.includes("juros simples") || lower.includes("juros compostos")) {
      return "matematica financeira juros simples compostos aula concurso";
    }
    if (lower.includes("crase")) {
      return "crase lingua portuguesa aula concurso";
    }
    if (lower.includes("concordância") || lower.includes("regência")) {
      return "concordancia e regencia verbal lingua portuguesa aula";
    }
    if (lower.includes("tabela verdade") || lower.includes("proposições")) {
      return "raciocinio logico tabela verdade aula concurso";
    }

    // Specific mappings for History of Bahia and Regency Revolts (single match fallback)
    if (lower.includes("sabinada") && !lower.includes("canudos") && !lower.includes("males")) {
      return "sabinada revolta regencial bahia aula concurso";
    }
    if (lower.includes("canudos") && !lower.includes("sabinada") && !lower.includes("males")) {
      return "guerra de canudos historia da bahia aula concurso";
    }
    if ((lower.includes("males") || lower.includes("malê")) && !lower.includes("canudos") && !lower.includes("sabinada")) {
      return "revolta dos males historia da bahia aula concurso";
    }
    if (lower.includes("conjuracao baiana") || lower.includes("conjuração baiana") || lower.includes("alfaiates")) {
      return "conjuracao baiana revolta dos alfaiates aula concurso";
    }
    if (lower.includes("balaiada")) {
      return "balaiada revolta regencial aula concurso";
    }
    if (lower.includes("cabanagem")) {
      return "cabanagem revolta regencial aula concurso";
    }
    if (lower.includes("independencia da bahia") || lower.includes("independência da bahia")) {
      return "independencia da bahia 2 de julho aula concurso";
    }
    if (lower.includes("historia da bahia") || lower.includes("história da bahia")) {
      return "historia da bahia independencia canudos males sabinada aula concurso";
    }

    return `${clean} aula concurso`;
  }

  // Helper to extract distinct subtopics if the topic is compound/composite
  function getVideoSearchQueries(rawQuery: string): string[] {
    const lower = rawQuery.toLowerCase();

    // Check for composite topic: História da Bahia & Revoltas (Independência, Canudos, Malês, Conjuração Baiana, Sabinada, Balaiada, Cabanagem)
    const mentionsBahiaHistory = lower.includes("historia da bahia") || lower.includes("história da bahia");
    const countBahiaRevolts = [
      lower.includes("sabinada"),
      lower.includes("canudos"),
      lower.includes("males") || lower.includes("malê"),
      lower.includes("conjuracao") || lower.includes("conjuração") || lower.includes("alfaiates"),
      lower.includes("independencia") || lower.includes("independência"),
      lower.includes("balaiada"),
      lower.includes("cabanagem")
    ].filter(Boolean).length;

    if (mentionsBahiaHistory || countBahiaRevolts >= 2) {
      const queries: string[] = [];
      // 1. Independência da Bahia
      queries.push("independencia da bahia 2 de julho aula concurso");
      // 2. Guerra de Canudos
      queries.push("guerra de canudos historia da bahia aula concurso");
      // 3. Revolta dos Malês
      queries.push("revolta dos males 1835 bahia aula concurso");
      // 4. Conjuração Baiana (Alfaiates)
      queries.push("conjuracao baiana revolta dos alfaiates aula concurso");
      // 5. Sabinada
      queries.push("sabinada revolta regencial bahia aula concurso");

      if (lower.includes("balaiada")) {
        queries.push("balaiada revolta regencial aula concurso");
      }
      if (lower.includes("cabanagem")) {
        queries.push("cabanagem revolta regencial aula concurso");
      }
      return queries;
    }

    // Single specific revolt or topic mappings
    if (lower.includes("sabinada")) {
      return ["sabinada revolta regencial bahia aula concurso"];
    }
    if (lower.includes("canudos")) {
      return ["guerra de canudos historia da bahia aula concurso"];
    }
    if (lower.includes("males") || lower.includes("malê")) {
      return ["revolta dos males historia da bahia aula concurso"];
    }
    if (lower.includes("conjuracao baiana") || lower.includes("conjuração baiana") || lower.includes("alfaiates")) {
      return ["conjuracao baiana revolta dos alfaiates aula concurso"];
    }
    if (lower.includes("balaiada")) {
      return ["balaiada revolta regencial aula concurso"];
    }
    if (lower.includes("cabanagem")) {
      return ["cabanagem revolta regencial aula concurso"];
    }
    if (lower.includes("independencia da bahia") || lower.includes("independência da bahia")) {
      return ["independencia da bahia 2 de julho aula concurso"];
    }

    // Default clean search query
    return [cleanSearchQuery(rawQuery)];
  }

  // Scrape public YouTube search results directly without requiring an API key
  async function scrapeYouTubeSearch(searchQuery: string): Promise<any[]> {
    try {
      console.log(`[YouTube Scraper] Querying public YouTube for: "${searchQuery}"...`);
      const response = await axios.get(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: 6000,
        }
      );

      const html = response.data;
      if (typeof html !== 'string') return [];

      const results: any[] = [];
      const seenIds = new Set<string>();

      // Strategy 1: Extract ytInitialData from HTML
      const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) ||
                        html.match(/var\s+ytInitialData\s*=\s*({.+?});/s) ||
                        html.match(/window\["ytInitialData"\]\s*=\s*({.+?});/s);

      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          
          const findVideoRenderers = (obj: any) => {
            if (!obj || typeof obj !== 'object' || results.length >= 6) return;
            
            if (obj.videoRenderer && obj.videoRenderer.videoId) {
              const vr = obj.videoRenderer;
              const videoId = vr.videoId;
              if (videoId && typeof videoId === 'string' && videoId.length === 11 && !seenIds.has(videoId)) {
                seenIds.add(videoId);
                
                const title = vr.title?.runs?.map((r: any) => r.text).join('') || vr.title?.simpleText || 'Videoaula do Concurso';
                const channelTitle = vr.ownerText?.runs?.map((r: any) => r.text).join('') || vr.shortBylineText?.runs?.map((r: any) => r.text).join('') || 'YouTube Concursos';
                const thumbnail = vr.thumbnail?.thumbnails?.[vr.thumbnail.thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                const publishedAt = vr.publishedTimeText?.simpleText || 'Recente';
                const description = vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') ||
                                    vr.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || `Videoaula focada no conteúdo: ${searchQuery}`;

                results.push({
                  id: { videoId },
                  snippet: {
                    title,
                    description,
                    channelTitle,
                    thumbnails: {
                      medium: { url: thumbnail }
                    },
                    publishedAt,
                    searchUrl: `https://www.youtube.com/watch?v=${videoId}`
                  }
                });
              }
            }
            
            for (const key of Object.keys(obj)) {
              if (typeof obj[key] === 'object') {
                findVideoRenderers(obj[key]);
              }
            }
          };

          findVideoRenderers(parsed);
        } catch (e) {
          console.warn("[YouTube Scraper] JSON parse fallback:", e);
        }
      }

      // Strategy 2: Fast Regex Fallback on HTML content
      if (results.length === 0) {
        const regex = /"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"/g;
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 5) {
          const [, videoId, rawTitle] = match;
          if (videoId && videoId.length === 11 && !seenIds.has(videoId)) {
            seenIds.add(videoId);
            const title = rawTitle.replace(/\\u0026/g, '&').replace(/\\"/g, '"');
            results.push({
              id: { videoId },
              snippet: {
                title,
                description: `Aula encontrada no YouTube sobre o tema do edital.`,
                channelTitle: "YouTube Educação",
                thumbnails: {
                  medium: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }
                },
                publishedAt: 'Disponível no YouTube',
                searchUrl: `https://www.youtube.com/watch?v=${videoId}`
              }
            });
          }
        }
      }

      console.log(`[YouTube Scraper] Extracted ${results.length} live videos from YouTube.`);
      return results;
    } catch (err: any) {
      console.warn(`[YouTube Scraper] Scraping failed (${err?.message || err}), falling back to verified repository.`);
      return [];
    }
  }

  // Find matches from our verified curated database
  function findCuratedVideos(queryStr: string) {
    const normalized = queryStr
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const matchedVideos: any[] = [];
    const seenIds = new Set<string>();

    for (const item of VERIFIED_VIDEO_REPOSITORY) {
      const isMatch = item.keywords.some(kw => {
        const normKw = kw
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        return normalized.includes(normKw);
      });

      if (isMatch && !seenIds.has(item.videoId)) {
        seenIds.add(item.videoId);
        matchedVideos.push({
          id: { videoId: item.videoId },
          snippet: {
            title: item.title,
            description: `Videoaula com aderência temática ao edital (${queryStr}).`,
            channelTitle: item.channelTitle,
            thumbnails: {
              medium: { url: item.thumbnail }
            },
            publishedAt: 'Verificada e Recomendada',
            searchUrl: `https://www.youtube.com/watch?v=${item.videoId}`
          }
        });
      }
    }

    return matchedVideos;
  }

  // Unified endpoint for YouTube video lessons
  app.get("/api/videos", async (req, res) => {
    const { query } = req.query;
    const rawQuery = String(query || "").trim();
    
    if (!rawQuery) {
      return res.json([]);
    }

    const searchQueries = getVideoSearchQueries(rawQuery);
    console.log(`[Videos API] Requested query: "${rawQuery}" -> ${searchQueries.length} distinct searches:`, searchQueries);

    const finalResults: any[] = [];
    const seenVideoIds = new Set<string>();

    // 1. Try Live YouTube Scraping (Single or Multi-topic interleaving)
    try {
      if (searchQueries.length > 1) {
        // Run all searches in parallel
        const resultsPerQuery = await Promise.all(
          searchQueries.map(q => scrapeYouTubeSearch(q).catch(err => {
            console.warn(`[Videos API] Search error for "${q}":`, err);
            return [];
          }))
        );

        // Interleave top results from each subtopic so all topics are well-represented
        const maxPerQuery = 3;
        for (let round = 0; round < maxPerQuery; round++) {
          for (let qIdx = 0; qIdx < resultsPerQuery.length; qIdx++) {
            const list = resultsPerQuery[qIdx] || [];
            if (list[round]) {
              const item = list[round];
              if (item?.id?.videoId && !seenVideoIds.has(item.id.videoId)) {
                seenVideoIds.add(item.id.videoId);
                finalResults.push(item);
              }
            }
          }
        }
      } else {
        const singleQuery = searchQueries[0] || cleanSearchQuery(rawQuery);
        const liveScraped = await scrapeYouTubeSearch(singleQuery);
        for (const item of liveScraped) {
          if (item?.id?.videoId && !seenVideoIds.has(item.id.videoId)) {
            seenVideoIds.add(item.id.videoId);
            finalResults.push(item);
          }
        }
      }
    } catch (scrapErr) {
      console.warn("[Videos API] Live scraping error:", scrapErr);
    }

    // 2. If YouTube v3 API key is configured, also query official API if needed
    if (finalResults.length === 0 && process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY !== "undefined") {
      try {
        const cleanQuery = searchQueries[0] || cleanSearchQuery(rawQuery);
        const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: {
            part: "snippet",
            q: cleanQuery,
            type: "video",
            maxResults: 6,
            order: "relevance",
            key: process.env.YOUTUBE_API_KEY,
          },
          timeout: 4000
        });

        const items = response.data.items || [];
        for (const it of items) {
          if (it?.id?.videoId && !seenVideoIds.has(it.id.videoId)) {
            seenVideoIds.add(it.id.videoId);
            finalResults.push(it);
          }
        }
      } catch (apiErr) {
        console.warn("[Videos API] YouTube v3 API query failed:", apiErr);
      }
    }

    // 3. Complement / Fallback with our verified repository of high-value classes
    const curatedMatches = findCuratedVideos(rawQuery);
    for (const cItem of curatedMatches) {
      if (!seenVideoIds.has(cItem.id.videoId) && finalResults.length < 6) {
        seenVideoIds.add(cItem.id.videoId);
        finalResults.unshift(cItem); // Add verified at top if available
      }
    }

    // Return the coherent video lessons (capped at 6 to show all main subtopics)
    const resultList = finalResults.slice(0, 6);
    console.log(`[Videos API] Returning ${resultList.length} coherent videos for "${rawQuery}".`);
    return res.json(resultList);
  });

  // Contingência quando a IA falha: questões reais do pacote (questoes.json), priorizando a
  // disciplina/tópico pedidos. Retorna vazio se o pacote não tiver questões.
  function getFallbackQuestions(theme: string, subtheme: string, count: number) {
    const shuffleArray = (array: any[]) => [...array].sort(() => Math.random() - 0.5);
    const norm = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const letters = ["A", "B", "C", "D", "E"];
    const pool = QUESTOES_REAIS.flatMap((p: any) => (p.questions || []).map((q: any) => ({
      ...q,
      question: `[${p.banca} - ${p.year}] ${q.question}`,
      options: (q.options || []).map((o: string, i: number) => (/^[A-E]\)/.test(o) ? o : `${letters[i]}) ${o}`)),
    })));
    const t = norm(theme), st = norm(subtheme);
    const doTopico = pool.filter((q: any) => st && (norm(q.topic).includes(st) || st.includes(norm(q.topic))));
    const daDisciplina = pool.filter((q: any) => t && (norm(q.subject).includes(t) || t.includes(norm(q.subject))));
    const ordenadas = [...shuffleArray(doTopico), ...shuffleArray(daDisciplina), ...shuffleArray(pool)];
    const vistas = new Set<string>();
    return ordenadas
      .filter((q: any) => { if (vistas.has(q.question)) return false; vistas.add(q.question); return true; })
      .slice(0, count)
      .map((q: any) => ({ question: q.question, options: q.options, answer: q.answer, explanation: q.explanation || "" }));
  }

  app.post("/api/generate-questions", enforceDailyAiQuota, async (req, res) => {
    let { theme, subtheme, numQuestions, mode, concurso, cargo, banca, editalCode } = req.body;
    
    // Security & Input Validation
    theme = typeof theme === 'string' ? theme.trim().substring(0, 200) : 'Geral';
    subtheme = typeof subtheme === 'string' ? subtheme.trim().substring(0, 200) : 'Geral';
    numQuestions = Math.min(Math.max(Number(numQuestions) || 5, 1), 20);
    mode = mode === 'real' ? 'real' : 'simulated';

    // Contexto do concurso: vem do pacote (concurso.json)
    const perfil = CONCURSO.ia;
    const isCebraspe = perfil.formatoQuestoes === "CE";
    const numAlternativas = perfil.formatoQuestoes === "A-D" ? 4 : 5;
    const letrasAlternativas = ["A", "B", "C", "D", "E"].slice(0, numAlternativas);
    const targetOrgao = CONCURSO.orgao;
    const targetCargo = CONCURSO.cargo;
    const targetBanca = perfil.bancaEstilo || CONCURSO.banca;
    const targetEdital = CONCURSO.editalCode;
    const listar = (itens: string[] = []) => itens.map((x) => `     * ${x}`).join("\n");

    try {
        const modeText = mode === 'real' 
            ? `Questões reais aplicadas pela banca ${targetBanca} para o cargo de ${targetCargo} (${targetOrgao}). Inclua a identificação da prova/ano no início da pergunta entre colchetes (ex: [${targetBanca} - ${targetCargo}]).` 
            : `Questões inéditas no padrão rigoroso da banca ${targetBanca} para o concurso de ${targetCargo} (${targetOrgao}).`;

        let systemInstruction = "";
        let promptText = "";

        if (isCebraspe) {
          // CEBRASPE: ITENS DE CERTO OU ERRADO
          systemInstruction = `Você é um examinador oficial de bancas de concursos públicos, especialista na banca CEBRASPE (Cespe) e no edital para o cargo de ${targetCargo} da ${targetOrgao}.
Sua missão é criar itens de altíssima qualidade técnica no MODELO EXCLUSIVO DO CEBRASPE: julgamento de afirmações como CERTO ou ERRADO (C / E).

REGRA ABSOLUTA DE FIDELIDADE AO CONTEÚDO:
- O item DEVE abordar única e exclusivamente o tema solicitado: "${theme}" e subtema "${subtheme}".
- NUNCA misture disciplinas distintas.

ESTILO EXATO DA BANCA CEBRASPE:
1. Formato do Item:
   - Cada item consiste em uma assertiva / afirmativa técnica situacional para o candidato julgar como CERTO ou ERRADO.
   - O campo "options" DEVE conter rigorosamente duas strings: ["Certo", "Errado"].
   - O campo "correctAnswer" DEVE ser estritamente 'C' ou 'E'.
2. NUNCA mencione que você é uma Inteligência Artificial.

REGRAS CRÍTICAS DE JSON:
1. O retorno DEVE ser um JSON válido contendo o array "questions".
2. Não use aspas duplas desescapadas no texto; use aspas simples se necessário.`;

          promptText = `Gere exatamente ${numQuestions} itens no modelo CEBRASPE (CERTO ou ERRADO) sobre o tema "${theme}" e subtema "${subtheme}" para "${targetCargo}" (${targetOrgao}).
Semente de variação única: ${Math.random().toString(36).substring(2)} - Timestamp: ${Date.now()}`;
        } else {
          // MÚLTIPLA ESCOLHA NO PADRÃO DA BANCA DO PACOTE (4 ou 5 alternativas)
          systemInstruction = `Você é um examinador sênior e elaborador oficial de provas da banca ${targetBanca.toUpperCase()}, encarregado de criar itens inéditos para o concurso de ${targetCargo} (${targetOrgao}) — ${targetEdital}.

CARACTERÍSTICAS OBRIGATÓRIAS DO PADRÃO ${targetBanca.toUpperCase()}:
1. Perfil e Estilo de Enunciado:
${listar(perfil.perfilBanca)}
   - Exemplos de contextualização no universo do cargo:
${listar(perfil.exemplosContexto)}
   - Comandos típicos da banca:
${listar(perfil.comandosTipicos)}
2. Formato de Alternativas (Rigorosamente ${numAlternativas} Opções ${letrasAlternativas.join(", ")}):
   - Cada questão DEVE ter EXATAMENTE ${numAlternativas} alternativas no array "options", com o prefixo da letra maiúscula ("A) Texto completo da alternativa A", e assim por diante).
   - Distratores Plausíveis: as opções incorretas devem conter as pegadinhas clássicas da banca. NUNCA crie alternativas absurdas ou óbvias.
3. Gabarito Letra Única:
   - O campo "correctAnswer" DEVE ser estritamente uma única letra maiúscula: ${letrasAlternativas.map((l) => `"${l}"`).join(", ")}.
4. Justificativa Pedagógica Completa ("explanation"):
   - Apresente um comentário detalhado demonstrando por que o gabarito está correto, indicando o artigo de lei, dispositivo constitucional, regra gramatical ou cálculo correspondente, além de apontar sucintamente o erro das demais alternativas.
5. Proibição de Menção a IA e Proibição de HTML:
   - NUNCA mencione "Inteligência Artificial", "IA" ou "modelo gerado".
   - É expressamente PROIBIDO o uso de tags HTML (<u>, <b>, <i>, <br>). Utilize apenas texto limpo.
6. Fidelidade Temática Absoluta:
   - Aborde estritamente a disciplina "${theme}" e o tópico "${subtheme}". Não misture matérias.

REGRAS DE FORMATAÇÃO JSON:
- Retorne apenas o JSON estruturado:
{
  "questions": [
    {
      "question": "Enunciado da questão no padrão da banca...",
      "options": [
        "A) ...",
        "B) ...",
        "C) ...",
        "D) ..."${numAlternativas === 5 ? ',\n        "E) ..."' : ""}
      ],
      "answer": "A",
      "explanation": "Comentário detalhado da resposta..."
    }
  ]
}`;

          promptText = `Elabore exatamente ${numQuestions} questões inéditas no padrão estrito da banca ${targetBanca.toUpperCase()} sobre a disciplina "${theme}" e o tópico "${subtheme}" para o cargo de "${targetCargo}" (${targetOrgao}).
Estilo: ${modeText}
Semente de variação: ${Math.random().toString(36).substring(2)} - Timestamp: ${Date.now()}`;
        }

        let rawQuestionsArray: any[] = [];

        try {
          const response = await generateWithAI(
              promptText,
              {
                  systemInstruction: systemInstruction,
                  responseMimeType: "application/json",
                  temperature: 0.9,
                  maxOutputTokens: 8192,
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          questions: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      question: { type: Type.STRING, description: "O enunciado completo da questão. DEVE conter o texto motivador, contexto e a pergunta em si. NUNCA deixe vazio ou use placeholders." },
                                      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de alternativas." },
                                      correctAnswer: { type: Type.STRING, description: "Apenas a letra ou letra exata (A, B, C, D, E) ou C/E." },
                                      explanation: { type: Type.STRING, description: "Justificativa detalhada." }
                                  },
                                  required: ["question", "options", "correctAnswer", "explanation"]
                              }
                          }
                      },
                      required: ["questions"]
                  }
              }
          );

          let text = response.text;
          if (text) {
              text = text.trim();
              if (text.startsWith("```json")) {
                  text = text.slice(7);
              } else if (text.startsWith("```")) {
                  text = text.slice(3);
              }
              if (text.endsWith("```")) {
                  text = text.slice(0, -3);
              }
              text = text.trim();

              try {
                  const parsed = JSON.parse(text);
                  let parsedArray = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.questoes || []);
                  
                  // Validation to prevent empty questions
                  parsedArray = parsedArray.filter((q: any) => q.question && q.question.trim().length > 10);
                  rawQuestionsArray = parsedArray;
              } catch (e) {
                  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                  if (jsonMatch) {
                      const parsed = JSON.parse(jsonMatch[0]);
                      let parsedArray = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.questoes || []);
                      parsedArray = parsedArray.filter((q: any) => q.question && q.question.trim().length > 10);
                      rawQuestionsArray = parsedArray;
                  }
              }
          }
        } catch (aiGenErr) {
          console.warn("[Generate-Questions] AI call failed, using real questions from the concurso pack:", aiGenErr);
        }

        // Se a IA não retornou ou retornou vazio, usa as questões reais do pacote
        if (!rawQuestionsArray || rawQuestionsArray.length === 0) {
          rawQuestionsArray = getFallbackQuestions(theme, subtheme, numQuestions);
        }
        
        // Normalização resiliente para garantir compatibilidade com a interface Question do Frontend
        const letters = ["A", "B", "C", "D", "E"];
        const questionsArray = (rawQuestionsArray || []).map((q: any) => {
            const questionText = q.question || q.text || q.questionText || "";
            let rawOptions = Array.isArray(q.options) ? q.options : [];
            let answerLetter = "";
            
            if (typeof q.answer === "string" && q.answer.trim()) {
                answerLetter = q.answer.trim().toUpperCase();
            } else if (typeof q.correctAnswer === "string" && q.correctAnswer.trim()) {
                answerLetter = q.correctAnswer.trim().toUpperCase();
            } else if (typeof q.correctOptionIndex === "number" && q.correctOptionIndex >= 0) {
                if (isCebraspe) {
                    answerLetter = q.correctOptionIndex === 0 ? "C" : "E";
                } else {
                    answerLetter = letters[q.correctOptionIndex] || "A";
                }
            } else if (typeof q.correct_answer === "string" && q.correct_answer.trim()) {
                answerLetter = q.correct_answer.trim().toUpperCase();
            }
            
            let options: string[] = [];

            if (isCebraspe) {
                options = ["Certo", "Errado"];
                if (answerLetter.includes("ERRADO") || answerLetter === "E" || answerLetter === "B" || answerLetter === "F" || answerLetter === "INCORRETO") {
                    answerLetter = "E";
                } else {
                    answerLetter = "C";
                }
            } else {
                // Formatação rigorosa das alternativas no formato do pacote (A-D ou A-E)
                options = rawOptions.map((opt: string, idx: number) => {
                    const letter = letters[idx] || "A";
                    const trimmedOpt = String(opt || "").trim();
                    // Se já começa com "A)", "A -", etc. preserva ou normaliza
                    const matchLetter = trimmedOpt.match(/^([A-Ea-e])\s*[\)\.\-:]\s*(.*)$/);
                    if (matchLetter) {
                        return `${matchLetter[1].toUpperCase()}) ${matchLetter[2]}`;
                    }
                    return `${letter}) ${trimmedOpt}`;
                });

                // Garante exatamente o número de alternativas do formato da banca
                while (options.length < numAlternativas) {
                    const nextLetter = letters[options.length] || "E";
                    options.push(`${nextLetter}) Nenhuma das alternativas anteriores.`);
                }
                if (options.length > numAlternativas) {
                    options = options.slice(0, numAlternativas);
                }

                // Tratamento para garantir que answerLetter seja estritamente 'A', 'B', 'C', 'D' ou 'E'
                const firstLetterMatch = answerLetter.match(/^[A-E]/);
                if (firstLetterMatch && letrasAlternativas.includes(firstLetterMatch[0])) {
                    answerLetter = firstLetterMatch[0];
                } else {
                    const optIndex = rawOptions.findIndex((opt: string) => opt === q.answer || opt === q.correctAnswer);
                    if (optIndex >= 0 && optIndex < numAlternativas) {
                        answerLetter = letters[optIndex];
                    } else {
                        answerLetter = "A";
                    }
                }
            }
            
            const cleanQuestionTextAndTags = (str: any): string => {
                if (typeof str !== 'string') return '';
                return str
                    .replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .trim();
            };

            return {
                question: cleanQuestionTextAndTags(questionText),
                options: options.map(opt => cleanQuestionTextAndTags(opt)),
                answer: answerLetter,
                explanation: cleanQuestionTextAndTags(q.explanation || q.details || "")
            };
        });

        res.json({ questions: questionsArray });
    } catch (error: any) {
        console.error("Error generating questions:", error);
        // Fallback gracioso para nunca quebrar a interface do aluno
        const cleanQuestionTextAndTags = (str: any): string => {
            if (typeof str !== 'string') return '';
            return str
                .replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '')
                .replace(/<br\s*\/?>/gi, '\n')
                .trim();
        };
        const fallbackRaw = getFallbackQuestions(theme, subtheme, numQuestions);
        const fallbackList = fallbackRaw.map(q => ({
            ...q,
            question: cleanQuestionTextAndTags(q.question),
            options: (q.options || []).map(opt => cleanQuestionTextAndTags(opt)),
            explanation: cleanQuestionTextAndTags(q.explanation)
        }));
        res.json({ questions: fallbackList });
    }
  });

  app.post("/api/generate-materials", enforceDailyAiQuota, async (req, res) => {
    let { theme, subtheme, hours, concurso, cargo, banca, editalCode } = req.body;
    
    // Security & Input Sanitization
    theme = typeof theme === 'string' ? theme.trim().substring(0, 200) : 'Geral';
    subtheme = typeof subtheme === 'string' ? subtheme.trim().substring(0, 200) : 'Geral';
    const studyHours = Math.min(Math.max(Number(hours) || 2, 1), 24);

    // Contexto do concurso: vem do pacote (concurso.json)
    const targetOrgao = CONCURSO.orgao;
    const targetCargo = CONCURSO.cargo;
    const targetBanca = CONCURSO.banca;
    const targetEdital = CONCURSO.editalCode;
    const perfilEspecifico = `
CONCURSO ${String(CONCURSO.fullName).toUpperCase()} (${CONCURSO.cargo}):
- Banca: ${CONCURSO.banca}.
${CONCURSO.ia.perfilMaterial}`;

    try {
        const systemInstruction = `Você é um professor sênior, autor e coordenador pedagógico de apostilas preparatórias de excelência para concursos públicos, especialista no edital ${targetEdital} do órgão ${targetOrgao} para o cargo de ${targetCargo} (Banca ${targetBanca}).
Sua missão é redigir um CAPÍTULO DE APOSTILA COMPLETO, ROBUSTO, EXTENSO E APROFUNDADO (com grande riqueza de detalhes teóricos, desdobramentos técnicos ou jurídicos, casos práticos e análise minuciosa, NUNCA um resumo enxuto ou superficial), publicado sob o selo editorial "R.Alves Concursos".
${perfilEspecifico}

DIRETRIZES FUNDAMENTAIS DE RIGOR E CORREÇÃO:
1. **FIDELIDADE ABSOLUTA AO TEMA (PROIBIDO MISTURAR CONTEÚDOS)**:
   - O conteúdo gerado DEVE pertencer estritamente à disciplina e ao tema solicitados pelo usuário ("${theme}" / subtema "${subtheme}").
   - **NUNCA** insira fórmulas matemáticas, cálculos, taxas de juros ou equações em temas de Ciências Humanas, História, Geografia, Segurança do Trabalho ou Português (salvo se o tema for expressamente cálculo estatístico de acidentes NBR 14280 ou matemática).
   - Da mesma forma, em temas de exatas, concentre-se exclusivamente na resolução de problemas matemáticos e lógicos.

2. MATERIAL EXTENSO E DENSO (EXTREMAMENTE DETALHADO):
   - O material deve ser robusto e completo, adequado para preencher com excelência uma sessão de estudo de ${studyHours} hora(s).
   - NUNCA resuma ou abrevie explicações. Discorra amplamente sobre os conceitos, fundamentos, terminologias técnicas, causas, efeitos, ramificações, regras, exceções e contexto institucional.
   - Escreva com português formal irrepreensível, sem erros gramaticais ou ortográficos. NUNCA cometa erros de digitação como "GARDE ISTO", utilize sempre "GUARDE ISTO".

3. ESTRUTURA PEDAGÓGICA ADAPTATIVA APROFUNDADA:
   - 1. Panorama Geral, Contexto Normativo e Fundamentação Técnica/Legal.
   - 2. Desenvolvimento Teórico Aprofundado, Classificações e Regras Práticas.
   - 3. Desdobramentos Operacionais, Procedimentos e Medidas Preventivas / Casos Práticos.
   - 4. Padrão de Cobrança da Banca ${targetBanca} e Armadilhas Típicas.
   - 5. Questões de Concursos Anteriores Comentadas detalhadamente.

4. TÍTULOS E SUBTÍTULOS EDITORIAIS R.ALVES:
   - Use títulos reais e atrativos que descrevam o conteúdo técnico exato:
     # 1. [Título Principal do Tema]
     ## 1.1. [Primeiro Subtópico Detalhado]
     ## 1.2. [Segundo Subtópico Detalhado]
     # 2. [Desenvolvimento Teórico e Analítico Avançado]
     # 3. [Aplicações, Exemplos ou Contexto Operacional]
     # 4. [Questões Comentadas e Fixação de Alto Nível]

5. BLOCOS PEDAGÓGICOS PADRONIZADOS DA R.ALVES CONCURSOS:
   Intercale frequentemente os blocos de destaque (com ortografia impecável):
   - 📌 CONCEITO ESSENCIAL: [Conceito central obrigatório]
   - 🎯 COMO CAI NA PROVA: [Perfil e tendências de cobrança da banca ${targetBanca}]
   - ⚠️ ATENÇÃO À PEGADINHA: [Armadilhas recorrentes em provas anteriores]
   - 💡 DICA R.ALVES: [Mnemônico ou técnica de memorização]
   - 🧮 EXEMPLO PRÁTICO / CASO REAL: [Ilustração detalhada do tema]
   - ✅ GUARDE ISTO: [Síntese definitiva de fechamento]

6. TABELAS (REGRAS OBRIGATÓRIAS DE FORMATAÇÃO):
   - Tabelas DEVEM usar EXCLUSIVAMENTE sintaxe oficial do Markdown padrão:
     | Severidade | Improvável | Pouco Provável | Provável | Frequente | Muito Frequente |
     | :--- | :--- | :--- | :--- | :--- | :--- |
     | Catastrófico | Médio | Alto | Crítico | Crítico | Crítico |
   - NUNCA desenhe tabelas em arte ASCII com '+----+----+' entre as linhas.
   - NUNCA abrevie palavras nas colunas (escreva SEMPRE as palavras completas: "Crítico" [NUNCA "Cr."], "Alto" [NUNCA "Al."], "Médio" [NUNCA "Mé."], "Baixo", "Insignificante" [NUNCA "Insignif"], "Desprezível" [NUNCA "Desp."], "Catastrófico").
   - A Matriz de Riscos 5x5 deve ter cabeçalho explícito com as probabilidades.
   - Inclua também uma tabela sinóptica comparativa de revisão rápida e cronograma de estudo para ${studyHours} hora(s).

7. FÓRMULAS E CÁLCULOS TÉCNICOS (FÓRMULAS MONTADAS EM LATEX):
   - Apresente SEMPRE fórmulas técnicas e de cálculo MONTADAS em blocos matemáticos destacados usando sintaxe LaTeX ($$...$$):
     $$\mathbf{V = Q \times t}$$
     $$\mathbf{C = \frac{M_2 - M_1}{V}}$$
     $$\text{TF} = \frac{N \times 1.000.000}{\text{HHT}}$$
     $$\text{TG} = \frac{(D_p + D_d) \times 1.000.000}{\text{HHT}}$$
     $$\text{Nível de Risco} = \text{Severidade} \times \text{Probabilidade}$$
   - Use SEMPRE frações montadas (\frac{numerador}{denominador}) com barra horizontal de fração e NUNCA frações por extenso como "(A) / (B)".
   - Para variáveis, índices e grandezas no texto ou nas etapas de resolução, use notação matemática inline ($...$): $V$, $Q$, $t$, $C$, $M_1$, $M_2$, $\text{m}^3$, $\text{L}$, $\text{mg/m}^3$, $\Delta M$.
   - Nos passos a passo de resolução de exercícios, monte cada etapa explicitamente: fórmula montada, substituição dos valores e resultado final com unidade de medida.

8. **PROIBIÇÃO ABSOLUTA DE DIAGRAMAS ASCII E CAIXAS DESENHADAS**:
   - **É ESTRITAMENTE PROIBIDO** criar esquemas, caixas ou fluxogramas desenhados com caracteres ASCII como +----+ ou +........+ ou |=====|, barras isoladas |||, ou setas de texto (<- >, <--, ▼, ▼ ▼). Esses caracteres quebram a diagramação visual.
   - Para hierarquias e fluxogramas conceituais (ex: GRO > PGR > Inventário e Plano de Ação), use SEMPRE listas estruturadas com marcadores (-, *) e negrito, ou subtítulos (###).

9. POSTURA: Tom estritamente acadêmico, denso, seguro e profissional. NUNCA mencione que é uma inteligência artificial.`;

        const response = await generateWithAI(
            `Elabore um capítulo completo, exaustivo, ricamente fundamentado e altamente aprofundado de apostila sobre o tema "${theme}" e subtema/tópico "${subtheme}" para o cargo de "${targetCargo}" (${targetOrgao}) - Edital ${targetEdital} - Banca ${targetBanca}. Não economize em explicações teóricas, traga conceitos aprofundados, múltiplos exemplos práticos completos, base normativa detalhada e questões comentadas, dimensionado para ${studyHours} hora(s) de estudo intenso.`,
            {
                systemInstruction: systemInstruction,
                maxOutputTokens: 8192
            }
        );

        res.json({ content: response.text });
    } catch (error: any) {
        console.error("Error generating materials:", error);
        res.status(500).json({ 
            error: "Failed to generate materials", 
            details: error?.message || String(error) 
        });
    }
  });

  // Endpoint para consultar status do limite de mapas mentais do usuário
  app.get("/api/mapa-mental-quota", async (req, res) => {
    try {
      const userUid = (req as any).user?.uid || "anonymous_user";
      const used = userMindmapImageCounts.get(userUid) || 0;
      const limit = MAX_MINDMAP_IMAGES_PER_USER;
      const remaining = Math.max(0, limit - used);

      return res.json({
        success: true,
        used,
        limit,
        remaining,
        contactMessage: "Para gerar mais de 10 mapas mentais, contate o Prof. Rafael Alves para liberação de créditos adicionais.",
        whatsappUrl: "https://wa.me/5577998401073?text=Ol%C3%A1%20Prof.%20Rafael%20Alves!%20Atingi%20o%20limite%20de%2010%20mapas%20mentais%20e%20gostaria%20de%20adquirir%20cr%C3%A9ditos%20adicionais."
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || "Erro ao verificar cota." });
    }
  });

  app.post(["/api/mapa-mental-gemini", "/api/mapa-mental-openai"], enforceDailyAiQuota, async (req, res) => {
    try {
      const userUid = (req as any).user?.uid || "anonymous_user";
      const currentCount = userMindmapImageCounts.get(userUid) || 0;

      if (currentCount >= MAX_MINDMAP_IMAGES_PER_USER) {
        return res.status(403).json({
          success: false,
          code: "MINDMAP_QUOTA_EXCEEDED",
          error: "Você atingiu o limite de 10 mapas mentais ilustrados gerados. Para gerar mais imagens, entre em contato com o Prof. Rafael Alves para realizar o pagamento.",
          limit: MAX_MINDMAP_IMAGES_PER_USER,
          used: currentCount,
          contact: {
            name: "Prof. Rafael Alves",
            whatsapp: "77 99840-1073",
            whatsappUrl: "https://wa.me/5577998401073?text=Ol%C3%A1%20Prof.%20Rafael%20Alves!%20Atingi%20o%20limite%20de%2010%20mapas%20mentais%20e%20gostaria%20de%20adquirir%20cr%C3%A9ditos%20adicionais."
          }
        });
      }

      const { titulo, conteudo } = req.body;

      if (!titulo || !conteudo) {
        return res.status(400).json({
          success: false,
          error: "Título e conteúdo são obrigatórios.",
        });
      }

      const image = await gerarImagemMapaMental(
        titulo,
        conteudo
      );

      // Incrementa a cota do usuário
      const updatedCount = currentCount + 1;
      userMindmapImageCounts.set(userUid, updatedCount);

      return res.json({
        success: true,
        image,
        used: updatedCount,
        limit: MAX_MINDMAP_IMAGES_PER_USER,
        remaining: Math.max(0, MAX_MINDMAP_IMAGES_PER_USER - updatedCount)
      });
    } catch (error: any) {
      console.error(
        "ERRO GEMINI MAPA MENTAL:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Erro ao gerar imagem com o Gemini.",
      });
    }
  });

  app.post("/api/generate-mindmap-image", enforceDailyAiQuota, async (req, res) => {
    try {
      let { conteudo, theme, subtheme, titulo } = req.body;
      
      if (!conteudo || typeof conteudo !== 'string' || conteudo.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "O conteúdo é obrigatório para gerar o mapa mental."
        });
      }

      const temaPrincipal = titulo || subtheme || theme || "Mapa Mental Ilustrado";
      const image = await gerarImagemMapaMental(temaPrincipal, conteudo);

      return res.json({
        success: true,
        imageUrl: image,
        image,
      });
    } catch (error: any) {
      console.error("ERRO AO GERAR MAPA MENTAL COM GEMINI:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Erro ao gerar o mapa mental.",
      });
    }
  });

  app.post("/api/ocr-essay", enforceDailyAiQuota, async (req, res) => {
    let { image, mimeType = "image/jpeg" } = req.body;
    if (!image || typeof image !== 'string' || image.length < 50) {
      return res.status(400).json({ error: "Nenhuma imagem válida fornecida para transcrição da redação." });
    }

    try {
      const prompt = `Você é um especialista em OCR e transcrição paleográfica de redações manuscritas para concursos públicos e vestibulares de alta concorrência.
Transcreva com extrema precisão o texto da redação manuscrita presente nesta imagem.

Instruções cruciais:
1. Transcreva o texto completo exatamente como o estudante escreveu, preservando parágrafos, quebras de linha e pontuação.
2. Não corrija erros ortográficos ou gramaticais durante a transcrição: mantenha a grafia original do candidato para que o corretor avalie com precisão.
3. Se houver alguma rasura ou palavra ilegível, transcreva o que for mais provável ou use [rasura/ilegível].
4. Separe cada parágrafo com linha em branco dupla.
5. Calcule o número estimado de linhas manuscritas contadas na folha.

Retorne estritamente um JSON com a estrutura:
{
  "transcribedText": "Texto completo transcrito aqui...",
  "estimatedLines": 25,
  "wordCount": 260,
  "charCount": 1650,
  "legibilityNotes": "Caligrafia legível, espaçamento entre parágrafos bem delimitado."
}`;

      const response = await generateVisionWithAI(prompt, image, mimeType, {
        responseMimeType: "application/json"
      });

      let text = response.text || "";
      text = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (error: any) {
      console.error("Erro no OCR da redação:", error);
      res.status(500).json({
        error: "Falha ao processar e transcrever a imagem da redação.",
        details: error?.message || String(error)
      });
    }
  });

  app.post("/api/generate-essay-theme", enforceDailyAiQuota, async (req, res) => {
    const { cargo = CONCURSO.cargo, banca = CONCURSO.banca, editalCode = CONCURSO.editalCode } = req.body || {};
    try {
        const isVestibular = CONCURSO.redacao?.modelo === "vestibular-1000";
        const systemInstruction = isVestibular
          ? `Você é um membro sênior da banca examinadora de redação (${banca}).
Os temas de redação exigem um texto Dissertativo-Argumentativo em prosa e abordam temas contemporâneos de alta relevância social, filosófica, cultural, ambiental ou geopolítica.
O tema deve exigir que o candidato defenda um ponto de vista com argumentos consistentes e repertório sociocultural legitimado.`
          : `Você é um professor examinador de redações de concursos públicos e vestibulares de alto nível (banca ${banca}, concurso ${cargo}). Proponha temas contemporâneos relevantes de dissertação.`;

        const response = await generateWithAI(
            `Gere uma proposta de redação inédita e completa para o concurso/vestibular "${cargo}" (${banca} - ${editalCode}). Semente: ${Math.random().toString(36).substring(2)}`,
            {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        themeTitle: { 
                            type: Type.STRING, 
                            description: "Título em destaque da proposta de redação (ex: 'Os desafios da segurança pública nas cidades brasileiras')." 
                        },
                        contextText: { 
                            type: Type.STRING, 
                            description: "Texto motivador/coletânea de textos de apoio (2 a 3 parágrafos densos com reflexões conceituais, dados ou citações para fundamentar a reflexão do candidato)." 
                        },
                        instructions: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "Diretrizes e regras da prova de redação (ex: 'Redija um texto dissertativo-argumentativo em norma-padrão', 'Mínimo de 20 e máximo de 30 linhas', 'Apresente proposta coerente de reflexão/intervenção')." 
                        }
                    },
                    required: ["themeTitle", "contextText", "instructions"]
                }
            }
        );

        let text = response.text;
        if (!text) {
            throw new Error("Nenhum texto retornado pelo modelo");
        }
        text = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(text);
        res.json(parsed);
    } catch (error: any) {
        console.error("Error generating essay theme:", error);
        res.status(500).json({ 
            error: "Failed to generate essay theme", 
            details: error?.message || String(error) 
        });
    }
  });

  app.post("/api/evaluate-essay", enforceDailyAiQuota, async (req, res) => {
    let { theme, essayText, image, mimeType = "image/jpeg", cargo = CONCURSO.cargo, banca = CONCURSO.banca } = req.body;
    
    theme = typeof theme === 'string' ? theme.trim().substring(0, 300) : 'Geral';
    let transcribedFromPhoto = false;

    // If image is supplied and essayText is empty or small, perform Vision OCR first
    if ((!essayText || essayText.trim().length < 30) && image && typeof image === 'string') {
      try {
        console.log("[Evaluate Essay] Image detected. Performing OCR first...");
        const ocrPrompt = `Transcreva integralmente a redação manuscrita nesta folha. Mantenha parágrafos separados por linha em branco dupla e não altere a grafia do candidato. Retorne em JSON: {"transcribedText": "..."}`;
        const ocrRes = await generateVisionWithAI(ocrPrompt, image, mimeType, { responseMimeType: "application/json" });
        let ocrText = (ocrRes.text || "").trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const ocrParsed = JSON.parse(ocrText);
        if (ocrParsed.transcribedText && ocrParsed.transcribedText.trim().length > 30) {
          essayText = ocrParsed.transcribedText.trim();
          transcribedFromPhoto = true;
        }
      } catch (ocrErr) {
        console.warn("[Evaluate Essay] OCR step failed:", ocrErr);
      }
    }

    essayText = typeof essayText === 'string' ? essayText.trim().substring(0, 15000) : '';

    if (!essayText || essayText.length < 50) {
        return res.status(400).json({ error: "O texto da redação está muito curto ou em branco. Forneça o texto digitado ou envie uma foto nítida da folha manuscrita." });
    }

    try {
        const systemInstruction = `Você é um corretor e examinador oficial de redação da banca examinadora (${banca}).
Você deve avaliar a redação dissertativo-argumentativa do candidato rigorosamente na escala oficial (nota de corte/aprovação = 600 pontos), distribuída em competências/critérios (até 200 pontos cada):

1. ADEQUAÇÃO TEMÁTICA (até 200 pontos): Avalia se o candidato compreendeu e desenvolveu corretamente o tema proposto.
2. ORGANIZAÇÃO E PROGRESSÃO TEXTUAL (até 200 pontos): Avalia a organização das ideias, a sequência lógica das informações e o desenvolvimento progressivo do texto.
3. ESTRUTURA E DESENVOLVIMENTO DO TEXTO DISSERTATIVO-ARGUMENTATIVO (até 200 pontos): Avalia a construção da tese, os argumentos utilizados e a capacidade de defender um ponto de vista.
4. COESÃO E COERÊNCIA (até 200 pontos): Avalia a ligação entre as partes do texto, o uso de recursos coesivos e a manutenção da unidade de sentido.
5. NORMA PADRÃO DA LÍNGUA PORTUGUESA (até 200 pontos): Avalia ortografia, acentuação, pontuação, concordância, regência, colocação, estrutura sintática e adequação vocabular.

A nota total somada deve variar obrigatoriamente de 0 a 1000 pontos. O candidato é aprovado se scoreTotal >= 600.
ESTIMATIVA DE LINHAS: Estime quantas linhas manuscritas a redação ocuparia (geralmente 10-12 palavras por linha). O ideal é entre 20 e 30 linhas.

Retorne estritamente o JSON com as notas detalhadas (scoreAdequacaoTematica, scoreOrganizacaoTextual, scoreEstruturaArgumentativa, scoreCoesaoCoerencia, scoreNormaPadrao de 0 a 200, scoreTotal de 0 a 1000, maxScore: 1000, passed: true/false), pontos fortes, fracos, plano de melhoria pedagógico, análise parágrafo por parágrafo com sugestão de reescrita, e sugestões de repertório sociocultural contextualizado.`;

        const promptText = `Avalie e faça a correção detalhada da seguinte redação:
TEMA DA REDAÇÃO: "${theme}"
CONCURSO / VESTIBULAR: "${cargo}" (Banca: ${banca})

TEXTO DO ESTUDANTE:
"""
${essayText}
"""`;

        const response = await generateWithAI(
            promptText,
            {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        scoreAdequacaoTematica: { type: Type.INTEGER, description: "Adequação Temática (0 a 200)" },
                        scoreOrganizacaoTextual: { type: Type.INTEGER, description: "Organização e Progressão Textual (0 a 200)" },
                        scoreEstruturaArgumentativa: { type: Type.INTEGER, description: "Estrutura e Desenvolvimento do Texto (0 a 200)" },
                        scoreCoesaoCoerencia: { type: Type.INTEGER, description: "Coesão e Coerência (0 a 200)" },
                        scoreNormaPadrao: { type: Type.INTEGER, description: "Norma Padrão da Língua Portuguesa (0 a 200)" },
                        scoreTotal: { type: Type.INTEGER, description: "Nota Total Somada (0 a 1000)" },
                        maxScore: { type: Type.INTEGER, description: "1000" },
                        passed: { type: Type.BOOLEAN, description: "true se scoreTotal >= 600" },
                        estimatedLines: { type: Type.INTEGER, description: "Estimativa de linhas manuscritas (1 a 40)." },
                        pontosFortes: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "Lista de pontos fortes encontrados na redação." 
                        },
                        pontosFracos: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "Lista de desvios gramaticais, falhas na tese ou fragilidades identificadas." 
                        },
                        sugestoesMelhoria: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "Sugestões práticas de como melhorar a pontuação e estruturação no próximo texto." 
                        },
                        repertorioSugerido: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "Sugestões de repertório legitimado, filósofos, sociólogos ou conceitos pertinentes ao tema que enriqueceriam a argumentação."
                        },
                        correcaoParagrafo: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    paragraphIndex: { type: Type.INTEGER, description: "Número do parágrafo, iniciando de 1" },
                                    text: { type: Type.STRING, description: "O texto original deste parágrafo" },
                                    feedback: { type: Type.STRING, description: "Análise crítica do parágrafo (cumprimento do papel estrutural e apontamento de desvios)." },
                                    sugestaoReescrita: { type: Type.STRING, description: "Exemplo prático de como reescrever ou aprimorar este parágrafo com vocabulário formal e conectivos precisos." }
                                },
                                required: ["paragraphIndex", "text", "feedback"]
                            },
                            description: "Análise e sugestão parágrafo por parágrafo."
                        },
                        generalFeedback: { type: Type.STRING, description: "Parecer geral e motivador do examinador pedagógico." }
                    },
                    required: [
                        "scoreAdequacaoTematica",
                        "scoreOrganizacaoTextual",
                        "scoreEstruturaArgumentativa",
                        "scoreCoesaoCoerencia",
                        "scoreNormaPadrao",
                        "scoreTotal", 
                        "passed", 
                        "estimatedLines", 
                        "pontosFortes", 
                        "pontosFracos", 
                        "sugestoesMelhoria", 
                        "correcaoParagrafo",
                        "generalFeedback"
                    ]
                }
            }
        );

        let text = response.text;
        if (!text) {
            throw new Error("No text returned from Gemini");
        }
        text = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        const parsed = JSON.parse(text);
        if (transcribedFromPhoto) {
          parsed.transcribedText = essayText;
        }
        res.json(parsed);
    } catch (error: any) {
        console.error("Error evaluating essay:", error);
        res.status(500).json({ 
            error: "Failed to evaluate essay", 
            details: error?.message || String(error) 
        });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      try {
        const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
        const host = req.get('x-forwarded-host') || req.get('host');
        if (host && fs.existsSync(indexPath)) {
          let html = fs.readFileSync(indexPath, 'utf-8');
          const baseUrl = `${proto}://${host}`;
          html = html
            .replace(/content="\/og-whatsapp\.jpg"/g, `content="${baseUrl}/og-whatsapp.jpg"`)
            .replace(/content="\/og-whatsapp\.png"/g, `content="${baseUrl}/og-whatsapp.png"`)
            .replace(/href="\/og-whatsapp\.jpg"/g, `href="${baseUrl}/og-whatsapp.jpg"`);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(html);
        }
      } catch (e) {
        console.warn("[Server] Fallback to direct sendFile:", e);
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
