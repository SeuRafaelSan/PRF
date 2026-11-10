import React from 'react';
import { useAuth } from '../lib/auth';
import { useConcurso } from '../lib/concursoContext';
import ConcursoSwitcher from './ConcursoSwitcher';

export default function TopBar() {
  const { user } = useAuth();
  const { currentConcurso } = useConcurso();

  const displayName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Aluno');
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-end p-4 md:px-8 bg-white border-b border-slate-200 shadow-2xs select-none gap-3 flex-wrap sm:flex-nowrap">
      {/* Switcher & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <ConcursoSwitcher variant="topbar" />

        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="font-extrabold text-xs text-slate-900 capitalize truncate max-w-[130px]">Olá, {displayName}!</p>
            <p 
              className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block mt-0.5 truncate max-w-[180px]"
              style={{
                backgroundColor: currentConcurso.colorScheme.bgBadge,
                color: currentConcurso.colorScheme.primary,
                borderColor: currentConcurso.colorScheme.border
              }}
            >
              {currentConcurso.cargo}
            </p>
          </div>
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={displayName} 
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
                if (nextEl) nextEl.style.display = 'flex';
              }}
              className="w-9 h-9 rounded-xl border-2 border-blue-600/50 shadow-xs object-cover" 
            />
          ) : null}
          <div 
            className="w-9 h-9 rounded-xl border-2 border-blue-600/50 bg-slate-900 text-blue-300 font-black text-xs flex items-center justify-center shadow-xs"
            style={{ display: user?.photoURL ? 'none' : 'flex' }}
          >
            {userInitial}
          </div>
        </div>
      </div>
    </header>
  );
}
