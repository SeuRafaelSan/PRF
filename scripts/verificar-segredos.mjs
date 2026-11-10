#!/usr/bin/env node
// Bloqueia chaves de API e outros segredos antes que entrem no Git.
// Uso:
//   node scripts/verificar-segredos.mjs            → arquivos preparados para commit (git hook)
//   node scripts/verificar-segredos.mjs --todos    → todos os arquivos versionados
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const PADROES = [
  { nome: 'Chave OpenAI', re: /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/ },
  { nome: 'Chave Anthropic', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { nome: 'Chave Google (Gemini/YouTube/Cloud)', re: /AIza[0-9A-Za-z_-]{35}/ },
  { nome: 'Token GitHub', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/ },
  { nome: 'Chave privada', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { nome: 'Conta de serviço Google', re: /"type"\s*:\s*"service_account"/ },
];

// A apiKey web do Firebase é pública por natureza (vai para o navegador de qualquer aluno);
// a proteção dela é a restrição de domínio no Google Cloud, não o sigilo.
const PERMITIDOS = [{ arquivo: 'firebase-applet-config.json', linha: /^\s*"apiKey"\s*:/ }];
// Arquivos que nunca devem ser versionados, mesmo sem padrão reconhecido.
const PROIBIDOS = [/(^|\/)\.env(\.[^/]*)?$/, /\.zip$/i, /(^|\/)serviceAccount.*\.json$/i];
const EXCECOES_PROIBIDOS = [/(^|\/)\.env\.example$/];

const todos = process.argv.includes('--todos');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const arquivos = (todos ? git('ls-files') : git('diff', '--cached', '--name-only', '--diff-filter=ACMR'))
  .split('\n').map((s) => s.trim()).filter(Boolean);

const problemas = [];
for (const arq of arquivos) {
  if (PROIBIDOS.some((re) => re.test(arq)) && !EXCECOES_PROIBIDOS.some((re) => re.test(arq))) {
    problemas.push(`${arq}: este tipo de arquivo não pode ir para o repositório`);
    continue;
  }
  let conteudo;
  try {
    // No hook, confere o que vai de fato para o commit (a versão preparada)
    conteudo = todos ? fs.readFileSync(arq, 'utf8') : git('show', `:${arq}`);
  } catch { continue; }
  if (conteudo.includes('\u0000')) continue; // binário
  conteudo.split('\n').forEach((linha, i) => {
    for (const p of PADROES) {
      if (!p.re.test(linha)) continue;
      if (PERMITIDOS.some((x) => arq.endsWith(x.arquivo) && x.linha.test(linha))) continue;
      problemas.push(`${arq}:${i + 1}: ${p.nome}`);
    }
  });
}

if (problemas.length) {
  console.error('\n✖ SEGREDO DETECTADO — commit bloqueado:\n');
  problemas.forEach((p) => console.error(`  • ${p}`));
  console.error('\nMova as chaves para .env.local (que não é versionado) e tente de novo.\n');
  process.exit(1);
}
console.log(`✔ Nenhum segredo encontrado (${arquivos.length} arquivo(s) verificados).`);
