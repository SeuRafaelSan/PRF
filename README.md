# Plataforma de Estudos R. Alves — base

Código único usado por todas as plataformas de concurso. Os dados do concurso ficam em
`concurso/` (pacote JSON); veja `../montador/README.md`.

## Rodar localmente

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha `GEMINI_API_KEY`, `OPENAI_API_KEY` e `YOUTUBE_API_KEY`.
3. `npm run dev` → http://localhost:3000

Verificações: `npm run lint` (TypeScript) e `npm run build` (produção em `dist/`).
