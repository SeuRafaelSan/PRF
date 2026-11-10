import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BrainCircuit, ChevronDown, CheckCircle2, XCircle, RotateCcw, AlertTriangle, Save, ArrowRight, HelpCircle, Award } from 'lucide-react';
import { useConcurso } from '../lib/concursoContext';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserId } from '../lib/auth';
import { syncAndRecalculateUserStats } from '../lib/persistenceManager';
import { apiFetch } from '../lib/api';
import EssayGenerator from './EssayGenerator';
import { BRAND_ASSETS } from '../constants/brandAssets';
import LiquidLoader from './LiquidLoader';
import MathMarkdownRenderer from './MathMarkdownRenderer';
import { REAL_EXAMS_QUESTIONS } from '../data/realExamsQuestions';

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export default function QuestionGenerator() {
  const { currentConcurso, currentConcursoId } = useConcurso();
  const allDisciplines = [...currentConcurso.edital.gerais, ...currentConcurso.edital.especificos];

  const [theme, setTheme] = useState(allDisciplines[0]?.title || 'Língua Portuguesa');
  const [subtheme, setSubtheme] = useState(allDisciplines[0]?.topics[0] || 'Geral');
  
  // Simulator Modes: 'ai' (Inédito IA) | 'real' (Provas Reais)
  const [searchParams] = useSearchParams();
  const urlExamId = searchParams.get('examId');

  const [quizType, setQuizType] = useState<'ai' | 'real'>(urlExamId ? 'real' : 'ai');
  const [selectedRealExamId, setSelectedRealExamId] = useState<string>(() => REAL_EXAMS_QUESTIONS[0]?.id || '');

  // Handle URL param for direct exam loading
  useEffect(() => {
    if (urlExamId) {
      setQuizType('real');
      const foundExam = REAL_EXAMS_QUESTIONS.find(e => 
        e.id === urlExamId || 
        e.id === `${urlExamId}_real` || 
        `${e.id}_real` === urlExamId ||
        e.id.replace('_real', '') === urlExamId.replace('_real', '')
      );
      if (foundExam) {
        setSelectedRealExamId(foundExam.id);
      }
    }
  }, [urlExamId]);

  // Sincroniza tema, subtema e prova real quando o concurso selecionado mudar
  useEffect(() => {
    const activeDisciplines = [...currentConcurso.edital.gerais, ...currentConcurso.edital.especificos];
    const exists = activeDisciplines.find(d => d.title === theme);
    if (!exists) {
      const firstDisc = activeDisciplines[0];
      if (firstDisc) {
        setTheme(firstDisc.title);
        setSubtheme(firstDisc.topics[0] || 'Geral');
      }
    }

    const availableExams = REAL_EXAMS_QUESTIONS.filter(e => e.concursoId === currentConcurso.id);
    if (availableExams.length > 0) {
      const alreadyValid = availableExams.some(e => e.id === selectedRealExamId);
      if (!alreadyValid) {
        setSelectedRealExamId(availableExams[0].id);
      }
    }
  }, [currentConcursoId, currentConcurso]);

  const [numQuestions, setNumQuestions] = useState(5);
  const [mode, setMode] = useState<'ai' | 'essay'>('ai');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quiz State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [progressSaved, setProgressSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  
  const userId = useUserId();

  const activeSelectedOption = showResults ? userAnswers[currentIndex] : selectedOption;
  const activeHasSubmitted = showResults ? true : hasSubmitted;

  const selectedThemeData = allDisciplines.find(d => d.title === theme);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setHasSubmitted(false);
    setScore(0);
    setShowResults(false);
    setProgressSaved(false);
    setUserAnswers([]);

    if (quizType === 'real') {
      try {
        const exam = REAL_EXAMS_QUESTIONS.find(e => e.id === selectedRealExamId);
        if (exam) {
          const mappedQuestions = exam.questions.map(q => ({
            question: q.question,
            options: q.options || [],
            answer: q.answer,
            explanation: q.explanation,
            subject: q.subject,
            number: q.number
          }));
          setQuestions(mappedQuestions);
          setTheme(exam.title);
          setSubtheme("Simulado de Prova Real");
        } else {
          throw new Error('Prova selecionada não foi encontrada no acervo.');
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar simulado real.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const res = await apiFetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          theme, 
          subtheme, 
          numQuestions, 
          mode,
          concurso: currentConcurso.id,
          cargo: currentConcurso.cargo,
          banca: currentConcurso.banca,
          editalCode: currentConcurso.editalCode
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Falha ao gerar questões. Tente novamente.');
      }
      
      if (data.questions && data.questions.length > 0) {
        const sanitized = data.questions.map((q: any) => ({
          ...q,
          question: (q.question || '').replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '').replace(/<br\s*\/?>/gi, '\n').trim(),
          options: (Array.isArray(q.options) ? q.options : []).map((opt: string) => 
            String(opt || '').replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '').replace(/<br\s*\/?>/gi, ' ').trim()
          ),
          explanation: (q.explanation || '').replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '').replace(/<br\s*\/?>/gi, '\n').trim()
        }));
        setQuestions(sanitized);
      } else {
        throw new Error('Nenhuma questão retornada pelo sistema.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const isCurrentCebraspe = Boolean(
    questions[currentIndex] && (
      questions[currentIndex].options.length === 2 ||
      currentConcurso.ia.formatoQuestoes === 'CE' ||
      questions[currentIndex].options.some(o => /^(certo|errado)$/i.test(o.trim()))
    )
  );

  const handleOptionSelect = (optionLetter: string) => {
    if (hasSubmitted) return;
    setSelectedOption(optionLetter);
  };

  const handleSubmitAnswer = () => {
    if (!selectedOption || hasSubmitted) return;
    
    const currentQuestion = questions[currentIndex];
    const normalizedUserAnswer = selectedOption.trim().toUpperCase();
    const normalizedCorrect = currentQuestion.answer.trim().toUpperCase();
    
    // Suporte flexível para C/E e A-E
    let isCorrect = normalizedUserAnswer === normalizedCorrect;
    if (!isCorrect && isCurrentCebraspe) {
      if ((normalizedUserAnswer === 'C' || normalizedUserAnswer === 'CERTO') && (normalizedCorrect === 'C' || normalizedCorrect === 'CERTO')) {
        isCorrect = true;
      } else if ((normalizedUserAnswer === 'E' || normalizedUserAnswer === 'ERRADO') && (normalizedCorrect === 'E' || normalizedCorrect === 'ERRADO')) {
        isCorrect = true;
      }
    }
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    setUserAnswers(prev => [...prev, selectedOption]);
    setHasSubmitted(true);
  };

  const getOptionLetter = (index: number, isCebraspeMode: boolean): string => {
    if (isCebraspeMode) {
      return index === 0 ? 'C' : 'E';
    }
    return ['A', 'B', 'C', 'D', 'E'][index] || '';
  };

  // Extract letter prefix if present (e.g., "A) Texto..." -> "Texto...") or keep full text, stripping any HTML tags
  const cleanOptionText = (text: string) => {
    return text
      .replace(/^[A-E]\s*[)\-.:]\s*/i, '')
      .replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .trim();
  };

  const handleSaveProgress = async (isAutoParam?: boolean | any) => {
    const isAuto = typeof isAutoParam === 'boolean' ? isAutoParam : false;
    if (!userId) {
      if (!isAuto) setSaveError("Usuário não autenticado.");
      return;
    }
    
    setIsSavingProgress(true);
    setSaveError(null);
    try {
      // Save history item
      const historyRef = doc(collection(db, 'users', userId, 'simulation_history'));
      const currentScorePercentage = Math.round((score / questions.length) * 100);
      
      await setDoc(historyRef, {
        theme,
        subtheme,
        score,
        totalQuestions: questions.length,
        percentage: currentScorePercentage,
        questions,
        userAnswers,
        createdAt: new Date().toISOString()
      });

      // Recalculate and synchronize overall stats in Firestore
      await syncAndRecalculateUserStats(userId);
      setProgressSaved(true);
    } catch (error) {
      console.error("Erro ao salvar progresso no Firebase", error);
      setSaveError("Não foi possível registrar o progresso no Firebase. Clique abaixo para tentar salvar novamente.");
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setHasSubmitted(false);
    } else {
      setShowResults(true);
      // Auto-save completed simulation to Firebase
      if (userId && !progressSaved) {
        handleSaveProgress(true);
      }
    }
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <img src={BRAND_ASSETS.iconsOutline.documento} alt="" className="w-8 h-8 object-contain" />
            Gerador de Questões e Redações do Edital
          </h2>
          <p className="text-sm text-slate-500 mt-1">Treine com simulados inéditos e faça correções de redação conforme o edital oficial de {currentConcurso.shortTitle}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 ${
                mode === 'ai' 
                  ? 'bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-blue-200 border border-blue-500/70 shadow-md shadow-blue-950/30' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90'
              }`}
              onClick={() => setMode('ai')}
          >
            <img src={BRAND_ASSETS.iconsOutline.documento} alt="" className="w-5 h-5 object-contain shrink-0" />
            <span>Questões Objetivas</span>
          </button>
          
          <button 
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 ${
                mode === 'essay' 
                  ? 'bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-blue-200 border border-blue-500/70 shadow-md shadow-blue-950/30' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90'
              }`}
              onClick={() => setMode('essay')}
          >
            <img src={BRAND_ASSETS.iconsOutline.capelo} alt="" className="w-5 h-5 object-contain shrink-0" />
            <span>Laboratório de Redação (Teclado ou Foto)</span>
          </button>
        </div>
      </div>
      
      {mode === 'essay' ? (
        <EssayGenerator />
      ) : (
        <>
          {/* Abas: Inédito no padrão da banca vs Prova Real */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl mb-6 max-w-lg">
            <button 
              type="button"
              onClick={() => setQuizType('ai')}
              className={`flex-1 text-center py-2.5 text-xs font-black rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 ${
                quizType === 'ai' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BrainCircuit size={14} className="text-blue-700" />
              <span>Questões Inéditas (Padrão {currentConcurso.ia.bancaEstilo})</span>
            </button>
            <button 
              type="button"
              onClick={() => setQuizType('real')}
              className={`flex-1 text-center py-2.5 text-xs font-black rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 ${
                quizType === 'real' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Award size={14} className="text-amber-500" />
              <span>Simulado de Prova Real</span>
            </button>
          </div>

          {quizType === 'real' ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Escolha uma Prova Real ({currentConcurso.shortTitle})</label>
                <select 
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-white font-extrabold text-slate-700 focus:outline-blue-500"
                  value={selectedRealExamId}
                  onChange={(e) => setSelectedRealExamId(e.target.value)}
                >
                  {REAL_EXAMS_QUESTIONS.filter(exam => exam.concursoId === currentConcurso.id).map(exam => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} ({exam.questions.length} questões reais mapeadas)
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Este simulado carrega as questões originais do concurso da **{currentConcurso.shortTitle}**, incluindo os textos-base, enunciados de cada disciplina, alternativas reais e os gabaritos oficiais explicados. Ideal para testar seu rendimento sob pressão.
              </p>
            </div>
          ) : (
            /* Config Form */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 select-none">Disciplina</label>
                <select 
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none transition cursor-pointer"
                  value={theme}
                  onChange={(e) => {
                      const selectedDiscipline = e.target.value;
                      if (selectedDiscipline.toLowerCase().includes('redação')) {
                        setMode('essay');
                        return;
                      }
                      setTheme(selectedDiscipline);
                      const firstTopic = allDisciplines.find(d => d.title === selectedDiscipline)?.topics[0] || '';
                      setSubtheme(firstTopic);
                  }}
                >
                  {allDisciplines.map(d => <option key={d.title} value={d.title} className="cursor-pointer">{d.title}</option>)}
                </select>
              </div>
              
              <div className="relative w-full" ref={dropdownRef}>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 select-none">Tópico</label>
                <button 
                  type="button"
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm text-left flex justify-between items-center bg-slate-50 hover:bg-slate-100/50 transition truncate cursor-pointer"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <span className="truncate mr-2 font-medium text-slate-700 select-none">{subtheme}</span>
                  <ChevronDown size={16} className="text-slate-400 shrink-0" />
                </button>
                {isOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto py-1">
                    {selectedThemeData?.topics.map(t => (
                      <button
                          key={t}
                          type="button"
                          className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0 cursor-pointer ${subtheme === t ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-slate-600'}`}
                          onClick={() => {
                              setSubtheme(t);
                              setIsOpen(false);
                          }}
                      >
                          {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 select-none">Nº Questões</label>
                <select 
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none transition cursor-pointer"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                >
                  {[5, 10, 15, 20].map(n => <option key={n} value={n} className="cursor-pointer">{n} questões</option>)}
                </select>
              </div>
            </div>
          )}
          
          <button 
            disabled={isLoading}
            className="w-full brand-skew-btn py-4 px-6 rounded-2xl font-black disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-3.5 shadow-xl border border-blue-400/40 group"
            onClick={handleGenerate}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-400/40 flex items-center justify-center shrink-0 z-10">
              <img src={BRAND_ASSETS.iconsWhiteBg.documento} alt="" className="w-5 h-5 object-contain" />
            </div>
            <span className="text-sm font-black uppercase tracking-wider text-white z-10">
              {isLoading ? 'Carregando questões...' : (quizType === 'real' ? 'Carregar e Iniciar Simulado de Prova Real' : 'Gerar e Iniciar Simulado')}
            </span>
          </button>

      {/* Error State */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold">Houve um problema:</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mt-8 flex flex-col items-center justify-center py-10 bg-slate-900/60 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
          <LiquidLoader 
            text="Sintetizando Questões Inéditas" 
            subtext={`Elaborando questões com base no padrão ${currentConcurso.ia.bancaEstilo} e nas diretrizes do edital ${currentConcurso.editalCode}...`}
          />
        </div>
      )}

      {/* Active Quiz View */}
      {!isLoading && questions.length > 0 && (
        <div className="mt-8 border-t border-slate-100 pt-8 animate-fadeIn">
          {/* Progress & Format Indicator */}
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Questão {currentIndex + 1} de {questions.length}
              </span>
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                isCurrentCebraspe 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-teal-50 text-teal-800 border border-teal-200'
              }`}>
                {isCurrentCebraspe 
                  ? 'Padrão CEBRASPE • Certo / Errado' 
                  : `Padrão ${currentConcurso.ia.bancaEstilo} • Múltipla Escolha (${currentConcurso.ia.formatoQuestoes === 'A-D' ? 'A, B, C, D' : 'A, B, C, D, E'})`}
              </span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full">
              {theme}
            </span>
          </div>
          
          <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
            <div 
              className="bg-purple-600 h-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>

          {/* Question Text */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              {isCurrentCebraspe ? 'Julgue o item a seguir:' : 'Enunciado da Questão:'}
            </div>
            <MathMarkdownRenderer text={questions[currentIndex].question} />
          </div>

          {/* Options List / Certo e Errado Cards */}
          {isCurrentCebraspe ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Opção CERTO */}
              {(() => {
                const isSelected = activeSelectedOption === 'C';
                const isCorrect = questions[currentIndex].answer.trim().toUpperCase() === 'C';
                
                let cardStyle = "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 text-slate-800";
                if (isSelected && !activeHasSubmitted) {
                  cardStyle = "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200 text-emerald-950 font-bold";
                } else if (activeHasSubmitted) {
                  if (isCorrect) {
                    cardStyle = "border-emerald-500 bg-emerald-50/90 text-emerald-950 font-bold shadow-sm";
                  } else if (isSelected && !isCorrect) {
                    cardStyle = "border-red-400 bg-red-50 text-red-900";
                  } else {
                    cardStyle = "border-slate-100 bg-slate-50/50 opacity-50 text-slate-400";
                  }
                }

                return (
                  <button
                    type="button"
                    disabled={activeHasSubmitted}
                    onClick={() => handleOptionSelect('C')}
                    className={`p-5 rounded-2xl border-2 transition-all duration-150 flex items-center justify-between gap-4 group text-left ${cardStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition ${
                        isSelected && !activeHasSubmitted
                          ? 'bg-emerald-600 text-white'
                          : activeHasSubmitted && isCorrect
                          ? 'bg-emerald-600 text-white'
                          : activeHasSubmitted && isSelected && !isCorrect
                          ? 'bg-red-600 text-white'
                          : 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200'
                      }`}>
                        C
                      </span>
                      <div>
                        <div className="text-base font-extrabold">CERTO</div>
                        <div className="text-xs text-slate-500 font-medium">Item tecnicamente correto</div>
                      </div>
                    </div>
                    <CheckCircle2 size={22} className={isSelected || (activeHasSubmitted && isCorrect) ? 'text-emerald-600' : 'text-slate-300 group-hover:text-emerald-500'} />
                  </button>
                );
              })()}

              {/* Opção ERRADO */}
              {(() => {
                const isSelected = activeSelectedOption === 'E';
                const isCorrect = questions[currentIndex].answer.trim().toUpperCase() === 'E';
                
                let cardStyle = "border-slate-200 bg-white hover:border-rose-400 hover:bg-rose-50/30 text-slate-800";
                if (isSelected && !activeHasSubmitted) {
                  cardStyle = "border-rose-600 bg-rose-50 ring-2 ring-rose-200 text-rose-950 font-bold";
                } else if (activeHasSubmitted) {
                  if (isCorrect) {
                    cardStyle = "border-emerald-500 bg-emerald-50/90 text-emerald-950 font-bold shadow-sm";
                  } else if (isSelected && !isCorrect) {
                    cardStyle = "border-red-400 bg-red-50 text-red-900";
                  } else {
                    cardStyle = "border-slate-100 bg-slate-50/50 opacity-50 text-slate-400";
                  }
                }

                return (
                  <button
                    type="button"
                    disabled={activeHasSubmitted}
                    onClick={() => handleOptionSelect('E')}
                    className={`p-5 rounded-2xl border-2 transition-all duration-150 flex items-center justify-between gap-4 group text-left ${cardStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition ${
                        isSelected && !activeHasSubmitted
                          ? 'bg-rose-600 text-white'
                          : activeHasSubmitted && isCorrect
                          ? 'bg-emerald-600 text-white'
                          : activeHasSubmitted && isSelected && !isCorrect
                          ? 'bg-red-600 text-white'
                          : 'bg-rose-100 text-rose-800 group-hover:bg-rose-200'
                      }`}>
                        E
                      </span>
                      <div>
                        <div className="text-base font-extrabold">ERRADO</div>
                        <div className="text-xs text-slate-500 font-medium">Item incorreto / com falha</div>
                      </div>
                    </div>
                    <XCircle size={22} className={isSelected || (activeHasSubmitted && isCorrect) ? 'text-rose-600' : 'text-slate-300 group-hover:text-rose-500'} />
                  </button>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-3">
              {questions[currentIndex].options.map((option, idx) => {
                const letter = getOptionLetter(idx, false);
                const isSelected = activeSelectedOption === letter;
                const isCorrect = letter === questions[currentIndex].answer;
                
                let optionStyle = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
                if (isSelected && !activeHasSubmitted) {
                  optionStyle = "border-purple-600 bg-purple-50/50 ring-2 ring-purple-100";
                } else if (activeHasSubmitted) {
                  if (isCorrect) {
                    optionStyle = "border-green-500 bg-green-50/80 text-green-900 font-medium";
                  } else if (isSelected && !isCorrect) {
                    optionStyle = "border-red-400 bg-red-50/80 text-red-900";
                  } else {
                    optionStyle = "border-slate-100 bg-slate-50/50 opacity-60";
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={activeHasSubmitted}
                    onClick={() => handleOptionSelect(letter)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-3 group ${optionStyle}`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected && !activeHasSubmitted 
                        ? 'bg-purple-600 text-white' 
                        : activeHasSubmitted && isCorrect 
                        ? 'bg-green-600 text-white' 
                        : activeHasSubmitted && isSelected && !isCorrect 
                        ? 'bg-red-600 text-white' 
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}>
                      {letter}
                    </span>
                    <span className="text-sm md:text-base">{cleanOptionText(option)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Explanation and Next Controls */}
          <div className="mt-6 flex flex-col gap-4">
            {activeHasSubmitted && (
              <div className={`p-5 rounded-2xl border ${
                (activeSelectedOption === questions[currentIndex].answer || 
                 (isCurrentCebraspe && ((activeSelectedOption === 'C' && questions[currentIndex].answer === 'C') || (activeSelectedOption === 'E' && questions[currentIndex].answer === 'E'))))
                  ? 'bg-green-50/50 border-green-200' 
                  : 'bg-red-50/30 border-red-200'
              } animate-fadeIn`}>
                <div className="flex items-center gap-2 mb-2 font-bold text-slate-800">
                  {(activeSelectedOption === questions[currentIndex].answer || 
                    (isCurrentCebraspe && ((activeSelectedOption === 'C' && questions[currentIndex].answer === 'C') || (activeSelectedOption === 'E' && questions[currentIndex].answer === 'E')))) ? (
                    <span className="text-green-600 flex items-center gap-1.5"><CheckCircle2 size={18} /> Resposta Correta!</span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1.5"><XCircle size={18} /> Resposta Incorreta</span>
                  )}
                </div>
                <div className="text-sm text-slate-700 leading-relaxed">
                  <p className="font-semibold text-slate-800 mb-1">
                    Gabarito Oficial: {isCurrentCebraspe 
                      ? (questions[currentIndex].answer.trim().toUpperCase() === 'C' ? 'CERTO (C)' : 'ERRADO (E)') 
                      : `Alternativa ${questions[currentIndex].answer}`}
                  </p>
                  <div className="text-slate-700">
                    <MathMarkdownRenderer text={questions[currentIndex].explanation} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-2">
              {!activeHasSubmitted ? (
                <button
                  disabled={!selectedOption}
                  onClick={handleSubmitAnswer}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all duration-200 flex items-center gap-2 shadow"
                >
                  Confirmar Resposta
                </button>
              ) : (
                !showResults && (
                  <button
                    onClick={handleNext}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all duration-200 flex items-center gap-2 shadow"
                  >
                    {currentIndex < questions.length - 1 ? 'Próxima Questão' : 'Ver Resultados'} <ArrowRight size={18} />
                  </button>
                )
              )}
            </div>

            {/* Navigation for review when quiz is finished */}
            {showResults && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => {
                    setCurrentIndex(prev => prev - 1);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl font-bold text-xs transition"
                >
                  Questão Anterior
                </button>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                  Revisando: {currentIndex + 1} de {questions.length}
                </span>
                <button
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => {
                    setCurrentIndex(prev => prev + 1);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl font-bold text-xs transition"
                >
                  Próxima Questão
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results View */}
      {showResults && (
        <div className="mt-8 border-t border-slate-100 pt-8 text-center animate-fadeIn">
          <div className="max-w-md mx-auto bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <h3 className="text-2xl font-black text-slate-800 mb-2">Simulado Concluído!</h3>
            <p className="text-sm text-slate-500 mb-6">{theme} - {subtheme}</p>
            
            <div className="inline-flex items-center justify-center p-6 bg-white rounded-full shadow-inner mb-6 border border-slate-100">
              <span className="text-4xl font-extrabold text-purple-600">{score}</span>
              <span className="text-xl text-slate-400 font-bold">/ {questions.length}</span>
            </div>

            <p className="font-bold text-slate-700 text-lg mb-2">
              {score === questions.length ? 'Espetacular! Desempenho excelente!' : score >= questions.length * 0.7 ? 'Muito bem! Continue focado!' : 'Bom treino! Revise os tópicos e tente novamente.'}
            </p>

            {saveError && (
              <div className="w-full mt-2 mb-3 bg-red-50 text-red-700 text-xs p-3 rounded-xl font-bold border border-red-200">
                {saveError}
              </div>
            )}

            {!progressSaved ? (
              <button
                onClick={handleSaveProgress}
                disabled={isSavingProgress}
                className="w-full mt-3 mb-3 brand-skew-btn text-white py-3.5 rounded-xl font-bold border border-blue-400/40 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow"
              >
                <Save size={18} className="text-sky-300 z-10" /> 
                <span className="z-10">{isSavingProgress ? 'Salvando...' : 'Adicionar Progresso aos Favoritos/Histórico'}</span>
              </button>
            ) : (
              <div className="w-full mt-3 mb-3 bg-green-100 text-green-800 p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 border border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} /> Progresso registrado com sucesso!
                </div>
                <p className="text-xs font-medium text-green-700 text-center">
                  Você está {Math.round((score / questions.length) * 100)}% mais perto da aprovação!
                </p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow"
            >
              <RotateCcw size={18} /> Refazer Simulado
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </section>
  );
}
