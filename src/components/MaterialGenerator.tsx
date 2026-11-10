import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  FileText, 
  ChevronDown, 
  Sparkles, 
  Download, 
  ArrowLeft, 
  AlertTriangle,
  CheckCircle2,
  Play,
  Bookmark,
  Star,
  ListTodo,
  Clock,
  ThumbsUp,
  Info,
  RefreshCw,
  Maximize2,
  X,
  Search,
  ExternalLink
} from 'lucide-react';
import { useConcurso } from '../lib/concursoContext';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserId } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { BRAND_ASSETS } from '../constants/brandAssets';
import MapaMentalIlustrado from './MapaMentalIlustrado';
import BookmarkButton from './BookmarkButton';
import { addWatermarkToImage, compressImageForStorage } from '../utils/watermark';
import LiquidLoader from './LiquidLoader';

// Helper for custom checklist items based on selected material and hours
export const getCustomChecklistItems = (theme: string, subtheme: string, h: number) => {
  const cleanSubtheme = subtheme || "Tópico Selecionado";
  const cleanTheme = theme || "Disciplina";
  switch (h) {
    case 1:
      return [
        { label: `Leitura rápida do resumo teórico sobre ${cleanSubtheme} (${cleanTheme})`, duration: "25 min" },
        { label: `Assistir à videoaula recomendada de ${cleanSubtheme}`, duration: "15 min" },
        { label: `Resolver 5 a 10 questões de concurso sobre ${cleanSubtheme}`, duration: "15 min" },
        { label: `Revisar bizus e pegadinhas de prova de ${cleanSubtheme}`, duration: "5 min" }
      ];
    case 3:
      return [
        { label: `Estudo detalhado do resumo esquematizado de ${cleanSubtheme} (${cleanTheme})`, duration: "60 min" },
        { label: `Assistir a videoaulas com anotações de tópicos importantes de ${cleanSubtheme}`, duration: "45 min" },
        { label: `Leitura comentada da Legislação Seca e jurisprudência sobre ${cleanSubtheme}`, duration: "25 min" },
        { label: `Resolução intensiva de 15 questões focadas em ${cleanSubtheme}`, duration: "35 min" },
        { label: `Criar mnemônicos e fichamento de revisão de ${cleanSubtheme}`, duration: "15 min" }
      ];
    case 4:
      return [
        { label: `Estudo teórico aprofundado e minucioso de ${cleanSubtheme} (${cleanTheme})`, duration: "80 min" },
        { label: `Assistir a 2 videoaulas selecionadas do YouTube sobre ${cleanSubtheme}`, duration: "60 min" },
        { label: `Análise detalhada da lei seca aplicável a ${cleanSubtheme}`, duration: "30 min" },
        { label: `Simulado focado de 25 questões gabaritadas de ${cleanSubtheme}`, duration: "50 min" },
        { label: `Revisão ativa de erros e montagem de mapa mental de ${cleanSubtheme}`, duration: "20 min" }
      ];
    case 2:
    default:
      return [
        { label: `Leitura focada do resumo teórico de ${cleanSubtheme} (${cleanTheme})`, duration: "40 min" },
        { label: `Assistir à melhor videoaula sobre ${cleanSubtheme} com foco no edital`, duration: "30 min" },
        { label: `Resolver de 10 a 15 questões objetivas de ${cleanSubtheme}`, duration: "35 min" },
        { label: `Mapear pegadinhas frequentes de banca sobre ${cleanSubtheme}`, duration: "15 min" }
      ];
  }
};

import MathMarkdownRenderer from './MathMarkdownRenderer';

export default function MaterialGenerator() {
  const { currentConcurso, currentConcursoId } = useConcurso();
  const allDisciplines = [...currentConcurso.edital.gerais, ...currentConcurso.edital.especificos];

  const [theme, setTheme] = useState(allDisciplines[0]?.title || 'Língua Portuguesa');
  const [subtheme, setSubtheme] = useState(allDisciplines[0]?.topics[0] || 'Geral');

  // Sincroniza tema e subtema quando o concurso selecionado mudar
  useEffect(() => {
    const activeDisciplines = [...currentConcurso.edital.gerais, ...currentConcurso.edital.especificos];
    const exists = activeDisciplines.find(d => d.title === theme);
    if (!exists) {
      const firstDisc = activeDisciplines[0];
      if (firstDisc) {
        setTheme(firstDisc.title);
        setSubtheme(firstDisc.topics[0] || 'Geral');
      }
    }
  }, [currentConcursoId, currentConcurso]);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [hours, setHours] = useState<number>(2);
  const [material, setMaterial] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state variables for Checklist and Saved Videos
  const [completedTasks, setCompletedTasks] = useState<boolean[]>([]);
  const [savedVideosIds, setSavedVideosIds] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState(false);

  // State variables for central overlay player & material persistence
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string; channel: string } | null>(null);
  const [isMaterialSaved, setIsMaterialSaved] = useState(false);
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);
  const [videoSearchQuery, setVideoSearchQuery] = useState<string>('');

  // Mind map quota state (Limit = 10)
  const MINDMAP_LIMIT = 10;
  const [mindmapQuotaCount, setMindmapQuotaCount] = useState<number>(() => {
    const saved = localStorage.getItem('user_mindmap_quota_count');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showQuotaLimitModal, setShowQuotaLimitModal] = useState(false);

  // Mind map states (Part 1, Part 2, and Single)
  const [mindmap1Url, setMindmap1Url] = useState<string | null>(null);
  const [mindmap2Url, setMindmap2Url] = useState<string | null>(null);
  const [mindmapImageUrl, setMindmapImageUrl] = useState<string | null>(null);
  const [mindmap1Mermaid, setMindmap1Mermaid] = useState<string | null>(null);
  const [mindmap2Mermaid, setMindmap2Mermaid] = useState<string | null>(null);
  const [mindmapMermaid, setMindmapMermaid] = useState<string | null>(null);
  const [activeMindmapTab, setActiveMindmapTab] = useState<'parte1' | 'parte2' | 'unica'>('parte1');
  
  const [isGeneratingMindmap, setIsGeneratingMindmap] = useState(false);
  const [generatingStatusText, setGeneratingStatusText] = useState<string>("Gerando Mapa Mental...");
  const [mindmapError, setMindmapError] = useState<string | null>(null);
  const [showAmpliarModal, setShowAmpliarModal] = useState(false);
  
  const [isMindmapSaved, setIsMindmapSaved] = useState(false);
  const [isSavingMindmap, setIsSavingMindmap] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Helper to increment mind map usage quota persistently in Firestore & localStorage
  const incrementMindmapQuota = async (amount = 1) => {
    setMindmapQuotaCount(prev => {
      const next = prev + amount;
      localStorage.setItem('user_mindmap_quota_count', next.toString());
      if (userId) {
        const docRef = doc(db, 'users', userId, 'quota', 'mindmaps');
        setDoc(docRef, {
          count: next,
          maxLimit: MINDMAP_LIMIT,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.error("Error saving quota to Firestore:", err));
      }
      return next;
    });
  };

  const handleGenerateMindMap = async (partTarget: 'parte1' | 'parte2' | 'ambas' | 'unica' = 'ambas') => {
    if (!material) return;
    
    // Check if user has reached the 20 mind maps limit
    if (mindmapQuotaCount >= MINDMAP_LIMIT) {
      setShowQuotaLimitModal(true);
      return;
    }

    setIsGeneratingMindmap(true);
    setMindmapError(null);
    setIsMindmapSaved(false);

    try {
      if (partTarget === 'parte1') {
        setGeneratingStatusText("Gerando Parte 1 (Fundamentos & Conceitos Chave)...");
        const res1 = await apiFetch("/api/generate-mindmap-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo: material, part: "parte1" }),
        });
        if (!res1.ok) {
          const err = await res1.json();
          throw new Error(err.error || "Erro ao gerar a Parte 1");
        }
        const d1 = await res1.json();
        setMindmap1Url(d1.imageUrl);
        setMindmapImageUrl(d1.imageUrl);
        setMindmap1Mermaid(d1.mermaidCode);
        setMindmapMermaid(d1.mermaidCode);
        setActiveMindmapTab('parte1');
        await incrementMindmapQuota(1);
        setSuccessMsg("🎨 Parte 1 do Mapa Mental gerada com sucesso!");
      } else if (partTarget === 'parte2') {
        setGeneratingStatusText("Gerando Parte 2 (Aplicações Práticas & Procedimentos)...");
        const res2 = await apiFetch("/api/generate-mindmap-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo: material, part: "parte2" }),
        });
        if (!res2.ok) {
          const err = await res2.json();
          throw new Error(err.error || "Erro ao gerar a Parte 2");
        }
        const d2 = await res2.json();
        setMindmap2Url(d2.imageUrl);
        setMindmapImageUrl(d2.imageUrl);
        setMindmap2Mermaid(d2.mermaidCode);
        setMindmapMermaid(d2.mermaidCode);
        setActiveMindmapTab('parte2');
        await incrementMindmapQuota(1);
        setSuccessMsg("🎨 Parte 2 do Mapa Mental gerada com sucesso!");
      } else if (partTarget === 'ambas') {
        // Gerar Parte 1
        setGeneratingStatusText("Passo 1/2: Gerando Mapa Mental (Parte 1 - Fundamentos)...");
        const res1 = await apiFetch("/api/generate-mindmap-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo: material, part: "parte1" }),
        });
        if (!res1.ok) {
          const err = await res1.json();
          throw new Error(err.error || "Erro ao gerar a Parte 1 do mapa mental");
        }
        const d1 = await res1.json();
        setMindmap1Url(d1.imageUrl);
        setMindmap1Mermaid(d1.mermaidCode);

        // Gerar Parte 2
        setGeneratingStatusText("Passo 2/2: Gerando Mapa Mental (Parte 2 - Aplicação Prática)...");
        const res2 = await apiFetch("/api/generate-mindmap-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo: material, part: "parte2" }),
        });
        if (!res2.ok) {
          const err = await res2.json();
          throw new Error(err.error || "Erro ao gerar a Parte 2 do mapa mental");
        }
        const d2 = await res2.json();
        setMindmap2Url(d2.imageUrl);
        setMindmap2Mermaid(d2.mermaidCode);
        
        setMindmapImageUrl(d1.imageUrl);
        setMindmapMermaid(d1.mermaidCode);
        setActiveMindmapTab('parte1');
        await incrementMindmapQuota(1);
        setSuccessMsg("✨ Mapas Mentais (Parte 1 e Parte 2) gerados com sucesso!");
      } else {
        setGeneratingStatusText("Gerando Mapa Mental Ilustrado...");
        const res = await apiFetch("/api/generate-mindmap-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo: material, part: "unica" }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erro ao gerar o mapa mental");
        }
        const d = await res.json();
        setMindmapImageUrl(d.imageUrl);
        setMindmapMermaid(d.mermaidCode);
        await incrementMindmapQuota(1);
        setSuccessMsg("🎨 Mapa mental ilustrado criado com sucesso!");
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Mindmap image generation error:", err);
      setMindmapError(err.message || "Ocorreu um erro ao gerar os mapas mentais.");
    } finally {
      setIsGeneratingMindmap(false);
    }
  };

  const currentDisplayImage = activeMindmapTab === 'parte1'
    ? (mindmap1Url || mindmapImageUrl)
    : activeMindmapTab === 'parte2'
    ? (mindmap2Url || mindmapImageUrl)
    : mindmapImageUrl;

  const currentDisplayMermaid = activeMindmapTab === 'parte1'
    ? (mindmap1Mermaid || mindmapMermaid)
    : activeMindmapTab === 'parte2'
    ? (mindmap2Mermaid || mindmapMermaid)
    : mindmapMermaid;

  const handleDownloadImagePng = async () => {
    if (!currentDisplayImage) return;
    setIsDownloading(true);
    try {
      const partTag = activeMindmapTab === 'parte1' ? 'Parte_1' : activeMindmapTab === 'parte2' ? 'Parte_2' : 'Completo';
      const titleLabel = `${subtheme || theme} (${partTag.replace('_', ' ')})`;
      const watermarkedUrl = await addWatermarkToImage(currentDisplayImage, titleLabel);
      
      const a = document.createElement('a');
      a.href = watermarkedUrl;
      a.download = `Mapa_Mental_${partTag}_${(subtheme || theme || currentConcurso.shortTitle).replace(/[/\\?%*:|"<>\s]/g, '_')}.png`;
      a.click();
    } catch (err) {
      console.error("Download error:", err);
      // Fallback direct download
      const a = document.createElement('a');
      a.href = currentDisplayImage;
      a.download = `Mapa_Mental_${(subtheme || theme || currentConcurso.shortTitle).replace(/[/\\?%*:|"<>\s]/g, '_')}.png`;
      a.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveMindmap = async () => {
    if (!userId || !currentDisplayImage) return;
    setIsSavingMindmap(true);
    const partTag = activeMindmapTab === 'parte1' ? 'parte1' : activeMindmapTab === 'parte2' ? 'parte2' : 'unica';
    const mindmapId = `${sanitizeId(theme)}_${sanitizeId(subtheme)}_${hours}_${partTag}`;
    try {
      const partLabel = activeMindmapTab === 'parte1' ? 'Parte 1 (Fundamentos)' : activeMindmapTab === 'parte2' ? 'Parte 2 (Aplicação)' : 'Único';
      const titleLabel = `${subtheme || theme} - ${partLabel}`;

      let watermarkedUrl = currentDisplayImage;
      try {
        watermarkedUrl = await addWatermarkToImage(currentDisplayImage, titleLabel);
      } catch (wmErr) {
        console.warn("Watermarking failed, proceeding with direct image:", wmErr);
      }

      // Compress to high-quality JPEG to ensure document size stays well under Firestore 1MB limit
      const finalStorageUrl = await compressImageForStorage(watermarkedUrl, 1200, 0.78);

      await setDoc(doc(db, 'users', userId, 'saved_mindmaps', mindmapId), {
        mindmapId,
        theme,
        subtheme: `${subtheme || theme} [${partLabel}]`,
        hours,
        imageUrl: finalStorageUrl,
        savedAt: new Date().toISOString()
      });
      setIsMindmapSaved(true);
      setSuccessMsg(`💾 Mapa mental (${partLabel}) salvo no sistema! Acesse em Favoritos a qualquer momento.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error saving mindmap:", err);
      setSuccessMsg(`Erro ao salvar o mapa mental: ${err?.message || 'Erro de persistência.'}`);
    } finally {
      setIsSavingMindmap(false);
    }
  };

  const userId = useUserId();

  const sanitizeId = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');

  const selectedThemeData = allDisciplines.find(d => d.title === theme);

  // Load study material if passed from favorites/saved history
  useEffect(() => {
    const loaded = localStorage.getItem('ralves_last_loaded_material');
    if (loaded) {
      try {
        const parsed = JSON.parse(loaded);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.subtheme) setSubtheme(parsed.subtheme);
        if (parsed.hours) setHours(parsed.hours);
        if (parsed.content) {
          setMaterial(parsed.content);
        } else {
          // If only metadata was saved, trigger generation
          setTimeout(() => {
            handleGenerate();
          }, 300);
        }
      } catch (err) {
        console.error("Error loading saved material:", err);
      } finally {
        localStorage.removeItem('ralves_last_loaded_material');
      }
    }
  }, []);

  // Load checklist progress & saved videos list
  useEffect(() => {
    if (!userId || !material) return;

    const checklistId = `${sanitizeId(theme)}_${sanitizeId(subtheme)}_${hours}`;
    
    const fetchChecklistAndVideos = async () => {
      try {
        // Fetch Checklist state
        const checklistRef = doc(db, 'users', userId, 'checklists', checklistId);
        const checklistSnap = await getDoc(checklistRef);
        
        const items = getCustomChecklistItems(theme, subtheme, hours);
        if (checklistSnap.exists()) {
          const savedData = checklistSnap.data().completed || [];
          const completedState = items.map((_, idx) => savedData[idx] || false);
          setCompletedTasks(completedState);
        } else {
          setCompletedTasks(new Array(items.length).fill(false));
        }

        // Fetch Saved Videos
        const savedVideosRef = collection(db, 'users', userId, 'saved_videos');
        const savedVideosSnap = await getDocs(savedVideosRef);
        const ids = savedVideosSnap.docs.map(doc => doc.id);
        setSavedVideosIds(ids);
      } catch (err) {
        console.error("Error loading saved data:", err);
      }
    };

    fetchChecklistAndVideos();
  }, [userId, material, hours, theme, subtheme]);

  // Check if current study material is saved in Firestore
  useEffect(() => {
    if (!userId || !material) {
      setIsMaterialSaved(false);
      return;
    }
    const materialId = `${sanitizeId(theme)}_${sanitizeId(subtheme)}_${hours}`;
    const checkSaved = async () => {
      try {
        const docRef = doc(db, 'users', userId, 'saved_materials', materialId);
        const snap = await getDoc(docRef);
        setIsMaterialSaved(snap.exists());
      } catch (err) {
        console.error("Error checking saved material:", err);
      }
    };
    checkSaved();
  }, [userId, material, theme, subtheme, hours]);

  // Check if current mind map is saved in Firestore
  useEffect(() => {
    if (!userId || !mindmapImageUrl) {
      setIsMindmapSaved(false);
      return;
    }
    const partTag = activeMindmapTab === 'parte1' ? 'parte1' : activeMindmapTab === 'parte2' ? 'parte2' : 'unica';
    const mindmapId = `${sanitizeId(theme)}_${sanitizeId(subtheme)}_${hours}_${partTag}`;
    const checkSavedMindmap = async () => {
      try {
        const docRef = doc(db, 'users', userId, 'saved_mindmaps', mindmapId);
        const snap = await getDoc(docRef);
        setIsMindmapSaved(snap.exists());
      } catch (err) {
        console.error("Error checking saved mindmap:", err);
      }
    };
    checkSavedMindmap();
  }, [userId, mindmapImageUrl, theme, subtheme, hours, activeMindmapTab]);

  // Load mind map usage quota from Firestore
  useEffect(() => {
    if (!userId) return;
    const fetchQuota = async () => {
      try {
        const docRef = doc(db, 'users', userId, 'quota', 'mindmaps');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.count === 'number') {
            setMindmapQuotaCount(data.count);
            localStorage.setItem('user_mindmap_quota_count', data.count.toString());
          }
        }
      } catch (err) {
        console.error("Error loading mindmap quota from Firestore:", err);
      }
    };
    fetchQuota();
  }, [userId]);

  // Toggle checklist tasks
  const handleToggleTask = async (index: number) => {
    const updated = [...completedTasks];
    updated[index] = !updated[index];
    setCompletedTasks(updated);

    if (!userId) return;
    const checklistId = `${sanitizeId(theme)}_${sanitizeId(subtheme)}_${hours}`;
    try {
      await setDoc(doc(db, 'users', userId, 'checklists', checklistId), {
        theme,
        subtheme,
        hours,
        completed: updated,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error saving checklist item:", err);
    }
  };

  // Save progress stats (adds +1 Day of Study & +1 Video Lessons)
  const handleSaveToStats = async () => {
    if (!userId) {
      setSuccessMsg("Usuário não identificado.");
      return;
    }
    setSavingProgress(true);
    try {
      const statsRef = doc(db, 'users', userId, 'stats', 'main');
      const docSnap = await getDoc(statsRef);
      let currentStats = {
        videoLessons: 0,
        simulations: 0,
        questions: 0,
        performance: 0,
        studyDays: 0
      };
      if (docSnap.exists()) {
        currentStats = docSnap.data() as any;
      }
      
      const updatedStats = {
        ...currentStats,
        studyDays: (currentStats.studyDays || 0) + 1,
        videoLessons: (currentStats.videoLessons || 0) + 1
      };
      
      await setDoc(statsRef, updatedStats);
      setSuccessMsg("✅ Estudo computado com sucesso! +1 Dia de Estudo e +1 Videoaula assistida salvos no seu painel geral.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Error updating stats:", err);
      setSuccessMsg("Erro ao salvar progresso.");
    } finally {
      setSavingProgress(false);
    }
  };

  // Toggle video saved status in Firestore
  const handleToggleSaveVideo = async (vid: any) => {
    if (!userId) {
      setSuccessMsg("⚠️ Por favor, faça login para salvar vídeo.");
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }
    const isEmbeddable = vid.id && vid.id.videoId;
    const videoId = isEmbeddable ? vid.id.videoId : (vid.snippet?.title ? sanitizeId(vid.snippet.title) : "");

    if (!videoId) {
      setSuccessMsg("⚠️ Não foi possível identificar o ID do vídeo.");
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }
    
    const isSaved = savedVideosIds.includes(videoId);
    const videoRef = doc(db, 'users', userId, 'saved_videos', videoId);

    try {
      if (isSaved) {
        await deleteDoc(videoRef);
        setSavedVideosIds(prev => prev.filter(id => id !== videoId));
        setSuccessMsg("❌ Vídeo removido dos salvos.");
      } else {
        await setDoc(videoRef, {
          videoId,
          title: vid.snippet?.title || "Videoaula complementar",
          channelTitle: vid.snippet?.channelTitle || "YouTube",
          thumbnail: vid.snippet?.thumbnails?.medium?.url || vid.snippet?.thumbnails?.default?.url || "",
          searchUrl: vid.snippet?.searchUrl || "",
          theme: theme || "Geral",
          subtheme: subtheme || "Geral",
          savedAt: new Date().toISOString()
        });
        setSavedVideosIds(prev => [...prev, videoId]);
        setSuccessMsg("⭐️ Vídeo salvo nos seus favoritos de estudo!");
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error("Error saving video:", err);
      setSuccessMsg(`Erro ao salvar vídeo: ${err?.message || "Erro de permissão."}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Play video centrally inside our platform (without auto-saving to stats)
  const handlePlayVideo = (vid: any) => {
    const isEmbeddable = vid.id && vid.id.videoId;
    const videoId = isEmbeddable ? vid.id.videoId : "";
    if (!videoId) return;

    setPlayingVideo({
      videoId,
      title: vid.snippet?.title || "Videoaula complementar",
      channel: vid.snippet?.channelTitle || "YouTube"
    });
  };

  // Save current material to Firestore
  const handleSaveMaterial = async () => {
    if (!userId) {
      setSuccessMsg("⚠️ Por favor, faça login para salvar o material.");
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }
    if (!material) {
      setSuccessMsg("⚠️ Nenhum material gerado para salvar.");
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }
    setIsSavingMaterial(true);
    const materialId = `${sanitizeId(theme || "geral")}_${sanitizeId(subtheme || "geral")}_${hours || 1}`;
    try {
      await setDoc(doc(db, 'users', userId, 'saved_materials', materialId), {
        materialId,
        theme: theme || "Geral",
        subtheme: subtheme || "Geral",
        hours: hours || 1,
        content: material,
        savedAt: new Date().toISOString()
      });
      setIsMaterialSaved(true);
      setSuccessMsg("✅ Material de estudo salvo no sistema! Você pode consultá-lo a qualquer momento na página de Favoritos.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error saving material:", err);
      setSuccessMsg(`Erro ao salvar material: ${err?.message || "Erro de persistência no banco."}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } finally {
      setIsSavingMaterial(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setMaterial(null);
    setVideos([]);
    setActiveVideoId(null);

    try {
      const res = await apiFetch('/api/generate-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          theme, 
          subtheme, 
          hours,
          concurso: currentConcurso.id,
          cargo: currentConcurso.cargo,
          banca: currentConcurso.banca,
          editalCode: currentConcurso.editalCode
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Falha ao gerar material de estudo. Tente novamente.');
      }
      
      if (data.content) {
        setMaterial(data.content);
        
        const initialQuery = subtheme || theme || 'Geral';
        setVideoSearchQuery(initialQuery);
        
        // Fetch videos in background so it doesn't block loading the material text
        setLoadingVideos(true);
        apiFetch(`/api/videos?query=${encodeURIComponent(initialQuery)}`)
          .then(vRes => vRes.json())
          .then(vData => {
            if (Array.isArray(vData)) {
              setVideos(vData);
            }
          })
          .catch(vErr => console.error("Error fetching videos:", vErr))
          .finally(() => setLoadingVideos(false));
      } else {
        throw new Error('Não foi possível carregar o conteúdo.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      {!material ? (
        <>
          <div className="mb-6 border-b border-slate-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
                <BookOpen className="text-indigo-600" size={26} />
                Gerador de Materiais de Estudo
              </h2>
              <p className="text-sm text-slate-500 mt-1">Gere resumos, mementos e conteúdos personalizados de acordo com o último edital.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 select-none">Disciplina</label>
              <select 
                className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition cursor-pointer"
                value={theme}
                onChange={(e) => {
                    const selectedDiscipline = e.target.value;
                    setTheme(selectedDiscipline);
                    const firstTopic = allDisciplines.find(d => d.title === selectedDiscipline)?.topics[0] || '';
                    setSubtheme(firstTopic);
                }}
              >
                {allDisciplines.map(d => <option key={d.title} value={d.title} className="cursor-pointer">{d.title}</option>)}
              </select>
            </div>
            
            <div className="relative w-full text-slate-700" ref={dropdownRef}>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 select-none">Tópico</label>
              <button 
                type="button"
                className="w-full p-3 border border-slate-200 rounded-xl text-sm text-left flex justify-between items-center bg-slate-50 hover:bg-slate-100/50 transition truncate text-slate-700 cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
              >
                <span className="truncate mr-2 font-medium text-slate-700 select-none">{subtheme}</span>
                <ChevronDown size={16} className="text-slate-400 shrink-0" />
              </button>
              {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto py-1">
                  {selectedThemeData?.topics.map(t => (
                    <button
                        key={t}
                        type="button"
                        className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0 cursor-pointer ${subtheme === t ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600'}`}
                        onClick={() => {
                            setSubtheme(t);
                            setIsOpen(false);
                        }}
                    >
                        {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 select-none">Tempo Disponível de Estudo</label>
              <select 
                className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition font-semibold text-slate-700 cursor-pointer"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              >
                <option value={1} className="cursor-pointer">1 Hora (Resumo Prático)</option>
                <option value={2} className="cursor-pointer">2 Horas (Foco em Exercícios)</option>
                <option value={3} className="cursor-pointer">3 Horas (Teoria + Revisão)</option>
                <option value={4} className="cursor-pointer">4 Horas (Ciclo de Estudo Completo)</option>
              </select>
            </div>
          </div>

          <button 
            disabled={isLoading}
            className="w-full brand-skew-btn py-4 px-6 rounded-2xl font-black disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-3.5 shadow-xl border border-blue-400/40 group"
            onClick={handleGenerate}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-400/40 flex items-center justify-center shrink-0 z-10">
              <img src={BRAND_ASSETS.iconsWhiteBg.documento} alt="" className="w-5 h-5 object-contain" />
            </div>
            <span className="text-sm font-black uppercase tracking-wider text-white z-10">{isLoading ? 'Escrevendo material de estudo...' : 'Gerar Cronograma e Aulas'}</span>
          </button>
        </>
      ) : (
        <div className="animate-fadeIn">
          {/* Toast Notification for saves/success */}
          {successMsg && (
            <div className="fixed bottom-5 right-5 bg-slate-900 border border-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-2xl z-[300] flex items-center gap-2.5 animate-fadeIn max-w-sm">
              <span className="text-yellow-400 text-base">★</span>
              <p className="text-xs font-semibold leading-relaxed">{successMsg}</p>
            </div>
          )}

          {/* Header Controls for Generated Material */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                <span>{theme}</span>
                <span>•</span>
                <span className="truncate max-w-xs">{subtheme}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-600" size={20} />
                Material de Estudo Gerado ({hours}h)
              </h3>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <BookmarkButton
                id="btn-save-study-material"
                onClick={handleSaveMaterial}
                isLoading={isSavingMaterial}
                isSaved={isMaterialSaved}
                savedText="Salvo"
                unsavedText="Salvar"
                title={isMaterialSaved ? "Material salvo nos favoritos" : "Salvar material de estudo nos favoritos"}
              />
              <button
                onClick={() => {
                  setMaterial(null);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
            </div>
          </div>

          {/* TOP: Material de Estudo Text Window */}
          <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-200 shadow-sm max-h-[640px] overflow-y-auto shadow-inner mb-8">
            <div className="max-w-4xl mx-auto">
              <MathMarkdownRenderer text={material} />
            </div>
          </div>

          {/* MIND MAP SECTION */}
          <div className="mb-8">
            <MapaMentalIlustrado
              titulo={subtheme || theme || "Mapa Mental Ilustrado"}
              conteudo={material}
              initialImage={currentDisplayImage || mindmapImageUrl || mindmap1Url || mindmap2Url}
              onImageGenerated={(newImg) => {
                setMindmapImageUrl(newImg);
                setMindmap1Url(newImg);
                setIsMindmapSaved(false);
              }}
            />
          </div>

          {/* BOTTOM GRID: Interactive Checklist & YouTube Videos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* WINDOW 1: Cronograma Interativo (Checklist) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-blue-600/40 shrink-0">
                    <img src={BRAND_ASSETS.iconsWhiteBg.documento} alt="" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Cronograma de Estudo</h4>
                    <p className="text-[10px] text-blue-800 font-extrabold">Ciclo de Estudo ({hours}h)</p>
                  </div>
                </div>
                
                {/* Progress Badge */}
                <div className="bg-slate-900 text-blue-300 font-black text-xs px-3 py-1 rounded-full border border-blue-600/40 shadow-xs">
                  {completedTasks.length > 0 ? Math.round((completedTasks.filter(Boolean).length / completedTasks.length) * 100) : 0}% concluído
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 mb-6 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(30,58,138,0.4)]" 
                  style={{ width: `${completedTasks.length > 0 ? (completedTasks.filter(Boolean).length / completedTasks.length) * 100 : 0}%` }}
                ></div>
              </div>

              {/* Tasks List */}
              <div className="space-y-3 mb-6 flex-1">
                {getCustomChecklistItems(theme, subtheme, hours).map((task, idx) => {
                  const isChecked = completedTasks[idx] || false;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleToggleTask(idx)}
                      className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer ${
                        isChecked 
                          ? 'bg-amber-50/60 border-amber-200/80 shadow-2xs' 
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <button 
                        type="button"
                        className="shrink-0 mt-0.5"
                      >
                        {isChecked ? (
                          <CheckCircle2 className="text-amber-600 fill-amber-100" size={20} />
                        ) : (
                          <div className="w-5 h-5 border-2 border-slate-300 rounded-full hover:border-amber-500 transition-colors" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs md:text-sm font-bold leading-relaxed transition-all duration-150 ${
                          isChecked ? 'text-slate-500 line-through' : 'text-slate-800'
                        }`}>
                          {task.label}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-extrabold">
                          <Clock size={11} className="text-amber-600" />
                          <span>{task.duration} sugeridos</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button: Save to General Stats */}
              <button
                onClick={handleSaveToStats}
                disabled={savingProgress}
                className="w-full brand-skew-btn text-white border border-blue-400/40 disabled:opacity-50 text-xs font-black uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group"
              >
                <Star className="text-sky-300 shrink-0 fill-sky-300/40 z-10" size={16} />
                <span className="z-10">{savingProgress ? "Salvando..." : "Salvar Progresso Geral (+1 Dia de Estudo no Painel)"}</span>
              </button>
              <p className="text-[10px] text-slate-500 font-bold text-center mt-2.5">
                O progresso do cronograma é salvo de forma persistente e automática!
              </p>
            </div>

            {/* WINDOW 2: Videoaulas sugeridas do YouTube */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-blue-600/40 shrink-0">
                    <img src={BRAND_ASSETS.iconsWhiteBg.capelo} alt="" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Videoaulas Recomendadas</h4>
                    <p className="text-[10px] text-blue-800 font-extrabold">
                      {loadingVideos
                        ? "Verificando coerência temática..."
                        : videos.length > 0
                        ? `${videos.length} Aulas com Aderência ao Edital ⭐`
                        : "Tópico com Foco Teórico e Mapas Mentais"}
                    </p>
                  </div>
                </div>
                {videos.length > 0 && (
                  <button 
                    onClick={() => {
                        setLoadingVideos(true);
                        apiFetch(`/api/videos?query=${encodeURIComponent(videoSearchQuery || subtheme || theme)}`)
                            .then(vRes => vRes.json())
                            .then(vData => {
                                if (Array.isArray(vData)) {
                                    setVideos(vData);
                                }
                            })
                            .catch(vErr => console.error("Error fetching videos:", vErr))
                            .finally(() => setLoadingVideos(false));
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="Buscar novos vídeos"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
              </div>

              {/* Custom Search Bar for YouTube Videoaulas */}
              <div className="flex gap-2 mb-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <input
                  type="text"
                  value={videoSearchQuery}
                  onChange={(e) => setVideoSearchQuery(e.target.value)}
                  placeholder="Pesquisar outro assunto no YouTube..."
                  className="flex-1 bg-transparent px-3 text-xs font-semibold text-slate-800 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setLoadingVideos(true);
                      apiFetch(`/api/videos?query=${encodeURIComponent(videoSearchQuery)}`)
                        .then(vRes => vRes.json())
                        .then(vData => {
                          if (Array.isArray(vData)) {
                            setVideos(vData);
                          }
                        })
                        .catch(vErr => console.error("Error fetching videos:", vErr))
                        .finally(() => setLoadingVideos(false));
                    }
                  }}
                />
                <button
                  onClick={() => {
                    setLoadingVideos(true);
                    apiFetch(`/api/videos?query=${encodeURIComponent(videoSearchQuery)}`)
                      .then(vRes => vRes.json())
                      .then(vData => {
                        if (Array.isArray(vData)) {
                          setVideos(vData);
                        }
                      })
                      .catch(vErr => console.error("Error fetching videos:", vErr))
                      .finally(() => setLoadingVideos(false));
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-[10px] uppercase rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Buscar
                </button>
              </div>

              {/* Quick Subtopic Filter Chips for Revolts / Multi-topics */}
              {(() => {
                const text = `${theme} ${subtheme}`.toLowerCase();
                let chips: string[] = [];
                if (text.includes("bahia") || text.includes("sabinada") || text.includes("canudos") || text.includes("males") || text.includes("balaiada")) {
                  chips = [
                    "⭐ Todos os Tópicos",
                    "Independência da Bahia",
                    "Guerra de Canudos",
                    "Revolta dos Malês",
                    "Conjuração Baiana",
                    "Sabinada",
                    "Balaiada",
                    "Cabanagem"
                  ];
                } else if (subtheme.includes("(") && subtheme.includes(")")) {
                  const match = subtheme.match(/\((.*?)\)/);
                  if (match && match[1]) {
                    const parts = match[1].split(",").map(p => p.trim()).filter(Boolean);
                    if (parts.length > 1) chips = ["⭐ Todos os Tópicos", ...parts];
                  }
                } else if (subtheme.includes(",")) {
                  const parts = subtheme.split(",").map(p => p.trim()).filter(Boolean);
                  if (parts.length > 1) chips = ["⭐ Todos os Tópicos", ...parts];
                }

                if (chips.length === 0) return null;

                return (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
                    {chips.map((chip, cIdx) => {
                      const cleanChipName = chip.replace("⭐ ", "");
                      const isActive = chip.startsWith("⭐")
                        ? videoSearchQuery === (subtheme || theme)
                        : videoSearchQuery.toLowerCase().includes(cleanChipName.toLowerCase());

                      return (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => {
                            const queryToSearch = chip.startsWith("⭐") ? (subtheme || theme) : cleanChipName;
                            setVideoSearchQuery(queryToSearch);
                            setLoadingVideos(true);
                            apiFetch(`/api/videos?query=${encodeURIComponent(queryToSearch)}`)
                              .then(vRes => vRes.json())
                              .then(vData => {
                                if (Array.isArray(vData)) {
                                  setVideos(vData);
                                }
                              })
                              .catch(vErr => console.error("Error fetching videos:", vErr))
                              .finally(() => setLoadingVideos(false));
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition cursor-pointer border ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {loadingVideos ? (
                <div className="flex flex-col items-center justify-center py-16 flex-1">
                  <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-slate-500 font-bold animate-pulse">Filtrando videoaulas com coerência temática...</p>
                </div>
              ) : videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center flex-1 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 shadow-2xs">
                    <BookOpen size={22} />
                  </div>
                  <h5 className="text-xs font-extrabold text-slate-800 mb-1">
                    Sem videoaulas avulsas ou incoerentes
                  </h5>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-sm mb-4">
                    Para o tópico <span className="font-bold text-slate-700">"{subtheme}"</span>, não identificamos videoaulas com aderência 100% fiel ao edital. Priorizamos a qualidade e evitamos vídeos genéricos. Recomendamos o estudo intensivo pelo <strong>Material Teórico</strong> e <strong>Mapas Mentais</strong> gerados ao lado.
                  </p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${currentConcurso.shortTitle} ${subtheme} aula concurso`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs"
                  >
                    <Search size={13} className="text-red-600" />
                    <span>Pesquisar no YouTube</span>
                  </a>
                </div>
              ) : (
                <div className="space-y-3.5 flex-1">
                  {videos.slice(0, 6).map((vid, idx) => {
                    const isEmbeddable = vid.id && vid.id.videoId;
                    const videoId = isEmbeddable ? vid.id.videoId : "";
                    const title = vid.snippet?.title || "Videoaula complementar";
                    const channel = vid.snippet?.channelTitle || "YouTube";
                    const thumbUrl = vid.snippet?.thumbnails?.medium?.url || vid.snippet?.thumbnails?.default?.url;
                    const isSaved = savedVideosIds.includes(videoId || sanitizeId(title));

                    // Ratings simulator based on index: 1st gets 5.0, 2nd gets 4.9, etc.
                    const ratingValue = (5.0 - (idx * 0.1)).toFixed(1);
                    const evaluationBadge = idx === 0 ? "🔥 Melhor Classificada" : idx === 1 ? `🌟 Destaque ${currentConcurso.shortTitle}` : "⭐ Altamente Avaliada";

                    return (
                      <div 
                        key={idx} 
                        className="border rounded-2xl p-4 bg-slate-50 hover:bg-white hover:border-blue-500/40 hover:shadow-md transition-all duration-200 flex flex-col gap-3 border-slate-200"
                      >
                        <div className="flex gap-3">
                          {thumbUrl ? (
                            <div className="relative shrink-0 w-24 h-16 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-2xs flex items-center justify-center">
                              <img 
                                src={thumbUrl} 
                                alt={title} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (videoId && !target.src.includes('mqdefault.jpg')) {
                                    target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                                  } else {
                                    target.style.display = 'none';
                                  }
                                }}
                              />
                              <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-2xs border border-slate-800 pointer-events-none">
                                <span className="text-amber-400">★</span>
                                <span>{ratingValue}</span>
                              </div>
                            </div>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-[9px] font-bold text-blue-900 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                {evaluationBadge}
                              </span>
                              {isSaved && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                  ★ Salva
                                </span>
                              )}
                            </div>
                            <h5 className="text-xs font-black text-slate-900 line-clamp-2 leading-snug" title={title}>
                              {title}
                            </h5>
                            <p className="text-[10px] text-slate-500 font-extrabold mt-1 uppercase tracking-wide">
                              {channel}
                            </p>
                          </div>
                        </div>

                        {/* Interactive Buttons */}
                        <div className="flex items-center gap-2">
                          {isEmbeddable ? (
                            <button
                              onClick={() => handlePlayVideo(vid)}
                              className="flex-1 neumorphic-btn-sm whitespace-nowrap"
                            >
                              <Play size={13} fill="currentColor" className="text-red-600 shrink-0" />
                              <span>Assistir Videoaula</span>
                            </button>
                          ) : null}
                          <BookmarkButton
                            id={`btn-save-video-${videoId || sanitizeId(title)}`}
                            onClick={() => handleToggleSaveVideo(vid)}
                            isSaved={isSaved}
                            savedText="Salva"
                            unsavedText="Salvar"
                            title={isSaved ? "Videoaula salva nos favoritos" : "Salvar videoaula"}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL overlay: CENTRAL YOUTUBE VIDEO PLAYER OVERLAY */}
      {playingVideo && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-800 animate-scaleIn text-white flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <div className="min-w-0 pr-4">
                <span className="text-[9px] font-black uppercase text-red-400 bg-red-950/50 border border-red-900 px-2 py-0.5 rounded-full">
                  Canal: {playingVideo.channel}
                </span>
                <h4 className="text-xs md:text-sm font-extrabold text-slate-100 truncate mt-1">
                  {playingVideo.title}
                </h4>
              </div>
              <button 
                onClick={() => setPlayingVideo(null)}
                className="p-1.5 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-full transition shrink-0"
              >
                <span className="font-extrabold text-sm px-1">✕</span>
              </button>
            </div>
            
            <div className="aspect-video w-full bg-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${playingVideo.videoId}?autoplay=1`}
                title={playingVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>

            <div className="p-4 bg-slate-950 text-center flex justify-between items-center">
              <p className="text-[10px] text-slate-450 font-semibold">Vídeo em execução no centro da plataforma.</p>
              <button
                onClick={() => setPlayingVideo(null)}
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-xl transition"
              >
                Fechar Videoaula ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="mt-8 flex flex-col items-center justify-center py-10 bg-slate-900/60 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
          <LiquidLoader 
            text="Sintetizando Material de Estudo" 
            subtext={`Compilando referências do edital oficial de ${currentConcurso.shortTitle}, dicas de prova e cronograma personalizado de ${hours}h...`}
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold">Houve um erro:</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* FULLSCREEN AMPLIAÇÃO MODAL FOR MINDMAP IMAGE */}
      {showAmpliarModal && currentDisplayImage && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[500] flex flex-col p-4 md:p-6 text-white animate-scaleIn">
          <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-4 shadow-lg flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-950 border border-emerald-800 px-3 py-1 rounded-full">
                VISUALIZAÇÃO AMPLIADA • MAPA MENTAL
              </span>
              <h4 className="text-base font-extrabold text-white hidden sm:block">
                {subtheme || theme} {activeMindmapTab === 'parte1' ? '(Parte 1)' : activeMindmapTab === 'parte2' ? '(Parte 2)' : ''}
              </h4>
            </div>

            {/* Part Switcher in Modal */}
            {(mindmap1Url || mindmap2Url) && (
              <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setActiveMindmapTab('parte1')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeMindmapTab === 'parte1' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Parte 1
                </button>
                <button
                  onClick={() => setActiveMindmapTab('parte2')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    activeMindmapTab === 'parte2' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Parte 2
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <BookmarkButton
                id="btn-save-mindmap-modal"
                onClick={handleSaveMindmap}
                isLoading={isSavingMindmap}
                isSaved={isMindmapSaved}
                savedText="Salvo"
                unsavedText="Salvar"
                title={isMindmapSaved ? "Mapa mental salvo nos favoritos" : "Salvar mapa mental no sistema"}
              />

              <button
                onClick={handleDownloadImagePng}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow disabled:opacity-50"
              >
                <Download size={14} className={isDownloading ? "animate-bounce" : ""} />
                <span>{isDownloading ? "Gerando..." : "Baixar PNG"}</span>
              </button>

              <button
                onClick={() => setShowAmpliarModal(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-1 text-xs font-bold"
              >
                <span className="font-extrabold px-1 text-base">✕</span>
                <span className="hidden sm:inline">Fechar</span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-900 rounded-2xl p-4 md:p-8 overflow-auto flex justify-center items-center shadow-2xl border border-slate-800">
            <img
              src={currentDisplayImage}
              alt={`Mapa Mental Ampliado - ${subtheme || theme}`}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {/* Quota Limit Exceeded Modal (20 Mind Maps Max) */}
      {showQuotaLimitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 text-slate-800 relative">
            <button
              onClick={() => setShowQuotaLimitModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition font-bold"
            >
              ✕
            </button>

            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-5 border border-amber-200 shadow-sm">
              <AlertTriangle size={28} />
            </div>

            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
              LIMITE ATINGIDO • 10/10 MAPAS MENTAIS
            </span>

            <h3 className="text-xl font-extrabold text-slate-900 mt-3 mb-2">
              Limite de Geração Alcançado
            </h3>

            <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-5">
              Você utilizou a quota de <strong className="text-amber-700">10 mapas mentais</strong> da sua conta. Para liberar novas gerações ou expandir o limite da sua conta, informe ao suporte do <strong>Prof. Rafael Alves</strong>.
            </p>

            {/* Usage Progress Bar */}
            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 mb-6 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Progresso da Quota</span>
                <span className="text-amber-700 font-black">{mindmapQuotaCount} / {MINDMAP_LIMIT} (100%)</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full w-full" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://wa.me/5577998401073?text=Ol%C3%A1%20Prof.%20Rafael%2C%20atingi%20o%20limite%20de%2010%20mapas%20mentais%20na%20plataforma%20e%20gostaria%20de%20solicitar%20a%20libera%C3%A7%C3%A3o%20ao%20suporte."
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Informar ao Suporte (WhatsApp)</span>
              </a>

              <a
                href="/suporte"
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 text-center"
              >
                <span>Central de Suporte</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
