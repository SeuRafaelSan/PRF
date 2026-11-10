// Compatibilidade: os dados do concurso agora vêm do pacote em /concurso (ver src/concurso).
import { CONCURSO } from '../concurso';
import type { ConcursoData } from '../concurso';

export type { ConcursoData, DisciplineCategory } from '../concurso';

export const CONCURSOS_LIST: ConcursoData[] = [CONCURSO];

export const DEFAULT_CONCURSO_ID = CONCURSO.id;

export function getConcursoById(id: string): ConcursoData {
  return CONCURSOS_LIST.find(c => c.id === id) || CONCURSOS_LIST[0];
}
