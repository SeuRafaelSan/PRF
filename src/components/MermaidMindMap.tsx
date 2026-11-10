import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Download, Maximize2, Minimize2, X, AlertTriangle, Sparkles, Check, RefreshCw } from 'lucide-react';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  look: 'handDrawn',
  securityLevel: 'loose',
  mindmap: {
    padding: 24,
    useMaxWidth: true,
  },
  themeVariables: {
    fontFamily: '"Caveat", "Patrick Hand", "Kalam", "Comic Sans MS", cursive, sans-serif',
    fontSize: '18px',
    primaryColor: '#fef08a',
    primaryTextColor: '#0f172a',
    primaryBorderColor: '#ca8a04',
    lineColor: '#2563eb',
    secondaryColor: '#e0e7ff',
    tertiaryColor: '#fce7f3',
    nodeBorder: '#475569',
    clusterBkg: '#f8fafc',
  },
});

interface MermaidMindMapProps {
  code: string;
  themeTitle?: string;
  subthemeTitle?: string;
  onRegenerate?: () => void;
  isGenerating?: boolean;
}

export default function MermaidMindMap({
  code,
  themeTitle,
  subthemeTitle,
  onRegenerate,
  isGenerating
}: MermaidMindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      if (!code) return;
      try {
        setRenderError(null);
        const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(uniqueId, code);
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err: any) {
        console.error("Mermaid render error:", err);
        if (isMounted) {
          setRenderError("Não foi possível renderizar o mapa visualmente. Tente gerar novamente.");
        }
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [code]);

  const handleDownloadPng = (targetRef: React.RefObject<HTMLDivElement | null>) => {
    if (!targetRef.current) return;
    const svgEl = targetRef.current.querySelector('svg');
    if (!svgEl) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const bbox = svgEl.getBoundingClientRect();
        const width = Math.max(1200, (svgEl.viewBox?.baseVal?.width || bbox.width || 1000) * 2);
        const height = Math.max(800, (svgEl.viewBox?.baseVal?.height || bbox.height || 700) * 2);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill paper background
          ctx.fillStyle = '#fffdf7';
          ctx.fillRect(0, 0, width, height);

          // Draw subtle grid/line pattern on canvas for paper feel
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 0; y < height; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Draw diagram image
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const pngUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = pngUrl;
              a.download = `Mapa_Mental_${(subthemeTitle || 'Material').replace(/[/\\?%*:|"<>\s]/g, '_')}.png`;
              a.click();
              URL.revokeObjectURL(pngUrl);
              setDownloadSuccess(true);
              setTimeout(() => setDownloadSuccess(false), 3000);
            }
          }, 'image/png');
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (err) {
      console.error("Failed to convert SVG to PNG:", err);
    }
  };

  return (
    <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl text-white flex flex-col gap-6 animate-scaleIn">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-purple-300 bg-purple-950/80 border border-purple-800 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles size={12} className="text-yellow-300" />
              MAPA MENTAL ILUSTRADO • GEMINI
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-extrabold text-white mt-2">
            {subthemeTitle || themeTitle || "Mapa Mental de Estudo"}
          </h3>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
              <span>Refazer</span>
            </button>
          )}

          <button
            onClick={() => handleDownloadPng(containerRef)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow"
          >
            {downloadSuccess ? <Check size={14} className="text-green-300" /> : <Download size={14} />}
            <span>{downloadSuccess ? "Baixado!" : "Baixar em PNG"}</span>
          </button>

          <button
            onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow"
          >
            <Maximize2 size={14} />
            <span>Tela Cheia</span>
          </button>
        </div>
      </div>

      {/* MERMAID DIAGRAM CONTAINER WITH PAPER SHEET NOTEBOOK AESTHETIC */}
      {renderError ? (
        <div className="p-6 bg-slate-950 border border-red-900/50 rounded-2xl text-center flex flex-col items-center gap-3">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="text-sm font-semibold text-red-300">{renderError}</p>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition"
            >
              Tentar Novamente
            </button>
          )}
        </div>
      ) : (
        <div className="relative group">
          {/* Decorative Tape on Top of Paper */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-amber-200/60 backdrop-blur-sm border border-amber-300/60 rotate-[-1deg] shadow-sm z-10 rounded-sm" />

          <div 
            ref={containerRef}
            className="bg-[#fffdf7] text-slate-900 p-6 md:p-10 rounded-3xl border-2 border-slate-300 shadow-2xl overflow-x-auto flex justify-center items-center min-h-[400px] relative font-['Caveat',cursive]"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px), radial-gradient(#cbd5e1 1.2px, #fffdf7 1.2px)',
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0, 12px 12px'
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      )}

      {/* FULLSCREEN MODAL */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[500] flex flex-col p-4 md:p-6 text-white animate-scaleIn">
          {/* TOP BAR */}
          <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase text-purple-300 bg-purple-950 border border-purple-800 px-3 py-1 rounded-full">
                TELA CHEIA • MAPA ILUSTRADO
              </span>
              <h4 className="text-base font-extrabold text-white hidden sm:block">
                {subthemeTitle || themeTitle}
              </h4>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownloadPng(fullscreenRef)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow"
              >
                {downloadSuccess ? <Check size={14} className="text-green-300" /> : <Download size={14} />}
                <span>Baixar PNG</span>
              </button>

              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-1 text-xs font-bold"
              >
                <X size={18} />
                <span className="hidden sm:inline">Fechar</span>
              </button>
            </div>
          </div>

          {/* MAIN DIAGRAM DISPLAY IN FULLSCREEN */}
          <div className="flex-1 bg-[#fffdf7] text-slate-900 rounded-2xl p-6 md:p-10 overflow-auto flex justify-center items-center shadow-2xl relative border-4 border-slate-300"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px), radial-gradient(#cbd5e1 1.2px, #fffdf7 1.2px)',
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0, 12px 12px'
            }}
          >
            <div
              ref={fullscreenRef}
              className="w-full flex justify-center items-center"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
