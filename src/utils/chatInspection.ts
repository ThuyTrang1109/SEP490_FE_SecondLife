import type { ChatRoomDto } from '../services/chatService';
import type { InspectionOrderDto } from '../services/inspectorService';

const activeStatuses = new Set([
  'PENDING', 'WAITING_SELLER_APPROVAL', 'WAITING_BUYER_APPROVAL', 'WAITING_FEE_PAYMENT',
  'CONFIRMED_PENDING_DISPATCH', 'DISPATCHED', 'SCHEDULED', 'SHIPPING_TO_CENTER',
  'DISPATCHED_TO_CENTER', 'RECEIVED_AT_CENTER', 'WAITING_INSPECTION', 'ASSIGNED',
  'INSPECTING', 'INSPECTION_IN_PROGRESS', 'IN_PROGRESS', 'PASSED',
]);

export function getChatInspectionOrderId(value: unknown) {
  return typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value) ? value.toLowerCase() : undefined;
}

export function isActiveChatInspection(order?: InspectionOrderDto | null) {
  return Boolean(order && activeStatuses.has(order.status));
}

export function matchesChatInspection(order: InspectionOrderDto, room: Pick<ChatRoomDto, 'postId' | 'buyerId' | 'sellerId'>) {
  return order.postId?.toLowerCase() === room.postId.toLowerCase()
    && order.buyerId?.toLowerCase() === room.buyerId.toLowerCase()
    && order.sellerId?.toLowerCase() === room.sellerId.toLowerCase();
}

export function getCurrentChatInspection(orders: Iterable<InspectionOrderDto | null>) {
  return Array.from(orders).filter((order): order is InspectionOrderDto => order != null)
    .sort((a, b) => Number(isActiveChatInspection(b)) - Number(isActiveChatInspection(a))
      || (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0))[0] ?? null;
}

export function getChatInspectionFees(order: InspectionOrderDto) {
  const inspection = order.inspectionFee;
  const travel = order.travelFee ?? order.travelFeeRoundTrip;
  const shipping = order.shippingFee;
  const reserve = order.returnShippingReserveFee;
  let total: number | undefined;
  if (inspection != null) {
    if (order.orderType === 'AT_HOME') total = inspection + (travel ?? 0);
    if (order.orderType === 'AT_CENTER' && shipping != null && reserve != null) total = inspection + shipping + reserve;
  }
  return { inspection, travel, shipping, reserve, total };
}

/** Share one detail read per order. A successful mutation supersedes a read already in flight. */
export function createChatInspectionReader(
  load: (orderId: string) => Promise<InspectionOrderDto>,
  publish: (orderId: string, order: InspectionOrderDto | null) => void,
) {
  const pending = new Map<string, Promise<void>>();
  const loaded = new Set<string>();

  const read = (orderId: string) => {
    const key = orderId.toLowerCase();
    const existing = pending.get(key);
    if (existing) return existing;

    const complete = (order: InspectionOrderDto | null) => {
      if (pending.get(key) !== request) return;
      loaded.add(key);
      publish(key, order?.id?.toLowerCase() === key ? order : null);
    };
    const request = Promise.resolve().then(() => load(orderId)).then(complete, () => complete(null)).finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
  };

  return {
    read,
    ensure(orderId: string) {
      if (!loaded.has(orderId.toLowerCase())) return read(orderId);
    },
    knows(orderId: string) {
      const key = orderId.toLowerCase();
      return loaded.has(key) || pending.has(key);
    },
    accept(order: InspectionOrderDto) {
      const key = order.id.toLowerCase();
      pending.delete(key);
      loaded.add(key);
      publish(key, order);
    },
  };
}
