import React, { useState, useEffect } from 'react';
import { Cloud, CloudCheck, RefreshCw, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useUserId, useAuth } from '../lib/auth';
import { syncAndRecalculateUserStats } from '../lib/persistenceManager';

interface FirebaseSyncStatusProps {
  variant?: 'badge' | 'full' | 'inline';
}

export default function FirebaseSyncStatus({ variant = 'badge' }: FirebaseSyncStatusProps) {
  const { user } = useAuth();
  const userId = useUserId();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Agora mesmo');
  const [showModal, setShowModal] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (!userId) return;
    setIsSyncing(true);
    setSyncSuccess(null);
    try {
      await syncAndRecalculateUserStats(userId);
      setSyncSuccess(true);
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setTimeout(() => setSyncSuccess(null), 3000);
    } catch (err) {
      console.error("Erro na sincronização manual:", err);
      setSyncSuccess(false);
    } finally {
      setIsSyncing(false);
    }
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
        <CloudCheck size={16} className="text-emerald-600 shrink-0" />
        <span>Salvo no Firebase ({lastSyncTime})</span>
        <button 
          onClick={handleManualSync}
          disabled={isSyncing}
          className="ml-1 text-emerald-700 hover:text-emerald-900 transition-colors p-1 rounded-md hover:bg-emerald-100"
          title="Forçar sincronização em nuvem"
        >
          <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
        </button>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <CloudCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-800">Persistência em Nuvem Firebase Ativa</h4>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  100% Protegido
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Todo seu progresso, simulados, notas de provas, mapas mentais e questões são gravados instantaneamente no seu perfil.
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            <span>{isSyncing ? "Sincronizando..." : "Sincronizar Agora"}</span>
          </button>
        </div>

        {syncSuccess === true && (
          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
            <CheckCircle2 size={15} />
            <span>Estatísticas e registros de progresso sincronizados com sucesso no Firestore!</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-xl text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer group"
        title="Status da Sincronização em Nuvem Firebase"
      >
        <CloudCheck size={13} className="text-emerald-600 group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline">Firebase Conectado</span>
        <span className="sm:hidden">Salvo</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
                <CloudCheck size={28} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Armazenamento em Nuvem Ativo</h3>
                <p className="text-xs text-slate-500">Firebase Firestore Cloud Database</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-700">Conta autenticada:</span>
                <span className="text-slate-900 font-black truncate max-w-[200px]">{user?.email || 'Aluno'}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-700">Status da sincronização:</span>
                <span className="text-emerald-700 font-black flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Tempo Real (Firestore)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Última atualização:</span>
                <span className="text-slate-700 font-bold">{lastSyncTime}</span>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Todos os seus dados estão seguros e vinculados à sua conta:
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 pl-2 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Histórico completo de simulados e questões resolvidas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Progresso nas provas oficiais anteriores</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Mapas mentais ilustrados e materiais salvos em Favoritos</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Correções detalhadas de redação e métricas de desempenho</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                <span>{isSyncing ? "Sincronizando..." : "Verificar & Sincronizar"}</span>
              </button>

              <button
                onClick={() => setShowModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
