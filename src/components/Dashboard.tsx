import { Play, FileText, CheckCircle, BarChart3, CalendarDays, RefreshCw, Share2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useUserId } from '../lib/auth';
import { useConcurso } from '../lib/concursoContext';
import ConcursoSwitcher from './ConcursoSwitcher';
import SimulationHistory from './SimulationHistory';
import { BRAND_ASSETS } from '../constants/brandAssets';
import { syncAndRecalculateUserStats } from '../lib/persistenceManager';

export default function Dashboard() {
  const { currentConcurso } = useConcurso();
  const [stats, setStats] = useState({
    videoLessons: 0,
    simulations: 0,
    questions: 0,
    performance: 0,
    studyDays: 0,
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const userId = useUserId();

  useEffect(() => {
    if (!userId) return;

    // Recalculate aggregated stats from Firestore on dashboard load
    syncAndRecalculateUserStats(userId).catch(err => {
      console.warn("[Dashboard] Background stats sync warning:", err);
    });

    const docRef = doc(db, 'users', userId, 'stats', 'main');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setStats(docSnap.data() as any);
      }
    }, (error) => {
      console.warn("[Dashboard] Error in stats onSnapshot:", error);
    });
    return () => unsubscribe();
  }, [userId]);

  const resetStats = async () => {
    if (!userId) return;
    const initialStats = {
      videoLessons: 0,
      simulations: 0,
      questions: 0,
      performance: 0,
      studyDays: 0,
    };
    await setDoc(doc(db, 'users', userId, 'stats', 'main'), initialStats);
    setStats(initialStats);
  };

  const handleStatClick = () => {
    const element = document.getElementById('history-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const statItems = [
    { label: 'Videoaulas assistidas', value: stats.videoLessons.toString(), icon: Play, brandIcon: BRAND_ASSETS.iconsOutline.capelo },
    { label: 'Simulados realizados', value: stats.simulations.toString(), icon: FileText, brandIcon: BRAND_ASSETS.iconsOutline.documento, clickable: true },
    { label: 'Questões respondidas', value: stats.questions.toString(), icon: CheckCircle, brandIcon: BRAND_ASSETS.iconsOutline.documento, clickable: true },
    { label: 'Média de desempenho', value: `${stats.performance}%`, icon: BarChart3, brandIcon: BRAND_ASSETS.iconsOutline.dashboard, clickable: true },
    { label: 'Dias de estudos', value: stats.studyDays.toString(), icon: CalendarDays, brandIcon: BRAND_ASSETS.iconsWhiteBg.capelo },
  ];

  const performanceData = [
    { name: 'Excelente', value: stats.performance >= 85 ? 1 : 0, color: '#22c55e' },
    { name: 'Bom', value: (stats.performance >= 60 && stats.performance < 85) ? 1 : 0, color: '#3b82f6' },
    { name: 'Regular', value: (stats.performance > 0 && stats.performance < 60) ? 1 : 0, color: '#eab308' },
    { name: 'Não iniciado', value: stats.performance === 0 ? 1 : 0, color: '#ef4444' },
  ];

  return (
    <main className="p-4 md:p-8 bg-slate-50 flex-1">
      {/* Concurso Switcher Card */}
      <div className="mb-6">
        <ConcursoSwitcher variant="inline-card" />
      </div>

      <section className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white mb-6 flex flex-col md:flex-row justify-between items-center relative overflow-hidden shadow-lg gap-6">
        {/* Background Decorative Element with overlay */}
        <div className="absolute inset-0 pointer-events-none select-none z-0">
          <div 
            className="w-96 h-96 rounded-full absolute -right-20 -top-20 opacity-20 blur-3xl"
            style={{ backgroundColor: currentConcurso.colorScheme.primary }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-900/70"></div>
        </div>

        <div className="relative z-10 space-y-3 select-none">
          <div className="flex items-center gap-2">
            <span 
              className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: currentConcurso.colorScheme.bgBadge,
                color: currentConcurso.colorScheme.textBadge,
                borderColor: currentConcurso.colorScheme.border
              }}
            >
              {currentConcurso.tag}
            </span>
            <span className="text-blue-300 font-bold text-xs">Olá, {auth.currentUser?.displayName || 'Aluno'}!</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2 leading-tight">
            Preparação Focada para<br/>
            <span style={{ color: currentConcurso.colorScheme.secondary }}>{currentConcurso.cargo}</span>
          </h1>
          <p className="text-sm text-gray-300 font-medium max-w-xl">
            Edital <strong className="text-white">{currentConcurso.editalCode}</strong> ({currentConcurso.orgao}) sob comando da banca <strong className="text-white">{currentConcurso.banca}</strong>.{currentConcurso.vagas ? ` ${currentConcurso.vagas}.` : ''} Mantenha a constância e o foco.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a 
              href={currentConcurso.editalUrl || "https://www.concursosfcc.com.br/rybena/web/index.html?file=https://www.concursosfcc.com.br/concursos/govba222/edital_de_abertura_de_inscricoes_doe_de_28.09.2022.pdf"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 border border-blue-700/60 text-white transition-all px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-950/40 active:scale-95 group"
            >
              <span>Acessar o Edital Oficial</span>
              <Share2 size={13} className="text-blue-300 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
        <div className="text-center relative z-10 bg-slate-950/70 backdrop-blur-sm p-5 rounded-3xl border border-slate-800 min-w-[200px] shadow-lg select-none">
            <div className="text-4xl md:text-5xl font-black text-blue-300">{stats.performance}%</div>
            <p className="text-[10px] uppercase font-extrabold tracking-widest text-slate-300 mt-1">desempenho geral</p>
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800 font-bold">Plano de Estudos<br/><span className="font-extrabold text-blue-300 text-[11px]">R. ALVES CONCURSOS</span></p>
        </div>
      </section>

      <section className="mb-6 flex justify-end">
        <button onClick={() => setShowResetConfirm(true)} className="neumorphic-btn text-xs font-black uppercase tracking-wider select-none">
           <RefreshCw size={15} className="text-red-600" /> Resetar Progresso
        </button>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            onClick={stat.clickable ? handleStatClick : undefined}
            className={`bg-white p-4 md:p-5 rounded-2xl border flex items-center gap-4 select-none ${
              stat.clickable 
                ? 'cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.98] transition-all' 
                : 'border-slate-200'
            }`}
          >
            <div className="bg-slate-50 p-2 rounded-xl flex-shrink-0 border border-slate-100">
              <img src={stat.brandIcon} alt="" className="w-8 h-8 object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl md:text-2xl font-black text-slate-800">{stat.value}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider leading-tight whitespace-normal">{stat.label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-1 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 mb-1">Seu desempenho geral</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Mapeamento de resultados</p>
          </div>
          <div className="h-44 flex items-center justify-center relative my-2">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie 
                   data={performanceData} 
                   innerRadius={48} 
                   outerRadius={65} 
                   dataKey="value"
                   startAngle={90}
                   endAngle={-270}
                 >
                   {performanceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                 </Pie>
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-2xl font-black text-slate-800">{stats.performance}%</span>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Média</span>
             </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
            {performanceData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div id="history-section" className="col-span-1 lg:col-span-2">
          <SimulationHistory />
        </div>
      </section>

      {/* Reset Progress Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-scaleIn text-slate-800">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <RefreshCw size={24} className="animate-spin" style={{ animationDuration: '3s' }} />
              <h4 className="text-base font-black">Resetar Todo o Progresso?</h4>
            </div>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Atenção: Esta ação é <span className="font-extrabold text-red-600">irreversível</span> e irá <span className="font-extrabold text-slate-700">apagar completamente</span> todo o seu histórico de videoaulas assistidas, quantidade de simulados, total de questões respondidas e seu aproveitamento geral, redefinindo tudo para <span className="font-bold text-slate-700">zero</span>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="neumorphic-btn-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await resetStats();
                  setShowResetConfirm(false);
                }}
                className="neumorphic-btn-sm text-red-600 font-black"
              >
                Sim, Resetar Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
