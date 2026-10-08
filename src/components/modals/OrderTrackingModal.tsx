import React, { useState, useEffect, useCallback } from 'react';
import { EscrowOrder, Language, ShipmentBackend, ShipmentEventBackend } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  Truck,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  AlertTriangle,
  X,
  Printer,
  Copy,
  ExternalLink,
  Camera,
  PlayCircle,
  Check
} from 'lucide-react';
import { shippingService } from '../../services/shippingService';
import { orderService } from '../../services/orderService';

interface OrderTrackingModalProps {
  order: EscrowOrder;
  onClose: () => void;
  lang: Language;
  isSeller?: boolean;
  onConfirmReceipt?: (orderId: string) => void;
  onOpenLabelModal?: (shipment: ShipmentBackend) => void;
  onOrderUpdated?: () => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  order,
  onClose,
  lang,
  isSeller = false,
  onConfirmReceipt,
  onOpenLabelModal,
  onOrderUpdated,
}) => {
  const [shipments, setShipments] = useState<ShipmentBackend[]>([]);
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);
  const [events, setEvents] = useState<ShipmentEventBackend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmingDelivered, setIsConfirmingDelivered] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Polling state (15 - 20s interval as suggested in section D)
  const [pollingActive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Test simulation state (Sandbox for Localhost / Dev)
  const [showSandbox, setShowSandbox] = useState(false);
  const [simulatingStatus, setSimulatingStatus] = useState<string | null>(null);

  const activeShipment = shipments.find((s) => s.shipmentId === activeShipmentId) || shipments[0] || null;

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 6000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Fetch shipments and events
  const loadShipmentData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const shipList = await shippingService.getOrderShipments(order.id);
      setShipments(shipList);

      if (shipList.length > 0) {
        const targetId = activeShipmentId && shipList.some((s) => s.shipmentId === activeShipmentId)
          ? activeShipmentId
          : shipList[0].shipmentId;

        if (!activeShipmentId || activeShipmentId !== targetId) {
          setActiveShipmentId(targetId);
        }

        const evList = await shippingService.getShipmentEvents(targetId);
        setEvents(evList);
      } else {
        setEvents([]);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      console.warn('Error fetching shipment tracking data:', err);
      if (!isBackground) {
        setErrorMsg(err?.message || 'Không thể tải thông tin vận đơn từ hệ thống.');
      }
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [order.id, activeShipmentId]);

  // Initial load
  useEffect(() => {
    loadShipmentData();
  }, [loadShipmentData]);

  // Load events when user switches active shipment
  useEffect(() => {
    if (activeShipmentId) {
      shippingService.getShipmentEvents(activeShipmentId)
        .then((evList) => setEvents(evList))
        .catch(() => {});
    }
  }, [activeShipmentId]);

  // Polling Effect (runs every 20s if polling is active, clean up on unmount)
  useEffect(() => {
    if (!pollingActive) return;
    const interval = setInterval(() => {
      loadShipmentData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [pollingActive, loadShipmentData]);

  // Handle Sync GHN
  const handleSyncGhn = async () => {
    if (!activeShipment) return;
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const updated = await shippingService.syncShipment(activeShipment.shipmentId);
      showNotification(`Đã đồng bộ trạng thái thật từ GHN: ${updated.providerStatus || updated.status}`);
      await loadShipmentData();
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Lỗi khi đồng bộ trạng thái từ hệ thống GHN.', true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Cancel Shipment
  const handleCancelShipment = async () => {
    if (!activeShipment) return;
    if (!window.confirm('Bạn có chắc chắn muốn hủy vận đơn GHN này trước khi bưu tá đến lấy hàng?')) return;
    setIsCancelling(true);
    try {
      await shippingService.cancelShipment(activeShipment.shipmentId);
      showNotification('Đã hủy vận đơn GHN thành công.');
      await loadShipmentData();
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Không thể hủy vận đơn.', true);
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle Buyer Confirm Delivery
  const handleConfirmReceived = async () => {
    if (!window.confirm('Xác nhận bạn đã nhận được hàng và nghiệm thu thiết bị? Tiền sẽ được giải ngân cho người bán.')) return;
    setIsConfirmingDelivered(true);
    try {
      await orderService.confirmDelivery(order.id);
      showNotification('Đã xác nhận nhận hàng thành công! Đơn hàng hoàn tất và quỹ Escrow đã được giải ngân.');
      onConfirmReceipt?.(order.id);
      onOrderUpdated?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      showNotification(err?.message || 'Không thể xác nhận nhận hàng. Vui lòng kiểm tra lại trạng thái GHN.', true);
    } finally {
      setIsConfirmingDelivered(false);
    }
  };

  // Handle Copy Tracking Code
  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Handle Test Simulator (Picked / Delivered)
  const handleSimulateWebhook = async (status: 'picked' | 'delivered') => {
    if (!activeShipment?.orderCode) {
      showNotification('Chưa có mã vận đơn GHN hợp lệ để giả lập.', true);
      return;
    }
    setSimulatingStatus(status);
    try {
      const nowIso = new Date().toISOString();
      await shippingService.simulateWebhookCallback({
        ShopID: 123456,
        OrderCode: activeShipment.orderCode,
        Type: 'switch_status',
        Status: status,
        Time: nowIso,
      });
      showNotification(`Giả lập thành công: GHN chuyển trạng thái "${status.toUpperCase()}".`);
      await loadShipmentData();
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Giả lập callback thất bại.', true);
    } finally {
      setSimulatingStatus(null);
    }
  };

  // Step Calculation based on GHN providerStatus
  const getStepIndex = (providerStatus: string | null | undefined, shipmentStatus: string): number => {
    const s = (providerStatus || shipmentStatus || '').toLowerCase();
    if (s.includes('cancel')) return -1;
    if (s.includes('delivered') || s.includes('finish') || s.includes('complete')) return 4;
    if (s.includes('delivering') || s.includes('delivery')) return 3;
    if (s.includes('transport') || s.includes('storing') || s.includes('sorting')) return 2;
    if (s.includes('picked')) return 1;
    return 0; // ready_to_pick, picking, pending
  };

  const currentStep = getStepIndex(activeShipment?.providerStatus, activeShipment?.status || '');

  const steps = [
    { title: 'Chờ lấy hàng', desc: 'Bưu tá GHN được phân công đến lấy kiện' },
    { title: 'Đã lấy kiện', desc: 'GHN đã nhận hàng từ người gửi' },
    { title: 'Đang trung chuyển', desc: 'Kiện hàng qua trung tâm phân loại GHN' },
    { title: 'Đang giao hàng', desc: 'Shipper đang trên đường giao đến bạn' },
    { title: 'Đã giao thành công', desc: 'Kiện hàng đã bàn giao cho người nhận' },
  ];

  const getProviderStatusBadge = (providerStatus: string | null | undefined) => {
    const p = (providerStatus || 'ready_to_pick').toLowerCase();
    if (p.includes('delivered')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">GHN: Đã giao thành công</span>;
    }
    if (p.includes('delivering')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">GHN: Đang giao hàng</span>;
    }
    if (p.includes('transport') || p.includes('storing') || p.includes('sorting')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-300">GHN: Đang luân chuyển kho</span>;
    }
    if (p.includes('picked')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-cyan-100 text-cyan-800 border border-cyan-300">GHN: Đã lấy kiện từ người bán</span>;
    }
    if (p.includes('picking')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">GHN: Bưu tá đang đi lấy kiện</span>;
    }
    if (p.includes('cancel')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">GHN: Vận đơn đã hủy</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">GHN: Chờ bưu tá lấy hàng</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#fce5da] to-[#faf8f5] text-[#24263e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#c34c36] text-white flex items-center justify-center shadow-md">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-[#24263e]">
                  Hành Trình Giao Hàng GHN Express
                </h3>
                <span className="text-xs font-mono bg-white/80 px-2 py-0.5 rounded-md border border-[#24263e]/15 font-bold">
                  #{order.id.slice(0, 12)}
                </span>
              </div>
              <p className="text-[11px] text-[#24263e]/80 mt-0.5 flex items-center gap-2">
                <span>Đối tác vận chuyển chính thức: <strong>Giao Hàng Nhanh (GHN)</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${pollingActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                  Cập nhật lúc: {lastUpdated.toLocaleTimeString('vi-VN')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncGhn}
              disabled={isSyncing || !activeShipment}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Đồng bộ trực tiếp từ server GHN"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#c34c36]' : ''}`} />
              <span className="hidden sm:inline">Đồng bộ GHN</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#24263e] hover:bg-white/60 p-1.5 rounded-xl cursor-pointer transition font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 text-xs text-[#24263e] flex-1 overflow-y-auto subtle-scrollbar">
          {/* Notification Banners */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Product Summary Mini Card */}
          <div className="flex items-center gap-3.5 bg-[#faf8f5] p-3 rounded-2xl border border-gray-200">
            <img
              src={order.listing.photos.front}
              alt={order.listing.title}
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#c34c36] uppercase font-black">{order.listing.brand}</span>
                <span className="text-gray-300">•</span>
                <span className="text-[10px] text-slate-500 font-semibold">{order.listing.category}</span>
              </div>
              <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{order.listing.title}</h4>
              <div className="flex items-center justify-between mt-1 text-slate-600 text-[11px]">
                <span>Người bán: <strong className="text-slate-900">{order.sellerName}</strong></span>
                <span>Tiền hàng: <strong className="text-[#c34c36] font-bold">{formatVND(order.itemPriceVnd)}</strong></span>
              </div>
            </div>
          </div>

          {/* Multiple Shipments Tabs (if order has multiple shipments) */}
          {shipments.length > 1 && (
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <span className="font-bold text-slate-500 text-[11px]">Chọn kiện hàng:</span>
              {shipments.map((s, idx) => (
                <button
                  key={s.shipmentId}
                  onClick={() => setActiveShipmentId(s.shipmentId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeShipment?.shipmentId === s.shipmentId
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-slate-700'
                  }`}
                >
                  Kiện {idx + 1} ({s.leg || 'GHN'})
                </button>
              ))}
            </div>
          )}

          {/* Main Shipment Card */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#c34c36]" />
              <span className="font-bold text-sm">Đang tải dữ liệu tracking từ hệ thống GHN...</span>
            </div>
          ) : !activeShipment ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-gray-300 rounded-3xl space-y-3">
              <Package className="w-12 h-12 text-slate-400 mx-auto" />
              <h4 className="font-bold text-sm text-slate-800">Chưa có vận đơn nào được tạo</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Người bán chưa khởi tạo mã vận đơn GHN cho đơn hàng này. Vui lòng chờ người bán đóng gói và tạo vận đơn bàn giao cho bưu tá.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Shipment Meta Details Card */}
              <div className="bg-gradient-to-br from-white via-slate-50 to-[#faf8f5] p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3.5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Mã vận đơn GHN</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base sm:text-lg font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        {activeShipment.orderCode || 'CHƯA_CÓ_MÃ'}
                      </span>
                      {activeShipment.orderCode && (
                        <button
                          onClick={() => handleCopyCode(activeShipment.orderCode!)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-600 transition cursor-pointer"
                          title="Sao chép mã vận đơn"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-black">Trạng thái bưu kiện</span>
                    {getProviderStatusBadge(activeShipment.providerStatus)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-2xl border border-gray-200/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Thời gian giao dự kiến</span>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#c34c36]" />
                      <span>
                        {activeShipment.expectedDeliveryTime
                          ? new Date(activeShipment.expectedDeliveryTime).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '1-3 ngày làm việc'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border border-gray-200/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Thời điểm giao thực tế</span>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {activeShipment.deliveredAt
                          ? new Date(activeShipment.deliveredAt).toLocaleString('vi-VN')
                          : 'Chưa hoàn tất giao'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border border-gray-200/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Chặng giao nhận</span>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      <span>{activeShipment.leg === 'SELLER_TO_BUYER' ? 'Giao thẳng (Seller → Buyer)' : activeShipment.leg}</span>
                    </div>
                  </div>
                </div>

                {/* POD Proof of delivery if available */}
                {activeShipment.podUrl && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Camera className="w-5 h-5 text-emerald-700" />
                      <div>
                        <span className="font-bold text-emerald-900 block text-xs">Ảnh chụp bưu tá đã giao hàng thành công (POD)</span>
                        <span className="text-[11px] text-emerald-700">Biên bản chữ ký / ảnh bưu kiện tại cửa</span>
                      </div>
                    </div>
                    <a
                      href={activeShipment.podUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition shadow-2xs"
                    >
                      <span>Xem ảnh</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Last Error if present */}
                {activeShipment.lastError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Ghi chú bưu tá / cảnh báo GHN:</span>
                      <span>{activeShipment.lastError}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Visual 5-Step Stepper */}
              <div className="p-5 bg-white rounded-3xl border border-gray-200 space-y-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#c34c36]" />
                  <span>Tiến trình vận chuyển thực tế</span>
                </h4>

                <div className="relative pl-6 sm:pl-0 sm:grid sm:grid-cols-5 gap-2">
                  {steps.map((step, idx) => {
                    const isDone = currentStep > idx || (currentStep === 4 && idx === 4);
                    const isCurrent = currentStep === idx;
                    return (
                      <div key={idx} className="relative pb-6 sm:pb-0 flex sm:flex-col items-start sm:items-center text-left sm:text-center group">
                        {/* Connector line on desktop */}
                        {idx < steps.length - 1 && (
                          <div
                            className={`hidden sm:block absolute top-4 left-1/2 w-full h-1 -z-0 transition-colors ${
                              currentStep > idx ? 'bg-emerald-500' : 'bg-gray-200'
                            }`}
                          />
                        )}

                        {/* Step Icon */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs z-10 shrink-0 transition-all ${
                            isDone
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : isCurrent
                                ? 'bg-[#c34c36] text-white ring-4 ring-[#c34c36]/20 shadow-md animate-pulse'
                                : 'bg-gray-100 text-gray-400 border border-gray-300'
                          }`}
                        >
                          {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>

                        {/* Text */}
                        <div className="ml-3 sm:ml-0 sm:mt-2.5">
                          <span className={`block font-extrabold text-xs ${isCurrent ? 'text-[#c34c36]' : isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                            {step.title}
                          </span>
                          <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5 leading-snug">
                            {step.desc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline of Events (GET /api/v1/shipments/{id}/events) */}
              <div className="p-5 bg-white rounded-3xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#c34c36]" />
                    <span>Lịch sử sự kiện & Nhật ký bưu cục ({events.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Thời gian UTC/Local</span>
                </div>

                {events.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    Chưa có nhật ký sự kiện ghi nhận từ GHN. Bưu tá sẽ cập nhật khi có thao tác lấy hoặc xuất kho.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {events.map((ev, index) => (
                      <div key={ev.id || index} className="relative flex items-start gap-3 group">
                        <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#c34c36] group-first:bg-[#c34c36]" />
                        <div className="flex-1 bg-[#faf8f5] p-3 rounded-2xl border border-gray-200 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-extrabold text-slate-900 uppercase">
                              {ev.status || ev.type || 'CẬP NHẬT TRẠNG THÁI'}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              {new Date(ev.occurredAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          {ev.reason && (
                            <p className="text-slate-600 text-xs">{ev.reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Print Label Button for Seller */}
                  {onOpenLabelModal && activeShipment && (
                    <button
                      onClick={() => onOpenLabelModal(activeShipment)}
                      className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-[#c34c36]" />
                      <span>In Phiếu Gửi GHN</span>
                    </button>
                  )}

                  {/* Cancel Shipment Button for Seller (only if before picked) */}
                  {isSeller && currentStep <= 0 && activeShipment?.status !== 'CANCELLED' && (
                    <button
                      onClick={handleCancelShipment}
                      disabled={isCancelling}
                      className="px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 cursor-pointer disabled:opacity-50"
                    >
                      {isCancelling ? 'Đang hủy...' : 'Hủy Vận Đơn GHN'}
                    </button>
                  )}
                </div>

                {/* Confirm Receipt for Buyer when Delivered */}
                {!isSeller && (
                  <div>
                    {activeShipment.providerStatus === 'delivered' || activeShipment.deliveredAt ? (
                      <button
                        onClick={handleConfirmReceived}
                        disabled={isConfirmingDelivered}
                        className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-90 text-white text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isConfirmingDelivered ? 'Đang giải ngân...' : 'Xác Nhận Đã Nhận Hàng (Giải Ngân)'}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">
                        (Nút xác nhận nhận hàng sẽ mở sau khi GHN cập nhật giao thành công)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Sandbox Test Simulator (Section 10 in Tracking_API_GUIDE) */}
              <div className="mt-4 border border-dashed border-amber-300 bg-amber-50/50 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      Sandbox Test GHN
                    </span>
                    <span className="text-xs font-bold text-amber-900">
                      Công cụ giả lập trạng thái GHN (Bước 10 trong hướng dẫn)
                    </span>
                  </div>
                  <button
                    onClick={() => setShowSandbox(!showSandbox)}
                    className="text-[11px] font-bold text-amber-800 hover:underline cursor-pointer"
                  >
                    {showSandbox ? 'Thu gọn' : 'Mở công cụ giả lập'}
                  </button>
                </div>

                {showSandbox && (
                  <div className="pt-2 border-t border-amber-200 text-xs space-y-2 text-amber-950 animate-fadeIn">
                    <p className="text-[11px] text-amber-800">
                      Dùng để kiểm thử toàn diện luồng SecondLife mà không cần bưu tá thật giao ngoài đời. Bấm nút dưới để kích hoạt callback giả lập:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleSimulateWebhook('picked')}
                        disabled={simulatingStatus !== null}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>1. Giả lập: GHN Đã Lấy Hàng (picked)</span>
                      </button>

                      <button
                        onClick={() => handleSimulateWebhook('delivered')}
                        disabled={simulatingStatus !== null}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>2. Giả lập: GHN Đã Giao Thành Công (delivered)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
