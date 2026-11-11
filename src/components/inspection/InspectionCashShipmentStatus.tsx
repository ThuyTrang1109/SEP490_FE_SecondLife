import type { ShipmentBackend } from '../../types';
import { isDeliveredInspectionCashShipment, isInspectionCashShipment } from '../../utils/inspectionCashShipping';
import { formatVND } from '../../utils/translations';

export function InspectionCashShipmentStatus({ shipment }: { shipment: ShipmentBackend }) {
  if (!isInspectionCashShipment(shipment)) return null;

  const payer = shipment.leg === 'SELLER_TO_CENTER' ? 'Seller' : 'Hub';
  return (
    <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
      <div className="font-bold">
        {shipment.cashConfirmedAt ? 'Đã quyết toán cước (Sandbox)'
          : isDeliveredInspectionCashShipment(shipment) ? 'Chờ xác nhận cước tiền mặt (Sandbox)'
            : `${payer} ứng cước · Mô phỏng Sandbox`}
      </div>
      {shipment.cashConfirmedAt && (
        <div className="flex flex-wrap gap-x-3">
          <span>Đã chi {shipment.cashPaidAmount == null ? '—' : formatVND(shipment.cashPaidAmount)}</span>
          <span>Hoàn ứng {shipment.cashReimbursedAmount == null ? '—' : formatVND(shipment.cashReimbursedAmount)}</span>
        </div>
      )}
    </div>
  );
}
