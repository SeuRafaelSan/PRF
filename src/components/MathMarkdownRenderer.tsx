import React from 'react';
import katex from 'katex';

interface MathMarkdownRendererProps {
  text: string;
  className?: string;
}

// 1. SANITIZER LAYER: Fix malformed markdown, strip broken ASCII box drawings, and normalize syntax
function sanitizeRawMarkdown(raw: string): string {
  if (!raw) return '';

  let sanitized = raw;

  // Remove ASCII connector lines with multiple pluses, hyphens, and pipes (e.g. +-------+-------+, |-------|-------|)
  // but only if the line does NOT contain letters or numbers
  sanitized = sanitized.replace(/^[ \t]*[+|][-=.+*~| ]{3,}[+|]?[ \t]*$/gm, (match) => {
    // If it has any alphanumeric character, keep it (might be a table line)
    if (/[a-zA-Z0-9À-ÖØ-öø-ÿ]/.test(match)) return match;
    return '';
  });

  // Remove standalone pipe connector noise like "|", "| |", "| | |", "|||"
  sanitized = sanitized.replace(/^[ \t]*\|([ \t]*\|)*[ \t]*$/gm, '');

  // Remove standalone arrow lines like "▼", "▼ ▼", "▼ ▼ ▼", "▲", "↓", "↓ ↓"
  sanitized = sanitized.replace(/^[ \t]*[▼▲►◄➔←→↓↑vV\s|]{1,10}[ \t]*$/gm, (match) => {
    if (/[a-zA-Z0-9À-ÖØ-öø-ÿ]/.test(match)) return match;
    return '';
  });

  // Remove repetitive dashes/equals/dots
  sanitized = sanitized.replace(/^[ \t]*[-=.]{4,}[ \t]*$/gm, '');
  sanitized = sanitized.replace(/^[ \t]*\+{2,}[ \t]*$/gm, '');

  // Clean ASCII pseudo-arrows into clean Unicode symbols
  sanitized = sanitized.replace(/<[-=]+>/g, ' ⇄ ');
  sanitized = sanitized.replace(/[-=]+>/g, ' ➔ ');
  sanitized = sanitized.replace(/<[-=]+/g, ' ⬅ ');
  sanitized = sanitized.replace(/<-[ \t\n]*>/g, ' ⇄ ');

  // Fix malformed fraction syntax like C = {0,68 mg{0,68 m^3}} into C = \frac{0,68 mg}{0,68 m^3}
  sanitized = sanitized.replace(/(?<!\\frac)\{([^{}\\\n]+)\{([^{}\\\n]+)\}\}/g, '\\frac{$1}{$2}');

  // If a line or bullet contains a formula with \frac but lacks $, wrap in $...$
  sanitized = sanitized.replace(/(^|[\s(])([A-Za-z\Delta_]+\s*=\s*\\frac\{[^{}\n]+\}\{[^{}\n]+\}(?:\s*=\s*[^{}\n$]+)?)(?=$|[\s),.])/gm, '$1$$$2$$');

  // Fix malformed bold tags like: *Texto:** or **Texto* or *Passo 1: Identificação dos Dados:**
  sanitized = sanitized.replace(/(?:^|[\s])\*([^\*\n]+?):\*\*/g, ' **$1:** ');
  sanitized = sanitized.replace(/(?:^|[\s])\*([^\*\n]+?)\*\*(?!\*)/g, ' **$1** ');
  sanitized = sanitized.replace(/(?:^|[\s])\*\*([^\*\n]+?)\*(?!\*)/g, ' **$1** ');

  // Clean trailing or orphan asterisks on lines
  sanitized = sanitized.replace(/^[ \t]*\*[ \t]+([^\*\n]+)$/gm, '- $1');

  // Remove raw HTML tags and code symbols (e.g. <u>, </u>, <b>, </b>, <em>, </em>, etc.)
  sanitized = sanitized.replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<br\s*\/?>/gi, '\n');

  // Normalize multiple consecutive blank lines to double newline
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return sanitized;
}

// Helper to expand common risk matrix abbreviations
function expandTableAbbr(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  const map: Record<string, string> = {
    'Cr.': 'Crítico',
    'Cr': 'Crítico',
    'Al.': 'Alto',
    'Al': 'Alto',
    'Mé.': 'Médio',
    'Me.': 'Médio',
    'Mé': 'Médio',
    'Insignif': 'Insignificante',
    'Insignif.': 'Insignificante',
    'Desprez.': 'Desprezível',
    'Desp.': 'Desprezível',
    'Catastr.': 'Catastrófico',
    'Mod.': 'Moderado',
  };
  return map[trimmed] || trimmed;
}

// 2. FORMULA CLEANER & MOUNTED KATEX RENDERER: Renders true mathematical formulas (montadas)
function cleanLatexForKatex(rawExpr: string): string {
  if (!rawExpr) return '';
  let clean = rawExpr.trim();

  // Strip LaTeX delimiters: $$, $, \[, \], \(, \)
  clean = clean.replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '');
  clean = clean.replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '');
  clean = clean.replace(/^\\\(\s*/, '').replace(/\s*\\\)$/, '');
  clean = clean.replace(/^\$\s*/, '').replace(/\s*\$$/, '');
  clean = clean.trim();

  // Fix malformed fraction syntax like {A{B}} -> \frac{A}{B}
  clean = clean.replace(/(?<!\\frac)\{([^{}\\\n]+)\{([^{}\\\n]+)\}\}/g, '\\frac{$1}{$2}');

  // Convert lone % into \% so KaTeX doesn't treat it as a comment
  clean = clean.replace(/([^\\])%(?![\d])/g, '$1\\%');

  // Wrap accented Portuguese words in \text{} if not already escaped (e.g. Nível, Frequência)
  clean = clean.replace(/(?<![\\a-zA-Z])([A-Za-zÀ-ÖØ-öø-ÿ]*[À-ÖØ-öø-ÿ]+[A-Za-zÀ-ÖØ-öø-ÿ]*)/g, '\\text{$1}');

  return clean;
}

function formatFormulaCleanly(rawExpr: string): string {
  let clean = cleanLatexForKatex(rawExpr);

  // Strip LaTeX font commands
  clean = clean.replace(/\\text(?:bf|rm|it)?\{([^}]+)\}/g, '$1');
  clean = clean.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  clean = clean.replace(/\\mathbf\{([^}]+)\}/g, '$1');

  // Replace math operators with clean Unicode symbols
  clean = clean.replace(/\\times/g, ' × ');
  clean = clean.replace(/\\cdot/g, ' · ');
  clean = clean.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  clean = clean.replace(/\\approx/g, ' ≈ ');
  clean = clean.replace(/\\(?:le|leq)/g, ' ≤ ').replace(/\\(?:ge|geq)/g, ' ≥ ');
  clean = clean.replace(/\\pm/g, ' ± ');
  clean = clean.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)');
  clean = clean.replace(/\\[a-zA-Z]+/g, ' ').replace(/\\/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

function renderLatex(expression: string, displayMode: boolean = false): string {
  try {
    const cleaned = cleanLatexForKatex(expression);
    if (!cleaned) return '';

    // Render as a fully mounted KaTeX mathematical formula
    const rendered = katex.renderToString(cleaned, {
      displayMode,
      throwOnError: false,
      output: 'html',
      strict: false,
    });

    // If KaTeX rendered without error, return the mounted formula HTML
    if (!rendered.includes('katex-error')) {
      return rendered;
    }

    // Auto-recovery attempt: wrap multi-letter words in \text{}
    try {
      const recoveredExpr = cleaned.replace(/\b([a-zA-ZÀ-ÖØ-öø-ÿ]{3,})\b/g, (m) => {
        if (['frac', 'mathbf', 'text', 'times', 'cdot', 'Delta', 'sqrt', 'approx'].includes(m)) return m;
        return `\\text{${m}}`;
      });
      const recovery = katex.renderToString(recoveredExpr, {
        displayMode,
        throwOnError: false,
        output: 'html',
        strict: false,
      });
      if (!recovery.includes('katex-error')) {
        return recovery;
      }
    } catch {
      // ignore
    }

    // Never output red error text! Return high-contrast clean typography
    return `<span class="inline-flex items-center font-bold text-slate-900 tracking-wide ${displayMode ? 'text-base md:text-lg' : 'text-sm md:text-base'}">${formatFormulaCleanly(cleaned)}</span>`;
  } catch (err) {
    console.warn('KaTeX rendering fallback:', err);
    return `<span class="inline-flex items-center font-bold text-slate-900 tracking-wide text-base">${formatFormulaCleanly(expression)}</span>`;
  }
}

// 3. INLINE TEXT FORMATTER: Bold words, inline math ($...$ or \(...\)), and plain text
function renderFormattedInlineText(content: string) {
  if (!content) return null;

  // Capture LaTeX blocks ($$...$$ or \[...\]), inline math ($...$ or \(...\)), and bold text (**...**)
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\([^\n]+?\\\)|(?:\*\*[^\*\n]+?\*\*))/g;
  const parts = content.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Display math embedded inside inline text
    if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
      const html = renderLatex(part, true);
      return (
        <span
          key={`math-disp-${index}`}
          className="my-3 block overflow-x-auto text-center py-2.5 px-4 bg-slate-50/90 rounded-2xl border border-slate-200 shadow-xs"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Inline math: $...$ or \(...\)
    if (
      (part.startsWith('$') && part.endsWith('$') && part.length > 2) ||
      (part.startsWith('\\(') && part.endsWith('\\)'))
    ) {
      const html = renderLatex(part, false);
      return (
        <span
          key={`math-inl-${index}`}
          className="inline-block px-1 align-baseline text-slate-900 font-semibold"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Bold text: **...** (Sanitize inner text so asterisks don't leak)
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2).replace(/\*/g, '');
      return (
        <strong key={`bold-${index}`} className="font-extrabold text-slate-900 bg-amber-50/70 px-1.5 py-0.5 rounded-md">
          {inner}
        </strong>
      );
    }

    // Clean any stray asterisks, orphan pipes, or HTML code tags from plain text
    const cleanPlain = part
      .replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '');
    return <React.Fragment key={`text-${index}`}>{cleanPlain}</React.Fragment>;
  });
}

// 4. CALLOUT BLOCK TYPES
type CalloutType = 'conceito' | 'como-cai' | 'pegadinha' | 'dica' | 'exemplo' | 'guarde';

interface CalloutConfig {
  type: CalloutType;
  title: string;
  badgeBg: string;
  badgeText: string;
  cardBg: string;
  borderColor: string;
  textColor: string;
}

const CALLOUT_CONFIGS: Record<CalloutType, CalloutConfig> = {
  'conceito': {
    type: 'conceito',
    title: '📌 CONCEITO ESSENCIAL',
    badgeBg: 'bg-slate-900',
    badgeText: 'text-white',
    cardBg: 'bg-slate-50/90',
    borderColor: 'border-slate-300',
    textColor: 'text-slate-900',
  },
  'como-cai': {
    type: 'como-cai',
    title: '🎯 COMO CAI NA PROVA',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    cardBg: 'bg-amber-50/70',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-950',
  },
  'pegadinha': {
    type: 'pegadinha',
    title: '⚠️ ATENÇÃO À PEGADINHA',
    badgeBg: 'bg-rose-600',
    badgeText: 'text-white',
    cardBg: 'bg-rose-50/60',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-950',
  },
  'dica': {
    type: 'dica',
    title: '💡 DICA R.ALVES',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    cardBg: 'bg-blue-50/70',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-950',
  },
  'exemplo': {
    type: 'exemplo',
    title: '🧮 EXEMPLO PRÁTICO / CASO REAL',
    badgeBg: 'bg-indigo-600',
    badgeText: 'text-white',
    cardBg: 'bg-indigo-50/50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-950',
  },
  'guarde': {
    type: 'guarde',
    title: '✅ GUARDE ISTO',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    cardBg: 'bg-emerald-50/70',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-950',
  },
};

function matchCalloutHeader(trimmedLine: string): { type: CalloutType; remainder: string } | null {
  const lineNoMd = trimmedLine.replace(/\*\*/g, '').replace(/[\#\>]/g, '').trim();

  if (/^(?:📌|\[📌\])?\s*(?:CONCEITO\s*ESSENCIAL|O\s*QUE\s*VOCÊ\s*PRECISA\s*SABER):?/i.test(lineNoMd)) {
    const rem = lineNoMd.replace(/^(?:📌|\[📌\])?\s*(?:CONCEITO\s*ESSENCIAL|O\s*QUE\s*VOCÊ\s*PRECISA\s*SABER):?\s*/i, '');
    return { type: 'conceito', remainder: rem };
  }
  if (/^(?:🎯|\[🎯\])?\s*(?:COMO\s*CAI\s*NA\s*PROVA|PADRÃO\s*DE\s*PROVA|COMO\s*A\s*BANCA\s*COBRA):?/i.test(lineNoMd)) {
    const rem = lineNoMd.replace(/^(?:🎯|\[🎯\])?\s*(?:COMO\s*CAI\s*NA\s*PROVA|PADRÃO\s*DE\s*PROVA|COMO\s*A\s*BANCA\s*COBRA):?\s*/i, '');
    return { type: 'como-cai', remainder: rem };
  }
  if (/^(?:⚠️|\[⚠️\])?\s*(?:ATENÇÃO\s*À\s*PEGADINHA|ATENÇÃO\s*PEGADINHA|PEGADINHA\s*DE\s*PROVA|CUIDADO|ALERTA\s*DE\s*PROVA):?/i.test(lineNoMd)) {
    const rem = lineNoMd.replace(/^(?:⚠️|\[⚠️\])?\s*(?:ATENÇÃO\s*À\s*PEGADINHA|ATENÇÃO\s*PEGADINHA|PEGADINHA\s*DE\s*PROVA|CUIDADO|ALERTA\s*DE\s*PROVA):?\s*/i, '');
    return { type: 'pegadinha', remainder: rem };
  }
  if (/^(?:💡|\[💡\])?\s*(?:DICA\s*R\.ALVES|DICA\s*RALVES|DICA\s*DO\s*PROFESSOR|BIZU\s*R\.ALVES|BIZU\s*DE\s*PROVA):?/i.test(lineNoMd)) {
    const rem = lineNoMd.replace(/^(?:💡|\[💡\])?\s*(?:DICA\s*R\.ALVES|DICA\s*RALVES|DICA\s*DO\s*PROFESSOR|BIZU\s*R\.ALVES|BIZU\s*DE\s*PROVA):?\s*/i, '');
    return { type: 'dica', remainder: rem };
  }
  if (/^(?:🧮|\[🧮\])?\s*(?:EXEMPLO\s*PRÁTICO|CASO\s*REAL|EXEMPLO\s*RESOLVIDO|RESOLUÇÃO\s*PASSO\s*A\s*PASSO|EXERCÍCIO\s*RESOLVIDO):?/i.test(lineNoMd)) {
    const rem = lineNoMd.replace(/^(?:🧮|\[🧮\])?\s*(?:EXEMPLO\s*PRÁTICO|CASO\s*REAL|EXEMPLO\s*RESOLVIDO|RESOLUÇÃO\s*PASSO\s*A\s*PASSO|EXERCÍCIO\s*RESOLVIDO):?\s*/i, '');
    return { type: 'exemplo', remainder: rem };
  }
  if (/^(?:✅|\[✅\])?\s*(?:GUARDE\s*ISTO|GARDE\s*ISTO|MEMORIZE|SÍNTESE\s*FINAL|RESUMO\s*DE\s*FIXAÇÃO):?/i.test(lineNoMd)) {
    const rem = lineNoMd.replace(/^(?:✅|\[✅\])?\s*(?:GUARDE\s*ISTO|GARDE\s*ISTO|MEMORIZE|SÍNTESE\s*FINAL|RESUMO\s*DE\s*FIXAÇÃO):?\s*/i, '');
    return { type: 'guarde', remainder: rem };
  }

  return null;
}

// Helper to render table cell content with automated severity badges and clean typography
function renderTableCellContent(cell: string) {
  const trimmed = cell.trim();
  const lower = trimmed.toLowerCase();

  // Check for risk matrix ratings
  if (lower === 'crítico' || lower.startsWith('crítico')) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 shadow-xs">
        {trimmed}
      </span>
    );
  }
  if (lower === 'alto' || lower.startsWith('alto')) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
        {trimmed}
      </span>
    );
  }
  if (lower === 'médio' || lower.startsWith('médio')) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-xs">
        {trimmed}
      </span>
    );
  }
  if (lower === 'baixo' || lower.startsWith('baixo')) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
        {trimmed}
      </span>
    );
  }
  if (lower === 'insignificante' || lower === 'desprezível' || lower === 'leve') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {trimmed}
      </span>
    );
  }
  if (lower === 'catastrófico' || lower === 'moderado') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black text-slate-900 bg-slate-100 border border-slate-300">
        {trimmed}
      </span>
    );
  }

  return renderFormattedInlineText(cell);
}

export default function MathMarkdownRenderer({ text, className = '' }: MathMarkdownRendererProps) {
  if (!text) return null;

  const sanitizedText = sanitizeRawMarkdown(text);
  const lines = sanitizedText.split('\n');
  const elements: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Standalone LaTeX block ($$ or \[)
    if (trimmed === '\\[' || trimmed === '$$' || trimmed.startsWith('\\[') || trimmed.startsWith('$$')) {
      const closesSameLine =
        (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length > 4) ||
        (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4);

      if (closesSameLine) {
        elements.push({
          type: 'math-block',
          formula: trimmed,
          key: `mb-${i}`,
        });
        i++;
        continue;
      }

      const mathLines: string[] = [];
      if (trimmed !== '\\[' && trimmed !== '$$') {
        mathLines.push(trimmed.replace(/^\\\[/, '').replace(/^\$\$/, ''));
      }
      i++;
      while (i < lines.length) {
        const nextTrim = lines[i].trim();
        if (nextTrim === '\\]' || nextTrim === '$$' || nextTrim.endsWith('\\]') || nextTrim.endsWith('$$')) {
          if (nextTrim !== '\\]' && nextTrim !== '$$') {
            mathLines.push(nextTrim.replace(/\\\]$/, '').replace(/\$\$$/, ''));
          }
          i++;
          break;
        }
        mathLines.push(lines[i]);
        i++;
      }

      elements.push({
        type: 'math-block',
        formula: mathLines.join('\n'),
        key: `mb-multi-${i}`,
      });
      continue;
    }

    // 2. Standardized Pedagogical Callout Blocks (📌 CONCEITO, 🎯 COMO CAI NA PROVA, etc.)
    const calloutMatch = matchCalloutHeader(trimmed);
    if (calloutMatch) {
      const { type, remainder } = calloutMatch;
      const bodyLines: string[] = [];
      if (remainder) bodyLines.push(remainder);

      i++;
      // Collect succeeding lines that belong to this block until empty line or next heading
      while (i < lines.length) {
        const nextTrim = lines[i].trim();
        if (nextTrim === '' || nextTrim.startsWith('#') || matchCalloutHeader(nextTrim)) {
          break;
        }
        bodyLines.push(lines[i]);
        i++;
      }

      elements.push({
        type: 'callout',
        calloutType: type,
        content: bodyLines.join('\n'),
        key: `callout-${i}`,
      });
      continue;
    }

    // 3. Step Highlights in Problem Resolution
    const stepMatch = trimmed.match(
      /^(\*{0,2}(?:Passo\s*\d+|Etapa\s*\d+|\d+[ºª°]?\s*Passo|\d+\.\s+[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,35}|Identificação\s*dos\s*Dados|Dados|Fórmula|Substituição|Cálculo|Resolução|Resposta|Conclusão):?\*{0,2})\s*(.*)$/i
    );
    if (stepMatch && !trimmed.startsWith('-') && !trimmed.startsWith('*') && !trimmed.startsWith('#')) {
      const rawBadge = stepMatch[1].replace(/\*\*/g, '').replace(/[:]/g, '').trim();
      const content = stepMatch[2].trim();

      if (
        /^(?:Passo\s*\d+|Etapa\s*\d+|\d+[ºª°]?\s*Passo|Identificação\s*dos\s*Dados|Dados|Fórmula|Substituição|Cálculo|Resolução|Resposta|Conclusão)/i.test(
          rawBadge
        ) ||
        /^\d+\.\s+(?:Identifique|Substitua|Calcule|Encontre|Aplique|Monte|Determine)/i.test(rawBadge)
      ) {
        elements.push({
          type: 'step-card',
          badge: rawBadge,
          content: content,
          key: `step-${i}`,
        });
        i++;
        continue;
      }
    }

    // 4. Universal Markdown & ASCII Grid Table Parser
    // Matches standard markdown tables, ASCII grid tables with +---+ borders, and raw delimited rows
    const isTableCandidate = (line: string) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith('|') && t.endsWith('|') && t.includes('|')) return true;
      if (t.startsWith('+') && t.endsWith('+') && /^[+=\-\s\.\:~|]+$/.test(t)) return true;
      if (t.startsWith('|') && /^[+=\-\s\.\:~|]+$/.test(t)) return true;
      return false;
    };

    const isPureBorder = (line: string) => {
      const t = line.trim();
      return /^[+=\-\s\.\:~|]+$/.test(t) && !/[a-zA-Z0-9À-ÖØ-öø-ÿ]/.test(t);
    };

    if (isTableCandidate(trimmed)) {
      const rawTableLines: string[] = [];
      const startIndex = i;
      while (i < lines.length && isTableCandidate(lines[i])) {
        rawTableLines.push(lines[i].trim());
        i++;
      }

      // Filter out pure border lines like +----+----+ or |:---|:---|
      const contentRows = rawTableLines.filter((l) => !isPureBorder(l) && l.startsWith('|') && l.endsWith('|'));

      if (contentRows.length >= 1) {
        const parsedRows = contentRows.map((row) => {
          return row
            .split('|')
            .slice(1, -1)
            .map((c) => expandTableAbbr(c.trim()));
        }).filter((r) => r.length >= 2);

        if (parsedRows.length >= 1) {
          const firstRow = parsedRows[0];
          const firstCell = (firstRow[0] || '').toLowerCase();
          const isDataFirst = /^(?:catastrófico|crítico|moderado|leve|desprezível|insignificante|\d+[\.\-\)]?|[a-e][\.\-\)])$/i.test(
            firstCell
          );

          let headers: string[] = [];
          let bodyRows: string[][] = [];

          if (isDataFirst || parsedRows.length === 1) {
            const colCount = firstRow.length;
            if (colCount === 6) {
              headers = ['Severidade / Impacto', 'P1 (Muito Baixa)', 'P2 (Baixa)', 'P3 (Média)', 'P4 (Alta)', 'P5 (Muito Alta)'];
            } else if (colCount === 5) {
              headers = ['Severidade / Impacto', 'P1 (Baixa)', 'P2 (Média)', 'P3 (Alta)', 'P4 (Muito Alta)'];
            } else {
              headers = ['Classificação / Parâmetro', ...Array.from({ length: colCount - 1 }, (_, idx) => `Nível ${idx + 1}`)];
            }
            bodyRows = parsedRows;
          } else {
            headers = firstRow;
            bodyRows = parsedRows.slice(1);
          }

          if (headers.length >= 2 && bodyRows.length > 0) {
            elements.push({
              type: 'table',
              headers,
              rows: bodyRows,
              key: `table-${startIndex}`,
            });
            continue;
          }
        }
      }
    }

    // 4.5. Multi-node Diagram Row (e.g. "[Riscos Ambientais] [Riscos Ergonômicos] [Riscos de Acidentes]")
    const multiNodeMatch = trimmed.match(/^\[([^\]]+)\](?:\s*\[([^\]]+)\])+$/);
    if (multiNodeMatch) {
      const nodes = Array.from(trimmed.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1].trim());
      if (nodes.length >= 2) {
        elements.push({
          type: 'node-grid',
          nodes,
          key: `nodes-${i}`,
        });
        i++;
        continue;
      }
    }

    // 4.6. Standalone Major System / Concept Header (e.g. "[ GERENCIAMENTO DE RISCOS OCUPACIONAIS - GRO ]")
    const singleMajorNode = trimmed.match(/^\[\s*([A-Za-z0-9À-ÖØ-öø-ÿ\s\(\)\-\:\/]{5,100})\s*\]$/);
    if (singleMajorNode) {
      elements.push({
        type: 'major-node',
        title: singleMajorNode[1].trim(),
        key: `mnode-${i}`,
      });
      i++;
      continue;
    }

    // 5. Headings with R.Alves Editorial Typography
    if (trimmed.startsWith('###')) {
      elements.push({
        type: 'h3',
        content: trimmed.replace(/^###\s*/, '').replace(/\*\*/g, ''),
        key: `h3-${i}`,
      });
      i++;
      continue;
    }
    if (trimmed.startsWith('##')) {
      elements.push({
        type: 'h2',
        content: trimmed.replace(/^##\s*/, '').replace(/\*\*/g, ''),
        key: `h2-${i}`,
      });
      i++;
      continue;
    }
    if (trimmed.startsWith('#')) {
      elements.push({
        type: 'h1',
        content: trimmed.replace(/^#\s*/, '').replace(/\*\*/g, ''),
        key: `h1-${i}`,
      });
      i++;
      continue;
    }

    // 6. Unordered Lists
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      elements.push({
        type: 'li',
        content: trimmed.replace(/^[-*]\s*/, ''),
        key: `li-${i}`,
      });
      i++;
      continue;
    }

    // 7. Numbered Lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push({
        type: 'num-li',
        number: numMatch[1],
        content: numMatch[2],
        key: `num-${i}`,
      });
      i++;
      continue;
    }

    // 8. Empty line spacing
    if (trimmed === '') {
      elements.push({ type: 'space', key: `sp-${i}` });
      i++;
      continue;
    }

    // 9. Standard Paragraph
    elements.push({
      type: 'p',
      content: trimmed,
      key: `p-${i}`,
    });
    i++;
  }

  return (
    <article className={`space-y-4 text-slate-800 leading-relaxed font-sans ${className}`}>
      {elements.map((el) => {
        // Render Math Blocks
        if (el.type === 'math-block') {
          const html = renderLatex(el.formula, true);
          return (
            <div
              key={el.key}
              className="my-5 py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 shadow-xs overflow-x-auto flex flex-col items-center justify-center text-slate-900"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100/90 text-blue-900 border border-blue-200">
                  📐 FÓRMULA TÉCNICA
                </span>
              </div>
              <div
                className="w-full text-center text-base md:text-lg font-bold text-slate-900 overflow-x-auto py-1"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          );
        }

        // Render Multi-node Diagram Row (Flowchart Grid)
        if (el.type === 'node-grid') {
          return (
            <div key={el.key} className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
              {el.nodes.map((node: string, ni: number) => (
                <div
                  key={ni}
                  className="p-3 bg-blue-50/80 border border-blue-200/90 rounded-xl text-center shadow-xs flex items-center justify-center"
                >
                  <span className="font-bold text-xs md:text-sm text-blue-950">
                    {renderFormattedInlineText(node)}
                  </span>
                </div>
              ))}
            </div>
          );
        }

        // Render Major System Concept Node (Flowchart Header)
        if (el.type === 'major-node') {
          return (
            <div
              key={el.key}
              className="my-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white font-black text-center text-sm md:text-base tracking-wide shadow-md border border-slate-800 flex items-center justify-center"
            >
              <span>{renderFormattedInlineText(el.title)}</span>
            </div>
          );
        }

        // Render Standardized Pedagogical Callout Cards
        if (el.type === 'callout') {
          const config = CALLOUT_CONFIGS[el.calloutType as CalloutType] || CALLOUT_CONFIGS['conceito'];
          return (
            <div
              key={el.key}
              className={`my-5 p-4 md:p-5 rounded-2xl border ${config.cardBg} ${config.borderColor} shadow-xs transition-all`}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${config.badgeBg} ${config.badgeText} shadow-xs`}
                >
                  {config.title}
                </span>
              </div>
              <div className={`text-sm md:text-[15.5px] ${config.textColor} leading-relaxed font-normal whitespace-pre-line`}>
                {renderFormattedInlineText(el.content)}
              </div>
            </div>
          );
        }

        // Render Step Cards (Problem Resolution / Math Steps)
        if (el.type === 'step-card') {
          return (
            <div
              key={el.key}
              className="my-3.5 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition-all"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                  {el.badge}
                </span>
              </div>
              {el.content && (
                <div className="text-sm md:text-[15px] text-slate-700 font-medium pl-1 leading-relaxed">
                  {renderFormattedInlineText(el.content)}
                </div>
              )}
            </div>
          );
        }

        // Editorial Headings
        if (el.type === 'h1') {
          return (
            <h2
              key={el.key}
              className="text-xl md:text-2xl font-black text-slate-900 mt-8 mb-4 border-b-2 border-slate-200 pb-2.5 tracking-tight flex items-center gap-2"
            >
              <span>{renderFormattedInlineText(el.content)}</span>
            </h2>
          );
        }
        if (el.type === 'h2') {
          return (
            <h3
              key={el.key}
              className="text-lg md:text-xl font-extrabold text-slate-900 mt-6 mb-2 border-l-4 border-blue-600 pl-3 tracking-tight"
            >
              {renderFormattedInlineText(el.content)}
            </h3>
          );
        }
        if (el.type === 'h3') {
          return (
            <h4
              key={el.key}
              className="text-base font-bold text-slate-900 mt-4 mb-1.5 border-l-4 border-amber-500 pl-3"
            >
              {renderFormattedInlineText(el.content)}
            </h4>
          );
        }

        // Unordered Lists
        if (el.type === 'li') {
          return (
            <ul key={el.key} className="list-disc pl-6 space-y-1.5 my-1.5">
              <li className="text-sm md:text-[15.5px] text-slate-700 leading-relaxed">
                {renderFormattedInlineText(el.content)}
              </li>
            </ul>
          );
        }

        // Numbered Lists
        if (el.type === 'num-li') {
          return (
            <div key={el.key} className="flex items-start gap-3 pl-1 my-2 text-sm md:text-[15.5px]">
              <span className="shrink-0 w-6 h-6 rounded-full bg-slate-100 border border-slate-300 text-slate-900 font-black text-xs flex items-center justify-center">
                {el.number}
              </span>
              <div className="flex-1 text-slate-700 leading-relaxed">
                {renderFormattedInlineText(el.content)}
              </div>
            </div>
          );
        }

        // Spacing
        if (el.type === 'space') {
          return <div key={el.key} className="h-1.5" />;
        }

        // Tables
        if (el.type === 'table') {
          return (
            <div key={el.key} className="overflow-x-auto my-6 rounded-2xl border border-slate-200 shadow-sm bg-white">
              <table className="min-w-full text-left border-collapse text-sm">
                <thead className="bg-slate-900 text-white font-bold text-xs uppercase tracking-wider">
                  <tr>
                    {el.headers.map((h: string, hi: number) => (
                      <th key={hi} className="px-4 py-3.5 border-b border-slate-800 whitespace-nowrap">
                        {renderFormattedInlineText(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {el.rows.map((row: string[], ri: number) => (
                    <tr
                      key={ri}
                      className={
                        ri % 2 === 0 ? 'bg-white hover:bg-slate-50/80 transition-colors' : 'bg-slate-50/60 hover:bg-slate-100/80 transition-colors'
                      }
                    >
                      {row.map((cell: string, ci: number) => (
                        <td key={ci} className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                          {renderTableCellContent(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Paragraph
        return (
          <p key={el.key} className="text-sm md:text-[15.5px] text-slate-700 leading-relaxed font-normal">
            {renderFormattedInlineText(el.content)}
          </p>
        );
      })}
    </article>
  );
}
