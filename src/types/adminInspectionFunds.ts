export type AdminCollectionStatus =
  | 'NOT_DUE'
  | 'NO_PAYMENT_REQUIRED'
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | string;

export type AdminReturnReserveStatus =
  | 'NOT_REQUIRED'
  | 'NOT_COLLECTED'
  | 'HELD_PENDING_INSPECTION'
  | 'REFUNDED_UNUSED'
  | 'AWAITING_RETURN_SHIPMENT'
  | 'RETURN_IN_PROGRESS'
  | 'AWAITING_ACTUAL_FEE'
  | 'AWAITING_CASH_CONFIRMATION'
  | 'AWAITING_RECONCILIATION'
  | 'EXCEEDS_RESERVE'
  | 'SETTLED'
  | string;

export interface AdminPartyPaymentDTO {
  amountDue: number;
  amountCollected: number;
  paidAt?: string | null;
}

export interface AdminInspectionFeesDTO {
  inspectionFee?: number | null;
  travelFee?: number | null;
  shippingFee?: number | null;
  buyerCommitmentDeposit?: number | null;
  cashShippingSimulation?: boolean;
  outboundCashPendingAmount?: number | null;
}

export interface AdminReturnReserveDTO {
  plannedAmount: number;
  heldAmount: number;
  status: AdminReturnReserveStatus;
}

export interface AdminSettlementDTO {
  centerPayoutAmount?: number | null;
  buyerRefundAmount?: number | null;
  sellerRefundAmount?: number | null;
  sellerCompensationAmount?: number | null;
  platformRetainedAmount?: number | null;
  settledAt?: string | null;
}

export interface AdminFundShipmentDTO {
  shipmentId?: string;
  leg: string;
  orderCode?: string | null;
  status: string;
  providerStatus?: string | null;
  actualFee?: number | null;
  cashPaidAmount?: number | null;
  cashReimbursedAmount?: number | null;
  cashConfirmedAt?: string | null;
}

export interface AdminInspectionOrderFundsDTO {
  inspectionOrderId: string;
  totalCollected: number;
  unsettledCollectedAmount: number;
  collectionStatus: AdminCollectionStatus;
  buyerPayment?: AdminPartyPaymentDTO | null;
  sellerPayment?: AdminPartyPaymentDTO | null;
  buyer?: AdminPartyPaymentDTO | null;
  seller?: AdminPartyPaymentDTO | null;
  fees?: AdminInspectionFeesDTO | null;
  inspectionFee?: number | null;
  travelFee?: number | null;
  shippingFee?: number | null;
  buyerCommitmentDeposit?: number | null;
  cashShippingSimulation?: boolean;
  outboundCashPendingAmount?: number | null;
  returnReserve?: AdminReturnReserveDTO | null;
  settlement?: AdminSettlementDTO | null;
  shipments?: AdminFundShipmentDTO[];
}

