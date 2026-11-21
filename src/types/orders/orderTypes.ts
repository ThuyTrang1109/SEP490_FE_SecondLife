import type { EscrowOrder } from '..';
import type { getBuyerInspectionStage } from '../../utils/inspectionPurchase';

export type BuyerInspectionStage = NonNullable<ReturnType<typeof getBuyerInspectionStage>>;
export type OrderPhotoStage = 'listing' | 'inspector' | 'handover';
export type OrderCheck = (order: EscrowOrder | null | undefined) => boolean;
export type CancelOrder = (
  orderId: string,
  cancelData?: { reasonCode: 'BUYER_REQUESTED' | 'SELLER_OUT_OF_STOCK' | 'SELLER_CANNOT_FULFILL'; reason: string }
) => void;

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  subMessage?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  iconType?: 'check' | 'package' | 'truck' | 'alert';
  requireReasonInput?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  initialReason?: string;
  onConfirm: (reason?: string) => void | Promise<void>;
}
