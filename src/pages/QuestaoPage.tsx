import QuestionGenerator from '../components/QuestionGenerator';

export default function QuestaoPage() {
  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Questões</h1>
      <QuestionGenerator />
    </div>
  );
}
