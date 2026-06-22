/**
 * Offline Queue & Local Cache
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores pending attendance changes in localStorage so they survive page
 * refreshes and can be synced to Supabase once the device is back online.
 *
 * Also caches the `ninos` list and today's `asistencias` so the app is fully
 * usable without an internet connection.
 */

import { Nino, Asistencia } from '@/types';

// ─── Keys ─────────────────────────────────────────────────────────────────────
const NINOS_CACHE_KEY  = 'campamento_ninos_v1';
const CUIDADORES_CACHE_KEY = 'campamento_cuidadores_v1';
const ASIST_CACHE_KEY  = (fecha: string) => `campamento_asist_${fecha}`;
const ASIST_CUIDADORES_CACHE_KEY = (fecha: string) => `campamento_asist_cuidadores_${fecha}`;
const QUEUE_KEY        = 'campamento_pending_v1';
const QUEUE_CUIDADORES_KEY = 'campamento_pending_cuidadores_v1';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PendingItem {
  nino_id:   string;
  fecha:     string;
  asistio:   boolean;
  queued_at: string; // ISO timestamp
}

export interface PendingCuidadorItem {
  cuidador_id: string;
  fecha:       string;
  asistio:     boolean;
  queued_at:   string;
}

// ─── Safe localStorage helpers ────────────────────────────────────────────────
function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded — ignore silently
  }
}

function lsDel(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Ninos cache ──────────────────────────────────────────────────────────────
export function saveNinosCache(ninos: Nino[]): void {
  lsSet(NINOS_CACHE_KEY, ninos);
}

export function loadNinosCache(): Nino[] {
  return lsGet<Nino[]>(NINOS_CACHE_KEY, []);
}

// ─── Cuidadores cache ─────────────────────────────────────────────────────────
import { Cuidador, AsistenciaCuidador } from '@/types';

export function saveCuidadoresCache(cuidadores: Cuidador[]): void {
  lsSet(CUIDADORES_CACHE_KEY, cuidadores);
}

export function loadCuidadoresCache(): Cuidador[] {
  return lsGet<Cuidador[]>(CUIDADORES_CACHE_KEY, []);
}

// ─── Asistencias cache ────────────────────────────────────────────────────────
export function saveAsistenciasCache(
  fecha: string,
  asistencias: Record<string, Asistencia>
): void {
  lsSet(ASIST_CACHE_KEY(fecha), asistencias);
}

export function loadAsistenciasCache(fecha: string): Record<string, Asistencia> {
  return lsGet<Record<string, Asistencia>>(ASIST_CACHE_KEY(fecha), {});
}

export function saveAsistenciasCuidadoresCache(
  fecha: string,
  asistencias: Record<string, AsistenciaCuidador>
): void {
  lsSet(ASIST_CUIDADORES_CACHE_KEY(fecha), asistencias);
}

export function loadAsistenciasCuidadoresCache(fecha: string): Record<string, AsistenciaCuidador> {
  return lsGet<Record<string, AsistenciaCuidador>>(ASIST_CUIDADORES_CACHE_KEY(fecha), {});
}

// ─── Pending queues ───────────────────────────────────────────────────────────
export function getQueue(): PendingItem[] {
  return lsGet<PendingItem[]>(QUEUE_KEY, []);
}

export function getCuidadoresQueue(): PendingCuidadorItem[] {
  return lsGet<PendingCuidadorItem[]>(QUEUE_CUIDADORES_KEY, []);
}

/**
 * Adds or replaces a pending attendance item for a given child+date combo.
 * If the same child was already queued for today, the latest value wins.
 */
export function enqueue(item: Omit<PendingItem, 'queued_at'>): void {
  const queue = getQueue();
  const idx = queue.findIndex(
    q => q.nino_id === item.nino_id && q.fecha === item.fecha
  );
  const entry: PendingItem = { ...item, queued_at: new Date().toISOString() };
  if (idx >= 0) queue[idx] = entry;
  else queue.push(entry);
  lsSet(QUEUE_KEY, queue);
}

export function enqueueCuidador(item: Omit<PendingCuidadorItem, 'queued_at'>): void {
  const queue = getCuidadoresQueue();
  const idx = queue.findIndex(
    q => q.cuidador_id === item.cuidador_id && q.fecha === item.fecha
  );
  const entry: PendingCuidadorItem = { ...item, queued_at: new Date().toISOString() };
  if (idx >= 0) queue[idx] = entry;
  else queue.push(entry);
  lsSet(QUEUE_CUIDADORES_KEY, queue);
}

/** Removes a successfully synced item from the queue. */
export function dequeue(nino_id: string, fecha: string): void {
  const queue = getQueue().filter(
    q => !(q.nino_id === nino_id && q.fecha === fecha)
  );
  lsSet(QUEUE_KEY, queue);
}

export function dequeueCuidador(cuidador_id: string, fecha: string): void {
  const queue = getCuidadoresQueue().filter(
    q => !(q.cuidador_id === cuidador_id && q.fecha === fecha)
  );
  lsSet(QUEUE_CUIDADORES_KEY, queue);
}

export function clearQueue(): void {
  lsDel(QUEUE_KEY);
}

export function pendingCount(): number {
  return getQueue().length;
}

export function pendingCuidadoresCount(): number {
  return getCuidadoresQueue().length;
}
