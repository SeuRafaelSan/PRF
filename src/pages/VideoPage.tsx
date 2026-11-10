import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useUserId } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { recordVideoWatched, syncAndRecalculateUserStats } from '../lib/persistenceManager';

export default function VideoPage() {
  const { topic } = useParams();
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const userId = useUserId();

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await apiFetch(`/api/videos?query=${encodeURIComponent(topic || '')}`);
        if (response.ok) {
          const data = await response.json();
          setVideos(data);
          if (data.length > 0) setSelectedVideo(data[0]);
        }
      } catch (err) {
        console.error("Erro ao carregar vídeos:", err);
      }
    };
    fetchVideos();
  }, [topic]);

  const saveProgress = async (videoUrl: string) => {
    if (!userId || !videoUrl) return;
    try {
      await recordVideoWatched(userId, videoUrl, selectedVideo?.snippet?.title || `Aula sobre ${topic || 'concurso'}`);
      await syncAndRecalculateUserStats(userId);
    } catch (err) {
      console.error("Erro ao salvar progresso do vídeo no Firestore:", err);
    }
  };


  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800">Videos de {topic}</h1>
      {selectedVideo && (
        <div className="mt-6">
          <iframe
            width="560"
            height="315"
            src={`https://www.youtube.com/embed/${selectedVideo.id.videoId}`}
            title={selectedVideo.snippet.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => saveProgress(selectedVideo.id.videoId)}
          ></iframe>
        </div>
      )}
    </div>
  );
}
