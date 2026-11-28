import type { Language, ShipmentBackend } from '../types';
import { getInboundShipmentProgress } from './inspectionCenterData';
import { getLalamoveInterruption } from './lalamoveTracking';

export type SellerHubShipmentSnapshot = ShipmentBackend | null | 'unavailable';

export function getSellerHubShipmentBadge(
  inspectionStatus: string,
  shipment: SellerHubShipmentSnapshot | undefined,
  lang: Language,
) {
  const vi = lang === 'vi';
  const badge = (label: string, color: string) => ({ label: `● ${label}`, colorClass: `${color} text-white shadow-2xs` });
  const inspecting = ['INSPECTING', 'INSPECTION_IN_PROGRESS'].includes(inspectionStatus);
  const inspectionBadge = () => badge(vi ? 'Đang kiểm định tại Hub' : 'Inspecting at Hub', 'bg-indigo-600');
  const arrivedBadge = () => badge(vi ? 'Đã đến Hub · Chờ kiểm định' : 'Delivered to Hub · Awaiting inspection', 'bg-indigo-600');

  if (shipment && shipment !== 'unavailable') {
    const progress = getInboundShipmentProgress(shipment, lang);
    if (progress.step === 3) return inspecting ? inspectionBadge() : arrivedBadge();
    if (progress.step === 2) return badge(progress.label, 'bg-cyan-600');
    return badge(progress.label, getLalamoveInterruption(shipment) ? 'bg-rose-600' : 'bg-amber-600');
  }

  if (inspecting) return inspectionBadge();
  if (inspectionStatus === 'RECEIVED_AT_CENTER') return arrivedBadge();
  if (inspectionStatus === 'SHIPPING_TO_CENTER') {
    return badge(vi ? 'Đang giao hàng đến Hub' : 'On the way to Hub', 'bg-cyan-600');
  }
  if (shipment === undefined) return badge(vi ? 'Đang tải trạng thái vận đơn' : 'Loading shipment status', 'bg-slate-500');
  if (shipment === 'unavailable') return badge(vi ? 'Chưa tải được trạng thái vận đơn' : 'Could not load shipment status', 'bg-slate-500');
  if (['CONFIRMED_PENDING_DISPATCH', 'SCHEDULED', 'DISPATCHED'].includes(inspectionStatus)) {
    return badge(vi ? 'Đã nộp phí · Chờ gửi hàng tới Hub' : 'Fee Paid · Awaiting Dispatch to Hub', 'bg-amber-600');
  }
  return badge(vi ? 'Đang xử lý kiểm định' : 'Inspection in progress', 'bg-indigo-600');
}
