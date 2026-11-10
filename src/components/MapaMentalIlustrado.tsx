import React, { useState, useEffect } from "react";
import { Sparkles, Download, RefreshCw, AlertCircle, MessageCircle, Lock, ShieldCheck } from "lucide-react";
import { apiFetch } from "../lib/api";
import { addWatermarkToImage } from "../utils/watermark";

type Props = {
  titulo: string;
  conteudo: string;
  initialImage?: string | null;
  onImageGenerated?: (image: string) => void;
};

export default function MapaMentalIlustrado({
  titulo,
  conteudo,
  initialImage,
  onImageGenerated,
}: Props) {
  const [imagem, setImagem] = useState<string | null>(initialImage || null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  
  // Limite de 10 mapas mentais
  const [quotaUsed, setQuotaUsed] = useState<number>(0);
  const [quotaLimit, setQuotaLimit] = useState<number>(10);
  const [atingiuLimite, setAtingiuLimite] = useState(false);

  // Buscar cota atual ao carregar
  useEffect(() => {
    async function carregarCota() {
      try {
        const res = await apiFetch("/api/mapa-mental-quota");
        if (res.ok) {
          const data = await res.json();
          if (typeof data.used === "number") {
            setQuotaUsed(data.used);
            setQuotaLimit(data.limit || 10);
            if (data.used >= (data.limit || 10)) {
              setAtingiuLimite(true);
            }
          }
        }
      } catch (err) {
        console.warn("Não foi possível buscar cota de mapas mentais:", err);
      }
    }
    carregarCota();
  }, []);

  // Atualizar imagem quando initialImage mudar
  useEffect(() => {
    if (initialImage) {
      setImagem(initialImage);
    }
  }, [initialImage]);

  const whatsappUrl = "https://wa.me/5577998401073?text=Ol%C3%A1%20Prof.%20Rafael%20Alves!%20Atingi%20o%20limite%20de%2010%20mapas%20mentais%20e%20gostaria%20de%20informar%20ao%20suporte%20para%20adquirir%20cr%C3%A9ditos%20adicionais.";

  async function gerarMapaMental() {
    if (quotaUsed >= quotaLimit) {
      setAtingiuLimite(true);
      return;
    }

    try {
      setCarregando(true);
      setErro("");
      setImagem(null);

      const response = await apiFetch("/api/mapa-mental-gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titulo: titulo || "Mapa Mental",
          conteudo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.code === "MINDMAP_QUOTA_EXCEEDED" || response.status === 403) {
          setAtingiuLimite(true);
          setQuotaUsed(10);
          throw new Error(
            data?.error || "Você atingiu o limite de 10 mapas mentais gerados. Contate o Prof. Rafael Alves para liberação de créditos."
          );
        }
        throw new Error(
          data?.error || "Erro ao gerar o mapa mental."
        );
      }

      if (typeof data?.used === "number") {
        setQuotaUsed(data.used);
        if (data.used >= quotaLimit) {
          setAtingiuLimite(true);
        }
      } else {
        setQuotaUsed((prev) => {
          const nextVal = prev + 1;
          if (nextVal >= quotaLimit) setAtingiuLimite(true);
          return nextVal;
        });
      }

      if (!data?.image) {
        throw new Error(
          "A API não retornou uma imagem."
        );
      }

      // Adicionar logo oficial R. Alves e rodapé de contatos de alta resolução na imagem
      let imagemFinal = data.image;
      try {
        imagemFinal = await addWatermarkToImage(data.image, titulo);
      } catch (wErr) {
        console.warn("Falha ao aplicar rodapé de contato na imagem:", wErr);
      }

      setImagem(imagemFinal);
      if (onImageGenerated) {
        onImageGenerated(imagemFinal);
      }
    } catch (error: any) {
      console.error("ERRO AO GERAR MAPA MENTAL COM GEMINI:", error);

      setErro(
        error?.message ||
          "Erro ao gerar o mapa mental ilustrado."
      );
    } finally {
      setCarregando(false);
    }
  }

  function baixarImagem() {
    if (!imagem) return;

    const link = document.createElement("a");
    link.href = imagem;
    link.download = `mapa-mental-${titulo.toLowerCase().replace(/[^a-z0-9]/g, "-") || "estudo"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Barra de controle clean e minimalista */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
            Mapa Mental Ilustrado
          </span>
          <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded-md">
            R.ALVES CONCURSOS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge de cota com visualização de limite (ex: 3/10 mapas) */}
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
            quotaUsed >= quotaLimit
              ? "bg-amber-50 text-amber-800 border-amber-300"
              : "bg-slate-100/90 text-slate-600 border-slate-200"
          }`}>
            {quotaUsed >= quotaLimit ? (
              <Lock size={12} className="text-amber-600" />
            ) : (
              <Sparkles size={11} className="text-emerald-600" />
            )}
            <span>
              {quotaUsed}/{quotaLimit} gerados
            </span>
          </div>

          {imagem && (
            <button
              onClick={baixarImagem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Baixar imagem em PNG"
            >
              <Download size={13} className="text-slate-500" />
              <span>Baixar PNG</span>
            </button>
          )}

          <button
            onClick={gerarMapaMental}
            disabled={carregando || atingiuLimite}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              carregando
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : atingiuLimite
                ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                : imagem
                ? "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
            }`}
          >
            {carregando ? (
              <>
                <RefreshCw size={13} className="animate-spin text-slate-400" />
                <span>Gerando...</span>
              </>
            ) : atingiuLimite ? (
              <>
                <Lock size={13} className="text-amber-700" />
                <span>Limite Atingido</span>
              </>
            ) : imagem ? (
              <>
                <RefreshCw size={13} className="text-slate-500" />
                <span>Gerar Novamente</span>
              </>
            ) : (
              <>
                <Sparkles size={13} className="text-amber-400" />
                <span>Gerar Mapa Mental</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alerta de Limite de 10 Imagens Atingido com Botão de Pagamento e Contato com Prof. Rafael Alves */}
      {atingiuLimite && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-amber-500/10 border-b border-amber-200/80">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5 sm:mt-0">
                <Lock size={18} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-slate-900">
                  Limite de 10 mapas mentais gerados atingido ({quotaUsed}/{quotaLimit})
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para continuar gerando mapas mentais ilustrados com a identidade <strong>R.Alves Concursos</strong>, informe ao suporte do <strong>Prof. Rafael Alves</strong> para liberação de créditos adicionais.
                </p>
              </div>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageCircle size={14} />
              <span>Informar ao Suporte (WhatsApp)</span>
            </a>
          </div>
        </div>
      )}

      {/* Área da imagem ou estado vazio */}
      <div className="min-h-[420px] p-4 md:p-6 bg-slate-50/30 flex items-center justify-center">
        {carregando && (
          <div className="text-center py-16 space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-slate-200 border-t-slate-800 animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Criando mapa mental ilustrado com Gemini...</p>
              <p className="text-xs text-slate-400">Incluindo desenhos conceituais e a marca R.ALVES CONCURSOS</p>
            </div>
          </div>
        )}

        {!carregando && erro && (
          <div className="max-w-md w-full p-5 bg-rose-50/60 border border-rose-200/80 rounded-xl text-center space-y-3">
            <div className="w-8 h-8 mx-auto rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertCircle size={16} />
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">{erro}</p>
            <button
              onClick={gerarMapaMental}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Tentar Novamente</span>
            </button>
          </div>
        )}

        {!carregando && !erro && imagem && (
          <div className="w-full flex flex-col items-center gap-2">
            <img
              src={imagem}
              alt="Mapa mental ilustrado R.ALVES CONCURSOS"
              className="w-full max-w-[1536px] h-auto object-contain rounded-xl border border-slate-200/60 shadow-xs"
            />
          </div>
        )}

        {!carregando && !erro && !imagem && (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <Sparkles size={20} className="text-slate-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Nenhum mapa mental gerado ainda</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Clique no botão para gerar um mapa mental ilustrado com a identidade R.ALVES CONCURSOS.
              </p>
            </div>
            {atingiuLimite ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <MessageCircle size={14} />
                <span>Contatar Prof. Rafael Alves para Liberar Mapas</span>
              </a>
            ) : (
              <button
                onClick={gerarMapaMental}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <Sparkles size={13} className="text-amber-400" />
                <span>Gerar Mapa Mental</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
