import { useState } from 'react';
import type { EscrowOrder } from '../../types';
import { orderService } from '../../services/orderService';

export function useOrderBankPayment() {
  const [bankPaymentOrder, setBankPaymentOrder] = useState<EscrowOrder | null>(null);
  const [bankPaymentInfo, setBankPaymentInfo] = useState<any | null>(null);
  const [loadingBankPaymentId, setLoadingBankPaymentId] = useState<string | null>(null);

  const handleOpenBankPaymentModal = async (ord: EscrowOrder) => {
    setLoadingBankPaymentId(ord.id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ord.id);
    let paymentInfo: any = null;

    if (isUuid) {
      try {
        paymentInfo = await orderService.getOrderPayment(ord.id);
      } catch (e) {
        console.warn('Could not fetch bank payment details from backend:', e);
      }
    }

    // Nếu backend chưa có hoặc đơn mock/offline (không phải UUID hoặc backend lỗi):
    // Tự tạo fallback thông tin thanh toán VietQR SePay chuẩn xác
    if (!paymentInfo) {
      const remainingAmount = ord.totalPaidVnd || ord.itemPriceVnd || (ord.listing?.priceVnd ?? 0) + (ord.shippingFeeVnd ?? 0) || 600000;
      paymentInfo = ord.bankPaymentDetails || {
        orderId: ord.id,
        bankName: 'MB',
        bankAccountNumber: '0388907604',
        bankAccountName: 'SECONDLIFE ESCROW',
        totalAmount: remainingAmount,
        paidAmount: 0,
        remainingAmount: remainingAmount,
        status: 'PENDING',
        orderStatus: 'PENDING_PAYMENT',
        transferContent: `SECONDLIFE ${ord.id}`,
        qrCodeUrl: `https://img.vietqr.io/image/MB-0388907604-compact2.png?amount=${remainingAmount}&addInfo=${encodeURIComponent(`SECONDLIFE ${ord.id}`)}&accountName=SECONDLIFE%20ESCROW`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        qrExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        sepayTransactionId: null,
        paymentMethod: 'BANK_TRANSFER'
      };
    }

    setBankPaymentOrder(ord);
    setBankPaymentInfo(paymentInfo);
    setLoadingBankPaymentId(null);
  };

  return { bankPaymentOrder, setBankPaymentOrder, bankPaymentInfo, setBankPaymentInfo, loadingBankPaymentId, handleOpenBankPaymentModal };
}
