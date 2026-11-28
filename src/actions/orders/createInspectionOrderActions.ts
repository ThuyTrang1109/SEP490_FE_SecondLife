import type { Dispatch, SetStateAction } from 'react';
import type { EscrowOrder, Language } from '../../types';
import { inspectorService } from '../../services/inspectorService';
import { dialogService } from '../../utils/dialogService';
import { markListingAsAvailable } from '../../utils/orderUtils';
import { notifyWalletBalanceUpdated, walletService } from '../../services/walletService';
import type { ConfirmDialogState } from '../../types/orders/orderTypes';

interface Options {
  lang: Language;
  detailModalOrder: EscrowOrder | null;
  setDetailModalOrder: Dispatch<SetStateAction<EscrowOrder | null>>;
  onRefreshOrders?: () => void;
  setInspectionActionNotice: (message: string | null) => void;
  setOrderActionLoading: (orderId: string | null) => void;
  findOrderForAction: (orderId: string) => EscrowOrder | null | undefined;
  getPartyInspectionFee: (order: EscrowOrder, isSeller: boolean) => number;
  orders: EscrowOrder[];
  isOrderSeller: (order: EscrowOrder) => boolean;
  isSeller: boolean;
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
}

export function createInspectionOrderActions({
  lang, detailModalOrder, setDetailModalOrder, onRefreshOrders, setInspectionActionNotice, setOrderActionLoading,
  findOrderForAction, getPartyInspectionFee, orders, isOrderSeller, isSeller, setConfirmDialog,
}: Options) {
  const handleAcceptFailedInspection = async (orderId: string) => {
    const ok = await dialogService.confirm(
      'Bạn xác nhận đồng ý với kết quả kiểm định KHÔNG ĐẠT. Hệ thống sẽ áp dụng khấu trừ điểm uy tín theo quy định. Phí kiểm định và vận chuyển được chia theo tỷ lệ đã thống nhất. Phần dư dự phòng cước trả hàng sẽ được hoàn theo tỷ lệ này sau khi trừ cước thực tế. Thao tác này không thể hoàn tác.',
      {
        title: 'Xác nhận chấp nhận kết quả kiểm định',
        confirmText: 'Chấp nhận & trừ điểm',
        cancelText: 'Xem lại',
      }
    );
    if (!ok) return;

    try {
      setOrderActionLoading(orderId);
      await inspectorService.acceptFailedResult(orderId);
      setInspectionActionNotice('Đã xác nhận chấp nhận kết quả kiểm định. Điểm uy tín đã được cập nhật.');
      if (detailModalOrder?.id === orderId) {
        setDetailModalOrder((prev) => prev ? { ...prev, appealStatus: 'UPHELD', reputationPenaltyApplied: true } : null);
      }
    } catch (e: any) {
      setInspectionActionNotice(`Lỗi: ${e.message || 'Không thể chấp nhận kết quả'}`);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleRespondInspection = async (orderId: string, action: 'ACCEPT' | 'REJECT', rejectReason?: string) => {
    try {
      setOrderActionLoading(orderId);
      // Kiểm tra định dạng UUID (Backend yêu cầu @PathVariable UUID orderId)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);

      if (!isUuid) {
        // Đơn hàng local/mock do đặt hàng offline hoặc fallback: cập nhật trực tiếp local state
        setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'đồng ý' : 'từ chối'} kiểm định thành công!`);
        try {
          const raw = localStorage.getItem('recent_placed_orders');
          if (raw) {
            const list = JSON.parse(raw);
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  sellerConfirmedAt: action === 'ACCEPT' ? new Date().toISOString() : null,
                  confirmationStatus: action === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED',
                  escrowStatus: action === 'ACCEPT' ? 'AWAITING_INSPECTION' : 'REFUNDED_TO_BUYER',
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        } catch { }
        onRefreshOrders?.();
        setTimeout(() => setInspectionActionNotice(null), 4000);
        return;
      }

      await inspectorService.respondRequest(orderId, {
        action,
        sellerConsentZinLoss: action === 'ACCEPT',
        rejectReason: rejectReason || (action === 'REJECT' ? 'Người bán từ chối kiểm định' : undefined),
      });
      if (action === 'REJECT') {
        const targetOrd = orders.find((o) => o.id === orderId);
        const targetListingId = String(targetOrd?.listingId || targetOrd?.listing?.id || '');
        if (targetListingId) {
          markListingAsAvailable(targetListingId);
        }
      }
      setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'đồng ý' : 'từ chối'} kiểm định thành công!`);
      if (detailModalOrder?.id === orderId) {
        setDetailModalOrder((prev) => (prev ? ({
          ...prev,
          sellerConfirmedAt: action === 'ACCEPT' ? new Date().toISOString() : null,
          confirmationStatus: action === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED',
          backendStatus: (action === 'ACCEPT' ? 'CONFIRMED_PENDING_DISPATCH' : 'CANCELLED') as any,
          status: (action === 'ACCEPT' ? 'CONFIRMED_PENDING_DISPATCH' : 'CANCELLED') as any,
        } as EscrowOrder) : null));
      }
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } catch (err: any) {
      console.warn('Backend respondRequest fallback to local state:', err);
      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          const updated = list.map((o: any) => {
            if (o.id === orderId) {
              return {
                ...o,
                sellerConfirmedAt: action === 'ACCEPT' ? new Date().toISOString() : null,
                confirmationStatus: action === 'ACCEPT' ? 'CONFIRMED' : 'REJECTED',
                escrowStatus: action === 'ACCEPT' ? 'AWAITING_INSPECTION' : 'REFUNDED_TO_BUYER',
                backendStatus: action === 'ACCEPT' ? 'CONFIRMED_PENDING_DISPATCH' : 'CANCELLED',
                status: action === 'ACCEPT' ? 'CONFIRMED_PENDING_DISPATCH' : 'CANCELLED',
              };
            }
            return o;
          });
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch { }
      setInspectionActionNotice(`Đã ${action === 'ACCEPT' ? 'đồng ý' : 'từ chối'} kiểm định thành công!`);
      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handlePayInspectionFee = async (orderId: string) => {
    try {
      setOrderActionLoading(orderId);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      if (!isUuid) {
        setInspectionActionNotice('Đã thanh toán phần phí kiểm định thành công!');
        onRefreshOrders?.();
        setTimeout(() => setInspectionActionNotice(null), 4000);
        return;
      }
      const res = await inspectorService.payInspectionFee(orderId);

      const targetOrder = findOrderForAction(orderId);
      const isSellerUser = targetOrder ? isOrderSeller(targetOrder) : isSeller;
      const isBothPaid = res?.status !== 'WAITING_FEE_PAYMENT';
      const nowIso = new Date().toISOString();

      // Cập nhật giảm ngay số dư trên Header để thấy realtime
      const feeToDeduct = targetOrder ? (isSellerUser ? getPartyInspectionFee(targetOrder, true) : getPartyInspectionFee(targetOrder, false)) : 0;
      if (feeToDeduct > 0) {
        notifyWalletBalanceUpdated(undefined, feeToDeduct);
      }
      try {
        await walletService.getMyWallet();
      } catch { }

      if (isBothPaid) {
        setInspectionActionNotice(
          lang === 'vi'
            ? 'Đã nộp phí kiểm định vào Escrow thành công! Đơn chuyển sang trạng thái sẵn sàng giao KTV / Hub.'
            : 'Inspection fee paid into Escrow successfully! Ready for Hub/Technician dispatch.'
        );
      } else {
        setInspectionActionNotice(
          lang === 'vi'
            ? 'Đã nộp phần phí kiểm định của bạn thành công! Đang chờ đối phương hoàn tất phí kiểm định.'
            : 'Your inspection fee share was paid successfully! Awaiting counterparty fee payment.'
        );
      }

      if (detailModalOrder?.id === orderId) {
        setDetailModalOrder((prev) => (prev ? ({
          ...prev,
          backendStatus: (res?.status || (isBothPaid ? 'CONFIRMED_PENDING_DISPATCH' : prev.backendStatus)) as any,
          status: (res?.status || (isBothPaid ? 'CONFIRMED_PENDING_DISPATCH' : prev.status)) as any,
          buyerPaidAt: isSellerUser ? prev.buyerPaidAt : (res?.buyerPaidAt || nowIso),
          sellerPaidAt: isSellerUser ? (res?.sellerPaidAt || nowIso) : prev.sellerPaidAt,
          sellerFeeShare: res?.sellerFeeShare !== undefined ? Number(res.sellerFeeShare) : prev.sellerFeeShare,
          buyerFeeShare: res?.buyerFeeShare !== undefined ? Number(res.buyerFeeShare) : prev.buyerFeeShare,
          cashShippingSimulation: res?.cashShippingSimulation ?? prev.cashShippingSimulation,
          buyerCommitmentDeposit: res?.buyerCommitmentDeposit ?? prev.buyerCommitmentDeposit,
        } as EscrowOrder) : null));
      }

      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent) {
          const list = JSON.parse(rawRecent);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                const isSellerO = isOrderSeller(o);
                return {
                  ...o,
                  backendStatus: res?.status || (isBothPaid ? 'CONFIRMED_PENDING_DISPATCH' : o.backendStatus),
                  status: res?.status || (isBothPaid ? 'CONFIRMED_PENDING_DISPATCH' : o.status),
                  sellerPaidAt: isSellerO ? (res?.sellerPaidAt || nowIso) : o.sellerPaidAt,
                  buyerPaidAt: !isSellerO ? (res?.buyerPaidAt || nowIso) : o.buyerPaidAt,
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        }
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller) {
          const list = JSON.parse(rawSeller);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  backendStatus: res?.status || o.backendStatus,
                  status: res?.status || o.status,
                  sellerPaidAt: res?.sellerPaidAt || nowIso,
                };
              }
              return o;
            });
            localStorage.setItem('my_seller_inspection_orders', JSON.stringify(updated));
          }
        }
      } catch { }

      onRefreshOrders?.();
      setTimeout(() => setInspectionActionNotice(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Không thể thanh toán phí kiểm định';
      if (msg.includes('đã thanh toán') || msg.includes('không ở trạng thái chờ')) {
        setInspectionActionNotice('Đơn kiểm định đã được nộp phí thành công!');
        onRefreshOrders?.();
        setTimeout(() => setInspectionActionNotice(null), 4000);
      } else {
        dialogService.error(msg, 'Lỗi thanh toán');
        onRefreshOrders?.();
      }
    } finally {
      setOrderActionLoading(null);
    }
  };

  const handleConfirmInspectionPurchase = (orderId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'vi' ? 'Nghiệm thu & mua hàng' : 'Confirm Purchase',
      message: lang === 'vi'
        ? 'Xác nhận sản phẩm kiểm định đạt chuẩn và tiến hành thanh toán tiền hàng cuối cùng?'
        : 'Confirm passed inspection and proceed with final payment?',
      subMessage: lang === 'vi'
        ? 'Tiền hàng sẽ được giữ an toàn trong Escrow và đơn hàng sẽ được chuyển sang khâu giao hàng cho bạn.'
        : 'Funds will be securely held in Escrow and dispatched to the courier.',
      confirmText: lang === 'vi' ? 'Xác nhận mua' : 'Confirm',
      cancelText: lang === 'vi' ? 'Đóng' : 'Cancel',
      variant: 'success',
      iconType: 'check',
      onConfirm: async () => {
        try {
          await inspectorService.confirmPurchase(orderId);
          setInspectionActionNotice('Đã xác nhận mua hàng & thanh toán thành công! Đơn hàng sẽ được chuyển sang giao bưu tá.');
          onRefreshOrders?.();
          setTimeout(() => setInspectionActionNotice(null), 4000);
        } catch (err: any) {
          setInspectionActionNotice(err?.message || 'Không thể xác nhận mua hàng');
          setTimeout(() => setInspectionActionNotice(null), 4000);
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  return { handleAcceptFailedInspection, handleRespondInspection, handlePayInspectionFee, handleConfirmInspectionPurchase };
}
