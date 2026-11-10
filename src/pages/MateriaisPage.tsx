import MaterialGenerator from '../components/MaterialGenerator';
import EditalInfo from '../components/EditalInfo';

export default function MateriaisPage() {
  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Materiais de Estudo</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Gere resumos personalizados alinhados ao edital.</p>
        </div>
      </div>
      
      <div className="space-y-8">
        <MaterialGenerator />
        <EditalInfo />
      </div>
    </div>
  );
}


