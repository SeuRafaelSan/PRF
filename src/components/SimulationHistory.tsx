import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserId } from '../lib/auth';
import { syncAndRecalculateUserStats } from '../lib/persistenceManager';
import { Trash2, X, CheckCircle2, XCircle, BookOpen, BarChart3, HelpCircle, Calendar, ArrowUpRight, Pencil, Save, FileEdit } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface HistoryItem {
  id: string;
  theme: string;
  subtheme: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  questions?: Question[];
  userAnswers?: string[];
  createdAt: string;
  notes?: string;
}

export default function SimulationHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'simulados' | 'areas'>('simulados');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  
  // Editing & Notification States
  const [isEditing, setIsEditing] = useState(false);
  const [editTheme, setEditTheme] = useState('');
  const [editSubtheme, setEditSubtheme] = useState('');
  const [editScore, setEditScore] = useState(0);
  const [editTotalQuestions, setEditTotalQuestions] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<HistoryItem | null>(null);

  const userId = useUserId();

  const handleStartEdit = (item: HistoryItem) => {
    setEditTheme(item.theme);
    setEditSubtheme(item.subtheme);
    setEditScore(item.score);
    setEditTotalQuestions(item.totalQuestions);
    setEditNotes(item.notes || '');
    setEditDate(item.createdAt ? item.createdAt.substring(0, 10) : new Date().toISOString().substring(0, 10));
    setIsEditing(true);
  };

  const handleSaveChanges = async (id: string) => {
    if (!userId) return;
    try {
      const percentage = editTotalQuestions > 0 ? Math.round((editScore / editTotalQuestions) * 100) : 0;
      const docRef = doc(db, 'users', userId, 'simulation_history', id);
      
      let updatedCreatedAt = selectedItem?.createdAt || new Date().toISOString();
      if (editDate) {
        const timePart = updatedCreatedAt.includes('T') ? updatedCreatedAt.substring(10) : 'T12:00:00.000Z';
        updatedCreatedAt = editDate + timePart;
      }

      const updateData = {
        theme: editTheme,
        subtheme: editSubtheme,
        score: editScore,
        totalQuestions: editTotalQuestions,
        percentage,
        notes: editNotes,
        createdAt: updatedCreatedAt
      };

      await updateDoc(docRef, updateData);
      await syncAndRecalculateUserStats(userId);

      // Update local state immediately
      setSelectedItem(prev => prev ? { ...prev, ...updateData } : null);
      setIsEditing(false);
      setSuccessMsg("Simulado atualizado e recalculado com sucesso no Firebase!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error("Erro ao salvar alterações:", err);
      setErrorMsg("Falha ao salvar as alterações.");
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'users', userId, 'simulation_history'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: HistoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as HistoryItem);
      });
      setHistory(items);
      setLoading(false);
    }, (error) => {
      console.warn("[SimulationHistory] Error listening to history:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const deleteHistoryItem = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    setItemToDelete(item);
  };

  // Group stats by Theme & Subtheme
  const areaStats = history.reduce((acc, curr) => {
    const key = `${curr.theme} ||| ${curr.subtheme}`;
    if (!acc[key]) {
      acc[key] = {
        theme: curr.theme,
        subtheme: curr.subtheme,
        totalQuestions: 0,
        totalCorrect: 0,
        simulationsCount: 0,
      };
    }
    acc[key].totalQuestions += curr.totalQuestions;
    acc[key].totalCorrect += curr.score;
    acc[key].simulationsCount += 1;
    return acc;
  }, {} as Record<string, { theme: string; subtheme: string; totalQuestions: number; totalCorrect: number; simulationsCount: number }>);

  const areaStatsList = Object.values(areaStats).map((area: { theme: string; subtheme: string; totalQuestions: number; totalCorrect: number; simulationsCount: number }) => {
    const percentage = area.totalQuestions > 0 ? Math.round((area.totalCorrect / area.totalQuestions) * 100) : 0;
    return { ...area, percentage };
  });

  const getOptionLetter = (index: number): string => {
    return ['A', 'B', 'C', 'D', 'E'][index] || '';
  };

  const cleanOptionText = (text: string) => {
    return text
      .replace(/^[A-E]\s*[)\-.:]\s*/i, '')
      .replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .trim();
  };

  const stripTags = (text: string) => {
    if (!text) return '';
    return text
      .replace(/<\/?(?:u|b|strong|em|i|span|p|div|small|mark|sub|sup|font|h[1-6]|ul|ol|li)\b[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .trim();
  };

  if (loading && !userId) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 mt-6 flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
      {/* Header and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg">Histórico & Desempenho</h3>
          <p className="text-xs text-slate-500">Revise seus erros, acertos e evolução nos estudos</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('simulados')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'simulados'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Simulados
          </button>
          <button
            onClick={() => setActiveTab('areas')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'areas'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Áreas & Tópicos
          </button>
        </div>
      </div>

      {/* Simulados List Tab */}
      {activeTab === 'simulados' && (
        history.length === 0 ? (
          <div className="text-center py-8">
            <HelpCircle className="text-slate-300 mx-auto mb-2" size={32} />
            <p className="text-sm text-slate-500 font-medium">Nenhum simulado realizado ainda.</p>
            <p className="text-xs text-slate-400 mt-1">Gere um simulado na aba ao lado para começar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-100 hover:border-slate-200 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`p-3 rounded-xl flex-shrink-0 flex items-center justify-center ${
                    item.percentage >= 80 ? 'bg-green-100 text-green-700' :
                    item.percentage >= 60 ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    <span className="text-sm font-black">{item.percentage}%</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-800 text-sm group-hover:text-purple-700 transition truncate">
                      {item.theme}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold truncate mb-1">
                      {item.subtheme}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(item.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{item.score} / {item.totalQuestions} questões</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
                    Revisar <ArrowUpRight size={14} />
                  </span>
                  <button
                    onClick={(e) => deleteHistoryItem(e, item)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white transition"
                    title="Excluir histórico"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Áreas & Tópicos Tab */}
      {activeTab === 'areas' && (
        areaStatsList.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="text-slate-300 mx-auto mb-2" size={32} />
            <p className="text-sm text-slate-500 font-medium">Sem dados suficientes de desempenho por área.</p>
            <p className="text-xs text-slate-400 mt-1">Seus resultados serão consolidados aqui conforme realizar simulados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {areaStatsList.map((area, index) => (
              <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">{area.theme}</h4>
                    <p className="text-xs text-slate-500 font-semibold">{area.subtheme}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-black ${
                      area.percentage >= 80 ? 'bg-green-100 text-green-700' :
                      area.percentage >= 60 ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {area.percentage}% acertos
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-2.5 my-2">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      area.percentage >= 80 ? 'bg-green-500' :
                      area.percentage >= 60 ? 'bg-blue-500' :
                      'bg-amber-500'
                    }`}
                    style={{ width: `${area.percentage}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                  <span>{area.simulationsCount} {area.simulationsCount === 1 ? 'simulado' : 'simulados'}</span>
                  <span>{area.totalCorrect} de {area.totalQuestions} questões respondidas</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Review Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-scaleIn flex flex-col border border-slate-100">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div className="min-w-0 pr-4 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">
                    {isEditing ? 'Editando Simulado' : 'Revisão de Simulado'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">
                    {new Date(selectedItem.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                {isEditing ? (
                  <div className="space-y-2 mt-2 w-full">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tema Principal</label>
                      <input
                        type="text"
                        value={editTheme}
                        onChange={(e) => setEditTheme(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Subtema / Tópico</label>
                      <input
                        type="text"
                        value={editSubtheme}
                        onChange={(e) => setEditSubtheme(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="text-lg font-black text-slate-800 truncate">{selectedItem.theme}</h4>
                    <p className="text-xs text-slate-500 font-semibold truncate">{selectedItem.subtheme}</p>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setIsEditing(false);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Score Bar / Edit Scores */}
            <div className="px-6 py-4 bg-slate-100 border-b border-slate-200">
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Questões Corretas (Acertos)</label>
                    <input
                      type="number"
                      min="0"
                      max={editTotalQuestions}
                      value={editScore}
                      onChange={(e) => setEditScore(Math.min(Number(e.target.value), editTotalQuestions))}
                      className="w-full px-3 py-2 text-sm font-bold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Total de Questões</label>
                    <input
                      type="number"
                      min="1"
                      value={editTotalQuestions}
                      onChange={(e) => setEditTotalQuestions(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 text-sm font-bold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Data de Realização</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-bold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-black text-purple-600">{selectedItem.score} <span className="text-slate-400 text-lg font-bold">/ {selectedItem.totalQuestions}</span></div>
                    <div className="text-xs text-slate-500 font-medium">Questões respondidas corretamente</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-bold">Aproveitamento:</span>
                    <span className={`text-sm font-black px-3 py-1 rounded-lg ${
                      selectedItem.percentage >= 80 ? 'bg-green-100 text-green-700' :
                      selectedItem.percentage >= 60 ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedItem.percentage}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Body / Questions List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Personal Notes Section */}
              <div className="p-5 bg-purple-50/40 rounded-2xl border border-purple-100/70">
                <h5 className="font-extrabold text-purple-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileEdit size={14} /> Anotações do Estudante
                </h5>
                {isEditing ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Adicione suas observações sobre este simulado, dicas que queira lembrar, ou tópicos a revisar..."
                    className="w-full h-24 p-3 text-xs text-slate-700 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium"
                  />
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold italic">
                    {selectedItem.notes || "Nenhuma anotação inserida. Clique em 'Editar Detalhes' abaixo para registrar suas observações e dicas de estudo!"}
                  </p>
                )}
              </div>

              {/* Questions Title separator */}
              {!isEditing && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider">Histórico de Questões</h5>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Gabarito detalhado</span>
                  </div>
                </div>
              )}

              {isEditing ? (
                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200 text-center py-10">
                  <HelpCircle className="text-purple-400 mx-auto mb-2" size={32} />
                  <p className="text-xs text-slate-500 font-bold">Edite os metadados do simulado nos campos acima.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Ao salvar, a porcentagem de acertos será recalculada automaticamente.</p>
                </div>
              ) : (
                (!selectedItem.questions || selectedItem.questions.length === 0) ? (
                  <div className="text-center py-12">
                    <BookOpen className="text-slate-300 mx-auto mb-3" size={40} />
                    <p className="text-slate-600 font-bold text-sm">Review detalhado indisponível</p>
                    <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                      Este simulado foi realizado antes da ativação do histórico detalhado de questões. Suas novas simulações terão suporte total a esta revisão!
                    </p>
                  </div>
                ) : (
                  selectedItem.questions.map((question, qIdx) => {
                    const userAnswer = selectedItem.userAnswers ? selectedItem.userAnswers[qIdx] : null;
                    const isCorrect = userAnswer === question.answer;

                    return (
                      <div key={qIdx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 relative">
                        {/* Badge Acerto / Erro */}
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xs font-black text-slate-400">
                            Questão {qIdx + 1}
                          </span>
                          {userAnswer ? (
                            isCorrect ? (
                              <span className="flex items-center gap-1 text-xs font-black text-green-600 bg-green-100/60 px-3 py-1 rounded-full">
                                <CheckCircle2 size={14} /> Acertou
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-black text-red-600 bg-red-100/60 px-3 py-1 rounded-full">
                                <XCircle size={14} /> Errou
                              </span>
                            )
                          ) : (
                            <span className="text-xs font-black text-slate-400 bg-slate-200 px-3 py-1 rounded-full">
                              Sem resposta
                            </span>
                          )}
                        </div>

                        <h5 className="font-extrabold text-slate-800 text-sm mb-4 leading-relaxed">
                          {stripTags(question.question)}
                        </h5>

                        <div className="space-y-2 mb-4">
                          {question.options.map((option, oIdx) => {
                            const letter = getOptionLetter(oIdx);
                            const isUserChoice = userAnswer === letter;
                            const isCorrectChoice = letter === question.answer;

                            let optionStyle = "border-slate-200 bg-white text-slate-700";
                            if (isCorrectChoice) {
                              optionStyle = "border-green-500 bg-green-50 text-green-900 font-semibold";
                            } else if (isUserChoice && !isCorrectChoice) {
                              optionStyle = "border-red-500 bg-red-50 text-red-900";
                            }

                            return (
                              <div
                                key={oIdx}
                                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${optionStyle}`}
                              >
                                <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[10px] ${
                                  isCorrectChoice
                                    ? 'bg-green-600 text-white'
                                    : isUserChoice && !isCorrectChoice
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {letter}
                                </span>
                                <span className="flex-1 leading-relaxed">
                                  {cleanOptionText(option)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        {question.explanation && (
                          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 mt-2 text-xs">
                            <p className="font-extrabold text-purple-800 mb-1 flex items-center gap-1">
                              <BookOpen size={12} /> Explicação da Questão:
                            </p>
                            <p className="text-slate-600 leading-relaxed font-medium">
                              {stripTags(question.explanation)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50">
              <div>
                {!isEditing && (
                  <button
                    onClick={() => {
                      if (selectedItem) {
                        setItemToDelete(selectedItem);
                      }
                    }}
                    className="flex items-center gap-1 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-bold text-xs transition"
                  >
                    <Trash2 size={14} /> Excluir Registro
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveChanges(selectedItem.id)}
                      className="flex items-center gap-1 px-5 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl hover:bg-purple-700 transition"
                    >
                      <Save size={14} /> Salvar Alterações
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(selectedItem)}
                      className="flex items-center gap-1 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-100 font-bold text-xs rounded-xl hover:bg-purple-100 transition"
                    >
                      <Pencil size={14} /> Editar Detalhes
                    </button>
                    <button
                      onClick={() => {
                        setSelectedItem(null);
                        setIsEditing(false);
                      }}
                      className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition"
                    >
                      Fechar Revisão
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-scaleIn">
            <h4 className="text-base font-black text-slate-800 mb-2">Excluir Simulado?</h4>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Tem certeza de que deseja excluir permanentemente o registro de simulado de <span className="font-extrabold text-purple-700">"{itemToDelete.theme}"</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!userId || !itemToDelete) return;
                  try {
                    await deleteDoc(doc(db, 'users', userId, 'simulation_history', itemToDelete.id));
                    await syncAndRecalculateUserStats(userId);
                    if (selectedItem?.id === itemToDelete.id) {
                      setSelectedItem(null);
                    }
                    setItemToDelete(null);
                    setSuccessMsg("Simulado excluído e estatísticas sincronizadas!");
                    setTimeout(() => setSuccessMsg(null), 3000);
                  } catch (err) {
                    console.error("Erro ao deletar:", err);
                    setErrorMsg("Não foi possível excluir o simulado.");
                    setTimeout(() => setErrorMsg(null), 3000);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition"
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alerts/Toasts */}
      {(successMsg || errorMsg) && (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-sm animate-slideUp">
          {successMsg && (
            <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-bold">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2 bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-bold">
              <XCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
