// Tipos do "pacote do concurso" — os arquivos JSON em /concurso que o montador gera para
// cada plataforma. Todo dado específico de um concurso (edital, banca, provas, Raio-X,
// simulador, perfil da IA) vive no pacote; o código da plataforma é o mesmo para todos.

export interface DisciplineCategory {
  title: string;
  badge?: string;
  topics: string[];
}

export interface TopicItem {
  name: string;
  probability: number;
  category: string;
  historicalCount: string;
  trend: 'alta' | 'estavel' | 'critica';
  examSource: string;
}

export interface ActionBlock {
  title: string;
  percentage: number;
  description: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  priorities: string[];
}

export interface TrapItem {
  title: string;
  risk: string;
  action: string;
  type: string;
}

export interface MicroTema {
  topic: string;
  freq: string;
  prob: string;
  strategy: string;
  focusNorm: string;
}

export interface DisciplinePred {
  discipline: string;
  analysis: string;
  weightText: string;
  microTemas: MicroTema[];
}

export interface SimuladorBloco {
  nome: string;
  questoes: number;
  peso: number;
  inicial?: number;
}

export interface Simulador {
  notaMaxima: number;
  notaCorte: number;
  observacao?: string;
  rodape?: string;
  blocos: SimuladorBloco[];
}

/** A-E: 5 alternativas | A-D: 4 alternativas | CE: Certo/Errado (Cebraspe) */
export type FormatoQuestoes = 'A-E' | 'A-D' | 'CE';

export interface PerfilIA {
  /** Nome curto da banca usado nos rótulos ("Padrão Instituto AOCP"). */
  bancaEstilo: string;
  formatoQuestoes: FormatoQuestoes;
  perfilBanca: string[];
  comandosTipicos: string[];
  exemplosContexto: string[];
  /** Diretrizes extras para os capítulos de material (texto livre, em tópicos). */
  perfilMaterial: string;
}

export interface Redacao {
  habilitada: boolean;
  /** concurso-100: critérios de concurso (100 pts) | vestibular-1000: competências de vestibular (1000 pts) */
  modelo: 'concurso-100' | 'vestibular-1000';
  rotulo: string;
  temasSugeridos: { themeTitle: string; contextText: string; instructions: string[] }[];
}

export interface Inteligencia {
  resumoBase: string;
  descricao: string;
  questoesPorProva: number;
  topTopics: TopicItem[];
  actionBlocks: ActionBlock[];
  traps: TrapItem[];
  disciplinesPred: DisciplinePred[];
  simulador: Simulador;
}

export interface ConcursoData {
  versaoPacote?: number;
  id: string;
  shortTitle: string;
  fullName: string;
  cargo: string;
  orgao: string;
  editalCode: string;
  editalUrl?: string;
  vagas?: string;
  banca: string;
  ano: string;
  tag: string;
  colorScheme: {
    primary: string;
    secondary: string;
    border: string;
    bgBadge: string;
    textBadge: string;
    iconBg: string;
  };
  edital: {
    gerais: DisciplineCategory[];
    especificos: DisciplineCategory[];
  };
  preditiveInsights: {
    headline: string;
    description: string;
    prioritySubjects: { subject: string; weight: string; color: string; questionsEst: number }[];
    topExamTips: string[];
  };
  plataforma: {
    titulo: string;
    descricao: string;
    siglaCurta: string;
    suporteTexto: string;
  };
  ia: PerfilIA;
  redacao: Redacao;
  inteligencia: Inteligencia;
  verificacao?: { status: string; observacao?: string };
}

export interface PastExamQuestion {
  number: number;
  subject: string;
  topic: string;
  question?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
}

export interface PastExam {
  id: string;
  concursoId: string;
  year: number;
  role: string;
  title: string;
  banca: string;
  questionsCount: number;
  essay?: string;
  examUrl: string;
  answerUrl: string;
  description: string;
  category: string;
  stats: { subject: string; count: number; percentage: number; color: string }[];
  topTopics: { name: string; count: number; subjectGroup: string }[];
  analysisSummary: string;
  fullQuestions: PastExamQuestion[];
}

export interface RealQuestion {
  number: number;
  subject: string;
  topic: string;
  question: string;
  options: string[]; // vazio para Certo/Errado
  answer: string; // "A".."E" ou "C"/"E"
  explanation: string;
}

export interface RealExamData {
  id: string;
  title: string;
  banca: string;
  year: number;
  concursoId: string;
  questions: RealQuestion[];
}
