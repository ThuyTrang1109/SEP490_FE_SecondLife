import React, { useState } from 'react';
import { UserRole, Language, Listing, EscrowOrder, DisputeCase } from './types';
import { mockListings, mockOrders, mockDisputes } from './data/mockData';
import { translations, formatVND } from './utils/translations';
import { Navbar } from './components/Navbar';
import { MarketplaceView } from './components/MarketplaceView';
import { ListingDetailModal } from './components/ListingDetailModal';
import { CreateListingView } from './components/CreateListingView';
import { EscrowOrdersView } from './components/EscrowOrdersView';
import { InspectorPortalView } from './components/InspectorPortalView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { ChatModal } from './components/ChatModal';
import { CheckoutModal } from './components/CheckoutModal';
import { HomePageView } from './components/HomePageView';
import { AuthModal } from './components/AuthModal';
import { ShieldCheck, Sparkles, Building2, Lock, CheckCircle2, Heart, Award, ArrowRight } from 'lucide-react';

export default function App() {
  // Global State
  const [currentRole, setCurrentRole] = useState<UserRole>('buyer');
  const [lang, setLang] = useState<Language>('vi');
  const [activeTab, setActiveTab] = useState<string>('home');

  // User Auth State
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null>({
    id: 'USR-1001',
    name: 'Hoàng Quốc Khang',
    email: 'khang.buyer@secondlife.vn',
    role: 'buyer'
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Core Data State
  const [listings, setListings] = useState<Listing[]>(mockListings);
  const [orders, setOrders] = useState<EscrowOrder[]>(mockOrders);
  const [disputes, setDisputes] = useState<DisputeCase[]>(mockDisputes);

  // Modals
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [checkoutListing, setCheckoutListing] = useState<Listing | null>(null);
  const [chatListing, setChatListing] = useState<Listing | null>(null);

  // Flash Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handlers
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    if (currentUser) {
      setCurrentUser((prev) => prev ? { ...prev, role: newRole } : null);
    }
    if (newRole === 'inspector') {
      setActiveTab('inspection-hub');
    } else if (newRole === 'admin') {
      setActiveTab('admin-dashboard');
    } else if (newRole === 'seller') {
      setActiveTab('create-listing');
    } else {
      setActiveTab('marketplace');
    }
  };

  const handleListingCreated = (newListing: Listing) => {
    setListings((prev) => [newListing, ...prev]);
    setActiveTab('marketplace');
    showToast(`Đăng bán thành công sản phẩm "${newListing.title}"! Giá niêm yết: ${formatVND(newListing.priceVnd)}.`);
  };

  const handleOrderPlaced = (newOrder: EscrowOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
    setCheckoutListing(null);
    setSelectedListing(null);
    setActiveTab('orders');
    showToast(`Đã phong tỏa Escrow ${formatVND(newOrder.totalPaidVnd)} cho đơn hàng #${newOrder.id}! Bưu tá đang chuẩn bị lấy hàng.`);
  };

  const handleConfirmReceipt = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId ? { ...ord, escrowStatus: 'COMPLETED_RELEASED' } : ord
      )
    );
    showToast(`Đã xác nhận nhận hàng! Tiền trong Escrow đã được giải ngân thành công cho người bán.`);
  };

  const handleOpenDispute = (order: EscrowOrder) => {
    const newDispute: DisputeCase = {
      id: `DISP-2026-${Math.floor(100 + Math.random() * 900)}`,
      orderId: order.id,
      buyerId: order.buyerId,
      buyerName: order.buyerName,
      sellerId: order.sellerId,
      sellerName: order.sellerName,
      reason: 'NOT_AS_DESCRIBED',
      description: 'Sản phẩm nhận được có dấu hiệu trầy xước không giống như người bán khai báo trên tin đăng.',
      buyerEvidencePhotos: [order.listing.photos.screenOrDetails],
      openedAt: new Date().toISOString(),
      status: 'PENDING_ARBITRATION'
    };

    setDisputes((prev) => [newDispute, ...prev]);
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, escrowStatus: 'DISPUTED' } : o))
    );
    showToast(`Đã mở khiếu nại đơn hàng #${order.id}! Tiền trong Escrow đã được đóng băng để Admin phân xử.`);
  };

  const handleCompleteInspection = (
    orderId: string,
    verdict: 'PASS' | 'FAIL',
    tamperSeal: string,
    summary: string
  ) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            escrowStatus: verdict === 'PASS' ? 'SHIPPED_TO_BUYER' : 'REFUNDED_TO_BUYER',
            inspectionReport: {
              id: `REP-${Math.floor(1000 + Math.random() * 9000)}`,
              orderId: ord.id,
              centerId: 'center-hcm-01',
              centerName: 'SecondLife Hub Flagship',
              inspectorName: 'KTV Trưởng Hải Đăng',
              inspectedAt: new Date().toISOString(),
              verdict,
              detectedGrade: ord.listing.conditionGrade,
              conditionScore: verdict === 'PASS' ? 96 : 40,
              tamperSealId: tamperSeal,
              checklistResults: [],
              inspectorPhotos: [ord.listing.photos.front, ord.listing.photos.back],
              summaryNotes: summary
            }
          };
        }
        return ord;
      })
    );
    showToast(`Đã nghiệm thu đơn hàng #${orderId} kết quả: ${verdict}! Tem NFC: ${tamperSeal}.`);
  };

  const handleResolveDispute = (disputeId: string, decision: 'REFUND_BUYER' | 'RELEASE_SELLER') => {
    const disp = disputes.find((d) => d.id === disputeId);
    if (!disp) return;

    setDisputes((prev) => prev.filter((d) => d.id !== disputeId));
    if (disp.orderId) {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === disp.orderId) {
            return {
              ...o,
              escrowStatus: decision === 'REFUND_BUYER' ? 'REFUNDED_TO_BUYER' : 'COMPLETED_RELEASED'
            };
          }
          return o;
        })
      );
    }
    showToast(
      decision === 'REFUND_BUYER'
        ? `Trọng tài phán quyết: Hoàn trả 100% tiền qua Escrow cho Người mua.`
        : `Trọng tài phán quyết: Bác khiếu nại, giải ngân tiền cho Người bán.`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-stone-900 selection:bg-[#1B4D3E] selection:text-white">
      {/* Navigation */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        lang={lang}
        onLangChange={setLang}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeOrdersCount={orders.filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED').length}
        currentUser={currentUser}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onLogout={() => {
          setCurrentUser(null);
          showToast('Đã đăng xuất tài khoản thành công.');
        }}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900 text-stone-100 px-4 py-3 rounded-xl shadow-xl border border-stone-800 flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-stone-400 hover:text-white text-xs ml-auto cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6">
        {activeTab === 'home' && (
          <HomePageView
            lang={lang}
            onExploreMarketplace={() => setActiveTab('marketplace')}
            onCreateListing={() => {
              if (!currentUser) {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              } else {
                setActiveTab('create-listing');
              }
            }}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {activeTab === 'marketplace' && (
          <MarketplaceView
            listings={listings}
            onSelectListing={(listing) => setSelectedListing(listing)}
            lang={lang}
            onPostClick={() => setActiveTab('create-listing')}
          />
        )}

        {activeTab === 'create-listing' && (
          <CreateListingView
            onListingCreated={handleListingCreated}
            lang={lang}
            onCancel={() => setActiveTab('marketplace')}
          />
        )}

        {activeTab === 'orders' && (
          <EscrowOrdersView
            orders={orders}
            onConfirmReceipt={handleConfirmReceipt}
            onOpenDispute={handleOpenDispute}
            lang={lang}
          />
        )}

        {activeTab === 'inspection-hub' && (
          <InspectorPortalView
            orders={orders}
            onCompleteInspection={handleCompleteInspection}
            lang={lang}
          />
        )}

        {activeTab === 'admin-dashboard' && (
          <AdminDashboardView
            orders={orders}
            disputes={disputes}
            listings={listings}
            onResolveDispute={handleResolveDispute}
            lang={lang}
          />
        )}

        {activeTab === 'chat' && (
          <div className="max-w-3xl mx-auto space-y-6 pb-16">
            <div className="bg-white rounded-2xl p-8 border border-stone-200/80 shadow-xs text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-100">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-stone-900">
                {lang === 'vi' ? 'Hệ Thống Đàm Phán & Chống Lừa Đảo AI' : 'Smart Negotiation & Anti-Fraud Chat'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto">
                {lang === 'vi'
                  ? 'Bấm chọn bất kỳ sản phẩm nào trên Sàn để mở phiên chat đàm phán giá. AI sẽ phân tích đề xuất và cảnh báo nếu có dấu hiệu chuyển khoản ngoài hệ thống.'
                  : 'Select any listing in the marketplace to start negotiating with live AI counter-offer advice and anti-scam warnings.'}
              </p>
              <button
                onClick={() => {
                  setChatListing(listings[0]);
                }}
                className="px-5 py-2.5 bg-[#1B4D3E] hover:bg-[#153e32] text-white rounded-xl text-xs sm:text-sm font-medium shadow-xs transition cursor-pointer"
              >
                Mở Hội Thoại Thử Nghiệm với Sản Phẩm Mẫu &rarr;
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Listing Detail Modal */}
      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onBuyClick={(item) => {
            setSelectedListing(null);
            setCheckoutListing(item);
          }}
          onChatClick={(item) => {
            setChatListing(item);
          }}
          lang={lang}
        />
      )}

      {/* Checkout Modal */}
      {checkoutListing && (
        <CheckoutModal
          listing={checkoutListing}
          onClose={() => setCheckoutListing(null)}
          onOrderPlaced={handleOrderPlaced}
          lang={lang}
        />
      )}

      {/* Chat & Negotiation Modal */}
      {chatListing && (
        <ChatModal
          listing={chatListing}
          currentRole={currentRole}
          onClose={() => setChatListing(null)}
          lang={lang}
        />
      )}

      {/* Authentication Modal (Login & Register) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrentRole(user.role);
          showToast(
            lang === 'vi'
              ? `Chào mừng ${user.name} (${user.role === 'buyer' ? 'Người Mua' : user.role === 'seller' ? 'Người Bán' : user.role === 'inspector' ? 'Kỹ Sư Hub' : 'Quản Trị'}) đã đăng nhập!`
              : `Welcome ${user.name}! Logged in successfully as ${user.role.toUpperCase()}.`
          );
        }}
        lang={lang}
      />

      {/* Footer with Capstone Project Content */}
      <footer className="mt-auto border-t border-stone-200 bg-white text-stone-600 text-xs py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1B4D3E] flex items-center justify-center text-white">
                <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <span className="font-bold text-sm text-stone-900">SecondLife</span>
                <p className="text-[11px] text-stone-500">
                  {lang === 'vi'
                    ? 'Sàn thương mại đồ cũ tích hợp AI định giá và dịch vụ kiểm định xác thực'
                    : 'AI Powered Second-Hand Marketplace with Price Estimation & Authentication Service'}
                </p>
              </div>
            </div>

            {/* Capstone Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-emerald-50 text-emerald-900 font-medium px-2.5 py-0.5 rounded-lg border border-emerald-200/80 text-[11px]">
                Capstone Project 2026
              </span>
              <span className="bg-stone-100 text-stone-600 font-medium px-2.5 py-0.5 rounded-lg border border-stone-200 text-[11px]">
                LightGBM + EfficientNet + Escrow Protocol
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] text-stone-500">
            <div>
              <div className="font-semibold text-stone-800 mb-1">1. AI Price Estimation</div>
              <p>Mô hình Machine Learning đối chiếu dữ liệu giao dịch thực tế kết hợp thị giác máy tính phát hiện hao mòn ngoại quan.</p>
            </div>
            <div>
              <div className="font-semibold text-stone-800 mb-1">2. Verify Then Ship</div>
              <p>Mạng lưới Trung tâm giám định SecondLife Hub tại Hà Nội, Đà Nẵng, TP.HCM dán tem niêm phong NFC chống tráo hàng.</p>
            </div>
            <div>
              <div className="font-semibold text-stone-800 mb-1">3. Escrow Payment</div>
              <p>Tiền thanh toán được giữ an toàn trong quỹ tín thác, tự động hoàn tiền nếu kiểm định thất bại hoặc phát hiện hàng nhái.</p>
            </div>
          </div>

          <div className="pt-1 text-center text-[10px] text-stone-400">
            &copy; 2026 SecondLife Vietnam. All rights reserved. Registered Capstone Project proposal demonstration.
          </div>
        </div>
      </footer>
    </div>
  );
}
