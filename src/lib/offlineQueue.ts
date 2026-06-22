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
const ASIST_CACHE_KEY  = (fecha: string) => `campamento_asist_${fecha}`;
const QUEUE_KEY        = 'campamento_pending_v1';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PendingItem {
  nino_id:   string;
  fecha:     string;
  asistio:   boolean;
  queued_at: string; // ISO timestamp
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

// ─── Pending queue ────────────────────────────────────────────────────────────
export function getQueue(): PendingItem[] {
  return lsGet<PendingItem[]>(QUEUE_KEY, []);
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

/** Removes a successfully synced item from the queue. */
export function dequeue(nino_id: string, fecha: string): void {
  const queue = getQueue().filter(
    q => !(q.nino_id === nino_id && q.fecha === fecha)
  );
  lsSet(QUEUE_KEY, queue);
}

export function clearQueue(): void {
  lsDel(QUEUE_KEY);
}

export function pendingCount(): number {
  return getQueue().length;
}
