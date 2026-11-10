# Relatório – Plataforma PRF (Policial Rodoviário Federal)

Montada em 10/11/2026 com o montador, a partir da `plataforma-base` (mesma plataforma da PM-BA).

## Situação do edital
- **Não há edital novo da PRF publicado até 10/11/2026.** A plataforma usa o último edital e é **provisória**:
  Edital Concurso PRF nº 1, de 18/01/2021, com a retificação do Edital nº 2, de 26/01/2021 (Legislação de Trânsito e Direito Penal).
- Banca: Cebraspe. 1.500 vagas e subsídio de R$ 9.899,88 (dados de 2021).
- Prova objetiva: 120 itens Certo/Errado – Bloco I (55), Bloco II – Legislação de Trânsito (30), Bloco III (35).
  Cada erro anula um acerto; mínimos de 15, 10, 10 e 50 pontos. Discursiva de 20 pontos, até 30 linhas.

## Fontes (todas oficiais, site do Cebraspe; SHA-256 em `concurso/fontes.json`)
- Editais 2021: [abertura](https://cdn.cebraspe.org.br/concursos/PRF_21/arquivos/ED_1_PRF_2021_ABERTURA.PDF),
  [retificação nº 2](https://cdn.cebraspe.org.br/concursos/PRF_21/arquivos/ED_2_PRF_2021_RETIFICACAO.PDF),
  [nº 5](https://cdn.cebraspe.org.br/concursos/PRF_21/arquivos/ED_5_PRF_2021_REABERTURA.PDF),
  [nº 11 – resultado da objetiva](https://cdn.cebraspe.org.br/concursos/PRF_21/arquivos/ED_11_PRF_2021_FINAL_OBJETIVA_PROV_DISCURSIVA.PDF).
- Página do concurso: https://www.cebraspe.org.br/concursos/PRF_21
- PDFs guardados em `montador/pacotes/prf-policial/fontes/` (fora do Git da plataforma).

## Provas mapeadas (cadernos e gabaritos definitivos)
| Prova | Itens válidos | Anulados | No banco "Prova Real" |
|---|---|---|---|
| PRF 2021 (Cebraspe) | 110 | 10 | 89 |
| PRF 2019 (Cespe/Cebraspe) | 108 | 12 | 87 |
| PRF 2013 (Cespe/UnB) | 118 | 2 | 84 |
| Agente PF 2021 – cargo equivalente | 115 | 5 | 50 |
| Agente PF 2018 – cargo equivalente | 114 | 6 | 57 |
| **Total** | **565** | | **367** |

- A PRF só tem três provas no site do Cebraspe; as duas da PF completam as cinco (mesma banca e mesmo modelo).
- Todas as 600 questões estão no mapa (`fullQuestions`), classificadas por disciplina e objeto de conhecimento do edital.
- No banco entram só os itens do edital de 2021, com gabarito válido, sem depender de figura e válidos pela lei vigente.
  Comentários com base legal e jurisprudência, escritos para a plataforma.
- Ficaram fora do banco: itens de resoluções do CONTRAN revogadas/consolidadas após as provas, estatística, contabilidade,
  lógica proposicional e TI avançada da PF, e conteúdos do edital de 2013 que saíram do programa.

## Raio-X e simulador
- Incidência por disciplina e tópico calculada sobre os itens reais; probabilidades são estimativas de frequência histórica.
- 5 armadilhas medidas (ex.: 65% dos itens com termos absolutos tiveram gabarito ERRADO).
- Simulador: nota líquida por bloco; **nota de corte 73,00** = menor nota objetiva da ampla concorrência entre os
  classificados para a correção da discursiva em 2021 (Edital nº 11/2021).
- Discursiva: os dois temas oficiais (2021 e 2019), com os quesitos e pontos do caderno.

## Testes
- `node montador/validar-pacote.mjs concursos/prf-policial/concurso` → **APROVADO** (0 erros, 0 pendências).
- `npx tsc --noEmit` → OK. `npm run build` → OK. `npm run verificar-segredos` → nenhum segredo.
- `npm run dev` → tela de login exibe "Plataforma Preparatória R. Alves • PRF (Policial Rodoviário Federal)".

## Não testado / pendências
- `/api/generate-questions` e as páginas internas exigem login Google: o professor precisa entrar e conferir
  Provas Anteriores, Inteligência Preditiva, simulador e itens gerados pela IA. Falta criar `.env.local` com as chaves.
- Quando sair o novo edital: revisar conteúdo, quadro de provas, vagas, subsídio, lista de resoluções do CONTRAN e simulador.
- Nada foi publicado (hospedagem, link ou WhatsApp).
