'use client';
import { useState, useEffect } from 'react';

/**
 * Returns true when the browser believes it has a working internet connection.
 * Updates reactively when the device goes offline or comes back online.
 *
 * Starts as `true` to avoid a flash of "offline" during SSR/hydration,
 * then sets the real value once mounted on the client.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Sync real value after mount (navigator is client-only)
    setIsOnline(navigator.onLine);

    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
