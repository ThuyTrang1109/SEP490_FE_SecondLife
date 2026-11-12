import { isValidUUID, isSellerOfferId } from './utils/negotiationHelper';
import { getRoleLandingPath, getRouteAccess, getUserRoles, pathForTab, paths, resolveAppRoute, safeReturnPath } from './app/router/paths';
import { navigatePath, useBrowserLocation } from './app/router/browser';
import { RouteStatusPage } from './app/router/RouteStatusPage';
import React, { useState, lazy, Suspense, useRef, useCallback, useEffect } from 'react';
import { UserRole, Language, Listing, EscrowOrder, DisputeCase, UserProfile, UserCredit, ItemCategory, ConditionGrade, EscrowStatus, InspectionReport, InspectionProposalPrefillData } from './types';
import { formatVND } from './utils/translations';
import { extractWardAndCity, getSavedSellerAddress, saveSellerAddress, cleanFullAddress, formatCombinedAddress } from './utils/addressUtils';
import { getSortableOrderTimestamp, getBoughtListingIds, markListingAsBought, markListingAsAvailable, reconcileBoughtListingIds, isOrderCancelledOrRefunded, getResolvedPostParcel, extractListingIdFromOrder, resolveInspectionCenter } from './utils/orderUtils';
import { getBuyerInspectionStage, getCustomerInspectionStatus } from './utils/inspectionPurchase';
import { resolveCategoryAndItem, initCatalogCache, resolveOrderListing, resolveListingCategory, extractSellerOriginalPrice } from './utils/catalogCache';
import { translateSystemNotification } from './utils/systemNotificationTranslator';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HomePageView } from './pages/HomePageView';
import { MarketplaceView } from './pages/MarketplaceView';
import { AuthModal } from './components/modals/AuthModal';
import { VerifyEmailModal } from './components/modals/VerifyEmailModal';
import { LogoutConfirmModal } from './components/modals/LogoutConfirmModal';
import { SessionExpiredModal } from './components/modals/SessionExpiredModal';
import { RealtimeNotificationToast } from './components/common/RealtimeNotificationToast';
import { GlobalPopupModal } from './components/common/GlobalPopupModal';
import type { PolicyTabKey } from './components/modals/PolicyModal';
import './utils/dialogService';
import { clearNotificationsOnLogout, saveScopedLocalNotification } from './utils/notificationStorage';
import { NotificationItem } from './types/notification';
import { notificationWsClient } from './services/notificationWsClient';
import { ShieldCheck, Sparkles, CheckCircle2, Store, AlertTriangle } from 'lucide-react';
import { authService, userService, topupService, walletService, orderService, inspectorService, negotiationService, postService, adminPostService, shippingService, sellerCreditService, chatService, getAccessToken, getRefreshToken, clearAuthTokens, getStoredUser, setStoredUser, isTokenExpired, isTokenExpiringSoon, recordUserActivity, resetActivityTimer, isUserIdle, refreshAccessToken, checkAndRenewSessionOnReturn, ChatRoomDto } from './services';
import { inspectionCashConfirmedEvent } from './utils/inspectionCashShipping';
import { isListingInspectionPassed, markListingInspectionPassed } from './utils/listingInspection';

// Code-split heavy views via lazyWithRetry to prevent dynamic import fetch errors
const CreateListingView = lazyWithRetry(() => import('./pages/CreateListingView').then(m => ({ default: m.CreateListingView })), 'CreateListingView');
const SellerDashboardView = lazyWithRetry(() => import('./pages/SellerDashboardView').then(m => ({ default: m.SellerDashboardView })), 'SellerDashboardView');
const EscrowOrdersView = lazyWithRetry(() => import('./pages/EscrowOrdersView').then(m => ({ default: m.EscrowOrdersView })), 'EscrowOrdersView');
const InspectorPortalView = lazyWithRetry(() => import('./pages/InspectorPortalView').then(m => ({ default: m.InspectorPortalView })), 'InspectorPortalView');
const InspectionCenterDashboardView = lazyWithRetry(() => import('./pages/InspectionCenterDashboardView').then(m => ({ default: m.InspectionCenterDashboardView })), 'InspectionCenterDashboardView');
const StaffWorkspaceView = lazyWithRetry(() => import('./pages/StaffWorkspaceView').then(m => ({ default: m.StaffWorkspaceView })), 'StaffWorkspaceView');
const AdminDashboardView = lazyWithRetry(() => import('./pages/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })), 'AdminDashboardView');
const InboxView = lazyWithRetry(() => import('./pages/InboxView').then(m => ({ default: m.InboxView })), 'InboxView');
const NotificationCenterView = lazyWithRetry(() => import('./pages/NotificationCenterView').then(m => ({ default: m.NotificationCenterView })), 'NotificationCenterView');
const BuyerInspectionDecisionView = lazyWithRetry(() => import('./pages/BuyerInspectionDecisionView').then(m => ({ default: m.BuyerInspectionDecisionView })), 'BuyerInspectionDecisionView');
const MyDisputesView = lazyWithRetry(() => import('./pages/MyDisputesView').then(m => ({ default: m.MyDisputesView })), 'MyDisputesView');

// Code-split heavy modals via lazyWithRetry
const ListingDetailModal = lazyWithRetry(() => import('./components/modals/ListingDetailModal').then(m => ({ default: m.ListingDetailModal })), 'ListingDetailModal');
const CheckoutModal = lazyWithRetry(() => import('./components/modals/CheckoutModal').then(m => ({ default: m.CheckoutModal })), 'CheckoutModal');
const ChatModal = lazyWithRetry(() => import('./components/modals/ChatModal').then(m => ({ default: m.ChatModal })), 'ChatModal');
const ProfileDialog = lazyWithRetry(() => import('./components/modals/ProfileDialog').then(m => ({ default: m.ProfileDialog })), 'ProfileDialog');
const SellerRegistrationModal = lazyWithRetry(() => import('./components/modals/SellerRegistrationModal').then(m => ({ default: m.SellerRegistrationModal })), 'SellerRegistrationModal');
const TopUpModal = lazyWithRetry(() => import('./components/modals/TopUpModal').then(m => ({ default: m.TopUpModal })), 'TopUpModal');
const PolicyModal = lazyWithRetry(() => import('./components/modals/PolicyModal').then(m => ({ default: m.PolicyModal })), 'PolicyModal');
const SellerReviewsModal = lazyWithRetry(() => import('./components/modals/SellerReviewsModal').then(m => ({ default: m.SellerReviewsModal })), 'SellerReviewsModal');
const UserReportModal = lazyWithRetry(() => import('./components/modals/UserReportModal').then(m => ({ default: m.UserReportModal })), 'UserReportModal');

// In-memory quick lookup caches to avoid blocking synchronous localStorage disk I/O
const postCacheMap = new Map<string, Listing>();
const postTitleCacheMap = new Map<string, Listing>();

// Sleek loading fallback for lazy-loaded tabs
const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[360px] py-16 px-4">
    <div className="w-10 h-10 rounded-full border-4 border-amber-200 border-t-[#c34c36] animate-spin" />
    <span className="mt-3 text-xs font-semibold text-slate-500 tracking-wider uppercase animate-pulse">
      Đang tải dữ liệu...
    </span>
  </div>
);

const VALID_MAIN_TABS = [
  'home',
  'marketplace',
  'seller-dashboard',
  'create-listing',
  'orders',
  'buyer-inspection-decision',
  'inspection-center',
  'inspection-hub',
  'staff-workspace',
  'admin-dashboard',
  'chat',
  'notifications',
  'disputes'
] as const;

const TAB_STORAGE_KEY = 'secondlife_active_tab';

function getInitialActiveTab(): string {
  const role = getStoredUser()?.role || 'buyer';
  return resolveAppRoute(typeof window === 'undefined' ? '/' : window.location.href, role).tab;
}

export default function App() {
  const [lang, setLang] = useState<Language>('vi');
  const browserLocation = useBrowserLocation();
  React.useEffect(() => { document.body.classList.remove('dark'); }, []);

  // User Auth State - Isolated per browser/device via localStorage
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      return null;
    }
    return stored as UserProfile;
  });

  const hadSessionRef = React.useRef<boolean>(
    Boolean(getAccessToken() || getRefreshToken() || getStoredUser())
  );
  React.useEffect(() => {
    if (currentUser) {
      hadSessionRef.current = true;
    }
  }, [currentUser]);

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    return token && stored && stored.role ? stored.role : 'buyer';
  });

  const [isRestoringSession, setIsRestoringSession] = useState(() => Boolean(getAccessToken()));
  const currentUserId = currentUser?.id;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const isCenterAccount = currentUser?.role === 'inspection_center' || currentRole === 'inspection_center';
  const effectiveUser = currentUser || (getAccessToken() ? getStoredUser() : null);
  const effectiveRole = effectiveUser?.role || currentRole;
  const route = resolveAppRoute(browserLocation, effectiveRole);
  const routeAccess = getRouteAccess(route, effectiveUser, isRestoringSession);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const ordersScope = `${currentUser?.id || ''}:${currentRole}`;
  const ordersScopeRef = useRef(ordersScope);
  ordersScopeRef.current = ordersScope;
  const activeTab = route.tab;
  const navigationRole = route.role && getUserRoles(effectiveUser).includes(route.role) ? route.role : effectiveRole;
  const setActiveTab = (value: React.SetStateAction<string>) => {
    const tab = typeof value === 'function' ? value(activeTab) : value;
    navigatePath(pathForTab(tab, navigationRole));
  };

  // Pending action after login (redirect or resume action)
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [pendingCheckoutItem, setPendingCheckoutItem] = useState<Listing | null>(null);
  const [editingDraft, setEditingDraft] = useState<Listing | null>(null);
  const [createListingReturnTab, setCreateListingReturnTab] = useState<string>('marketplace');
  const [inspectionDecisionOrder, setInspectionDecisionOrder] = useState<EscrowOrder | null>(null);
  const [inspectionDecisionOrderId, setInspectionDecisionOrderId] = useState<string | null>(null);

  // Restore & verify session for THIS browser from Backend /me on startup/refresh
  React.useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    const stored = getStoredUser();
    const hadInitialSession = hadSessionRef.current || Boolean(token || stored || getRefreshToken());

    if (token) {
      userService.getMyProfile().then(async (profile) => {
        if (cancelled) return;
        if (profile) {
          // Xác định vai trò người dùng để tránh gọi sai API chuyên biệt
          const roleUpperList = (profile.roles || []).map((r: string) => (r || '').toUpperCase());
          const isInternal = roleUpperList.some((r: string) =>
            ['INSPECTOR', 'ROLE_INSPECTOR', 'HUB_INSPECTOR', 'STAFF', 'ROLE_STAFF', 'ADMIN', 'ROLE_ADMIN', 'INSPECTION_CENTER', 'ROLE_INSPECTION_CENTER'].includes(r)
          );
          const isSeller = !isInternal && roleUpperList.some((r: string) => r === 'SELLER' || r === 'ROLE_SELLER');
          const isBuyer = !isInternal && !isSeller;

          // Lấy thông tin địa chỉ kho bưu tá / onboarding từ BE (Chỉ gọi cho Buyer hoặc Seller, tuyệt đối không gọi cho role nội bộ như Inspector/Admin/Staff)
          let pickupAddr: any = null;
          if (!isInternal && (isSeller || isBuyer)) {
            try {
              const tasks: Promise<any>[] = [shippingService.getSellerOnboarding()];
              if (isSeller) {
                tasks.push(shippingService.getPickupAddress());
              }
              const results = await Promise.allSettled(tasks);
              const obRes = results[0];
              const paRes = isSeller ? results[1] : null;
              if (obRes && obRes.status === 'fulfilled' && obRes.value?.pickupAddress) {
                pickupAddr = obRes.value.pickupAddress;
              } else if (paRes && paRes.status === 'fulfilled' && paRes.value) {
                pickupAddr = paRes.value;
              }
            } catch (_) {}
          }

          if (cancelled) return;
          const fullPickup = pickupAddr
            ? [pickupAddr.address, pickupAddr.wardName, pickupAddr.provinceName].filter(Boolean).join(', ')
            : '';

          const stored = getStoredUser();
          const savedAddr = getSavedSellerAddress();

          const profileFullAddress = formatCombinedAddress(
            profile.streetAddress,
            profile.ward,
            profile.district,
            profile.province
          );

          // Ưu tiên địa chỉ người dùng đã cập nhật trong session/localStorage nếu có
          const resolvedAddress = cleanFullAddress(stored?.address || profileFullAddress || savedAddr?.address || '');
          const resolvedPickup = cleanFullAddress(stored?.pickupAddress || fullPickup || profileFullAddress || savedAddr?.address || '');
          const resolvedWard = stored?.wardName || profile.ward || pickupAddr?.wardName || savedAddr?.wardName || '';
          const resolvedProv = stored?.provinceName || profile.province || pickupAddr?.provinceName || savedAddr?.provinceName || '';

          if (isSeller && (resolvedPickup || resolvedAddress)) {
            saveSellerAddress(resolvedPickup || resolvedAddress, resolvedWard, resolvedProv);
          }

          const syncedUser: UserProfile = {
            id: profile.id,
            name: profile.fullName || profile.email,
            email: profile.email,
            role: (roleUpperList.includes('ADMIN') || roleUpperList.includes('ROLE_ADMIN'))
              ? 'admin'
              : (roleUpperList.includes('INSPECTION_CENTER') || roleUpperList.includes('ROLE_INSPECTION_CENTER'))
                ? 'inspection_center'
                : (roleUpperList.includes('INSPECTOR') || roleUpperList.includes('ROLE_INSPECTOR') || roleUpperList.includes('HUB_INSPECTOR'))
                  ? 'inspector'
                  : (roleUpperList.includes('STAFF') || roleUpperList.includes('ROLE_STAFF'))
                    ? 'staff'
                    : (roleUpperList.includes('SELLER') || roleUpperList.includes('ROLE_SELLER'))
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
            emailVerified: Boolean(profile.emailVerified),
            roles: profile.roles,
            permissions: profile.permissions,
          };
          setCurrentUser(syncedUser);
          setCurrentRole(syncedUser.role);
          setStoredUser(syncedUser);
          if (isSeller) {
            saveSellerAddress(
              syncedUser.pickupAddress || syncedUser.address || '',
              syncedUser.wardName || syncedUser.ward || '',
              syncedUser.provinceName || syncedUser.province || ''
            );
          }

        } else {
          clearAuthTokens();
          setCurrentUser(null);
          setCurrentRole('buyer');
          hadSessionRef.current = false;
          if (hadInitialSession) {
            setIsSessionExpiredOpen(true);
            showToast(
              lang === 'vi'
                ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
                : 'Session expired. Please log in again.'
            );
          }
        }
      }).catch(() => {
        if (cancelled) return;
        clearAuthTokens();
        setCurrentUser(null);
        setCurrentRole('buyer');
        hadSessionRef.current = false;
        if (hadInitialSession) {
          setIsSessionExpiredOpen(true);
          showToast(
            lang === 'vi'
              ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
              : 'Session expired. Please log in again.'
          );
        }
      }).finally(() => {
        if (!cancelled) setIsRestoringSession(false);
      });
    } else {
      setIsRestoringSession(false);
      if (hadInitialSession) {
        clearAuthTokens();
        setCurrentUser(null);
        setCurrentRole('buyer');
        hadSessionRef.current = false;
        setIsSessionExpiredOpen(true);
        showToast(
          lang === 'vi'
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
            : 'Session expired. Please log in again.'
        );
      } else {
        clearAuthTokens();
        setCurrentUser(null);
        setCurrentRole('buyer');
      }
    }
    return () => { cancelled = true; };
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

  const closeRouteModal = (fallback: string) => {
    const previous = safeReturnPath(window.history.state?.returnPath || null);
    if (previous && previous !== browserLocation) {
      const targetRoute = resolveAppRoute(previous, currentUser?.role || currentRole);
      if (getRouteAccess(targetRoute, currentUser) === 'allowed') {
        navigatePath(previous, { replace: true });
        return;
      }
    }
    navigatePath(fallback, { replace: true });
  };
  const openAuth = (mode: 'login' | 'register' | 'forgot' = 'login', returnTo?: string) => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
    const authPath = mode === 'register' ? '/register' : mode === 'forgot' ? '/forgot-password' : '/login';
    navigatePath(authPath + (returnTo ? `?redirect=${encodeURIComponent(returnTo)}` : ''), {
      state: { returnPath: browserLocation },
    });
  };
  const openProfile = () => {
    navigatePath(paths.profile(navigationRole), { state: { returnPath: browserLocation } });
  };
  const openChat = (listing: Listing, action?: string, prefill?: InspectionProposalPrefillData) => {
    setSelectedListing(null);
    setChatListing(listing);
    setChatPredefinedRoomId(undefined);
    setChatPartnerName(listing.sellerName);
    setChatPartnerAvatar(listing.sellerAvatar);
    setChatRoom(undefined);
    const draft = prefill ? { ...prefill, postId: listing.id, buyerId: currentUser?.id } : null;
    setInspectionChatDraft(draft);
    if (draft) {
      try {
        sessionStorage.setItem(`secondlife_inspection_prefill_${listing.id}`, JSON.stringify(draft));
      } catch (e) {
        console.warn('Failed to save inspection prefill to sessionStorage:', e);
      }
    }
    const query = `?postId=${encodeURIComponent(listing.id)}${action ? `&action=${encodeURIComponent(action)}` : ''}${
      prefill?.centerId ? `&centerId=${encodeURIComponent(prefill.centerId)}` : ''
    }${prefill?.inspectionMethod ? `&method=${encodeURIComponent(prefill.inspectionMethod)}` : ''}${
      prefill?.feeSplit ? `&feeSplit=${encodeURIComponent(prefill.feeSplit)}` : ''
    }`;
    navigatePath(paths.chat(navigationRole) + query);
  };
  const openProduct = (listing: Listing, own = false) => {
    setSelectedListing(listing);
    const adminPath = activeTab === 'admin-dashboard' && getUserRoles(currentUser).includes('admin');
    const target = own ? `/seller/products/${encodeURIComponent(listing.id)}`
      : adminPath ? `/admin/products/${encodeURIComponent(listing.id)}` : paths.product(listing.id);
    navigatePath(target, {
      state: { returnPath: browserLocation },
    });
  };

  // Policy Modal State
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyInitialTab, setPolicyInitialTab] = useState<PolicyTabKey>('about');

  // Load wallet balance from Backend
  const loadUserWallet = React.useCallback(async () => {
    if (currentUserId && getAccessToken()) {
      try {
        const w = await walletService.getMyWallet();
        if (currentUserIdRef.current !== currentUserId) return;
        if (w && typeof w.balance === 'number') {
          setWalletBalance(w.balance);
          setCurrentUser((prev) => {
            if (!prev || prev.id !== currentUserId || (prev.walletBalanceVnd === w.balance && prev.walletBalance === w.balance)) return prev;
            return { ...prev, walletBalance: w.balance, walletBalanceVnd: w.balance };
          });
        }
      } catch (err) {
        console.warn('Could not load wallet from server:', err);
      }
    }
  }, [currentUserId]);

  React.useEffect(() => {
    const refreshWallet = (e?: any) => {
      const detail = e?.detail;
      if (typeof detail?.balance === 'number') {
        setWalletBalance(detail.balance);
        setCurrentUser((prev) => {
          if (!prev) return prev;
          if (prev.walletBalance === detail.balance && prev.walletBalanceVnd === detail.balance) return prev;
          return { ...prev, walletBalance: detail.balance, walletBalanceVnd: detail.balance };
        });
        return;
      } else if (typeof detail?.deductAmount === 'number' && detail.deductAmount > 0) {
        setWalletBalance((prev) => Math.max(0, prev - detail.deductAmount));
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const currentBal = prev.walletBalanceVnd ?? prev.walletBalance ?? 0;
          const newBal = Math.max(0, currentBal - detail.deductAmount);
          return { ...prev, walletBalance: newBal, walletBalanceVnd: newBal };
        });
        return;
      }
      void loadUserWallet();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === inspectionCashConfirmedEvent || event.key === 'sl_wallet_last_updated') {
        refreshWallet();
      }
    };

    window.addEventListener(inspectionCashConfirmedEvent, refreshWallet);
    window.addEventListener('secondlife_wallet_updated', refreshWallet);
    window.addEventListener('wallet_balance_updated', refreshWallet);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(inspectionCashConfirmedEvent, refreshWallet);
      window.removeEventListener('secondlife_wallet_updated', refreshWallet);
      window.removeEventListener('wallet_balance_updated', refreshWallet);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadUserWallet]);

  // Fetch credit balance and wallet on load if user is logged in
  React.useEffect(() => {
    if (!isRestoringSession && currentUserId && getAccessToken()) {
      loadUserWallet();

      // Chỉ tài khoản Người bán (Seller) mới có và sử dụng credit
      const isSeller =
        currentRole === 'seller' ||
        currentUser?.role === 'seller';

      if (isSeller) {
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
  }, [currentUserId, currentUser?.role, currentRole, isRestoringSession, loadUserWallet]);


  const handleConfirmLogout = () => {
    setIsSessionExpiredOpen(false);
    authService.logout().finally(() => {
      try {
        notificationWsClient.disconnect();
      } catch {}
      clearNotificationsOnLogout();
      clearAuthTokens();
      resetActivityTimer();
      setCurrentUser(null);
      setCurrentRole('buyer');
      setActiveTab('marketplace');
      setIsProfileDialogOpen(false);
      setEditingDraft(null);
      setOrders([]);

      // Xóa toàn bộ thông tin bài đăng nháp và cache đơn hàng dở dang của tài khoản để tránh rò rỉ sang tài khoản khác
      try {
        // Giữ lại center_inspection_orders cho trung tâm kiểm định, chỉ dọn cache bài nháp
        localStorage.removeItem('all_seller_posts_cache');
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('create_listing_active_draft_') ||
              key === 'create_listing_active_draft' ||
              key.startsWith('order_listing_') ||
              key.startsWith('order_buyer_info_') ||
              key.startsWith('order_appointment_') ||
              key.startsWith('buyer_info_'))
          ) {
            localStorage.removeItem(key);
          }
        }
        sessionStorage.removeItem('create_listing_active_draft');
        sessionStorage.removeItem(TAB_STORAGE_KEY);
        sessionStorage.removeItem('secondlife_admin_active_tab');
        sessionStorage.removeItem('secondlife_staff_active_tab');
        sessionStorage.removeItem('secondlife_center_active_tab');
        sessionStorage.removeItem('secondlife_orders_filter_tab');
        sessionStorage.removeItem('secondlife_inspection_decision_order_id');
      } catch {}

      // Force a hard reload to ensure all memory states and third-party scripts are cleared
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.search = '';
        cleanUrl.hash = '';
        window.history.replaceState(null, '', paths.products);
      } catch (e) {}
      window.location.reload();
    });
  };

  // Helper to recover locally placed or cached orders from localStorage (strictly scoped to user)
  const getLocalStoredOrders = React.useCallback((targetUser?: UserProfile | null): EscrowOrder[] => {
    const userToUse = targetUser || currentUser || (typeof getStoredUser === 'function' ? getStoredUser() : null);
    const activeUserId = userToUse?.id || (typeof window !== 'undefined' ? localStorage.getItem('user_id') : '') || '';
    if (!activeUserId && !userToUse?.name && !userToUse?.email) return [];

    const result: EscrowOrder[] = [];
    const seenIds = new Set<string>();

    const activeRole = userToUse?.role || currentRole;
    const isInspectionRole = Boolean(
      activeRole === 'inspection_center' ||
      activeRole === 'inspector' ||
      activeRole === 'admin'
    );

    // 1. Check recent_placed_orders and center_inspection_orders for the current user
    try {
      const activeUserName = (targetUser?.name || currentUser?.name || '').trim().toLowerCase();
      const activeUserEmail = (targetUser?.email || currentUser?.email || '').trim().toLowerCase();
      const raw = localStorage.getItem('recent_placed_orders');
      const rawCenter = localStorage.getItem('center_inspection_orders');
      const listRecent = raw ? JSON.parse(raw) : [];
      const listCenter = rawCenter ? JSON.parse(rawCenter) : [];
      const combined = [
        ...(Array.isArray(listCenter) ? listCenter : []),
        ...(Array.isArray(listRecent) ? listRecent : [])
      ];

      if (Array.isArray(combined)) {
        combined.forEach((o) => {
          if (o?.id && !seenIds.has(o.id)) {
            const isLocalConfirmed = typeof window !== 'undefined' && (
              localStorage.getItem(`order_receipt_confirmed_${o.id}`) === 'true'
            );
            const isLocalCancelled = typeof window !== 'undefined' && (
              localStorage.getItem(`order_cancellation_info_${o.id}`) !== null ||
              localStorage.getItem(`order_cancelled_${o.id}`) === 'true'
            );
            if (isLocalConfirmed || o.escrowStatus === 'RELEASED' || o.escrowStatus === 'COMPLETED_RELEASED' || (o as any).backendStatus === 'COMPLETED' || (o as any).status === 'COMPLETED') {
              o.escrowStatus = 'COMPLETED_RELEASED';
              o.backendStatus = 'COMPLETED';
              (o as any).status = 'COMPLETED';
              o.cancellationReasonCode = undefined;
              o.cancellationReason = undefined;
            } else if (isLocalCancelled || o.escrowStatus === 'REFUNDED_TO_BUYER' || o.backendStatus === 'CANCELLED' || (o as any).status === 'CANCELLED') {
              o.escrowStatus = 'REFUNDED_TO_BUYER';
              o.backendStatus = 'CANCELLED';
              (o as any).status = 'CANCELLED';
            }
            const isBuyer = Boolean(
              (o.buyerId && String(o.buyerId) === String(activeUserId)) ||
              (o.buyerId === 'buyer-current') ||
              (activeUserName && o.buyerName && o.buyerName.trim().toLowerCase() === activeUserName) ||
              (activeUserEmail && (o as any).buyerEmail && String((o as any).buyerEmail).trim().toLowerCase() === activeUserEmail)
            );
            const isSeller = Boolean(
              (o.sellerId && String(o.sellerId) === String(activeUserId)) ||
              (o.listing?.sellerId && String(o.listing.sellerId) === String(activeUserId)) ||
              (o.listing?.userId && String(o.listing.userId) === String(activeUserId)) ||
              (o.listing?.user?.id && String(o.listing.user.id) === String(activeUserId)) ||
              (activeUserName && o.sellerName && o.sellerName.trim().toLowerCase() === activeUserName) ||
              (activeUserName && o.listing?.sellerName && o.listing.sellerName.trim().toLowerCase() === activeUserName) ||
              (activeUserEmail && (o as any).sellerEmail && String((o as any).sellerEmail).trim().toLowerCase() === activeUserEmail) ||
              (activeUserEmail && (o.listing as any)?.sellerEmail && String((o.listing as any).sellerEmail).trim().toLowerCase() === activeUserEmail) ||
              (activeRole === 'seller' && !isBuyer)
            );
            const isInspectionOrder = Boolean(
              o.hasInspectionService ||
              o.inspectionMethod ||
              (o.inspectionFeeVnd && o.inspectionFeeVnd > 0) ||
              o.escrowStatus === 'AWAITING_INSPECTION' ||
              o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
              o.escrowStatus === 'INSPECTION_PASSED' ||
              o.status === 'CONFIRMED_PENDING_DISPATCH' ||
              o.status === 'WAITING_INSPECTION' ||
              o.backendStatus === 'CONFIRMED_PENDING_DISPATCH'
            );
            if (isBuyer || isSeller || (isInspectionRole && isInspectionOrder)) {
              if (o.listing) {
                o.listing = resolveOrderListing(o.listing);
              }
              seenIds.add(o.id);
              result.push(o);
            }
          }
        });
      }
    } catch {}

    result.sort((a, b) => {
      const timeA = getSortableOrderTimestamp(a);
      const timeB = getSortableOrderTimestamp(b);
      if (timeB !== timeA) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    const seenOrderIds = new Set<string>();
    const deduplicatedResult = result.filter((o) => {
      const orderId = String(o.id || '');
      if (!orderId) return true;
      if (seenOrderIds.has(orderId)) {
        return false;
      }
      seenOrderIds.add(orderId);
      return true;
    });

    return deduplicatedResult;
  }, [currentUser?.id]);

  // Core Data State
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<EscrowOrder[]>(() => {
    // Only use local stored orders if NO access token (guest/unauthenticated)
    // Authenticated users must load real orders from server to prevent status jumping and bleed
    if (getAccessToken()) {
      return [];
    }
    return getLocalStoredOrders(getStoredUser());
  });
  const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(() => Boolean(getAccessToken()));
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);

  const listingsRef = useRef<Listing[]>(listings);
  listingsRef.current = listings;

  const lastListingsFetchRef = useRef<number>(0);
  const isFetchingListingsRef = useRef<boolean>(false);
  const lastOrdersFetchRef = useRef<number>(0);
  const pendingOrdersRef = useRef<{ scope: string; refresh: boolean } | null>(null);
  const lastOrdersScopeRef = useRef('');
  const refreshOrdersRef = useRef<(force?: boolean) => Promise<void>>(undefined);

  // Sync orders whenever logged-in user changes (prevents account order bleed)
  const prevUserIdRef = useRef<string | null>(currentUser?.id || null);
  React.useEffect(() => {
    const currentId = currentUser?.id || null;
    if (prevUserIdRef.current !== currentId) {
      prevUserIdRef.current = currentId;
      if (!currentId) {
        setOrders([]);
        setIsOrdersLoading(false);
      } else if (getAccessToken()) {
        setIsOrdersLoading(true);
        void refreshOrdersRef.current?.(true);
      } else {
        setOrders(getLocalStoredOrders(currentUser));
      }
    }
  }, [currentUser?.id, getLocalStoredOrders]);

  // Modals
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [checkoutListing, setCheckoutListing] = useState<Listing | null>(null);
  const [checkoutAgreedPrice, setCheckoutAgreedPrice] = useState<number | undefined>(undefined);
  const [chatListing, setChatListing] = useState<Listing | null>(null);
  const [inspectionChatDraft, setInspectionChatDraft] = useState<InspectionProposalPrefillData | null>(null);
  const [chatPredefinedRoomId, setChatPredefinedRoomId] = useState<string | undefined>(undefined);
  const [chatPartnerName, setChatPartnerName] = useState<string | undefined>(undefined);
  const [chatPartnerAvatar, setChatPartnerAvatar] = useState<string | undefined>(undefined);
  const [chatRoom, setChatRoom] = useState<ChatRoomDto | undefined>(undefined);
  const [unreadChatsCount, setUnreadChatsCount] = useState<number>(0);
  const [sellerReviewsModalData, setSellerReviewsModalData] = useState<{ sellerId: string; sellerName: string } | null>(null);
  const [reportingOrderForDispute, setReportingOrderForDispute] = useState<EscrowOrder | null>(null);

  // Flash Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    const translated = translateSystemNotification(msg);
    setToastMessage(translated);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Listen for 401 Unauthorized session revocation events
  React.useEffect(() => {
    const handleUnauthorized = (e?: Event) => {
      const customEvt = e as CustomEvent<{ hadSession?: boolean; reason?: string }>;
      const hadUser = Boolean(
        customEvt?.detail?.hadSession ||
        hadSessionRef.current ||
        currentUser ||
        getAccessToken() ||
        getRefreshToken() ||
        getStoredUser()
      );
      console.log('[App] Received unauthorized_session event! hadUser:', hadUser, 'reason:', customEvt?.detail?.reason);
      clearAuthTokens();
      resetActivityTimer();
      setCurrentUser(null);
      setCurrentRole('buyer');
      hadSessionRef.current = false;
      
      // Hiển thị modal và thông báo hết hạn phiên nếu trước đó người dùng có phiên đăng nhập
      if (hadUser) {
        setIsSessionExpiredOpen(true);
        showToast(
          lang === 'vi'
            ? 'Phiên đăng nhập đã hết hạn do không có hoạt động. Vui lòng đăng nhập lại.'
            : 'Session expired due to inactivity. Please log in again.'
        );
      }
    };
    window.addEventListener('unauthorized_session', handleUnauthorized);
    return () => window.removeEventListener('unauthorized_session', handleUnauthorized);
  }, [lang, currentUser]);

  // Idle Time & Token Watchdog (30-minute idle check + proactive JWT renewal for active users)
  React.useEffect(() => {
    // Record activity on mount and register user interaction listeners
    recordUserActivity(true);

    const handleUserInteraction = () => {
      recordUserActivity();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'click', 'scroll', 'touchstart', 'wheel'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Lắng nghe khi người dùng quay lại tab (chuyển từ tab khác hoặc ứng dụng khác về)
    // Tự động làm mới token mượt mà nếu refreshToken còn hiệu lực (7 ngày), áp dụng đồng bộ cho cả Người mua & Người bán
    const handleTabActive = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        checkAndRenewSessionOnReturn();
      }
    };
    document.addEventListener('visibilitychange', handleTabActive);
    window.addEventListener('focus', handleTabActive);

    const interval = setInterval(() => {
      if (!currentUser) return;

      const token = getAccessToken();
      const rToken = getRefreshToken();

      // If user has no tokens at all, nothing to watch
      if (!token && !rToken) return;

      // Check if user has been inactive/idle for >= 30 minutes (1,800,000 ms)
      if (isUserIdle(30 * 60 * 1000)) {
        console.log('[App] User inactive for 30 minutes. Session expired.');
        window.dispatchEvent(new Event('unauthorized_session'));
        return;
      }

      // User is actively using the system: proactively refresh token if expiring within 60 seconds
      if (token && isTokenExpiringSoon(token, 60)) {
        console.log('[App] User is actively using the system. Seamlessly renewing JWT token.');
        refreshAccessToken().then((newToken) => {
          if (!newToken && isTokenExpired(token)) {
            console.log('[App] Refresh token rejected or expired on BE. Revoking session.');
            window.dispatchEvent(new Event('unauthorized_session'));
          }
        });
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      document.removeEventListener('visibilitychange', handleTabActive);
      window.removeEventListener('focus', handleTabActive);
    };
  }, [currentUser]);

  // Auth Guard Helper
  const protectedTabs = ['create-listing', 'seller-dashboard', 'orders', 'inspection-hub', 'inspection-center', 'admin-dashboard', 'staff-workspace', 'chat', 'notifications', 'disputes'];

  const requireAuth = (onSuccessAction?: () => void, customMsg?: string): boolean => {
    if (!currentUser) {
      openAuth('login', browserLocation);
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
      const returnTo = ['orders', 'chat', 'notifications', 'disputes'].includes(tab) ? `/${tab}` : pathForTab(tab, 'buyer');
      navigatePath(`/login?redirect=${encodeURIComponent(returnTo)}`);
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

    if (checkoutListing) {
      const closedListingId = checkoutListing?.id;
      if (closedListingId) {
        markListingAsAvailable(String(closedListingId));
        reconcileBoughtListingIds();
      }
      setCheckoutListing(null);
      setCheckoutAgreedPrice(undefined);
      setCheckoutNegotiationId(undefined);
    }

    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNotificationNavigate = React.useCallback((actionUrl: string | null) => {
    if (!actionUrl) { navigatePath(pathForTab('notifications', currentRole)); return; }
    const target = new URL(actionUrl, window.location.origin);
    if (target.origin !== window.location.origin) return;
    if (target.pathname.includes('/wallet')) { setIsTopUpModalOpen(true); return; }
    const match = resolveAppRoute(`${target.pathname}${target.search}${target.hash}`, currentRole);
    navigatePath(match.url);
  }, [currentRole]);



  // Handlers
  const handleRoleChange = async (newRole: UserRole) => {
    if (!currentUser) { openAuth('login'); return; }
    let verifiedUser = currentUser;
    if (!getUserRoles(verifiedUser).includes(newRole)) {
      try {
        const profile = await userService.getMyProfile();
        verifiedUser = { ...verifiedUser, roles: profile.roles, permissions: profile.permissions };
      } catch { navigatePath(paths.unauthorized); return; }
    }
    if (!getUserRoles(verifiedUser).includes(newRole)) { navigatePath(paths.unauthorized); return; }
    const updated = { ...verifiedUser, role: newRole, roles: verifiedUser.roles || [verifiedUser.role] };
    setCurrentRole(newRole);
    setCurrentUser(updated);
    setStoredUser(updated);
    navigatePath(getRoleLandingPath(newRole));
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
      setActiveTab('marketplace');
      return;
    }

    // 3. Trường hợp bài đăng chờ Staff đối soát thủ công
    if (isPendingReview) {
      showToast(
        lang === 'vi'
          ? `Bài đăng "${newListing.title}" đã được gửi và đang chờ duyệt (PENDING).`
          : `Listing "${newListing.title}" is pending review.`
      );
      setActiveTab('marketplace');
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

    // 5. Trường hợp AI duyệt thành công (ACTIVE): Tự động quay về Sàn đồ cũ
    const targetTab = 'marketplace';
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

    // 1. Nhận diện danh mục, loại sản phẩm và thương hiệu thông minh từ catalog & metadata
    const resolvedProduct = resolveCategoryAndItem({
      postId: post.postId || post.id,
      categoryId: post.categoryId,
      itemId: post.itemId,
      title: cleanTitle,
      description: post.description || post.aiDescription,
      category: post.category,
      brand: post.brand,
      model: post.model,
    });

    let detectedCategory: ItemCategory = (resolvedProduct.displayCategory || 'Đồ gia dụng') as ItemCategory;
    let detectedBrand = resolvedProduct.brand || 'Chính hãng';

    // 2. Nhận diện tình trạng máy (Condition Grade)
    let detectedGrade: ConditionGrade = 'Like New';
    const conditionStr = (post.itemCondition || descLower).toLowerCase();
    if (conditionStr.includes('99%') || conditionStr.includes('như mới') || conditionStr.includes('like new') || conditionStr.includes('brand new')) {
      detectedGrade = 'Like New';
    } else if (conditionStr.includes('95%') || conditionStr.includes('tốt') || conditionStr.includes('good') || conditionStr.includes('chắc chắn')) {
      detectedGrade = 'Good';
    } else if (conditionStr.includes('90%') || conditionStr.includes('khá') || conditionStr.includes('fair')) {
      detectedGrade = 'Fair';
    }

    // 3. Ảnh gia dụng chất lượng cao theo đúng phân loại
    const categoryFallbacks: Record<string, string[]> = {
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
      'Phòng ngủ': [
        'https://images.unsplash.com/photo-1558997519-83ea9252def8?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&q=80&w=800'
      ],
      'Tủ quần áo': [
        'https://images.unsplash.com/photo-1558997519-83ea9252def8?auto=format&fit=crop&q=80&w=800'
      ],
      'Khung giường': [
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=800'
      ],
      'Phòng khách': [
        'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800'
      ],
      'Sofa / Ghế dài': [
        'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800'
      ],
      'Bếp & Phòng ăn': [
        'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800'
      ],
      'Ban công & Giặt giũ': [
        'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&q=80&w=800'
      ],
      'Phòng tắm & Vệ sinh': [
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800'
      ],
      'Khác': [
        'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&q=80&w=800'
      ]
    };

    const fallbackList = categoryFallbacks[detectedCategory] || categoryFallbacks[resolvedProduct.categoryName] || [
      'https://images.unsplash.com/photo-1558997519-83ea9252def8?auto=format&fit=crop&q=80&w=800'
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
        (post.user?.email && currentUser.email && post.user.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()) ||
        (post.user?.fullName && currentUser.name && post.user.fullName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) ||
        (post.user?.name && currentUser.name && post.user.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
    );

    const savedAddr = getSavedSellerAddress();
    const currentSellerAddr = currentUser?.pickupAddress || currentUser?.address || savedAddr.address;
    const currentSellerWard = currentUser?.wardName || currentUser?.ward || savedAddr.wardName;
    const currentSellerProv = currentUser?.provinceName || currentUser?.province || savedAddr.provinceName;

    // 1. Nếu là bài đăng của chính seller hiện tại, ưu tiên lấy địa chỉ người bán mới nhất từ profile / onboarding
    if (isOwner && (currentSellerAddr || currentSellerWard || currentSellerProv)) {
      postLocation = extractWardAndCity(currentSellerAddr, currentSellerWard, currentSellerProv);
      postSellerAddress = cleanFullAddress(currentSellerAddr) || (currentSellerWard && currentSellerProv ? `${currentSellerWard}, ${currentSellerProv}` : '');
    } else {
      // 2. Bài đăng từ backend của seller khác
      const rawPostAddr = post.sellerAddress || post.pickupAddress || post.user?.address || (
        post.user?.profile ? formatCombinedAddress(post.user.profile.streetAddress, post.user.profile.ward, post.user.profile.district, post.user.profile.province) : null
      );
      if (rawPostAddr) {
        postSellerAddress = cleanFullAddress(rawPostAddr);
        postLocation = extractWardAndCity(postSellerAddress);
      } else if (post.location && post.location.toLowerCase() !== 'việt nam' && post.location.toLowerCase() !== 'toàn quốc') {
        postSellerAddress = cleanFullAddress(post.location);
        postLocation = extractWardAndCity(postSellerAddress);
      }
    }

    if ((!postLocation || !postSellerAddress) && isOwner && (currentSellerAddr || currentSellerWard || currentSellerProv)) {
      postLocation = postLocation || extractWardAndCity(currentSellerAddr, currentSellerWard, currentSellerProv);
      postSellerAddress = postSellerAddress || cleanFullAddress(currentSellerAddr);
    }

    if (postSellerAddress) {
      postSellerAddress = cleanFullAddress(postSellerAddress);
    }
    if (!postLocation) {
      postLocation = postSellerAddress ? extractWardAndCity(postSellerAddress) : 'Hà Nội';
    }
    if (!postSellerAddress) {
      postSellerAddress = postLocation;
    }

    const resolvedParcel = getResolvedPostParcel(
      post.postId || post.id,
      post,
      post.description || post.aiDescription,
      detectedCategory
    );

    return {
      id: post.postId || post.id || `post-${Date.now()}`,
      categoryId: post.categoryId || resolvedProduct.categoryId,
      itemId: post.itemId || resolvedProduct.itemId,
      categoryName: resolvedProduct.categoryName,
      itemName: resolvedProduct.itemName,
      title: cleanTitle,
      category: (resolvedProduct.displayCategory || detectedCategory) as ItemCategory,
      brand: detectedBrand,
      model: post.model || resolvedProduct.model || 'Standard',
      purchaseYear: 2024,
      priceVnd: price,
      originalPriceVnd: extractSellerOriginalPrice(post) || undefined,
      conditionGrade: detectedGrade,
      declaredConditionText: post.itemCondition || (detectedGrade === 'Like New' ? 'Độ mới 99%, nguyên zin chưa sửa chữa' : 'Tình trạng tốt, hoạt động ổn định'),
      description: post.description || post.aiDescription || 'Đã qua thẩm định và xác thực trên hệ thống SecondLife.',
      location: postLocation,
      sellerAddress: postSellerAddress,
      sellerId: post.sellerId || post.user?.id || post.userId || (isOwner && currentUser ? currentUser.id : ''),
      sellerName: isOwner && currentUser?.name ? currentUser.name : (post.sellerName || post.user?.profile?.fullName || post.user?.fullName || post.user?.email || 'Người bán SecondLife'),
      sellerAvatar: post.sellerAvatar || post.user?.profile?.avatarUrl || post.user?.avatarUrl || undefined,
      sellerRating: post.sellerRating ?? 0,
      sellerCompletedOrders: post.sellerCompletedOrders ?? (post.user?.completedOrdersCount ?? 0),
      sellerVerified: true,
      status: (
        localStorage.getItem(`listing_available_${post.postId || post.id}`) === 'true'
          ? 'active'
          : (getBoughtListingIds().has(String(post.postId || post.id)) ? 'reserved' : (post.status === 'ACTIVE' ? 'active' : post.status === 'DRAFT' ? 'draft' : 'reserved'))
      ) as any,
      backendStatus: (
        localStorage.getItem(`listing_available_${post.postId || post.id}`) === 'true'
          ? 'ACTIVE'
          : (getBoughtListingIds().has(String(post.postId || post.id)) ? 'RESERVED' : (post.status || 'ACTIVE'))
      ),
      rejectionReason: post.rejectionReason,
      createdAt: post.publishedAt || post.createdAt || new Date().toISOString(),
      isInspectionGuaranteed: true,
      requiresInspection: price > 5000000,
      isInspected: isListingInspectionPassed(post),
      inspectionPassed: isListingInspectionPassed(post),
      photos: {
        front: photoList[0] || defaultImg,
        back: photoList[1] || '',
        screenOrDetails: photoList[2] || '',
        accessoriesOrBox: photoList[3] || '',
        serialOrReceipt: photoList[4] || '',
        extraDetail: photoList[5] || '',
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
      shippingWeight: resolvedParcel.weight,
      shippingLength: resolvedParcel.length,
      shippingWidth: resolvedParcel.width,
      shippingHeight: resolvedParcel.height,
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
  const loadListingsFromBackend = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && isFetchingListingsRef.current) return;
    if (!force && now - lastListingsFetchRef.current < 20000 && listingsRef.current.length > 0) {
      return;
    }
    isFetchingListingsRef.current = true;
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
            postCacheMap.set(String(l.id), l);
            if (l.title) {
              postTitleCacheMap.set(l.title.toLowerCase().trim(), l);
            }
          }
        });

        // Giữ lại các listing vừa được khôi phục ACTIVE mà BE chưa kịp trả về
        const existingMappedIds = new Set(mapped.map((l) => String(l.id)));
        const boughtIds = getBoughtListingIds();
        const activeRestored = listingsRef.current.filter((l) =>
          (l.status === 'active' || l.backendStatus === 'ACTIVE' || localStorage.getItem(`listing_available_${l.id}`) === 'true') &&
          !existingMappedIds.has(String(l.id)) &&
          !boughtIds.has(String(l.id))
        );
        setListings([...mapped, ...activeRestored]);
      } else {
        const boughtIds = getBoughtListingIds();
        const activeRestored = listingsRef.current.filter((l) =>
          (l.status === 'active' || l.backendStatus === 'ACTIVE' || localStorage.getItem(`listing_available_${l.id}`) === 'true') && !boughtIds.has(String(l.id))
        );
        setListings(activeRestored);
      }
      lastListingsFetchRef.current = Date.now();
    } catch (err) {
      console.warn('Lỗi tải danh sách bài đăng từ Backend:', err);
      const boughtIds = getBoughtListingIds();
      const activeRestored = listingsRef.current.filter((l) =>
        (l.status === 'active' || l.backendStatus === 'ACTIVE' || localStorage.getItem(`listing_available_${l.id}`) === 'true') && !boughtIds.has(String(l.id))
      );
      setListings(activeRestored);
    } finally {
      isFetchingListingsRef.current = false;
    }
  }, [mapBackendPostToListing, currentUser?.role, currentRole]);

  // Handle user profile updates (especially seller address) and sync across all listings
  const handleUserProfileUpdated = React.useCallback(
    (updated: UserProfile, successToast?: string) => {
      setCurrentUser(updated);
      setStoredUser(updated);
      const effectiveAddr = cleanFullAddress(updated.pickupAddress || updated.address || '');
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

        // Đồng bộ tức thì địa chỉ mới vào tất cả đơn hàng liên quan
        setOrders((prevOrders) =>
          prevOrders.map((ord) => {
            let updatedOrd = { ...ord };
            if (ord.buyerId === updated.id) {
              updatedOrd.buyerAddress = effectiveAddr || updatedOrd.buyerAddress;
            }
            if (ord.sellerId === updated.id && updatedOrd.listing) {
              updatedOrd.listing = {
                ...updatedOrd.listing,
                location: newLoc || updatedOrd.listing.location,
                sellerAddress: effectiveAddr || updatedOrd.listing.sellerAddress || newLoc,
              };
            }
            return updatedOrd;
          })
        );
      }
      loadListingsFromBackend(true);
      if (successToast) {
        showToast(successToast);
      }
    },
    [loadListingsFromBackend]
  );

  // Synchronize orders directly with Backend
  const loadUserOrders = React.useCallback(async (force = false) => {
    const currentUser = currentUserRef.current;
    if (!currentUser || !getAccessToken()) {
      setOrders([]);
      setIsOrdersLoading(false);
      return;
    }
    // The center page owns its orders. Avoid loading the same data (and chats) in App.
    if (isRestoringSession || isCenterAccount) {
      if (isCenterAccount) setIsOrdersLoading(false);
      return;
    }
    const scope = `${currentUser.id}:${currentRole}`;
    if (pendingOrdersRef.current?.scope === scope) {
      if (force) pendingOrdersRef.current.refresh = true;
      return;
    }
    if (lastOrdersScopeRef.current !== scope) lastOrdersFetchRef.current = 0;
    const now = Date.now();
    if (!force && now - lastOrdersFetchRef.current < 3000) {
      return;
    }
    lastOrdersFetchRef.current = now;
    lastOrdersScopeRef.current = scope;
    const pending = { scope, refresh: false };
    pendingOrdersRef.current = pending;
    try {
      const isInspector = currentUser?.role === 'inspector' || currentRole === 'inspector';
      const isAdmin = currentUser?.role === 'admin' || currentRole === 'admin';
      const isStaff = currentUser?.role === 'staff' || currentRole === 'staff';
      const isInternalRole = isInspector || isAdmin || isStaff;

      const [buyerRes, sellerRes, inspBuyerRes, inspSellerRes, chatRooms, inspMyRes] = await Promise.all([
        !isInternalRole ? orderService.getBuyerOrders(0, 50).catch(() => ({ content: [] })) : Promise.resolve({ content: [] }),
        !isInternalRole ? orderService.getSellerOrders(0, 50).catch(() => ({ content: [] })) : Promise.resolve({ content: [] }),
        !isInternalRole ? inspectorService.getMyBuyerOrders(0, 50).catch(() => ({ items: [] } as any)) : Promise.resolve({ items: [] } as any),
        !isInternalRole ? inspectorService.getMySellerOrders(0, 50).catch(() => ({ items: [] } as any)) : Promise.resolve({ items: [] } as any),
        !isInternalRole ? chatService.getChatRooms().catch(() => [] as any[]) : Promise.resolve([] as any[]),
        isInspector ? inspectorService.getMyOrders().catch(() => [] as any[]) : Promise.resolve([] as any[])
      ]);
      if (ordersScopeRef.current !== scope) return;

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
      const rawInspMyItems = (inspMyRes as any)?.data?.items || (inspMyRes as any)?.items || (inspMyRes as any)?.content || (Array.isArray(inspMyRes) ? inspMyRes : []);

      // Collect cancelled post IDs from buyer and seller orders
      const cancelledPostIds = new Set<string>();
      rawBuyerItems.forEach((item: any) => {
        const isCancelled = item?.status === 'CANCELLED' || item?.escrowStatus === 'REFUNDED' || item?.escrowStatus === 'REFUNDED_TO_BUYER';
        if (isCancelled) {
          const pid = String(item.postId || item.post?.id || item.post?.postId || '');
          if (pid) cancelledPostIds.add(pid);
        }
      });
      rawSellerItems.forEach((item: any) => {
        const isCancelled = item?.status === 'CANCELLED' || item?.escrowStatus === 'REFUNDED' || item?.escrowStatus === 'REFUNDED_TO_BUYER';
        if (isCancelled) {
          const pid = String(item.postId || item.post?.id || item.post?.postId || '');
          if (pid) cancelledPostIds.add(pid);
        }
      });

      // Deduplicate by order id
      const orderMap = new Map<string, any>();
      rawBuyerItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: false }); });
      rawSellerItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: false }); });
      rawInspBuyerItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: true }); });
      rawInspSellerItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: true }); });
      rawInspMyItems.forEach((item: any) => { if (item?.id) orderMap.set(item.id, { ...item, __isInspection: true }); });

      // Nạp thêm các đơn kiểm định cục bộ từ my_seller_inspection_orders và recent_placed_orders
      try {
        const rawLocalSellerInsp = localStorage.getItem('my_seller_inspection_orders');
        if (rawLocalSellerInsp) {
          const list = JSON.parse(rawLocalSellerInsp);
          if (Array.isArray(list)) {
            list.forEach((item: any) => {
              if (item?.id && !orderMap.has(item.id)) {
                orderMap.set(item.id, { ...item, __isInspection: true });
              }
            });
          }
        }
      } catch {}

      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent) {
          const list = JSON.parse(rawRecent);
          if (Array.isArray(list)) {
            list.forEach((item: any) => {
              if (item?.id && !orderMap.has(item.id)) {
                orderMap.set(item.id, { ...item, __isInspection: Boolean(item.hasInspectionService || item.inspectionFeeVnd) });
              }
            });
          }
        }
      } catch {}

      const items = Array.from(orderMap.values());
      if (items && items.length > 0) {
        const currentListings = listingsRef.current;
        const mappedOrders: EscrowOrder[] = items.map((bOrd: any) => {
          let cachedListing: any = (bOrd.postId ? postCacheMap.get(String(bOrd.postId)) : null)
            || (bOrd.postTitle ? postTitleCacheMap.get(bOrd.postTitle.toLowerCase().trim()) : null);

          if (!cachedListing) {
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
          }

          const directMatched = currentListings.find(l => l.id === bOrd.postId || (bOrd.postTitle && l.title === bOrd.postTitle));
          const baseListing = directMatched || cachedListing;

          const backendPostImg = (bOrd as any).postImageUrl || (bOrd as any).postImageUrls?.[0];
          const resolvedPostTitle = bOrd.postTitle || baseListing?.title || postTitleMap.get(bOrd.postId) || 'Thiết bị gia dụng SecondLife';
          const resolvedImage = backendPostImg
            || postImageMap.get(bOrd.postId)
            || (baseListing?.photos?.front && !baseListing.photos.front.includes('photo-1555041469') && !baseListing.photos.front.includes('photo-1584269600464') ? baseListing.photos.front : '')
            || (baseListing?.photoGallery?.[0] && !baseListing.photoGallery[0].includes('photo-1555041469') && !baseListing.photoGallery[0].includes('photo-1584269600464') ? baseListing.photoGallery[0] : '')
            || baseListing?.photos?.front
            || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800';

          const rawMatchedListing = baseListing ? {
            ...baseListing,
            title: resolvedPostTitle,
            photos: {
              ...baseListing.photos,
              front: resolvedImage,
              back: (bOrd as any).postImageUrls?.[1] || baseListing.photos?.back || resolvedImage,
              screenOrDetails: (bOrd as any).postImageUrls?.[2] || baseListing.photos?.screenOrDetails || resolvedImage,
              accessoriesOrBox: baseListing.photos?.accessoriesOrBox || resolvedImage,
              serialOrReceipt: baseListing.photos?.serialOrReceipt || resolvedImage,
            },
            photoGallery: ((bOrd as any).postImageUrls && (bOrd as any).postImageUrls.length > 0)
              ? (bOrd as any).postImageUrls
              : ((baseListing.photoGallery && baseListing.photoGallery.length > 0) ? baseListing.photoGallery : [resolvedImage]),
          } : {
            id: bOrd.postId,
            title: resolvedPostTitle,
            category: 'Nội thất & Gia dụng',
            brand: 'SecondLife',
            model: 'Verified Model',
            purchaseYear: 2024,
            priceVnd: Number(bOrd.itemPriceVnd || bOrd.finalItemPrice || bOrd.postPrice || bOrd.finalPrice || bOrd.price || 0),
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

          const matchedListing = resolveOrderListing(rawMatchedListing);

          const inspFee = Number(bOrd.inspectionFeeVnd || bOrd.buyerInspectionFeeVnd || bOrd.buyerFeeShare || bOrd.inspectionFee || 0);
          const isInspectionOrder = Boolean(bOrd.__isInspection || bOrd.hasInspectionService || inspFee > 0 || bOrd.orderType);
          const rawStatusUpper = String(bOrd.status || (bOrd as any).backendStatus || '').toUpperCase();
          const customerInspectionStatus = getCustomerInspectionStatus(rawStatusUpper, bOrd.customerStatus, bOrd.inspectorId);
          const inspectionStage = bOrd.__isInspection && getBuyerInspectionStage({
            inspectionStatus: customerInspectionStatus,
            inspectionNote: bOrd.note,
            finalPaymentPaidAt: bOrd.finalPaymentPaidAt,
            linkedOrderId: bOrd.linkedOrderId,
          });

          const isReceiptConfirmedLocal =
            !inspectionStage &&
            typeof window !== 'undefined' &&
            localStorage.getItem(`order_receipt_confirmed_${bOrd.id}`) === 'true';

          const isCompletedOrReleased = Boolean(
            bOrd.escrowStatus === 'RELEASED' ||
            bOrd.escrowStatus === 'COMPLETED_RELEASED' ||
            bOrd.status === 'COMPLETED' ||
            bOrd.status === 'RELEASED' ||
            (bOrd as any).backendStatus === 'COMPLETED' ||
            bOrd.releasedAt ||
            bOrd.released_at ||
            isReceiptConfirmedLocal
          );

          const activeInspectionStatuses = [
            'WAITING_SELLER_APPROVAL',
            'WAITING_BUYER_APPROVAL',
            'WAITING_FEE_PAYMENT',
            'CONFIRMED_PENDING_DISPATCH',
            'DISPATCHED',
            'SCHEDULED',
            'SHIPPING_TO_CENTER',
            'INSPECTING',
            'PASSED',
            'DELIVERING_TO_BUYER',
          ];
          const isActivelyProcessingInspection = isInspectionOrder && activeInspectionStatuses.includes(rawStatusUpper);

          if (isActivelyProcessingInspection && typeof window !== 'undefined') {
            try {
              localStorage.removeItem(`order_cancellation_info_${bOrd.id}`);
              localStorage.removeItem(`order_cancelled_${bOrd.id}`);
            } catch {}
          }

          const isLocalCancelled = !isActivelyProcessingInspection && typeof window !== 'undefined' && (
            localStorage.getItem(`order_cancellation_info_${bOrd.id}`) !== null ||
            localStorage.getItem(`order_cancelled_${bOrd.id}`) === 'true'
          );

          const isCancelledOrRefund = !isCompletedOrReleased && !isActivelyProcessingInspection && Boolean(
            isLocalCancelled ||
            bOrd.escrowStatus === 'CANCELLED' ||
            bOrd.escrowStatus === 'REFUNDED' ||
            bOrd.escrowStatus === 'REFUNDED_TO_BUYER' ||
            bOrd.status === 'CANCELLED' ||
            bOrd.status === 'FAILED' ||
            bOrd.status === 'PAYMENT_EXPIRED' ||
            bOrd.status === 'REJECTED'
          );

          let mappedEscrowStatus: EscrowOrder['escrowStatus'] = 'AWAITING_PAYMENT';
          if (isCompletedOrReleased) {
            mappedEscrowStatus = 'COMPLETED_RELEASED';
          } else if (isCancelledOrRefund) {
            mappedEscrowStatus = 'REFUNDED_TO_BUYER';
          } else if (isInspectionOrder) {
            const localSavedStatus = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${bOrd.id}`) : null;
            const s = bOrd.__isInspection && (bOrd.customerStatus || customerInspectionStatus === 'INSPECTING')
              ? customerInspectionStatus : String(localSavedStatus || bOrd.status || bOrd.backendStatus || '');
            if (s === 'PASSED') {
              mappedEscrowStatus = 'INSPECTION_PASSED';
            } else if (s === 'FAILED' || s === 'REJECTED') {
              mappedEscrowStatus = 'INSPECTION_FAILED';
            } else if (s === 'INSPECTING') {
              mappedEscrowStatus = 'INSPECTION_IN_PROGRESS';
            } else if (s === 'DELIVERING_TO_BUYER') {
              mappedEscrowStatus = 'SHIPPED_TO_BUYER';
            } else if (s === 'COMPLETED') {
              mappedEscrowStatus = 'COMPLETED_RELEASED';
            } else if (s === 'DISPUTED') {
              mappedEscrowStatus = 'DISPUTED';
            } else if (s === 'CANCELLED' || s === 'PAYMENT_EXPIRED') {
              mappedEscrowStatus = 'REFUNDED_TO_BUYER';
            } else {
              // WAITING_SELLER_APPROVAL, WAITING_BUYER_APPROVAL, CONFIRMED_PENDING_DISPATCH, DISPATCHED, SCHEDULED, SHIPPING_TO_CENTER
              // Trạng thái ban đầu luôn là Chờ kiểm định
              mappedEscrowStatus = 'AWAITING_INSPECTION';
            }
          } else {
            if (bOrd.escrowStatus === 'RELEASED' || bOrd.status === 'COMPLETED') {
              mappedEscrowStatus = 'COMPLETED_RELEASED';
            } else if (bOrd.status === 'DELIVERED') {
              mappedEscrowStatus = 'DELIVERED_INSPECTION_WINDOW';
            } else if (bOrd.status === 'SHIPPED') {
              mappedEscrowStatus = 'SHIPPED_TO_BUYER';
            } else if (
              bOrd.status === 'PROCESSING' ||
              bOrd.status === 'CONFIRMED' ||
              bOrd.escrowStatus === 'HELD' ||
              bOrd.escrowStatus === 'FROZEN' ||
              Boolean(bOrd.paidAt)
            ) {
              mappedEscrowStatus = 'HELD_IN_ESCROW';
            } else if (
              bOrd.status === 'PENDING_PAYMENT' ||
              bOrd.status === 'PENDING' ||
              bOrd.escrowStatus === 'PENDING' ||
              bOrd.escrowStatus === 'PENDING_PAYMENT'
            ) {
              mappedEscrowStatus = 'AWAITING_PAYMENT';
            } else {
              mappedEscrowStatus = 'AWAITING_PAYMENT';
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

          const buyerAddr = (currentUser && currentUser.id === bOrd.buyerId && (currentUser.address || currentUser.pickupAddress))
            ? (currentUser.address || currentUser.pickupAddress || '')
            : typeof bOrd.deliveryAddress === 'string'
              ? (parsedAddressObj?.address || bOrd.deliveryAddress)
              : bOrd.deliveryAddress?.detailAddress
                ? `${bOrd.deliveryAddress.detailAddress}, ${bOrd.deliveryAddress.wardName || ''}, ${bOrd.deliveryAddress.provinceName || ''}`
                : (cachedBuyer?.buyerAddress || currentUser?.address || (isInspectionOrder && bOrd.orderType !== 'AT_HOME' ? 'Trạm Kiểm Định SecondLife Hub' : 'Địa chỉ nhận hàng của người mua'));

          const itemPrice = Number(bOrd.itemPriceVnd || bOrd.finalItemPrice || bOrd.postPrice || bOrd.finalPrice || bOrd.price || bOrd.listing?.priceVnd || matchedListing?.priceVnd || 0);
          const shipFee = Number(bOrd.shippingFeeVnd || bOrd.shippingFee || bOrd.finalShippingFee || 0);
          const totalPaid = Number(bOrd.totalPaidVnd || bOrd.totalPaid || (itemPrice + inspFee + shipFee));

          let resolvedInspectorId = bOrd.inspectorId;
          let resolvedInspectorName = bOrd.inspectorName;
          let resolvedInspectorEmail = (bOrd as any).inspectorEmail;
          let resolvedInspectorPhone = (bOrd as any).inspectorPhone;
          try {
            const rawAssign = localStorage.getItem(`order_assigned_inspector_${bOrd.id}`);
            if (rawAssign) {
              const assignData = JSON.parse(rawAssign);
              resolvedInspectorId = assignData.inspectorId || resolvedInspectorId;
              resolvedInspectorName = assignData.inspectorName || resolvedInspectorName;
              resolvedInspectorEmail = assignData.inspectorEmail || resolvedInspectorEmail;
              resolvedInspectorPhone = assignData.inspectorPhone || resolvedInspectorPhone;
            }
          } catch {}

          const rawInspOrder = (bOrd as any).inspectionOrder || {};
          const resolvedFeePayer = bOrd.feePayer || (bOrd as any).counterFeePayer || rawInspOrder.feePayer || undefined;
          const resolvedFeeSplit: 'BUYER_100' | 'SPLIT_50_50' | 'SELLER_100' =
            bOrd.inspectionFeeSplit ||
            rawInspOrder.inspectionFeeSplit ||
            (resolvedFeePayer === 'SELLER_PAYS' ? 'SELLER_100' :
             resolvedFeePayer === 'SPLIT_50_50' ? 'SPLIT_50_50' :
             resolvedFeePayer === 'BUYER_PAYS' ? 'BUYER_100' :
             (bOrd.sellerFeeShare && Number(bOrd.sellerFeeShare) > 0 && bOrd.buyerFeeShare && Number(bOrd.buyerFeeShare) > 0) ? 'SPLIT_50_50' :
             (bOrd.sellerFeeShare && Number(bOrd.sellerFeeShare) > 0) ? 'SELLER_100' : 'BUYER_100');

          const resolvedSellerFeeShare = bOrd.sellerFeeShare !== undefined && bOrd.sellerFeeShare !== null
            ? Number(bOrd.sellerFeeShare)
            : ((bOrd as any).sellerInspectionFeeVnd !== undefined && (bOrd as any).sellerInspectionFeeVnd !== null
              ? Number((bOrd as any).sellerInspectionFeeVnd)
              : (rawInspOrder.sellerFeeShare !== undefined ? Number(rawInspOrder.sellerFeeShare) :
                (resolvedFeeSplit === 'SPLIT_50_50' ? Math.round(inspFee / 2) : (resolvedFeeSplit === 'SELLER_100' ? inspFee : 0))));

          const resolvedBuyerFeeShare = bOrd.buyerFeeShare !== undefined && bOrd.buyerFeeShare !== null
            ? Number(bOrd.buyerFeeShare)
            : ((bOrd as any).buyerInspectionFeeVnd !== undefined && (bOrd as any).buyerInspectionFeeVnd !== null
              ? Number((bOrd as any).buyerInspectionFeeVnd)
              : (rawInspOrder.buyerFeeShare !== undefined ? Number(rawInspOrder.buyerFeeShare) :
                (resolvedFeeSplit === 'SPLIT_50_50' ? Math.round(inspFee / 2) : (resolvedFeeSplit === 'BUYER_100' ? inspFee : 0))));

          const resolvedPaymentDeadline = bOrd.paymentDeadline || rawInspOrder.paymentDeadline || null;
          const resolvedBuyerPaidAt = bOrd.buyerPaidAt || (bOrd as any).buyer_paid_at || rawInspOrder.buyerPaidAt || null;
          const resolvedSellerPaidAt = bOrd.sellerPaidAt || (bOrd as any).seller_paid_at || rawInspOrder.sellerPaidAt || null;

          const mappedOrder: EscrowOrder = {
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
            escrowStatus: isCompletedOrReleased ? 'COMPLETED_RELEASED' : (isCancelledOrRefund ? 'REFUNDED_TO_BUYER' : mappedEscrowStatus),
            backendStatus: isCompletedOrReleased ? 'COMPLETED' : (isCancelledOrRefund ? 'CANCELLED' : ((mappedEscrowStatus === 'INSPECTION_PASSED' ? 'PASSED' : mappedEscrowStatus === 'INSPECTION_FAILED' ? 'FAILED' : bOrd.backendStatus || bOrd.status || (isInspectionOrder ? 'WAITING_SELLER_APPROVAL' : 'PROCESSING')) as any)),
            status: isCompletedOrReleased ? 'COMPLETED' : (isCancelledOrRefund ? 'CANCELLED' : (mappedEscrowStatus === 'INSPECTION_PASSED' ? 'PASSED' : mappedEscrowStatus === 'INSPECTION_FAILED' ? 'FAILED' : (bOrd.status || bOrd.backendStatus || 'INSPECTING'))),
            inspectorId: resolvedInspectorId || undefined,
            inspectorName: resolvedInspectorName || undefined,
            inspectorEmail: resolvedInspectorEmail || undefined,
            inspectorPhone: resolvedInspectorPhone || undefined,
            shippingQuoteId: bOrd.shippingQuoteId,
            shippingDeliveredAt: bOrd.shippingDeliveredAt,
            deliveryAddress: bOrd.deliveryAddress,
            sellerConfirmedAt: (() => {
              const inspStatusUpper = String(bOrd.status || (bOrd as any).backendStatus || '').toUpperCase();
              const isInspConfirmedBySeller = isInspectionOrder && (
                bOrd.sellerConsentZin === true ||
                (Boolean(inspStatusUpper) && !['WAITING_SELLER_APPROVAL', 'PENDING'].includes(inspStatusUpper))
              );
              return isInspConfirmedBySeller
                ? (bOrd.sellerPaidAt || bOrd.updatedAt || bOrd.createdAt || new Date().toISOString())
                : (bOrd.sellerConfirmedAt || null);
            })(),
            confirmationDeadline: bOrd.confirmationDeadline || null,
            confirmationCancelAt: bOrd.confirmationCancelAt || null,
            confirmationStatus: (() => {
              const inspStatusUpper = String(bOrd.status || (bOrd as any).backendStatus || '').toUpperCase();
              const isInspConfirmedBySeller = isInspectionOrder && (
                bOrd.sellerConsentZin === true ||
                (Boolean(inspStatusUpper) && !['WAITING_SELLER_APPROVAL', 'PENDING'].includes(inspStatusUpper))
              );
              return isInspConfirmedBySeller
                ? 'CONFIRMED'
                : (bOrd.confirmationStatus || (bOrd.sellerConfirmedAt ? 'CONFIRMED' : 'PENDING'));
            })(),
            sellerReadyAt: (bOrd as any).sellerReadyAt || null,
            carrierPickedUpAt: (bOrd as any).carrierPickedUpAt || null,
            handoverDeadline: (bOrd as any).handoverDeadline || null,
            appointmentScheduledAt: bOrd.appointmentScheduledAt || bOrd.scheduledAt || null,
            appointmentNote: bOrd.appointmentNote || bOrd.note || null,
            cancellationReasonCode: isCompletedOrReleased ? null : (bOrd.cancellationReasonCode || (bOrd as any).cancelReasonCode || (() => {
              try {
                const rawCancel = localStorage.getItem(`order_cancellation_info_${bOrd.id}`);
                if (rawCancel) return JSON.parse(rawCancel).reasonCode;
              } catch {}
              return null;
            })()),
            cancellationReason: isCompletedOrReleased ? null : ((bOrd as any).cancellationReason || (bOrd as any).cancelReason || (() => {
              try {
                const rawCancel = localStorage.getItem(`order_cancellation_info_${bOrd.id}`);
                if (rawCancel) return JSON.parse(rawCancel).reason;
              } catch {}
              return null;
            })()),
            cancelledBy: isCompletedOrReleased ? null : (bOrd.cancelledBy || null),
            hasInspectionService: isInspectionOrder,
            feePayer: resolvedFeePayer,
            inspectionFeeSplit: resolvedFeeSplit,
            sellerFeeShare: resolvedSellerFeeShare,
            buyerFeeShare: resolvedBuyerFeeShare,
            cashShippingSimulation: bOrd.cashShippingSimulation ?? rawInspOrder.cashShippingSimulation,
            sellerInspectionFeeVnd: resolvedSellerFeeShare,
            buyerInspectionFeeVnd: resolvedBuyerFeeShare,
            sellerPaidAt: resolvedSellerPaidAt,
            buyerPaidAt: resolvedBuyerPaidAt,
            paymentDeadline: resolvedPaymentDeadline,
            finalPaymentDeadline: (bOrd as any).finalPaymentDeadline || rawInspOrder.finalPaymentDeadline || null,
            buyerCommitmentDeposit: bOrd.buyerCommitmentDeposit !== undefined ? Number(bOrd.buyerCommitmentDeposit) : (rawInspOrder.buyerCommitmentDeposit !== undefined ? Number(rawInspOrder.buyerCommitmentDeposit) : 0),
            returnShippingReserveFee: bOrd.returnShippingReserveFee !== undefined ? Number(bOrd.returnShippingReserveFee) : (rawInspOrder.returnShippingReserveFee !== undefined ? Number(rawInspOrder.returnShippingReserveFee) : 0),
            feeSettledAt: bOrd.feeSettledAt || rawInspOrder.feeSettledAt || null,
            returnReserveStatus: (bOrd as any).returnReserveStatus || (rawInspOrder as any).returnReserveStatus || (bOrd as any).returnReserve?.status || (rawInspOrder as any).returnReserve?.status || null,
            inspectionCenterId: bOrd.inspectionCenterId || (bOrd as any).inspectionCenter?.id || rawInspOrder.inspectionCenterId || undefined,
            inspectionCenterName: bOrd.inspectionCenterName || (bOrd as any).inspectionCenter?.name || rawInspOrder.inspectionCenterName || undefined,
            inspectionCenterAddress: bOrd.inspectionCenterAddress || (bOrd as any).inspectionCenter?.address || rawInspOrder.inspectionCenterAddress || undefined,
            inspectionCenterPhone: bOrd.inspectionCenterPhone || (bOrd as any).inspectionCenter?.phone || rawInspOrder.inspectionCenterPhone || undefined,
            inspectionStatus: bOrd.__isInspection ? customerInspectionStatus : undefined,
            inspectionNote: bOrd.__isInspection ? bOrd.note : undefined,
            linkedOrderId: bOrd.__isInspection ? bOrd.linkedOrderId : undefined,
            finalPaymentPaidAt: bOrd.__isInspection ? bOrd.finalPaymentPaidAt : undefined,
            inspectionMethod: isInspectionOrder
              ? ((bOrd.orderType === 'AT_HOME' || bOrd.inspectionMethod === 'AT_HOME') ? 'AT_HOME' : 'AT_CENTER')
              : undefined,
            shippingLegs: (isInspectionOrder && bOrd.orderType !== 'AT_HOME')
              ? [
                  {
                    id: 'LEG-1',
                    legType: 'SELLER_TO_CENTER',
                    carrier: 'Lalamove',
                    trackingNumber: (bOrd as any).shipmentOrderCode || (bOrd as any).trackingNumber || '',
                    status: bOrd.status === 'DELIVERED' ? 'DELIVERED' : (bOrd.status === 'SHIPPED' ? 'IN_TRANSIT' : 'PENDING'),
                    origin: (bOrd as any).sellerAddress || matchedListing.sellerAddress || (matchedListing.location && matchedListing.location !== 'Đà Nẵng, Việt Nam' ? matchedListing.location : null) || 'Địa chỉ kho người bán',
                    destination: (bOrd as any).inspectionCenterAddress || resolveInspectionCenter(bOrd).address || 'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh',
                    estimatedDelivery: 'Trong ngày',
                    timeline: [
                      {
                        timestamp: bOrd.createdAt ? new Date(bOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                        description: 'Khởi tạo đơn hàng kiểm định Hub. Chờ bưu tá Lalamove chuyển kiện hàng về Hub.',
                        location: 'Hệ thống SecondLife Hub'
                      }
                    ]
                  },
                  {
                    id: 'LEG-2',
                    legType: 'CENTER_TO_BUYER',
                    carrier: 'Lalamove',
                    trackingNumber: '',
                    status: 'PENDING',
                    origin: (bOrd as any).inspectionCenterAddress || resolveInspectionCenter(bOrd).address || 'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh',
                    destination: buyerAddr,
                    estimatedDelivery: 'Giao nhanh trong ngày sau kiểm định',
                    timeline: [
                      {
                        timestamp: '--:--',
                        description: 'Chờ hoàn tất kiểm định tại Hub và niêm phong giao đến người mua.',
                        location: buyerAddr
                      }
                    ]
                  }
                ]
              : (isInspectionOrder && bOrd.orderType === 'AT_HOME')
              ? [
                  {
                    id: 'LEG-1',
                    legType: 'SELLER_TO_BUYER',
                    carrier: 'SecondLife On-site Team',
                    trackingNumber: '',
                    status: 'PENDING',
                    origin: matchedListing.sellerAddress || matchedListing.location || 'Địa chỉ kho người bán',
                    destination: 'Kiểm định tại nhà người bán',
                    estimatedDelivery: 'Kỹ sư đến tận nơi theo lịch hẹn',
                    timeline: [
                      {
                        timestamp: bOrd.createdAt ? new Date(bOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                        description: 'Cử chuyên viên kỹ thuật đến kiểm định on-site tại nhà người bán.',
                        location: 'Địa chỉ kho người bán'
                      }
                    ]
                  },
                  {
                    id: 'LEG-2',
                    legType: 'SELLER_TO_BUYER',
                    carrier: 'Lalamove',
                    trackingNumber: (bOrd as any).shipmentOrderCode || (bOrd as any).trackingNumber || '',
                    status: bOrd.status === 'DELIVERED' ? 'DELIVERED' : (bOrd.status === 'SHIPPED' ? 'IN_TRANSIT' : 'PENDING'),
                    origin: matchedListing.sellerAddress || matchedListing.location || 'Địa chỉ kho người bán',
                    destination: buyerAddr,
                    estimatedDelivery: 'Giao ngay sau khi kiểm định đạt chuẩn',
                    timeline: [
                      {
                        timestamp: '--:--',
                        description: 'Tài xế Lalamove nhận hàng tại nhà người bán và phát thẳng đến người mua sau khi niêm phong.',
                        location: buyerAddr
                      }
                    ]
                  }
                ]
              : [
                  {
                    id: 'LEG-1',
                    legType: 'SELLER_TO_BUYER',
                    carrier: 'Lalamove',
                    trackingNumber: (bOrd as any).shipmentOrderCode || (bOrd as any).trackingNumber || '',
                    status: bOrd.status === 'DELIVERED' ? 'DELIVERED' : (bOrd.status === 'SHIPPED' ? 'IN_TRANSIT' : 'PENDING'),
                    origin: matchedListing.sellerAddress || matchedListing.location || 'Địa chỉ kho người bán',
                    destination: buyerAddr,
                    estimatedDelivery: '1 - 2 ngày',
                    timeline: [
                      {
                        timestamp: bOrd.createdAt ? new Date(bOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                        description: `Khởi tạo đơn hàng giao trực tiếp. Trạng thái: ${bOrd.status || 'PROCESSING'}.`,
                        location: 'Hệ thống Vận chuyển Lalamove'
                      }
                    ]
                  }
                ],
            createdAt: bOrd.createdAt || bOrd.createdDate || bOrd.created_at || bOrd.paidAt || bOrd.sellerConfirmedAt || bOrd.updatedAt || new Date().toISOString(),
            multiStagePhotos: {
              listingPhotos: Array.from(new Set([
                ...((bOrd as any).postImageUrls || []),
                (bOrd as any).postImageUrl,
                ...(matchedListing.photoGallery || []),
                matchedListing.photos?.front,
                matchedListing.photos?.back,
                matchedListing.photos?.screenOrDetails,
                matchedListing.photos?.accessoriesOrBox,
                matchedListing.photos?.serialOrReceipt,
              ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0))),
              inspectorPhotos: Array.isArray((bOrd as any).inspectorPhotos) && (bOrd as any).inspectorPhotos.length > 0
                ? (bOrd as any).inspectorPhotos
                : (Array.isArray((bOrd as any).proofPhotos) && (bOrd as any).proofPhotos.length > 0
                  ? (bOrd as any).proofPhotos
                  : []),
              handoverPhotos: (bOrd as any).tamperSealPhoto ? [(bOrd as any).tamperSealPhoto] : [],
            }
          };
          if (isCompletedOrReleased && typeof window !== 'undefined') {
            try {
              localStorage.setItem(`order_receipt_confirmed_${bOrd.id}`, 'true');
              localStorage.removeItem(`order_cancellation_info_${bOrd.id}`);
            } catch {}
          }
          return mappedOrder;
        });

        // Merge with recent locally placed orders so newly placed orders are never lost
        const localRecentOrders = getLocalStoredOrders(currentUser);
        const combined = [...mappedOrders];

        const cancelledListingKeys = new Set<string>();
        const activeBackendListingKeys = new Set<string>();
        mappedOrders.forEach((m) => {
          const lid = String(m.listingId || m.listing?.id || '');
          const title = (m.listing?.title || '').trim().toLowerCase();
          if (isOrderCancelledOrRefunded(m)) {
            if (lid) cancelledListingKeys.add(lid);
            if (title) cancelledListingKeys.add(title);
          } else {
            if (lid) activeBackendListingKeys.add(lid);
            if (title) activeBackendListingKeys.add(title);
          }
        });

        const currentUserName = currentUser?.name?.trim().toLowerCase();
        let localStorageNeedsUpdate = false;

        localRecentOrders.forEach((locOrd) => {
          const isLocCompleted =
            (typeof window !== 'undefined' && localStorage.getItem(`order_receipt_confirmed_${locOrd.id}`) === 'true') ||
            (locOrd.escrowStatus as any) === 'RELEASED' ||
            locOrd.escrowStatus === 'COMPLETED_RELEASED' ||
            (locOrd as any).backendStatus === 'COMPLETED';

          const locStatusUpper = String(locOrd.backendStatus || (locOrd as any).status || '').toUpperCase();
          const isLocActiveInspection = Boolean(locOrd.hasInspectionService || locOrd.inspectionMethod || (locOrd.inspectionFeeVnd && locOrd.inspectionFeeVnd > 0)) &&
            [
              'WAITING_SELLER_APPROVAL',
              'WAITING_BUYER_APPROVAL',
              'WAITING_FEE_PAYMENT',
              'CONFIRMED_PENDING_DISPATCH',
              'DISPATCHED',
              'SCHEDULED',
              'SHIPPING_TO_CENTER',
              'INSPECTING',
              'PASSED',
              'DELIVERING_TO_BUYER',
              'AWAITING_INSPECTION',
            ].includes(locStatusUpper);

          const isLocCancelled =
            !isLocCompleted &&
            !isLocActiveInspection && (
              (typeof window !== 'undefined' && (
                localStorage.getItem(`order_cancellation_info_${locOrd.id}`) !== null ||
                localStorage.getItem(`order_cancelled_${locOrd.id}`) === 'true'
              )) ||
              locOrd.escrowStatus === 'REFUNDED_TO_BUYER' ||
              locOrd.backendStatus === 'CANCELLED' ||
              (locOrd as any).status === 'CANCELLED'
            );

          if (isLocCompleted) {
            locOrd.escrowStatus = 'COMPLETED_RELEASED';
            locOrd.backendStatus = 'COMPLETED';
            (locOrd as any).status = 'COMPLETED';
            locOrd.cancellationReasonCode = undefined;
            locOrd.cancellationReason = undefined;
          } else if (isLocActiveInspection) {
            // Khôi phục đơn kiểm định hợp lệ nếu lỡ bị gán nhầm cờ hủy
            if (locOrd.escrowStatus === 'REFUNDED_TO_BUYER' || locOrd.backendStatus === 'CANCELLED') {
              locOrd.escrowStatus = 'AWAITING_INSPECTION';
              locOrd.backendStatus = 'WAITING_SELLER_APPROVAL' as any;
              (locOrd as any).status = 'WAITING_SELLER_APPROVAL';
              locOrd.cancellationReasonCode = undefined;
              locOrd.cancellationReason = undefined;
              if (typeof window !== 'undefined') {
                try {
                  localStorage.removeItem(`order_cancellation_info_${locOrd.id}`);
                  localStorage.removeItem(`order_cancelled_${locOrd.id}`);
                } catch {}
              }
            }
          } else if (isLocCancelled) {
            locOrd.escrowStatus = 'REFUNDED_TO_BUYER';
            locOrd.backendStatus = 'CANCELLED';
            (locOrd as any).status = 'CANCELLED';
            try {
              const rawCancel = localStorage.getItem(`order_cancellation_info_${locOrd.id}`);
              if (rawCancel) {
                const cancelObj = JSON.parse(rawCancel);
                locOrd.cancellationReasonCode = cancelObj.reasonCode || locOrd.cancellationReasonCode;
                locOrd.cancellationReason = cancelObj.reason || locOrd.cancellationReason;
              }
            } catch {}
          }
          const isBuyer = Boolean(
            (currentUser?.id && String(locOrd.buyerId) === String(currentUser.id)) ||
            (locOrd.buyerId === 'buyer-current') ||
            (currentUserName && locOrd.buyerName && locOrd.buyerName.trim().toLowerCase() === currentUserName) ||
            (currentUser?.email && (locOrd as any).buyerEmail && String((locOrd as any).buyerEmail).trim().toLowerCase() === currentUser.email.trim().toLowerCase())
          );
          const isSeller = Boolean(
            (currentUser?.id && String(locOrd.sellerId) === String(currentUser.id)) ||
            (currentUser?.id && locOrd.listing?.sellerId && String(locOrd.listing.sellerId) === String(currentUser.id)) ||
            (currentUser?.id && (locOrd.listing as any)?.userId && String((locOrd.listing as any).userId) === String(currentUser.id)) ||
            (currentUser?.id && (locOrd.listing as any)?.user?.id && String((locOrd.listing as any).user.id) === String(currentUser.id)) ||
            (currentUserName && locOrd.sellerName && locOrd.sellerName.trim().toLowerCase() === currentUserName) ||
            (currentUserName && locOrd.listing?.sellerName && locOrd.listing.sellerName.trim().toLowerCase() === currentUserName) ||
            (currentUser?.email && (locOrd as any).sellerEmail && String((locOrd as any).sellerEmail).trim().toLowerCase() === currentUser.email.trim().toLowerCase()) ||
            (currentUser?.email && (locOrd.listing as any)?.sellerEmail && String((locOrd.listing as any).sellerEmail).trim().toLowerCase() === currentUser.email.trim().toLowerCase()) ||
            (currentRole === 'seller' && !isBuyer)
          );
          const isInspectionRole = Boolean(
            currentUser?.role === 'inspector' ||
            currentRole === 'inspector' ||
            currentUser?.role === 'admin'
          );
          const isInspectionOrder = Boolean(
            locOrd.hasInspectionService ||
            locOrd.inspectionMethod ||
            (locOrd.inspectionFeeVnd && locOrd.inspectionFeeVnd > 0)
          );

          if (!isBuyer && !isSeller && !(isInspectionRole && isInspectionOrder)) return;

          const locListingKey = String(locOrd.listingId || locOrd.listing?.id || '');

          // If backend already has the authoritative order with the exact same ID, skip local duplicate
          const backendHasSameOrder = mappedOrders.some((m) => String(m.id) === String(locOrd.id));
          if (backendHasSameOrder) {
            return;
          }

          if (!combined.some((o) => String(o.id) === String(locOrd.id))) {
            combined.unshift(locOrd);
          }
        });

        // Sắp xếp đơn theo thứ tự thời gian: Mới nhất ở ĐẦU, cũ hơn ở SAU
        combined.sort((a, b) => {
          const timeA = getSortableOrderTimestamp(a);
          const timeB = getSortableOrderTimestamp(b);
          if (timeB !== timeA) return timeB - timeA;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });

        const seenOrderIds = new Set<string>();
        const deduplicatedCombined = combined.filter((o) => {
          const orderId = String(o.id || '');
          if (!orderId) return true;
          if (seenOrderIds.has(orderId)) {
            return false;
          }
          seenOrderIds.add(orderId);
          return true;
        });

        // Cache all orders for instant synchronous reference by getBoughtListingIds
        try {
          localStorage.setItem('all_orders_cache', JSON.stringify(deduplicatedCombined));
        } catch {}

        // Reconcile and free up any listings whose orders are refunded/cancelled
        reconcileBoughtListingIds(deduplicatedCombined);

        // Identify listings that should be restored to 'active' on the floor
        const cancelledListingIds = new Set<string>();
        deduplicatedCombined.forEach((o) => {
          const lid = extractListingIdFromOrder(o);
          if (!lid) return;
          if (isOrderCancelledOrRefunded(o)) {
            cancelledListingIds.add(lid);
          }
        });

        const freeListings = Array.from(cancelledListingIds);
        if (freeListings.length > 0) {
          freeListings.forEach((lid) => {
            try {
              localStorage.setItem(`listing_available_${lid}`, 'true');
            } catch {}
          });
        }

        setOrders(deduplicatedCombined);
      } else {
        // Even if server returns 0, retain all local recent orders belonging to currentUser
        const localRecentOrders = getLocalStoredOrders(currentUser);
        localRecentOrders.sort((a, b) => {
          const timeA = getSortableOrderTimestamp(a);
          const timeB = getSortableOrderTimestamp(b);
          if (timeB !== timeA) return timeB - timeA;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
        try {
          localStorage.setItem('all_orders_cache', JSON.stringify(localRecentOrders));
        } catch {}
        reconcileBoughtListingIds(localRecentOrders);
        setOrders(localRecentOrders);
      }
      lastOrdersFetchRef.current = Date.now();
    } catch (err) {
      if (ordersScopeRef.current !== scope) return;
      console.warn('Could not load orders from backend:', err);
      const localRecentOrders = getLocalStoredOrders(currentUser);
      try {
        localStorage.setItem('all_orders_cache', JSON.stringify(localRecentOrders));
      } catch {}
      reconcileBoughtListingIds(localRecentOrders);
      setOrders(localRecentOrders);
    } finally {
      setIsOrdersLoading(false);
      if (pendingOrdersRef.current === pending) {
        pendingOrdersRef.current = null;
        if (pending.refresh && ordersScopeRef.current === scope) void refreshOrdersRef.current?.(true);
      }
    }
  }, [currentUser?.id, currentUser?.role, currentRole, isCenterAccount, isRestoringSession, getLocalStoredOrders, mapBackendPostToListing]);
  refreshOrdersRef.current = loadUserOrders;

  // Refresh listings on mount or when switching to listing-centric tabs
  React.useEffect(() => {
    if (routeAccess !== 'allowed' || isRestoringSession) return;
    const listingTabs = ['home', 'marketplace', 'seller-dashboard', 'create-listing', 'admin-dashboard'];
    if (listingTabs.includes(activeTab)) {
      initCatalogCache();
      loadListingsFromBackend();
    }
  }, [loadListingsFromBackend, activeTab, routeAccess, isRestoringSession]);

  // Orders are only refreshed when user accesses order-sensitive tabs or on auth change
  React.useEffect(() => {
    const orderTabs = ['orders', 'seller-dashboard', 'disputes', 'buyer-inspection-decision', 'inspection-hub', 'admin-dashboard'];
    if (routeAccess === 'allowed' && !isRestoringSession && currentUser && orderTabs.includes(activeTab)) {
      loadUserOrders();
    }
  }, [loadUserOrders, activeTab, currentUser?.id, routeAccess, isRestoringSession]);

  // Realtime background polling for new orders when on orders or seller dashboard
  React.useEffect(() => {
    const orderTabs = ['orders', 'seller-dashboard', 'disputes', 'buyer-inspection-decision', 'inspection-hub'];
    if (routeAccess !== 'allowed' || isRestoringSession || !currentUser || !orderTabs.includes(activeTab)) return;

    let timer: any = null;
    const scheduleNext = () => {
      // Khi WebSocket hoạt động: poll rất thưa (45s) làm safety net, giảm tải tối đa cho BE
      // Khi WebSocket mất kết nối: poll dự phòng 20s
      const intervalMs = notificationWsClient.isConnected() ? 45_000 : 20_000;
      timer = setTimeout(() => {
        // Tạm ngưng polling hoàn toàn khi người dùng ẩn tab trình duyệt hoặc nhàn rỗi
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          scheduleNext();
          return;
        }
        if (isUserIdle(30 * 60 * 1000)) {
          scheduleNext();
          return;
        }

        loadUserOrders().finally(() => {
          scheduleNext();
        });
      }, intervalMs);
    };

    scheduleNext();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeTab, currentUser, loadUserOrders, routeAccess, isRestoringSession]);

  // Ensure WebSocket STOMP notification client is connected for authenticated user
  React.useEffect(() => {
    const token = getAccessToken();
    if (token && currentUser?.id) {
      notificationWsClient.connect(token);
    }
  }, [currentUser?.id]);

  // Event-driven real-time synchronization via WebSocket STOMP
  React.useEffect(() => {
    if (routeAccess !== 'allowed' || isRestoringSession || !currentUser?.id) return;

    // A. Lắng nghe real-time notification events từ WebSocket STOMP
    const unsubWs = notificationWsClient.subscribeListener((notification) => {
      const ref = String(notification.referenceType || '').toUpperCase();
      if (
        !ref ||
        ref === 'INSPECTION_ORDER' ||
        ref === 'ORDER' ||
        ref === 'ESCROW' ||
        ref === 'SHIPMENT' ||
        ref === 'PAYMENT' ||
        ref === 'DISPUTE'
      ) {
        void loadUserOrders(true);
      }
    });

    // B. Khi người dùng focus lại tab sau khi chuyển tab/cửa sổ khác -> Sync tức thì 1 lần
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isUserIdle(30 * 60 * 1000)) {
        void loadUserOrders(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubWs();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.id, loadUserOrders, routeAccess, isRestoringSession]);

  // Listen for instant order placement events across windows/tabs (debounced to avoid loop)
  React.useEffect(() => {
    let timer: any = null;
    const triggerDebouncedFetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        loadUserOrders(true);
      }, 600);
    };

    window.addEventListener('secondlife_order_placed_signal', triggerDebouncedFetch);
    window.addEventListener('secondlife_inspection_task_created', triggerDebouncedFetch);
    window.addEventListener('secondlife_order_assigned_signal', triggerDebouncedFetch);
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'secondlife_order_placed_signal' ||
        e.key === 'recent_placed_orders' ||
        e.key === 'center_inspection_orders' ||
        e.key?.startsWith('order_assigned_inspector_')
      ) {
        triggerDebouncedFetch();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('secondlife_order_placed_signal', triggerDebouncedFetch);
      window.removeEventListener('secondlife_inspection_task_created', triggerDebouncedFetch);
      window.removeEventListener('secondlife_order_assigned_signal', triggerDebouncedFetch);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadUserOrders]);

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
        buyerId: newOrder.buyerId,
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

    // Lập tức ẩn sản phẩm vừa mua khỏi sàn (status -> reserved)
    const boughtListingId = newOrder.listingId || newOrder.listing?.id;
    if (boughtListingId) {
      markListingAsBought(String(boughtListingId));
      setListings((prev) =>
        prev.map((l) =>
          String(l.id) === String(boughtListingId) ? { ...l, status: 'reserved', backendStatus: 'RESERVED' } : l
        )
      );
    }
    loadListingsFromBackend(true);

    setOrders((prev) => {
      const filtered = prev.filter((o) => o.id !== newOrder.id);
      const nextList = [newOrder, ...filtered];
      nextList.sort((a, b) => {
        const timeA = getSortableOrderTimestamp(a);
        const timeB = getSortableOrderTimestamp(b);
        if (timeB !== timeA) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
      const seenActiveListingIds = new Set<string>();
      return nextList.filter((o) => {
        const isEnded = o.escrowStatus === 'REFUNDED_TO_BUYER' || o.escrowStatus === 'COMPLETED_RELEASED' || o.backendStatus === 'CANCELLED';
        const listingKey = String(o.listingId || o.listing?.id || '');
        if (listingKey && !isEnded) {
          if (seenActiveListingIds.has(listingKey)) return false;
          seenActiveListingIds.add(listingKey);
        }
        return true;
      });
    });
    setCheckoutListing(null);
    setCheckoutAgreedPrice(undefined);
    setCheckoutNegotiationId(undefined);
    setSelectedListing(null);
    navigatePath(paths.orders(currentRole) + (newOrder.hasInspectionService ? '?filter=inspecting' : '?filter=all'));
    if (newOrder.hasInspectionService) {
      try {
        sessionStorage.setItem('secondlife_orders_filter_tab', 'inspecting');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('order_tab');
        newUrl.searchParams.delete('tab');
        newUrl.searchParams.delete('tap');
        if (newUrl.toString() !== window.location.href) {
          window.history.replaceState(null, '', newUrl.toString());
        }
        window.dispatchEvent(new Event('secondlife_tab_changed'));
      } catch {}
    } else {
      try {
        sessionStorage.setItem('secondlife_orders_filter_tab', 'all');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('order_tab');
        newUrl.searchParams.delete('tab');
        newUrl.searchParams.delete('tap');
        if (newUrl.toString() !== window.location.href) {
          window.history.replaceState(null, '', newUrl.toString());
        }
        window.dispatchEvent(new Event('secondlife_tab_changed'));
      } catch {}
    }
    loadUserWallet();
    showToast(`Đã phong tỏa Escrow ${formatVND(newOrder.totalPaidVnd)} cho đơn hàng #${newOrder.id}! Bưu tá đang chuẩn bị lấy hàng.`);
  };

  const handleConfirmReceipt = async (orderId: string) => {
    const order = orders.find((item) => item.id === orderId);
    if (order && getBuyerInspectionStage(order)) return;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`order_receipt_confirmed_${orderId}`, 'true');
      }
      setOrders((prev) =>
        prev.map((ord) =>
          ord.id === orderId
            ? { ...ord, escrowStatus: 'COMPLETED_RELEASED', backendStatus: 'COMPLETED', status: 'COMPLETED' }
            : ord
        )
      );
      await orderService.confirmDelivery(orderId);
      showToast(lang === 'vi' ? 'Đã xác nhận nhận hàng! Tiền trong Escrow đã được giải ngân thành công cho người bán.' : 'Delivery confirmed! Escrow funds released to seller.');
      loadUserOrders(true);
      loadUserWallet();
    } catch (err: any) {
      console.warn('Backend confirmDelivery fallback:', err);
      const errMsg = err?.response?.data?.message || err.message || 'Không thể xác nhận nhận hàng';
      showToast(`Thông báo: ${errMsg}`);
      setOrders((prev) =>
        prev.map((ord) =>
          ord.id === orderId
            ? { ...ord, escrowStatus: 'COMPLETED_RELEASED', backendStatus: 'COMPLETED', status: 'COMPLETED' }
            : ord
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
    let targetOrder = orders.find((o) => String(o.id) === String(orderId));
    if (!targetOrder) {
      try {
        const rawAll = localStorage.getItem('all_orders_cache');
        if (rawAll) {
          const parsed: EscrowOrder[] = JSON.parse(rawAll);
          targetOrder = parsed.find((o) => String(o.id) === String(orderId));
        }
      } catch {}
    }
    if (!targetOrder) {
      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent) {
          const parsed: EscrowOrder[] = JSON.parse(rawRecent);
          targetOrder = parsed.find((o) => String(o.id) === String(orderId));
        }
      } catch {}
    }
    if (!targetOrder) {
      try {
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller) {
          const parsed: EscrowOrder[] = JSON.parse(rawSeller);
          targetOrder = parsed.find((o) => String(o.id) === String(orderId));
        }
      } catch {}
    }
    if (!targetOrder) {
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const parsed: EscrowOrder[] = JSON.parse(rawCenter);
          targetOrder = parsed.find((o) => String(o.id) === String(orderId));
        }
      } catch {}
    }

    const isSellerCancel = targetOrder?.sellerId === currentUser?.id || currentRole === 'seller';
    const effectiveCancelData = cancelData || (isSellerCancel ? {
      reasonCode: 'SELLER_OUT_OF_STOCK' as const,
      reason: 'Người bán hết hàng hoặc không thể chuẩn bị đơn hàng này.',
    } : {
      reasonCode: 'BUYER_REQUESTED' as const,
      reason: 'Người mua yêu cầu hủy đơn hàng.',
    });

    const isInspectionOrder = Boolean(
      targetOrder?.hasInspectionService ||
      targetOrder?.inspectionMethod ||
      (targetOrder?.inspectionFeeVnd && targetOrder.inspectionFeeVnd > 0) ||
      targetOrder?.escrowStatus === 'AWAITING_INSPECTION' ||
      targetOrder?.status === 'WAITING_INSPECTION' ||
      targetOrder?.status === 'CONFIRMED_PENDING_DISPATCH'
    );

    try {
      // Lưu thông tin lý do hủy vào localStorage ngay lập tức
      try {
        localStorage.setItem(`order_cancellation_info_${orderId}`, JSON.stringify(effectiveCancelData));
        localStorage.setItem(`order_cancelled_${orderId}`, 'true');
      } catch {}

      // Nếu là đơn kiểm định, không gọi /api/v1/orders/{id}/cancel (vì backend chỉ hỗ trợ bảng orders, gọi sẽ gây lỗi 404)
      if (isInspectionOrder) {
        if (isSellerCancel) {
          try {
            await inspectorService.respondRequest(orderId, {
              action: 'REJECT',
              sellerConsentZinLoss: false,
              rejectReason: effectiveCancelData.reason,
            });
          } catch (inspErr) {
            console.warn('Inspection seller reject issue:', inspErr);
          }
        }
      } else {
        // Đơn hàng tiêu chuẩn (không kiểm định): gọi backend hủy đơn
        try {
          await orderService.cancelOrder(orderId, effectiveCancelData);
        } catch (orderErr) {
          console.warn('Backend order cancel error (cancelling locally):', orderErr);
        }
      }

      setOrders((prev) =>
        prev.map((ord) =>
          String(ord.id) === String(orderId)
            ? {
                ...ord,
                escrowStatus: 'REFUNDED_TO_BUYER',
                backendStatus: 'CANCELLED',
                status: 'CANCELLED',
                cancellationReasonCode: effectiveCancelData.reasonCode,
                cancellationReason: effectiveCancelData.reason,
              }
            : ord
        )
      );

      // Cập nhật recent_placed_orders, all_orders_cache, center_inspection_orders và my_seller_inspection_orders
      try {
        const updateStorageOrder = (key: string) => {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const parsed: EscrowOrder[] = JSON.parse(stored);
              const updated = parsed.map((o) =>
                String(o.id) === String(orderId)
                  ? {
                      ...o,
                      escrowStatus: 'REFUNDED_TO_BUYER' as const,
                      backendStatus: 'CANCELLED' as const,
                      status: 'CANCELLED',
                      cancellationReasonCode: effectiveCancelData.reasonCode,
                      cancellationReason: effectiveCancelData.reason,
                    }
                  : o
              );
              localStorage.setItem(key, JSON.stringify(updated));
            }
          } catch {}
        };

        updateStorageOrder('recent_placed_orders');
        updateStorageOrder('all_orders_cache');
        updateStorageOrder('center_inspection_orders');
        updateStorageOrder('my_seller_inspection_orders');
        localStorage.setItem(`order_cancelled_${orderId}`, 'true');
        // TUYỆT ĐỐI GIỮ LẠI order_listing_${orderId} để đơn hàng đã hủy không bị mất thông tin sản phẩm và hiển thị đầy đủ
      } catch {}

      // Lập tức khôi phục bài đăng thành ACTIVE trên sàn (vì đơn đã hủy)
      let cancelledListingId = targetOrder?.listingId || targetOrder?.listing?.id || (targetOrder as any)?.postId || (targetOrder as any)?.post?.id;
      if (!cancelledListingId) {
        try {
          const rawOrderListing = localStorage.getItem(`order_listing_${orderId}`);
          if (rawOrderListing) {
            const parsed = JSON.parse(rawOrderListing);
            if (parsed?.id) cancelledListingId = parsed.id;
          }
        } catch {}
      }

      if (cancelledListingId) {
        markListingAsAvailable(String(cancelledListingId));
        reconcileBoughtListingIds();
        setListings((prev) => {
          let found = false;
          const updated = prev.map((l) => {
            if (String(l.id) === String(cancelledListingId)) {
              found = true;
              return { ...l, status: 'active' as const, backendStatus: 'ACTIVE' as const };
            }
            return l;
          });
          if (!found && targetOrder?.listing) {
            updated.unshift({
              ...targetOrder.listing,
              id: String(cancelledListingId),
              status: 'active' as const,
              backendStatus: 'ACTIVE' as const,
            });
          }
          return updated;
        });
      }

      // Hoàn trả số dư ví cho Người Mua
      const refundAmount = targetOrder?.totalPaidVnd || ((targetOrder?.itemPriceVnd || 0) + (targetOrder?.shippingFeeVnd || 0) + (targetOrder?.inspectionFeeVnd || 0));
      if (refundAmount > 0 && (targetOrder?.buyerId === currentUser?.id || currentRole === 'buyer')) {
        setWalletBalance((prev) => prev + refundAmount);
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const currentBal = prev.walletBalanceVnd ?? prev.walletBalance ?? 0;
          const newBal = currentBal + refundAmount;
          return { ...prev, walletBalance: newBal, walletBalanceVnd: newBal };
        });
      }

      loadListingsFromBackend(true);
      loadUserOrders(true);
      loadUserWallet();
      showToast(lang === 'vi' ? 'Đã hủy đơn hàng! Tiền ký quỹ Escrow đã được hoàn lại 100% vào ví người mua.' : 'Order cancelled and refunded to buyer.');
    } catch (err: any) {
      console.warn('handleCancelOrder error:', err);
      showToast(lang === 'vi' ? 'Đã hủy đơn hàng thành công! Tiền ký quỹ Escrow được bảo vệ an toàn.' : 'Order cancelled successfully!');
    }
  };

  const handleOpenDispute = (order: EscrowOrder) => {
    if (currentRole === 'seller' || currentUser?.role === 'seller' || (order.sellerId && String(order.sellerId) === String(currentUser?.id))) {
      showToast(lang === 'vi' ? 'Tài khoản người bán không có quyền thực hiện tạo khiếu nại.' : 'Seller accounts cannot file disputes.');
      return;
    }
    setReportingOrderForDispute(order);
  };

  const handleCompleteInspection = (
    orderId: string,
    verdict: 'PASS' | 'FAIL',
    tamperSeal: string,
    summary: string,
    meta?: any
  ) => {
    const isPass = verdict === 'PASS';
    const nextEscrowStatus: EscrowStatus = isPass ? 'INSPECTION_PASSED' : 'INSPECTION_FAILED';
    const nextBackendStatus = isPass ? 'PASSED' : 'FAILED';
    const targetOrder = orders.find((o) => o.id === orderId) || meta?.order;

    const conditionScore =
      typeof meta?.conditionScore === 'number'
        ? meta.conditionScore
        : isPass
        ? 96
        : 40;
    const conditionGrade = meta?.conditionGrade || targetOrder?.listing?.conditionGrade || 'Like New';
    const inspectorPhotos =
      meta?.inspectorPhotos && meta.inspectorPhotos.length > 0
        ? meta.inspectorPhotos
        : ([targetOrder?.listing?.photos?.front, targetOrder?.listing?.photos?.back].filter(Boolean) as string[]);

    const inspectionReport: InspectionReport = {
      id: `REP-${Math.floor(1000 + Math.random() * 9000)}`,
      orderId: orderId,
      centerId: targetOrder?.inspectionCenterId || 'center-hcm-01',
      centerName: targetOrder?.inspectionCenterName || 'SecondLife Hub Flagship Lab',
      inspectorName: currentUser?.name || 'KTV Trưởng Hải Đăng (Level 4)',
      inspectedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      verdict,
      detectedGrade: conditionGrade,
      conditionScore,
      tamperSealId: tamperSeal,
      checklistResults: meta?.checklistResults || [],
      inspectorPhotos,
      summaryNotes: summary || (isPass ? 'Đạt tiêu chuẩn thẩm định kỹ thuật 100%' : 'Không đạt yêu cầu kỹ thuật'),
    };

    // 1. Cập nhật in-memory state orders
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            escrowStatus: nextEscrowStatus,
            backendStatus: nextBackendStatus as any,
            status: nextBackendStatus,
            inspectionReport,
            updatedAt: new Date().toISOString(),
            ...(isPass
              ? {}
              : {
                  cancellationReasonCode: 'INSPECTION_FAILED',
                  cancellationReason: `Sản phẩm không đạt kiểm định Hub: ${meta?.inspectorNotes || summary || 'Không đạt quy chuẩn kỹ thuật'}`,
                }),
          };
        }
        return ord;
      })
    );

    // 2. Cập nhật và lưu vào recent_placed_orders trong localStorage
    try {
      const rawRecent = localStorage.getItem('recent_placed_orders');
      if (rawRecent) {
        const list: EscrowOrder[] = JSON.parse(rawRecent);
        const updatedList = list.map((ord) => {
          if (ord.id === orderId) {
            return {
              ...ord,
              escrowStatus: nextEscrowStatus,
              backendStatus: nextBackendStatus as any,
              status: nextBackendStatus,
              inspectionReport,
              updatedAt: new Date().toISOString(),
              ...(isPass
                ? {}
                : {
                    cancellationReasonCode: 'INSPECTION_FAILED',
                    cancellationReason: `Sản phẩm không đạt kiểm định Hub: ${meta?.inspectorNotes || summary || 'Không đạt quy chuẩn kỹ thuật'}`,
                  }),
            };
          }
          return ord;
        });
        localStorage.setItem('recent_placed_orders', JSON.stringify(updatedList));
      }
    } catch (e) {
      console.warn('Failed to persist inspection result to recent_placed_orders:', e);
    }

    // 3. Cập nhật và lưu vào center_inspection_orders trong localStorage
    try {
      const rawCenter = localStorage.getItem('center_inspection_orders');
      if (rawCenter) {
        const listCenter = JSON.parse(rawCenter);
        const updatedCenter = listCenter.map((ord: any) => {
          if (ord.id === orderId) {
            return {
              ...ord,
              escrowStatus: nextEscrowStatus,
              status: nextBackendStatus,
              backendStatus: nextBackendStatus,
              inspectionReport,
              updatedAt: new Date().toISOString(),
            };
          }
          return ord;
        });
        localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
      }
    } catch (e) {
      console.warn('Failed to persist inspection result to center_inspection_orders:', e);
    }

    try {
      localStorage.setItem(`inspection_status_${orderId}`, nextBackendStatus);
      if (isPass) {
        markListingInspectionPassed(
          targetOrder?.postId || targetOrder?.listing?.id || (targetOrder as any)?.listingId,
          targetOrder?.listing?.title || (targetOrder as any)?.postTitle || targetOrder?.title
        );
      }
      window.dispatchEvent(new CustomEvent('secondlife_inspection_completed', {
        detail: { orderId, status: nextBackendStatus }
      }));
    } catch (e) {
      console.warn('Failed to save inspection_status to localStorage:', e);
    }

    // 4. Phát thông báo tình trạng đến Người mua (Buyer) và Người bán (Seller)
    const productTitle = targetOrder?.listing?.title || 'Sản phẩm kiểm định';
    const shortOrderId = orderId.length > 8 ? orderId.slice(0, 8).toUpperCase() : orderId;
    const targetBuyerId = targetOrder?.buyerId || 'buyer-current';
    const targetSellerId = targetOrder?.sellerId || targetOrder?.listing?.sellerId || 'seller-01';

    // A. Thông báo cho Người mua (Buyer)
    if (isPass) {
      const buyerNotif: NotificationItem = {
        id: `notif-insp-buyer-pass-${orderId}-${Date.now()}`,
        title: `Kết quả kiểm định: ĐẠT TIÊU CHUẨN (${conditionGrade} • ${conditionScore}/100)`,
        message: `Sản phẩm "${productTitle}" (Đơn #${shortOrderId}) đã được kiểm định ĐẠT TIÊU CHUẨN tại Hub SecondLife và dán tem niêm phong #${tamperSeal}. Vui lòng xem biên bản kiểm định chi tiết và xác nhận quyết định nhận hàng!`,
        type: 'INSPECTION',
        referenceId: orderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: paths.decision('buyer', orderId),
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
        recipientId: targetBuyerId,
        recipientRole: 'buyer',
      };
      saveScopedLocalNotification(buyerNotif, targetBuyerId, 'buyer');
    } else {
      const buyerNotif: NotificationItem = {
        id: `notif-insp-buyer-fail-${orderId}-${Date.now()}`,
        title: `Kết quả kiểm định: KHÔNG ĐẠT TIÊU CHUẨN`,
        message: `Sản phẩm "${productTitle}" (Đơn #${shortOrderId}) KHÔNG ĐẠT tiêu chuẩn chất lượng tại Hub. Lý do: ${meta?.inspectorNotes || summary || 'Không đúng mô tả kỹ thuật'}. Tiền ký quỹ 100% đang được tự động hoàn trả vào ví của bạn.`,
        type: 'INSPECTION',
        referenceId: orderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: paths.orders('buyer', orderId) + '?filter=disputed',
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
        recipientId: targetBuyerId,
        recipientRole: 'buyer',
      };
      saveScopedLocalNotification(buyerNotif, targetBuyerId, 'buyer');
    }

    // B. Thông báo cho Người bán (Seller)
    if (isPass) {
      const sellerNotif: NotificationItem = {
        id: `notif-insp-seller-pass-${orderId}-${Date.now()}`,
        title: `Sản phẩm của bạn đã ĐẠT CHUẨN kiểm định Hub`,
        message: `Thiết bị "${productTitle}" (Đơn #${shortOrderId}) của bạn đã được Hub kiểm định ĐẠT CHUẨN (${conditionGrade} • ${conditionScore}/100) và niêm phong bằng mã tem #${tamperSeal}. Đơn hàng đang được gửi thông báo đến Người mua để xác nhận giao hàng.`,
        type: 'INSPECTION',
        referenceId: orderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: paths.orders('seller', orderId) + '?filter=inspecting',
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
        recipientId: targetSellerId,
        recipientRole: 'seller',
      };
      saveScopedLocalNotification(sellerNotif, targetSellerId, 'seller');
    } else {
      const sellerNotif: NotificationItem = {
        id: `notif-insp-seller-fail-${orderId}-${Date.now()}`,
        title: `Sản phẩm KHÔNG ĐẠT tiêu chuẩn kiểm định Hub`,
        message: `Thiết bị "${productTitle}" (Đơn #${shortOrderId}) không vượt qua thẩm định tại Hub. Lý do: ${meta?.inspectorNotes || summary || 'Không đúng mô tả kỹ thuật'}. Trung tâm sẽ liên hệ để làm thủ tục hoàn trả thiết bị về địa chỉ kho của bạn.`,
        type: 'INSPECTION',
        referenceId: orderId,
        referenceType: 'INSPECTION_ORDER',
        actionUrl: paths.orders('seller', orderId) + '?filter=disputed',
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
        recipientId: targetSellerId,
        recipientRole: 'seller',
      };
      saveScopedLocalNotification(sellerNotif, targetSellerId, 'seller');
    }

    // 5. Phát tín hiệu toàn cục để cập nhật chuông và danh sách đơn hàng
    try {
      window.dispatchEvent(
        new CustomEvent('secondlife_inspection_completed', {
          detail: { orderId, verdict, tamperSeal, inspectionReport },
        })
      );
      window.dispatchEvent(new CustomEvent('orders_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch {}

    showToast(
      isPass
        ? `Đã thẩm định ĐẠT CHUẨN đơn hàng #${shortOrderId}! Tem NFC: #${tamperSeal}. Đã gửi thông báo kết quả đến Người mua và Người bán.`
        : `Đã thẩm định KHÔNG ĐẠT đơn hàng #${shortOrderId}. Đã gửi thông báo kết quả đến Người mua và Người bán.`
    );
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

  React.useEffect(() => {
    if (isRestoringSession) return;
    if (routeAccess === 'login') {
      navigatePath(`/login?redirect=${encodeURIComponent(browserLocation)}`, { replace: true });
      return;
    }
    if (routeAccess === 'unauthorized') { navigatePath(paths.unauthorized, { replace: true }); return; }
    if (route.url !== browserLocation) { navigatePath(route.url, { replace: true }); return; }
    const authMode = route.modal === 'login' || route.modal === 'register' || route.modal === 'forgot' ? route.modal : null;
    setIsAuthModalOpen(Boolean(authMode));
    if (authMode) setAuthModalMode(authMode);
    setIsProfileDialogOpen(route.modal === 'profile');
    if (route.modal !== 'product') setSelectedListing(null);
    if (route.params.inspectionId && activeTab === 'buyer-inspection-decision') {
      setInspectionDecisionOrderId(route.params.inspectionId);
      setInspectionDecisionOrder(orders.find((order) => order.id === route.params.inspectionId) || null);
    }
  }, [browserLocation, routeAccess, isRestoringSession]);

  const [routeProductError, setRouteProductError] = useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const productId = route.params.productId;
    setRouteProductError(null);
    if (!productId || routeAccess !== 'allowed' || isRestoringSession) return;
    const isEdit = activeTab === 'create-listing';
    if (isEdit && editingDraft?.id === productId) return;
    if (!isEdit && (selectedListing?.id === productId || checkoutListing?.id === productId)) return;
    const load = isEdit ? postService.getDraft(productId)
      : route.role === 'seller' ? postService.getMyPostDetail(productId)
      : route.role === 'admin' ? adminPostService.getAdminPosts().then((response) => {
        const posts = response?.content || response?.items || (Array.isArray(response) ? response : []);
        return posts.find((post: any) => String(post.id || post.postId) === productId);
      }) : postService.getListingDetail(productId);
    load.then((data) => {
      if (cancelled) return;
      if (!data) { setRouteProductError('Không tìm thấy sản phẩm hoặc sản phẩm không còn công khai.'); return; }
      const listing = mapBackendPostToListing(data);
      if (isEdit) setEditingDraft(listing); else setSelectedListing(listing);
    }).catch((error) => { if (!cancelled) setRouteProductError(error.message || 'Không thể tải sản phẩm.'); });
    return () => { cancelled = true; };
  }, [browserLocation, routeAccess, isRestoringSession, mapBackendPostToListing]);

  if (routeAccess !== 'allowed') return <ViewLoadingFallback />;
  if (activeTab === 'unauthorized' || activeTab === 'not-found') {
    const landingHome = effectiveUser ? getRoleLandingPath(effectiveRole) : '/';
    return <RouteStatusPage status={activeTab} home={landingHome} />;
  }
  if (route.params.productId && activeTab === 'create-listing' && editingDraft?.id !== route.params.productId) {
    return routeProductError ? <div className="p-12 text-center"><p>{routeProductError}</p><button onClick={() => navigatePath(paths.products)}>Về danh sách sản phẩm</button></div> : <ViewLoadingFallback />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans bg-[#faf8f5] text-[#24263e] selection:bg-[#c34c36] selection:text-white ${
      activeTab === 'chat' && !checkoutListing ? 'h-screen max-h-screen overflow-hidden' : ''
    }`}>
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
          unreadChatsCount={unreadChatsCount}
          currentUser={currentUser}
          onOpenAuth={openAuth}
          onLogout={() => {
            setIsLogoutModalOpen(true);
          }}
          onOpenProfile={() => {
            if (!currentUser) {
              requireAuth(undefined, lang === 'vi' ? 'Vui lòng đăng nhập để xem hồ sơ cá nhân.' : 'Please log in to view your profile.');
            } else {
              openProfile();
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

      {/* Floating Welcome & System Toast Notification (Positioned at top-right below navbar) */}
      {toastMessage && (
        <div className="fixed top-24 sm:top-28 right-4 sm:right-6 lg:right-8 z-[100] w-[calc(100%-2rem)] sm:w-auto min-w-[320px] max-w-md bg-gradient-to-r from-[#fbf8f3] via-[#f5ede3] to-[#ebdccb] backdrop-blur-2xl text-[#2b1d16] px-4.5 py-3.5 rounded-2xl shadow-2xl border-2 border-[#cea981]/60 flex items-center gap-3.5 transition-all duration-300 transform scale-100 animate-in fade-in slide-in-from-top-3">
          <div className="w-9 h-9 rounded-xl bg-[#2b1d16] flex items-center justify-center shrink-0 shadow-md ring-2 ring-[#cea981]/40">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="flex-1 pr-2 min-w-0">
            <span className="text-xs sm:text-sm font-extrabold tracking-wide text-[#2b1d16] leading-tight block break-words">{toastMessage}</span>
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


      {/* Main Content Area */}
      <main
        className={
          checkoutListing
            ? 'flex-1 w-full p-0 m-0 bg-[#f8fafc]'
            : activeTab === 'chat'
            ? 'flex-1 min-h-0 w-full p-2 sm:p-2.5 m-0 overflow-hidden flex flex-col'
            : activeTab === 'admin-dashboard' ||
              activeTab === 'inspection-center' ||
              activeTab === 'inspection-hub' ||
              activeTab === 'staff-workspace' ||
              activeTab === 'buyer-inspection-decision'
            ? 'flex-1 w-full p-0 m-0'
            : 'flex-1 w-full px-3 sm:px-5 lg:px-6 pt-3 sm:pt-4 pb-8 m-0'
        }
      >
        <Suspense fallback={<ViewLoadingFallback />}>
        {checkoutListing ? (
          <CheckoutModal
            listing={checkoutListing}
            currentUser={currentUser}
            agreedPrice={checkoutAgreedPrice}
            negotiationId={checkoutNegotiationId}
            onOpenDeposit={() => setIsTopUpModalOpen(true)}
            onNavigateToChat={(item, prefill) => {
              const closedListingId = checkoutListing?.id;
              if (closedListingId) {
                markListingAsAvailable(String(closedListingId));
              }
              setCheckoutListing(null);
              setCheckoutAgreedPrice(undefined);
              setCheckoutNegotiationId(undefined);
              openChat(item, 'inspection_proposal', prefill);
            }}
            onClose={() => {
              const closedListingId = checkoutListing?.id;
              if (closedListingId) {
                markListingAsAvailable(String(closedListingId));
                reconcileBoughtListingIds();
                setListings((prev) =>
                  prev.map((l) =>
                    String(l.id) === String(closedListingId) ? { ...l, status: 'active', backendStatus: 'ACTIVE' } : l
                  )
                );
              }
              setCheckoutListing(null);
              setCheckoutAgreedPrice(undefined);
              setCheckoutNegotiationId(undefined);
              if (!selectedListing && route.modal === 'product') closeRouteModal(paths.products);
              loadListingsFromBackend(true);
            }}
            onCancelUnpaid={(msg) => {
              const cancelledListingId = checkoutListing?.id;
              if (cancelledListingId) {
                markListingAsAvailable(String(cancelledListingId));
                reconcileBoughtListingIds();
                setListings((prev) =>
                  prev.map((l) =>
                    String(l.id) === String(cancelledListingId) ? { ...l, status: 'active', backendStatus: 'ACTIVE' } : l
                  )
                );
              }
              setCheckoutListing(null);
              setCheckoutAgreedPrice(undefined);
              setCheckoutNegotiationId(undefined);
              if (!selectedListing && route.modal === 'product') closeRouteModal(paths.products);
              loadListingsFromBackend(true);
              showToast(msg || (lang === 'vi' ? 'Đơn hàng chưa được thanh toán! Đã quay lại trang mua hàng.' : 'Order not paid. Returned to shopping page.'));
            }}
            showToast={showToast}
            onOrderPlaced={handleOrderPlaced}
            lang={lang}
          />
        ) : (
          <>
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
            onOpenAuth={openAuth}
          />
        )}

        {activeTab === 'marketplace' && (
          <MarketplaceView
            listings={listings.filter((l) => {
              const boughtIds = getBoughtListingIds();
              if (boughtIds.has(String(l.id))) return false;
              if (l.status === 'reserved' || l.status === 'sold') return false;
              if (l.backendStatus === 'RESERVED' || l.backendStatus === 'SOLD') return false;
              return l.status === 'active' || l.backendStatus === 'ACTIVE';
            })}
            onSelectListing={(listing) => openProduct(listing)}
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
            onSelectListing={(listing) => openProduct(listing, true)}
            onCreateListing={(draft?: any) => {
              setEditingDraft(draft && draft.id ? draft : null);
              setCreateListingReturnTab('seller-dashboard');
              navigatePath(draft?.id ? paths.editProduct(draft.id) : pathForTab('create-listing', currentRole));
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
                try {
                  for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('create_listing_active_draft_') || key === 'create_listing_active_draft')) {
                      localStorage.removeItem(key);
                    }
                  }
                  sessionStorage.removeItem('create_listing_active_draft');
                } catch {}
                setActiveTab(targetTab as any);
              }}
              onDeleteDraft={(draftId) => {
                setListings((prev) => prev.filter((l) => l.id !== draftId));
              }}
              currentUser={currentUser}
              initialDraft={route.params.productId ? editingDraft || undefined : undefined}
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
            onRefreshOrders={() => loadUserOrders(true)}
            lang={lang}
            userRole={route.role === 'buyer' ? 'buyer' : currentRole}
            onOpenChat={openChat}
            onOpenInspectionDecision={(ord) => {
              setInspectionDecisionOrder(ord);
              setInspectionDecisionOrderId(ord.id);
              navigatePath(paths.decision(navigationRole, ord.id));
            }}
            onNavigateToDisputes={() => handleTabChange('disputes')}
            isLoading={isOrdersLoading}
          />
        )}

        {activeTab === 'buyer-inspection-decision' && (
          <BuyerInspectionDecisionView
            key={route.params.inspectionId || inspectionDecisionOrderId || inspectionDecisionOrder?.id}
            orderId={route.params.inspectionId || inspectionDecisionOrderId || inspectionDecisionOrder?.id}
            order={!route.params.inspectionId || route.params.inspectionId === inspectionDecisionOrder?.id ? inspectionDecisionOrder : null}
            currentUser={currentUser}
            userRole={route.role === 'buyer' ? 'buyer' : currentRole}
            lang={lang}
            onBack={() => handleTabChange('orders')}
            onSuccess={() => {
              loadUserOrders(true);
              handleTabChange('orders');
            }}
            onOpenChat={openChat}
            onOpenTopUp={() => setIsTopUpModalOpen(true)}
          />
        )}

        {activeTab === 'inspection-center' && (
          <InspectionCenterDashboardView
            key={currentUserId}
            initialOrders={orders}
            currentUser={currentUser}
            lang={lang}
            onNavigate={setActiveTab}
            onOpenProfile={openProfile}
            onLogout={() => setIsLogoutModalOpen(true)}
            onViewWebsite={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'inspection-hub' && (
          (currentUser?.role === 'inspection_center' || currentRole === 'inspection_center') ? (
            <InspectionCenterDashboardView
              key={currentUserId}
              initialOrders={orders}
              currentUser={currentUser}
              lang={lang}
              onNavigate={setActiveTab}
              onOpenProfile={openProfile}
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
              onOpenProfile={openProfile}
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
            onOpenProfile={openProfile}
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
            onOpenProfile={openProfile}
            onLogout={() => setIsLogoutModalOpen(true)}
            onOpenListingDetail={(listing) => openProduct(listing)}
          />
        )}

        {activeTab === 'chat' && (
          <InboxView
            listings={listings}
            currentRole={currentRole}
            currentUser={currentUser}
            lang={lang}
            initialListing={chatListing}
            initialInspectionDraft={inspectionChatDraft}
            initialRoomId={route.params.conversationId}
            initialPartnerName={chatPartnerName}
            initialPartnerAvatar={chatPartnerAvatar}
            initialRoom={chatRoom}
            onBuyClick={(item, agreedPrice, negotiationId) => {
              if (!currentUser) {
                setPendingCheckoutItem(item);
                requireAuth(undefined, lang === 'vi'
                  ? 'Vui lòng đăng nhập để tiến hành mua hàng bảo đảm Escrow và kiểm định Hub.'
                  : 'Please log in to purchase with Escrow protection.');
                return;
              }
              const isRealNego = negotiationId && isValidUUID(negotiationId) && !isSellerOfferId(negotiationId);
              setCheckoutAgreedPrice(isRealNego ? agreedPrice : undefined);
              setCheckoutNegotiationId(isRealNego ? negotiationId : undefined);
              setCheckoutListing(item);
            }}
            onOpenSellerReviews={(sellerId, sellerName) => {
              setSellerReviewsModalData({ sellerId, sellerName });
            }}
          />
        )}

        {/* Notifications Center Page (Requirement 3 & Phase 3) */}
        {activeTab === 'notifications' && (
          <NotificationCenterView
            lang={lang}
            currentUser={currentUser}
            currentRole={currentRole}
            onNavigateToUrl={handleNotificationNavigate}
            onBackToHome={() => handleTabChange('home')}
          />
        )}

        {/* My Disputes & Escrow Arbitration Page */}
        {activeTab === 'disputes' && (
          <MyDisputesView
            currentUser={currentUser}
            currentRole={currentRole}
            lang={lang}
            orders={orders}
            onNavigateToOrder={() => {
              handleTabChange('orders');
            }}
            onNavigateToPost={(postId) => {
              const item = listings.find((l) => l.id === postId);
              if (item) openProduct(item);
              else handleTabChange('marketplace');
            }}
            onBack={() => handleTabChange('orders')}
          />
        )}
          </>
        )}
        </Suspense>
      </main>

      {/* Modals & Popups */}
      <Suspense fallback={null}>
        {/* Product Modal Loading / Error Overlay for direct URL access */}
        {route.modal === 'product' && !selectedListing && !checkoutListing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
              {routeProductError ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 mb-4">{routeProductError}</p>
                  <button
                    onClick={() => closeRouteModal(paths.products)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
                  >
                    Về danh sách sản phẩm
                  </button>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full border-4 border-amber-200 border-t-[#c34c36] animate-spin mb-3" />
                  <p className="text-xs font-bold text-slate-600 tracking-wide uppercase animate-pulse">
                    Đang tải thông tin sản phẩm...
                  </p>
                  <button
                    onClick={() => closeRouteModal(paths.products)}
                    className="mt-4 px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Đóng
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Listing Detail Modal */}
        {selectedListing && !checkoutListing && (
          <ListingDetailModal
            listing={selectedListing}
            currentUser={currentUser}
            onClose={() => { setSelectedListing(null); closeRouteModal(route.role === 'seller' ? '/seller/products' : route.role === 'admin' ? '/admin/products' : paths.products); }}
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
              // Retain selectedListing so route stays active and user returns seamlessly if checkout is closed
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
              setSelectedListing(null);
              setChatListing(item);
              setChatPredefinedRoomId(undefined);
              setChatPartnerName(item.sellerName);
              setChatPartnerAvatar(item.sellerAvatar);
              setChatRoom(undefined);
              openChat(item);
            }}
            onOpenSellerReviews={(sellerId, sellerName) => {
              setSellerReviewsModalData({ sellerId, sellerName });
            }}
            lang={lang}
          />
        )}

        {/* Checkout Modal rendered inside main */}


{/* ChatModal popup has been replaced by the dedicated full-page Messenger chat view */}

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

        {/* Order Dispute / Claim Modal */}
        {reportingOrderForDispute && (
          <UserReportModal
            isOpen={!!reportingOrderForDispute}
            onClose={() => setReportingOrderForDispute(null)}
            orderId={reportingOrderForDispute.id}
            itemTitle={reportingOrderForDispute.listing?.title}
            onNavigateToDisputes={() => handleTabChange('disputes')}
            onSuccess={() => {
              setOrders((prev) =>
                prev.map((o) => (o.id === reportingOrderForDispute.id ? { ...o, escrowStatus: 'DISPUTED' } : o))
              );
              loadUserOrders(true);
            }}
          />
        )}

        {/* Authentication Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          onClose={() => {
            setIsAuthModalOpen(false);
            const live = resolveAppRoute(window.location.href, getStoredUser()?.role || currentRole);
            if (['login', 'register', 'forgot'].includes(live.modal || '')) closeRouteModal('/');
          }}
          onLoginSuccess={(user) => {
            setIsSessionExpiredOpen(false);
            resetActivityTimer();
            recordUserActivity(true);
            const profileUser: UserProfile = {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone || '',
              address: user.address || '',
              role: user.role,
              roles: user.roles,
              permissions: user.permissions,
              avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
              kycStatus: user.role === 'seller' ? 'verified' : 'unverified',
              emailVerified: Boolean(user.emailVerified),
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
            setIsAuthModalOpen(false);
            const rawReturnTo = safeReturnPath(new URL(window.location.href).searchParams.get('redirect'));
            let destination: string;

            if (user.role === 'admin') {
              if (rawReturnTo && rawReturnTo.startsWith('/admin') && getRouteAccess(resolveAppRoute(rawReturnTo, user.role), profileUser) === 'allowed') {
                destination = rawReturnTo;
              } else {
                destination = getRoleLandingPath('admin');
              }
            } else if (rawReturnTo) {
              const testRoute = resolveAppRoute(rawReturnTo, user.role);
              const access = getRouteAccess(testRoute, profileUser);
              if (access === 'allowed') {
                destination = rawReturnTo;
              } else {
                destination = pendingTab ? pathForTab(pendingTab, user.role) : getRoleLandingPath(user.role);
              }
            } else {
              destination = pendingTab ? pathForTab(pendingTab, user.role) : getRoleLandingPath(user.role);
            }

            setPendingTab(null);
            navigatePath(destination, { replace: true });
            if (pendingCheckoutItem && ['buyer', 'seller'].includes(user.role)) {
              setSelectedListing(pendingCheckoutItem);
              setCheckoutListing(pendingCheckoutItem);
              setPendingCheckoutItem(null);
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
            openAuth('login');
          }}
        />

        {/* User Profile Dialog */}
        {isProfileDialogOpen && (
          <ProfileDialog
            isOpen={isProfileDialogOpen}
            onClose={() => { setIsProfileDialogOpen(false); closeRouteModal(getRoleLandingPath(currentRole)); }}
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
              openAuth('forgot');
            }}
            onLogout={() => {
              setIsLogoutModalOpen(true);
            }}
            onOpenVerifyEmail={(targetEmail) => {
              setVerifyEmailTarget(targetEmail);
              setIsVerifyEmailModalOpen(true);
            }}
            onOpenTopUp={() => setIsTopUpModalOpen(true)}
            onOpenSellerRegister={() => {
              setIsProfileDialogOpen(false);
              setIsSellerRegistrationModalOpen(true);
            }}
          />
        )}

        {/* 6-Digit OTP Email Verification Modal Popup */}
        <VerifyEmailModal
          isOpen={isVerifyEmailModalOpen}
          email={verifyEmailTarget || currentUser?.email || 'user@secondlife.vn'}
          autoSendOnOpen={true}
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
        {isSellerRegistrationModalOpen && (
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
        )}

        {/* TopUp Credits Modal Popup (Requirement 7) */}
        {isTopUpModalOpen && (
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
        )}

        {/* Logout Confirmation Modal Popup */}
        <LogoutConfirmModal
          isOpen={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
          onConfirm={handleConfirmLogout}
          lang={lang}
        />

        {/* Policies & System Information Modal */}
        {isPolicyModalOpen && (
          <PolicyModal
            isOpen={isPolicyModalOpen}
            initialTab={policyInitialTab}
            onClose={() => setIsPolicyModalOpen(false)}
            lang={lang}
          />
        )}
      </Suspense>

      {/* Global In-App Popup Modal (Replaces all native browser localhost alerts & confirms) */}
      <GlobalPopupModal />

      {/* Real-time Push Notification Floating Toast (On top of all modals) */}
      <RealtimeNotificationToast
        lang={lang}
        currentUser={currentUser}
        currentRole={currentRole}
        onNavigateToUrl={handleNotificationNavigate}
      />

      {/* E-Commerce Footer */}
      {activeTab !== 'admin-dashboard' && activeTab !== 'inspection-hub' && activeTab !== 'inspection-center' && activeTab !== 'staff-workspace' && (activeTab !== 'chat' || !!checkoutListing) && (
        <Footer
          lang={lang}
          currentRole={currentRole}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenProfile={() => {
            if (!currentUser) {
              requireAuth(undefined, lang === 'vi' ? 'Vui lòng đăng nhập để xem thông tin hồ sơ.' : 'Please log in to view profile.');
            } else {
              openProfile();
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
