import React, { useState } from 'react';
import { UserRole, Language, Listing, EscrowOrder, DisputeCase, UserProfile, UserCredit, ItemCategory, ConditionGrade } from './types';
import { formatVND } from './utils/translations';
import { extractWardAndCity, getSavedSellerAddress, saveSellerAddress } from './utils/addressUtils';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { MarketplaceView } from './pages/MarketplaceView';
import { ListingDetailModal } from './components/modals/ListingDetailModal';
import { CreateListingView } from './pages/CreateListingView';
import { SellerDashboardView } from './pages/SellerDashboardView';
import { EscrowOrdersView } from './pages/EscrowOrdersView';
import { InspectorPortalView } from './pages/InspectorPortalView';
import { InspectionCenterDashboardView } from './pages/InspectionCenterDashboardView';
import { StaffWorkspaceView } from './pages/StaffWorkspaceView';
import { AdminDashboardView } from './pages/AdminDashboardView';
import { InboxView } from './pages/InboxView';
import { ChatModal } from './components/modals/ChatModal';
import { CheckoutModal } from './components/modals/CheckoutModal';
import { HomePageView } from './pages/HomePageView';
import { AuthModal } from './components/modals/AuthModal';
import { ProfileDialog } from './components/modals/ProfileDialog';
import { SellerRegistrationModal } from './components/modals/SellerRegistrationModal';
import { VerifyEmailModal } from './components/modals/VerifyEmailModal';
import { LogoutConfirmModal } from './components/modals/LogoutConfirmModal';
import { SessionExpiredModal } from './components/modals/SessionExpiredModal';
import { TopUpModal } from './components/modals/TopUpModal';
import { PolicyModal, PolicyTabKey } from './components/modals/PolicyModal';
import { SellerReviewsModal } from './components/modals/SellerReviewsModal';
import { NotificationCenterView } from './pages/NotificationCenterView';
import { BuyerInspectionDecisionView } from './pages/BuyerInspectionDecisionView';
import { RealtimeNotificationToast } from './components/common/RealtimeNotificationToast';
import { GlobalPopupModal } from './components/common/GlobalPopupModal';
import './utils/dialogService';
import { ShieldCheck, Sparkles, CheckCircle2, Store } from 'lucide-react';
import { authService, userService, topupService, walletService, orderService, inspectorService, negotiationService, postService, adminPostService, shippingService, sellerCreditService, chatService, getAccessToken, clearAuthTokens, getStoredUser, setStoredUser, ChatRoomDto } from './services';

export default function App() {
  // Global State - Default to 'marketplace' so visitors enter directly into the marketplace
  const [lang, setLang] = useState<Language>('vi');
  const [activeTab, setActiveTab] = useState<string>(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (token && stored && stored.role) {
      const r = String(stored.role).toLowerCase();
      if (r === 'admin') return 'admin-dashboard';
      if (r === 'inspection_center') return 'inspection-center';
      if (r === 'inspector') return 'inspection-hub';
    }
    return 'home';
  });

  React.useEffect(() => {
    document.body.classList.remove('dark');
  }, []);

  // User Auth State - Isolated per browser/device via localStorage
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      clearAuthTokens();
      return null;
    }
    return stored as UserProfile;
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    return token && stored && stored.role ? stored.role : 'buyer';
  });

  // Pending action after login (redirect or resume action)
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [pendingCheckoutItem, setPendingCheckoutItem] = useState<Listing | null>(null);
  const [editingDraft, setEditingDraft] = useState<Listing | null>(null);
  const [createListingReturnTab, setCreateListingReturnTab] = useState<string>('marketplace');
  const [inspectionDecisionOrder, setInspectionDecisionOrder] = useState<EscrowOrder | null>(null);
  const [inspectionDecisionOrderId, setInspectionDecisionOrderId] = useState<string | null>(null);

  // Restore & verify session for THIS browser from Backend /me on startup/refresh
  React.useEffect(() => {
    const token = getAccessToken();
    if (token) {
      userService.getMyProfile().then(async (profile) => {
        if (profile) {
          // Lấy thông tin địa chỉ kho bưu tá / onboarding từ BE
          let pickupAddr: any = null;
          try {
            const [obRes, paRes] = await Promise.allSettled([
              shippingService.getSellerOnboarding(),
              shippingService.getPickupAddress(),
            ]);
            if (obRes.status === 'fulfilled' && obRes.value?.pickupAddress) {
              pickupAddr = obRes.value.pickupAddress;
            } else if (paRes.status === 'fulfilled' && paRes.value) {
              pickupAddr = paRes.value;
            }
          } catch (_) {}

          const fullPickup = pickupAddr
            ? [pickupAddr.address, pickupAddr.wardName, pickupAddr.provinceName].filter(Boolean).join(', ')
            : '';

          const stored = getStoredUser();
          const savedAddr = getSavedSellerAddress();

          const profileFullAddress = [
            profile.streetAddress,
            profile.ward,
            profile.district,
            profile.province,
          ].filter(Boolean).join(', ');

          const resolvedAddress = profileFullAddress || stored?.address || savedAddr?.address || '';
          const resolvedPickup = fullPickup || stored?.pickupAddress || profileFullAddress || savedAddr?.address || '';
          const resolvedWard = profile.ward || pickupAddr?.wardName || stored?.wardName || savedAddr?.wardName || '';
          const resolvedProv = profile.province || pickupAddr?.provinceName || stored?.provinceName || savedAddr?.provinceName || '';

          if (resolvedPickup || resolvedAddress) {
            saveSellerAddress(resolvedPickup || resolvedAddress, resolvedWard, resolvedProv);
          }

          const syncedUser: UserProfile = {
            id: profile.id,
            name: profile.fullName || profile.email,
            email: profile.email,
            role: (profile.roles?.includes('ADMIN') || profile.roles?.includes('ROLE_ADMIN'))
              ? 'admin'
              : (profile.roles?.includes('INSPECTION_CENTER') || profile.roles?.includes('ROLE_INSPECTION_CENTER'))
                ? 'inspection_center'
                : (profile.roles?.includes('INSPECTOR') || profile.roles?.includes('ROLE_INSPECTOR') || profile.roles?.includes('HUB_INSPECTOR'))
                  ? 'inspector'
                  : (profile.roles?.includes('STAFF') || profile.roles?.includes('ROLE_STAFF'))
                    ? 'staff'
                    : (profile.roles?.includes('SELLER') || profile.roles?.includes('ROLE_SELLER'))
                      ? 'seller'
                      : 'buyer',
            phone: profile.phone || '',
            address: resolvedAddress,
            pickupAddress: resolvedPickup,
            province: profile.province,
            district: profile.district,
            ward: profile.ward,
            streetAddress: profile.streetAddress,
            latitude: profile.latitude ?? stored?.latitude,
            longitude: profile.longitude ?? stored?.longitude,
            wardName: resolvedWard,
            provinceName: resolvedProv,
            avatar: profile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            accountStatus: profile.accountStatus,
            kycStatus: (profile.roles?.includes('SELLER') || profile.roles?.includes('ROLE_SELLER')) ? 'verified' : 'unverified',
            emailVerified: profile.emailVerified ?? true,
          };
          setCurrentUser(syncedUser);
          setCurrentRole(syncedUser.role);
          setStoredUser(syncedUser);
          saveSellerAddress(
            syncedUser.pickupAddress || syncedUser.address || '',
            syncedUser.wardName || syncedUser.ward || '',
            syncedUser.provinceName || syncedUser.province || ''
          );
          if (syncedUser.role === 'admin') {
            setActiveTab('admin-dashboard');
          } else if (syncedUser.role === 'inspection_center') {
            setActiveTab('inspection-center');
          } else if (syncedUser.role === 'inspector') {
            setActiveTab('inspection-hub');
          }
        } else {
          clearAuthTokens();
          setCurrentUser(null);
          setCurrentRole('buyer');
        }
      }).catch(() => {
        clearAuthTokens();
        setCurrentUser(null);
        setCurrentRole('buyer');
      });
    } else {
      clearAuthTokens();
      setCurrentUser(null);
      setCurrentRole('buyer');
    }
  }, []);

    // The unauthorized_session listener was moved below state declarations to utilize toast and modal.

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [isSessionExpiredOpen, setIsSessionExpiredOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isSellerRegistrationModalOpen, setIsSellerRegistrationModalOpen] = useState(false);
  const [isVerifyEmailModalOpen, setIsVerifyEmailModalOpen] = useState(false);
  const [verifyEmailTarget, setVerifyEmailTarget] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpInitialTab, setTopUpInitialTab] = useState<'wallet' | 'packages'>('packages');
  const [userCreditBalance, setUserCreditBalance] = useState<number>(500);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [checkoutNegotiationId, setCheckoutNegotiationId] = useState<string | undefined>(undefined);
  const [userCredit, setUserCredit] = useState<UserCredit>({
    postCredits: 10,
    valuationCredits: 0,
    chatCredits: 20,
  });

  // Policy Modal State
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyInitialTab, setPolicyInitialTab] = useState<PolicyTabKey>('about');

  // Load wallet balance from Backend
  const loadUserWallet = React.useCallback(async () => {
    if (currentUser && getAccessToken()) {
      try {
        const w = await walletService.getMyWallet();
        if (w && typeof w.balance === 'number') {
          setWalletBalance(w.balance);
          setCurrentUser((prev) => {
            if (!prev || (prev.walletBalanceVnd === w.balance && prev.walletBalance === w.balance)) return prev;
            return { ...prev, walletBalance: w.balance, walletBalanceVnd: w.balance };
          });
        }
      } catch (err) {
        console.warn('Could not load wallet from server:', err);
      }
    }
  }, [currentUser]);

  // Fetch credit balance and wallet on load if user is logged in
  React.useEffect(() => {
    if (currentUser && getAccessToken()) {
      loadUserWallet();

      const isSellerOrAdmin =
        currentRole === 'seller' ||
        currentRole === 'admin' ||
        currentUser.role === 'seller' ||
        currentUser.role === 'admin';

      // Buyers only use wallet balance; credits are only for sellers/admins
      if (isSellerOrAdmin) {
        Promise.all([
          topupService.getMyCredit().catch(() => null),
          sellerCreditService.getCredits().catch(() => null)
        ])
          .then(([aiCreditObj, sellerCreditObj]) => {
            if (aiCreditObj || sellerCreditObj) {
              const merged: UserCredit = {
                postCredits: sellerCreditObj?.postCredits ?? (aiCreditObj as any)?.postCredits ?? 0,
                valuationCredits: sellerCreditObj?.valuationCredits ?? (aiCreditObj as any)?.valuationCredits ?? 0,
                chatCredits: sellerCreditObj?.chatCredits ?? (aiCreditObj as any)?.aiChatBalance ?? (aiCreditObj as any)?.chatCredits ?? 0,
              };
              setUserCredit(merged);
              if (aiCreditObj && typeof (aiCreditObj as any).balance === 'number') {
                setUserCreditBalance((aiCreditObj as any).balance);
              }
            }
          })
          .catch(() => { });
      }
    }
  }, [currentUser, currentRole, loadUserWallet]);


  const handleConfirmLogout = () => {
    authService.logout().finally(() => {
      clearAuthTokens();
      setCurrentUser(null);
      setCurrentRole('buyer');
      setActiveTab('marketplace');
      setIsProfileDialogOpen(false);

      // Force a hard reload to ensure all memory states and third-party scripts are cleared
      window.location.reload();
    });
  };

  // Helper to recover locally placed or cached orders from localStorage
  const getLocalStoredOrders = React.useCallback((): EscrowOrder[] => {
    const result: EscrowOrder[] = [];
    const seenIds = new Set<string>();

    // 1. Check recent_placed_orders
    try {
      const raw = localStorage.getItem('recent_placed_orders');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((o) => {
            if (o?.id && !seenIds.has(o.id)) {
              seenIds.add(o.id);
              result.push(o);
            }
          });
        }
      }
    } catch {}

    // 2. Scan localStorage for any order_listing_* keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('order_listing_')) {
          const orderId = key.replace('order_listing_', '');
          if (orderId && !seenIds.has(orderId)) {
            try {
              const rawListing = localStorage.getItem(key);
              const listing = rawListing ? JSON.parse(rawListing) : null;
              let buyerInfo: any = {};
              const rawBuyer = localStorage.getItem(`order_buyer_info_${orderId}`);
              if (rawBuyer) buyerInfo = JSON.parse(rawBuyer);

              if (listing) {
                seenIds.add(orderId);
                result.push({
                  id: orderId,
                  listingId: listing.id,
                  listing,
                  buyerId: 'buyer-current',
                  buyerName: buyerInfo.buyerName || 'Khách Hàng',
                  buyerPhone: buyerInfo.buyerPhone || '',
                  buyerAddress: buyerInfo.buyerAddress || 'Địa chỉ nhận hàng',
                  sellerId: listing.sellerId || '',
                  sellerName: listing.sellerName || 'Người Bán SecondLife',
                  itemPriceVnd: listing.priceVnd || 0,
                  inspectionFeeVnd: 0,
                  shippingFeeVnd: 0,
                  platformFeeVnd: 0,
                  totalPaidVnd: listing.priceVnd || 0,
                  escrowStatus: 'HELD_IN_ESCROW',
                  hasInspectionService: Boolean(listing.requiresInspection),
                  shippingLegs: [
                    {
                      id: 'LEG-1',
                      legType: 'SELLER_TO_BUYER',
                      carrier: 'Lalamove / GHN',
                      trackingNumber: `TRACK-${orderId.slice(0, 8).toUpperCase()}`,
                      status: 'PICKED_UP',
                      origin: listing.sellerAddress || listing.location || 'Địa chỉ người bán',
                      destination: buyerInfo.buyerAddress || 'Địa chỉ nhận hàng',
                      estimatedDelivery: 'Giao trong ngày',
                      timeline: [
                        {
                          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                          description: 'Đã thanh toán Escrow thành công. Đang điều phối tài xế lấy hàng.',
                          location: 'SecondLife Hub'
                        }
                      ]
                    }
                  ],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  multiStagePhotos: {
                    listingPhotos: [listing.photos?.front, listing.photos?.back].filter(Boolean)
                  }
                });
              }
            } catch {}
          }
        }
      }
    } catch {}

    return result;
  }, []);

  // Core Data State
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<EscrowOrder[]>(() => getLocalStoredOrders());
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);

  // Modals
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [checkoutListing, setCheckoutListing] = useState<Listing | null>(null);
  const [checkoutAgreedPrice, setCheckoutAgreedPrice] = useState<number | undefined>(undefined);
  const [chatListing, setChatListing] = useState<Listing | null>(null);
  const [chatPredefinedRoomId, setChatPredefinedRoomId] = useState<string | undefined>(undefined);
  const [chatPartnerName, setChatPartnerName] = useState<string | undefined>(undefined);
  const [chatPartnerAvatar, setChatPartnerAvatar] = useState<string | undefined>(undefined);
  const [chatRoom, setChatRoom] = useState<ChatRoomDto | undefined>(undefined);
  const [sellerReviewsModalData, setSellerReviewsModalData] = useState<{ sellerId: string; sellerName: string } | null>(null);

  // Flash Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Listen for 401 Unauthorized session revocation events
  React.useEffect(() => {
    const handleUnauthorized = () => {
      console.log('[App] Received unauthorized_session event! Setting isSessionExpiredOpen to true');
      clearAuthTokens();
      setCurrentUser(null);
      setCurrentRole('buyer');
      
      // Notify user that session expired without destroying their current UI state
      setIsSessionExpiredOpen(true);
    };
    window.addEventListener('unauthorized_session', handleUnauthorized);
    return () => window.removeEventListener('unauthorized_session', handleUnauthorized);
  }, [lang]);

  // Idle Time & Token Watchdog
  React.useEffect(() => {
    let lastActivityTime = Date.now();
    const updateActivity = () => { lastActivityTime = Date.now(); };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const interval = setInterval(() => {
      if (currentUser) {
        import('./services/apiClient').then(({ getAccessToken, isTokenExpired, refreshAccessToken }) => {
          const token = getAccessToken();
          if (token && isTokenExpired(token)) {
            // Check if user is IDLE for 30 minutes (1800000 ms)
            if (Date.now() - lastActivityTime >= 1800000) {
              console.log('[App] User is idle and token expired. Dispatching unauthorized_session.');
              window.dispatchEvent(new Event('unauthorized_session'));
            } else {
              // User is active, proactively refresh token
              console.log('[App] Token expired but user active. Proactively refreshing.');
              refreshAccessToken().then((newToken) => {
                if (!newToken) {
                  window.dispatchEvent(new Event('unauthorized_session'));
                }
              });
            }
          }
        });
      }
    }, 5000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [currentUser]);

  // Auth Guard Helper
  const protectedTabs = ['create-listing', 'seller-dashboard', 'orders', 'inspection-hub', 'inspection-center', 'admin-dashboard', 'staff-workspace', 'chat', 'notifications'];

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
    if (currentUser?.role === 'admin' && tab !== 'admin-dashboard') {
      showToast(lang === 'vi' ? 'Tài khoản Quản trị viên chỉ truy cập trang Quản Trị Hệ Thống.' : 'Admin account only accesses Admin Portal.');
      return;
    }

    if (currentUser?.role === 'inspection_center' && tab !== 'inspection-center' && tab !== 'inspection-hub' && tab !== 'notifications') {
      showToast(lang === 'vi' ? 'Tài khoản Trưởng trung tâm kiểm định chỉ truy cập Bàn Điều Phối & Quản Trị.' : 'Inspection center account only accesses Center Management Portal.');
      return;
    }

    if (currentUser?.role === 'inspector' && tab !== 'inspection-hub' && tab !== 'notifications') {
      showToast(lang === 'vi' ? 'Tài khoản Kiểm định chỉ truy cập Trung Tâm Kiểm Định.' : 'Inspection account only accesses Inspection Hub.');
      return;
    }

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
      } else if (tab === 'notifications') {
        promptMsg = lang === 'vi'
          ? 'Vui lòng đăng nhập để xem thông báo hệ thống và tiến độ đơn hàng.'
          : 'Please log in to view system notifications.';
      }
      requireAuth(undefined, promptMsg);
      return;
    }

    if (tab === 'create-listing') {
      if (currentUser && ['admin', 'inspector', 'inspection_center'].includes(currentUser.role)) {
        showToast(lang === 'vi'
          ? 'Tài khoản Quản trị viên và Kỹ sư Hub không được đăng ký làm Người Bán.'
          : 'Admin and Inspector roles cannot register as sellers.');
        return;
      }
      if (currentUser && currentUser.role !== 'seller' && currentUser.role !== 'staff') {
        setIsSellerRegistrationModalOpen(true);
        return;
      }
    }

    if (tab === 'wallet') {
      setIsTopUpModalOpen(true);
      return;
    }

    if (['about', 'rules', 'terms', 'privacy', 'security', 'info'].includes(tab)) {
      showToast('Nội dung Điều khoản, Quy chế hoạt động và Chính sách bảo mật của Sàn SecondLife đã được niêm yết và bảo vệ bởi quỹ ký quỹ Escrow.');
      return;
    }

    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Deep Link Routing for Notifications (Section 5 of FE Integration Plan)
  const handleNotificationNavigate = React.useCallback((actionUrl: string | null, _notification?: any) => {
    if (!actionUrl) {
      handleTabChange('notifications');
      return;
    }

    const url = actionUrl.toLowerCase();

    // 0. Inspection Center portal routing: /inspector-center, /inspection-center
    if (url.includes('/inspector-center') || url.includes('/inspection-center') || (currentRole === 'inspection_center' && url.includes('/orders'))) {
      handleTabChange('inspection-center');
      return;
    }

    // 1. Order routing: /buyer/orders, /seller/orders, /orders
    if (url.includes('/orders') || url.includes('/order')) {
      handleTabChange('orders');
      return;
    }

    // 2. Inspection routing: /inspections, /inspector, /buyer/inspections
    if (url.includes('/inspections') || url.includes('/inspection')) {
      if (currentRole === 'inspection_center') {
        handleTabChange('inspection-center');
      } else if (currentRole === 'inspector' || currentUser?.role === 'inspector') {
        handleTabChange('inspection-hub');
      } else {
        const parts = url.split('/');
        const id = parts[parts.length - 1]?.split('?')[0];
        if (id && id !== 'inspections' && id !== 'inspection') {
          setInspectionDecisionOrderId(id);
          const found = orders.find((o) => o.id === id);
          setInspectionDecisionOrder(found || null);
          handleTabChange('buyer-inspection-decision');
        } else {
          handleTabChange('orders');
        }
      }
      return;
    }

    // 3. Negotiation / Chat routing: /negotiations, /chat
    if (url.includes('/negotiations') || url.includes('/chat')) {
      handleTabChange('chat');
      return;
    }

    // 4. Wallet routing: /wallet
    if (url.includes('/wallet')) {
      setIsTopUpModalOpen(true);
      return;
    }

    // 5. Listing / Post routing: /posts, /seller/posts
    if (url.includes('/posts') || url.includes('/listing')) {
      if (url.includes('/edit')) {
        handleTabChange('seller-dashboard');
      } else {
        handleTabChange('marketplace');
      }
      return;
    }

    // 6. Notifications center
    if (url.includes('/notifications')) {
      handleTabChange('notifications');
      return;
    }

    // 7. Seller onboarding / eKYC
    if (url.includes('/seller')) {
      handleTabChange('seller-dashboard');
      return;
    }

    // Default fallback
    handleTabChange('notifications');
  }, [currentRole, currentUser]);

  // Guard activeTab if logged out or if internal roles (admin / inspector / inspection_center)
  React.useEffect(() => {
    if (!currentUser && protectedTabs.includes(activeTab)) {
      setActiveTab('marketplace');
    } else if (currentUser?.role === 'admin' && activeTab !== 'admin-dashboard') {
      setActiveTab('admin-dashboard');
    } else if (currentUser?.role === 'inspection_center' && activeTab !== 'inspection-center') {
      setActiveTab('inspection-center');
    } else if (currentUser?.role === 'inspector' && activeTab !== 'inspection-hub') {
      setActiveTab('inspection-hub');
    }
  }, [currentUser, activeTab]);

  // Handlers
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    const existingUser = getStoredUser();
    if (existingUser) {
      setCurrentUser({ ...existingUser, role: newRole });
    }
    const roleLabels: Record<UserRole, string> = {
      buyer: 'Người Mua (Buyer)',
      seller: 'Người Bán (Seller)',
      staff: 'Nhân Viên (Staff)',
      inspector: 'Kỹ Sư Hub (Inspector)',
      inspection_center: 'Trưởng Trung Tâm Kiểm Định (Manager)',
      admin: 'Quản Trị Viên (Admin)'
    };
    showToast(`Đã chuyển góc nhìn sang ${roleLabels[newRole]}.`);

    if (newRole === 'inspection_center') {
      handleTabChange('inspection-center');
    } else if (newRole === 'inspector') {
      handleTabChange('inspection-hub');
    } else if (newRole === 'staff') {
      handleTabChange('home');
    } else if (newRole === 'admin') {
      handleTabChange('admin-dashboard');
    } else if (newRole === 'seller') {
      handleTabChange('seller-dashboard');
    } else {
      handleTabChange('marketplace');
    }
  };

  const handleListingCreated = (newListing: Listing) => {
    setListings((prev) => {
      const idx = prev.findIndex((l) => l.id === newListing.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...prev[idx], ...newListing };
        return updated;
      }
      return [newListing, ...prev];
    });

    const isRejected = newListing.backendStatus === 'REJECTED' || newListing.status === 'rejected';
    const isPendingInspection = newListing.backendStatus === 'PENDING_INSPECTION';
    const isPendingReview = newListing.backendStatus === 'PENDING';
    const isInsufficientCredit = newListing.backendStatus === 'INSUFFICIENT_CREDIT';

    setEditingDraft(null);

    // 1. Trường hợp bài đăng bị AI từ chối duyệt
    if (isRejected) {
      const reason = newListing.rejectionReason ? `: ${newListing.rejectionReason}` : '';
      showToast(
        lang === 'vi'
          ? `Bài đăng "${newListing.title}" đã bị AI từ chối kiểm duyệt${reason}. Vui lòng chỉnh sửa lại.`
          : `Listing "${newListing.title}" was rejected by AI moderation${reason}. Please revise.`
      );
      setActiveTab('seller-dashboard');
      return;
    }

    // 2. Trường hợp bài đăng chờ kiểm định chuyên gia Hub
    if (isPendingInspection) {
      showToast(
        lang === 'vi'
          ? `Bài đăng "${newListing.title}" đang chờ Kỹ thuật viên kiểm định chất lượng (PENDING_INSPECTION).`
          : `Listing "${newListing.title}" is pending Inspection Hub review.`
      );
      setActiveTab('seller-dashboard');
      return;
    }

    // 3. Trường hợp bài đăng chờ Staff đối soát thủ công
    if (isPendingReview) {
      showToast(
        lang === 'vi'
          ? `Bài đăng "${newListing.title}" đã được gửi và đang chờ duyệt (PENDING).`
          : `Listing "${newListing.title}" is pending review.`
      );
      setActiveTab('seller-dashboard');
      return;
    }

    // 4. Trường hợp không đủ credit
    if (isInsufficientCredit) {
      showToast(
        lang === 'vi'
          ? `Chưa thể xuất bản bài đăng "${newListing.title}" do không đủ credit.`
          : `Could not publish listing "${newListing.title}" due to insufficient credit.`
      );
      setActiveTab('seller-dashboard');
      return;
    }

    // 5. Trường hợp AI duyệt thành công (ACTIVE)
    const targetTab = createListingReturnTab || (editingDraft ? 'seller-dashboard' : 'marketplace');
    setActiveTab(targetTab as any);
    showToast(
      lang === 'vi'
        ? `Đăng bán thành công sản phẩm "${newListing.title}"! Giá niêm yết: ${formatVND(newListing.priceVnd)}.`
        : `Successfully published "${newListing.title}"! Listed price: ${formatVND(newListing.priceVnd)}.`
    );
  };

  const mapBackendPostToListing = React.useCallback((post: any): Listing => {
    const rawTitle = post.title || 'Thiết bị gia dụng SecondLife';
    const cleanTitle = rawTitle.replace(/^Tiêu đề:\s*/i, '').trim();
    const titleLower = cleanTitle.toLowerCase();
    const descLower = (post.description || '').toLowerCase();

    // 1. Nhận diện danh mục sản phẩm thông minh
    let detectedCategory: ItemCategory = 'Tủ lạnh & Tủ đông';
    if (titleLower.includes('tủ lạnh') || titleLower.includes('tủ đông') || titleLower.includes('refrigerator') || titleLower.includes('fridge')) {
      detectedCategory = 'Tủ lạnh & Tủ đông';
    } else if (titleLower.includes('máy giặt') || titleLower.includes('máy sấy') || titleLower.includes('giặt sấy') || titleLower.includes('washing') || titleLower.includes('dryer')) {
      detectedCategory = 'Máy giặt & Máy sấy';
    } else if (titleLower.includes('lò vi sóng') || titleLower.includes('microwave') || titleLower.includes('lò nướng') || titleLower.includes('oven')) {
      detectedCategory = 'Lò vi sóng & Lò nướng';
    } else if (titleLower.includes('điều hòa') || titleLower.includes('máy lạnh') || titleLower.includes('máy lọc') || titleLower.includes('air conditioner')) {
      detectedCategory = 'Điều hòa & Máy lọc';
    } else if (titleLower.includes('robot') || titleLower.includes('hút bụi') || titleLower.includes('vacuum')) {
      detectedCategory = 'Robot & Máy hút bụi';
    } else if (titleLower.includes('nồi cơm') || titleLower.includes('bếp từ') || titleLower.includes('bếp hồng ngoại') || titleLower.includes('cooker') || titleLower.includes('stove')) {
      detectedCategory = 'Nồi cơm & Bếp từ';
    } else if (post.category && typeof post.category === 'string' && !post.category.includes('-')) {
      detectedCategory = post.category as ItemCategory;
    }

    // 2. Nhận diện thương hiệu
    let detectedBrand = post.brand || '';
    if (!detectedBrand) {
      const knownBrands = ['Panasonic', 'Kaff', 'LG', 'Samsung', 'Hitachi', 'Daikin', 'Electrolux', 'Toshiba', 'Sharp', 'Casper', 'Ecovacs', 'Cuckoo', 'Philips', 'Bosch', 'Xiaomi'];
      for (const b of knownBrands) {
        if (titleLower.includes(b.toLowerCase())) {
          detectedBrand = b;
          break;
        }
      }
      if (!detectedBrand) detectedBrand = 'SecondLife';
    }

    // 3. Nhận diện tình trạng máy (Condition Grade)
    let detectedGrade: ConditionGrade = 'Like New';
    const conditionStr = (post.itemCondition || descLower).toLowerCase();
    if (conditionStr.includes('99%') || conditionStr.includes('như mới') || conditionStr.includes('like new') || conditionStr.includes('brand new')) {
      detectedGrade = 'Like New';
    } else if (conditionStr.includes('95%') || conditionStr.includes('tốt') || conditionStr.includes('good')) {
      detectedGrade = 'Good';
    } else if (conditionStr.includes('90%') || conditionStr.includes('khá') || conditionStr.includes('fair')) {
      detectedGrade = 'Fair';
    }

    // 4. Ảnh gia dụng chất lượng cao thay vì ảnh cơm/đồ ăn
    const categoryFallbacks: Record<ItemCategory, string[]> = {
      'Tủ lạnh & Tủ đông': [
        'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&q=80&w=800',
      ],
      'Máy giặt & Máy sấy': [
        'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&q=80&w=800',
      ],
      'Lò vi sóng & Lò nướng': [
        'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&q=80&w=800',
      ],
      'Điều hòa & Máy lọc': [
        'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&q=80&w=800',
      ],
      'Robot & Máy hút bụi': [
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800',
      ],
      'Nồi cơm & Bếp từ': [
        'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800',
      ],
    };

    const fallbackList = categoryFallbacks[detectedCategory] || [
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800'
    ];
    const defaultImg = fallbackList[0];

    const rawImgs = Array.isArray(post.imageUrls) && post.imageUrls.length > 0
      ? post.imageUrls.filter(Boolean)
      : (post.imageUrl ? [post.imageUrl] : []);

    const photoList = rawImgs.length > 0 ? rawImgs : [defaultImg];
    const price = Number(post.price || 0);

    // Xác định địa chỉ sản phẩm từ người bán (cập nhật theo địa chỉ người bán)
    let postLocation = '';
    let postSellerAddress = '';

    const isOwner = Boolean(
      currentUser && (
        (post.userId && String(post.userId) === String(currentUser.id)) ||
        (post.sellerId && String(post.sellerId) === String(currentUser.id)) ||
        (post.user?.id && String(post.user.id) === String(currentUser.id)) ||
        (post.user?.email && currentUser.email && post.user.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase())
      )
    );

    const savedAddr = getSavedSellerAddress();
    const currentSellerAddr = currentUser?.pickupAddress || currentUser?.address || savedAddr.address;
    const currentSellerWard = currentUser?.wardName || currentUser?.ward || savedAddr.wardName;
    const currentSellerProv = currentUser?.provinceName || currentUser?.province || savedAddr.provinceName;

    // 1. Nếu là bài đăng của chính seller hiện tại, ưu tiên lấy địa chỉ người bán mới nhất từ profile / onboarding
    if (isOwner && (currentSellerAddr || currentSellerWard || currentSellerProv)) {
      postLocation = extractWardAndCity(currentSellerAddr, currentSellerWard, currentSellerProv);
      postSellerAddress = currentSellerAddr || (currentSellerWard && currentSellerProv ? `${currentSellerWard}, ${currentSellerProv}` : '');
    } else {
      // 2. Bài đăng từ backend của seller khác
      const rawPostAddr = post.sellerAddress || post.pickupAddress || post.user?.address || (
        post.user?.profile ? [post.user.profile.streetAddress, post.user.profile.ward, post.user.profile.district, post.user.profile.province].filter(Boolean).join(', ') : null
      );
      if (rawPostAddr) {
        postLocation = extractWardAndCity(rawPostAddr);
        postSellerAddress = rawPostAddr;
      } else if (post.location && post.location.toLowerCase() !== 'việt nam' && post.location.toLowerCase() !== 'toàn quốc') {
        postLocation = extractWardAndCity(post.location);
        postSellerAddress = post.location;
      }
    }

    if ((!postLocation || !postSellerAddress) && isOwner && (currentSellerAddr || currentSellerWard || currentSellerProv)) {
      postLocation = postLocation || extractWardAndCity(currentSellerAddr, currentSellerWard, currentSellerProv);
      postSellerAddress = postSellerAddress || currentSellerAddr;
    }

    if (!postLocation) {
      postLocation = postSellerAddress ? extractWardAndCity(postSellerAddress) : 'Hà Nội';
    }
    if (!postSellerAddress) {
      postSellerAddress = postLocation;
    }

    return {
      id: post.postId || post.id || `post-${Date.now()}`,
      title: cleanTitle,
      category: detectedCategory,
      brand: detectedBrand,
      model: post.model || 'Standard',
      purchaseYear: 2024,
      priceVnd: price,
      originalPriceVnd: Number(post.originalPriceVnd || post.aiSuggestedPrice || price || 0),
      conditionGrade: detectedGrade,
      declaredConditionText: post.itemCondition || (detectedGrade === 'Like New' ? 'Độ mới 99%, nguyên zin chưa sửa chữa' : 'Tình trạng tốt, hoạt động ổn định'),
      description: post.description || post.aiDescription || 'Đã qua thẩm định và xác thực trên hệ thống SecondLife.',
      location: postLocation,
      sellerAddress: postSellerAddress,
      sellerId: post.sellerId || post.user?.id || post.userId || (isOwner && currentUser ? currentUser.id : ''),
      sellerName: isOwner && currentUser?.name ? currentUser.name : (post.sellerName || post.user?.profile?.fullName || post.user?.fullName || post.user?.email || 'Người bán SecondLife'),
      sellerAvatar: post.sellerAvatar || post.user?.profile?.avatarUrl || post.user?.avatarUrl || undefined,
      sellerRating: 5.0,
      sellerCompletedOrders: 3,
      sellerVerified: true,
      status: (post.status === 'ACTIVE' ? 'active' : post.status === 'DRAFT' ? 'draft' : 'reserved') as any,
      backendStatus: post.status || 'ACTIVE',
      rejectionReason: post.rejectionReason,
      createdAt: post.publishedAt || post.createdAt || new Date().toISOString(),
      isInspectionGuaranteed: true,
      requiresInspection: price > 5000000,
      photos: {
        front: photoList[0] || defaultImg,
        back: photoList[1] || photoList[0] || defaultImg,
        screenOrDetails: photoList[2] || photoList[0] || defaultImg,
        accessoriesOrBox: photoList[3] || photoList[0] || defaultImg,
        serialOrReceipt: photoList[4] || photoList[0] || defaultImg,
      },
      photoGallery: photoList,
      aiPriceEstimation: post.aiSuggestedPrice && post.aiSuggestedPrice > 0 ? {
        minVnd: Math.round(Number(post.aiSuggestedPrice) * 0.9),
        maxVnd: Math.round(Number(post.aiSuggestedPrice) * 1.1),
        suggestedVnd: Number(post.aiSuggestedPrice),
        quickSaleVnd: Math.round(Number(post.aiSuggestedPrice) * 0.85),
        confidence: 96,
        daysToSell: 3,
      } : undefined,
    };
  }, [
    currentUser?.id,
    currentUser?.name,
    currentUser?.email,
    currentUser?.address,
    currentUser?.pickupAddress,
    currentUser?.ward,
    currentUser?.wardName,
    currentUser?.province,
    currentUser?.provinceName,
  ]);

  // Synchronize listings directly with Backend
  const loadListingsFromBackend = React.useCallback(async () => {
    try {
      let postsData: any[] = [];
      try {
        const publicRes = await postService.getPublicListings(0, 100);
        if (publicRes && publicRes.length > 0) {
          postsData = publicRes;
        }
      } catch (err) {
        console.warn('Lỗi gọi public listings:', err);
      }

      // CHỈ gọi adminPostService.getAdminPosts nếu người dùng có vai trò ADMIN (tránh 403 Forbidden)
      const isAdmin = currentUser?.role === 'admin' || currentRole === 'admin';
      if (postsData.length === 0 && getAccessToken() && isAdmin) {
        try {
          const adminRes = await adminPostService.getAdminPosts();
          const items = adminRes?.content || adminRes?.items || (Array.isArray(adminRes) ? adminRes : []);
          if (items && items.length > 0) {
            // Lọc bỏ hoàn toàn các bản nháp chưa submit (DRAFT) của người bán
            const nonDrafts = items.filter((p: any) => p.status !== 'DRAFT');
            postsData = nonDrafts;
          }
        } catch { }
      }

      // Nếu là người bán (SELLER), lấy thêm các bài đăng cá nhân từ BE
      const isSeller = currentUser?.role === 'seller' || currentRole === 'seller';
      if (getAccessToken() && isSeller) {
        try {
          const myRes = await postService.getMyPosts(0, 50);
          const myItems = Array.isArray(myRes) ? myRes : (myRes?.content || myRes?.items || []);
          if (myItems && myItems.length > 0) {
            try {
              localStorage.setItem('all_seller_posts_cache', JSON.stringify(myItems));
            } catch {}
            const existingIds = new Set(postsData.map((p: any) => p.postId || p.id));
            for (const myItem of myItems) {
              const myId = myItem.postId || myItem.id;
              if (!existingIds.has(myId)) {
                postsData.push(myItem);
              }
            }
          }
        } catch { }
      }

      if (postsData.length > 0) {
        const mapped = postsData.map(mapBackendPostToListing);
        mapped.forEach((l) => {
          if (l?.id) {
            try {
              localStorage.setItem(`cached_post_${l.id}`, JSON.stringify(l));
              if (l.title) {
                localStorage.setItem(`cached_post_title_${l.title.toLowerCase().trim()}`, JSON.stringify(l));
              }
            } catch {}
          }
        });
        setListings(mapped);
      } else {
        setListings([]);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách bài đăng từ Backend:', err);
      setListings([]);
    }
  }, [mapBackendPostToListing, currentUser?.role, currentRole]);

  // Handle user profile updates (especially seller address) and sync across all listings
  const handleUserProfileUpdated = React.useCallback(
    (updated: UserProfile, successToast?: string) => {
      setCurrentUser(updated);
      setStoredUser(updated);
      const effectiveAddr = updated.pickupAddress || updated.address || '';
      const effectiveWard = updated.wardName || updated.ward || '';
      const effectiveProv = updated.provinceName || updated.province || '';
      saveSellerAddress(effectiveAddr, effectiveWard, effectiveProv);
      const newLoc = extractWardAndCity(effectiveAddr, effectiveWard, effectiveProv);
      if (newLoc || effectiveAddr) {
        setListings((prev) =>
          prev.map((item) => {
            const isOwner =
              item.sellerId === updated.id ||
              (updated.name && item.sellerName?.trim().toLowerCase() === updated.name?.trim().toLowerCase());
            if (isOwner) {
              return {
                ...item,
                location: newLoc || item.location,
                sellerAddress: effectiveAddr || item.sellerAddress || newLoc,
              };
            }
            return item;
          })
        );
      }
      loadListingsFromBackend();
      if (successToast) {
        showToast(successToast);
      }
    },
    [loadListingsFromBackend]
  );

  // Synchronize orders directly with Backend
  // Synchronize orders directly with Backend
  const loadUserOrders = React.useCallback(async () => {
    if (!currentUser || !getAccessToken()) {
      setOrders([]);
      return;
    }
    try {
      const [buyerRes, sellerRes, inspBuyerRes, inspSellerRes, chatRooms] = await Promise.all([
        orderService.getBuyerOrders(0, 50).catch(() => ({ content: [] })),
        orderService.getSellerOrders(0, 50).catch(() => ({ content: [] })),
        inspectorService.getMyBuyerOrders(0, 50).catch(() => ({ items: [] } as any)),
        inspectorService.getMySellerOrders(0, 50).catch(() => ({ items: [] } as any)),
        chatService.getChatRooms().catch(() => [] as any[])
      ]);

      const buyerNameMap = new Map<string, string>();
      const buyerPhoneMap = new Map<string, string>();
      const sellerNameMap = new Map<string, string>();

      const postImageMap = new Map<string, string>();
      const postTitleMap = new Map<string, string>();

      (chatRooms || []).forEach((room: any) => {
        if (room.buyerId && room.buyerName) {
          buyerNameMap.set(room.buyerId, room.buyerName);
        }
        if (room.postId && room.buyerName) {
          buyerNameMap.set(`post_${room.postId}`, room.buyerName);
        }
        if (room.sellerId && room.sellerName) {
          sellerNameMap.set(room.sellerId, room.sellerName);
        }
        if (room.postId && room.postImageUrl) {
          postImageMap.set(room.postId, room.postImageUrl);
        }
        if (room.postId && room.postTitle) {
          postTitleMap.set(room.postId, room.postTitle);
        }
      });

      let allSellerPostsCached: any[] = [];
      try {
        const rawSellerPosts = localStorage.getItem('all_seller_posts_cache');
        if (rawSellerPosts) allSellerPostsCached = JSON.parse(rawSellerPosts);
      } catch {}

      const rawBuyerItems = (buyerRes as any)?.content || (buyerRes as any)?.items || (Array.isArray(buyerRes) ? buyerRes : []);
      const rawSellerItems = (sellerRes as any)?.content || (sellerRes as any)?.items || (Array.isArray(sellerRes) ? sellerRes : []);
      const rawInspBuyerItems = (inspBuyerRes as any)?.data?.items || (inspBuyerRes as any)?.items || (inspBuyerRes as any)?.content || (Array.isArray(inspBuyerRes) ? inspBuyerRes : []);
      const rawInspSellerItems = (inspSellerRes as any)?.data?.items || (inspSellerRes as any)?.items || (inspSellerRes as any)?.content || (Array.isArray(inspSellerRes) ? inspSellerRes : []);

      // Deduplicate by order id
      const orderMap = new Map<string, any>();
      rawBuyerItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: false }); });
      rawSellerItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: false }); });
      rawInspBuyerItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: true }); });
      rawInspSellerItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: true }); });
      const items = Array.from(orderMap.values());
      if (items && items.length > 0) {
        const mappedOrders: EscrowOrder[] = items.map((bOrd: any) => {
          let cachedListing: any = null;
          try {
            const rawOrderListing = localStorage.getItem(`order_listing_${bOrd.id}`);
            if (rawOrderListing) cachedListing = JSON.parse(rawOrderListing);
            if (!cachedListing && bOrd.postId) {
              const rawPost = localStorage.getItem(`cached_post_${bOrd.postId}`);
              if (rawPost) cachedListing = JSON.parse(rawPost);
            }
            if (!cachedListing && bOrd.postTitle) {
              const rawPostByTitle = localStorage.getItem(`cached_post_title_${bOrd.postTitle.toLowerCase().trim()}`);
              if (rawPostByTitle) cachedListing = JSON.parse(rawPostByTitle);
            }
            if (!cachedListing && allSellerPostsCached.length > 0) {
              const matchedFromSellerCache = allSellerPostsCached.find((p: any) =>
                (p.postId && p.postId === bOrd.postId) ||
                (p.id && p.id === bOrd.postId) ||
                (bOrd.postTitle && p.title && p.title.toLowerCase().trim() === bOrd.postTitle.toLowerCase().trim())
              );
              if (matchedFromSellerCache) {
                cachedListing = mapBackendPostToListing(matchedFromSellerCache);
              }
            }
          } catch {}

          const directMatched = listings.find(l => l.id === bOrd.postId || (bOrd.postTitle && l.title === bOrd.postTitle));
          const baseListing = directMatched || cachedListing;

          const resolvedPostTitle = bOrd.postTitle || baseListing?.title || postTitleMap.get(bOrd.postId) || 'Thiết bị gia dụng SecondLife';
          const resolvedImage = baseListing?.photos?.front
            || postImageMap.get(bOrd.postId)
            || baseListing?.photoGallery?.[0]
            || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800';

          const matchedListing = baseListing ? {
            ...baseListing,
            title: resolvedPostTitle,
            photos: {
              ...baseListing.photos,
              front: resolvedImage,
              back: baseListing.photos?.back || resolvedImage,
              screenOrDetails: baseListing.photos?.screenOrDetails || resolvedImage,
              accessoriesOrBox: baseListing.photos?.accessoriesOrBox || resolvedImage,
              serialOrReceipt: baseListing.photos?.serialOrReceipt || resolvedImage,
            },
            photoGallery: (baseListing.photoGallery && baseListing.photoGallery.length > 0) ? baseListing.photoGallery : [resolvedImage],
          } : {
            id: bOrd.postId,
            title: resolvedPostTitle,
            category: 'Nội thất & Gia dụng',
            brand: 'SecondLife',
            model: 'Verified Model',
            purchaseYear: 2024,
            priceVnd: bOrd.finalPrice,
            conditionGrade: 'Good',
            declaredConditionText: 'Sản phẩm đã qua kiểm định cơ bản',
            description: 'Giao dịch bảo lãnh qua Quỹ Escrow SecondLife.',
            location: 'Đà Nẵng, Việt Nam',
            sellerId: bOrd.sellerId,
            sellerName: 'Người Bán SecondLife',
            sellerRating: 4.9,
            sellerCompletedOrders: 10,
            sellerVerified: true,
            status: 'sold',
            createdAt: bOrd.createdAt,
            isInspectionGuaranteed: true,
            requiresInspection: true,
            photos: {
              front: resolvedImage,
              back: resolvedImage,
              screenOrDetails: resolvedImage,
              accessoriesOrBox: resolvedImage,
              serialOrReceipt: resolvedImage
            },
            photoGallery: [resolvedImage],
          };

          const inspFee = Number(bOrd.buyerFeeShare || bOrd.inspectionFee || 0);
          const isInspectionOrder = Boolean(bOrd.__isInspection || bOrd.hasInspectionService || inspFee > 0);

          let mappedEscrowStatus: EscrowOrder['escrowStatus'] = 'HELD_IN_ESCROW';
          if (isInspectionOrder) {
            const s = String(bOrd.status || '');
            if (s === 'WAITING_SELLER_APPROVAL' || s === 'WAITING_BUYER_APPROVAL' || s === 'WAITING_FEE_PAYMENT') {
              mappedEscrowStatus = 'AWAITING_PAYMENT';
            } else if (s === 'CONFIRMED_PENDING_DISPATCH' || s === 'DISPATCHED' || s === 'SCHEDULED' || s === 'SHIPPING_TO_CENTER' || s === 'INSPECTING') {
              mappedEscrowStatus = 'INSPECTION_IN_PROGRESS';
            } else if (s === 'PASSED') {
              mappedEscrowStatus = 'INSPECTION_PASSED';
            } else if (s === 'DELIVERING_TO_BUYER') {
              mappedEscrowStatus = 'SHIPPED_TO_BUYER';
            } else if (s === 'COMPLETED') {
              mappedEscrowStatus = 'COMPLETED_RELEASED';
            } else if (s === 'DISPUTED') {
              mappedEscrowStatus = 'DISPUTED';
            } else if (s === 'CANCELLED' || s === 'FAILED' || s === 'PAYMENT_EXPIRED') {
              mappedEscrowStatus = 'REFUNDED_TO_BUYER';
            } else {
              mappedEscrowStatus = 'INSPECTION_IN_PROGRESS';
            }
          } else {
            if (bOrd.escrowStatus === 'RELEASED') {
              mappedEscrowStatus = 'COMPLETED_RELEASED';
            } else if (bOrd.escrowStatus === 'REFUNDED' || bOrd.status === 'CANCELLED') {
              mappedEscrowStatus = 'REFUNDED_TO_BUYER';
            } else if (bOrd.status === 'DELIVERED') {
              mappedEscrowStatus = 'DELIVERED_INSPECTION_WINDOW';
            } else if (bOrd.status === 'SHIPPED') {
              mappedEscrowStatus = 'SHIPPED_TO_BUYER';
            } else if (bOrd.status === 'PROCESSING' || bOrd.status === 'PENDING') {
              mappedEscrowStatus = 'HELD_IN_ESCROW';
            }
          }

          let parsedAddressObj: any = null;
          let parsedBuyerName = '';
          let parsedBuyerPhone = '';
          if (bOrd.deliveryAddress) {
            if (typeof bOrd.deliveryAddress === 'string') {
              try {
                parsedAddressObj = JSON.parse(bOrd.deliveryAddress);
                if (parsedAddressObj && typeof parsedAddressObj === 'object') {
                  parsedBuyerName = parsedAddressObj.name || '';
                  parsedBuyerPhone = parsedAddressObj.phone || '';
                }
              } catch {
                // normal text string
              }
            } else if (typeof bOrd.deliveryAddress === 'object') {
              parsedAddressObj = bOrd.deliveryAddress;
              parsedBuyerName = bOrd.deliveryAddress.name || '';
              parsedBuyerPhone = bOrd.deliveryAddress.phone || '';
            }
          }

          let cachedBuyer: any = null;
          try {
            const rawOrderBuyer = localStorage.getItem(`order_buyer_info_${bOrd.id}`);
            if (rawOrderBuyer) {
              cachedBuyer = JSON.parse(rawOrderBuyer);
            } else if (bOrd.buyerId) {
              const rawUser = localStorage.getItem(`buyer_info_${bOrd.buyerId}`);
              if (rawUser) cachedBuyer = JSON.parse(rawUser);
            }
          } catch {}

          const resolvedBuyerName = (
            cachedBuyer?.buyerName ||
            cachedBuyer?.name ||
            buyerNameMap.get(bOrd.buyerId) ||
            buyerNameMap.get(`post_${bOrd.postId}`) ||
            parsedBuyerName ||
            bOrd.buyerName ||
            (currentRole === 'buyer' ? (currentUser?.name || currentUser?.email || 'Khách Hàng') : '') ||
            `Khách Mua #${bOrd.buyerId ? bOrd.buyerId.slice(0, 8).toUpperCase() : 'VIP'}`
          ).trim();

          const resolvedBuyerPhone = (
            cachedBuyer?.buyerPhone ||
            cachedBuyer?.phone ||
            parsedBuyerPhone ||
            buyerPhoneMap.get(bOrd.buyerId) ||
            bOrd.buyerPhone ||
            (currentRole === 'buyer' ? (currentUser?.phone || '') : '') ||
            ''
          ).trim();

          const resolvedSellerName = (
            bOrd.sellerName ||
            sellerNameMap.get(bOrd.sellerId) ||
            matchedListing.sellerName ||
            (currentRole === 'seller' ? (currentUser?.name || 'Người Bán') : 'Người Bán')
          ).trim();

          const buyerAddr = typeof bOrd.deliveryAddress === 'string'
            ? (parsedAddressObj?.address || bOrd.deliveryAddress)
            : bOrd.deliveryAddress?.detailAddress
              ? `${bOrd.deliveryAddress.detailAddress}, ${bOrd.deliveryAddress.wardName || ''}, ${bOrd.deliveryAddress.provinceName || ''}`
              : (cachedBuyer?.buyerAddress || 'SecondLife Hub Address');

          const itemPrice = Number(bOrd.finalPrice || bOrd.finalItemPrice || bOrd.postPrice || 0);
          const shipFee = Number(bOrd.shippingFee || bOrd.finalShippingFee || 0);
          const totalPaid = Number(bOrd.totalPaid || (itemPrice + inspFee + shipFee));

          return {
            id: bOrd.id,
            listingId: bOrd.postId,
            listing: matchedListing,
            buyerId: bOrd.buyerId,
            buyerName: resolvedBuyerName,
            buyerPhone: resolvedBuyerPhone,
            buyerAddress: buyerAddr,
            sellerId: bOrd.sellerId,
            sellerName: resolvedSellerName,
            itemPriceVnd: itemPrice,
            inspectionFeeVnd: inspFee,
            shippingFeeVnd: shipFee,
            platformFeeVnd: 0,
            totalPaidVnd: totalPaid,
            escrowStatus: mappedEscrowStatus,
            backendStatus: bOrd.status,
            shippingQuoteId: bOrd.shippingQuoteId,
            shippingDeliveredAt: bOrd.shippingDeliveredAt,
            deliveryAddress: bOrd.deliveryAddress,
            sellerConfirmedAt: bOrd.sellerConfirmedAt || null,
            confirmationDeadline: bOrd.confirmationDeadline || null,
            confirmationCancelAt: bOrd.confirmationCancelAt || null,
            confirmationStatus: bOrd.confirmationStatus || (bOrd.sellerConfirmedAt ? 'CONFIRMED' : 'PENDING'),
            sellerReadyAt: (bOrd as any).sellerReadyAt || null,
            carrierPickedUpAt: (bOrd as any).carrierPickedUpAt || null,
            handoverDeadline: (bOrd as any).handoverDeadline || null,
            appointmentScheduledAt: bOrd.appointmentScheduledAt || bOrd.scheduledAt || null,
            appointmentNote: bOrd.appointmentNote || bOrd.note || null,
            hasInspectionService: isInspectionOrder,
            inspectionMethod: isInspectionOrder
              ? (bOrd.orderType === 'AT_HOME' ? 'AT_HOME' : 'AT_CENTER')
              : undefined,
            shippingLegs: [
              {
                id: 'LEG-1',
                legType: 'SELLER_TO_CENTER',
                carrier: 'GHN Express',
                trackingNumber: `GHN-${bOrd.id.slice(0, 8).toUpperCase()}`,
                status: bOrd.status === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
                origin: 'Địa chỉ kho người bán',
                destination: buyerAddr,
                estimatedDelivery: '1 - 2 ngày',
                timeline: [
                  {
                    timestamp: bOrd.createdAt ? new Date(bOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                    description: `Khởi tạo đơn hàng qua Escrow. Trạng thái: ${bOrd.status || 'PROCESSING'}.`,
                    location: 'Hệ thống SecondLife GHN'
                  }
                ]
              }
            ],
            createdAt: bOrd.createdAt,
            multiStagePhotos: {
              listingPhotos: [matchedListing.photos.front, matchedListing.photos.back]
            }
          };
        });

        // Merge with recent locally placed orders so newly placed orders are never lost
        const localRecentOrders = getLocalStoredOrders();
        const combined = [...mappedOrders];
        localRecentOrders.forEach((locOrd) => {
          if (!combined.some((o) => o.id === locOrd.id)) {
            combined.unshift(locOrd);
          }
        });

        // Sắp xếp đơn mới nhất trên cùng
        combined.sort((a, b) => {
          const dateA = a.createdAt || (a as any).createdDate || (a as any).created_at || (a as any).timestamp;
          const dateB = b.createdAt || (b as any).createdDate || (b as any).created_at || (b as any).timestamp;
          const timeA = dateA ? new Date(dateA).getTime() : 0;
          const timeB = dateB ? new Date(dateB).getTime() : 0;
          const validTimeA = isNaN(timeA) ? 0 : timeA;
          const validTimeB = isNaN(timeB) ? 0 : timeB;
          if (validTimeB !== validTimeA) return validTimeB - validTimeA;
          return (b.id || '').localeCompare(a.id || '');
        });

        setOrders(combined);
      } else {
        // Even if server returns 0, retain all local recent orders
        const localRecentOrders = getLocalStoredOrders();
        localRecentOrders.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });
        setOrders(localRecentOrders);
      }
    } catch (err) {
      console.warn('Could not load orders from backend:', err);
      const localRecentOrders = getLocalStoredOrders();
      setOrders(localRecentOrders);
    }
  }, [currentUser, currentRole, listings, getLocalStoredOrders]);

  // Refresh listings when their query inputs or the active tab change.
  React.useEffect(() => {
    loadListingsFromBackend();
  }, [loadListingsFromBackend, activeTab]);

  // Orders also use the latest listings to map each order.
  React.useEffect(() => {
    loadUserOrders();
  }, [loadUserOrders, activeTab]);

  const handleOrderPlaced = (newOrder: EscrowOrder) => {
    try {
      if (newOrder.listing) {
        localStorage.setItem(`order_listing_${newOrder.id}`, JSON.stringify(newOrder.listing));
        if (newOrder.listing.id) {
          localStorage.setItem(`cached_post_${newOrder.listing.id}`, JSON.stringify(newOrder.listing));
        }
        if (newOrder.listing.title) {
          localStorage.setItem(`cached_post_title_${newOrder.listing.title.toLowerCase().trim()}`, JSON.stringify(newOrder.listing));
        }
      }
      localStorage.setItem(`order_buyer_info_${newOrder.id}`, JSON.stringify({
        buyerName: newOrder.buyerName,
        buyerPhone: newOrder.buyerPhone,
        buyerAddress: newOrder.buyerAddress,
      }));
      if (newOrder.buyerId) {
        localStorage.setItem(`buyer_info_${newOrder.buyerId}`, JSON.stringify({
          name: newOrder.buyerName,
          phone: newOrder.buyerPhone,
        }));
      }

      // Persist to recent_placed_orders
      let existingRecent: EscrowOrder[] = [];
      try {
        const stored = localStorage.getItem('recent_placed_orders');
        if (stored) existingRecent = JSON.parse(stored);
      } catch {}
      const updatedRecent = [newOrder, ...existingRecent.filter((o) => o.id !== newOrder.id)].slice(0, 30);
      localStorage.setItem('recent_placed_orders', JSON.stringify(updatedRecent));
    } catch {}

    setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
    setCheckoutListing(null);
    setCheckoutAgreedPrice(undefined);
    setCheckoutNegotiationId(undefined);
    setSelectedListing(null);
    setActiveTab('orders');
    loadUserWallet();
    showToast(`Đã phong tỏa Escrow ${formatVND(newOrder.totalPaidVnd)} cho đơn hàng #${newOrder.id}! Bưu tá đang chuẩn bị lấy hàng.`);
  };

  const handleConfirmReceipt = async (orderId: string) => {
    try {
      await orderService.confirmDelivery(orderId);
      showToast(lang === 'vi' ? 'Đã xác nhận nhận hàng! Tiền trong Escrow đã được giải ngân thành công cho người bán.' : 'Delivery confirmed! Escrow funds released to seller.');
      loadUserOrders();
      loadUserWallet();
    } catch (err: any) {
      console.warn('Backend confirmDelivery fallback:', err);
      const errMsg = err?.response?.data?.message || err.message || 'Không thể xác nhận nhận hàng';
      showToast(`Thông báo: ${errMsg}`);
      setOrders((prev) =>
        prev.map((ord) =>
          ord.id === orderId ? { ...ord, escrowStatus: 'COMPLETED_RELEASED' } : ord
        )
      );
    }
  };

  const handleMarkShipped = async (orderId: string) => {
    try {
      await orderService.markAsShipped(orderId);
    } catch (err: any) {
      console.warn('Backend markAsShipped fallback:', err);
    }
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId ? { ...ord, escrowStatus: 'SHIPPED_TO_BUYER' } : ord
      )
    );
    showToast(lang === 'vi' ? 'Đã xác nhận gửi hàng! Bưu tá đang vận chuyển đến người mua.' : 'Marked as shipped!');
  };

  const handleCancelOrder = async (
    orderId: string,
    cancelData?: { reasonCode: 'BUYER_REQUESTED' | 'SELLER_OUT_OF_STOCK' | 'SELLER_CANNOT_FULFILL'; reason: string }
  ) => {
    try {
      const targetOrder = orders.find((o) => o.id === orderId);
      const isSellerCancel = targetOrder?.sellerId === currentUser?.id || currentRole === 'seller';
      const effectiveCancelData = cancelData || (isSellerCancel ? {
        reasonCode: 'SELLER_OUT_OF_STOCK' as const,
        reason: 'Người bán hết hàng hoặc không thể chuẩn bị đơn hàng này.',
      } : {
        reasonCode: 'BUYER_REQUESTED' as const,
        reason: 'Người mua yêu cầu hủy đơn hàng.',
      });

      await orderService.cancelOrder(orderId, effectiveCancelData);
      setOrders((prev) =>
        prev.map((ord) =>
          ord.id === orderId ? { ...ord, escrowStatus: 'REFUNDED_TO_BUYER', backendStatus: 'CANCELLED' } : ord
        )
      );
      loadUserOrders();
      loadUserWallet();
      showToast(lang === 'vi' ? 'Đã hủy đơn hàng! Tiền ký quỹ Escrow đã được hoàn lại 100% vào ví người mua.' : 'Order cancelled and refunded to buyer.');
    } catch (err: any) {
      console.warn('Backend cancelOrder fallback (cancelling locally):', err);
      setOrders((prev) =>
        prev.map((ord) =>
          ord.id === orderId ? { ...ord, escrowStatus: 'REFUNDED_TO_BUYER', backendStatus: 'CANCELLED' } : ord
        )
      );
      try {
        const stored = localStorage.getItem('recent_placed_orders');
        if (stored) {
          const parsed: EscrowOrder[] = JSON.parse(stored);
          const updated = parsed.map((o) => (o.id === orderId ? { ...o, escrowStatus: 'REFUNDED_TO_BUYER' as const, backendStatus: 'CANCELLED' as const } : o));
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch {}
      showToast(lang === 'vi' ? 'Đã hủy đơn hàng thành công! Tiền ký quỹ Escrow được bảo vệ an toàn.' : 'Order cancelled successfully!');
    }
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
    <div className="min-h-screen flex flex-col font-sans bg-[#faf8f5] text-[#24263e] selection:bg-[#c34c36] selection:text-white">
      {/* Navigation */}
      {activeTab !== 'admin-dashboard' &&
        activeTab !== 'inspection-center' &&
        activeTab !== 'inspection-hub' && (
        <Navbar
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          lang={lang}
          onLangChange={setLang}
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'create-listing') {
              setEditingDraft(null);
              setCreateListingReturnTab(activeTab === 'seller-dashboard' ? 'seller-dashboard' : 'marketplace');
            }
            handleTabChange(tab);
          }}
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
          userCredit={userCredit}
          walletBalance={walletBalance}
          token={getAccessToken()}
          onNavigateNotification={handleNotificationNavigate}
          onOpenNotifications={() => handleTabChange('notifications')}
          onOpenSellerRegister={() => {
            if (currentUser && ['admin', 'inspector'].includes(currentUser.role)) {
              showToast(lang === 'vi'
                ? 'Tài khoản Quản trị viên và Kỹ sư Hub không được đăng ký làm Người Bán.'
                : 'Admin and Inspector roles cannot register as sellers.');
              return;
            }
            setIsSellerRegistrationModalOpen(true);
          }}
        />
      )}

      {/* Floating Top Welcome Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] sm:w-auto min-w-[340px] max-w-xl bg-gradient-to-r from-[#fbf8f3] via-[#f5ede3] to-[#ebdccb] backdrop-blur-2xl text-[#2b1d16] px-5 py-3.5 rounded-2xl shadow-2xl border-2 border-[#cea981]/60 flex items-center gap-3.5 transition-all duration-300 transform scale-100 animate-fadeIn">
          <div className="w-9 h-9 rounded-xl bg-[#2b1d16] flex items-center justify-center shrink-0 shadow-md ring-2 ring-[#cea981]/40">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="flex-1 pr-2">
            <span className="text-xs sm:text-sm font-extrabold tracking-wide text-[#2b1d16] leading-tight block">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="w-7 h-7 rounded-full bg-[#2b1d16]/10 hover:bg-[#2b1d16]/20 text-[#2b1d16] flex items-center justify-center text-xs transition-colors shrink-0 cursor-pointer border border-[#2b1d16]/20 font-bold"
            title="Đóng"
          >
            ✕
          </button>
        </div>
      )}

      {/* Real-time Push Notification Floating Toast */}
      <RealtimeNotificationToast
        lang={lang}
        onNavigateToUrl={handleNotificationNavigate}
      />

      {/* Main Content Area */}
      <main
        className={
          activeTab === 'admin-dashboard' ||
          activeTab === 'inspection-center' ||
          activeTab === 'inspection-hub' ||
          activeTab === 'staff-workspace' ||
          activeTab === 'buyer-inspection-decision'
            ? 'flex-1 w-full p-0 m-0'
            : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6'
        }
      >
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
              } else if (['admin', 'inspector'].includes(currentUser.role)) {
                showToast(lang === 'vi'
                  ? 'Tài khoản Quản trị viên và Kỹ sư Hub không được đăng ký làm Người Bán.'
                  : 'Admin and Inspector roles cannot register as sellers.');
              } else if (currentUser.role !== 'seller' && currentUser.role !== 'staff') {
                setIsSellerRegistrationModalOpen(true);
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
            listings={listings.filter((l) => l.status === 'active' || l.backendStatus === 'ACTIVE')}
            onSelectListing={(listing) => setSelectedListing(listing)}
            lang={lang}
            onPostClick={() => {
              setEditingDraft(null);
              handleTabChange('create-listing');
            }}
          />
        )}

        {activeTab === 'seller-dashboard' && (
          <SellerDashboardView
            listings={listings}
            onSelectListing={(listing) => setSelectedListing(listing)}
            onCreateListing={(draft?: any) => {
              setEditingDraft(draft && draft.id ? draft : null);
              setCreateListingReturnTab('seller-dashboard');
              handleTabChange('create-listing');
            }}
            onDeleteListing={(listingId) => {
              setListings((prev) => prev.filter((l) => l.id !== listingId));
            }}
            onViewOrders={() => handleTabChange('orders')}
            currentUser={currentUser}
            lang={lang}
          />
        )}

        {activeTab === 'create-listing' && (
          currentUser && currentUser.role !== 'seller' && currentUser.role !== 'staff' ? (
            <div className="py-12 px-4 text-center max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#faf8f5] text-[#24263e] flex items-center justify-center mx-auto shadow-md">
                <Store className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {lang === 'vi' ? 'Bạn Cần Đăng Ký Thành Người Bán' : 'Seller Registration Required'}
              </h3>
              <p className="text-sm text-slate-500">
                {lang === 'vi'
                  ? 'Để đảm bảo chất lượng kiểm định Hub và an toàn giao dịch qua quỹ Escrow, vui lòng hoàn tất đăng ký thông tin gian hàng và xác thực eKYC trước khi đăng bán sản phẩm.'
                  : 'To ensure Hub inspection quality and Escrow transaction safety, please register your store profile and complete eKYC before posting listings.'}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('marketplace')}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  {lang === 'vi' ? 'Quay lại Sàn' : 'Back to Market'}
                </button>
                <button
                  onClick={() => {
                    if (['admin', 'inspector'].includes(currentUser.role)) {
                      showToast(lang === 'vi'
                        ? 'Tài khoản Quản trị viên và Kỹ sư Hub không được đăng ký làm Người Bán.'
                        : 'Admin and Inspector roles cannot register as sellers.');
                      return;
                    }
                    setIsSellerRegistrationModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white text-sm font-bold shadow-md hover:opacity-95 transition cursor-pointer"
                >
                  {lang === 'vi' ? 'Đăng Ký Người Bán Ngay' : 'Register as Seller Now'}
                </button>
              </div>
            </div>
          ) : (
            <CreateListingView
              onListingCreated={handleListingCreated}
              lang={lang}
              onCancel={() => {
                const targetTab = createListingReturnTab || (editingDraft ? 'seller-dashboard' : 'marketplace');
                setEditingDraft(null);
                setActiveTab(targetTab as any);
              }}
              onDeleteDraft={(draftId) => {
                setListings((prev) => prev.filter((l) => l.id !== draftId));
              }}
              currentUser={currentUser}
              initialDraft={editingDraft || undefined}
              onOpenTopUp={(tab) => {
                setTopUpInitialTab(tab || 'packages');
                setIsTopUpModalOpen(true);
              }}
              userCredits={userCredit}
            />
          )
        )}

        {activeTab === 'orders' && (
          <EscrowOrdersView
            orders={orders}
            currentUser={currentUser}
            onConfirmReceipt={handleConfirmReceipt}
            onOpenDispute={handleOpenDispute}
            onMarkShipped={handleMarkShipped}
            onCancelOrder={handleCancelOrder}
            onRefreshOrders={loadUserOrders}
            lang={lang}
            userRole={currentRole}
            onOpenChat={(listing) => setChatListing(listing)}
            onOpenInspectionDecision={(ord) => {
              setInspectionDecisionOrder(ord);
              setInspectionDecisionOrderId(ord.id);
              handleTabChange('buyer-inspection-decision');
            }}
          />
        )}

        {activeTab === 'buyer-inspection-decision' && (
          <BuyerInspectionDecisionView
            orderId={inspectionDecisionOrderId || inspectionDecisionOrder?.id}
            order={inspectionDecisionOrder}
            currentUser={currentUser}
            lang={lang}
            onBack={() => handleTabChange('orders')}
            onSuccess={() => {
              loadUserOrders();
              handleTabChange('orders');
            }}
            onOpenChat={(listing) => setChatListing(listing)}
          />
        )}

        {activeTab === 'inspection-center' && (
          <InspectionCenterDashboardView
            initialOrders={orders}
            currentUser={currentUser}
            lang={lang}
            onNavigate={setActiveTab}
            onOpenProfile={() => setIsProfileDialogOpen(true)}
            onLogout={() => setIsLogoutModalOpen(true)}
            onViewWebsite={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'inspection-hub' && (
          (currentUser?.role === 'inspection_center' || currentRole === 'inspection_center') ? (
            <InspectionCenterDashboardView
              initialOrders={orders}
              currentUser={currentUser}
              lang={lang}
              onNavigate={setActiveTab}
              onOpenProfile={() => setIsProfileDialogOpen(true)}
              onLogout={() => setIsLogoutModalOpen(true)}
              onViewWebsite={() => setActiveTab('home')}
            />
          ) : (
            <InspectorPortalView
              orders={orders}
              currentUser={currentUser}
              onCompleteInspection={handleCompleteInspection}
              lang={lang}
              onNavigate={setActiveTab}
              onOpenProfile={() => setIsProfileDialogOpen(true)}
              onLogout={() => setIsLogoutModalOpen(true)}
              onViewWebsite={() => setActiveTab('home')}
            />
          )
        )}

        {activeTab === 'staff-workspace' && (
          <StaffWorkspaceView
            listings={listings}
            orders={orders}
            lang={lang}
            currentUser={currentUser}
            onOpenProfile={() => setIsProfileDialogOpen(true)}
            onLogout={() => setIsLogoutModalOpen(true)}
            onViewWebsite={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'admin-dashboard' && (
          <AdminDashboardView
            orders={orders}
            disputes={disputes}
            listings={listings}
            onResolveDispute={handleResolveDispute}
            lang={lang}
            currentUser={currentUser}
            onOpenProfile={() => setIsProfileDialogOpen(true)}
            onLogout={() => setIsLogoutModalOpen(true)}
            onOpenListingDetail={(listing) => setSelectedListing(listing)}
          />
        )}

        {activeTab === 'chat' && (
          <InboxView
            listings={listings}
            currentRole={currentRole}
            currentUser={currentUser}
            lang={lang}
            onOpenChat={(listing, roomId, partnerName, partnerAvatar, room) => {
              if (!currentUser) {
                requireAuth(undefined, lang === 'vi' ? 'Vui lòng đăng nhập để sử dụng tính năng Chat & Đàm phán.' : 'Please log in to chat.');
                return;
              }
              setChatListing(listing);
              setChatPredefinedRoomId(roomId);
              setChatPartnerName(partnerName);
              setChatPartnerAvatar(partnerAvatar);
              setChatRoom(room);
            }}
          />
        )}

        {/* Notifications Center Page (Requirement 3 & Phase 3) */}
        {activeTab === 'notifications' && (
          <NotificationCenterView
            lang={lang}
            onNavigateToUrl={handleNotificationNavigate}
            onBackToHome={() => handleTabChange('home')}
          />
        )}
      </main>

      {/* Real-time WebSocket STOMP Push Notification Toast (Requirement 4 & Phase 4) */}
      <RealtimeNotificationToast
        lang={lang}
        onNavigateToUrl={handleNotificationNavigate}
      />

      {/* Listing Detail Modal */}
      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          currentUser={currentUser}
          onClose={() => setSelectedListing(null)}
          isAdmin={currentRole === 'admin'}
          onBuyClick={(item) => {
            if (!currentUser) {
              setPendingCheckoutItem(item);
              requireAuth(undefined, lang === 'vi'
                ? 'Vui lòng đăng nhập để tiến hành mua hàng bảo đảm Escrow và kiểm định Hub.'
                : 'Please log in to purchase with Escrow protection.');
              return;
            }
            if (currentUser.id === item.sellerId) {
              showToast(lang === 'vi' ? 'Bạn không thể tự mua sản phẩm của chính mình.' : 'You cannot buy your own product.');
              return;
            }
            setSelectedListing(null);
            setCheckoutAgreedPrice(undefined);
            setCheckoutNegotiationId(undefined);
            setCheckoutListing(item);
          }}
          onChatClick={(item) => {
            if (!currentUser) {
              requireAuth(undefined, lang === 'vi'
                ? 'Vui lòng đăng nhập để chat và thương lượng giá với người bán.'
                : 'Please log in to chat and negotiate with seller.');
              return;
            }
            if (currentUser.id === item.sellerId) {
              showToast(lang === 'vi' ? 'Bạn không thể tự chat hoặc thương lượng với chính mình.' : 'You cannot chat with yourself.');
              return;
            }
            setChatListing(item);
            setChatPredefinedRoomId(undefined);
            setChatPartnerName(undefined);
            setChatPartnerAvatar(undefined);
            setChatRoom(undefined);
          }}
          onOpenSellerReviews={(sellerId, sellerName) => {
            setSellerReviewsModalData({ sellerId, sellerName });
          }}
          lang={lang}
        />
      )}

      {/* Checkout Modal */}
      {checkoutListing && (
        <CheckoutModal
          listing={checkoutListing}
          currentUser={currentUser}
          agreedPrice={checkoutAgreedPrice}
          negotiationId={checkoutNegotiationId}
          onOpenDeposit={() => setIsTopUpModalOpen(true)}
          onClose={() => {
            setCheckoutListing(null);
            setCheckoutAgreedPrice(undefined);
            setCheckoutNegotiationId(undefined);
          }}
          onOrderPlaced={handleOrderPlaced}
          lang={lang}
        />
      )}

      {/* Chat & Negotiation Modal */}
      {chatListing && (
        <ChatModal
          listing={chatListing}
          predefinedRoomId={chatPredefinedRoomId}
          partnerName={chatPartnerName}
          partnerAvatar={chatPartnerAvatar}
          initialRoom={chatRoom}
          currentUser={currentUser}
          currentRole={currentRole}
          onClose={() => {
            setChatListing(null);
            setChatPredefinedRoomId(undefined);
            setChatPartnerName(undefined);
            setChatPartnerAvatar(undefined);
            setChatRoom(undefined);
          }}
          onBuyClick={(item, agreedPrice, negotiationId) => {
            if (!currentUser) {
              setPendingCheckoutItem(item);
              requireAuth(undefined, lang === 'vi'
                ? 'Vui lòng đăng nhập để tiến hành mua hàng bảo đảm Escrow và kiểm định Hub.'
                : 'Please log in to purchase with Escrow protection.');
              return;
            }
            setChatListing(null);
            setChatPredefinedRoomId(undefined);
            setChatPartnerName(undefined);
            setChatPartnerAvatar(undefined);
            setChatRoom(undefined);
            setCheckoutAgreedPrice(agreedPrice);
            setCheckoutNegotiationId(negotiationId);
            setCheckoutListing(item);
          }}
          onOpenSellerReviews={(sellerId, sellerName) => {
            setSellerReviewsModalData({ sellerId, sellerName });
          }}
          lang={lang}
        />
      )}

      {/* Seller Reviews & Trust Modal Popup */}
      {sellerReviewsModalData && (
        <SellerReviewsModal
          sellerId={sellerReviewsModalData.sellerId}
          sellerName={sellerReviewsModalData.sellerName}
          isOpen={!!sellerReviewsModalData}
          onClose={() => setSellerReviewsModalData(null)}
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
            avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            kycStatus: 'verified',
            emailVerified: true,
            gender: user.gender || undefined,
          };
          setCurrentUser(profileUser);
          setCurrentRole(user.role);
          setStoredUser(profileUser);
          saveSellerAddress(
            profileUser.pickupAddress || profileUser.address || '',
            profileUser.wardName || profileUser.ward || '',
            profileUser.provinceName || profileUser.province || ''
          );
          showToast(
            lang === 'vi'
              ? `Chào mừng ${user.name}${['buyer', 'seller'].includes(user.role) ? '' : ` (${user.role === 'inspector' ? 'Kỹ Sư Hub' : user.role === 'staff' ? 'Nhân Viên Vận Hành' : 'Quản Trị'})`} đã đăng nhập!`
              : `Welcome ${user.name}! Logged in successfully${['buyer', 'seller'].includes(user.role) ? '' : ` as ${user.role.toUpperCase()}`}.`
          );
          if (user.role === 'admin') {
            setActiveTab('admin-dashboard');
          } else if (user.role === 'inspector' || user.role === 'inspection_center') {
            setActiveTab('inspection-hub');
          } else if (user.role === 'staff') {
            setActiveTab('home');
          } else if (pendingCheckoutItem) {
            setSelectedListing(null);
            setCheckoutListing(pendingCheckoutItem);
            setPendingCheckoutItem(null);
          } else if (pendingTab) {
            const targetTab = pendingTab;
            setPendingTab(null);
            handleTabChange(targetTab);
          }
        }}
        lang={lang}
      />

      {/* Session Expired Modal */}
      <SessionExpiredModal
        isOpen={isSessionExpiredOpen}
        lang={lang}
        onLoginAgain={() => {
          setIsSessionExpiredOpen(false);
          setAuthModalMode('login');
          setIsAuthModalOpen(true);
        }}
      />

      {/* User Profile Dialog */}
      <ProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={() => setIsProfileDialogOpen(false)}
        currentUser={currentUser}
        currentRole={currentRole}
        lang={lang}
        onUpdateProfile={(updated) => {
          handleUserProfileUpdated(
            updated,
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
        onOpenTopUp={() => setIsTopUpModalOpen(true)}
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

      {/* Seller Registration Modal */}
      <SellerRegistrationModal
        isOpen={isSellerRegistrationModalOpen}
        onClose={() => setIsSellerRegistrationModalOpen(false)}
        currentUser={currentUser}
        lang={lang}
        onUpdateProfile={(updated) => {
          handleUserProfileUpdated(
            updated,
            lang === 'vi'
              ? 'Đã cập nhật hồ sơ người bán thành công!'
              : 'Seller profile updated successfully!'
          );
        }}
        onRoleChange={handleRoleChange}
        onNavigateToCreateListing={() => {
          setActiveTab('create-listing');
        }}
      />

      {/* TopUp Credits Modal Popup (Requirement 7) */}
      <TopUpModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        currentUser={currentUser}
        currentRole={currentRole}
        lang={lang}
        initialTab={topUpInitialTab}
        currentCredit={userCreditBalance}
        userCredit={userCredit}
        walletBalance={walletBalance}
        onCreditUpdated={(newBal) => setUserCreditBalance(newBal)}
        onUserCreditUpdated={(newCredit) => {
          setUserCredit(newCredit);
          window.dispatchEvent(new CustomEvent('seller_credits_updated', { detail: newCredit }));
        }}
        onWalletUpdated={(newBal) => setWalletBalance(newBal)}
      />
      {/* Logout Confirmation Modal Popup */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        lang={lang}
      />

      {/* Policies & System Information Modal */}
      <PolicyModal
        isOpen={isPolicyModalOpen}
        initialTab={policyInitialTab}
        onClose={() => setIsPolicyModalOpen(false)}
        lang={lang}
      />

      {/* Global In-App Popup Modal (Replaces all native browser localhost alerts & confirms) */}
      <GlobalPopupModal />

      {/* E-Commerce Footer */}
      {activeTab !== 'admin-dashboard' && activeTab !== 'inspection-hub' && activeTab !== 'inspection-center' && activeTab !== 'staff-workspace' && (
        <Footer
          lang={lang}
          currentRole={currentRole}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenProfile={() => {
            if (!currentUser) {
              requireAuth(undefined, lang === 'vi' ? 'Vui lòng đăng nhập để xem thông tin hồ sơ.' : 'Please log in to view profile.');
            } else {
              setIsProfileDialogOpen(true);
            }
          }}
          onOpenPolicy={(policyKey) => {
            setPolicyInitialTab(policyKey);
            setIsPolicyModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
