export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <p className="text-slate-500 mt-4">Página em construção...</p>
    </div>
  );
}
