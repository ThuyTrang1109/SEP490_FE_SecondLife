import React, { useState } from 'react';
import { EscrowOrder, Language } from '../types';
import { translations, formatVND } from '../utils/translations';
import { ShieldCheck, Truck, Clock, CheckCircle2, AlertTriangle, FileCheck, Layers, ChevronRight, Package } from 'lucide-react';

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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white">
            <Clock className="w-3.5 h-3.5 text-white animate-spin" />
            <span>Đang Kiểm Định Tại Hub</span>
          </span>
        );
      case 'INSPECTION_PASSED':
      case 'SHIPPED_TO_BUYER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#0E121B] text-white">
            <Truck className="w-3.5 h-3.5 text-white" />
            <span>Đã Duyệt • Đang Giao Tới Bạn</span>
          </span>
        );
      case 'DELIVERED_INSPECTION_WINDOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            <span>Đã Giao • 48h Dùng Thử & Đối Soát</span>
          </span>
        );
      case 'COMPLETED_RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#F4F5F8] text-[#0E121B] border border-gray-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#EC1577]" />
            <span>Hoàn Tất • Đã Giải Ngân Cho Người Bán</span>
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#0E121B] text-white">
            <AlertTriangle className="w-3.5 h-3.5 text-[#EC1577]" />
            <span>Đang Tranh Chấp • Đóng Băng Escrow</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#F4F5F8] text-[#0E121B]">
            <span>{status}</span>
          </span>
        );
    }
  };

  if (!selectedOrder) {
    return (
      <div className="bg-[#FFFFFF] rounded-3xl p-12 text-center border border-gray-200 text-[#0E121B]">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="font-bold text-[#0E121B]">Chưa có đơn hàng Escrow nào</h3>
        <p className="text-xs text-[#0E121B]/70 mt-1">Hãy đặt mua một sản phẩm trên sàn để trải nghiệm quy trình bảo lãnh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 text-[#0E121B]">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] text-[#0E121B] text-xs font-bold border border-gray-200 shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#EC1577]" />
          <span>SecondLife Smart Escrow & Multi-Leg Logistics</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0E121B] mt-2">
          {t.navMyOrders}
        </h1>
        <p className="text-xs sm:text-sm text-[#0E121B]/70">
          Theo dõi hành trình 2 chặng: Người bán → Trung tâm kiểm định → Người mua, biên bản nghiệm thu và ảnh 3 giai đoạn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Order selector list */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold text-[#0E121B]/70 uppercase tracking-wider">
            Danh sách đơn hàng ({orders.length})
          </h2>

          <div className="space-y-3">
            {orders.map((ord) => {
              const isSelected = ord.id === selectedOrder.id;
              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderId(ord.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0E121B] text-white border-[#0E121B] shadow-md'
                      : 'bg-[#FFFFFF] border-gray-200 hover:border-[#EC1577] text-[#0E121B]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs opacity-80 mb-1">
                    <span className="font-mono font-bold">#{ord.id}</span>
                    <span>{new Date(ord.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <img
                      src={ord.listing.photos.front}
                      alt={ord.listing.title}
                      className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0 bg-[#F4F5F8]"
                    />
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-xs truncate">
                        {ord.listing.title}
                      </h4>
                      <div className="text-xs font-extrabold text-[#EC1577] mt-0.5">
                        {formatVND(ord.totalPaidVnd)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                    {getStatusBadge(ord.escrowStatus)}
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Inspection & Escrow Tracking */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#FFFFFF] rounded-3xl p-6 border border-gray-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-[#0E121B]">
                    Đơn hàng #{selectedOrder.id}
                  </h3>
                  {getStatusBadge(selectedOrder.escrowStatus)}
                </div>
                <div className="text-xs text-[#0E121B]/70 mt-1">
                  Người bán: <span className="font-semibold text-[#0E121B]">{selectedOrder.sellerName}</span> • Người mua: <span className="font-semibold text-[#0E121B]">{selectedOrder.buyerName}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-[#0E121B]/70">Tổng phong tỏa Escrow</div>
                <div className="text-xl font-black text-[#EC1577]">
                  {formatVND(selectedOrder.totalPaidVnd)}
                </div>
              </div>
            </div>

            {/* 2-Leg Shipping Visualizer */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#0E121B] uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#EC1577]" />
                <span>Hành trình giao nhận 2 chặng (Verify Then Ship)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedOrder.shippingLegs[0] && (
                  <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#EC1577] to-[#F1622A] px-2 py-0.5 rounded-md">
                        {t.leg1}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#0E121B]">
                        {selectedOrder.shippingLegs[0].carrier} #{selectedOrder.shippingLegs[0].trackingNumber}
                      </span>
                    </div>

                    <div className="text-xs text-[#0E121B]/70 space-y-1 pt-1">
                      <div>Từ: <span className="font-semibold text-[#0E121B]">{selectedOrder.shippingLegs[0].origin}</span></div>
                      <div>Đến: <span className="font-semibold text-[#0E121B]">{selectedOrder.shippingLegs[0].destination}</span></div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 text-[11px] text-[#0E121B]/70">
                      {selectedOrder.shippingLegs[0].timeline[selectedOrder.shippingLegs[0].timeline.length - 1]?.description}
                    </div>
                  </div>
                )}

                {selectedOrder.shippingLegs[1] && (
                  <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#EC1577] to-[#F1622A] px-2 py-0.5 rounded-md">
                        {t.leg2}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#0E121B]">
                        {selectedOrder.shippingLegs[1].carrier} #{selectedOrder.shippingLegs[1].trackingNumber}
                      </span>
                    </div>

                    <div className="text-xs text-[#0E121B]/70 space-y-1 pt-1">
                      <div>Từ: <span className="font-semibold text-[#0E121B]">{selectedOrder.shippingLegs[1].origin}</span></div>
                      <div>Giao: <span className="font-semibold text-[#0E121B]">{selectedOrder.shippingLegs[1].destination}</span></div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 text-[11px] text-[#0E121B] font-medium">
                      {selectedOrder.shippingLegs[1].timeline[selectedOrder.shippingLegs[1].timeline.length - 1]?.description}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Inspection Certificate & Tamper Seal Section */}
            {selectedOrder.inspectionReport && (
              <div className="rounded-2xl bg-[#F4F5F8] p-5 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#0E121B] text-white flex items-center justify-center">
                      <FileCheck className="w-4 h-4 text-[#EC1577]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0E121B]">
                        Biên Bản Giám Định Xác Thực #{selectedOrder.inspectionReport.id}
                      </h4>
                      <p className="text-xs text-[#0E121B]/70">
                        {selectedOrder.inspectionReport.centerName} • {selectedOrder.inspectionReport.inspectorName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white">
                      {selectedOrder.inspectionReport.verdict === 'PASS' ? 'KẾT QUẢ: ĐẠT CHUẨN' : 'KHÔNG ĐẠT'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#FFFFFF] text-[#0E121B] border border-gray-200">
                      Mã Tem NFC: {selectedOrder.inspectionReport.tamperSealId}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#0E121B] bg-[#FFFFFF] p-3 rounded-xl border border-gray-200 italic">
                  "{selectedOrder.inspectionReport.summaryNotes}"
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedOrder.inspectionReport.checklistResults.slice(0, 4).map((chk) => (
                    <div key={chk.id} className="flex items-center gap-2 bg-[#FFFFFF] p-2 rounded-lg border border-gray-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#EC1577] shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-[#0E121B]">{chk.category}: </span>
                        <span className="text-[#0E121B]/70">{chk.testedValue || 'Đạt'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3-Stage Multi-Version Photo Audit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[#0E121B] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#EC1577]" />
                  <span>{t.multiStageTitle}</span>
                </div>

                <div className="flex items-center gap-1 bg-[#F4F5F8] p-1 rounded-xl text-xs border border-gray-200">
                  <button
                    onClick={() => setActivePhotoStage('listing')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                      activePhotoStage === 'listing' ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold' : 'text-[#0E121B]/70'
                    }`}
                  >
                    1. Người bán
                  </button>
                  <button
                    onClick={() => setActivePhotoStage('inspector')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                      activePhotoStage === 'inspector' ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold' : 'text-[#0E121B]/70'
                    }`}
                  >
                    2. Kiểm định viên
                  </button>
                  <button
                    onClick={() => setActivePhotoStage('handover')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                      activePhotoStage === 'handover' ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold' : 'text-[#0E121B]/70'
                    }`}
                  >
                    3. Niêm phong giao
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(activePhotoStage === 'listing'
                  ? selectedOrder.multiStagePhotos.listingPhotos
                  : activePhotoStage === 'inspector'
                  ? selectedOrder.multiStagePhotos.inspectorPhotos || []
                  : selectedOrder.multiStagePhotos.handoverPhotos || []
                ).map((photoUrl, idx) => (
                  <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden bg-[#F4F5F8] border border-gray-200 group">
                    <img src={photoUrl} alt="Stage audit" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute bottom-1.5 left-1.5 bg-[#0E121B]/80 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded border border-white/20">
                      {activePhotoStage === 'listing' && 'Ảnh rao bán'}
                      {activePhotoStage === 'inspector' && 'Ảnh soi Hub'}
                      {activePhotoStage === 'handover' && 'Ảnh dán tem NFC'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Escrow Fee Breakdown */}
            <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 space-y-2 text-xs">
              <div className="font-bold text-[#0E121B] uppercase tracking-wider text-[11px]">
                {t.orderSummary}
              </div>
              <div className="flex justify-between text-[#0E121B]/70">
                <span>{t.itemAmount}:</span>
                <span className="font-semibold text-[#0E121B]">{formatVND(selectedOrder.itemPriceVnd)}</span>
              </div>
              <div className="flex justify-between text-[#0E121B]/70">
                <span>{t.inspectionFee}:</span>
                <span className="font-semibold text-[#0E121B]">{formatVND(selectedOrder.inspectionFeeVnd)}</span>
              </div>
              <div className="flex justify-between text-[#0E121B]/70">
                <span>{t.shippingFee} (2 chặng GHTK + GHN):</span>
                <span className="font-semibold text-[#0E121B]">{formatVND(selectedOrder.shippingFeeVnd)}</span>
              </div>
              <div className="flex justify-between text-[#0E121B]/70">
                <span>{t.platformFee}:</span>
                <span className="font-semibold text-[#0E121B]">{formatVND(selectedOrder.platformFeeVnd)}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-[#0E121B]">
                <span>{t.totalEscrow}:</span>
                <span className="font-extrabold text-[#EC1577]">
                  {formatVND(selectedOrder.totalPaidVnd)}
                </span>
              </div>
            </div>

            {/* Actions for Buyer */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {selectedOrder.escrowStatus !== 'COMPLETED_RELEASED' && selectedOrder.escrowStatus !== 'DISPUTED' && (
                <>
                  <button
                    onClick={() => onConfirmReceipt(selectedOrder.id)}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.confirmReceipt}</span>
                  </button>

                  <button
                    onClick={() => onOpenDispute(selectedOrder)}
                    className="py-3 px-4 bg-[#0E121B] hover:bg-[#0E121B]/80 text-white border border-[#0E121B] rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4 text-[#EC1577]" />
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
