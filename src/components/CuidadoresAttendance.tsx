'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, CheckCircle2, XCircle, Loader2,
  ShieldAlert, UserCog, ChevronDown, X, Save,
  Phone, User, WifiOff, RefreshCw, CloudOff, Wifi
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { IS_MOCK_MODE } from '@/lib/mockData';
import { getTodayLocalStr } from '@/lib/dateUtils';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import {
  enqueueCuidador, dequeueCuidador, getCuidadoresQueue, pendingCuidadoresCount,
  saveCuidadoresCache, loadCuidadoresCache,
  saveAsistenciasCuidadoresCache, loadAsistenciasCuidadoresCache,
} from '@/lib/offlineQueue';
import { Cuidador, AsistenciaCuidador } from '@/types';

// ─── Toast de notificación ────────────────────────────────────────────────────
type ToastType = 'error' | 'success' | 'info';
interface ToastProps { message: string; type: ToastType; onDismiss: () => void; }

function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, type === 'success' ? 3500 : 5000);
    return () => clearTimeout(t);
  }, [onDismiss, type]);

  const styles: Record<ToastType, string> = {
    error:   'bg-rose-700',
    success: 'bg-emerald-700',
    info:    'bg-indigo-700',
  };
  const Icon = type === 'error' ? WifiOff : type === 'success' ? CheckCircle2 : RefreshCw;

  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`flex items-start gap-3 ${styles[type]} text-white rounded-2xl shadow-2xl px-4 py-3.5`}>
        <Icon size={18} className="flex-shrink-0 mt-0.5" />
        <p className="text-sm font-semibold flex-1 leading-snug">{message}</p>
        <button onClick={onDismiss} className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Banner offline permanente ────────────────────────────────────────────────
function OfflineBanner({ pending, syncing }: { pending: number; syncing: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-slate-800 text-white rounded-2xl px-4 py-3 shadow-lg animate-in fade-in duration-300">
      {syncing
        ? <RefreshCw size={18} className="flex-shrink-0 animate-spin text-indigo-300" />
        : <CloudOff size={18} className="flex-shrink-0 text-slate-300" />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">
          {syncing ? 'Sincronizando datos...' : 'Sin conexión a internet'}
        </p>
        {pending > 0 && !syncing && (
          <p className="text-xs text-slate-400 mt-0.5">
            {pending} {pending === 1 ? 'cambio pendiente' : 'cambios pendientes'} — se guardarán al reconectar
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Alerta médica (tooltip) ───────────────────────────────────────────────────
function MedicalAlert({ observacion }: { observacion: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        title="Ver observación médica"
        aria-label="Observación médica"
        className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-600 transition-all hover:scale-110 active:scale-95 shadow-sm border border-amber-200"
      >
        <ShieldAlert size={16} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-10 z-50 w-64 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-150"
          role="tooltip"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Observación médica</p>
              <p className="text-sm text-amber-900 leading-relaxed">{observacion}</p>
            </div>
          </div>
          <div className="absolute -top-2 left-3 w-4 h-4 bg-amber-50 border-l-2 border-t-2 border-amber-300 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CuidadoresAttendance() {
  const todayStr  = getTodayLocalStr();
  const isOnline  = useOnlineStatus();

  const [cuidadores, setCuidadores]             = useState<Cuidador[]>([]);
  const [asistencias, setAsistencias] = useState<Record<string, AsistenciaCuidador>>({});
  const [savingIds, setSavingIds]     = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [diagError, setDiagError]     = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const showToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'error') =>
    setToast({ message, type }), []);

  // Offline sync state
  const [pending, setPending]   = useState(0);
  const [syncing, setSyncing]   = useState(false);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setDiagError('');

    if (IS_MOCK_MODE) {
      setCuidadores([]);
      setAsistencias({});
      setLoading(false);
      return;
    }

    // Sin conexión: carga desde caché local
    if (!isOnline) {
      const cachedNinos = loadCuidadoresCache();
      const cachedAsist = loadAsistenciasCuidadoresCache(todayStr);
      setCuidadores(cachedNinos.length ? cachedNinos : []);
      setAsistencias(cachedAsist);
      setPending(pendingCuidadoresCount());
      setLoading(false);
      return;
    }

    try {
      const [ninosRes, asistRes] = await Promise.all([
        supabase.from('cuidadores').select('*').order('apellido'),
        supabase.from('asistencia_cuidadores').select('*').eq('fecha', todayStr),
      ]);

      console.log('[Supabase] ninos →', { count: ninosRes.data?.length, error: ninosRes.error });
      console.log('[Supabase] asistencia →', { count: asistRes.data?.length, error: asistRes.error });

      if (ninosRes.error) throw new Error(`Error tabla ninos: ${ninosRes.error.message}`);
      if (asistRes.error) throw new Error(`Error tabla asistencia: ${asistRes.error.message}`);

      const data = ninosRes.data || [];

      if (data.length === 0) {
        setDiagError(
          'Supabase respondió sin error pero devolvió 0 niños. ' +
          'Verifica las políticas RLS de la tabla "ninos".'
        );
        const cached = loadCuidadoresCache();
        setCuidadores(cached.length ? cached : []);
        setAsistencias(loadAsistenciasCuidadoresCache(todayStr));
      } else {
        setCuidadores(data);
        const asistMap: Record<string, AsistenciaCuidador> = {};
        (asistRes.data || []).forEach(a => { asistMap[a.cuidador_id] = a; });
        setAsistencias(asistMap);

        // Guardar en caché para uso offline
        saveCuidadoresCache(data);
        saveAsistenciasCuidadoresCache(todayStr, asistMap);
      }

      setPending(pendingCuidadoresCount());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Supabase] fetchData error:', msg);
      setDiagError(`Error de conexión: ${msg}`);

      // Fallback a caché local
      const cached = loadCuidadoresCache();
      setCuidadores(cached.length ? cached : []);
      setAsistencias(loadAsistenciasCuidadoresCache(todayStr));
      setPending(pendingCuidadoresCount());
    } finally {
      setLoading(false);
    }
  };

  // ── Sincronizar cola cuando se recupera la conexión ───────────────────────
  const syncQueue = useCallback(async () => {
    const queue = getCuidadoresQueue();
    if (queue.length === 0 || IS_MOCK_MODE) return;

    setSyncing(true);
    let synced = 0;
    const errors: string[] = [];

    for (const item of queue) {
      try {
        const { error } = await supabase
          .from('asistencia_cuidadores')
          .upsert(
            { cuidador_id: item.cuidador_id, fecha: item.fecha, asistio: item.asistio },
            { onConflict: 'cuidador_id,fecha' }
          );
        if (error) throw error;
        dequeueCuidador(item.cuidador_id, item.fecha);
        synced++;
      } catch (err) {
        errors.push(item.cuidador_id);
        console.error('[Sync] failed for', item.cuidador_id, err);
      }
    }

    const remaining = pendingCuidadoresCount();
    setPending(remaining);
    setSyncing(false);

    if (synced > 0 && remaining === 0) {
      showToast(`✅ ${synced} registro${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''} correctamente.`, 'success');
    } else if (remaining > 0) {
      showToast(`${synced} sincronizados, ${remaining} pendientes. Revisa tu conexión.`, 'error');
    }
  }, [showToast]);

  // Auto-sync cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && !IS_MOCK_MODE) {
      syncQueue();
    }
  }, [isOnline, syncQueue]);

  // ── Registrar asistencia ───────────────────────────────────────────────────
  const toggleAttendance = async (ninoId: string, isPresent: boolean) => {
    const previous = asistencias[ninoId];

    // ① UI optimista: cambia color inmediatamente
    const optimistic: AsistenciaCuidador = {
      id:      previous?.id ?? `optimistic-${ninoId}`,
      cuidador_id: ninoId,
      fecha:   todayStr,
      asistio: isPresent,
    };
    const newAsistencias = { ...asistencias, [ninoId]: optimistic };
    setAsistencias(newAsistencias);

    // ② Actualizar caché local con el nuevo valor
    saveAsistenciasCuidadoresCache(todayStr, newAsistencias);

    if (IS_MOCK_MODE) return;

    // ③ Sin conexión → encolar y no mostrar error
    if (!isOnline) {
      enqueueCuidador({ cuidador_id: ninoId, fecha: todayStr, asistio: isPresent });
      setPending(pendingCuidadoresCount());
      return;
    }

    setSavingIds(prev => new Set(prev).add(ninoId));

    try {
      // ④ Upsert en Supabase
      const { data, error } = await supabase
        .from('asistencia_cuidadores')
        .upsert(
          { cuidador_id: ninoId, fecha: todayStr, asistio: isPresent },
          { onConflict: 'cuidador_id,fecha' }
        )
        .select()
        .single();

      if (error) throw error;

      // ⑤ Confirmar con ID real devuelto por Supabase
      if (data) {
        const confirmed = { ...newAsistencias, [ninoId]: data as AsistenciaCuidador };
        setAsistencias(confirmed);
        saveAsistenciasCuidadoresCache(todayStr, confirmed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Supabase] Error upserting attendance:', msg);

      // ⑥ Error de red → encolar para sincronizar después
      enqueueCuidador({ cuidador_id: ninoId, fecha: todayStr, asistio: isPresent });
      setPending(pendingCuidadoresCount());
      showToast('Sin conexión. El cambio se guardó localmente y se sincronizará al reconectar.', 'info');
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(ninoId); return n; });
    }
  };

  // Removed Edit logic

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const baseCuidadores = cuidadores.filter(n => {
    return `${n.nombre} ${n.apellido}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const presentCount = baseCuidadores.filter(n => asistencias[n.id]?.asistio === true).length;
  const absentCount  = baseCuidadores.filter(n => asistencias[n.id]?.asistio === false).length;

  const filteredCuidadores = statusFilter === 'all'
    ? baseCuidadores
    : statusFilter === 'present'
    ? baseCuidadores.filter(n => asistencias[n.id]?.asistio === true)
    : baseCuidadores.filter(n => asistencias[n.id]?.asistio === false);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-indigo-500">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-medium animate-pulse">
          {!isOnline ? 'Cargando desde caché local...' : 'Cargando lista...'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* ── Banner offline ──────────────────────────────────────────────── */}
        {(!isOnline || syncing) && (
          <OfflineBanner pending={pending} syncing={syncing} />
        )}

        {/* ── Indicador: cambios pendientes (online) ─────────────────────── */}
        {isOnline && !syncing && pending > 0 && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
            <Wifi size={16} className="text-indigo-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-indigo-700 flex-1">
              {pending} {pending === 1 ? 'cambio pendiente' : 'cambios pendientes'} por sincronizar
            </p>
            <button
              onClick={syncQueue}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
            >
              Sincronizar ahora
            </button>
          </div>
        )}

        {/* ── Banner de diagnóstico RLS ───────────────────────────────────── */}
        {diagError && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 flex flex-col gap-2">
            <p className="text-sm font-black text-amber-800">🔧 Problema de acceso a Supabase</p>
            <p className="text-xs text-amber-700 leading-relaxed">{diagError}</p>
            <button onClick={fetchData} className="mt-1 self-start text-xs font-bold text-amber-800 underline hover:text-amber-950">
              Reintentar conexión →
            </button>
          </div>
        )}

        {/* ── Búsqueda ───────────────────────────────────────────────────── */}
        <div className="relative shadow-sm rounded-2xl bg-white overflow-hidden border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-all">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-4 bg-transparent border-0 text-slate-900 placeholder:text-slate-400 focus:ring-0 sm:text-lg font-medium"
            placeholder="Buscar por nombre o apellido..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ── Estadísticas / Filtros de estado ───────────────────────────── */}
        {baseCuidadores.length > 0 && (
          <div className="flex gap-3">
            {/* Total */}
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 rounded-2xl border px-4 py-3 text-center transition-all active:scale-95 ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-200'
                  : 'bg-white border-slate-100 shadow-sm hover:border-indigo-200'
              }`}
            >
              <p className={`text-2xl font-black ${statusFilter === 'all' ? 'text-white' : 'text-slate-700'}`}>
                {baseCuidadores.length}
              </p>
              <p className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'all' ? 'text-indigo-200' : 'text-slate-400'}`}>
                Total
              </p>
            </button>
            {/* Presentes */}
            <button
              onClick={() => setStatusFilter('present')}
              className={`flex-1 rounded-2xl border px-4 py-3 text-center transition-all active:scale-95 ${
                statusFilter === 'present'
                  ? 'bg-emerald-600 border-emerald-600 shadow-md shadow-emerald-200'
                  : 'bg-emerald-50 border-emerald-100 shadow-sm hover:border-emerald-300'
              }`}
            >
              <p className={`text-2xl font-black ${statusFilter === 'present' ? 'text-white' : 'text-emerald-600'}`}>
                {presentCount}
              </p>
              <p className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'present' ? 'text-emerald-200' : 'text-emerald-400'}`}>
                Presentes
              </p>
            </button>
            {/* Ausentes */}
            <button
              onClick={() => setStatusFilter('absent')}
              className={`flex-1 rounded-2xl border px-4 py-3 text-center transition-all active:scale-95 ${
                statusFilter === 'absent'
                  ? 'bg-rose-600 border-rose-600 shadow-md shadow-rose-200'
                  : 'bg-rose-50 border-rose-100 shadow-sm hover:border-rose-300'
              }`}
            >
              <p className={`text-2xl font-black ${statusFilter === 'absent' ? 'text-white' : 'text-rose-500'}`}>
                {absentCount}
              </p>
              <p className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'absent' ? 'text-rose-200' : 'text-rose-400'}`}>
                Ausentes
              </p>
            </button>
          </div>
        )}

        {/* ── Lista ──────────────────────────────────────────────────────── */}
        <div className="space-y-3 pb-6">
          {filteredCuidadores.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 font-medium text-lg">No se encontraron cuidadores.</p>
            </div>
          ) : (
            filteredCuidadores.map(cuidador => {
              const status     = asistencias[cuidador.id];
              const isPresent  = status?.asistio === true;
              const isAbsent   = status?.asistio === false;
              const isSaving   = savingIds.has(cuidador.id);
              const isPending  = !isOnline && (isPresent || isAbsent);

              return (
                <div
                  key={cuidador.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 transition-all hover:shadow-md"
                >
                  {/* Fila superior */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-base leading-tight truncate">
                          {cuidador.nombre} {cuidador.apellido}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {cuidador.grupo && (
                            <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                              {cuidador.grupo}
                            </span>
                          )}
                          {isPending && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CloudOff size={10} /> pendiente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botones de asistencia */}
                    <div className={`flex bg-slate-100 rounded-full p-0.5 border border-slate-200 shadow-inner flex-shrink-0 transition-opacity ${isSaving ? 'opacity-60' : 'opacity-100'}`}>
                      <button
                        onClick={() => !isSaving && toggleAttendance(cuidador.id, true)}
                        disabled={isSaving}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${isPresent ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        {isSaving && isPresent
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCircle2 size={14} className={isPresent ? 'text-white' : 'text-emerald-500'} />}
                        Sí
                      </button>
                      <button
                        onClick={() => !isSaving && toggleAttendance(cuidador.id, false)}
                        disabled={isSaving}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${isAbsent ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        {isSaving && isAbsent
                          ? <Loader2 size={12} className="animate-spin" />
                          : <XCircle size={14} className={isAbsent ? 'text-white' : 'text-rose-500'} />}
                        No
                      </button>
                    </div>
                  </div>
                  
                  {/* Fila inferior: teléfono y rol si los hay */}
                  {(cuidador.telefono || cuidador.rol) && (
                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                      <div className="min-w-0 flex-1 flex gap-3">
                        {cuidador.telefono && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone size={12} className="text-slate-400" /> {cuidador.telefono}
                          </div>
                        )}
                        {cuidador.rol && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <User size={12} className="text-slate-400" /> {cuidador.rol}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
