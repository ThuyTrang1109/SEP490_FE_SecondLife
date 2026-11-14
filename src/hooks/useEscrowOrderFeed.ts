import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrderFeed, type OrderFeed } from '../services/orderFeedService';
import type { OrderFeedQuery } from '../utils/escrowOrderFilters';

export function useEscrowOrderFeed(enabled: boolean, scope: string, query: OrderFeedQuery, orderId?: string) {
  const { filter, perspective, q, page } = query;
  const countKey = JSON.stringify([scope, perspective, q]);
  const queryKey = JSON.stringify([countKey, filter, page, orderId]);
  const [result, setResult] = useState<{ key: string; data?: OrderFeed; failed?: boolean }>();
  const [counts, setCounts] = useState<{ key: string; value: OrderFeed['counts'] }>();
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef<string | null>(null);
  const refreshAfterRead = useRef(false);
  const refresh = useCallback(() => {
    if (!enabled) return;
    if (pending.current === queryKey) {
      refreshAfterRead.current = true;
    } else {
      setRevision((value) => value + 1);
    }
  }, [enabled, queryKey]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    pending.current = queryKey;
    setLoading(true);
    // Schedule the read after mount so an immediate effect cleanup does not start a request.
    const timer = window.setTimeout(async () => {
      try {
        const data = await getOrderFeed({ filter, perspective, q, page }, orderId, controller.signal);
        if (!controller.signal.aborted) {
          setResult({ key: queryKey, data });
          setCounts({ key: countKey, value: data.counts });
        }
      } catch {
        if (!controller.signal.aborted) setResult((previous) => ({
          key: queryKey,
          data: previous?.key === queryKey ? previous.data : undefined,
          failed: true,
        }));
      } finally {
        if (!controller.signal.aborted) {
          pending.current = null;
          setLoading(false);
          if (refreshAfterRead.current) {
            refreshAfterRead.current = false;
            setRevision((value) => value + 1);
          }
        }
      }
    }, 0);
    return () => {
      pending.current = null;
      refreshAfterRead.current = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, countKey, queryKey, revision, filter, perspective, q, page, orderId]);

  const current = result?.key === queryKey ? result : undefined;
  return {
    data: enabled ? current?.data : undefined,
    counts: enabled && counts?.key === countKey ? counts.value : undefined,
    failed: enabled && Boolean(current?.failed),
    loading: enabled && (loading || !current),
    refresh,
  };
}
