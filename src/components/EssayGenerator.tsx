import React, { useState, useRef, useEffect } from 'react';
import { 
  PenTool, 
  History, 
  Upload, 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  FileText, 
  BookOpen, 
  Trash2, 
  Camera, 
  Image as ImageIcon, 
  RefreshCw, 
  Eye, 
  Sparkle,
  Layers,
  BookMarked,
  HelpCircle,
  FileCheck2,
  ScanLine
} from 'lucide-react';
import { useConcurso } from '../lib/concursoContext';
import { doc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserId } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { BRAND_ASSETS } from '../constants/brandAssets';
import LiquidLoader from './LiquidLoader';

export interface EssayParagraphCorrection {
  paragraphIndex: number;
  text: string;
  feedback: string;
  sugestaoReescrita?: string;
}

export interface EssayEvaluation {
  scoreAdequacaoTematica?: number;
  scoreOrganizacaoTextual?: number;
  scoreEstruturaArgumentativa?: number;
  scoreCoesaoCoerencia?: number;
  scoreNormaPadrao?: number;
  scoreConteudo?: number;
  scoreEstrutura?: number;
  scoreExpressao?: number;
  scoreArgumentacao?: number;
  scoreTotal: number;
  maxScore?: number;
  passed: boolean;
  estimatedLines: number;
  pontosFortes: string[];
  pontosFracos: string[];
  sugestoesMelhoria: string[];
  repertorioSugerido?: string[];
  correcaoParagrafo: EssayParagraphCorrection[];
  generalFeedback: string;
  transcribedText?: string;
  createdAt?: string;
  theme?: string;
  essayText?: string;
  id?: string;
}

interface EssayTheme {
  themeTitle: string;
  contextText: string;
  instructions: string[];
}

// Tema exibido quando o pacote do concurso não traz temas sugeridos (redacao.temasSugeridos).
const TEMA_PADRAO: EssayTheme = {
  themeTitle: "Gere um tema inédito no padrão da banca",
  contextText: "Clique em \"Gerar novo tema\" para receber uma proposta de redação inédita, alinhada ao cargo e à banca deste concurso. Você também pode escrever livremente sobre um tema de sua escolha e enviar para correção.",
  instructions: [
    "Redija um texto dissertativo-argumentativo em norma-padrão da Língua Portuguesa.",
    "Apresente tese clara e argumentos consistentes.",
    "Respeite a extensão exigida no edital."
  ]
};

export default function EssayGenerator() {
  const { currentConcurso, currentConcursoId } = useConcurso();
  // vestibular-1000: competências de 250 pts (padrão vestibular) | concurso-100: critérios de concurso
  const isVestibular = currentConcurso.redacao.modelo === 'vestibular-1000';
  const temasSugeridos: EssayTheme[] = currentConcurso.redacao.temasSugeridos.length
    ? currentConcurso.redacao.temasSugeridos
    : [TEMA_PADRAO];

  const [currentTheme, setCurrentTheme] = useState<EssayTheme>(temasSugeridos[0]);
  const [essayText, setEssayText] = useState('');
  const [inputMode, setInputMode] = useState<'keyboard' | 'photo'>('keyboard');
  
  // Photo / Image state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [isTranscribingOcr, setIsTranscribingOcr] = useState(false);
  const [ocrNotes, setOcrNotes] = useState<string | null>(null);

  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EssayEvaluation | null>(null);
  const [history, setHistory] = useState<EssayEvaluation[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [error, setError] = useState<string | null>(null);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState('');
  const [itemToDelete, setItemToDelete] = useState<EssayEvaluation | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const userId = useUserId();

  // Load history from Firebase and LocalStorage
  const loadHistory = async () => {
    let firebaseItems: EssayEvaluation[] = [];
    if (userId) {
      try {
        const qRef = collection(db, `users/${userId}/essays`);
        const snapshot = await getDocs(qRef);
        snapshot.forEach((docSnap) => {
          firebaseItems.push({ id: docSnap.id, ...docSnap.data() } as EssayEvaluation);
        });
      } catch (err) {
        console.warn("Could not load history from Firestore:", err);
      }
    }

    const local = localStorage.getItem('essay_history');
    const localItems: EssayEvaluation[] = local ? JSON.parse(local) : [];

    const map = new Map<string, EssayEvaluation>();
    [...firebaseItems, ...localItems].forEach(item => {
      if (item.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
    setHistory(combined);
  };

  useEffect(() => {
    loadHistory();
  }, [userId]);

  // Loading animation stages text
  useEffect(() => {
    if (!isEvaluating && !isTranscribingOcr) return;
    const stages = isTranscribingOcr 
      ? [
          "Processando imagem da redação manuscrita...",
          "Realizando OCR paleográfico de alta precisão...",
          "Reconhecendo caligrafia e delimitando parágrafos...",
          "Calculando linhas ocupadas na folha..."
        ]
      : [
          "Lendo texto e analisando estrutura macro...",
          "Avaliando tese, coerência e tipologia dissertativa...",
          "Auditando consistência argumentativa e repertório sociocultural...",
          "Verificando norma-padrão da Língua Portuguesa e gramática...",
          "Gerando parecer e sugestões de reescrita parágrafo a parágrafo..."
        ];
    let idx = 0;
    setLoadingStage(stages[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % stages.length;
      setLoadingStage(stages[idx]);
    }, 3500);
    return () => clearInterval(interval);
  }, [isEvaluating, isTranscribingOcr]);

  // Estimators
  const charCount = essayText.length;
  const wordCount = essayText.trim() === '' ? 0 : essayText.trim().split(/\s+/).length;
  
  const estimateLines = () => {
    if (wordCount === 0) return 0;
    const cleanText = essayText.trim();
    const paragraphs = cleanText.split('\n').filter(p => p.trim().length > 0);
    
    let totalLines = 0;
    paragraphs.forEach(p => {
      const pWords = p.trim().split(/\s+/).length;
      const pLines = Math.max(1, Math.round(pWords / 11));
      totalLines += pLines;
    });

    return Math.min(45, Math.max(1, totalLines));
  };

  const estimatedLinesCount = estimateLines();

  // Generate Theme using server API
  const handleGenerateTheme = async () => {
    setIsGeneratingTheme(true);
    setError(null);
    try {
      const res = await apiFetch('/api/generate-essay-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concursoId: currentConcursoId,
          cargo: currentConcurso.cargo,
          banca: currentConcurso.banca,
          editalCode: currentConcurso.editalCode
        })
      });
      if (!res.ok) throw new Error("Erro de resposta do servidor");
      const data = await res.json();
      if (data.themeTitle && data.contextText) {
        setCurrentTheme({
          themeTitle: data.themeTitle,
          contextText: data.contextText,
          instructions: data.instructions || [
            "Redija um texto dissertativo-argumentativo em norma-padrão.",
            "Defenda uma tese sólida com argumentos e repertório.",
            "Mínimo de 20 e máximo de 30 linhas."
          ]
        });
      } else {
        throw new Error("Formato inválido recebido.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Não foi possível gerar um tema inédito agora. Escolha um dos temas sugeridos abaixo.");
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  // Handle image selection (from file or camera)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("Por favor, selecione uma imagem válida (JPG, PNG ou WEBP).");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPhotoDataUrl(result);
      setPhotoFileName(file.name);
      setUploadStatus("Foto da redação carregada! Clique em 'Transcrever com IA' ou 'Corrigir Foto Diretamente'.");
      setTimeout(() => setUploadStatus(null), 4000);
    };
    reader.readAsDataURL(file);
  };

  // OCR Transcription
  const handleTranscribeOcr = async () => {
    if (!photoDataUrl) {
      setError("Envie ou tire uma foto da folha de redação antes de transcrever.");
      return;
    }
    setIsTranscribingOcr(true);
    setError(null);
    try {
      const res = await apiFetch('/api/ocr-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: photoDataUrl
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || "Erro ao transcrever imagem.");
      }

      const data = await res.json();
      if (data.transcribedText) {
        setEssayText(data.transcribedText);
        setOcrNotes(data.legibilityNotes || "Transcrição realizada com sucesso.");
        setInputMode('keyboard');
        setSuccessMsg("Redação manuscrita transcrita com sucesso! Você pode revisar o texto abaixo.");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        throw new Error("Não foi possível identificar o texto na folha. Certifique-se de que a imagem está nítida e bem iluminada.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Falha ao processar o OCR da redação.");
    } finally {
      setIsTranscribingOcr(false);
    }
  };

  // Evaluate Essay using server API (works with typed text OR direct photo)
  const handleEvaluateEssay = async () => {
    const hasText = essayText.trim().length >= 80;
    const hasPhoto = Boolean(photoDataUrl);

    if (!hasText && !hasPhoto) {
      setError("Por favor, digite sua redação no teclado (mínimo 80 caracteres) ou envie uma foto nítida da folha manuscrita.");
      return;
    }

    setIsEvaluating(true);
    setError(null);
    setEvaluation(null);
    
    try {
      const res = await apiFetch('/api/evaluate-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: currentTheme.themeTitle,
          essayText: essayText,
          image: photoDataUrl,
          concursoId: currentConcursoId,
          cargo: currentConcurso.cargo,
          banca: currentConcurso.banca
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || "Erro no servidor de correção.");
      }

      const data: EssayEvaluation = await res.json();
      const finalEval: EssayEvaluation = {
        ...data,
        createdAt: new Date().toISOString(),
        theme: currentTheme.themeTitle,
        essayText: data.transcribedText || essayText,
        id: `essay_${Date.now()}`
      };

      if (data.transcribedText && !essayText) {
        setEssayText(data.transcribedText);
      }

      setEvaluation(finalEval);

      // Save to history (LocalStorage primary + Firestore sync attempt)
      try {
        const localHistory = localStorage.getItem('essay_history');
        const list = localHistory ? JSON.parse(localHistory) : [];
        list.unshift(finalEval);
        localStorage.setItem('essay_history', JSON.stringify(list));
      } catch (e) {
        console.warn("LocalStorage save error:", e);
      }

      if (userId) {
        try {
          const docRef = doc(db, `users/${userId}/essays/${finalEval.id}`);
          await setDoc(docRef, finalEval);
        } catch (fbErr) {
          console.warn("Firestore save error:", fbErr);
        }
      }

      loadHistory();
      setTimeout(() => {
        document.getElementById('evaluation-results-box')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Não foi possível enviar a redação para correção agora. Verifique sua conexão.");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Upload txt file handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      processImageFile(file);
      return;
    }

    if (!file.name.endsWith('.txt')) {
      setUploadStatus("Formato inválido. Carregue um arquivo .txt ou uma foto .jpg/.png.");
      setTimeout(() => setUploadStatus(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setEssayText(text);
        setInputMode('keyboard');
        setUploadStatus("Arquivo .txt importado com sucesso!");
        setTimeout(() => setUploadStatus(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  // Request delete
  const handleDeleteEssay = (e: React.MouseEvent, item: EssayEvaluation) => {
    e.stopPropagation();
    setItemToDelete(item);
  };

  // Actual deletion logic
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (userId) {
        const docRef = doc(db, `users/${userId}/essays/${itemToDelete.id}`);
        await deleteDoc(docRef);
      } else {
        const localHistory = localStorage.getItem('essay_history');
        if (localHistory) {
          const list = JSON.parse(localHistory);
          const filtered = list.filter((item: any) => item.id !== itemToDelete.id);
          localStorage.setItem('essay_history', JSON.stringify(filtered));
        }
      }
      if (evaluation?.id === itemToDelete.id) {
        setEvaluation(null);
        setActiveTab('history');
      }
      setItemToDelete(null);
      setSuccessMsg("Redação excluída com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3000);
      loadHistory();
    } catch (err) {
      console.error("Erro ao apagar redação:", err);
    }
  };

  const activeMaxScore = evaluation?.maxScore || (isVestibular ? 1000 : 100);

  return (
    <div className="w-full flex-1 max-w-6xl mx-auto p-3 sm:p-4 md:p-6" id="essay-generator-section">
      {/* Tab Selectors & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-xl border border-blue-600/40 shrink-0">
            <img src={BRAND_ASSETS.iconsWhiteBg.documento} alt="" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-900 bg-blue-50 border border-blue-200/90 px-2.5 py-0.5 rounded-full inline-block">
                {currentConcurso.redacao.rotulo}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <ScanLine size={10} /> OCR + Teclado
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Gerador & Corretor de Redação com IA
            </h2>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'editor' ? 'bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-blue-200 border border-blue-500/70 shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <div className="flex items-center gap-2">
              <PenTool size={14} /> Escrever / Enviar Foto
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-blue-200 border border-blue-500/70 shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <div className="flex items-center gap-2">
              <History size={14} /> Histórico ({history.length})
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'history' ? (
        /* HISTORY TAB */
        <div className="space-y-4 animate-fadeIn">
          {history.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-12 text-center max-w-md mx-auto mt-10">
              <FileText className="text-slate-300 mx-auto mb-4" size={48} />
              <h3 className="text-base font-extrabold text-slate-800">Sem histórico de redações</h3>
              <p className="text-xs text-slate-500 mt-1">Sua folha está em branco! Escolha um tema, digite no teclado ou mande uma foto da sua folha para receber a correção com IA.</p>
              <button 
                onClick={() => setActiveTab('editor')}
                className="mt-5 bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition"
              >
                Escrever Redação agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item) => {
                const max = item.maxScore || (item.scoreTotal > 100 ? 1000 : 100);
                return (
                  <div 
                    key={item.id} 
                    className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {item.passed ? 'APROVADO' : 'EM EVOLUÇÃO'}
                          </span>
                          <span className="text-lg font-black text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-xl">
                            {item.scoreTotal}/{max}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-800 mt-3 line-clamp-2 leading-relaxed">
                        {item.theme}
                      </h4>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                        {item.essayText}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100 text-[11px] font-mono font-extrabold text-slate-400">
                        <span>Tema/Gênero: <span className="text-slate-700">{item.scoreConteudo}</span></span>
                        <span>Estrutura: <span className="text-slate-700">{item.scoreEstrutura}</span></span>
                        <span>Norma Culta: <span className="text-slate-700">{item.scoreExpressao}</span></span>
                        {item.scoreArgumentacao !== undefined && (
                          <span>Repertório: <span className="text-slate-700">{item.scoreArgumentacao}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-5">
                      <button
                        onClick={() => {
                          setEvaluation(item);
                          setCurrentTheme({
                            themeTitle: item.theme || "Tema recuperado",
                            contextText: "Tema recuperado do histórico de simulações.",
                            instructions: ["Siga as instruções oficiais do edital."]
                          });
                          setEssayText(item.essayText || '');
                          setActiveTab('editor');
                          setTimeout(() => {
                            document.getElementById('evaluation-results-box')?.scrollIntoView({ behavior: 'smooth' });
                          }, 200);
                        }}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-xl text-xs font-bold text-slate-700 transition flex items-center justify-center gap-1.5"
                      >
                        <BookOpen size={13} /> Ver Correção Completa
                      </button>
                      <button
                        onClick={(e) => handleDeleteEssay(e, item)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition shrink-0"
                        title="Excluir do histórico"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* EDITOR TAB */
        <div className="space-y-6 animate-fadeIn">
          {/* Main Workspace Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Theme Context (4 cols) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 shadow-sm rounded-3xl p-4 sm:p-5 md:p-6 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <img src={BRAND_ASSETS.iconsOutline.capelo} alt="" className="w-4 h-4 object-contain" />
                    Tema da Proposta
                  </h3>
                  <button
                    onClick={handleGenerateTheme}
                    disabled={isGeneratingTheme}
                    className="brand-skew-btn text-[10px] font-extrabold uppercase tracking-wider text-white border border-blue-400/40 px-3 py-1.5 rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <span className="z-10">{isGeneratingTheme ? 'Gerando...' : 'Gerar Tema Inédito'}</span>
                    <Sparkles size={11} className="text-sky-300 z-10" />
                  </button>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="text-sm font-black text-slate-900 leading-snug">
                    {currentTheme.themeTitle}
                  </h4>
                </div>
              </div>

              {/* Textos Motivadores */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Texto Motivador / Coletânea</h4>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-52 overflow-y-auto">
                  {currentTheme.contextText}
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Critérios Oficiais de Avaliação</h4>
                <div className="bg-slate-900 border border-blue-600/40 rounded-2xl p-4 space-y-2.5 text-white">
                  {currentTheme.instructions.map((inst, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5"></span>
                      <span>{inst}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommends / Quick Switch themes */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Temas Recomendados</h4>
                <div className="space-y-1.5">
                  {temasSugeridos.map((theme, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentTheme(theme);
                        setEvaluation(null);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between gap-2 ${
                        currentTheme.themeTitle === theme.themeTitle 
                          ? 'bg-slate-900 border-blue-500/60 text-blue-300 font-black shadow-xs' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate">{theme.themeTitle}</span>
                      <ChevronRight size={12} className="shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Writing Sheet / Photo Upload (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Mode Switcher: Teclado vs Foto da Redação */}
              <div className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-wrap sm:flex-nowrap gap-2 shadow-xs">
                <button
                  type="button"
                  onClick={() => setInputMode('keyboard')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    inputMode === 'keyboard' 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <PenTool size={15} /> Escrever no Teclado
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('photo')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    inputMode === 'photo' 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Camera size={15} /> Tirar Foto / Enviar Imagem
                </button>
              </div>

              {uploadStatus && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-extrabold flex items-center gap-2">
                  <Sparkles size={14} className="text-blue-600" />
                  <span>{uploadStatus}</span>
                </div>
              )}

              {/* PHOTO UPLOAD WORKSPACE */}
              {inputMode === 'photo' && (
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 md:p-6 space-y-5 shadow-sm">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Camera className="text-blue-600" size={18} />
                      Envio de Foto da Folha de Redação Manuscrita
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Tire uma foto ou selecione uma imagem nítida da sua redação escrita à mão. A IA fará a leitura paleográfica (OCR) e a correção pedagógica detalhada.
                    </p>
                  </div>

                  {/* Hidden inputs for gallery and camera */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={cameraInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processImageFile(file);
                    }}
                    className="hidden"
                  />

                  {/* Photo Dropzone / Preview */}
                  {photoDataUrl ? (
                    <div className="space-y-4">
                      <div className="relative border-2 border-blue-200 rounded-2xl overflow-hidden bg-slate-900 max-h-80 flex items-center justify-center">
                        <img 
                          src={photoDataUrl} 
                          alt="Redação do Aluno" 
                          className="max-h-80 w-auto object-contain"
                        />
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoDataUrl(null);
                              setPhotoFileName(null);
                            }}
                            className="bg-slate-900/80 hover:bg-rose-600 text-white p-2 rounded-xl text-xs font-bold backdrop-blur-sm transition"
                            title="Remover foto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600 font-mono">
                        <span>Arquivo: <strong className="text-slate-800">{photoFileName || 'Foto capturada'}</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
                    >
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <ImageIcon size={28} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">Clique para selecionar imagem ou arraste aqui</p>
                        <p className="text-xs text-slate-500 mt-0.5">Suporta JPG, PNG, WEBP ou fotos tiradas pelo celular</p>
                      </div>
                      <div className="flex justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cameraInputRef.current?.click();
                          }}
                          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1.5"
                        >
                          <Camera size={14} /> Tirar Foto com a Câmera
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition flex items-center gap-1.5"
                        >
                          <Upload size={14} /> Escolher da Galeria
                        </button>
                      </div>
                    </div>
                  )}

                  {/* OCR Actions */}
                  {photoDataUrl && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleTranscribeOcr}
                        disabled={isTranscribingOcr || isEvaluating}
                        className="py-3 px-4 bg-slate-100 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-800 font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <ScanLine size={15} className="text-blue-600" />
                        <span>{isTranscribingOcr ? 'Transcrevendo Folha...' : '1. Transcrever Texto (OCR) p/ Revisar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleEvaluateEssay}
                        disabled={isEvaluating || isTranscribingOcr}
                        className="py-3 px-4 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md hover:from-blue-900 hover:to-indigo-850 disabled:opacity-50"
                      >
                        <Sparkles size={15} className="text-sky-300" />
                        <span>{isEvaluating ? 'Avaliando Folha...' : '2. Corrigir Foto Diretamente via IA'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* KEYBOARD WORKSPACE */}
              {inputMode === 'keyboard' && (
                <div className="space-y-4">
                  {/* File Upload Row */}
                  <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5 text-xs text-slate-700 font-bold">
                      <Upload className="text-slate-500" size={16} />
                      <span>Deseja carregar um arquivo (.txt ou foto manuscrita)?</span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <label className="bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all shadow-xs px-3.5 py-2 rounded-xl text-xs font-extrabold text-slate-700 hover:text-slate-900 cursor-pointer text-center w-full sm:w-auto uppercase tracking-wider flex items-center justify-center gap-1.5">
                        <Upload size={13} />
                        <span>Importar TXT</span>
                        <input 
                          type="file" 
                          accept=".txt" 
                          onChange={handleFileUpload} 
                          className="hidden" 
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setInputMode('photo')}
                        className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 transition-all shadow-xs px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer text-center w-full sm:w-auto uppercase tracking-wider flex items-center justify-center gap-1.5"
                      >
                        <Camera size={13} />
                        <span>Mandar Foto</span>
                      </button>
                    </div>
                  </div>

                  {ocrNotes && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                      <FileCheck2 size={15} className="text-emerald-600 shrink-0" />
                      <span>{ocrNotes}</span>
                    </div>
                  )}

                  {/* Simulated Sheet Editor Container */}
                  <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm relative">
                    
                    {/* Sheet Margins Header */}
                    <div className="h-11 bg-slate-900 border-b border-blue-600/40 flex items-center justify-between px-4 sm:px-6 select-none">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <img src={BRAND_ASSETS.iconsWhiteBg.documento} alt="" className="w-4 h-4 object-contain" />
                        Folha Oficial de Redação
                      </span>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          estimatedLinesCount >= 20 && estimatedLinesCount <= 30
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                            : 'bg-blue-500/20 text-blue-200 border border-blue-400/40'
                        }`}>
                          Linhas Estimadas: {estimatedLinesCount} / 30
                        </span>
                      </div>
                    </div>

                    {/* Editor Content Area */}
                    <div className="relative flex">
                      <div className="absolute left-10 md:left-14 top-0 bottom-0 w-[1.5px] bg-rose-400/70 pointer-events-none z-10"></div>
                      <textarea
                        value={essayText}
                        onChange={(e) => setEssayText(e.target.value)}
                        placeholder="Digite ou cole aqui sua redação dissertativo-argumentativa... Estruture seu texto em 4 parágrafos (Introdução com tese, Desenvolvimento 1, Desenvolvimento 2 e Conclusão com proposta de intervenção/reflexão)."
                        className="w-full h-96 px-6 pt-[6px] pb-6 pl-14 md:pl-20 outline-none border-none text-slate-800 font-mono text-sm leading-[2rem] resize-none focus:ring-0 bg-[linear-gradient(to_bottom,transparent_31px,#cbd5e1_31px,#cbd5e1_32px)] bg-[size:100%_32px] placeholder:font-sans placeholder:leading-relaxed placeholder:pt-2"
                      />
                    </div>

                    {/* Counter Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-4 text-xs font-mono font-extrabold text-slate-500">
                      <div className="flex gap-4">
                        <span>Caracteres: <span className="text-slate-800">{charCount}</span></span>
                        <span>Palavras: <span className="text-slate-800">{wordCount}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        {estimatedLinesCount < 20 && essayText.length > 0 && (
                          <span className="text-[10px] text-amber-800 font-extrabold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <AlertCircle size={12} /> Menos de 20 linhas (Risco de penalização)
                          </span>
                        )}
                        {estimatedLinesCount > 30 && (
                          <span className="text-[10px] text-rose-800 font-extrabold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <AlertCircle size={12} /> Mais de 30 linhas (Excede o limite padrão)
                          </span>
                        )}
                        {estimatedLinesCount >= 20 && estimatedLinesCount <= 30 && (
                          <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <CheckCircle size={12} /> Extensão Ideal (20 a 30 linhas)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    onClick={handleEvaluateEssay}
                    disabled={isEvaluating || essayText.trim().length === 0}
                    className="w-full py-4 px-6 brand-skew-btn border border-blue-400/40 font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3.5 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-400/40 flex items-center justify-center shrink-0 z-10">
                      <img src={BRAND_ASSETS.iconsWhiteBg.capelo} alt="" className="w-5 h-5 object-contain" />
                    </div>
                    <span className="text-sm font-black tracking-wider text-white z-10">
                      {isEvaluating ? 'Corrigindo Redação com a IA...' : 'Enviar para Correção Oficial (Prof. IA)'}
                    </span>
                  </button>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-sm">
                  <AlertCircle className="shrink-0 mt-0.5" size={18} />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              {/* Loading State */}
              {(isEvaluating || isTranscribingOcr) && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center text-white shadow-2xl">
                  <LiquidLoader 
                    text={isTranscribingOcr ? "OCR Paleográfico em Execução" : "Banca Examinadora Avaliando"} 
                    subtext={loadingStage || "Processando critérios de avaliação oficial..."} 
                  />
                </div>
              )}

            </div>
          </div>

          {/* ACTIVE EVALUATION DISPLAY BOX */}
          {evaluation && !isEvaluating && (
            <div id="evaluation-results-box" className="border-t border-slate-200 pt-8 mt-6 space-y-6 animate-fadeIn">
              
              {/* Header Box */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-md relative overflow-hidden border border-blue-600/40">
                <div className="relative z-10 space-y-2 text-center md:text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                    Resultado da Correção Oficial
                  </span>
                  <h3 className="text-xl md:text-2xl font-black text-white">
                    Parecer da Banca Examinadora ({isVestibular ? `Padrão ${currentConcurso.banca}` : 'Critérios Oficiais'})
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                    Avaliação minuciosa de tese, estrutura lógica dos 4 parágrafos, coesão, gramática culta e repertório sociocultural legitimado.
                  </p>
                </div>
                <div className="relative z-10 shrink-0 flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl min-w-[180px]">
                  <div className="text-center">
                    <div className={`text-4xl md:text-5xl font-black ${evaluation.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {evaluation.scoreTotal}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block mt-1">
                      Nota Final de 0 a {activeMaxScore}
                    </span>
                    <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-xl border block mt-4 font-mono ${
                      evaluation.passed 
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    }`}>
                      {evaluation.passed ? '★ APROVADO' : '✕ EM EVOLUÇÃO'}
                    </span>
                  </div>
                  <div className="mt-4 sm:mt-0 sm:ml-4 border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-4 flex sm:flex-col justify-center h-full">
                    <button
                      onClick={(e) => handleDeleteEssay(e, evaluation)}
                      className="flex items-center gap-1.5 text-white/50 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-2 rounded-xl text-[10px] font-bold transition-all"
                      title="Excluir esta redação"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-Score Cards Grid */}
              {evaluation.scoreAdequacaoTematica !== undefined ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Pillar 1 */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black uppercase text-slate-500">1. Adequação Temática</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreAdequacaoTematica}/200</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all" style={{ width: `${(evaluation.scoreAdequacaoTematica / 200) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                      Compreensão e desenvolvimento do tema.
                    </p>
                  </div>
                  {/* Pillar 2 */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black uppercase text-slate-500">2. Org. e Progressão</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreOrganizacaoTextual}/200</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all" style={{ width: `${(evaluation.scoreOrganizacaoTextual / 200) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                      Organização das ideias e sequência lógica.
                    </p>
                  </div>
                  {/* Pillar 3 */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black uppercase text-slate-500">3. Estrut. Dissertativa</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreEstruturaArgumentativa}/200</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all" style={{ width: `${(evaluation.scoreEstruturaArgumentativa / 200) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                      Construção da tese e defesa de ponto de vista.
                    </p>
                  </div>
                  {/* Pillar 4 */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black uppercase text-slate-500">4. Coesão e Coerência</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreCoesaoCoerencia}/200</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all" style={{ width: `${(evaluation.scoreCoesaoCoerencia / 200) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                      Recursos coesivos e ligação entre partes.
                    </p>
                  </div>
                  {/* Pillar 5 */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black uppercase text-slate-500">5. Norma Padrão</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreNormaPadrao}/200</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full transition-all" style={{ width: `${(evaluation.scoreNormaPadrao / 200) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                      Gramática, ortografia e adequação vocabular.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Pillar 1 */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black uppercase text-slate-500">1. Tema & Gênero</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreConteudo || 0}/{isVestibular ? 250 : 40}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all" style={{ width: `${((evaluation.scoreConteudo || 0) / (isVestibular ? 250 : 40)) * 100}%` }}></div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
                      Atendimento à proposta, clareza da tese no 1º parágrafo e tipologia dissertativa-argumentativa.
                    </p>
                  </div>

                  {/* Pillar 2 */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black uppercase text-slate-500">2. Estrutura & Coesão</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreEstrutura || 0}/{isVestibular ? 250 : 30}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all" style={{ width: `${((evaluation.scoreEstrutura || 0) / (isVestibular ? 250 : 30)) * 100}%` }}></div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
                      Paragrafação em 4 blocos, progressão lógica das ideias e emprego produtivo de conectivos.
                    </p>
                  </div>

                  {/* Pillar 3 */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black uppercase text-slate-500">3. Norma Culta</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreExpressao || 0}/{isVestibular ? 250 : 30}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all" style={{ width: `${((evaluation.scoreExpressao || 0) / (isVestibular ? 250 : 30)) * 100}%` }}></div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
                      Correção gramatical, concordâncias, pontuação, acentuação, crase e precisão vocabular formal.
                    </p>
                  </div>

                  {/* Pillar 4 */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black uppercase text-slate-500">4. Argumentação & Repertório</span>
                      <span className="text-sm font-black text-slate-900">{evaluation.scoreArgumentacao ?? Math.round((evaluation.scoreConteudo || 0) * 0.9)}/{isVestibular ? 250 : 30}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full transition-all" style={{ width: `${((evaluation.scoreArgumentacao ?? Math.round((evaluation.scoreConteudo || 0) * 0.9)) / (isVestibular ? 250 : 30)) * 100}%` }}></div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
                      Sustentação dos argumentos com filósofos, sociólogos, dados e obras de referência.
                    </p>
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses (Split Panel) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-3xl p-5 md:p-6 space-y-4">
                  <h4 className="text-sm font-extrabold text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="text-emerald-600" size={18} /> Pontos Fortes Encontrados
                  </h4>
                  <ul className="space-y-2.5">
                    {(evaluation.pontosFortes || []).map((p, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                        <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-50/40 border border-rose-200/70 rounded-3xl p-5 md:p-6 space-y-4">
                  <h4 className="text-sm font-extrabold text-rose-800 flex items-center gap-2">
                    <XCircle className="text-rose-600" size={18} /> Pontos Fracos ou Desvios Observados
                  </h4>
                  <ul className="space-y-2.5">
                    {(evaluation.pontosFracos || []).map((p, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                        <span className="text-rose-600 font-bold shrink-0 mt-0.5">✕</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Repertoire suggestions if available */}
              {evaluation.repertorioSugerido && evaluation.repertorioSugerido.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-500/40 rounded-3xl p-5 md:p-6 space-y-4 text-white">
                  <h4 className="text-sm font-black text-indigo-300 flex items-center gap-2">
                    <BookMarked className="text-indigo-400" size={18} /> Repertório Sociocultural Sugerido
                  </h4>
                  <p className="text-xs text-slate-300">
                    Ideias de alusões históricas, filósofos ou obras de referência que enriqueceriam ainda mais a nota de argumentação:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(evaluation.repertorioSugerido || []).map((rep, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-slate-200 leading-relaxed flex items-start gap-2.5">
                        <span className="text-indigo-400 font-black shrink-0">✦</span>
                        <span>{rep}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions for improvement */}
              <div className="bg-slate-900 border border-blue-600/40 rounded-3xl p-5 md:p-6 space-y-4 text-white">
                <h4 className="text-sm font-black text-blue-300 flex items-center gap-2">
                  <TrendingUp className="text-blue-400" size={18} /> Plano de Ação Pedagógico
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(evaluation.sugestoesMelhoria || []).map((s, idx) => (
                    <div key={idx} className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed">
                      <span className="p-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg font-mono font-black shrink-0 text-[10px]">
                        0{idx+1}
                      </span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paragraph Breakdown Correction section */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Correção Anatômica por Parágrafo
                </h4>
                <p className="text-xs text-slate-600">
                  Clique em cada parágrafo para ler a avaliação individual e a proposta de reescrita sugerida pelo examinador:
                </p>

                <div className="space-y-3">
                  {(evaluation.correcaoParagrafo || []).map((par, idx) => {
                    const isExpanded = activeParagraphIndex === idx;
                    return (
                      <div 
                        key={idx}
                        className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                          isExpanded ? 'border-blue-500/60 ring-2 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <button
                          onClick={() => setActiveParagraphIndex(isExpanded ? null : idx)}
                          className="w-full p-4 text-left flex justify-between items-center gap-4 bg-slate-50 hover:bg-slate-100 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-xl bg-slate-900 text-blue-300 border border-blue-500/30 text-xs font-black flex items-center justify-center shrink-0">
                              P{par.paragraphIndex}
                            </span>
                            <span className="text-xs font-black text-slate-900">
                              Parágrafo {par.paragraphIndex} {par.paragraphIndex === 1 ? '(Introdução)' : par.paragraphIndex === (evaluation.correcaoParagrafo || []).length ? '(Conclusão)' : `(Desenvolvimento ${par.paragraphIndex - 1})`}
                            </span>
                          </div>
                          <ChevronDown 
                            size={16} 
                            className={`text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                          />
                        </button>

                        <div className="p-4 md:p-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-5 leading-relaxed text-xs">
                          <div>
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Original do Candidato</span>
                            <p className="text-slate-700 font-mono p-4 bg-slate-50 rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                              {par.text}
                            </p>
                          </div>
                          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 flex flex-col justify-between space-y-3">
                            <div>
                              <span className="block text-[10px] font-black text-blue-900 uppercase tracking-wider mb-2">Parecer do Examinador</span>
                              <p className="text-slate-800 font-medium leading-relaxed">
                                {par.feedback}
                              </p>
                            </div>
                            {par.sugestaoReescrita && (
                              <div className="pt-2 border-t border-blue-200/60">
                                <span className="block text-[10px] font-black text-indigo-900 uppercase tracking-wider mb-1">Sugestão de Reescrita / Aprimoramento</span>
                                <p className="text-slate-700 italic text-[11px] leading-relaxed bg-white/70 p-3 rounded-lg border border-blue-200/50">
                                  "{par.sugestaoReescrita}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* General Feedback / Motivation */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 md:p-8">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Feedback Geral de Desempenho</h4>
                <p className="text-slate-700 text-xs leading-relaxed italic">
                  "{evaluation.generalFeedback}"
                </p>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-scaleIn">
            <h4 className="text-base font-black text-slate-800 mb-2">Excluir Redação?</h4>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Tem certeza de que deseja excluir permanentemente o registro desta redação sobre <span className="font-extrabold text-indigo-700">"{itemToDelete.theme}"</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition"
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-sm animate-slideUp">
          <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-bold">
            <CheckCircle size={16} />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

    </div>
  );
}
