import React, { useState, useEffect } from 'react';
import { doc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserId } from '../lib/auth';
import { 
  Heart, 
  FileText, 
  Play, 
  Trash2, 
  Star, 
  ExternalLink, 
  BookOpen, 
  Calendar, 
  ArrowLeft,
  X,
  Clock,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addWatermarkToImage } from '../utils/watermark';
import { BRAND_ASSETS } from '../constants/brandAssets';
import LiquidLoader from '../components/LiquidLoader';
import MathMarkdownRenderer from '../components/MathMarkdownRenderer';

interface SavedMaterial {
  id: string;
  materialId: string;
  theme: string;
  subtheme: string;
  hours: number;
  content: string;
  savedAt: string;
}

interface SavedVideo {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  searchUrl: string;
  theme: string;
  subtheme: string;
  savedAt: string;
}

interface SavedMindmap {
  id: string;
  mindmapId: string;
  theme: string;
  subtheme: string;
  hours: number;
  imageUrl: string;
  savedAt: string;
}

export default function FavoritosPage() {
  const userId = useUserId();
  const navigate = useNavigate();
  const [savedMaterials, setSavedMaterials] = useState<SavedMaterial[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [savedMindmaps, setSavedMindmaps] = useState<SavedMindmap[]>([]);
  const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  
  // Modal / Reader State
  const [activeMaterial, setActiveMaterial] = useState<SavedMaterial | null>(null);
  const [activeMindmap, setActiveMindmap] = useState<SavedMindmap | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [playingVideoTitle, setPlayingVideoTitle] = useState<string>('');
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchFavorites = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Fetch Materials
      const materialsRef = collection(db, 'users', userId, 'saved_materials');
      const materialsSnap = await getDocs(materialsRef);
      const mats = materialsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedMaterial[];
      setSavedMaterials(mats.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

      // 2. Fetch Videos
      const videosRef = collection(db, 'users', userId, 'saved_videos');
      const videosSnap = await getDocs(videosRef);
      const vids = videosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedVideo[];
      setSavedVideos(vids.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

      // 3. Fetch Mindmaps
      const mindmapsRef = collection(db, 'users', userId, 'saved_mindmaps');
      const mindmapsSnap = await getDocs(mindmapsRef);
      const mmaps = mindmapsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedMindmap[];
      setSavedMindmaps(mmaps.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
    } catch (err) {
      console.error("Error fetching favorites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchFavorites();
    }
  }, [userId]);

  const handleDeleteMaterial = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'saved_materials', id));
      setSavedMaterials(prev => prev.filter(m => m.id !== id));
      showToast("❌ Material removido dos favoritos.");
    } catch (err) {
      console.error("Error deleting material:", err);
    }
  };

  const handleDeleteVideo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'saved_videos', id));
      setSavedVideos(prev => prev.filter(v => v.id !== id));
      showToast("❌ Videoaula removida dos favoritos.");
    } catch (err) {
      console.error("Error deleting video:", err);
    }
  };

  const handleDeleteMindmap = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'saved_mindmaps', id));
      setSavedMindmaps(prev => prev.filter(m => m.id !== id));
      showToast("❌ Mapa mental removido dos favoritos.");
    } catch (err) {
      console.error("Error deleting mindmap:", err);
    }
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const loadMaterialInGenerator = (mat: SavedMaterial) => {
    // Navigate to Materials page and pass the selected saved material via localStorage or state
    localStorage.setItem('ralves_last_loaded_material', JSON.stringify({
      theme: mat.theme,
      subtheme: mat.subtheme,
      hours: mat.hours,
      content: mat.content
    }));
    navigate('/materiais');
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed bottom-5 right-5 bg-slate-900 border border-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-2xl z-[300] flex items-center gap-2.5 animate-fadeIn max-w-sm">
          <span className="text-yellow-400 text-base">★</span>
          <p className="text-xs font-semibold leading-relaxed">{successMsg}</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <img src={BRAND_ASSETS.iconsOutline.capelo} alt="" className="w-8 h-8 object-contain" />
            Favoritos & Salvos
          </h1>
          <p className="text-sm text-slate-500 mt-1">Materiais e videoaulas persistidos no seu progresso para consulta rápida.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <LiquidLoader text="Buscando itens salvos" subtext="Sincronizando seus materiais e videoaulas..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMN 1: Saved Materials */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm h-full">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-2.5">
                <span className="bg-slate-900 p-1.5 rounded-lg border border-amber-500/30 shrink-0">
                  <img src={BRAND_ASSETS.iconsWhiteBg.documento} alt="" className="w-4 h-4 object-contain" />
                </span>
                Materiais de Estudo ({savedMaterials.length})
              </h2>

              {savedMaterials.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <BookOpen className="mx-auto text-slate-300 mb-2" size={40} />
                  <p className="text-xs font-bold">Nenhum material de estudo salvo ainda.</p>
                  <p className="text-[11px] mt-1">Gere um material no painel e clique em "Salvar no Sistema".</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {savedMaterials.map((mat) => (
                    <div 
                      key={mat.id}
                      onClick={() => setActiveMaterial(mat)}
                      className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-150 cursor-pointer flex justify-between items-center group"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                          {mat.theme}
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-800 mt-1.5 truncate pr-4">
                          {mat.subtheme}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-1">
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {mat.hours}h recomendadas
                          </span>
                          <span>•</span>
                          <span>Salvo em {new Date(mat.savedAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadMaterialInGenerator(mat);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
                          title="Abrir e estudar este material"
                        >
                          Estudar
                        </button>
                        <button
                          onClick={(e) => handleDeleteMaterial(mat.id, e)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: Saved Mind Maps */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm h-full">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-2.5">
                <span className="bg-slate-900 p-1.5 rounded-lg border border-amber-500/30 shrink-0">
                  <img src={BRAND_ASSETS.iconsWhiteBg.dashboard} alt="" className="w-4 h-4 object-contain" />
                </span>
                Mapas Mentais Salvos ({savedMindmaps.length})
              </h2>

              {savedMindmaps.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Star className="mx-auto text-slate-300 mb-2" size={40} />
                  <p className="text-xs font-bold">Nenhum mapa mental salvo ainda.</p>
                  <p className="text-[11px] mt-1">Gere um mapa mental e clique em "Salvar no Sistema".</p>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
                  {savedMindmaps.map((mmap) => (
                    <div 
                      key={mmap.id}
                      onClick={() => setActiveMindmap(mmap)}
                      className="border border-slate-100 rounded-2xl p-3.5 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-150 cursor-pointer flex flex-col gap-3 group"
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <div className="min-w-0">
                          <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                            {mmap.theme}
                          </span>
                          <h4 className="text-xs font-extrabold text-slate-800 mt-1 truncate">
                            {mmap.subtheme}
                          </h4>
                        </div>
                        <button
                          onClick={(e) => handleDeleteMindmap(mmap.id, e)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="w-full h-32 bg-slate-900 rounded-xl overflow-hidden relative border border-slate-200 flex items-center justify-center">
                        <img 
                          src={mmap.imageUrl} 
                          alt={mmap.subtheme} 
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center">
                          <span className="text-[11px] font-extrabold text-white bg-indigo-600/90 px-3 py-1.5 rounded-xl shadow">
                            Clique para Ampliar
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 font-semibold flex justify-between items-center pt-1 border-t border-slate-100">
                        <span>Salvo em {new Date(mmap.savedAt).toLocaleDateString('pt-BR')}</span>
                        <span className="text-amber-600 font-bold">⭐ Salvo</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: Saved Videos */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-2.5">
                <span className="bg-slate-900 p-1.5 rounded-lg border border-amber-500/30 shrink-0">
                  <img src={BRAND_ASSETS.iconsWhiteBg.capelo} alt="" className="w-4 h-4 object-contain" />
                </span>
                Videoaulas Salvas ({savedVideos.length})
              </h2>

              {savedVideos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Play className="mx-auto text-slate-300 mb-2" size={40} />
                  <p className="text-xs font-bold">Nenhuma videoaula salva ainda.</p>
                  <p className="text-[11px] mt-1">Clique em "Salvar Aula" no seu painel de materiais gerados.</p>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
                  {(() => {
                    // Group videos by theme
                    const videosByTheme = savedVideos.reduce((acc, vid) => {
                      const themeName = vid.theme || 'Outros / Geral';
                      if (!acc[themeName]) {
                        acc[themeName] = [];
                      }
                      acc[themeName].push(vid);
                      return acc;
                    }, {} as Record<string, SavedVideo[]>);

                    return (Object.entries(videosByTheme) as [string, SavedVideo[]][]).map(([themeName, vids]) => {
                      const isExpanded = !!expandedThemes[themeName];
                      return (
                        <div key={themeName} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/20 transition-all">
                          {/* Folder Header */}
                          <button
                            onClick={() => setExpandedThemes(prev => ({ ...prev, [themeName]: !isExpanded }))}
                            className="w-full flex items-center justify-between p-4 bg-slate-100/40 hover:bg-slate-100/80 transition text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isExpanded ? (
                                <FolderOpen className="text-amber-500 shrink-0" size={20} />
                              ) : (
                                <Folder className="text-amber-500 shrink-0" size={20} />
                              )}
                              <div className="min-w-0">
                                <h4 className="text-xs font-extrabold text-slate-800 truncate pr-2">
                                  {themeName}
                                </h4>
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  {vids.length} {vids.length === 1 ? 'videoaula' : 'videoaulas'}
                                </span>
                              </div>
                            </div>
                            <div className="text-slate-400 shrink-0 pl-2">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </button>

                          {/* Folder Content (Video list) */}
                          {isExpanded && (
                            <div className="p-3 border-t border-slate-150 bg-white space-y-2.5 animate-fadeIn">
                              {vids.map((vid) => (
                                <div 
                                  key={vid.id}
                                  className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all duration-150 flex gap-3 items-center"
                                >
                                  {vid.thumbnail ? (
                                    <div className="w-16 h-11 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-slate-150">
                                      <img 
                                        src={vid.thumbnail} 
                                        alt={vid.title} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        loading="lazy"
                                        onError={(e) => {
                                          const target = e.currentTarget;
                                          if (vid.videoId && !target.src.includes('mqdefault.jpg')) {
                                            target.src = `https://img.youtube.com/vi/${vid.videoId}/mqdefault.jpg`;
                                          } else {
                                            target.style.display = 'none';
                                          }
                                        }}
                                      />
                                    </div>
                                  ) : null}
                                  
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                                      {vid.subtheme || 'Tópico Geral'}
                                    </span>
                                    <h5 className="text-[11px] font-bold text-slate-800 leading-snug mt-0.5 truncate" title={vid.title}>
                                      {vid.title}
                                    </h5>
                                    <p className="text-[9px] text-slate-400 font-semibold">{vid.channelTitle}</p>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {vid.videoId ? (
                                      <button
                                        onClick={() => {
                                          setPlayingVideoId(vid.videoId);
                                          setPlayingVideoTitle(vid.title);
                                        }}
                                        className="neumorphic-btn-sm !text-[10px] !py-1 !px-2.5"
                                      >
                                        <Play size={10} fill="currentColor" className="text-red-600 shrink-0" /> Assistir
                                      </button>
                                    ) : (
                                      <a
                                        href={vid.searchUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(vid.title)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="neumorphic-btn-sm !text-[10px] !py-1 !px-2.5"
                                      >
                                        YouTube <ExternalLink size={10} />
                                      </a>
                                    )}
                                    <button
                                      onClick={(e) => handleDeleteVideo(vid.id, e)}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                                      title="Remover"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: STUDY MATERIAL READER OVERLAY */}
      {activeMaterial && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 shrink-0">
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  {activeMaterial.theme}
                </span>
                <h3 className="text-base md:text-lg font-black text-slate-800 truncate mt-1">
                  {activeMaterial.subtheme}
                </h3>
              </div>
              <button 
                onClick={() => setActiveMaterial(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content view scroll */}
            <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50/30">
              <div className="max-w-4xl mx-auto">
                <MathMarkdownRenderer text={activeMaterial.content} />
              </div>
            </div>

            {/* Footer with action */}
            <div className="border-t border-slate-100 p-4 shrink-0 flex gap-3 justify-end bg-slate-50/50 rounded-b-3xl">
              <button
                onClick={() => {
                  loadMaterialInGenerator(activeMaterial);
                  setActiveMaterial(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5"
              >
                <BookOpen size={14} /> Carregar e Continuar Ciclo
              </button>
              <button
                onClick={() => setActiveMaterial(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs px-4 py-2.5 rounded-xl transition"
              >
                Fechar Leitura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CENTRAL YOUTUBE VIDEO PLAYER OVERLAY */}
      {playingVideoId && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-800 animate-scaleIn text-white flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <div className="min-w-0 pr-4">
                <span className="text-[9px] font-black uppercase text-red-400 bg-red-950/50 border border-red-900 px-2 py-0.5 rounded-full">
                  Videoaula Recomendada
                </span>
                <h4 className="text-xs md:text-sm font-extrabold text-slate-100 truncate mt-1">
                  {playingVideoTitle}
                </h4>
              </div>
              <button 
                onClick={() => {
                  setPlayingVideoId(null);
                  setPlayingVideoTitle('');
                }}
                className="p-1.5 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-full transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="aspect-video w-full bg-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${playingVideoId}?autoplay=1`}
                title={playingVideoTitle}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>

            <div className="p-4 bg-slate-950 text-center flex justify-between items-center">
              <p className="text-[10px] text-slate-400 font-semibold">Executando com segurança no centro do sistema.</p>
              <button
                onClick={() => {
                  setPlayingVideoId(null);
                  setPlayingVideoTitle('');
                }}
                className="bg-red-650 hover:bg-red-700 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg transition"
              >
                Fechar Player ❌
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MIND MAP FULLSCREEN VIEWER */}
      {activeMindmap && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[350] flex flex-col p-4 md:p-6 text-white animate-scaleIn">
          <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-4 shadow-lg flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase text-amber-300 bg-amber-950 border border-amber-800 px-3 py-1 rounded-full">
                MAPA MENTAL SALVO ⭐
              </span>
              <h4 className="text-base font-extrabold text-white hidden sm:block">
                {activeMindmap.subtheme || activeMindmap.theme}
              </h4>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={async () => {
                  try {
                    const watermarkedUrl = await addWatermarkToImage(
                      activeMindmap.imageUrl, 
                      activeMindmap.subtheme || activeMindmap.theme
                    );
                    const a = document.createElement('a');
                    a.href = watermarkedUrl;
                    a.download = `Mapa_Mental_${(activeMindmap.subtheme || activeMindmap.theme || 'Material').replace(/[/\\?%*:|"<>\s]/g, '_')}.png`;
                    a.click();
                  } catch {
                    const a = document.createElement('a');
                    a.href = activeMindmap.imageUrl;
                    a.download = `Mapa_Mental_${(activeMindmap.subtheme || activeMindmap.theme || 'Material').replace(/[/\\?%*:|"<>\s]/g, '_')}.png`;
                    a.click();
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow"
              >
                <span>Baixar PNG</span>
              </button>

              <button
                onClick={() => setActiveMindmap(null)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-1 text-xs font-bold"
              >
                <X size={16} />
                <span className="hidden sm:inline">Fechar</span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-900 rounded-2xl p-4 md:p-8 overflow-auto flex justify-center items-center shadow-2xl border border-slate-800">
            <img
              src={activeMindmap.imageUrl}
              alt={`Mapa Mental - ${activeMindmap.subtheme}`}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

    </div>
  );
}
