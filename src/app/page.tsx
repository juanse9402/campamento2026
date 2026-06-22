'use client';
import { useState } from 'react';
import AttendanceList from '@/components/AttendanceList';
import ReportsPanel from '@/components/ReportsPanel';
import DataImport from '@/components/DataImport';
import { Users, ClipboardList, Database } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'reports' | 'import'>('attendance');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white shadow-sm pt-8 pb-4 px-4 sticky top-0 z-10 border-b border-slate-200">
        <h1 className="text-2xl font-black text-center text-indigo-600 tracking-tight">Campamento ☀️</h1>
        <p className="text-center text-slate-500 text-sm font-medium">Control de Asistencia</p>
      </header>

      <main className="p-4 max-w-lg mx-auto w-full">
        {activeTab === 'attendance' && <AttendanceList />}
        {activeTab === 'reports' && <ReportsPanel />}
        {activeTab === 'import' && <DataImport />}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] pb-safe">
        <button 
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${activeTab === 'attendance' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <ClipboardList size={18} className="mb-0.5" />
          <span className="text-[9px] font-extrabold uppercase tracking-widest">Asistencia</span>
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${activeTab === 'reports' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Users size={18} className="mb-0.5" />
          <span className="text-[9px] font-extrabold uppercase tracking-widest">Reportes</span>
        </button>
        <button 
          onClick={() => setActiveTab('import')}
          className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${activeTab === 'import' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Database size={18} className="mb-0.5" />
          <span className="text-[9px] font-extrabold uppercase tracking-widest">Datos</span>
        </button>
      </nav>
    </div>
  );
}
