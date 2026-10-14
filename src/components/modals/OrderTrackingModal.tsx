import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EscrowOrder, Language, ShipmentBackend, ShipmentEventBackend, LalamoveTrackingResponse } from '../../types';
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
  Check,
  User,
  Phone,
  MapPin,
  Navigation
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

function loadLeaflet(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).L) {
    return Promise.resolve((window as any).L);
  }
  return new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L);
    script.onerror = (e) => reject(e);
    document.body.appendChild(script);
  });
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
  const [trackingData, setTrackingData] = useState<LalamoveTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmingDelivered, setIsConfirmingDelivered] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Polling state (10 - 15s interval as specified in Section 10.4 of guide)
  const [pollingActive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Test simulation state (Sandbox for Localhost / Dev)
  const [showSandbox, setShowSandbox] = useState(false);
  const [simulatingStatus, setSimulatingStatus] = useState<string | null>(null);

  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

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

  // Fetch shipments, events and Lalamove tracking details
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

        // Parallel load tracking and events
        const [evList, trackRes] = await Promise.allSettled([
          shippingService.getShipmentEvents(targetId),
          shippingService.getShipmentTracking(targetId),
        ]);

        if (evList.status === 'fulfilled') {
          setEvents(evList.value);
        } else {
          setEvents([]);
        }

        if (trackRes.status === 'fulfilled') {
          setTrackingData(trackRes.value);
        }
      } else {
        setEvents([]);
        setTrackingData(null);
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

  // Load events and tracking when user switches active shipment
  useEffect(() => {
    if (activeShipmentId) {
      shippingService.getShipmentEvents(activeShipmentId)
        .then((evList) => setEvents(evList))
        .catch(() => {});
      shippingService.getShipmentTracking(activeShipmentId)
        .then((data) => setTrackingData(data))
        .catch(() => {});
    }
  }, [activeShipmentId]);

  // Polumi / Polling Effect (12 seconds)
  useEffect(() => {
    if (!pollingActive) return;
    const interval = setInterval(() => {
      loadShipmentData(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [pollingActive, loadShipmentData]);

  // Render Leaflet map when driver GPS coordinates are AVAILABLE
  useEffect(() => {
    const coordinates = trackingData?.driver?.coordinates;
    const isLocationAvailable = trackingData?.locationStatus === 'AVAILABLE' && coordinates;
    const lat = coordinates ? Number(coordinates.lat) : NaN;
    const lng = coordinates ? Number(coordinates.lng) : NaN;
    const hasValidCoords = isLocationAvailable && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

    if (!hasValidCoords) {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const container = document.getElementById('lalamove-driver-map');
      if (!container) return;

      loadLeaflet().then((L) => {
        if (!mapInstanceRef.current) {
          const map = L.map('lalamove-driver-map', {
            zoomControl: true,
            scrollWheelZoom: false,
          }).setView([lat, lng], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
          }).addTo(map);

          const icon = L.divIcon({
            className: 'custom-driver-icon',
            html: '<div style="background-color:#ea580c;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(0,0,0,0.3);border:2px solid white;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17h4V5H2v12h3m15 0h2v-3.34a4 4 0 0 0-1.17-2.83L19 8h-5v9h2"/></svg></div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });

          const marker = L.marker([lat, lng], { icon }).addTo(map);
          marker.bindPopup(`<b>Vị trí tài xế Lalamove</b><br>${coordinates?.updatedAt ? new Date(coordinates.updatedAt).toLocaleTimeString('vi-VN') : 'Đang giao'}`).openPopup();

          mapInstanceRef.current = map;
          markerRef.current = marker;
        } else {
          mapInstanceRef.current.setView([lat, lng], 15);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          }
        }
      }).catch((e) => console.warn('Leaflet map error:', e));
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [trackingData?.locationStatus, trackingData?.driver?.coordinates?.lat, trackingData?.driver?.coordinates?.lng]);

  // Clean map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Handle Sync Lalamove
  const handleSyncLalamove = async () => {
    if (!activeShipment) return;
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const updated = await shippingService.syncShipment(activeShipment.shipmentId);
      showNotification(`Đã đồng bộ trạng thái thật từ Lalamove: ${updated.providerStatus || updated.status}`);
      await loadShipmentData();
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Lỗi khi đồng bộ trạng thái từ hệ thống Lalamove.', true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Cancel Shipment
  const handleCancelShipment = async () => {
    if (!activeShipment) return;
    if (!window.confirm('Bạn có chắc chắn muốn hủy vận đơn Lalamove này trước khi tài xế đến lấy hàng?')) return;
    setIsCancelling(true);
    try {
      await shippingService.cancelShipment(activeShipment.shipmentId);
      showNotification('Đã hủy vận đơn Lalamove thành công.');
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
      showNotification(err?.message || 'Không thể xác nhận nhận hàng. Vui lòng kiểm tra lại trạng thái Lalamove.', true);
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
      showNotification('Chưa có mã vận đơn Lalamove hợp lệ để giả lập.', true);
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
      showNotification(`Giả lập thành công: Lalamove chuyển trạng thái "${status.toUpperCase()}".`);
      await loadShipmentData();
      onOrderUpdated?.();
    } catch (err: any) {
      showNotification(err?.message || 'Giả lập callback thất bại.', true);
    } finally {
      setSimulatingStatus(null);
    }
  };

  // Step Calculation based on Lalamove providerStatus (Section 10.2)
  const getStepIndex = (
    providerStatus: string | null | undefined,
    shipmentStatus: string,
    orderCompleted = false
  ): number => {
    const p = (providerStatus || '').toUpperCase();
    const s = (shipmentStatus || '').toUpperCase();
    if (p.includes('CANCEL') || s.includes('CANCEL')) return -1;
    if (p.includes('REJECT') || p.includes('EXPIRE') || s.includes('FAIL')) return -2;
    if (orderCompleted || (s === 'DELIVERED' && order.backendStatus === 'COMPLETED')) return 4;
    if (p === 'COMPLETED' || s === 'DELIVERED') return 3;
    if (p === 'PICKED_UP' || s === 'PICKED' || s === 'SHIPPED') return 2;
    if (p === 'ON_GOING' || s === 'ASSIGNED') return 1;
    return 0; // ASSIGNING_DRIVER, READY_TO_PICK, PENDING
  };

  const currentStep = getStepIndex(
    trackingData?.providerStatus || activeShipment?.providerStatus,
    activeShipment?.status || '',
    order.backendStatus === 'COMPLETED' || order.escrowStatus === 'COMPLETED_RELEASED'
  );

  const steps = [
    { title: 'Tạo vận đơn', desc: 'Đang điều phối tài xế Lalamove' },
    { title: 'Tài xế nhận đơn', desc: 'Tài xế đang di chuyển tới lấy hàng' },
    { title: 'Đã lấy kiện', desc: 'Tài xế đã nhận hàng & đang giao' },
    { title: 'Đã giao thành công', desc: 'Kiện hàng đã bàn giao tới người nhận' },
    { title: 'Quyết toán', desc: 'Người mua xác nhận & giải ngân Escrow' },
  ];

  const getProviderStatusBadge = (providerStatus: string | null | undefined) => {
    const p = (providerStatus || 'ASSIGNING_DRIVER').toUpperCase();
    if (p === 'COMPLETED') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">Lalamove: Đã giao thành công</span>;
    }
    if (p === 'PICKED_UP') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">Lalamove: Đã lấy hàng & Đang giao</span>;
    }
    if (p === 'ON_GOING') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-300 animate-pulse">Lalamove: Tài xế đang đến lấy hàng</span>;
    }
    if (p === 'ASSIGNING_DRIVER') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">Lalamove: Đang tìm tài xế</span>;
    }
    if (p.includes('CANCEL')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">Lalamove: Vận đơn đã hủy</span>;
    }
    if (p.includes('REJECT') || p.includes('EXPIRE')) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">Lalamove: Từ chối / Hết hạn</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">{providerStatus}</span>;
  };

  const coordinates = trackingData?.driver?.coordinates;
  const isLocationAvailable = trackingData?.locationStatus === 'AVAILABLE' && coordinates;
  const lat = coordinates ? Number(coordinates.lat) : NaN;
  const lng = coordinates ? Number(coordinates.lng) : NaN;
  const hasValidCoords = isLocationAvailable && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#ffe8d6] to-[#faf8f5] text-[#24263e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-center shadow-md">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-[#24263e]">
                  Hành Trình Giao Hàng Lalamove
                </h3>
                <span className="text-xs font-mono bg-white/80 px-2 py-0.5 rounded-md border border-[#24263e]/15 font-bold">
                  #{order.id.slice(0, 12)}
                </span>
              </div>
              <p className="text-[11px] text-[#24263e]/80 mt-0.5 flex items-center gap-2">
                <span>Đối tác vận chuyển: <strong>Lalamove Delivery</strong></span>
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
              onClick={handleSyncLalamove}
              disabled={isSyncing || !activeShipment}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Đồng bộ trực tiếp từ server Lalamove"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-orange-600' : ''}`} />
              <span className="hidden sm:inline">Đồng bộ Lalamove</span>
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
                <span className="text-[10px] text-orange-600 uppercase font-black">{order.listing.brand}</span>
                <span className="text-gray-300">•</span>
                <span className="text-[10px] text-slate-500 font-semibold">{order.listing.category}</span>
              </div>
              <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{order.listing.title}</h4>
              <div className="flex items-center justify-between mt-1 text-slate-600 text-[11px]">
                <span>Người bán: <strong className="text-slate-900">{order.sellerName}</strong></span>
                <span>Tiền hàng: <strong className="text-orange-600 font-bold">{formatVND(order.itemPriceVnd)}</strong></span>
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
                  Kiện {idx + 1} ({s.leg || 'Lalamove'})
                </button>
              ))}
            </div>
          )}

          {/* Main Shipment Card */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
              <span className="font-bold text-sm">Đang tải dữ liệu tracking từ hệ thống Lalamove...</span>
            </div>
          ) : !activeShipment ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-gray-300 rounded-3xl space-y-3">
              <Package className="w-12 h-12 text-slate-400 mx-auto" />
              <h4 className="font-bold text-sm text-slate-800">Chưa có vận đơn nào được tạo</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Người bán chưa khởi tạo mã vận đơn Lalamove cho đơn hàng này. Vui lòng chờ người bán đóng gói và tạo vận đơn bàn giao cho tài xế.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Shipment Meta Details Card */}
              <div className="bg-gradient-to-br from-white via-slate-50 to-[#faf8f5] p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3.5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Mã vận đơn Lalamove</span>
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
                    <span className="text-[10px] text-slate-400 uppercase font-black">Trạng thái vận đơn</span>
                    {getProviderStatusBadge(trackingData?.providerStatus || activeShipment.providerStatus)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-2xl border border-gray-200/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Thời gian giao dự kiến</span>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-orange-600" />
                      <span>
                        {trackingData?.expectedDeliveryTime || activeShipment.expectedDeliveryTime
                          ? new Date(trackingData?.expectedDeliveryTime || activeShipment.expectedDeliveryTime!).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'Chưa có dự kiến'}
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

                {/* Driver Information Card (Section 10.3) */}
                {trackingData?.driver && (
                  <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase bg-orange-200 text-orange-900 px-2 py-0.5 rounded">
                          Tài xế Lalamove
                        </span>
                        <span className="font-bold text-slate-800 text-xs">Thông tin người vận chuyển</span>
                      </div>
                      {trackingData.shareLink && (
                        <a
                          href={trackingData.shareLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
                        >
                          <span>Mở theo dõi Lalamove</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-3.5">
                      {trackingData.driver.photo ? (
                        <img
                          src={trackingData.driver.photo}
                          alt={trackingData.driver.name || 'Tài xế'}
                          className="w-12 h-12 rounded-full object-cover border-2 border-orange-300 shadow-xs bg-white"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center font-bold">
                          <User className="w-6 h-6" />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Họ tên tài xế</span>
                          <span className="font-bold text-slate-900 text-xs">{trackingData.driver.name || 'Đang điều phối'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Số điện thoại</span>
                          {trackingData.driver.phone ? (
                            <a href={`tel:${trackingData.driver.phone}`} className="font-bold text-orange-700 hover:underline flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span>{trackingData.driver.phone}</span>
                            </a>
                          ) : (
                            <span className="font-bold text-slate-400 text-xs">Chưa cập nhật</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Biển số xe</span>
                          <span className="font-bold text-slate-900 text-xs font-mono">{trackingData.driver.plateNumber || 'Chưa cập nhật'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Driver Live GPS Map (Section 10.4) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-orange-600" />
                      <span>Vị trí GPS thời gian thực của tài xế</span>
                    </span>
                    {hasValidCoords && coordinates?.updatedAt && (
                      <span className="text-[10px] text-slate-400">
                        Cập nhật lúc: {new Date(coordinates.updatedAt).toLocaleTimeString('vi-VN')}
                      </span>
                    )}
                  </div>

                  {hasValidCoords ? (
                    <div id="lalamove-driver-map" className="w-full h-52 rounded-2xl border border-gray-200 z-0 shadow-inner" />
                  ) : (
                    <div className="p-3.5 bg-slate-100/80 rounded-2xl border border-gray-200 text-center text-slate-500 text-xs space-y-1">
                      <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>Chưa có vị trí GPS trực tiếp của tài xế</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        (Tài xế chưa khởi hành, chưa bật định vị GPS hoặc đơn hàng đang trong quá trình điều phối)
                      </p>
                    </div>
                  )}
                </div>

                {/* POD Proof of delivery if available */}
                {activeShipment.podUrl && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Camera className="w-5 h-5 text-emerald-700" />
                      <div>
                        <span className="font-bold text-emerald-900 block text-xs">Ảnh chụp tài xế đã giao hàng thành công (POD)</span>
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
                      <span className="font-bold block">Ghi chú tài xế / cảnh báo Lalamove:</span>
                      <span>{activeShipment.lastError}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Visual 5-Step Stepper */}
              <div className="p-5 bg-white rounded-3xl border border-gray-200 space-y-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-orange-600" />
                  <span>Tiến trình vận chuyển Lalamove</span>
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
                                ? 'bg-orange-600 text-white ring-4 ring-orange-500/20 shadow-md animate-pulse'
                                : 'bg-gray-100 text-gray-400 border border-gray-300'
                          }`}
                        >
                          {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>

                        {/* Text */}
                        <div className="ml-3 sm:ml-0 sm:mt-2.5">
                          <span className={`block font-extrabold text-xs ${isCurrent ? 'text-orange-600' : isDone ? 'text-slate-900' : 'text-slate-400'}`}>
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
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span>Lịch sử sự kiện Lalamove ({events.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Thời gian thực</span>
                </div>

                {events.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    Chưa có nhật ký sự kiện ghi nhận từ Lalamove. Hệ thống sẽ cập nhật khi tài xế nhận đơn và bắt đầu giao.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {events.map((ev, index) => (
                      <div key={ev.id || index} className="relative flex items-start gap-3 group">
                        <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-600 group-first:bg-orange-600" />
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
                      <Printer className="w-4 h-4 text-orange-600" />
                      <span>In Phiếu Gửi Lalamove</span>
                    </button>
                  )}

                  {/* Cancel Shipment Button for Seller (only if before picked) */}
                  {isSeller && currentStep <= 0 && activeShipment?.status !== 'CANCELLED' && (
                    <button
                      onClick={handleCancelShipment}
                      disabled={isCancelling}
                      className="px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 cursor-pointer disabled:opacity-50"
                    >
                      {isCancelling ? 'Đang hủy...' : 'Hủy Vận Đơn Lalamove'}
                    </button>
                  )}
                </div>

                {/* Confirm Receipt for Buyer when Delivered (Section 11) */}
                {!isSeller && (
                  <div>
                    {activeShipment.providerStatus === 'COMPLETED' || activeShipment.status === 'DELIVERED' || activeShipment.deliveredAt || order.shippingDeliveredAt ? (
                      <button
                        onClick={handleConfirmReceived}
                        disabled={isConfirmingDelivered}
                        className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-90 text-white text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 animate-pulse"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isConfirmingDelivered ? 'Đang giải ngân...' : 'Xác Nhận Đã Nhận Hàng (Giải Ngân)'}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">
                        (Nút xác nhận nhận hàng sẽ mở sau khi Lalamove hoàn tất giao hàng)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Sandbox Test Simulator */}
              <div className="mt-4 border border-dashed border-amber-300 bg-amber-50/50 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      Sandbox Test Lalamove
                    </span>
                    <span className="text-xs font-bold text-amber-900">
                      Công cụ giả lập trạng thái vận chuyển (Môi trường Test)
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
                      Dùng để kiểm thử toàn diện luồng SecondLife mà không cần tài xế thật giao ngoài đời:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleSimulateWebhook('picked')}
                        disabled={simulatingStatus !== null}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>1. Giả lập: Tài xế Đã Lấy Hàng (picked)</span>
                      </button>

                      <button
                        onClick={() => handleSimulateWebhook('delivered')}
                        disabled={simulatingStatus !== null}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>2. Giả lập: Lalamove Đã Giao Thành Công (delivered)</span>
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
