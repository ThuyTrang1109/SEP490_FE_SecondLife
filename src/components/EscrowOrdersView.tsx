import React, { useState } from 'react';
import { EscrowOrder, Language } from '../types';
import { translations, formatVND } from '../utils/translations';
import { ShieldCheck, Truck, Clock, CheckCircle2, AlertTriangle, FileCheck, Layers, ChevronRight, Package, ArrowRight, Camera, ExternalLink, HelpCircle } from 'lucide-react';

interface EscrowOrdersViewProps {
  orders: EscrowOrder[];
  onConfirmReceipt: (orderId: string) => void;
  onOpenDispute: (order: EscrowOrder) => void;
  lang: Language;
}

export const EscrowOrdersView: React.FC<EscrowOrdersViewProps> = ({
  orders,
  onConfirmReceipt,
  onOpenDispute,
  lang
}) => {
  const t = translations[lang];
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [activePhotoStage, setActivePhotoStage] = useState<'listing' | 'inspector' | 'handover'>('inspector');

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const getStatusBadge = (status: EscrowOrder['escrowStatus']) => {
    switch (status) {
      case 'INSPECTION_IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            <span>Đang Kiểm Định Tại Hub</span>
          </span>
        );
      case 'INSPECTION_PASSED':
      case 'SHIPPED_TO_BUYER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đã Duyệt • Đang Giao Tới Bạn</span>
          </span>
        );
      case 'DELIVERED_INSPECTION_WINDOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Đã Giao • 48h Dùng Thử & Đối Soát</span>
          </span>
        );
      case 'COMPLETED_RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Hoàn Tất • Đã Giải Ngân Cho Người Bán</span>
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>Đang Tranh Chấp • Đóng Băng Escrow</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            <span>{status}</span>
          </span>
        );
    }
  };

  if (!selectedOrder) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-700">Chưa có đơn hàng Escrow nào</h3>
        <p className="text-xs text-slate-500 mt-1">Hãy đặt mua một sản phẩm trên sàn để trải nghiệm quy trình bảo lãnh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* View Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>SecondLife Smart Escrow & Multi-Leg Logistics</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 font-['Outfit']">
          {t.navMyOrders}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Theo dõi hành trình 2 chặng: Người bán → Trung tâm kiểm định → Người mua, biên bản nghiệm thu và ảnh 3 giai đoạn.
        </p>
      </div>

      {/* Main Order Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Order selector list (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Danh sách đơn hàng ({orders.length})
          </h2>

          <div className="space-y-3">
            {orders.map((ord) => {
              const isSelected = ord.id === selectedOrder.id;
              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderId(ord.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${isSelected
                      ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-mono font-bold text-slate-800">#{ord.id}</span>
                    <span>{new Date(ord.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <img
                      src={ord.listing.photos.front}
                      alt={ord.listing.title}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-xs text-slate-900 truncate">
                        {ord.listing.title}
                      </h4>
                      <div className="text-xs font-extrabold text-emerald-700 font-['Outfit'] mt-0.5">
                        {formatVND(ord.totalPaidVnd)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    {getStatusBadge(ord.escrowStatus)}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Inspection & Escrow Tracking (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Order Snapshot Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 font-['Outfit']">
                    Đơn hàng #{selectedOrder.id}
                  </h3>
                  {getStatusBadge(selectedOrder.escrowStatus)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Người bán: <span className="font-semibold text-slate-800">{selectedOrder.sellerName}</span> • Người mua: <span className="font-semibold text-slate-800">{selectedOrder.buyerName}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-500">Tổng phong tỏa Escrow</div>
                <div className="text-xl font-black text-slate-900 font-['Outfit']">
                  {formatVND(selectedOrder.totalPaidVnd)}
                </div>
              </div>
            </div>

            {/* 2-Leg Shipping Visualizer */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>Hành trình giao nhận 2 chặng (Verify Then Ship)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Leg 1 */}
                {selectedOrder.shippingLegs[0] && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {t.leg1}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        {selectedOrder.shippingLegs[0].carrier} #{selectedOrder.shippingLegs[0].trackingNumber}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 pt-1">
                      <div>Từ: <span className="font-semibold">{selectedOrder.shippingLegs[0].origin}</span></div>
                      <div>Đến: <span className="font-semibold">{selectedOrder.shippingLegs[0].destination}</span></div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                      {selectedOrder.shippingLegs[0].timeline[selectedOrder.shippingLegs[0].timeline.length - 1]?.description}
                    </div>
                  </div>
                )}

                {/* Leg 2 */}
                {selectedOrder.shippingLegs[1] && (
                  <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                        {t.leg2}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-800">
                        {selectedOrder.shippingLegs[1].carrier} #{selectedOrder.shippingLegs[1].trackingNumber}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 pt-1">
                      <div>Từ: <span className="font-semibold">{selectedOrder.shippingLegs[1].origin}</span></div>
                      <div>Giao: <span className="font-semibold">{selectedOrder.shippingLegs[1].destination}</span></div>
                    </div>

                    <div className="pt-2 border-t border-emerald-200 text-[11px] text-emerald-800 font-medium">
                      {selectedOrder.shippingLegs[1].timeline[selectedOrder.shippingLegs[1].timeline.length - 1]?.description}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Inspection Certificate & Tamper Seal Section */}
            {selectedOrder.inspectionReport && (
              <div className="rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 p-5 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 font-['Outfit']">
                        Biên Bản Giám Định Xác Thực #{selectedOrder.inspectionReport.id}
                      </h4>
                      <p className="text-xs text-slate-600">
                        {selectedOrder.inspectionReport.centerName} • {selectedOrder.inspectionReport.inspectorName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                      {selectedOrder.inspectionReport.verdict === 'PASS' ? 'KẾT QUẢ: ĐẠT CHUẨN' : 'KHÔNG ĐẠT'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 text-emerald-400">
                      Mã Tem NFC: {selectedOrder.inspectionReport.tamperSealId}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 bg-white/80 p-3 rounded-xl border border-blue-100 italic">
                  "{selectedOrder.inspectionReport.summaryNotes}"
                </p>

                {/* Micro Checklist results summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedOrder.inspectionReport.checklistResults.slice(0, 4).map((chk) => (
                    <div key={chk.id} className="flex items-center gap-2 bg-white/90 p-2 rounded-lg border border-blue-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-slate-800">{chk.category}: </span>
                        <span className="text-slate-500">{chk.testedValue || 'Đạt'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3-Stage Multi-Version Photo Audit (Anti-Swapping) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>{t.multiStageTitle}</span>
                </div>

                {/* Stage switcher pills */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setActivePhotoStage('listing')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${activePhotoStage === 'listing' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500'
                      }`}
                  >
                    1. Người bán
                  </button>
                  <button
                    onClick={() => setActivePhotoStage('inspector')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${activePhotoStage === 'inspector' ? 'bg-white text-emerald-800 font-bold shadow-2xs' : 'text-slate-500'
                      }`}
                  >
                    2. Kiểm định viên
                  </button>
                  <button
                    onClick={() => setActivePhotoStage('handover')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${activePhotoStage === 'handover' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-500'
                      }`}
                  >
                    3. Niêm phong giao
                  </button>
                </div>
              </div>

              {/* Photo Display Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(activePhotoStage === 'listing'
                  ? selectedOrder.multiStagePhotos.listingPhotos
                  : activePhotoStage === 'inspector'
                    ? selectedOrder.multiStagePhotos.inspectorPhotos || []
                    : selectedOrder.multiStagePhotos.handoverPhotos || []
                ).map((photoUrl, idx) => (
                  <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
                    <img src={photoUrl} alt="Stage audit" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded">
                      {activePhotoStage === 'listing' && 'Ảnh rao bán'}
                      {activePhotoStage === 'inspector' && 'Ảnh soi Hub'}
                      {activePhotoStage === 'handover' && 'Ảnh dán tem NFC'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Escrow Fee Breakdown */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                {t.orderSummary}
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t.itemAmount}:</span>
                <span className="font-semibold text-slate-900">{formatVND(selectedOrder.itemPriceVnd)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t.inspectionFee}:</span>
                <span className="font-semibold text-slate-900">{formatVND(selectedOrder.inspectionFeeVnd)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t.shippingFee} (2 chặng GHTK + GHN):</span>
                <span className="font-semibold text-slate-900">{formatVND(selectedOrder.shippingFeeVnd)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t.platformFee}:</span>
                <span className="font-semibold text-slate-900">{formatVND(selectedOrder.platformFeeVnd)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                <span>{t.totalEscrow}:</span>
                <span className="font-extrabold text-emerald-800 font-['Outfit']">
                  {formatVND(selectedOrder.totalPaidVnd)}
                </span>
              </div>
            </div>

            {/* Actions for Buyer: Confirm release or Open dispute */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {selectedOrder.escrowStatus !== 'COMPLETED_RELEASED' && selectedOrder.escrowStatus !== 'DISPUTED' && (
                <>
                  <button
                    onClick={() => onConfirmReceipt(selectedOrder.id)}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.confirmReceipt}</span>
                  </button>

                  <button
                    onClick={() => onOpenDispute(selectedOrder)}
                    className="py-3 px-4 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>{t.openDispute}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
