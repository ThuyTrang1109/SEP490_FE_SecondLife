import React, { useState, useEffect, useMemo } from 'react';
import { EscrowOrder, Language, ShipmentBackend } from '../../types';
import { formatVND } from '../../utils/translations';
import {
  Printer,
  X,
  Truck,
  Package,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Building2,
  Store,
  Info
} from 'lucide-react';
import { shippingService } from '../../services/shippingService';
import { inspectorService } from '../../services/inspectorService';
import { resolveInspectionCenter, getResolvedPostParcel } from '../../utils/orderUtils';

interface ShippingLabelModalProps {
  order: EscrowOrder;
  shipment: ShipmentBackend;
  onClose: () => void;
  lang: Language;
}

export const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({
  order,
  shipment,
  onClose,
  lang,
}) => {
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);
  const [apiCenters, setApiCenters] = useState<any[]>([]);

  // Tải danh sách trung tâm kiểm định thực tế từ API để hiển thị đúng thông tin Hub
  useEffect(() => {
    let isMounted = true;
    inspectorService.getInspectionCenters().then((list) => {
      if (isMounted && list && list.length > 0) {
        setApiCenters(list);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const hubCenter = useMemo(() => {
    const directId = order.inspectionCenterId || (order as any).centerId;
    const directName = order.inspectionCenterName || (order as any).centerName;
    const directAddress = order.inspectionCenterAddress || (order as any).centerAddress;
    const directPhone = order.inspectionCenterPhone || (order as any).centerPhone;

    if (apiCenters.length > 0) {
      if (directId) {
        const found = apiCenters.find((c) => c.id === directId || String(directId).includes(c.id));
        if (found) {
          return {
            id: found.id,
            name: directName || found.name,
            address: directAddress || found.address || '',
            phone: directPhone || found.phone || '0875456654',
          };
        }
      }
      const first = apiCenters[0];
      return {
        id: directId || first.id,
        name: directName || first.name,
        address: directAddress || first.address || '',
        phone: directPhone || first.phone || '0875456654',
      };
    }

    return resolveInspectionCenter(order);
  }, [order, apiCenters]);

  const leg = (shipment.leg || 'SELLER_TO_BUYER').toUpperCase();
  const isSellerToCenter = leg === 'SELLER_TO_CENTER';
  const isCenterToBuyer = leg === 'CENTER_TO_BUYER';
  const isCenterToSeller = leg === 'CENTER_TO_SELLER';
  const isBuyerToSeller = leg === 'BUYER_TO_SELLER';

  const formatLegTitle = () => {
    switch (leg) {
      case 'SELLER_TO_CENTER':
        return 'Chặng 1: Kho Người Bán ➔ Trạm Kiểm Định Hub';
      case 'CENTER_TO_BUYER':
        return 'Chặng 2: Trạm Kiểm Định Hub ➔ Người Mua';
      case 'CENTER_TO_SELLER':
        return 'Hoàn Trả: Trạm Kiểm Định Hub ➔ Kho Người Bán';
      case 'BUYER_TO_SELLER':
        return 'Hoàn Trả: Người Mua ➔ Kho Người Bán';
      case 'SELLER_TO_BUYER':
      default:
        return 'Giao Trực Tiếp (Người Bán ➔ Người Mua)';
    }
  };

  const getBadgeText = () => {
    if (isSellerToCenter) return 'HÀNG GỬI HUB KIỂM ĐỊNH';
    if (isCenterToBuyer) return 'HUB GIAO TẬN TAY NGƯỜI MUA';
    if (isCenterToSeller || isBuyerToSeller) return 'HÀNG HOÀN TRẢ VỀ KHO';
    return 'HÀNG LẤY TẬN KHO';
  };

  const catName = typeof order.listing?.category === 'string'
    ? order.listing.category
    : (order.listing?.category as any)?.name;
  const parcel = getResolvedPostParcel(
    order.listing?.id,
    order.listing,
    order.listing?.description,
    catName
  );
  const weightKg = ((parcel.weight || 5000) / 1000).toFixed(1);

  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconcileNotice(null);
    try {
      const updated = await shippingService.reconcileCreation(shipment.shipmentId);
      setReconcileNotice(`Đã đối soát và tạo lại vận đơn thành công: Mã #${updated.orderCode || updated.shipmentId}`);
    } catch (err: any) {
      setReconcileNotice(err?.message || 'Không thể đối soát tạo lại vận đơn.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-lalamove-label');
    if (!printContent) return;

    // Tạo iframe ẩn độc lập để chỉ in đúng 1 phiếu, hoàn toàn không bị lặp 10 trang của các đơn hàng nền
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return;
    }

    // Sao chép toàn bộ styles từ trang chính sang iframe
    let stylesHtml = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      stylesHtml += node.outerHTML;
    });

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Phieu_Gui_Hang_Lalamove_${trackingCode}</title>
          ${stylesHtml}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 10mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-family: inherit;
            }
            .print-wrapper {
              width: 100%;
              max-width: 660px;
              margin: 0 auto;
              padding: 0;
              box-sizing: border-box;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #printable-lalamove-label {
              margin: 0 !important;
              border: 2px dashed #334155 !important;
              background-color: #faf8f5 !important;
              border-radius: 16px !important;
              padding: 20px !important;
              box-shadow: none !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${printContent.outerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Chờ iframe phân giải CSS rồi kích hoạt in đúng 1 trang
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print error:', err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    }, 250);
  };

  const trackingCode = shipment.orderCode || `LLM-${order.id.slice(0, 8).toUpperCase()}`;

  // Deterministic barcode bars simulation
  const barcodePattern = useMemo(() => {
    const bars: number[] = [];
    const seed = trackingCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    for (let i = 0; i < 54; i++) {
      const val = (seed * (i + 1) * 31) % 100;
      bars.push(val < 25 ? 1 : val < 60 ? 2 : val < 85 ? 3 : 4);
    }
    return bars;
  }, [trackingCode]);

  // Thông tin người gửi (Origin)
  const senderInfo = useMemo(() => {
    if (isCenterToBuyer || isCenterToSeller) {
      return {
        roleLabel: 'ĐIỂM XUẤT PHÁT (TRẠM KIỂM ĐỊNH HUB)',
        name: hubCenter.name,
        phone: hubCenter.phone,
        address: hubCenter.address,
        isHub: true,
      };
    }
    if (isBuyerToSeller) {
      return {
        roleLabel: 'NGƯỜI GỬI HOÀN TRẢ (NGƯỜI MUA)',
        name: order.buyerName || 'Người mua',
        phone: order.buyerPhone || (order as any).userPhone,
        address: order.buyerAddress || 'Địa chỉ người mua',
        isHub: false,
      };
    }
    // Default SELLER_TO_CENTER or SELLER_TO_BUYER
    return {
      roleLabel: 'NGƯỜI GỬI (KHO TÀI XẾ LALAMOVE LẤY HÀNG)',
      name: order.listing?.seller?.name || order.sellerName || 'Người bán',
      phone: order.listing?.seller?.phone || (order as any).sellerPhone || '0912345678',
      address: order.listing?.location || (order as any).sellerAddress || 'Kho đăng ký của người bán',
      isHub: false,
    };
  }, [isCenterToBuyer, isCenterToSeller, isBuyerToSeller, hubCenter, order]);

  // Thông tin người nhận (Destination)
  const receiverInfo = useMemo(() => {
    if (isSellerToCenter) {
      return {
        roleLabel: 'ĐIỂM ĐẾN (TRẠM KIỂM ĐỊNH SECONDLIFE HUB)',
        name: hubCenter.name,
        phone: hubCenter.phone,
        address: hubCenter.address,
        isHub: true,
      };
    }
    if (isCenterToSeller || isBuyerToSeller) {
      return {
        roleLabel: 'NGƯỜI NHẬN HOÀN TRẢ (KHO NGƯỜI BÁN)',
        name: order.listing?.seller?.name || order.sellerName || 'Người bán',
        phone: order.listing?.seller?.phone || (order as any).sellerPhone || '0912345678',
        address: order.listing?.location || (order as any).sellerAddress || 'Kho của người bán',
        isHub: false,
      };
    }
    // Default SELLER_TO_BUYER or CENTER_TO_BUYER
    return {
      roleLabel: 'NGƯỜI NHẬN (ĐIỂM GIAO HÀNG TẬN NƠI)',
      name: order.buyerName || 'Người mua',
      phone: order.buyerPhone || (order as any).userPhone,
      address: order.buyerAddress || 'Địa chỉ nhận hàng đã xác nhận',
      isHub: false,
    };
  }, [isSellerToCenter, isCenterToSeller, isBuyerToSeller, hubCenter, order]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      {/* Fallback print styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body {
                background: #fff !important;
              }
            }
          `,
        }}
      />

      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-7 shadow-2xl text-slate-900 border border-gray-200 my-auto">
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Phiếu Gửi Hàng & Vận Đơn Lalamove Delivery
              </h3>
              <p className="text-xs text-slate-500">
                Mã đơn: <strong className="font-mono text-slate-700">#{order.id.slice(0, 16)}</strong> • Đối tác Lalamove
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Phiếu</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reconcile notice or exception banner */}
        {reconcileNotice && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-semibold flex items-center justify-between">
            <span>{reconcileNotice}</span>
            <button onClick={() => setReconcileNotice(null)} className="text-blue-500 hover:text-blue-700">✕</button>
          </div>
        )}

        {(shipment.status === 'FAILED' || shipment.status === 'PENDING_RETRY') && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-rose-800 block">Vận đơn gặp sự cố hoặc timeout tạo mã</span>
              <span className="text-[11px] text-rose-700">Bấm thử lại để kích hoạt đối soát và cấp lại mã vận đơn</span>
            </div>
            <button
              onClick={handleReconcile}
              disabled={isReconciling}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 shrink-0"
            >
              {isReconciling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Thử Lại (Reconcile)</span>
            </button>
          </div>
        )}

        {/* Printable Voucher Paper */}
        <div
          id="printable-lalamove-label"
          className="mt-4 p-4 sm:p-5 rounded-2xl bg-[#faf8f5] border-2 border-dashed border-gray-300 space-y-3.5"
        >
          {/* Header Row: Lalamove branding & Tracking Barcode */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-3 flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-base sm:text-lg text-[#c34c36] tracking-tight">
                  LALAMOVE DELIVERY
                </span>
                <span className="text-[10px] bg-slate-900 text-white font-extrabold px-2 py-0.5 rounded tracking-wide">
                  {getBadgeText()}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold block">
                Dịch vụ Giao hàng hỏa tốc Lalamove • Nền tảng SecondLife
              </span>
            </div>

            <div className="text-right sm:text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">
                MÃ VẬN ĐƠN LALAMOVE
              </span>
              <span className="font-mono font-black text-xs sm:text-sm bg-slate-900 text-white px-2.5 py-1 rounded-lg inline-block tracking-wider">
                {trackingCode}
              </span>
            </div>
          </div>

          {/* Barcode Visualizer */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 text-center space-y-1 shadow-2xs">
            <div className="h-11 w-full max-w-sm mx-auto flex items-center justify-center gap-[2.5px] overflow-hidden px-2">
              {barcodePattern.map((width, i) => (
                <div
                  key={i}
                  className="h-full bg-slate-900"
                  style={{ width: `${width}px` }}
                />
              ))}
            </div>
            <span className="font-mono text-xs text-slate-700 font-bold tracking-[0.25em] block">
              {trackingCode}
            </span>
          </div>

          {/* Addresses 2 Columns: Sender (Left) & Receiver (Right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* 1. SENDER / ORIGIN */}
            <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  {senderInfo.roleLabel}
                </span>
                {senderInfo.isHub && (
                  <span className="text-[9px] bg-blue-50 text-blue-800 font-bold px-1.5 py-0.2 rounded border border-blue-200">
                    Trạm ISO
                  </span>
                )}
              </div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                {senderInfo.isHub ? (
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <Store className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="line-clamp-1">{senderInfo.name}</span>
              </div>
              {senderInfo.phone && (
                <div className="font-semibold text-slate-700 flex items-center gap-1.5 text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{senderInfo.phone}</span>
                </div>
              )}
              <div className="text-[11px] text-slate-600 flex items-start gap-1.5 leading-relaxed">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{senderInfo.address}</span>
              </div>
            </div>

            {/* 2. RECEIVER / DESTINATION */}
            <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  {receiverInfo.roleLabel}
                </span>
                {receiverInfo.isHub ? (
                  <span className="text-[9px] bg-blue-50 text-blue-800 font-bold px-1.5 py-0.2 rounded border border-blue-200">
                    Trạm ISO
                  </span>
                ) : (
                  <span className="text-[9px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                    GPS Sẵn Sàng
                  </span>
                )}
              </div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                {receiverInfo.isHub ? (
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <User className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span className="line-clamp-1">{receiverInfo.name}</span>
              </div>
              {receiverInfo.phone && (
                <div className="font-semibold text-slate-700 flex items-center gap-1.5 text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{receiverInfo.phone}</span>
                </div>
              )}
              <div className="text-[11px] text-slate-600 flex items-start gap-1.5 leading-relaxed">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{receiverInfo.address}</span>
              </div>
            </div>
          </div>

          {/* Parcel & Payment Details */}
          <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-2 text-xs shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-2 border-b border-gray-100 gap-1">
              <span className="text-slate-500 font-medium text-xs">Sản phẩm gửi:</span>
              <span className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1" title={order.listing.title}>
                {order.listing.title}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                <span>Khối lượng ước tính:</span>
                <strong className="text-slate-900 font-bold">{weightKg} kg</strong>
              </div>
              <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                <span>Bảo hiểm hàng hóa:</span>
                <strong className="text-slate-900 font-bold">{formatVND(order.itemPriceVnd)}</strong>
              </div>
              <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                <span>Lộ trình vận chuyển:</span>
                <strong className="text-blue-700 font-bold">{formatLegTitle()}</strong>
              </div>
              <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                <span>Tiền thu hộ COD:</span>
                <strong className="text-emerald-700 font-bold">0 VNĐ (Đã thanh toán Escrow)</strong>
              </div>
            </div>
          </div>

          {/* Lalamove Delivery instructions */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
            <div className="font-bold uppercase tracking-tight flex items-center gap-1.5 text-amber-800">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Chỉ dẫn điều phối tài xế Lalamove:</span>
            </div>
            <p className="leading-relaxed text-[11px] sm:text-xs text-amber-900 font-medium">
              {isSellerToCenter
                ? 'Tài xế giao kiện hàng đến Trạm Kiểm Định SecondLife Hub. Kỹ thuật viên Hub sẽ kiểm tra nguyên trạng niêm phong, cấp phiếu tiếp nhận và tiến hành thẩm định kỹ thuật.'
                : isCenterToBuyer
                ? 'Giao hàng cho khách mua theo địa chỉ đã xác minh. Sản phẩm đã đạt chuẩn kiểm định và được Hub dán tem bảo đảm SecondLife. Không thu tiền mặt COD.'
                : 'Cho khách xem hàng, không cho dùng thử. Sản phẩm SecondLife đã được niêm phong kỹ lưỡng. Chuyển hoàn về người gửi sau 3 lần giao không thành công.'}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
          >
            Đóng
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#dc4729] text-white font-black text-xs cursor-pointer shadow-sm flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4" />
            <span>In Phiếu Dán Kiện Hàng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
