import { ComponentType, lazy, LazyExoticComponent } from 'react';

/**
 * Enhanced React.lazy with automatic retry mechanism for dynamic imports.
 * Fixes "Failed to fetch dynamically imported module" errors caused by:
 * - Vite dev server cold compile / transform delays on large components
 * - Transient network hiccups or dev server restarts
 * - Stale module cache or chunk hash invalidation
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  moduleKey = 'module'
): LazyExoticComponent<T> {
  return lazy(async () => {
    const storageKey = `retry_import_${moduleKey}`;
    const hasAlreadyRefreshed = typeof window !== 'undefined' && sessionStorage.getItem(storageKey) === 'true';

    try {
      const component = await factory();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(storageKey);
      }
      return component;
    } catch (initialError: any) {
      console.warn(`[DynamicImport] Failed to load "${moduleKey}", attempting auto-retry...`, initialError);

      // Retry up to 2 times with backoff
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          const component = await factory();
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(storageKey);
          }
          console.info(`[DynamicImport] Successfully loaded "${moduleKey}" on retry ${attempt}`);
          return component;
        } catch (retryError) {
          console.warn(`[DynamicImport] Retry ${attempt} for "${moduleKey}" failed:`, retryError);
        }
      }

      // If retries failed and page hasn't reloaded yet for this module:
      if (!hasAlreadyRefreshed && typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, 'true');
        console.warn(`[DynamicImport] Reloading page once to refresh stale Vite module cache for "${moduleKey}"...`);
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(storageKey);
      }
      throw initialError;
    }
  });
}
