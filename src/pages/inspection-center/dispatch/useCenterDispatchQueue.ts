import { useState, useMemo } from 'react';
import { getCenterDispatchStage } from '../../../utils/inspectionCenterData';
import type { CenterTab, DispatchFilter } from '../types';
import type { useCenterOrders } from '../orders/useCenterOrders';
import type { useCenterShipments } from '../orders/useCenterShipments';
import type { useCenterStaff } from '../staff/useCenterStaff';

interface Options {
  inboundShipments: ReturnType<typeof useCenterShipments>['inboundShipments'];
  isOrderReceivedAtHub: ReturnType<typeof useCenterShipments>['isOrderReceivedAtHub'];
  orders: ReturnType<typeof useCenterOrders>['orders'];
  setActiveTab: (tab: CenterTab) => void;
  staffList: ReturnType<typeof useCenterStaff>['staffList'];
}

export function useCenterDispatchQueue({ inboundShipments, isOrderReceivedAtHub, orders, setActiveTab, staffList }: Options) {
  const [dispatchFilter, setDispatchFilter] = useState<DispatchFilter>('ALL');
  const [orderMethodFilter, setOrderMethodFilter] = useState<'ALL' | 'AT_CENTER' | 'AT_HOME'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const dispatchOrders = useMemo(() => orders.flatMap((order) => {
    const stage = getCenterDispatchStage(order, isOrderReceivedAtHub(order));
    return stage ? [{ order, stage }] : [];
  }), [orders, inboundShipments]);
  const urgentDispatchOrders = useMemo(() => dispatchOrders
    .filter(({ stage }) => stage === 'READY_TO_ASSIGN' || stage === 'WAITING_CENTER_APPROVAL')
    .map(({ order }) => order), [dispatchOrders]);

  // Staff Workload Map - Chỉ đếm số đơn thực tế đang giao / đang xử lý (không tính đơn hủy hay đã hoàn tất)
  const staffWorkloadMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const isCancelled = o.status === 'CANCELLED' || o.status === 'CANCELED';
      const isClosed = o.status === 'PASSED' || o.status === 'FAILED' || o.status === 'COMPLETED';
      if (o.inspectorId && !isCancelled && !isClosed) {
        map[o.inspectorId] = (map[o.inspectorId] || 0) + 1;
      }
    });
    return map;
  }, [orders]);

  // Overall Statistics - Phản ánh chính xác 100% dữ liệu đơn hàng
  const stats = useMemo(() => {
    const total = orders.length;
    const pendingDispatch = urgentDispatchOrders.length;
    const inspecting = orders.filter(
      (o) => o.status === 'INSPECTING' || o.status === 'INSPECTION_IN_PROGRESS' || o.status === 'DISPATCHED' || o.status === 'SCHEDULED'
    ).length;
    const passed = orders.filter((o) => o.status === 'PASSED' || o.status === 'COMPLETED').length;
    const failed = orders.filter((o) => o.status === 'FAILED').length;
    const cancelled = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'CANCELED').length;
    const waitingApproval = orders.filter(
      (o) => o.status === 'WAITING_SELLER_APPROVAL' || o.status === 'WAITING_BUYER_APPROVAL' || o.status === 'WAITING_FEE_PAYMENT'
    ).length;
    const pendingAppeals = orders.filter((o) => o.appealStatus === 'PENDING_REVIEW').length;
    const totalAppeals = orders.filter((o) => o.appealStatus && o.appealStatus !== 'NONE').length;

    const evaluatedCount = passed + failed;
    const passRate = evaluatedCount > 0 ? Math.round((passed / evaluatedCount) * 100) : 0;
    const totalStaff = staffList.length;

    return {
      total,
      pendingDispatch,
      inspecting,
      passed,
      failed,
      cancelled,
      waitingApproval,
      evaluatedCount,
      passRate,
      totalStaff,
      pendingAppeals,
      totalAppeals
    };
  }, [orders, urgentDispatchOrders, staffList]);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return dispatchOrders.filter(({ order, stage }) => {
      if (dispatchFilter !== 'ALL' && stage !== dispatchFilter) return false;
      if (orderMethodFilter !== 'ALL' && order.orderType !== orderMethodFilter) return false;
      return !query || [
        order.id, order.postTitle, order.inspectorName, order.buyerName,
        order.buyerEmail, order.sellerName, order.sellerEmail,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [dispatchOrders, dispatchFilter, orderMethodFilter, searchTerm]);

  const openReadyDispatchQueue = () => {
    setDispatchFilter('READY_TO_ASSIGN');
    setOrderMethodFilter('ALL');
    setSearchTerm('');
    setActiveTab('dispatch');
  };

  return {
    dispatchFilter,
    dispatchOrders,
    filteredOrders,
    openReadyDispatchQueue,
    orderMethodFilter,
    searchTerm,
    setDispatchFilter,
    setOrderMethodFilter,
    setSearchTerm,
    staffWorkloadMap,
    stats,
    urgentDispatchOrders,
  };
}
