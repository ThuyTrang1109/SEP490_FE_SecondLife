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
import { VerifyEmailModal } from './components/modals/VerifyEmailModal';
import { LogoutConfirmModal } from './components/modals/LogoutConfirmModal';
import { TopUpModal } from './components/modals/TopUpModal';
import { ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { authService, userService, topupService, getAccessToken, clearAuthTokens, getStoredUser, setStoredUser } from './services';


export default function App() {
  // Global State
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

  // User Auth State - Isolated per browser/device via localStorage
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    return token && stored ? (stored as UserProfile) : null;
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    return token && stored && stored.role ? stored.role : 'buyer';
  });

  // Pending action after login (redirect or resume action)
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [pendingCheckoutItem, setPendingCheckoutItem] = useState<Listing | null>(null);

  // Restore & verify session for THIS browser from Backend /me on startup/refresh
  React.useEffect(() => {
    const token = getAccessToken();
    if (token && !token.startsWith('demo-jwt-')) {
      userService.getMyProfile().then((profile) => {
        if (profile) {
          const syncedUser: UserProfile = {
            id: profile.id,
            name: profile.fullName || profile.email,
            email: profile.email,
            role: (profile.roles?.includes('ADMIN') || profile.roles?.includes('ROLE_ADMIN'))
              ? 'admin'
              : (profile.roles?.includes('INSPECTOR') || profile.roles?.includes('ROLE_INSPECTOR') || profile.roles?.includes('HUB_INSPECTOR'))
              ? 'inspector'
              : (profile.roles?.includes('SELLER') || profile.roles?.includes('ROLE_SELLER'))
              ? 'seller'
              : 'buyer',
            phone: profile.phone || '',
            avatar: profile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            kycStatus: (profile.roles?.includes('SELLER') || profile.roles?.includes('ROLE_SELLER')) ? 'verified' : 'unverified',
            emailVerified: profile.emailVerified ?? true,
          };
          setCurrentUser(syncedUser);
          setCurrentRole(syncedUser.role);
          setStoredUser(syncedUser);
        }
      }).catch((err: any) => {
        // If the token is invalid/revoked on server, clear this browser's session
        if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('Invalid JWT') || err.message.includes('revoked'))) {
          clearAuthTokens();
          setCurrentUser(null);
          setCurrentRole('buyer');
        }
      });
    }
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isVerifyEmailModalOpen, setIsVerifyEmailModalOpen] = useState(false);
  const [verifyEmailTarget, setVerifyEmailTarget] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [userCreditBalance, setUserCreditBalance] = useState<number>(500);

  // Fetch credit balance on load if user is logged in
  React.useEffect(() => {
    if (currentUser) {
      topupService.getMyCredit()
        .then((res) => {
          if (res && typeof res.balance === 'number') {
            setUserCreditBalance(res.balance);
          }
        })
        .catch(() => {});
    }
  }, [currentUser]);


  const handleConfirmLogout = () => {
    authService.logout();
    clearAuthTokens();
    setCurrentUser(null);
    setCurrentRole('buyer');
    setActiveTab('home');
    setIsProfileDialogOpen(false);
    showToast(
      lang === 'vi'
        ? 'Đã đăng xuất tài khoản thành công.'
        : 'Logged out successfully.'
    );
  };

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

  // Auth Guard Helper
  const protectedTabs = ['create-listing', 'seller-dashboard', 'orders', 'inspection-hub', 'admin-dashboard', 'chat'];

  const requireAuth = (onSuccessAction?: () => void, customMsg?: string): boolean => {
    if (!currentUser) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      showToast(
        customMsg || (lang === 'vi'
          ? 'Vui lòng đăng nhập để tiếp tục thực hiện hành động này.'
          : 'Please log in to proceed.')
      );
      return false;
    }
    onSuccessAction?.();
    return true;
  };

  const handleTabChange = (tab: string) => {
    if (protectedTabs.includes(tab) && !currentUser) {
      setPendingTab(tab);
      let promptMsg = lang === 'vi'
        ? 'Vui lòng đăng nhập để truy cập khu vực này.'
        : 'Please log in to access this section.';
      if (tab === 'create-listing') {
        promptMsg = lang === 'vi'
          ? 'Vui lòng đăng nhập để thử nghiệm định giá AI và đăng bán sản phẩm.'
          : 'Please log in to use AI valuation and post a listing.';
      } else if (tab === 'chat') {
        promptMsg = lang === 'vi'
          ? 'Vui lòng đăng nhập để sử dụng tính năng Chat & Đàm phán AI.'
          : 'Please log in to use AI Negotiation Chat.';
      } else if (tab === 'orders') {
        promptMsg = lang === 'vi'
          ? 'Vui lòng đăng nhập để xem danh sách đơn hàng ký quỹ.'
          : 'Please log in to view escrow orders.';
      } else if (tab === 'seller-dashboard') {
        promptMsg = lang === 'vi'
          ? 'Vui lòng đăng nhập với tài khoản Người Bán để vào Kênh người bán.'
          : 'Please log in with a seller account to access Seller Hub.';
      }
      requireAuth(undefined, promptMsg);
      return;
    }
    setActiveTab(tab);
  };

  // Guard activeTab if logged out
  React.useEffect(() => {
    if (!currentUser && protectedTabs.includes(activeTab)) {
      setActiveTab('home');
    }
  }, [currentUser, activeTab]);

  // Handlers
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    if (currentUser) {
      setCurrentUser((prev) => prev ? { ...prev, role: newRole } : null);
    }
    if (newRole === 'inspector') {
      handleTabChange('inspection-hub');
    } else if (newRole === 'admin') {
      handleTabChange('admin-dashboard');
    } else if (newRole === 'seller') {
      handleTabChange('seller-dashboard');
    } else {
      handleTabChange('marketplace');
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
          onTabChange={handleTabChange}
          activeOrdersCount={orders.filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED').length}
          currentUser={currentUser}
          onOpenAuth={(mode) => {
            setAuthModalMode(mode);
            setIsAuthModalOpen(true);
          }}
          onLogout={() => {
            setIsLogoutModalOpen(true);
          }}
          onOpenProfile={() => {
            if (!currentUser) {
              requireAuth(undefined, lang === 'vi' ? 'Vui lòng đăng nhập để xem hồ sơ cá nhân.' : 'Please log in to view your profile.');
            } else {
              setIsProfileDialogOpen(true);
            }
          }}
          onOpenTopUp={() => {
            if (!currentUser) {
              requireAuth(undefined, lang === 'vi' ? 'Vui lòng đăng nhập để nạp xu.' : 'Please log in to top up credit.');
            } else {
              setIsTopUpModalOpen(true);
            }
          }}
          userCreditBalance={userCreditBalance}
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
                setPendingTab('create-listing');
                requireAuth(undefined, lang === 'vi'
                  ? 'Vui lòng đăng nhập để thử nghiệm định giá AI và đăng bán sản phẩm.'
                  : 'Please log in to experience AI valuation and create listings.');
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
            onPostClick={() => handleTabChange('create-listing')}
          />
        )}

        {activeTab === 'seller-dashboard' && (
          <SellerDashboardView
            listings={listings}
            onSelectListing={(listing) => setSelectedListing(listing)}
            onCreateListing={() => handleTabChange('create-listing')}
            onViewOrders={() => handleTabChange('orders')}
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
                  if (!currentUser) {
                    requireAuth(undefined, lang === 'vi' ? 'Vui lòng đăng nhập để sử dụng tính năng Chat & Đàm phán.' : 'Please log in to chat.');
                    return;
                  }
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
            if (!currentUser) {
              setPendingCheckoutItem(item);
              requireAuth(undefined, lang === 'vi'
                ? 'Vui lòng đăng nhập để tiến hành mua hàng bảo đảm Escrow và kiểm định Hub.'
                : 'Please log in to purchase with Escrow protection.');
              return;
            }
            setSelectedListing(null);
            setCheckoutListing(item);
          }}
          onChatClick={(item) => {
            if (!currentUser) {
              requireAuth(undefined, lang === 'vi'
                ? 'Vui lòng đăng nhập để chat và thương lượng giá với người bán.'
                : 'Please log in to chat and negotiate with seller.');
              return;
            }
            setChatListing(item);
          }}
          lang={lang}
        />
      )}

      {/* Checkout Modal */}
      {checkoutListing && (
        <CheckoutModal
          listing={checkoutListing}
          currentUser={currentUser}
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
          const profileUser: UserProfile = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            address: user.address || '',
            role: user.role,
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            kycStatus: 'verified',
            emailVerified: true,
          };
          setCurrentUser(profileUser);
          setCurrentRole(user.role);
          setStoredUser(profileUser);
          showToast(
            lang === 'vi'
              ? `Chào mừng ${user.name} (${user.role === 'buyer' ? 'Người Mua' : user.role === 'seller' ? 'Người Bán' : user.role === 'inspector' ? 'Kỹ Sư Hub' : 'Quản Trị'}) đã đăng nhập!`
              : `Welcome ${user.name}! Logged in successfully as ${user.role.toUpperCase()}.`
          );
          if (pendingCheckoutItem) {
            setSelectedListing(null);
            setCheckoutListing(pendingCheckoutItem);
            setPendingCheckoutItem(null);
          } else if (pendingTab) {
            setActiveTab(pendingTab);
            setPendingTab(null);
          }
        }}
        lang={lang}
      />

      {/* User Profile Dialog */}
      <ProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={() => setIsProfileDialogOpen(false)}
        currentUser={currentUser}
        lang={lang}
        onUpdateProfile={(updated) => {
          setCurrentUser(updated);
          setStoredUser(updated);
          showToast(
            lang === 'vi'
              ? 'Đã lưu thông tin hồ sơ cá nhân thành công!'
              : 'User profile updated successfully!'
          );
        }}
        onRoleChange={handleRoleChange}
        onChangePassword={() => {
          setIsProfileDialogOpen(false);
          setAuthModalMode('forgot');
          setIsAuthModalOpen(true);
        }}
        onLogout={() => {
          setIsLogoutModalOpen(true);
        }}
        onOpenVerifyEmail={(targetEmail) => {
          setVerifyEmailTarget(targetEmail);
          setIsVerifyEmailModalOpen(true);
        }}
      />

      {/* 6-Digit OTP Email Verification Modal Popup */}
      <VerifyEmailModal
        isOpen={isVerifyEmailModalOpen}
        email={verifyEmailTarget || currentUser?.email || 'user@secondlife.vn'}
        onClose={() => setIsVerifyEmailModalOpen(false)}
        onSuccess={() => {
          if (currentUser) {
            const updatedUser: UserProfile = {
              ...currentUser,
              emailVerified: true,
            };
            setCurrentUser(updatedUser);
            setStoredUser(updatedUser);
          }
          showToast(
            lang === 'vi'
              ? 'Xác thực địa chỉ email thành công! Tài khoản đã được bảo mật toàn diện.'
              : 'Email address verified successfully! Your account is now fully secured.'
          );
        }}
        lang={lang}
      />

      {/* TopUp Coins Modal Popup */}
      <TopUpModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        currentCredit={userCreditBalance}
        onCreditUpdated={(newBal) => setUserCreditBalance(newBal)}
      />

      {/* Logout Confirmation Modal Popup */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        lang={lang}
      />

      {/* E-Commerce Footer */}
      {activeTab !== 'admin-dashboard' && (
        <Footer
          lang={lang}
          onTabChange={handleTabChange}
          onOpenProfile={() => {
            if (!currentUser) {
              requireAuth(undefined, lang === 'vi' ? 'Vui lòng đăng nhập để xem thông tin hồ sơ.' : 'Please log in to view profile.');
            } else {
              setIsProfileDialogOpen(true);
            }
          }}
        />
      )}
    </div>
  );
}
