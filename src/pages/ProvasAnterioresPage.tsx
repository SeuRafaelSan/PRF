import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserId } from '../lib/auth';
import { syncAndRecalculateUserStats } from '../lib/persistenceManager';
import { 
  FileDown, 
  Clock, 
  BookOpen, 
  Award,
  Save,
  Search,
  X,
  BarChart3,
  ExternalLink,
  Trophy,
  Sparkles,
  Filter,
  CheckCircle2,
  HelpCircle,
  PlayCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { useConcurso } from '../lib/concursoContext';
import { PROVAS_ANTERIORES } from '../concurso';
import type { PastExam } from '../concurso';
import { REAL_EXAMS_QUESTIONS } from '../data/realExamsQuestions';
import MathMarkdownRenderer from '../components/MathMarkdownRenderer';

interface ExamProgress {
  id: string;
  solved: boolean;
  score: string; // e.g. "55/60"
  timeSpent: string; // e.g. "3h20"
  solvedAt?: string;
}

export type { PastExam, PastExamQuestion } from '../concurso';

const PAST_EXAMS: PastExam[] = PROVAS_ANTERIORES;

export default function ProvasAnterioresPage() {
  const userId = useUserId();
  const navigate = useNavigate();
  const { currentConcurso } = useConcurso();
  
  // Tab filter: 'all' | 'recent'
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent'>('all');
  
  // Exams Progress State
  const [examsProgress, setExamsProgress] = useState<Record<string, ExamProgress>>({});
  const [loadingExams, setLoadingExams] = useState(true);
  
  // Modal / Inputs state for log scores
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [inputScore, setInputScore] = useState('');
  const [inputTime, setInputTime] = useState('');
  
  // Modal state for full analysis mapping view
  const [selectedAnalysisExamId, setSelectedAnalysisExamId] = useState<string | null>(null);
  const [questionSearch, setQuestionSearch] = useState('');
  const [modalViewMode, setModalViewMode] = useState<'full' | 'table'>('full');
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [revealedExplanations, setRevealedExplanations] = useState<Record<number, boolean>>({});
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchExamsProgress = async () => {
    if (!userId) return;
    setLoadingExams(true);
    try {
      const colRef = collection(db, 'users', userId, 'exams_progress');
      const snap = await getDocs(colRef);
      const progressMap: Record<string, ExamProgress> = {};
      snap.docs.forEach(doc => {
        progressMap[doc.id] = { id: doc.id, ...doc.data() } as ExamProgress;
      });
      setExamsProgress(progressMap);
    } catch (err) {
      console.error("Error fetching exams progress:", err);
    } finally {
      setLoadingExams(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchExamsProgress();
    }
  }, [userId, currentConcurso.id]);

  const handleSaveExamProgress = async (examId: string, solved: boolean, score: string, time: string) => {
    if (!userId) return;

    try {
      await setDoc(doc(db, 'users', userId, 'exams_progress', examId), {
        solved,
        score,
        timeSpent: time,
        concursoId: currentConcurso.id,
        solvedAt: solved ? new Date().toISOString() : null
      });

      setExamsProgress(prev => ({
        ...prev,
        [examId]: {
          id: examId,
          solved,
          score,
          timeSpent: time,
          solvedAt: solved ? new Date().toISOString() : undefined
        }
      }));

      // Automatically recalculate and sync all stats in Firebase
      await syncAndRecalculateUserStats(userId);

      setEditingExamId(null);
      showToast("⭐ Progresso da prova salvo e sincronizado no Firebase!");
    } catch (err) {
      console.error("Error saving exam progress:", err);
    }
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const openLogModal = (examId: string) => {
    const existing = examsProgress[examId];
    setInputScore(existing?.score || '');
    setInputTime(existing?.timeSpent || '');
    setEditingExamId(examId);
  };

  // Filtra as provas do concurso ativo
  const currentConcursoId = currentConcurso.id;
  const examsList = PAST_EXAMS.filter(e => e.concursoId === currentConcursoId);
  const displayedExams = examsList.filter(exam => {
    if (activeFilter === 'recent') {
      return exam.year >= 2020;
    }
    return true; // 'all'
  });

  const getResolvedCount = () => {
    return examsList.filter(e => examsProgress[e.id]?.solved).length;
  };

  const selectedAnalysisExam = PAST_EXAMS.find(e => e.id === selectedAnalysisExamId);

  // Filter questions mapping in modal
  const filteredQuestions = selectedAnalysisExam?.fullQuestions?.filter(q => {
    const query = questionSearch.toLowerCase();
    const fullText = (q.question || '').toLowerCase();
    return (
      q.subject.toLowerCase().includes(query) ||
      q.topic.toLowerCase().includes(query) ||
      q.number.toString().includes(query) ||
      fullText.includes(query)
    );
  });

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      
      {/* Toast */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-2 border border-slate-700 animate-fadeIn text-xs font-bold">
          <Sparkles className="text-blue-300" size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              Repositório Oficial de Exames
            </span>
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
              Banca Oficial: Instituto AOCP
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <BookOpen className="text-blue-600" size={26} />
            Provas Anteriores Oficial
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Acesse as provas passadas oficiais para o concurso da <strong>{currentConcurso.fullName}</strong>, analise a distribuição de assuntos e registre seu progresso.
          </p>
        </div>

        {/* Global Stats Capsule */}
        <div className="flex items-center gap-4 bg-slate-900 text-white p-4 rounded-2xl border border-blue-600/40 shadow-sm shrink-0">
          <div className="text-center border-r border-slate-700 pr-4">
            <span className="block text-[9px] font-bold uppercase text-slate-400">Acervo Atual</span>
            <span className="text-lg font-black text-white">{examsList.length} Provas</span>
          </div>
          <div className="text-center">
            <span className="block text-[9px] font-bold uppercase text-blue-300">Resolvidas</span>
            <span className="text-lg font-black text-blue-300">{getResolvedCount()} / {examsList.length}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1.5">
            <Filter size={14} /> Filtrar:
          </span>
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas as Provas ({examsList.length})
          </button>
          <button
            onClick={() => setActiveFilter('recent')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeFilter === 'recent'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Mais Recentes (a partir de 2020)
          </button>
        </div>

        <span className="text-[11px] font-bold text-slate-400 px-2">
          Exibindo {displayedExams.length} de {examsList.length} prova(s)
        </span>
      </div>

      {/* Exams Grid */}
      <div className="space-y-6">
        {displayedExams.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
            <BookOpen className="mx-auto text-slate-300 mb-3" size={48} />
            <h3 className="text-base font-bold text-slate-700">Nenhuma prova encontrada</h3>
            <p className="text-xs text-slate-400 mt-1">Não há exames correspondentes a esta categoria no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedExams.map((exam) => {
              const progress = examsProgress[exam.id];
              const isSolved = progress?.solved || false;
              return (
                <div 
                  key={exam.id}
                  className={`bg-white rounded-3xl p-5 md:p-6 border transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                    isSolved 
                      ? 'border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/10' 
                      : 'border-slate-200 shadow-sm'
                  }`}
                >
                  <div>
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block bg-blue-50 text-blue-800 border border-blue-200`}>
                          {currentConcurso.orgao} • {exam.banca} • {exam.year}
                        </span>
                        <h3 className="text-sm font-black text-slate-800 mt-2 leading-snug">
                          {exam.title}
                        </h3>
                      </div>
                      <div className="shrink-0">
                        {isSolved ? (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1">
                            ✓ Resolvido
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed mb-4 mt-1.5">
                      {exam.description}
                    </p>

                    {/* Show quick statistics preview if stats are available */}
                    {exam.stats && exam.stats.length > 0 && (
                      <div className="bg-slate-50 rounded-2xl p-3.5 mb-4 border border-slate-150">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                          <span>Distribuição das Questões</span>
                          <span>Total: {exam.questionsCount}</span>
                        </div>

                        <div className="space-y-1.5">
                          {exam.stats.slice(0, 3).map((st, i) => (
                            <div key={i} className="flex justify-between items-center text-xs">
                              <span className="text-slate-700 font-semibold truncate pr-2 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                                {st.subject}
                              </span>
                              <span className="text-slate-500 font-bold shrink-0">{st.count}q ({st.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Saved log stats if solved */}
                    {isSolved && progress && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold">
                          <Trophy size={14} className="text-emerald-600" />
                          <span>Acertos: <strong>{progress.score || 'Não informado'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-800 font-medium text-[11px]">
                          <Clock size={12} />
                          <span>Tempo: {progress.timeSpent || 'N/A'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions Bar */}
                  <div className="pt-4 border-t border-slate-150 flex flex-wrap items-center justify-between gap-3 mt-auto">
                    <div className="flex items-center gap-2">
                      {exam.stats && exam.stats.length > 0 && (
                        <button
                          onClick={() => setSelectedAnalysisExamId(exam.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-blue-200 transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                          <BarChart3 size={14} className="text-blue-300" />
                          <span>Raio-X da Prova</span>
                        </button>
                      )}

                      <a
                        href={exam.examUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
                      >
                        <FileDown size={14} />
                        <span>Caderno de Prova</span>
                      </a>

                      {exam.answerUrl && (
                        <a
                          href={exam.answerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1"
                        >
                          <Award size={14} />
                          <span>Gabarito</span>
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() => openLogModal(exam.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1 ml-auto"
                    >
                      <Save size={13} />
                      <span>{isSolved ? 'Editar Nota' : 'Marcar Feita'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Log Exam Progress */}
      {editingExamId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-scaleIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Award className="text-blue-600" size={18} />
                Registrar Desempenho na Prova
              </h3>
              <button 
                onClick={() => setEditingExamId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-5">
              Insira seus dados para manter sua métrica de resolução sincronizada com seu perfil de estudos.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nota / Questões Acertadas (Ex: 65/80 ou 82/100):
                </label>
                <input
                  type="text"
                  placeholder="Ex: 65/80"
                  value={inputScore}
                  onChange={(e) => setInputScore(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tempo Gasto de Prova (Ex: 3h30min):
                </label>
                <input
                  type="text"
                  placeholder="Ex: 3h15"
                  value={inputTime}
                  onChange={(e) => setInputTime(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-blue-500 font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                {examsProgress[editingExamId]?.solved && (
                  <button
                    onClick={() => handleSaveExamProgress(editingExamId, false, '', '')}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                  >
                    Remover Marcação
                  </button>
                )}

                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setEditingExamId(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSaveExamProgress(editingExamId, true, inputScore, inputTime)}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
                  >
                    Salvar Resultado
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Full Exam Analysis & Question Mapping */}
      {selectedAnalysisExam && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 animate-scaleIn flex flex-col text-slate-800">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full">
                    Análise Estatística Oficial
                  </span>
                  <span className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
                    {selectedAnalysisExam.banca} • {selectedAnalysisExam.year}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-800 mt-2 leading-snug">
                  Mapeamento de Assuntos: {selectedAnalysisExam.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Análise detalhada de cada questão e a incidência real no concurso oficial.
                </p>
              </div>
              <button 
                onClick={() => setSelectedAnalysisExamId(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Summary text */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-blue-600/40">
                <span className="text-[10px] uppercase font-bold text-blue-300 block mb-1">
                  Parecer do Professor Rafael Alves:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {selectedAnalysisExam.analysisSummary}
                </p>
              </div>

              {/* Statistics Chart & Top Topics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Subject Distribution */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                    Distribuição por Disciplina
                  </h4>
                  <div className="space-y-2">
                    {selectedAnalysisExam.stats.map((st, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>{st.subject}</span>
                          <span>{st.count} questões ({st.percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${st.percentage}%`, backgroundColor: st.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Topics in Exam */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                    Top Tópicos Mais Cobrados
                  </h4>
                  <div className="space-y-2">
                    {selectedAnalysisExam.topTopics.map((top, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-800 font-bold truncate pr-2">
                          {top.name}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          {top.count}q
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Mapa da prova: objeto de conhecimento de cada questão */}
              {selectedAnalysisExam.fullQuestions && selectedAnalysisExam.fullQuestions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={15} className="text-blue-600" />
                        Mapa da Prova ({selectedAnalysisExam.fullQuestions.length} questões)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Objeto de conhecimento cobrado em cada questão. Para resolver as questões reais, use o simulado de Prova Real.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder="Buscar por tema ou nº..."
                        value={questionSearch}
                        onChange={(e) => setQuestionSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-250 rounded-xl text-xs font-medium focus:outline-blue-500 shadow-sm"
                      />
                    </div>
                  </div>

                  <ol className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-[500px] overflow-y-auto bg-white">
                    {filteredQuestions && filteredQuestions.length > 0 ? (
                      filteredQuestions.map((q, idx) => (
                        <li key={idx} className="flex items-start gap-3 px-4 py-2.5 text-xs hover:bg-slate-50 transition">
                          <span className="font-black text-slate-900 w-8 shrink-0 text-right">{q.number} –</span>
                          <span className="flex-1 text-slate-700 font-medium leading-snug">{q.topic}</span>
                          <span className="hidden sm:inline text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md shrink-0 max-w-[40%] truncate">
                            {q.subject}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="py-6 text-center text-slate-400 text-xs">
                        Nenhuma questão encontrada com o termo "{questionSearch}".
                      </li>
                    )}
                  </ol>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <a
                  href={selectedAnalysisExam.examUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1.5"
                >
                  <ExternalLink size={13} />
                  <span>Caderno Oficial (PDF)</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnalysisExamId(null);
                    navigate(`/questoes?examId=${selectedAnalysisExam.id}`);
                  }}
                  className="text-xs font-black text-emerald-700 hover:text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                >
                  <PlayCircle size={14} />
                  <span>Praticar Esta Prova no Simulado</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedAnalysisExamId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm"
              >
                Fechar Raio-X
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
