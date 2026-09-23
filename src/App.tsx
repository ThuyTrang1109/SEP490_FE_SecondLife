import React, { useState } from 'react';
import { UserRole, Language, ThemeMode, Listing, EscrowOrder, DisputeCase, UserProfile } from './types';
import { mockListings, mockOrders, mockDisputes } from './data/mockData';
import { formatVND } from './utils/translations';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { MarketplaceView } from './pages/MarketplaceView';
import { ListingDetailModal } from './components/modals/ListingDetailModal';
import { CreateListingView } from './pages/CreateListingView';
import { SellerDashboardView } from './pages/SellerDashboardView';
import { EscrowOrdersView } from './pages/EscrowOrdersView';
import { InspectorPortalView } from './pages/InspectorPortalView';
import { AdminDashboardView } from './pages/AdminDashboardView';
import { ChatModal } from './components/modals/ChatModal';
import { CheckoutModal } from './components/modals/CheckoutModal';
import { HomePageView } from './pages/HomePageView';
import { AuthModal } from './components/modals/AuthModal';
import { ProfileDialog } from './components/modals/ProfileDialog';
import { ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { authService, userService, getAccessToken, clearAuthTokens } from './services';

export default function App() {
  // Global State
  const [currentRole, setCurrentRole] = useState<UserRole>('buyer');
  const [lang, setLang] = useState<Language>('vi');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [activeTab, setActiveTab] = useState<string>('home');

  React.useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);

  // User Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>({
    id: 'USR-1001',
    name: 'Hoàng Quốc Khang',
    email: 'khang.buyer@secondlife.vn',
    role: 'buyer',
    phone: '0912 345 678',
    address: '92 Phan Châu Trinh, Phường Phước Ninh, Quận Hải Châu, TP. Đà Nẵng',
    walletBalanceVnd: 24500000,
    escrowLockedVnd: 19562500,
    kycStatus: 'verified',
    trustScore: 99,
    bankAccount: {
      bankName: 'Vietcombank',
      accountNumber: '991204882910',
      accountHolder: 'HOANG QUOC KHANG'
    }
  });

  // Session Restore Effect
  React.useEffect(() => {
    const token = getAccessToken();
    if (token) {
      userService.getMyProfile()
        .then((profile) => {
          let role: UserRole = 'buyer';
          if (profile.roles?.includes('ROLE_ADMIN') || profile.roles?.includes('ADMIN')) role = 'admin';
          else if (profile.roles?.includes('ROLE_INSPECTOR') || profile.roles?.includes('INSPECTOR')) role = 'inspector';
          else if (profile.roles?.includes('ROLE_SELLER') || profile.roles?.includes('SELLER')) role = 'seller';

          setCurrentUser({
            id: profile.id,
            name: profile.fullName || profile.email,
            email: profile.email,
            role: role,
            phone: profile.phone || '',
            kycStatus: profile.emailVerified ? 'verified' : 'unverified'
          });
          setCurrentRole(role);
        })
        .catch(() => {
          // Token invalid or expired
          clearAuthTokens();
        });
    }
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

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
      setActiveTab('seller-dashboard');
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
    showToast(`Đã mở khiếu nại đơn hàng #${order.id}! Tiền trong Escrow đã được đóng bằng để Admin phân xử.`);
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
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${theme === 'dark'
        ? 'bg-[#0E121B] text-white selection:bg-[#EC1577] selection:text-white'
        : 'bg-[#F4F5F8] text-[#0E121B] selection:bg-[#EC1577] selection:text-white'
      }`}>
      {/* Navigation */}
      {activeTab !== 'admin-dashboard' && (
        <Navbar
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          lang={lang}
          onLangChange={setLang}
          theme={theme}
          onThemeToggle={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeOrdersCount={orders.filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED').length}
          currentUser={currentUser}
          onOpenAuth={(mode) => {
            setAuthModalMode(mode);
            setIsAuthModalOpen(true);
          }}
          onLogout={() => {
            authService.logout();
            setCurrentUser(null);
            showToast('Đã đăng xuất tài khoản thành công.');
          }}
          onOpenProfile={() => setIsProfileDialogOpen(true)}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#0E121B] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#EC1577]/40 flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#EC1577] shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white text-xs ml-auto cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className={activeTab === 'admin-dashboard' ? 'flex-1 w-full' : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6'}>
        {activeTab === 'home' && (
          <HomePageView
            lang={lang}
            currentUser={currentUser}
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

        {activeTab === 'seller-dashboard' && (
          <SellerDashboardView
            listings={listings}
            onSelectListing={(listing) => setSelectedListing(listing)}
            onCreateListing={() => setActiveTab('create-listing')}
            onViewOrders={() => setActiveTab('orders')}
            lang={lang}
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
            userRole={currentRole}
            onOpenChat={(listing) => setChatListing(listing)}
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
            onViewWebsite={() => setActiveTab('marketplace')}
          />
        )}

        {activeTab === 'chat' && (
          <div className="max-w-3xl mx-auto space-y-6 pb-16">
            <div className="bg-[#FFFFFF] rounded-2xl p-8 border border-slate-200 shadow-xs text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#0E121B]">
                {lang === 'vi' ? 'Hệ Thống Đàm Phán & Chống Lừa Đảo AI' : 'Smart Negotiation & Anti-Fraud Chat'}
              </h2>
              <p className="text-xs sm:text-sm text-[#0E121B]/70 max-w-lg mx-auto">
                {lang === 'vi'
                  ? 'Bấm chọn bất kỳ sản phẩm nào trên Sàn để mở phiên chat đàm phán giá. AI sẽ phân tích đề xuất và cảnh báo nếu có dấu hiệu chuyển khoản ngoài hệ thống.'
                  : 'Select any listing in the marketplace to start negotiating with live AI counter-offer advice and anti-scam warnings.'}
              </p>
              <button
                onClick={() => {
                  setChatListing(listings[0]);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
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

      {/* Authentication Modal */}
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

      {/* User Profile Dialog */}
      <ProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={() => setIsProfileDialogOpen(false)}
        currentUser={currentUser}
        onUpdateProfile={(updated) => {
          setCurrentUser(updated);
          showToast(
            lang === 'vi'
              ? 'Đã lưu thông tin hồ sơ cá nhân thành công!'
              : 'User profile updated successfully!'
          );
        }}
        onRoleChange={handleRoleChange}
        onLogout={() => {
          authService.logout();
          setCurrentUser(null);
          showToast(
            lang === 'vi'
              ? 'Đã đăng xuất tài khoản thành công.'
              : 'Logged out successfully.'
          );
        }}
        lang={lang}
      />

      {/* E-Commerce Footer */}
      {activeTab !== 'admin-dashboard' && (
        <Footer
          lang={lang}
          onTabChange={setActiveTab}
          onOpenProfile={() => setIsProfileDialogOpen(true)}
        />
      )}
    </div>
  );
}
