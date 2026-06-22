'use client';
import { useState } from 'react';
import ReportsNinos from './ReportsNinos';
import ReportsCuidadores from './ReportsCuidadores';

export default function ReportsPanel() {
  const [activeTab, setActiveTab] = useState<'ninos' | 'cuidadores'>('ninos');

  return (
    <div className="w-full flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300 relative">
      <div className="flex bg-slate-200/50 p-1 rounded-2xl mb-5 shadow-inner w-full sm:w-[400px] self-center z-10 shrink-0">
        <button
          onClick={() => setActiveTab('ninos')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'ninos'
              ? 'bg-white text-indigo-600 shadow-md scale-100'
              : 'text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50'
          }`}
        >
          Niños
        </button>
        <button
          onClick={() => setActiveTab('cuidadores')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'cuidadores'
              ? 'bg-white text-emerald-600 shadow-md scale-100'
              : 'text-slate-500 hover:text-slate-700 scale-95 hover:bg-slate-200/50'
          }`}
        >
          Cuidadores
        </button>
      </div>

      <div className="flex-1 w-full relative h-full overflow-y-auto">
        <div className={`transition-all duration-500 ${activeTab === 'ninos' ? 'opacity-100 translate-x-0 block' : 'opacity-0 -translate-x-4 hidden'}`}>
          <ReportsNinos />
        </div>
        <div className={`transition-all duration-500 ${activeTab === 'cuidadores' ? 'opacity-100 translate-x-0 block' : 'opacity-0 translate-x-4 hidden'}`}>
          <ReportsCuidadores />
        </div>
      </div>
    </div>
  );
}
