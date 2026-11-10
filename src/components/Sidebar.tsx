import { LayoutDashboard, BookText, Heart, Calendar, HelpCircle, Brain, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { BRAND_ASSETS } from '../constants/brandAssets';
import { useAuth } from '../lib/auth';
import ConcursoSwitcher from './ConcursoSwitcher';

const navItems = [
  { name: 'Início', icon: LayoutDashboard, brandIcon: BRAND_ASSETS.iconsOutline.dashboard, path: '/' },
  { name: 'Questões', icon: BookText, brandIcon: BRAND_ASSETS.iconsOutline.documento, path: '/questoes' },
  { name: 'Materiais', icon: BookText, brandIcon: BRAND_ASSETS.iconsOutline.documento, path: '/materiais' },
  { name: 'Inteligência Preditiva', icon: Brain, brandIcon: BRAND_ASSETS.iconsOutline.capelo, path: '/inteligencia-preditiva' },
  { name: 'Favoritos', icon: Heart, brandIcon: BRAND_ASSETS.iconsOutline.documento, path: '/favoritos' },
  { name: 'Provas Anteriores', icon: Calendar, brandIcon: BRAND_ASSETS.iconsOutline.capelo, path: '/provas-anteriores' },
  { name: 'Suporte', icon: HelpCircle, brandIcon: BRAND_ASSETS.iconsOutline.capelo, path: '/suporte' },
];

export default function Sidebar() {
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  return (
    <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 text-slate-400 flex flex-col min-h-screen p-4 select-none">
      <div className="p-2 mb-6 flex justify-center">
        <a href="https://www.instagram.com/r.alvesconcursos/" target="_blank" rel="noopener noreferrer" className="relative group block p-2">
          {/* Glowing Aura Background */}
          <div className="absolute inset-4 rounded-2xl bg-blue-900/30 blur-xl opacity-65 group-hover:opacity-85 transition-opacity duration-300"></div>
          
          {/* Logo Image RA */}
          <img 
            src={BRAND_ASSETS.logoRA} 
            alt="R. ALVES CONCURSOS" 
            referrerPolicy="no-referrer"
            className="relative z-10 w-44 h-44 rounded-2xl object-cover border border-slate-700 hover:scale-105 hover:border-blue-500/50 transition-all duration-300 shadow-md shadow-slate-950/20" 
          />
        </a>
      </div>
      <nav className="flex flex-row md:flex-col flex-wrap gap-1 md:space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.name} to={item.path} className={`flex items-center gap-2.5 p-2.5 rounded-xl transition-all ${isActive ? 'bg-blue-950/80 text-blue-300 border border-blue-700/50 font-bold' : 'hover:bg-slate-800 hover:text-white'}`}>
              <img src={item.brandIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
              <span className="text-xs md:text-sm font-semibold">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      


      <div className="mt-auto pt-4 space-y-3">
        <ConcursoSwitcher variant="sidebar" />
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-2.5 p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors w-full text-left"
        >
          <LogOut size={18} />
          <span className="text-sm font-semibold">Sair da Plataforma</span>
        </button>
      </div>
    </aside>
  );
}
