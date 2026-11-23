import { useSyncExternalStore } from 'react';

/**
 * Returns true when viewport width <= maxWidth using matchMedia.
 * Safely defaults to false in jsdom/SSR when matchMedia is unavailable.
 */
export function useIsMobileViewport(maxWidth = 767): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {};
      }
      const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
      }
      return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
    },
    () => false,
  );
}
