import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConcursoData, CONCURSOS_LIST, DEFAULT_CONCURSO_ID, getConcursoById } from '../data/concursosData';

interface ConcursoContextType {
  currentConcurso: ConcursoData;
  currentConcursoId: string;
  setConcurso: (id: string) => void;
  availableConcursos: ConcursoData[];
}

const ConcursoContext = createContext<ConcursoContextType | undefined>(undefined);

const STORAGE_KEY = 'r_alves_active_concurso_id';

export const ConcursoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [concursoId, setConcursoId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CONCURSOS_LIST.some(c => c.id === saved)) {
        return saved;
      }
      localStorage.setItem(STORAGE_KEY, DEFAULT_CONCURSO_ID);
    } catch (e) {
      console.warn('Erro ao ler concurso do localStorage:', e);
    }
    return DEFAULT_CONCURSO_ID;
  });

  const handleSetConcurso = (newId: string) => {
    setConcursoId(newId);
    try {
      localStorage.setItem(STORAGE_KEY, newId);
    } catch (e) {
      console.warn('Erro ao salvar concurso no localStorage:', e);
    }
  };

  const currentConcurso = getConcursoById(concursoId);

  return (
    <ConcursoContext.Provider
      value={{
        currentConcurso,
        currentConcursoId: concursoId,
        setConcurso: handleSetConcurso,
        availableConcursos: CONCURSOS_LIST,
      }}
    >
      {children}
    </ConcursoContext.Provider>
  );
};

export function useConcurso() {
  const context = useContext(ConcursoContext);
  if (!context) {
    throw new Error('useConcurso deve ser utilizado dentro de um ConcursoProvider');
  }
  return context;
}
