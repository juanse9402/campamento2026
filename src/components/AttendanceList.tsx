'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, CheckCircle2, XCircle, Loader2,
  ShieldAlert, UserCog, ChevronDown, X, Save,
  Phone, User, WifiOff, RefreshCw, CloudOff, Wifi
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { IS_MOCK_MODE, MOCK_NINOS, MOCK_ASISTENCIAS } from '@/lib/mockData';
import { getTodayLocalStr } from '@/lib/dateUtils';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import {
  enqueue, dequeue, getQueue, pendingCount as getPendingCount,
  saveNinosCache, loadNinosCache,
  saveAsistenciasCache, loadAsistenciasCache,
} from '@/lib/offlineQueue';
import { Nino, Asistencia } from '@/types';

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

// ─── Modal: Editar Acudiente ───────────────────────────────────────────────────
interface EditModalProps { nino: Nino; onClose: () => void; onSaved: (updated: Nino) => void; }

function EditGuardianModal({ nino, onClose, onSaved }: EditModalProps) {
  const [nombre, setNombre]     = useState(nino.acudiente_nombre || '');
  const [telefono, setTelefono] = useState(nino.acudiente_telefono || '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (!IS_MOCK_MODE) {
        const { error: dbErr } = await supabase
          .from('ninos')
          .update({ acudiente_nombre: nombre, acudiente_telefono: telefono })
          .eq('id', nino.id);
        if (dbErr) throw dbErr;
      }
      onSaved({ ...nino, acudiente_nombre: nombre, acudiente_telefono: telefono });
    } catch (err) {
      console.error('Error saving guardian info:', err);
      setError('No se pudo guardar. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">Datos del Acudiente</h2>
            <p className="text-indigo-200 text-sm mt-0.5">{nino.nombre} {nino.apellido}</p>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white hover:bg-indigo-500 rounded-full p-1.5 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} />Nombre del Acudiente
            </label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: María García"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all placeholder:text-slate-300" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Phone size={13} />Teléfono / WhatsApp
            </label>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 300-111-0000"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all placeholder:text-slate-300" />
          </div>
          {error && (
            <p className="text-rose-600 text-sm font-medium bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-bold py-3 rounded-2xl hover:bg-slate-50 transition-colors text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-2xl transition-colors text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-200">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const GRUPOS = ['Todos', 'Stephany', 'Andrea', 'Juliana', 'Sain', 'Gorka'];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AttendanceList() {
  const todayStr  = getTodayLocalStr();
  const isOnline  = useOnlineStatus();

  const [ninos, setNinos]             = useState<Nino[]>([]);
  const [asistencias, setAsistencias] = useState<Record<string, Asistencia>>({});
  const [savingIds, setSavingIds]     = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [diagError, setDiagError]     = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('Todos');
  const [editingNino, setEditingNino] = useState<Nino | null>(null);
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
      setNinos(MOCK_NINOS);
      setAsistencias(MOCK_ASISTENCIAS);
      setLoading(false);
      return;
    }

    // Sin conexión: carga desde caché local
    if (!isOnline) {
      const cachedNinos = loadNinosCache();
      const cachedAsist = loadAsistenciasCache(todayStr);
      setNinos(cachedNinos.length ? cachedNinos : []);
      setAsistencias(cachedAsist);
      setPending(getPendingCount());
      setLoading(false);
      return;
    }

    try {
      const [ninosRes, asistRes] = await Promise.all([
        supabase.from('ninos').select('*').order('apellido'),
        supabase.from('asistencia').select('*').eq('fecha', todayStr),
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
        const cached = loadNinosCache();
        setNinos(cached.length ? cached : MOCK_NINOS);
        setAsistencias(loadAsistenciasCache(todayStr));
      } else {
        setNinos(data);
        const asistMap: Record<string, Asistencia> = {};
        (asistRes.data || []).forEach(a => { asistMap[a.nino_id] = a; });
        setAsistencias(asistMap);

        // Guardar en caché para uso offline
        saveNinosCache(data);
        saveAsistenciasCache(todayStr, asistMap);
      }

      setPending(getPendingCount());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Supabase] fetchData error:', msg);
      setDiagError(`Error de conexión: ${msg}`);

      // Fallback a caché local
      const cached = loadNinosCache();
      setNinos(cached.length ? cached : MOCK_NINOS);
      setAsistencias(loadAsistenciasCache(todayStr));
      setPending(getPendingCount());
    } finally {
      setLoading(false);
    }
  };

  // ── Sincronizar cola cuando se recupera la conexión ───────────────────────
  const syncQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0 || IS_MOCK_MODE) return;

    setSyncing(true);
    let synced = 0;
    const errors: string[] = [];

    for (const item of queue) {
      try {
        const { error } = await supabase
          .from('asistencia')
          .upsert(
            { nino_id: item.nino_id, fecha: item.fecha, asistio: item.asistio },
            { onConflict: 'nino_id,fecha' }
          );
        if (error) throw error;
        dequeue(item.nino_id, item.fecha);
        synced++;
      } catch (err) {
        errors.push(item.nino_id);
        console.error('[Sync] failed for', item.nino_id, err);
      }
    }

    const remaining = getPendingCount();
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
    const optimistic: Asistencia = {
      id:      previous?.id ?? `optimistic-${ninoId}`,
      nino_id: ninoId,
      fecha:   todayStr,
      asistio: isPresent,
    };
    const newAsistencias = { ...asistencias, [ninoId]: optimistic };
    setAsistencias(newAsistencias);

    // ② Actualizar caché local con el nuevo valor
    saveAsistenciasCache(todayStr, newAsistencias);

    if (IS_MOCK_MODE) return;

    // ③ Sin conexión → encolar y no mostrar error
    if (!isOnline) {
      enqueue({ nino_id: ninoId, fecha: todayStr, asistio: isPresent });
      setPending(getPendingCount());
      return;
    }

    setSavingIds(prev => new Set(prev).add(ninoId));

    try {
      // ④ Upsert en Supabase
      const { data, error } = await supabase
        .from('asistencia')
        .upsert(
          { nino_id: ninoId, fecha: todayStr, asistio: isPresent },
          { onConflict: 'nino_id,fecha' }
        )
        .select()
        .single();

      if (error) throw error;

      // ⑤ Confirmar con ID real devuelto por Supabase
      if (data) {
        const confirmed = { ...newAsistencias, [ninoId]: data as Asistencia };
        setAsistencias(confirmed);
        saveAsistenciasCache(todayStr, confirmed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Supabase] Error upserting attendance:', msg);

      // ⑥ Error de red → encolar para sincronizar después
      enqueue({ nino_id: ninoId, fecha: todayStr, asistio: isPresent });
      setPending(getPendingCount());
      showToast('Sin conexión. El cambio se guardó localmente y se sincronizará al reconectar.', 'info');
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(ninoId); return n; });
    }
  };

  const handleGuardianSaved = (updated: Nino) => {
    const newNinos = ninos.map(n => n.id === updated.id ? updated : n);
    setNinos(newNinos);
    saveNinosCache(newNinos);
    setEditingNino(null);
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const baseNinos = ninos.filter(n => {
    const matchSearch = `${n.nombre} ${n.apellido}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchGrupo  = selectedGrupo === 'Todos' || (n.grupo ?? '').toLowerCase() === selectedGrupo.toLowerCase();
    return matchSearch && matchGrupo;
  });

  const presentCount = baseNinos.filter(n => asistencias[n.id]?.asistio === true).length;
  const absentCount  = baseNinos.filter(n => asistencias[n.id]?.asistio === false).length;

  const filteredNinos = statusFilter === 'all'
    ? baseNinos
    : statusFilter === 'present'
    ? baseNinos.filter(n => asistencias[n.id]?.asistio === true)
    : baseNinos.filter(n => asistencias[n.id]?.asistio === false);

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

        {/* ── Estadísticas / Filtros de estado ───────────────────────────── */}
        {baseNinos.length > 0 && (
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
                {baseNinos.length}
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
          {filteredNinos.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 font-medium text-lg">No se encontraron niños.</p>
            </div>
          ) : (
            filteredNinos.map(nino => {
              const status     = asistencias[nino.id];
              const isPresent  = status?.asistio === true;
              const isAbsent   = status?.asistio === false;
              const isSaving   = savingIds.has(nino.id);
              const hasObs     = !!(nino.observaciones?.trim());
              const hasGuardian = !!(nino.acudiente_nombre?.trim() || nino.acudiente_telefono?.trim());
              // Cambio guardado localmente (aún no sincronizado)
              const isPending  = !isOnline && (isPresent || isAbsent);

              return (
                <div
                  key={nino.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border transition-all hover:shadow-md
                    ${hasObs ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}
                >
                  {/* Fila superior */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {hasObs && <MedicalAlert observacion={nino.observaciones!} />}
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-base leading-tight truncate">
                          {nino.nombre} {nino.apellido}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {nino.grupo && (
                            <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                              {nino.grupo}
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
                    <div className={`flex bg-slate-100 rounded-full p-1 border border-slate-200 shadow-inner flex-shrink-0 transition-opacity ${isSaving ? 'opacity-60' : 'opacity-100'}`}>
                      <button
                        onClick={() => !isSaving && toggleAttendance(nino.id, true)}
                        disabled={isSaving}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs transition-all ${isPresent ? 'bg-emerald-500 text-white shadow-md scale-105' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        {isSaving && isPresent
                          ? <Loader2 size={14} className="animate-spin" />
                          : <CheckCircle2 size={15} className={isPresent ? 'text-white' : 'text-emerald-500'} />}
                        Sí
                      </button>
                      <button
                        onClick={() => !isSaving && toggleAttendance(nino.id, false)}
                        disabled={isSaving}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs transition-all ${isAbsent ? 'bg-rose-500 text-white shadow-md scale-105' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        {isSaving && isAbsent
                          ? <Loader2 size={14} className="animate-spin" />
                          : <XCircle size={15} className={isAbsent ? 'text-white' : 'text-rose-500'} />}
                        No
                      </button>
                    </div>
                  </div>

                  {/* Fila inferior: acudiente + editar */}
                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                    <div className="min-w-0 flex-1">
                      {hasGuardian ? (
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-500 truncate">
                            {nino.acudiente_nombre || '—'}
                            {nino.acudiente_telefono ? ` · ${nino.acudiente_telefono}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 italic">Sin datos del acudiente</span>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingNino(nino)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-full transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                    >
                      <UserCog size={13} />
                      {hasGuardian ? 'Editar' : 'Completar'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Modal acudiente ─────────────────────────────────────────────────── */}
      {editingNino && (
        <EditGuardianModal
          nino={editingNino}
          onClose={() => setEditingNino(null)}
          onSaved={handleGuardianSaved}
        />
      )}

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
