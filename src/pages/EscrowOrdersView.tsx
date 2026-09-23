import React, { useState, useMemo } from 'react';
import { EscrowOrder, Language, UserRole } from '../types';
import { translations, formatVND } from '../utils/translations';
import {
  ShieldCheck,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Layers,
  ChevronRight,
  Package,
  Store,
  Eye,
  X,
  Search,
  RotateCcw,
  Calendar,
  MapPin,
  QrCode,
  Shield,
  ArrowRight,
  User,
  Phone,
  Printer,
  MessageSquare,
  Wallet,
  Receipt,
  Check
} from 'lucide-react';

interface EscrowOrdersViewProps {
  orders: EscrowOrder[];
  onConfirmReceipt: (orderId: string) => void;
  onOpenDispute: (order: EscrowOrder) => void;
  lang: Language;
  userRole?: UserRole;
  onOpenChat?: (listing: any) => void;
}

type OrderFilterTab =
  | 'all'
  | 'awaiting_pickup'
  | 'inspecting'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'disputed';

export const EscrowOrdersView: React.FC<EscrowOrdersViewProps> = ({
  orders,
  onConfirmReceipt,
  onOpenDispute,
  lang,
  userRole = 'buyer',
  onOpenChat,
}) => {
  const t = translations[lang];
  const isSeller = userRole === 'seller';

  const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailModalOrder, setDetailModalOrder] = useState<EscrowOrder | null>(null);
  const [activePhotoStage, setActivePhotoStage] = useState<'listing' | 'inspector' | 'handover'>('inspector');

  // Seller specific state
  const [pickupConfirmedNotice, setPickupConfirmedNotice] = useState<string | null>(null);
  const [shippingLabelOrder, setShippingLabelOrder] = useState<EscrowOrder | null>(null);

  const handleConfirmCourierPickup = (orderId: string) => {
    setPickupConfirmedNotice(`Đã lên lịch thành công! Bưu tá GHTK sẽ đến địa chỉ kho lấy máy #${orderId} giao về Hub trong hôm nay.`);
    setTimeout(() => setPickupConfirmedNotice(null), 5000);
  };

  // Seller metrics
  const pendingEscrowTotal = useMemo(() => {
    return orders
      .filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED' && o.escrowStatus !== 'REFUNDED_TO_BUYER')
      .reduce((sum, o) => sum + Math.round(o.itemPriceVnd * 0.975), 0);
  }, [orders]);

  const awaitingPickupCount = orders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
  const inHubInspectionCount = orders.filter(
    (o) =>
      o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
      o.escrowStatus === 'INSPECTION_PASSED' ||
      o.escrowStatus === 'HELD_IN_ESCROW'
  ).length;
  const completedPaidCount = orders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;

  // Filter logic based on status tabs
  const filteredOrders = orders.filter((ord) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ord.listing.title.toLowerCase().includes(q);
      const matchId = ord.id.toLowerCase().includes(q);
      const matchSeller = ord.sellerName.toLowerCase().includes(q);
      const matchBuyer = ord.buyerName.toLowerCase().includes(q);
      if (!matchTitle && !matchId && !matchSeller && !matchBuyer) return false;
    }

    switch (activeTab) {
      case 'awaiting_pickup':
        return ord.escrowStatus === 'AWAITING_PAYMENT';
      case 'inspecting':
        return (
          ord.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
          ord.escrowStatus === 'INSPECTION_PASSED' ||
          ord.escrowStatus === 'HELD_IN_ESCROW'
        );
      case 'shipping':
        return ord.escrowStatus === 'SHIPPED_TO_BUYER';
      case 'delivered':
        return ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW';
      case 'completed':
        return ord.escrowStatus === 'COMPLETED_RELEASED';
      case 'disputed':
        return ord.escrowStatus === 'DISPUTED' || ord.escrowStatus === 'REFUNDED_TO_BUYER';
      case 'all':
      default:
        return true;
    }
  });

  const getTabCount = (tab: OrderFilterTab) => {
    switch (tab) {
      case 'awaiting_pickup':
        return orders.filter((o) => o.escrowStatus === 'AWAITING_PAYMENT').length;
      case 'inspecting':
        return orders.filter(
          (o) =>
            o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
            o.escrowStatus === 'INSPECTION_PASSED' ||
            o.escrowStatus === 'HELD_IN_ESCROW'
        ).length;
      case 'shipping':
        return orders.filter((o) => o.escrowStatus === 'SHIPPED_TO_BUYER').length;
      case 'delivered':
        return orders.filter((o) => o.escrowStatus === 'DELIVERED_INSPECTION_WINDOW').length;
      case 'completed':
        return orders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;
      case 'disputed':
        return orders.filter(
          (o) => o.escrowStatus === 'DISPUTED' || o.escrowStatus === 'REFUNDED_TO_BUYER'
        ).length;
      case 'all':
      default:
        return orders.length;
    }
  };

  const getStatusBadge = (status: EscrowOrder['escrowStatus']) => {
    switch (status) {
      case 'AWAITING_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>{isSeller ? 'Chờ Bạn Giao Bưu Tá' : 'Chờ Lấy Hàng & Đóng Gói'}</span>
          </span>
        );
      case 'INSPECTION_IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-xs">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Đang Kiểm Định Tại Hub</span>
          </span>
        );
      case 'INSPECTION_PASSED':
      case 'SHIPPED_TO_BUYER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 border border-blue-500/30">
            <Truck className="w-3.5 h-3.5" />
            <span>{isSeller ? 'Đang Giao Tới Người Mua' : 'Đang Giao Hàng Tới Bạn'}</span>
          </span>
        );
      case 'DELIVERED_INSPECTION_WINDOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isSeller ? 'Khách Đang Kiểm Máy (48h)' : 'Đã Giao • 48h Kiểm Tra Đối Soát'}</span>
          </span>
        );
      case 'COMPLETED_RELEASED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isSeller ? 'Đã Nhận Tiền Vào Ví' : 'Hoàn Tất • Đã Giải Ngân'}</span>
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Đang Tranh Chấp • Đóng Băng Escrow</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            <span>{status}</span>
          </span>
        );
    }
  };

  const tabs: { key: OrderFilterTab; label: string }[] = isSeller
    ? [
        { key: 'all', label: 'Tất cả đơn bán' },
        { key: 'awaiting_pickup', label: 'Chờ giao bưu tá' },
        { key: 'inspecting', label: 'Đang kiểm định Hub' },
        { key: 'shipping', label: 'Đang giao người mua' },
        { key: 'delivered', label: 'Chờ nghiệm thu (48h)' },
        { key: 'completed', label: 'Đã nhận tiền' },
        { key: 'disputed', label: 'Khiếu nại / Trả hàng' },
      ]
    : [
        { key: 'all', label: 'Tất cả' },
        { key: 'awaiting_pickup', label: 'Chờ lấy hàng' },
        { key: 'inspecting', label: 'Đang kiểm định Hub' },
        { key: 'shipping', label: 'Đang giao hàng' },
        { key: 'delivered', label: 'Đã nhận hàng' },
        { key: 'completed', label: 'Hoàn thành' },
        { key: 'disputed', label: 'Trả hàng / Tranh chấp' },
      ];

  return (
    <div className="space-y-6 pb-16 text-[#0E121B]">
      {/* Top Banner: Switch between Buyer and Seller mode */}
      {isSeller ? (
        <div className="space-y-4">
          <div className="bg-[#0E121B] text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold border border-white/20">
                  <Store className="w-3.5 h-3.5 text-[#EC1577]" />
                  <span>Kênh Người Bán SecondLife &bull; Quản Lý Đơn Hàng</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white mt-2">
                  Quản Lý Đơn Bán Hàng & Dòng Tiền Escrow
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Theo dõi lịch bưu tá đến kho lấy hàng chuyển về Hub, kết quả kiểm định kỹ thuật và đối soát tiền giải ngân vào ví người bán.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Bảo Lãnh Escrow</span>
                </span>
              </div>
            </div>

            {/* Seller Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">Tiền Chờ Giải Ngân (Escrow)</div>
                <div className="text-lg sm:text-xl font-black text-[#EC1577] mt-0.5">
                  {formatVND(pendingEscrowTotal)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Tự động giải ngân sau giao</div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">Cần Giao Bưu Tá (Kho lấy)</div>
                <div className="text-lg sm:text-xl font-black text-amber-600 mt-0.5">
                  {awaitingPickupCount} Đơn
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Hẹn bưu tá GHTK/GHN</div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">Đang Kiểm Định Tại Hub</div>
                <div className="text-lg sm:text-xl font-black text-purple-600 mt-0.5">
                  {inHubInspectionCount} Thiết Bị
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Test 48 bước & dán NFC</div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-slate-900 shadow-sm">
                <div className="text-[11px] text-slate-500 font-medium">Đã Nhận Tiền Thành Công</div>
                <div className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5">
                  {completedPaidCount} Đơn
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Tiền đã cộng vào tài khoản</div>
              </div>
            </div>
          </div>

          {pickupConfirmedNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{pickupConfirmedNotice}</span>
            </div>
          )}
        </div>
      ) : (
        /* Buyer Header */
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] text-[#0E121B] text-xs font-bold border border-gray-200 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#EC1577]" />
            <span>SecondLife Smart Escrow & Multi-Leg Logistics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0E121B] mt-2">
            Đơn Hàng & Escrow
          </h1>
          <p className="text-xs sm:text-sm text-[#0E121B]/70">
            Theo dõi hành trình 2 chặng: Người bán → Trung tâm kiểm định → Người mua, biên bản nghiệm thu và ảnh 3 giai đoạn.
          </p>
        </div>
      )}

      {/* Shopee-style Status Tab Bar */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex items-center overflow-x-auto scrollbar-none border-b border-gray-100">
          {tabs.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 sm:px-6 py-3.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isActive
                    ? 'text-[#EC1577] font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                      isActive
                        ? 'bg-[#EC1577]/10 text-[#EC1577]'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
                {/* Active underline indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#EC1577] to-[#F1622A] rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Search inside Orders */}
        <div className="p-3 bg-slate-50/60 border-t border-gray-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isSeller ? 'Tìm mã đơn #ORD, tên sản phẩm hoặc tên người mua...' : 'Tìm kiếm theo mã đơn #ORD, tên sản phẩm hoặc người bán...'}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FFFFFF] border border-gray-200 rounded-xl focus:outline-none focus:border-[#EC1577] transition-all"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 bg-gray-200/70 rounded-xl transition cursor-pointer"
            >
              Xóa tìm kiếm
            </button>
          )}
        </div>
      </div>

      {/* Shopee-style Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-3xl p-12 text-center border border-gray-200 text-[#0E121B] shadow-xs">
          <Package className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-base text-[#0E121B]">Chưa có đơn hàng nào trong mục này</h3>
          <p className="text-xs text-[#0E121B]/70 mt-1 max-w-md mx-auto">
            Không tìm thấy đơn hàng nào ở trạng thái này. Bạn có thể chọn tab "{isSeller ? 'Tất cả đơn bán' : 'Tất cả'}" để xem toàn bộ danh sách.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const sellerNetPayout = Math.round(ord.itemPriceVnd * 0.975);
            return (
              <div
                key={ord.id}
                onClick={() => setDetailModalOrder(ord)}
                className="bg-[#FFFFFF] rounded-2xl border border-gray-200 hover:border-[#EC1577]/50 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden group"
              >
                {/* Order Top Bar */}
                <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    {isSeller ? (
                      <>
                        <User className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-900">
                          Khách mua: {ord.buyerName}
                        </span>
                        <span className="text-[11px] text-slate-400">({ord.buyerPhone})</span>
                      </>
                    ) : (
                      <>
                        <Store className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-900">{ord.sellerName}</span>
                      </>
                    )}
                    <span className="text-[11px] font-mono text-slate-400">#{ord.id}</span>
                    <span className="hidden sm:inline-block text-[11px] text-slate-400">
                      • {new Date(ord.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div>{getStatusBadge(ord.escrowStatus)}</div>
                </div>

                {/* Order Main Body: Product Snippet */}
                <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <img
                      src={ord.listing.photos.front}
                      alt={ord.listing.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-gray-200 shrink-0 bg-slate-100 group-hover:scale-102 transition-transform"
                    />
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 line-clamp-2 group-hover:text-[#EC1577] transition-colors">
                        {ord.listing.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {ord.listing.category}
                        </span>
                        <span>•</span>
                        <span>Tình trạng: <strong className="text-slate-800">{ord.listing.conditionGrade}</strong></span>
                        <span>•</span>
                        <span>Số lượng: 1</span>
                      </div>

                      {isSeller ? (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            <span>Bưu tá: GHTK Express (Lấy tại kho Seller)</span>
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Bảo chứng Escrow & Kiểm định Hub</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Tag */}
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-xs text-slate-400 block">
                      {isSeller ? 'Giá niêm yết bán' : 'Đơn giá sản phẩm'}
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      {formatVND(ord.itemPriceVnd)}
                    </span>
                  </div>
                </div>

                {/* Order Card Footer: Financial & Actions */}
                <div className="px-4 sm:px-6 py-3.5 bg-slate-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                    {isSeller ? (
                      <>
                        <span className="text-xs text-slate-500">
                          Thực nhận về ví (Đã trừ 2.5% phí sàn):
                        </span>
                        <span className="text-base sm:text-lg font-black text-emerald-600">
                          +{formatVND(sellerNetPayout)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500">
                          Thành tiền (đã bao gồm phí kiểm định & bảo lãnh):
                        </span>
                        <span className="text-base sm:text-lg font-black text-[#EC1577]">
                          {formatVND(ord.totalPaidVnd)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Seller Actions */}
                    {isSeller ? (
                      <>
                        {/* Awaiting pickup: Schedule & Print Shipping Voucher */}
                        {ord.escrowStatus === 'AWAITING_PAYMENT' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmCourierPickup(ord.id);
                              }}
                              className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Hẹn Bưu Tá Lấy Hàng</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShippingLabelOrder(ord);
                              }}
                              className="px-3 py-2 rounded-xl bg-white border border-gray-300 hover:border-[#EC1577] text-slate-700 hover:text-[#EC1577] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>In Phiếu Gửi Hub</span>
                            </button>
                          </>
                        )}

                        {/* Completed: Escrow released notice */}
                        {ord.escrowStatus === 'COMPLETED_RELEASED' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã Giải Ngân Vào Ví</span>
                          </span>
                        )}

                        {/* Chat with buyer */}
                        {onOpenChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChat(ord.listing);
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="Nhắn tin với người mua"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Detail Modal Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailModalOrder(ord);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white border border-gray-300 hover:border-[#EC1577] text-slate-700 hover:text-[#EC1577] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi Tiết Đơn</span>
                        </button>
                      </>
                    ) : (
                      /* Buyer Actions */
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailModalOrder(ord);
                          }}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white border border-gray-300 hover:border-[#EC1577] text-slate-700 hover:text-[#EC1577] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem Chi Tiết</span>
                        </button>

                        {ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onConfirmReceipt(ord.id);
                            }}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đã Nhận Hàng</span>
                          </button>
                        )}

                        {ord.escrowStatus === 'DELIVERED_INSPECTION_WINDOW' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDispute(ord);
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
                          >
                            <span>Khiếu Nại</span>
                          </button>
                        )}

                        {ord.escrowStatus === 'COMPLETED_RELEASED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailModalOrder(ord);
                            }}
                            className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition cursor-pointer"
                          >
                            <span>Xem Biên Bản Hub</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POPUP MODAL: CHI TIẾT ĐƠN HÀNG KHI NGƯỜI DÙNG BẤM VÀO */}
      {detailModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDetailModalOrder(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#FFFFFF] border border-gray-200 p-5 sm:p-7 shadow-2xl text-[#0E121B] scrollbar-thin scrollbar-thumb-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-black text-[#0E121B]">
                    Chi Tiết Đơn Hàng #{detailModalOrder.id}
                  </h2>
                  {getStatusBadge(detailModalOrder.escrowStatus)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Người bán: <strong className="text-slate-800">{detailModalOrder.sellerName}</strong> • Người mua:{' '}
                  <strong className="text-slate-800">{detailModalOrder.buyerName}</strong> • Đặt ngày{' '}
                  {new Date(detailModalOrder.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>

              <button
                onClick={() => setDetailModalOrder(null)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 pt-5">
              {/* Product Info Card in Modal */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F4F5F8] border border-gray-200">
                <img
                  src={detailModalOrder.listing.photos.front}
                  alt={detailModalOrder.listing.title}
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 truncate">
                    {detailModalOrder.listing.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {detailModalOrder.listing.category} • Tình trạng: {detailModalOrder.listing.conditionGrade}
                  </p>
                  <div className="text-sm font-extrabold text-[#EC1577] mt-1">
                    {formatVND(detailModalOrder.itemPriceVnd)}
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
                  {/* Leg 1: Seller to Center */}
                  {detailModalOrder.shippingLegs[0] ? (
                    <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#EC1577] to-[#F1622A] px-2 py-0.5 rounded-md">
                          {t.leg1}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#0E121B]">
                          {detailModalOrder.shippingLegs[0].carrier} #{detailModalOrder.shippingLegs[0].trackingNumber}
                        </span>
                      </div>

                      <div className="text-xs text-[#0E121B]/70 space-y-1 pt-1">
                        <div>Từ: <span className="font-semibold text-[#0E121B]">{detailModalOrder.shippingLegs[0].origin}</span></div>
                        <div>Đến: <span className="font-semibold text-[#0E121B]">{detailModalOrder.shippingLegs[0].destination}</span></div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 text-[11px] text-[#0E121B]/70">
                        {detailModalOrder.shippingLegs[0].timeline[detailModalOrder.shippingLegs[0].timeline.length - 1]?.description || 'Đã bàn giao bưu tá'}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 text-xs text-slate-500">
                      Chặng 1 đang chờ bưu tá phân phối lấy hàng từ nhà người bán.
                    </div>
                  )}

                  {/* Leg 2: Center to Buyer */}
                  {detailModalOrder.shippingLegs[1] ? (
                    <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#EC1577] to-[#F1622A] px-2 py-0.5 rounded-md">
                          {t.leg2}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#0E121B]">
                          {detailModalOrder.shippingLegs[1].carrier} #{detailModalOrder.shippingLegs[1].trackingNumber}
                        </span>
                      </div>

                      <div className="text-xs text-[#0E121B]/70 space-y-1 pt-1">
                        <div>Từ: <span className="font-semibold text-[#0E121B]">{detailModalOrder.shippingLegs[1].origin}</span></div>
                        <div>Giao đến: <span className="font-semibold text-[#0E121B]">{detailModalOrder.shippingLegs[1].destination}</span></div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 text-[11px] text-[#0E121B] font-medium">
                        {detailModalOrder.shippingLegs[1].timeline[detailModalOrder.shippingLegs[1].timeline.length - 1]?.description}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 text-xs text-slate-500 flex items-center justify-center">
                      Chặng 2 sẽ tự động kích hoạt sau khi kiểm định Hub đạt chuẩn.
                    </div>
                  )}
                </div>
              </div>

              {/* Inspection Certificate & Tamper Seal Section */}
              {detailModalOrder.inspectionReport && (
                <div className="rounded-2xl bg-[#F4F5F8] p-5 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#0E121B] text-white flex items-center justify-center">
                        <FileCheck className="w-4 h-4 text-[#EC1577]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#0E121B]">
                          Biên Bản Giám Định Xác Thực #{detailModalOrder.inspectionReport.id}
                        </h4>
                        <p className="text-xs text-[#0E121B]/70">
                          {detailModalOrder.inspectionReport.centerName} • {detailModalOrder.inspectionReport.inspectorName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white">
                        {detailModalOrder.inspectionReport.verdict === 'PASS' ? 'KẾT QUẢ: ĐẠT CHUẨN' : 'KHÔNG ĐẠT'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#FFFFFF] text-[#0E121B] border border-gray-200">
                        Mã Tem NFC: {detailModalOrder.inspectionReport.tamperSealId}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#0E121B] bg-[#FFFFFF] p-3 rounded-xl border border-gray-200 italic">
                    "{detailModalOrder.inspectionReport.summaryNotes}"
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {detailModalOrder.inspectionReport.checklistResults.slice(0, 4).map((chk) => (
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
                        activePhotoStage === 'listing'
                          ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold'
                          : 'text-[#0E121B]/70'
                      }`}
                    >
                      1. Người bán
                    </button>
                    <button
                      onClick={() => setActivePhotoStage('inspector')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                        activePhotoStage === 'inspector'
                          ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold'
                          : 'text-[#0E121B]/70'
                      }`}
                    >
                      2. Kiểm định Hub
                    </button>
                    <button
                      onClick={() => setActivePhotoStage('handover')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                        activePhotoStage === 'handover'
                          ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white font-bold'
                          : 'text-[#0E121B]/70'
                      }`}
                    >
                      3. Niêm phong giao
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(activePhotoStage === 'listing'
                    ? detailModalOrder.multiStagePhotos.listingPhotos
                    : activePhotoStage === 'inspector'
                    ? detailModalOrder.multiStagePhotos.inspectorPhotos || []
                    : detailModalOrder.multiStagePhotos.handoverPhotos || []
                  ).map((photoUrl, idx) => (
                    <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden bg-[#F4F5F8] border border-gray-200 group">
                      <img
                        src={photoUrl}
                        alt="Stage audit"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
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
                  <span className="font-semibold text-[#0E121B]">{formatVND(detailModalOrder.itemPriceVnd)}</span>
                </div>
                <div className="flex justify-between text-[#0E121B]/70">
                  <span>{t.inspectionFee}:</span>
                  <span className="font-semibold text-[#0E121B]">{formatVND(detailModalOrder.inspectionFeeVnd)}</span>
                </div>
                <div className="flex justify-between text-[#0E121B]/70">
                  <span>{t.shippingFee} (2 chặng GHTK + GHN):</span>
                  <span className="font-semibold text-[#0E121B]">{formatVND(detailModalOrder.shippingFeeVnd)}</span>
                </div>
                <div className="flex justify-between text-[#0E121B]/70">
                  <span>{t.platformFee}:</span>
                  <span className="font-semibold text-[#0E121B]">{formatVND(detailModalOrder.platformFeeVnd)}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-[#0E121B]">
                  <span>{t.totalEscrow}:</span>
                  <span className="font-extrabold text-[#EC1577]">
                    {formatVND(detailModalOrder.totalPaidVnd)}
                  </span>
                </div>
              </div>

              {/* Actions for Buyer in Modal */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {detailModalOrder.escrowStatus !== 'COMPLETED_RELEASED' &&
                  detailModalOrder.escrowStatus !== 'DISPUTED' && (
                    <>
                      <button
                        onClick={() => {
                          onConfirmReceipt(detailModalOrder.id);
                          setDetailModalOrder(null);
                        }}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.confirmReceipt}</span>
                      </button>

                      <button
                        onClick={() => {
                          onOpenDispute(detailModalOrder);
                          setDetailModalOrder(null);
                        }}
                        className="py-3 px-4 bg-[#0E121B] hover:bg-[#0E121B]/80 text-white border border-[#0E121B] rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <AlertTriangle className="w-4 h-4 text-[#EC1577]" />
                        <span>{t.openDispute}</span>
                      </button>
                    </>
                  )}

                <button
                  onClick={() => setDetailModalOrder(null)}
                  className="py-3 px-5 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-xl font-semibold text-xs sm:text-sm transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: IN PHIẾU GỬI HÀNG HUB DÀNH CHO NGƯỜI BÁN */}
      {shippingLabelOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShippingLabelOrder(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-slate-900 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Phiếu Gửi Hàng Kiểm Định Hub
                  </h3>
                  <p className="text-xs text-slate-500">Mã đơn: #{shippingLabelOrder.id} &bull; Đối tác GHTK Express</p>
                </div>
              </div>
              <button
                onClick={() => setShippingLabelOrder(null)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Voucher Body */}
            <div className="mt-5 p-5 rounded-2xl bg-slate-50 border-2 border-dashed border-gray-300 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Đơn vị vận chuyển</span>
                  <span className="font-extrabold text-sm text-slate-900">GHTK Express • Hàng Lấy Tận Kho</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Mã vận đơn</span>
                  <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                    {shippingLabelOrder.shippingLegs?.[0]?.trackingNumber || 'GHTK-99210488'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Kho lấy hàng (Người bán)</span>
                  <div className="font-bold text-slate-900">{shippingLabelOrder.sellerName}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {shippingLabelOrder.shippingLegs?.[0]?.origin || '92 Phan Châu Trinh, Hải Châu, Đà Nẵng'}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Nơi nhận (Trung tâm Hub)</span>
                  <div className="font-bold text-slate-900">SecondLife Hub Lab</div>
                  <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {shippingLabelOrder.shippingLegs?.[0]?.destination || 'Trạm Kiểm Định SecondLife Đà Nẵng'}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Thiết bị gửi:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[240px]">{shippingLabelOrder.listing.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quy cách kiện:</span>
                  <span className="font-medium text-slate-800">Điện máy gia dụng - Có bao bọc chống va đập</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chỉ dẫn bưu tá:</span>
                  <span className="font-bold text-[#EC1577]">Giao trực tiếp phòng Lab kiểm định</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Dịch vụ Verify Then Ship 2 chặng</span>
                <span className="font-mono text-emerald-700 font-bold">Bảo Hiểm Escrow</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                onClick={() => setShippingLabelOrder(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Phiếu Gửi Hàng</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
