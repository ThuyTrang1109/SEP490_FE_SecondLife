/** Share pending reads without caching completed responses. */
export function createInFlightRequests() {
  const pending = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, load: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      if (existing) return existing as Promise<T>;

      const result = Promise.resolve().then(load);
      pending.set(key, result);
      const release = () => {
        if (pending.get(key) === result) pending.delete(key);
      };
      void result.then(release, release);
      return result;
    },
    clear() {
      pending.clear();
    },
  };
}
