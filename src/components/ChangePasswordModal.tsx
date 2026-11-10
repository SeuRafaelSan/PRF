import React, { useState } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { user } = useAuth();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user || !user.email) {
      setError('Nenhum usuário autenticado encontrado.');
      return;
    }

    if (!currentPass || !newPass || !confirmPass) {
      setError('Preencha todos os campos.');
      return;
    }

    if (newPass !== confirmPass) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    if (newPass.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // Re-authenticate user before updating sensitive credential
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);

      // Update password on Firebase Auth
      await updatePassword(user, newPass);

      setSuccess('Senha individual alterada com sucesso no Firebase Authentication!');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 2500);

    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err);
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setError('A senha atual informada está incorreta.');
      } else if (err?.code === 'auth/weak-password') {
        setError('A nova senha é muito fraca. Use pelo menos 6 caracteres com números ou símbolos.');
      } else {
        setError(err?.message || 'Falha ao atualizar a senha. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-scaleIn">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl">
            <KeyRound size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">Alterar Senha da Conta</h3>
            <p className="text-xs text-slate-500">Atualize sua credencial no Firebase Auth</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 mb-5 flex items-start gap-2.5">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 leading-relaxed font-medium">
            <strong>Isolamento de Segurança:</strong> A nova senha é criptografada e vinculada exclusivamente à sua conta ({user?.email || 'Aluno'}).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Senha Atual
            </label>
            <input
              type="password"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              placeholder="Digite sua senha atual"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nova Senha
            </label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
