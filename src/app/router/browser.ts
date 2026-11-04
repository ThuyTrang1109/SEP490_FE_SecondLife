import { useSyncExternalStore } from 'react';
import type { UserRole } from '../../types';
import { panelPaths, resolveAppRoute } from './paths';

export const NAVIGATION_EVENT = 'secondlife_navigation';
const snapshot = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener(NAVIGATION_EVENT, listener);
  window.addEventListener('secondlife_tab_changed', listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(NAVIGATION_EVENT, listener);
    window.removeEventListener('secondlife_tab_changed', listener);
  };
}
export function useBrowserLocation() {
  return useSyncExternalStore(subscribe, snapshot, () => '/');
}

export function navigatePath(target: string, options: { replace?: boolean; state?: unknown } = {}) {
  const url = new URL(target, window.location.origin);
  if (url.origin !== window.location.origin) return;
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === snapshot()) return;
  window.history[options.replace ? 'replaceState' : 'pushState'](options.state ?? null, '', next);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function usePanelTab<T extends string>(role: UserRole, fallback: T): [T, (tab: T) => void] {
  const location = useBrowserLocation();
  const route = resolveAppRoute(location, role);
  const value = (route.role === role && route.section ? route.section : fallback) as T;
  return [value, (tab: T) => {
    const path = panelPaths[role]?.[tab];
    if (path) navigatePath(path);
  }];
}
