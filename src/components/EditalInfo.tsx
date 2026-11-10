import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2 } from 'lucide-react';
import { useConcurso } from '../lib/concursoContext';
import { BRAND_ASSETS } from '../constants/brandAssets';

export default function EditalInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentConcurso } = useConcurso();

  const totalTopics = [...currentConcurso.edital.gerais, ...currentConcurso.edital.especificos]
    .reduce((acc, curr) => acc + curr.topics.length, 0);

  return (
    <section className="mt-8 select-none">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border"
              style={{
                backgroundColor: currentConcurso.colorScheme.bgBadge,
                color: currentConcurso.colorScheme.primary,
                borderColor: currentConcurso.colorScheme.border
              }}
            >
              {currentConcurso.tag}
            </span>
            <span className="text-xs font-bold text-slate-500">Banca {currentConcurso.banca}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800">
            Estrutura Oficial do Edital
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentConcurso.cargo} • {totalTopics} Objetos de conhecimento catalogados
          </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-5 text-left bg-slate-50 hover:bg-slate-100/75 transition-colors"
        >
          <div className="flex items-center gap-3">
            <img src={BRAND_ASSETS.iconsOutline.capelo} alt="" className="w-6 h-6 object-contain" />
            <div>
              <span className="font-black text-base md:text-lg text-slate-800 block">
                Conteúdo Programático Oficial — {currentConcurso.shortTitle}
              </span>
              <span className="text-xs text-slate-500">
                {currentConcurso.edital.gerais.length} Disciplinas Básicas • {currentConcurso.edital.especificos.length} Blocos Específicos
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>{isOpen ? "Ocultar Conteúdo" : "Ver Todos os Objetos"}</span>
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {isOpen && (
          <div className="p-6 bg-slate-50/30 border-t border-slate-100 animate-fadeIn">
            {/* Bloco Geral / Básico */}
            <div className="mb-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Conhecimentos Básicos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentConcurso.edital.gerais.map((item, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2.5 mb-3 border-b border-slate-100 pb-2 justify-between">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-900 p-1.5 rounded-lg shrink-0 border border-amber-500/30">
                          <img src={BRAND_ASSETS.iconsWhiteBg.documento} alt="" className="w-4 h-4 object-contain" />
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-800 truncate" title={item.title}>{item.title}</h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.topics.length} tópicos
                      </span>
                    </div>
                    <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed font-medium">
                      {item.topics.map((topic, i) => (
                        <li key={i} className="hover:text-slate-900 transition-colors">{topic}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Bloco Específico */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Conhecimentos Específicos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentConcurso.edital.especificos.map((item, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2.5 mb-3 border-b border-slate-100 pb-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="bg-slate-900 p-1.5 rounded-lg shrink-0 border border-blue-500/30">
                          <img src={BRAND_ASSETS.iconsWhiteBg.documento} alt="" className="w-4 h-4 object-contain" />
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-800 truncate" title={item.title}>{item.title}</h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                        {item.topics.length}
                      </span>
                    </div>
                    <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed font-medium">
                      {item.topics.map((topic, i) => (
                        <li key={i} className="hover:text-slate-900 transition-colors">{topic}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
