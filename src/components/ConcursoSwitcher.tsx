import React, { useState } from 'react';
import { Landmark, ChevronDown } from 'lucide-react';
import { useConcurso } from '../lib/concursoContext';

interface ConcursoSwitcherProps {
  variant?: 'button' | 'topbar' | 'sidebar' | 'inline-card';
}

export default function ConcursoSwitcher({ variant = 'topbar' }: ConcursoSwitcherProps) {
  const { currentConcurso, currentConcursoId, setConcurso, availableConcursos } = useConcurso();
  const [isOpen, setIsOpen] = useState(false);

  const getConcursoIcon = (_id: string, className = "w-5 h-5") => {
    return <Landmark className={className} />;
  };

  if (variant === 'sidebar') {
    return (
      <div className="relative">
        <div 
          className="p-3.5 bg-slate-800/90 rounded-2xl border border-slate-700/70 mb-4 select-none shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Concurso Foco
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50">
              {currentConcurso.plataforma.siglaCurta}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-100 mb-1 leading-snug">
            {currentConcurso.cargo}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span>Banca:</span>
            <strong className="text-slate-200">{currentConcurso.banca}</strong>
            <span className="text-slate-500">•</span>
            <span>{currentConcurso.ano}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* TopBar Pill */}
      {variant === 'topbar' && (
        <div className="relative">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 border-slate-200 text-left shadow-2xs select-none"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
              style={{ backgroundColor: currentConcurso.colorScheme.primary }}
            >
              {getConcursoIcon(currentConcursoId, "w-4 h-4")}
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                  {currentConcurso.shortTitle}
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-teal-50 text-teal-800 border border-teal-200/80">
                  Edital 2026
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium truncate max-w-[140px] md:max-w-[200px]">
                {currentConcurso.cargo}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inline Dashboard Card (Edital info banner, no change button) */}
      {variant === 'inline-card' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md"
              style={{ backgroundColor: currentConcurso.colorScheme.primary }}
            >
              {getConcursoIcon(currentConcursoId, "w-6 h-6")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {currentConcurso.fullName}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-extrabold bg-teal-50 text-teal-800 border border-teal-200/80">
                  Edital Oficial
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Banca oficial: <strong className="text-slate-700">{currentConcurso.banca}</strong> • Ano: <strong className="text-slate-700">{currentConcurso.ano}</strong> • Edital: <strong className="text-slate-700">{currentConcurso.editalCode}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
