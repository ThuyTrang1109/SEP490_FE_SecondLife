import type { ShipmentBackend } from '../../types';
import { isDeliveredInspectionCashShipment, isInspectionCashShipment } from '../../utils/inspectionCashShipping';
import { formatVND } from '../../utils/translations';

export function InspectionCashShipmentStatus({ shipment }: { shipment: ShipmentBackend }) {
  if (!isInspectionCashShipment(shipment)) return null;

  const payer = shipment.leg === 'SELLER_TO_CENTER' ? 'Seller' : 'Hub';
  const isReturn = shipment.leg === 'CENTER_TO_SELLER';
  const awaitingConfirmation = isDeliveredInspectionCashShipment(shipment) && !shipment.cashConfirmedAt;
  return (
    <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
      <div className="font-bold">
        {shipment.cashConfirmedAt ? 'Đã quyết toán cước (Sandbox)'
          : awaitingConfirmation ? (isReturn ? 'Chờ hoàn ứng tự động (Sandbox)' : 'Chờ xác nhận cước tiền mặt (Sandbox)')
            : `${payer} ứng cước · Mô phỏng Sandbox`}
      </div>
      {awaitingConfirmation && (
        <div>{isReturn
          ? 'Hệ thống ghi có vào ví Hub sau khi Lalamove xác nhận giao hàng và cước thực tế.'
          : 'Staff/Admin cần xác nhận biên nhận để đối soát cước người bán đã ứng.'}</div>
      )}
      {shipment.cashConfirmedAt && (
        <div className="flex flex-wrap gap-x-3">
          <span>Đã chi {shipment.cashPaidAmount == null ? '—' : formatVND(shipment.cashPaidAmount)}</span>
          <span>Hoàn ứng {shipment.cashReimbursedAmount == null ? '—' : formatVND(shipment.cashReimbursedAmount)}</span>
        </div>
      )}
    </div>
  );
}
