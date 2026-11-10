import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import QuestaoPage from './pages/QuestaoPage';
import MateriaisPage from './pages/MateriaisPage';
import Dashboard from './components/Dashboard';
import VideoPage from './pages/VideoPage';
import FavoritosPage from './pages/FavoritosPage';
import ProvasAnterioresPage from './pages/ProvasAnterioresPage';
import InteligenciaPreditivaPage from './pages/InteligenciaPreditivaPage';
import SuportePage from './pages/SuportePage';
import LoginPage from './pages/LoginPage';
import { AuthProvider, useAuth } from './lib/auth';
import { ConcursoProvider } from './lib/concursoContext';
import { ShieldCheck } from 'lucide-react';
import { BRAND_ASSETS } from './constants/brandAssets';
import LiquidLoader from './components/LiquidLoader';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <img src={BRAND_ASSETS.logoRA} alt="R. Alves Concursos" className="w-20 h-20 rounded-2xl object-cover border border-amber-500/40 shadow-2xl mb-5" />
        <LiquidLoader 
          text="Autenticando Sessão Segura" 
          subtext="Verificando credenciais e isolamento de dados..."
        />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex flex-col w-full min-w-0">
          <TopBar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/questoes" element={<QuestaoPage />} />
              <Route path="/materiais" element={<MateriaisPage />} />
              <Route path="/inteligencia-preditiva" element={<InteligenciaPreditivaPage />} />
              <Route path="/videos/:topic" element={<VideoPage />} />
              <Route path="/favoritos" element={<FavoritosPage />} />
              <Route path="/provas-anteriores" element={<ProvasAnterioresPage />} />
              <Route path="/suporte" element={<SuportePage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ConcursoProvider>
        <AppContent />
      </ConcursoProvider>
    </AuthProvider>
  );
}
