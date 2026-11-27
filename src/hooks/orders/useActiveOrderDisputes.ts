import { useEffect, useState } from 'react';
import type { PageResponse } from '../../services/apiClient';
import { userReportService, type ReportStatus } from '../../services/userReportService';
import type { EscrowOrder } from '../../types';

type ReportSummary = { orderId?: string | null; status: ReportStatus };
const EMPTY_IDS = new Set<string>();

async function findActiveReports(
  orderIds: string[],
  readPage: (page: number) => Promise<PageResponse<ReportSummary>>,
) {
  const pending = new Set(orderIds);
  const active = new Set<string>();
  for (let page = 0; pending.size > 0; page++) {
    const result = await readPage(page);
    for (const report of result.items) {
      if (report.orderId && (report.status === 'OPEN' || report.status === 'IN_REVIEW') && pending.delete(report.orderId)) {
        active.add(report.orderId);
      }
    }
    if (result.isLast || page + 1 >= result.totalPages) break;
  }
  return active;
}

export function useActiveOrderDisputes(
  userId: string | undefined,
  orders: EscrowOrder[],
  routeOrder: EscrowOrder | null,
): ReadonlySet<string> {
  const [result, setResult] = useState<{ userId: string; ids: Set<string> }>();

  useEffect(() => {
    if (!userId) return;
    const buyerIds = new Set<string>();
    const sellerIds = new Set<string>();
    for (const order of routeOrder ? [...orders, routeOrder] : orders) {
      // The dispute API requires carrier delivery. A pre-delivery shipping hold needs no report lookup,
      // and orders that already carry hasActiveDispute from the feed require no extra lookup.
      if (
        order.backendEscrowStatus !== 'FROZEN' ||
        !order.shippingDeliveredAt ||
        order.orderReturn?.reportId ||
        order.hasActiveDispute !== undefined
      ) continue;
      if (order.buyerId === userId) buyerIds.add(order.id);
      else if (order.sellerId === userId) sellerIds.add(order.id);
    }
    if (buyerIds.size === 0 && sellerIds.size === 0) return;

    const controller = new AbortController();
    const { signal } = controller;
    const requestOptions = { signal, isBackground: true };
    const read = async () => {
      const buyers = [...buyerIds];
      const sellers = [...sellerIds];
      const matches = await Promise.allSettled([
        findActiveReports(buyers, (page) => userReportService.getMyReports(page, 50, 'ORDER', requestOptions)),
        findActiveReports(sellers, (page) => userReportService.getSellerDisputes(page, 50, requestOptions)),
      ]);
      if (signal.aborted) return;
      setResult((previous) => {
        const ids = new Set(previous?.userId === userId ? previous.ids : []);
        for (const [index, candidates] of [buyers, sellers].entries()) {
          const match = matches[index];
          if (match.status === 'rejected') continue;
          for (const id of candidates) {
            if (match.value.has(id)) ids.add(id);
            else ids.delete(id);
          }
        }
        return { userId, ids };
      });
    };
    void read();
    return () => controller.abort();
  }, [userId, orders, routeOrder]);

  return result && result.userId === userId ? result.ids : EMPTY_IDS;
}
