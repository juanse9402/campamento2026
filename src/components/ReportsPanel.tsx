'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Phone, Users, UserCheck, UserX, Loader2,
  CheckCircle2, PhoneOff, Download, FileSpreadsheet,
  Search, X, Calendar, ChevronRight, ChevronDown, User
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { IS_MOCK_MODE, MOCK_NINOS, MOCK_ASISTENCIAS } from '@/lib/mockData';
import { getTodayLocalStr } from '@/lib/dateUtils';
import { Nino, Asistencia } from '@/types';

// ─── Constantes ───────────────────────────────────────────────────────────────
type CallStatus = 'pending' | 'answered' | 'no-contact';

const GRUPOS = ['Todos', 'STEPHANY', 'ANDREA', 'JULIANA', 'SAIN', 'GORKA'];

const GRUPO_COLORS: Record<string, { btn: string; active: string }> = {
  STEPHANY: { btn: 'border-violet-200 text-violet-700 bg-violet-50',  active: 'bg-violet-600 border-violet-600 text-white shadow-violet-200' },
  ANDREA:   { btn: 'border-sky-200 text-sky-700 bg-sky-50',           active: 'bg-sky-600 border-sky-600 text-white shadow-sky-200' },
  JULIANA:  { btn: 'border-pink-200 text-pink-700 bg-pink-50',        active: 'bg-pink-600 border-pink-600 text-white shadow-pink-200' },
  SAIN:     { btn: 'border-amber-200 text-amber-700 bg-amber-50',     active: 'bg-amber-500 border-amber-500 text-white shadow-amber-200' },
  GORKA:    { btn: 'border-emerald-200 text-emerald-700 bg-emerald-50', active: 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200' },
};
const BADGE_COLORS: Record<string, string> = {
  STEPHANY: 'bg-violet-100 text-violet-700 border-violet-200',
  ANDREA:   'bg-sky-100 text-sky-700 border-sky-200',
  JULIANA:  'bg-pink-100 text-pink-700 border-pink-200',
  SAIN:     'bg-amber-100 text-amber-700 border-amber-200',
  GORKA:    'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// ─── Helper: formatear fecha bonita ──────────────────────────────────────────
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Exportar Excel ───────────────────────────────────────────────────────────
function buildExcel(ninos: Nino[], allAsistencias: Asistencia[]): XLSX.WorkBook {
  const wb    = XLSX.utils.book_new();
  const fechas = [...new Set(allAsistencias.map(a => a.fecha))].sort();
  const asistMap = new Map<string, boolean>();
  allAsistencias.forEach(a => asistMap.set(`${a.nino_id}_${a.fecha}`, a.asistio));

  // Hoja 1: pivot niño × día
  const pivotRows = ninos.map(n => {
    const row: Record<string, string | number> = {
      'Nombre': n.nombre, 'Apellido': n.apellido, 'Grupo': n.grupo ?? '',
    };
    fechas.forEach(f => {
      const val = asistMap.get(`${n.id}_${f}`);
      row[fmtDate(f)] = val === true ? '✓' : val === false ? '✗' : '—';
    });
    return row;
  });
  const wspivot = XLSX.utils.json_to_sheet(pivotRows);
  wspivot['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 12 }, ...fechas.map(() => ({ wch: 12 }))];
  XLSX.utils.book_append_sheet(wb, wspivot, 'Asistencia por Día');

  // Hoja 2: resumen faltantes
  const totalDias = fechas.length;
  const summaryRows = ninos.map(n => {
    const registros = allAsistencias.filter(a => a.nino_id === n.id);
    const presentes = registros.filter(a => a.asistio).length;
    const ausentes  = registros.filter(a => !a.asistio).length;
    const pct       = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;
    return {
      'Nombre': n.nombre, 'Apellido': n.apellido, 'Grupo': n.grupo ?? '',
      'Total Días': totalDias, 'Días Presentes': presentes,
      'Días Ausentes': ausentes, 'Sin Registro': totalDias - registros.length,
      '% Asistencia': `${pct}%`,
      'Acudiente': n.acudiente_nombre ?? '', 'Teléfono': n.acudiente_telefono ?? '',
    };
  }).sort((a, b) => (b['Días Ausentes'] as number) - (a['Días Ausentes'] as number));

  const wssummary = XLSX.utils.json_to_sheet(summaryRows);
  wssummary['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 24 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wssummary, 'Faltantes por Niño');
  return wb;
}

// ─── Tarjeta historial de un niño ─────────────────────────────────────────────
function NinoHistoryCard({ nino, onClose }: { nino: Nino; onClose: () => void }) {
  const [history, setHistory]   = useState<Asistencia[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (IS_MOCK_MODE) {
          const todayStr = getTodayLocalStr();
          const mock = Object.values(MOCK_ASISTENCIAS).filter(a => a.nino_id === nino.id);
          setHistory(mock);
        } else {
          const { data, error } = await supabase
            .from('asistencia')
            .select('*')
            .eq('nino_id', nino.id)
            .order('fecha');
          if (error) throw error;
          setHistory((data || []) as Asistencia[]);
        }
      } catch (err) {
        console.error(err);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [nino.id]);

  const presentes = history.filter(h => h.asistio).length;
  const ausentes  = history.filter(h => !h.asistio).length;
  const pct       = history.length > 0 ? Math.round((presentes / history.length) * 100) : 0;
  const grupo     = (nino.grupo ?? '').toUpperCase();
  const badgeCls  = BADGE_COLORS[grupo] || 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 flex items-start justify-between">
        <div>
          <h3 className="text-white font-black text-base leading-tight">
            {nino.nombre} {nino.apellido}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {grupo && (
              <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                {grupo.charAt(0) + grupo.slice(1).toLowerCase()}
              </span>
            )}
            {nino.acudiente_nombre && (
              <span className="text-xs text-indigo-200 flex items-center gap-1">
                <User size={10} />{nino.acudiente_nombre}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors flex-shrink-0">
          <X size={18} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <div className="py-3 text-center">
          <p className="text-lg font-black text-slate-700">{history.length}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Días</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-lg font-black text-emerald-600">{presentes}</p>
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Presente</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-lg font-black text-rose-500">{ausentes}</p>
          <p className="text-xs font-bold text-rose-400 uppercase tracking-wide">Ausente</p>
        </div>
      </div>

      {/* Barra de progreso */}
      {history.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
            <span>Asistencia total</span>
            <span className={pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'}>
              {pct}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Historial día a día */}
      <div className="px-5 py-4 max-h-56 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-indigo-400">
            <Loader2 size={22} className="animate-spin mr-2" />
            <span className="text-sm font-medium">Cargando historial...</span>
          </div>
        ) : history.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4 font-medium">
            Sin registros de asistencia.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-600">{fmtDate(h.fecha)}</span>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  h.asistio
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-600'
                }`}>
                  {h.asistio ? '✓ Presente' : '✗ Ausente'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ReportsPanel() {
  const [ninos, setNinos]             = useState<Nino[]>([]);
  const [asistencias, setAsistencias] = useState<Record<string, Asistencia>>({});
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<'all' | 'absent'>('all');
  const [selectedGrupo, setSelectedGrupo] = useState('Todos');
  const [callStatus, setCallStatus]   = useState<Record<string, CallStatus>>({});
  const [exporting, setExporting]     = useState(false);

  // Reporte por niño
  const [childSearch, setChildSearch]   = useState('');
  const [selectedNino, setSelectedNino] = useState<Nino | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const todayStr = getTodayLocalStr();

  useEffect(() => { fetchData(); }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    if (IS_MOCK_MODE) {
      setNinos(MOCK_NINOS);
      setAsistencias(MOCK_ASISTENCIAS);
      setLoading(false);
      return;
    }
    try {
      const [ninosRes, asistRes] = await Promise.all([
        supabase.from('ninos').select('*').order('apellido'),
        supabase.from('asistencia').select('*').eq('fecha', todayStr),
      ]);
      if (ninosRes.error) throw ninosRes.error;
      if (asistRes.error) throw asistRes.error;
      setNinos(ninosRes.data || []);
      const asistMap: Record<string, Asistencia> = {};
      (asistRes.data || []).forEach(a => { asistMap[a.nino_id] = a; });
      setAsistencias(asistMap);
    } catch (err) {
      console.error(err);
      setNinos(MOCK_NINOS);
      setAsistencias(MOCK_ASISTENCIAS);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let allAsistencias: Asistencia[] = [];
      if (IS_MOCK_MODE) {
        allAsistencias = Object.values(MOCK_ASISTENCIAS);
      } else {
        const { data, error } = await supabase.from('asistencia').select('*').order('fecha');
        if (error) throw error;
        allAsistencias = (data || []) as Asistencia[];
      }
      const ninosTarget = selectedGrupo === 'Todos'
        ? ninos
        : ninos.filter(n => (n.grupo ?? '').toUpperCase() === selectedGrupo);
      const wb = buildExcel(ninosTarget, allAsistencias);
      const grupoLabel = selectedGrupo === 'Todos' ? 'Todos' : selectedGrupo;
      XLSX.writeFile(wb, `Campamento_Reporte_${grupoLabel}_${todayStr}.xlsx`);
    } catch (err) {
      console.error('Error exporting:', err);
      alert('Error al generar el Excel. Verifica tu conexión.');
    } finally {
      setExporting(false);
    }
  };

  const handleCall = (ninoId: string) => setCallStatus(prev => ({ ...prev, [ninoId]: 'pending' }));
  const setResult  = (ninoId: string, result: 'answered' | 'no-contact') =>
    setCallStatus(prev => ({ ...prev, [ninoId]: result }));

  // ── Filtros ────────────────────────────────────────────────────────────────
  const ninosByGrupo = ninos.filter(n =>
    selectedGrupo === 'Todos' || (n.grupo ?? '').toUpperCase() === selectedGrupo
  );
  const presentCount = ninosByGrupo.filter(n => asistencias[n.id]?.asistio === true).length;
  const absentNinos  = ninosByGrupo.filter(n => {
    const s = asistencias[n.id]; return !s || s.asistio === false;
  });
  const displayedNinos = filter === 'all' ? ninosByGrupo : absentNinos;

  const grupoSummary = (g: string) => {
    const subset = g === 'Todos' ? ninos : ninos.filter(n => (n.grupo ?? '').toUpperCase() === g);
    const pres   = subset.filter(n => asistencias[n.id]?.asistio === true).length;
    return { total: subset.length, pres };
  };

  // Búsqueda de niño
  const searchResults = childSearch.length >= 2
    ? ninos.filter(n =>
        `${n.nombre} ${n.apellido}`.toLowerCase().includes(childSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-indigo-500">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-medium animate-pulse">Generando reporte...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-6">

      {/* ── Filtro de grupo ────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grupo</span>
        </div>
        <select
          value={selectedGrupo}
          onChange={e => setSelectedGrupo(e.target.value)}
          className="w-full pl-20 pr-10 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-800 font-bold text-base focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all appearance-none cursor-pointer"
        >
          {GRUPOS.map(g => (
            <option key={g} value={g}>{g === 'Todos' ? '👥 Todos los grupos' : `🏷️ ${g}`}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <ChevronDown size={18} className="text-slate-400" />
        </div>
      </div>

      {/* ── Métricas ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col items-center text-center">
          <div className="bg-indigo-100 p-2 rounded-full mb-2"><Users className="text-indigo-600" size={20} /></div>
          <span className="text-2xl font-black text-slate-800 leading-none">{ninosByGrupo.length}</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Inscritos</span>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 shadow-sm border border-emerald-100 flex flex-col items-center text-center">
          <div className="bg-emerald-100 p-2 rounded-full mb-2"><UserCheck className="text-emerald-600" size={20} /></div>
          <span className="text-2xl font-black text-emerald-700 leading-none">{presentCount}</span>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-1">Asisten</span>
        </div>
        <div className="bg-rose-50 rounded-2xl p-4 shadow-sm border border-rose-100 flex flex-col items-center text-center">
          <div className="bg-rose-100 p-2 rounded-full mb-2"><UserX className="text-rose-600" size={20} /></div>
          <span className="text-2xl font-black text-rose-600 leading-none">{absentNinos.length}</span>
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider mt-1">Ausentes</span>
        </div>
      </div>

      {/* ── Barra de progreso ────────────────────────────────────────────────── */}
      {ninosByGrupo.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
            <span>Asistencia del día</span>
            <span className="text-indigo-600">
              {Math.round((presentCount / ninosByGrupo.length) * 100)}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${(presentCount / ninosByGrupo.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Reporte por niño ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Calendar size={13} />
          Historial por niño
        </p>

        {/* Buscador */}
        <div ref={searchRef} className="relative">
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-400 bg-slate-50 focus-within:bg-white transition-all">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar niño por nombre..."
              value={childSearch}
              onChange={e => { setChildSearch(e.target.value); setShowDropdown(true); setSelectedNino(null); }}
              onFocus={() => setShowDropdown(true)}
              className="flex-1 bg-transparent text-sm text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none"
            />
            {childSearch && (
              <button onClick={() => { setChildSearch(''); setSelectedNino(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={15} />
              </button>
            )}
          </div>

          {/* Dropdown resultados */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
              {searchResults.map(n => {
                const grupo  = (n.grupo ?? '').toUpperCase();
                const badge  = BADGE_COLORS[grupo] || 'bg-slate-100 text-slate-600 border-slate-200';
                return (
                  <button
                    key={n.id}
                    onClick={() => { setSelectedNino(n); setChildSearch(`${n.nombre} ${n.apellido}`); setShowDropdown(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{n.nombre} {n.apellido}</p>
                      {grupo && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${badge}`}>
                          {grupo.charAt(0) + grupo.slice(1).toLowerCase()}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </button>
                );
              })}
            </div>
          )}

          {showDropdown && childSearch.length >= 2 && searchResults.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 px-4 py-3 text-sm text-slate-400 font-medium">
              Sin resultados para "{childSearch}"
            </div>
          )}
        </div>

        {/* Tarjeta historial */}
        {selectedNino && (
          <div className="mt-3">
            <NinoHistoryCard
              nino={selectedNino}
              onClose={() => { setSelectedNino(null); setChildSearch(''); }}
            />
          </div>
        )}
      </div>

      {/* ── Botón exportar Excel ─────────────────────────────────────────────── */}
      <button
        onClick={handleExport}
        disabled={exporting || ninos.length === 0}
        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-all shadow-md shadow-emerald-200 active:scale-[0.98] group"
      >
        {exporting
          ? <><Loader2 size={20} className="animate-spin" /> Generando Excel...</>
          : <>
              <FileSpreadsheet size={20} className="group-hover:scale-110 transition-transform" />
              <span>Descargar Excel{selectedGrupo !== 'Todos' && <span className="ml-1 font-normal opacity-80">· {selectedGrupo.charAt(0) + selectedGrupo.slice(1).toLowerCase()}</span>}</span>
              <Download size={16} className="opacity-70" />
            </>
        }
      </button>
      <p className="text-xs text-slate-400 text-center -mt-3 font-medium">
        2 hojas: Asistencia por Día · Faltantes por Niño
      </p>

      {/* ── Pestañas ─────────────────────────────────────────────────────────── */}
      <div className="flex p-1 bg-slate-200/60 rounded-xl">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Ver Todos
        </button>
        <button
          onClick={() => setFilter('absent')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${filter === 'absent' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Ver Ausentes{' '}
          {absentNinos.length > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${filter === 'absent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-300 text-slate-600'}`}>
              {absentNinos.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Lista ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {displayedNinos.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 font-medium text-lg">
              {filter === 'absent' ? '🎉 ¡Todos presentes en este grupo!' : 'No hay registros para mostrar.'}
            </p>
          </div>
        ) : (
          displayedNinos.map(nino => {
            const status   = asistencias[nino.id];
            const isAbsent = !status || status.asistio === false;
            const call     = callStatus[nino.id];
            const grupo    = (nino.grupo ?? '').toUpperCase();
            const badgeCls = BADGE_COLORS[grupo] || 'bg-slate-100 text-slate-600 border-slate-200';

            const callBtnStyle = !call
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200'
              : call === 'answered'
              ? 'bg-emerald-500 text-white border border-emerald-600 shadow-md'
              : 'bg-rose-500 text-white border border-rose-600 shadow-md';

            return (
              <div
                key={nino.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all hover:shadow-md flex flex-col gap-3
                  ${isAbsent && filter === 'absent' ? 'border-rose-100' : 'border-slate-100'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-base leading-tight truncate">
                      {nino.nombre} {nino.apellido}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {grupo && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badgeCls}`}>
                          {grupo.charAt(0) + grupo.slice(1).toLowerCase()}
                        </span>
                      )}
                      <span className={`text-xs font-bold ${status?.asistio ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {status?.asistio ? '✓ Presente' : '✗ Ausente'}
                      </span>
                    </div>
                  </div>
                  {/* Botón ver historial */}
                  <button
                    onClick={() => { setSelectedNino(nino); setChildSearch(`${nino.nombre} ${nino.apellido}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1.5 rounded-full transition-all"
                  >
                    <Calendar size={12} /> Ver
                  </button>
                </div>

                {isAbsent && (
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Acudiente</p>
                        <p className="font-semibold text-slate-700 text-sm truncate">{nino.acudiente_nombre || '—'}</p>
                        {nino.acudiente_telefono && <p className="text-xs text-slate-400 mt-0.5">{nino.acudiente_telefono}</p>}
                      </div>
                      <a
                        href={`tel:${nino.acudiente_telefono || ''}`}
                        onClick={() => handleCall(nino.id)}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 ${callBtnStyle}`}
                      >
                        {!call && <Phone size={16} />}
                        {call === 'answered' && <CheckCircle2 size={16} />}
                        {call === 'no-contact' && <PhoneOff size={16} />}
                        {!call ? 'Llamar' : call === 'answered' ? 'Contestó' : 'Sin contacto'}
                      </a>
                    </div>
                    {call && (
                      <div className="flex gap-2 mt-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <button
                          onClick={() => setResult(nino.id, 'answered')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95
                            ${call === 'answered' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                        >
                          <CheckCircle2 size={15} /> Contestó
                        </button>
                        <button
                          onClick={() => setResult(nino.id, 'no-contact')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95
                            ${call === 'no-contact' ? 'bg-rose-500 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}
                        >
                          <PhoneOff size={15} /> No contestó
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
