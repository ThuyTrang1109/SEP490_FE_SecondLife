/** Coalesce related invalidations and reconcile active views after a connection gap. */
export function observeResourceChanges(types: string[], refresh: () => void, fallbackMs?: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (document.hidden || timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; refresh(); }, 180);
  };
  const changed = (event: Event) => {
    if (types.includes((event as CustomEvent).detail?.resourceType)) schedule();
  };
  const fallback = fallbackMs ? setInterval(schedule, fallbackMs) : undefined;
  window.addEventListener('secondlife_resource_changed', changed);
  window.addEventListener('secondlife_reconcile', schedule);
  window.addEventListener('online', schedule);
  document.addEventListener('visibilitychange', schedule);
  return () => {
    clearTimeout(timer);
    clearInterval(fallback);
    window.removeEventListener('secondlife_resource_changed', changed);
    window.removeEventListener('secondlife_reconcile', schedule);
    window.removeEventListener('online', schedule);
    document.removeEventListener('visibilitychange', schedule);
  };
}
