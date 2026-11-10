import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface UserStatsData {
  videoLessons: number;
  simulations: number;
  questions: number;
  performance: number;
  studyDays: number;
  lastActiveDate?: string;
  updatedAt?: string;
}

/**
 * Recalculates and synchronizes all user stats directly in Firebase Firestore.
 */
export async function syncAndRecalculateUserStats(userId: string): Promise<UserStatsData> {
  if (!userId) {
    throw new Error("UserId não fornecido para sincronização.");
  }

  try {
    // 1. Fetch simulation history
    const simRef = collection(db, 'users', userId, 'simulation_history');
    const simSnap = await getDocs(simRef);
    
    let totalSimQuestions = 0;
    let totalSimCorrect = 0;
    const simCount = simSnap.size;

    simSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const qCount = Number(data.totalQuestions || (data.questions ? data.questions.length : 0)) || 0;
      const score = Number(data.score) || 0;
      totalSimQuestions += qCount;
      totalSimCorrect += score;
    });

    // 2. Fetch past exams progress
    const examsRef = collection(db, 'users', userId, 'exams_progress');
    const examsSnap = await getDocs(examsRef);
    let totalExamQuestions = 0;
    let totalExamCorrect = 0;

    examsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.solved && data.score) {
        // Formato esperado: "65/100" ou similar
        const parts = String(data.score).split('/');
        if (parts.length === 2) {
          const hit = parseInt(parts[0], 10) || 0;
          const tot = parseInt(parts[1], 10) || 0;
          totalExamCorrect += hit;
          totalExamQuestions += tot;
        }
      }
    });

    // 3. Fetch watched videos
    const videosRef = collection(db, 'users', userId, 'videos');
    const videosSnap = await getDocs(videosRef);
    const videoCount = videosSnap.size;

    // 4. Calculate aggregated metrics
    const totalQuestions = totalSimQuestions + totalExamQuestions;
    const totalHits = totalSimCorrect + totalExamCorrect;
    const performance = totalQuestions > 0 ? Math.round((totalHits / totalQuestions) * 100) : 0;

    // 5. Fetch existing stats for studyDays preservation
    const statsDocRef = doc(db, 'users', userId, 'stats', 'main');
    const existingSnap = await getDoc(statsDocRef);
    
    let studyDays = 1;
    const today = new Date().toISOString().split('T')[0];

    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const lastDate = existingData.lastActiveDate;
      const prevDays = existingData.studyDays || 1;
      
      if (lastDate && lastDate !== today) {
        studyDays = prevDays + 1;
      } else {
        studyDays = prevDays;
      }
    }

    const updatedStats: UserStatsData = {
      videoLessons: videoCount,
      simulations: simCount,
      questions: totalQuestions,
      performance: performance,
      studyDays: studyDays,
      lastActiveDate: today,
      updatedAt: new Date().toISOString()
    };

    await setDoc(statsDocRef, updatedStats, { merge: true });
    return updatedStats;
  } catch (error) {
    console.error("[PersistenceManager] Erro ao sincronizar estatísticas no Firestore:", error);
    throw error;
  }
}

/**
 * Salva a resolução de uma prova anterior e atualiza o histórico e as estatísticas.
 */
export async function recordExamCompletion(
  userId: string,
  examId: string,
  scoreString: string,
  timeSpent: string,
  concursoId: string
) {
  if (!userId) return;

  const examRef = doc(db, 'users', userId, 'exams_progress', examId);
  await setDoc(examRef, {
    solved: true,
    score: scoreString,
    timeSpent: timeSpent,
    concursoId: concursoId,
    solvedAt: new Date().toISOString()
  }, { merge: true });

  await syncAndRecalculateUserStats(userId);
}

/**
 * Salva a visualização de videoaula e sincroniza contador.
 */
export async function recordVideoWatched(userId: string, videoId: string, title?: string) {
  if (!userId) return;

  const videoRef = doc(db, 'users', userId, 'videos', videoId);
  await setDoc(videoRef, {
    watched: true,
    title: title || 'Videoaula',
    watchedAt: new Date().toISOString()
  }, { merge: true });

  // Update videoLessons counter in main stats
  const statsDocRef = doc(db, 'users', userId, 'stats', 'main');
  const existingSnap = await getDoc(statsDocRef);
  if (existingSnap.exists()) {
    const data = existingSnap.data();
    await updateDoc(statsDocRef, {
      videoLessons: (data.videoLessons || 0) + 1,
      updatedAt: new Date().toISOString()
    });
  } else {
    await syncAndRecalculateUserStats(userId);
  }
}
