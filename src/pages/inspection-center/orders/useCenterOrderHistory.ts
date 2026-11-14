import { useState, useMemo } from 'react';
import { getCenterFeeCollection, isCenterFeeCollectionClosed, matchesCenterFeeFilter, type CenterFeeFilter } from '../../../utils/inspectionCenterFees';
import type { useCenterOrders } from './useCenterOrders';
import type { useCenterShipments } from './useCenterShipments';

interface Options {
  hubReturns: ReturnType<typeof useCenterShipments>['hubReturns'];
  visibleOrderHistory: ReturnType<typeof useCenterOrders>['visibleOrderHistory'];
}

export function useCenterOrderHistory({ hubReturns, visibleOrderHistory }: Options) {
  const [feeFilter, setFeeFilter] = useState<CenterFeeFilter | 'all'>('all');
  const [expandedFeeOrderId, setExpandedFeeOrderId] = useState<string | null>(null);

  const orderHistoryRows = useMemo(() => (visibleOrderHistory?.items ?? []).map((order) => {
    const returnShipment = hubReturns.get(order.id)?.shipment;
    const isReturning = Boolean(returnShipment && returnShipment.status !== 'CANCELLED');
    const collectionClosed = isCenterFeeCollectionClosed(order.status) || isReturning;
    return { order, fees: getCenterFeeCollection(order), collectionClosed, isReturning };
  }).filter(({ fees, collectionClosed }) => feeFilter === 'all' || matchesCenterFeeFilter(fees, feeFilter, collectionClosed)),
    [visibleOrderHistory, hubReturns, feeFilter]);

  return {
    expandedFeeOrderId,
    feeFilter,
    orderHistoryRows,
    setExpandedFeeOrderId,
    setFeeFilter,
  };
}
