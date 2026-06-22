'use client';
import { useState } from 'react';
import NinosAttendance from './NinosAttendance';
import CuidadoresAttendance from './CuidadoresAttendance';

export default function AttendanceList() {
  const [activeTab, setActiveTab] = useState<'ninos' | 'cuidadores'>('ninos');

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Navigation Tabs */}
      <div className="px-4 pt-4 pb-2 bg-slate-50 sticky top-0 z-20">
        <div className="flex bg-slate-200/60 p-1 rounded-xl shadow-inner border border-slate-200/50">
          <button
            onClick={() => setActiveTab('ninos')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'ninos'
                ? 'bg-white text-indigo-700 shadow shadow-indigo-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>🧒</span> Niños
          </button>
          <button
            onClick={() => setActiveTab('cuidadores')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'cuidadores'
                ? 'bg-white text-indigo-700 shadow shadow-indigo-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>👨‍🏫</span> Cuidadores
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 pb-4">
        {activeTab === 'ninos' ? <NinosAttendance /> : <CuidadoresAttendance />}
      </div>
    </div>
  );
}
