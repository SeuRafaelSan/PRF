import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Preenche título/descrição do index.html (aba, WhatsApp, redes sociais) com o pacote do concurso.
function concursoHtml(): Plugin {
  return {
    name: 'concurso-html',
    transformIndexHtml(html) {
      const c = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'concurso/concurso.json'), 'utf8'));
      const esc = (t: string) => String(t ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return html
        .replaceAll('%CONCURSO_TITULO%', esc(c.plataforma.titulo))
        .replaceAll('%CONCURSO_DESCRICAO%', esc(c.plataforma.descricao))
        .replaceAll('%CONCURSO_SIGLA%', esc(c.plataforma.siglaCurta));
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), concursoHtml()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
