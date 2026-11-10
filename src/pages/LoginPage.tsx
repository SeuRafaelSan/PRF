import React, { useState } from 'react';
import { AlertCircle, ShieldCheck, KeyRound, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { BRAND_ASSETS } from '../constants/brandAssets';
import { CONCURSO } from '../concurso';

const REQUIRED_ACCESS_PIN = '3030';

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [accessPin, setAccessPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPinValid = accessPin.trim() === REQUIRED_ACCESS_PIN;

  const getFirebaseErrorMessage = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'O login com Google foi cancelado antes da conclusão.';
      case 'auth/popup-blocked':
        return 'O pop-up de login foi bloqueado pelo navegador. Permita pop-ups para este site.';
      case 'auth/unauthorized-domain':
        return 'Este domínio não está autorizado para autenticação Google no Firebase.';
      default:
        return err?.message || 'Ocorreu um erro ao processar o login com Google.';
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setPinError(null);

    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("[Login] Google login error:", err);
      setErrorMsg(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setAccessPin(val);
    if (pinError) setPinError(null);
    if (errorMsg) setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-100/80 bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-200/60 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-200/40 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-200/30 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-slate-300/50">
        
        {/* Logos Container */}
        <div className="flex justify-center items-center mb-6">
          <div className="relative group">
            <img 
              src={BRAND_ASSETS.logoRA} 
              alt="Logo R.ALVES Concursos" 
              className="w-20 h-20 rounded-3xl object-cover border border-slate-200 shadow-md group-hover:scale-105 transition-transform"
            />
          </div>
        </div>

        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[10px] font-black uppercase tracking-widest text-blue-900 mb-1.5">
            Autenticação Segura • Firebase Auth
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">
            Acesse sua Conta de Aluno
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Plataforma Preparatória R. Alves • {CONCURSO.shortTitle} ({CONCURSO.cargo})
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 mb-5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold animate-fadeIn">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {pinError && (
          <div className="flex items-start gap-2 p-3 mb-5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold animate-fadeIn">
            <Lock size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <span>{pinError}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="space-y-4 mb-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full font-bold text-sm py-4 px-6 rounded-2xl border bg-blue-950 hover:bg-blue-900 text-white border-blue-800 shadow-xl shadow-blue-950/30 ring-2 ring-blue-500/30 flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            <div className="bg-white p-1.5 rounded-xl shrink-0 shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <span className="uppercase font-extrabold tracking-wider text-xs sm:text-sm">
              {loading ? 'Conectando ao Google...' : 'Entrar com Conta Google'}
            </span>
          </button>
        </div>

        {/* Optional Code/PIN Field */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <KeyRound size={14} className="text-blue-600" />
              Código da Turma / PIN (Opcional)
            </label>
            {isPinValid && (
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} /> Validado
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={accessPin}
              onChange={handlePinChange}
              placeholder="Ex: 3030"
              className={`w-full text-center tracking-[0.35em] text-sm font-black py-2.5 px-4 rounded-xl border bg-white outline-none transition-all ${
                isPinValid 
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-700' 
                  : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800'
              }`}
            />
          </div>
          <p className="text-[10px] text-slate-500 font-medium text-center">
            {isPinValid 
              ? '✅ Código da turma ativado para personalização do plano.'
              : 'Clique acima para conectar diretamente com sua conta Google.'}
          </p>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400">
          <ShieldCheck size={14} className="text-emerald-500" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Dupla Autenticação • PIN Numérico + Google OAuth 2.0
          </p>
        </div>
      </div>
    </div>
  );
}
