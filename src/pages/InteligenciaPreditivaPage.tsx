import React, { useState } from 'react';
import { 
  TrendingUp, 
  Target, 
  Sparkles, 
  AlertTriangle, 
  BookOpen, 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  Info, 
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import { useConcurso } from '../lib/concursoContext';
import ConcursoSwitcher from '../components/ConcursoSwitcher';
import { BRAND_ASSETS } from '../constants/brandAssets';
import { PROVAS_ANTERIORES } from '../concurso';

export default function InteligenciaPreditivaPage() {
  const { currentConcurso } = useConcurso();
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [expandedTrap, setExpandedTrap] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'radar' | 'microtemas' | 'simulador' | 'armadilhas'>('radar');

  // Todo o conteúdo desta página vem do pacote do concurso (concurso.json → inteligencia).
  const intel = currentConcurso.inteligencia;
  const bancaEstilo = currentConcurso.ia.bancaEstilo;
  const { topTopics, actionBlocks, traps, disciplinesPred, simulador } = intel;
  const provasMapeadas = PROVAS_ANTERIORES.filter(p => p.concursoId === currentConcurso.id);
  const questoesMapeadas = provasMapeadas.reduce((n, p) => n + (p.questionsCount || 0), 0);

  // ==================== SIMULADOR (blocos, pesos e corte definidos no pacote) ====================
  const [acertos, setAcertos] = useState<number[]>(() =>
    simulador.blocos.map(b => Math.min(b.inicial ?? Math.round(b.questoes * 0.7), b.questoes))
  );
  const simTotalQuestions = simulador.blocos.reduce((n, b) => n + b.questoes, 0);
  const simTotalAcertos = acertos.reduce((n, v) => n + v, 0);
  const simTotalPoints = simulador.blocos.reduce((n, b, i) => n + acertos[i] * b.peso, 0).toFixed(1);
  const notaCorte = simulador.notaCorte;

  const filteredDisciplines = selectedDiscipline === 'all' 
    ? disciplinesPred 
    : disciplinesPred.filter(d => d.discipline === selectedDiscipline);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      
      {/* Concurso Switcher Card */}
      <div className="mb-6">
        <ConcursoSwitcher variant="inline-card" />
      </div>

      {/* Upper Banner / Predictive Intelligence Header */}
      <div className="mb-8 bg-slate-900 text-white p-6 md:p-8 rounded-3xl border border-slate-800 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none transform translate-x-12 -translate-y-12">
          <TrendingUp size={320} />
        </div>
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] bg-slate-800 border border-slate-700 text-blue-300 px-3 py-1 rounded-full uppercase font-black tracking-wider inline-flex items-center gap-1.5 shadow-xs">
                <Sparkles size={12} className="animate-pulse text-blue-300" />
                Inteligência Preditiva Estratégica • {currentConcurso.banca}
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
                Base de Dados: {intel.resumoBase}
              </span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Inteligência Preditiva: {currentConcurso.fullName}
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              {intel.descricao}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-3 bg-slate-850 border border-slate-750 p-4 rounded-2xl shrink-0">
              <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-xl">
                <Target size={22} />
              </div>
              <div>
                <span className="block text-[9px] font-bold uppercase text-slate-400">Provas Mapeadas</span>
                <span className="text-lg font-black text-blue-300">{provasMapeadas.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-850 border border-slate-750 p-4 rounded-2xl shrink-0">
              <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-xl">
                <TrendingUp size={22} />
              </div>
              <div>
                <span className="block text-[9px] font-bold uppercase text-slate-400">Banca do Edital</span>
                <span className="text-lg font-black text-amber-300">{bancaEstilo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Predictive Intelligence */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('radar')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'radar'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp size={15} />
          <span>Radar de Incidência (Raio-X Real)</span>
        </button>

        <button
          onClick={() => setActiveTab('microtemas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'microtemas'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BookOpen size={15} />
          <span>Micro-Temas & Estratégia Cirúrgica</span>
        </button>

        <button
          onClick={() => setActiveTab('simulador')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'simulador'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calculator size={15} />
          <span>Simulador de Pontuação ({bancaEstilo})</span>
        </button>

        <button
          onClick={() => setActiveTab('armadilhas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'armadilhas'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <AlertTriangle size={15} />
          <span>Armadilhas Identificadas na Banca</span>
        </button>
      </div>

      {/* TAB 1: RADAR DE INCIDÊNCIA & TOP TÓPICOS */}
      {activeTab === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          
          {/* Left Column: Top topics and Trap Alerts */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Top Topics Card List */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2.5">
                    <img src={BRAND_ASSETS.iconsOutline.capelo} alt="" className="w-6 h-6 object-contain" />
                    Top Tópicos Recorrentes com Base no Histórico Real
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Probabilidade estatística calculada de forma ponderada com base no acervo de questões mapeadas.</p>
                </div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shrink-0">
                  {intel.questoesPorProva} Questões por Exame
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topTopics.map((topic, idx) => (
                  <div 
                    key={idx} 
                    className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between hover:border-blue-500/40 hover:bg-blue-50/20 transition-all duration-200 group"
                  >
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {topic.category}
                        </span>
                        <span className="text-xs font-black text-blue-900 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-lg shrink-0">
                          {topic.probability}%
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 leading-snug group-hover:text-blue-900 transition-colors">
                        {topic.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Histórico: <strong className="text-slate-700">{topic.historicalCount}</strong>
                      </p>
                      <p className="text-[10px] text-blue-800 italic font-semibold leading-relaxed">
                        Fonte real: {topic.examSource}
                      </p>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-slate-200/60">
                      <div className="w-full bg-slate-200/85 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-900 to-blue-600 h-full rounded-full transition-all duration-300" 
                          style={{ width: `${topic.probability}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
                        <span>Relevância {topic.trend === 'critica' ? 'Crítica' : 'Alta'}</span>
                        <span>Fidelidade de Dados: Real</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Description Card of the Raio-X Correlation */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-800">Correlação Inteligente com a Banca {bancaEstilo}</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Diferente de geradores de estatísticas genéricas, nossa inteligência analisou o **microtema exato** de cada uma das {questoesMapeadas} questões catalogadas nas provas da {currentConcurso.fullName}. Ao correlacionar esses dados com o estilo da banca **{bancaEstilo}**, o sistema calculou o fator de relevância exato para garantir que seu esforço seja alocado onde os pontos realmente estão.
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Study blocks by ROI */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="mb-5">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Target size={18} className="text-blue-900" />
                  Divisão Estratégica em Blocos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Distribua suas horas de dedicação seguindo o retorno sobre investimento (ROI).</p>
              </div>

              <div className="space-y-4">
                {actionBlocks.map((block, idx) => (
                  <div 
                    key={idx}
                    className={`p-4.5 rounded-2xl border ${block.borderColor} ${block.bgLight} transition-all`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <h4 className={`text-xs font-black uppercase ${block.textColor}`}>
                        {block.title}
                      </h4>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md bg-white border ${block.borderColor} ${block.textColor}`}>
                        {block.percentage}% do tempo
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
                      {block.description}
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                        Assuntos Prioritários no Bloco:
                      </span>
                      {block.priorities.map((item, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-1.5 text-xs text-slate-700 font-medium">
                          <span className="text-blue-600 font-bold shrink-0">•</span>
                          <span className="text-[11px]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: MICRO-TEMAS & ESTRATÉGIA */}
      {activeTab === 'microtemas' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Discipline Selector Header */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filtrar por Disciplina:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedDiscipline('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    selectedDiscipline === 'all' 
                      ? 'bg-blue-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas ({disciplinesPred.length})
                </button>
                {disciplinesPred.map((d, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedDiscipline(d.discipline)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                      selectedDiscipline === d.discipline 
                        ? 'bg-blue-900 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d.discipline}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-slate-400 font-bold">
              Detalhamento de Microtemas {bancaEstilo}
            </span>
          </div>

          {/* Detailed Cards for Disciplines */}
          <div className="space-y-6">
            {filteredDisciplines.map((dItem, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <BookOpen size={18} className="text-blue-900" />
                      {dItem.discipline}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{dItem.analysis}</p>
                  </div>
                  <span className="text-xs font-black text-blue-900 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl self-start sm:self-auto">
                    {dItem.weightText}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  {dItem.microTemas.map((mTema, mIdx) => (
                    <div 
                      key={mIdx}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-md">
                            {mTema.focusNorm}
                          </span>
                          <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {mTema.prob} Prob.
                          </span>
                        </div>

                        <h4 className="font-bold text-xs text-slate-800 leading-snug">
                          {mTema.topic}
                        </h4>

                        <div className="mt-2 text-[10px] text-slate-500 font-semibold">
                          Incidência Histórica: <span className="text-slate-800">{mTema.freq}</span>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200 text-xs text-slate-600 leading-relaxed font-medium">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                            Diretriz Prática:
                          </span>
                          {mTema.strategy}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400 font-bold">
                        <span>Padrão {bancaEstilo}</span>
                        <span className="text-blue-600">Revisão Obrigatória</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 3: SIMULADOR DE PONTUAÇÃO & NOTA DE CORTE */}
      {activeTab === 'simulador' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          
          {/* Main Column: Interactive Sliders */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 text-blue-900 rounded-xl">
                  <Calculator size={18} />
                </span>
                <h3 className="text-base font-black text-slate-800">
                  Simulador de Acertos e Nota Ponderada ({currentConcurso.shortTitle})
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Ajuste os acertos esperados em cada disciplina para calcular sua pontuação estimada com a régua de ponderação oficial da banca {bancaEstilo}.
              </p>
            </div>

            {/* PAINEL DO SIMULADOR (blocos do pacote) */}
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                {simulador.blocos.map((bloco, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-bold text-slate-700">{bloco.nome} (Peso {bloco.peso.toFixed(bloco.peso % 1 ? 2 : 1)})</span>
                      <span className="font-black text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">{acertos[i]} / {bloco.questoes} acertos</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={bloco.questoes}
                      value={acertos[i]}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setAcertos(prev => prev.map((x, j) => (j === i ? v : x)));
                      }}
                      className="w-full accent-blue-900"
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl leading-relaxed flex gap-2">
                <Info className="shrink-0 text-amber-700" size={16} />
                <span>{simulador.observacao}</span>
              </div>
            </div>
          </div>

          {/* Sidebar: Calculated Result and Cutoff analysis */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-md flex flex-col justify-between h-full">
              <div>
                <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
                  <Target size={18} className="text-blue-300" />
                  Resultado da Projeção
                </h3>

                <div className="space-y-5">
                  <div className="text-center bg-slate-850 p-5 rounded-2xl border border-slate-800">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sua Nota Estimada</span>
                    <span className="text-3xl font-black text-blue-300 tracking-tight">
                      {simTotalPoints} / {simulador.notaMaxima}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">
                      Aproveitamento das questões: {((simTotalAcertos / simTotalQuestions) * 100).toFixed(1)}%
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-bold">Total de Acertos:</span>
                      <span className="font-extrabold text-white">{simTotalAcertos} de {simTotalQuestions} questões</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-bold">Média de Corte Histórica:</span>
                      <span className="font-extrabold text-amber-300">{notaCorte.toFixed(1)} pontos</span>
                    </div>
                  </div>

                  {/* Cutoff analysis text */}
                  <div className="pt-4 border-t border-slate-800">
                    {parseFloat(simTotalPoints) >= notaCorte ? (
                      <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <span>ZONA DE CLASSIFICAÇÃO!</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-300">
                          Seu desempenho projetado está **acima da nota de corte estimada**. Mantenha a constância nos simulados para consolidar sua vaga entre as posições de convocação imediata.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <TrendingDown size={14} className="text-amber-400 shrink-0" />
                          <span>ABAIXO DO CORTE HISTÓRICO</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-300">
                          Você precisa de mais **{(notaCorte - parseFloat(simTotalPoints)).toFixed(1)} ponto(s)** para bater a média geral de corte de aprovação. Foque seu tempo de estudo nos **tópicos do Bloco Ouro** para potencializar seu ROI.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-800 text-[10px] text-slate-500 leading-normal">
                {simulador.rodape}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: ARMADILHAS DA BANCA */}
      {activeTab === 'armadilhas' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm animate-fadeIn">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-50 text-amber-700 rounded-xl">
                <AlertTriangle size={18} />
              </span>
              <h3 className="text-base font-black text-slate-800">
                Guia de Armadilhas da banca {bancaEstilo} ({currentConcurso.shortTitle})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Fique atento a estas pegadinhas recorrentes extraídas da correlação entre o perfil histórico de provas e o modelo de formulação teórica da banca atual.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {traps.map((trap, idx) => {
              const isExpanded = expandedTrap === idx;
              return (
                <div 
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-amber-500/40 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        {trap.type}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">Risco Alto</span>
                    </div>

                    <h4 className="font-extrabold text-xs text-slate-800 mb-2 leading-snug">
                      {trap.title}
                    </h4>

                    <div className="space-y-3 mt-3">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-rose-500 block mb-1">Onde está a pegadinha:</span>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {trap.risk}
                        </p>
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-200 animate-fadeIn">
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block mb-1">Como neutralizar na prova:</span>
                          <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                            {trap.action}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedTrap(isExpanded ? null : idx)}
                    className="mt-4 pt-3 border-t border-slate-200 text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1 self-start"
                  >
                    <span>{isExpanded ? 'Ocultar Resolução' : 'Como Neutralizar a Pegadinha'}</span>
                    <ArrowRight size={12} className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
