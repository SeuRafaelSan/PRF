// Ponto único de acesso ao pacote do concurso desta plataforma (pasta /concurso na raiz).
import concursoJson from '../../concurso/concurso.json';
import provasJson from '../../concurso/provas.json';
import questoesJson from '../../concurso/questoes.json';
import type { ConcursoData, PastExam, RealExamData } from './tipos';

export * from './tipos';

export const CONCURSO = concursoJson as unknown as ConcursoData;
export const PROVAS_ANTERIORES = provasJson as unknown as PastExam[];
export const QUESTOES_REAIS = questoesJson as unknown as RealExamData[];
