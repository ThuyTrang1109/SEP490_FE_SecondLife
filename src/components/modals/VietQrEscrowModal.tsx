import React, { useState, useEffect } from 'react';
import { EscrowOrder, Language } from '../../types';
import { formatVND } from '../../utils/translations';
import { orderService } from '../../services/orderService';
import {
  ShieldCheck,
  QrCode,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  Lock,
} from 'lucide-react';

export interface VietQrEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: EscrowOrder;
  bankPaymentInfo: any;
  onPaymentSuccess?: (paidOrder: EscrowOrder) => void;
  lang?: Language;
}

export const VietQrEscrowModal: React.FC<VietQrEscrowModalProps> = ({
  isOpen,
  onClose,
  order,
  bankPaymentInfo: initialBankInfo,
  onPaymentSuccess,
  lang = 'vi',
}) => {
  const [bankInfo, setBankInfo] = useState<any>(initialBankInfo);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setBankInfo(initialBankInfo);
  }, [initialBankInfo]);

  // Setup Countdown Timer theo trường expiresAt từ dữ liệu Backend
  useEffect(() => {
    if (!isOpen || !bankInfo) {
      setSecondsLeft(null);
      setIsExpired(false);
      return;
    }

    const calcRemaining = () => {
      if (!bankInfo.expiresAt) {
        return 15 * 60; // 15 phút mặc định nếu BE chưa trả về
      }
      const expMs = new Date(bankInfo.expiresAt).getTime();
      const nowMs = Date.now();
      return Math.floor((expMs - nowMs) / 1000);
    };

    const diff = calcRemaining();
    if (diff <= 0 || bankInfo.status === 'EXPIRED') {
      setSecondsLeft(0);
      setIsExpired(true);
      return;
    }

    setSecondsLeft(diff);
    setIsExpired(false);

    const timer = setInterval(() => {
      const cur = calcRemaining();
      if (cur <= 0) {
        setSecondsLeft(0);
        setIsExpired(true);
        clearInterval(timer);
      } else {
        setSecondsLeft(cur);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, bankInfo?.expiresAt, bankInfo?.status]);

  // Polling tự động kiểm tra đối soát SePay thời gian thực mỗi 3 giây (Zero-Refresh)
  useEffect(() => {
    if (!isOpen || !bankInfo || !order || isExpired || isSuccess) return;

    const orderId = order.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (!isUuid) return;

    const interval = setInterval(async () => {
      try {
        const fresh = await orderService.getOrderPayment(orderId);
        if (fresh) {
          setBankInfo(fresh);
          const isPaid = fresh.status === 'PAID' || fresh.remainingAmount === 0 || fresh.orderStatus === 'PROCESSING';
          if (isPaid) {
            setIsSuccess(true);
            const paidOrder: EscrowOrder = {
              ...order,
              escrowStatus: 'HELD_IN_ESCROW',
              backendStatus: 'PROCESSING',
            };
            try {
              const raw = localStorage.getItem('recent_placed_orders');
              const list = raw ? JSON.parse(raw) : [];
              const updated = list.map((o: any) => o.id === orderId ? { ...o, escrowStatus: 'HELD_IN_ESCROW', backendStatus: 'PROCESSING' } : o);
              localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
            } catch {}
            setTimeout(() => {
              onPaymentSuccess?.(paidOrder);
              onClose();
            }, 1800);
          } else if (fresh.status === 'EXPIRED') {
            setIsExpired(true);
          }
        }
      } catch (e) {
        // quiet ignore polling error
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, bankInfo, order, isExpired, isSuccess, onPaymentSuccess, onClose]);

  if (!isOpen || !order || !bankInfo) return null;

  const remainingToPay = bankInfo.remainingAmount ?? bankInfo.totalAmount ?? order.totalPaidVnd;
  const transferContent = bankInfo.transferContent || order.id;
  const bankAccountName = bankInfo.bankAccountName || 'SECONDLIFE ESCROW';
  const bankAccountNumber = bankInfo.bankAccountNumber || '0388907604';
  const bankName = bankInfo.bankName || 'MB';

  const vietQrUrl = `https://img.vietqr.io/image/${bankName}-${bankAccountNumber}-compact2.png?amount=${remainingToPay}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankAccountName)}`;

  const handleManualCheck = async () => {
    setIsChecking(true);
    const orderId = order.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (!isUuid) {
      setTimeout(() => {
        setIsChecking(false);
      }, 1000);
      return;
    }
    try {
      const fresh = await orderService.getOrderPayment(order.id);
      setBankInfo(fresh);
      const isPaid = fresh.status === 'PAID' || fresh.remainingAmount === 0 || fresh.orderStatus === 'PROCESSING';
      if (isPaid) {
        setIsSuccess(true);
        const paidOrder: EscrowOrder = {
          ...order,
          escrowStatus: 'HELD_IN_ESCROW',
          backendStatus: 'PROCESSING',
        };
        try {
          const raw = localStorage.getItem('recent_placed_orders');
          const list = raw ? JSON.parse(raw) : [];
          const updated = list.map((o: any) => o.id === order.id ? { ...o, escrowStatus: 'HELD_IN_ESCROW', backendStatus: 'PROCESSING' } : o);
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        } catch {}
        setTimeout(() => {
          onPaymentSuccess?.(paidOrder);
          onClose();
        }, 1500);
      }
    } catch (e) {
      console.warn('Manual payment check error:', e);
    } finally {
      setIsChecking(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Header */}
        <div className="p-5 border-b border-[#24263e]/15 flex items-center justify-between bg-gradient-to-r from-blue-50 to-[#faf8f5] text-[#24263e] shrink-0 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#24263e] text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#24263e]">
                {lang === 'vi' ? 'Ký Quỹ Escrow Qua Ngân Hàng VietQR (SePay)' : 'Escrow Deposit via VietQR'}
              </h3>
              <p className="text-[11px] text-slate-600 font-bold">
                Đơn hàng: #{order.id} • Ký quỹ để đóng băng tiền bảo vệ giao dịch
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#24263e] hover:bg-white/40 p-1.5 rounded-xl cursor-pointer transition font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto subtle-scrollbar">
          {/* Status & Countdown Timer Banner */}
          {isSuccess ? (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 font-semibold flex items-center gap-3 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h5 className="font-bold text-sm text-emerald-800">🎉 Đã Ký Quỹ Escrow Thành Công!</h5>
                <p className="text-[11px] text-emerald-700">
                  Số tiền {formatVND(remainingToPay)} đã được hệ thống đóng băng an toàn tại Quỹ Escrow. Đang chuyển hướng...
                </p>
              </div>
            </div>
          ) : isExpired ? (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 font-semibold flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <h5 className="font-bold text-sm text-rose-800">⚠️ Mã Ký Quỹ Đã Quá Hạn (15 Phút Backend)</h5>
                <p className="text-[11px] text-rose-700">
                  Thời hạn ký quỹ theo dữ liệu Backend đã kết thúc. Vui lòng không chuyển khoản vào mã này nữa để tránh đơn bị tự động hủy.
                </p>
              </div>
            </div>
          ) : (
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
              (secondsLeft ?? 900) < 180
                ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${(secondsLeft ?? 900) < 180 ? 'text-amber-600 animate-spin' : 'text-blue-600'}`} />
                <div>
                  <span className="font-bold text-xs">
                    {lang === 'vi' ? 'Thời gian chuyển tiền ký quỹ còn lại:' : 'Remaining deposit window:'}
                  </span>
                  {bankInfo.expiresAt && (
                    <span className="text-[10px] text-slate-500 block">
                      Hạn chót BE: {new Date(bankInfo.expiresAt).toLocaleTimeString('vi-VN')} ({new Date(bankInfo.expiresAt).toLocaleDateString('vi-VN')})
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`text-base font-black font-mono px-2.5 py-1 rounded-xl border ${
                  (secondsLeft ?? 900) < 180
                    ? 'bg-rose-100 border-rose-300 text-rose-700 font-extrabold'
                    : 'bg-white border-blue-200 text-blue-800'
                }`}>
                  {secondsLeft !== null
                    ? `${Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`
                    : '15:00'}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-[#faf8f5] p-4 rounded-2xl border border-slate-200">
            {/* QR Image with Expired Blur Overlay */}
            <div className="relative flex flex-col items-center justify-center bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <img
                src={vietQrUrl}
                alt="VietQR Code"
                className={`w-48 h-48 object-contain rounded-xl transition-all ${
                  isExpired ? 'filter blur-sm opacity-40' : ''
                }`}
              />
              {isExpired && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-2xl p-4 text-center">
                  <XCircle className="w-8 h-8 text-rose-400 mb-1" />
                  <span className="text-white font-extrabold text-xs uppercase bg-rose-600 px-2 py-0.5 rounded shadow">
                    MÃ KÝ QUỸ ĐÃ HẾT HẠN
                  </span>
                  <span className="text-[10px] text-white/90 mt-1">Không chuyển tiền</span>
                </div>
              )}
              {!isExpired && (
                <span className="text-[10px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#c34c36]" />
                  <span>Quét bằng app ngân hàng bất kỳ</span>
                </span>
              )}
            </div>

            {/* Bank Details */}
            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Số tiền ký quỹ (Đóng băng Escrow):</span>
                <div className="flex items-center justify-between mt-0.5">
                  <strong className="text-base font-black text-[#c34c36] font-mono">{formatVND(remainingToPay)}</strong>
                  <button
                    type="button"
                    disabled={isExpired}
                    onClick={() => copyToClipboard(String(remainingToPay), 'amount')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition cursor-pointer disabled:opacity-40"
                  >
                    {copiedField === 'amount' ? '✓ Đã chép' : 'Sao chép'}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Nội dung CK (Bắt buộc chính xác):</span>
                <div className="flex items-center justify-between mt-0.5 bg-amber-50 p-1.5 rounded-xl border border-amber-200">
                  <strong className="text-xs font-black text-amber-950 font-mono">{transferContent}</strong>
                  <button
                    type="button"
                    disabled={isExpired}
                    onClick={() => copyToClipboard(transferContent, 'content')}
                    className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[10px] transition cursor-pointer disabled:opacity-40"
                  >
                    {copiedField === 'content' ? '✓ Đã chép' : 'Sao chép'}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Ngân hàng thụ hưởng:</span>
                <strong className="text-xs text-slate-900 block mt-0.5">{bankName}</strong>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Số tài khoản:</span>
                <div className="flex items-center justify-between mt-0.5">
                  <strong className="text-xs font-mono text-slate-900">{bankAccountNumber}</strong>
                  <button
                    type="button"
                    disabled={isExpired}
                    onClick={() => copyToClipboard(bankAccountNumber, 'account')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition cursor-pointer disabled:opacity-40"
                  >
                    {copiedField === 'account' ? '✓ Đã chép' : 'Sao chép'}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Chủ tài khoản:</span>
                <strong className="text-xs text-slate-900 block mt-0.5">{bankAccountName}</strong>
              </div>
            </div>
          </div>

          {/* Escrow Freeze Funds Messaging */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl text-[11px] text-blue-950 space-y-1.5">
            <div className="font-extrabold flex items-center gap-1.5 text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Cơ Chế Ký Quỹ Đóng Băng Tiền (Escrow Protection):</span>
            </div>
            <p className="text-slate-600 leading-snug">
              Khoản tiền này sẽ được cổng SePay đối soát và <strong>đóng băng an toàn tại Quỹ Ký Quỹ Escrow</strong> của SecondLife. Người bán <strong>hoàn toàn CHƯA nhận được tiền</strong> cho đến khi bạn nhận được hàng, kiểm tra 48h và bấm xác nhận hài lòng.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[10px] font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span>Hệ thống đang tự động đối soát theo thời gian thực (mỗi 3 giây)...</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isChecking || isExpired}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái đối soát'}</span>
            </button>

            <button
              type="button"
              onClick={isSuccess ? onClose : handleManualCheck}
              disabled={!isSuccess && (isChecking || isExpired)}
              className="px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#dc4729] text-white font-black text-xs cursor-pointer shadow-md transition disabled:opacity-50"
            >
              {isSuccess
                ? 'Xem Đơn Hàng Ngay'
                : 'Tôi Đã Chuyển Khoản • Kiểm Tra Ngay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
