import React, { useState } from 'react';
import { UserRole, Language, Listing, EscrowOrder, DisputeCase, UserProfile, UserCredit, ItemCategory, ConditionGrade } from './types';
import { formatVND } from './utils/translations';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { MarketplaceView } from './pages/MarketplaceView';
import { ListingDetailModal } from './components/modals/ListingDetailModal';
import { CreateListingView } from './pages/CreateListingView';
import { SellerDashboardView } from './pages/SellerDashboardView';
import { EscrowOrdersView } from './pages/EscrowOrdersView';
import { InspectorPortalView } from './pages/InspectorPortalView';
import { StaffWorkspaceView } from './pages/StaffWorkspaceView';
import { AdminDashboardView } from './pages/AdminDashboardView';
import { ChatModal } from './components/modals/ChatModal';
import { CheckoutModal } from './components/modals/CheckoutModal';
import { HomePageView } from './pages/HomePageView';
import { AuthModal } from './components/modals/AuthModal';
import { ProfileDialog } from './components/modals/ProfileDialog';
import { SellerRegistrationModal } from './components/modals/SellerRegistrationModal';
import { VerifyEmailModal } from './components/modals/VerifyEmailModal';
import { LogoutConfirmModal } from './components/modals/LogoutConfirmModal';
import { TopUpModal } from './components/modals/TopUpModal';
import { PolicyModal, PolicyTabKey } from './components/modals/PolicyModal';
import { SellerReviewsModal } from './components/modals/SellerReviewsModal';
import { ShieldCheck, Sparkles, CheckCircle2, Store } from 'lucide-react';
import { authService, userService, topupService, walletService, orderService, negotiationService, postService, adminPostService, getAccessToken, clearAuthTokens, getStoredUser, setStoredUser } from './services';

export default function App() {
  // Global State - Default to 'marketplace' so visitors enter directly into the marketplace
  const [lang, setLang] = useState<Language>('vi');
  const [activeTab, setActiveTab] = useState<string>(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (token && stored && stored.role) {
      if (stored.role === 'admin') return 'admin-dashboard';
      if (stored.role === 'inspector') return 'inspection-hub';
      if (stored.role === 'staff') return 'staff-workspace';
    }
    return 'marketplace';
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

  // Restore & verify session for THIS browser from Backend /me on startup/refresh
  React.useEffect(() => {
    const token = getAccessToken();
    if (token) {
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
                : (profile.roles?.includes('STAFF') || profile.roles?.includes('ROLE_STAFF'))
                  ? 'staff'
                  : (profile.roles?.includes('SELLER') || profile.roles?.includes('ROLE_SELLER'))
                    ? 'seller'
                    : 'buyer',
            phone: profile.phone || '',
            avatar: profile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            accountStatus: profile.accountStatus,
            kycStatus: (profile.roles?.includes('SELLER') || profile.roles?.includes('ROLE_SELLER')) ? 'verified' : 'unverified',
            emailVerified: profile.emailVerified ?? true,
          };
          setCurrentUser(syncedUser);
          setCurrentRole(syncedUser.role);
          setStoredUser(syncedUser);
          if (syncedUser.role === 'admin') {
            setActiveTab('admin-dashboard');
          } else if (syncedUser.role === 'inspector') {
            setActiveTab('inspection-hub');
          } else if (syncedUser.role === 'staff') {
            setActiveTab('staff-workspace');
          }
        } else {
          clearAuthTokens();
          setCurrentUser(null);
          setCurrentRole('buyer');
        }
      }).catch(() => {
        // Clear session on any token verification error
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

  // Listen for 401 Unauthorized session revocation events
  React.useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthTokens();
      setCurrentUser(null);
      setCurrentRole('buyer');
    };
    window.addEventListener('unauthorized_session', handleUnauthorized);
    return () => window.removeEventListener('unauthorized_session', handleUnauthorized);
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isSellerRegistrationModalOpen, setIsSellerRegistrationModalOpen] = useState(false);
  const [isVerifyEmailModalOpen, setIsVerifyEmailModalOpen] = useState(false);
  const [verifyEmailTarget, setVerifyEmailTarget] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [userCreditBalance, setUserCreditBalance] = useState<number>(500);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [checkoutNegotiationId, setCheckoutNegotiationId] = useState<string | undefined>(undefined);
  const [userCredit, setUserCredit] = useState<UserCredit>({
    postCredits: 10,
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
      topupService.getMyCredit()
        .then((res) => {
          if (res) {
            setUserCredit(res);
            if (typeof res.balance === 'number') {
              setUserCreditBalance(res.balance);
            }
          }
        })
        .catch(() => { });
    }
  }, [currentUser, loadUserWallet]);


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

  // Core Data State
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);

  // Modals
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [checkoutListing, setCheckoutListing] = useState<Listing | null>(null);
  const [checkoutAgreedPrice, setCheckoutAgreedPrice] = useState<number | undefined>(undefined);
  const [chatListing, setChatListing] = useState<Listing | null>(null);
  const [sellerReviewsModalData, setSellerReviewsModalData] = useState<{ sellerId: string; sellerName: string } | null>(null);

  // Flash Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Auth Guard Helper
  const protectedTabs = ['create-listing', 'seller-dashboard', 'orders', 'inspection-hub', 'admin-dashboard', 'staff-workspace', 'chat'];

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

    if (currentUser?.role === 'inspector' && tab !== 'inspection-hub') {
      showToast(lang === 'vi' ? 'Tài khoản Kỹ sư Hub chỉ truy cập Trung Tâm Kiểm Định.' : 'Inspector account only accesses Inspection Hub.');
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
      }
      requireAuth(undefined, promptMsg);
      return;
    }

    if (tab === 'create-listing') {
      if (currentUser && ['admin', 'staff', 'inspector'].includes(currentUser.role)) {
        showToast(lang === 'vi'
          ? 'Tài khoản Quản trị viên, Nhân viên và Kỹ sư Hub không được đăng ký làm Người Bán.'
          : 'Admin, Staff and Inspector roles cannot register as sellers.');
        return;
      }
      if (currentUser && currentUser.role !== 'seller') {
        setIsSellerRegistrationModalOpen(true);
        return;
      }
    }

    setActiveTab(tab);
  };

  // Guard activeTab if logged out or if internal roles (admin / inspector)
  React.useEffect(() => {
    if (!currentUser && protectedTabs.includes(activeTab)) {
      setActiveTab('marketplace');
    } else if (currentUser?.role === 'admin' && activeTab !== 'admin-dashboard') {
      setActiveTab('admin-dashboard');
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
      admin: 'Quản Trị Viên (Admin)'
    };
    showToast(`Đã chuyển góc nhìn sang ${roleLabels[newRole]}.`);

    if (newRole === 'inspector') {
      handleTabChange('inspection-hub');
    } else if (newRole === 'staff') {
      handleTabChange('staff-workspace');
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

    return {
      id: post.postId || post.id || `post-${Date.now()}`,
      title: cleanTitle,
      category: detectedCategory,
      brand: detectedBrand,
      model: post.model || 'Standard',
      purchaseYear: 2024,
      priceVnd: price,
      originalPriceVnd: Number(post.aiSuggestedPrice || (price > 0 ? Math.round(price * 1.15) : 0)),
      conditionGrade: detectedGrade,
      declaredConditionText: post.itemCondition || (detectedGrade === 'Like New' ? 'Độ mới 99%, nguyên zin chưa sửa chữa' : 'Tình trạng tốt, hoạt động ổn định'),
      description: post.description || post.aiDescription || 'Đã qua thẩm định và xác thực trên hệ thống SecondLife.',
      location: 'Việt Nam',
      sellerId: post.sellerId || post.user?.id || post.userId || '1e338576-457a-4371-9822-52ca04e31546',
      sellerName: post.user?.fullName || post.sellerName || 'Người bán SecondLife',
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
      aiPriceEstimation: {
        minVnd: Math.round(price * 0.9),
        maxVnd: Math.round(price * 1.1),
        suggestedVnd: price,
        quickSaleVnd: Math.round(price * 0.85),
        confidence: 96,
        daysToSell: 3,
      },
    };
  }, []);

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
            postsData = items;
          }
        } catch {}
      }

      // Nếu là người bán (SELLER), lấy thêm các bài đăng cá nhân từ BE
      const isSeller = currentUser?.role === 'seller' || currentRole === 'seller';
      if (getAccessToken() && isSeller) {
        try {
          const myRes = await postService.getMyPosts(0, 50);
          const myItems = Array.isArray(myRes) ? myRes : (myRes?.content || myRes?.items || []);
          if (myItems && myItems.length > 0) {
            const existingIds = new Set(postsData.map((p: any) => p.postId || p.id));
            for (const myItem of myItems) {
              const myId = myItem.postId || myItem.id;
              if (!existingIds.has(myId)) {
                postsData.push(myItem);
              }
            }
          }
        } catch {}
      }

      if (postsData.length > 0) {
        const mapped = postsData.map(mapBackendPostToListing);
        setListings(mapped);
      } else {
        setListings([]);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách bài đăng từ Backend:', err);
      setListings([]);
    }
  }, [mapBackendPostToListing, currentUser?.role, currentRole]);

  // Synchronize orders directly with Backend
  const loadUserOrders = React.useCallback(async () => {
    if (!currentUser || !getAccessToken()) {
      setOrders([]);
      return;
    }
    try {
      const res = currentRole === 'seller'
        ? await orderService.getSellerOrders(0, 50)
        : await orderService.getBuyerOrders(0, 50);

      const items = res?.content || (res as any)?.items || (Array.isArray(res) ? res : []);
      if (items && items.length > 0) {
        const mappedOrders: EscrowOrder[] = items.map((bOrd: any) => {
          const matchedListing = listings.find(l => l.id === bOrd.postId) || {
            id: bOrd.postId,
            title: bOrd.postTitle || 'Thiết bị gia dụng SecondLife',
            category: 'Tủ lạnh & Tủ đông',
            brand: 'SecondLife',
            model: 'Verified Model',
            purchaseYear: 2024,
            priceVnd: bOrd.finalPrice,
            conditionGrade: 'Like New',
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
              front: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800',
              back: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&q=80&w=800',
              screenOrDetails: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=800',
              accessoriesOrBox: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800',
              serialOrReceipt: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800'
            },
            photoGallery: ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800'],
          };

          let mappedEscrowStatus: EscrowOrder['escrowStatus'] = 'HELD_IN_ESCROW';
          if (bOrd.escrowStatus === 'RELEASED' || bOrd.status === 'DELIVERED') {
            mappedEscrowStatus = 'COMPLETED_RELEASED';
          } else if (bOrd.escrowStatus === 'REFUNDED' || bOrd.status === 'CANCELLED') {
            mappedEscrowStatus = 'REFUNDED_TO_BUYER';
          } else if (bOrd.status === 'SHIPPED') {
            mappedEscrowStatus = 'SHIPPED_TO_BUYER';
          } else if (bOrd.status === 'PROCESSING' || bOrd.status === 'PENDING') {
            mappedEscrowStatus = 'INSPECTION_IN_PROGRESS';
          }

          return {
            id: bOrd.id,
            listingId: bOrd.postId,
            listing: matchedListing,
            buyerId: bOrd.buyerId,
            buyerName: 'Khách Hàng',
            buyerPhone: '0912 345 678',
            buyerAddress: 'SecondLife Hub Address',
            sellerId: bOrd.sellerId,
            sellerName: 'Người Bán',
            itemPriceVnd: bOrd.finalPrice,
            inspectionFeeVnd: 0,
            shippingFeeVnd: 0,
            platformFeeVnd: 0,
            totalPaidVnd: bOrd.finalPrice,
            escrowStatus: mappedEscrowStatus,
            hasInspectionService: true,
            shippingLegs: [
              {
                id: 'LEG-1',
                legType: 'SELLER_TO_CENTER',
                carrier: 'GHTK',
                trackingNumber: `SCL-ORD-${bOrd.id.slice(0, 8)}`,
                status: bOrd.status === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
                origin: 'Địa chỉ người bán',
                destination: 'SecondLife Hub / Người mua',
                estimatedDelivery: '1 ngày',
                timeline: [
                  {
                    timestamp: new Date(bOrd.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    description: `Khởi tạo đơn hàng qua Escrow. Trạng thái: ${bOrd.status}.`,
                    location: 'Hệ thống SecondLife Escrow'
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

        setOrders(mappedOrders);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.warn('Could not load orders from backend:', err);
      setOrders([]);
    }
  }, [currentUser, currentRole, listings]);

  // Refresh listings when their query inputs or the active tab change.
  React.useEffect(() => {
    loadListingsFromBackend();
  }, [loadListingsFromBackend, activeTab]);

  // Orders also use the latest listings to map each order.
  React.useEffect(() => {
    loadUserOrders();
  }, [loadUserOrders, activeTab]);

  const handleOrderPlaced = (newOrder: EscrowOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
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
    } catch (err: any) {
      console.warn('Backend confirmDelivery fallback:', err);
    }
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId ? { ...ord, escrowStatus: 'COMPLETED_RELEASED' } : ord
      )
    );
    loadUserWallet();
    showToast(lang === 'vi' ? 'Đã xác nhận nhận hàng! Tiền trong Escrow đã được giải ngân thành công cho người bán.' : 'Delivery confirmed! Escrow funds released to seller.');
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

  const handleCancelOrder = async (orderId: string) => {
    try {
      await orderService.cancelOrder(orderId);
    } catch (err: any) {
      console.warn('Backend cancelOrder fallback:', err);
    }
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId ? { ...ord, escrowStatus: 'REFUNDED_TO_BUYER' } : ord
      )
    );
    loadUserWallet();
    showToast(lang === 'vi' ? 'Đã hủy đơn hàng! Tiền ký quỹ Escrow đã được hoàn lại 100% vào ví người mua.' : 'Order cancelled and refunded to buyer.');
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
      {activeTab !== 'admin-dashboard' && activeTab !== 'staff-workspace' && (
        <Navbar
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          lang={lang}
          onLangChange={setLang}
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
          userCredit={userCredit}
          walletBalance={walletBalance}
          onOpenSellerRegister={() => {
            if (currentUser && ['admin', 'staff', 'inspector'].includes(currentUser.role)) {
              showToast(lang === 'vi'
                ? 'Tài khoản Quản trị viên, Nhân viên và Kỹ sư Hub không được đăng ký làm Người Bán.'
                : 'Admin, Staff and Inspector roles cannot register as sellers.');
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

      {/* Main Content Area */}
      <main className={activeTab === 'admin-dashboard' || activeTab === 'staff-workspace' ? 'flex-1 w-full' : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6'}>
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
              } else if (['admin', 'staff', 'inspector'].includes(currentUser.role)) {
                showToast(lang === 'vi'
                  ? 'Tài khoản Quản trị viên, Nhân viên và Kỹ sư Hub không được đăng ký làm Người Bán.'
                  : 'Admin, Staff and Inspector roles cannot register as sellers.');
              } else if (currentUser.role !== 'seller') {
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
          currentUser && currentUser.role !== 'seller' ? (
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
                    if (['admin', 'staff', 'inspector'].includes(currentUser.role)) {
                      showToast(lang === 'vi'
                        ? 'Tài khoản Quản trị viên, Nhân viên và Kỹ sư Hub không được đăng ký làm Người Bán.'
                        : 'Admin, Staff and Inspector roles cannot register as sellers.');
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
              onCancel={() => setActiveTab('marketplace')}
            />
          )
        )}

        {activeTab === 'orders' && (
          <EscrowOrdersView
            orders={orders}
            onConfirmReceipt={handleConfirmReceipt}
            onOpenDispute={handleOpenDispute}
            onMarkShipped={handleMarkShipped}
            onCancelOrder={handleCancelOrder}
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

        {activeTab === 'staff-workspace' && (
          <StaffWorkspaceView
            listings={listings}
            orders={orders}
            lang={lang}
            onViewWebsite={() => setActiveTab('marketplace')}
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
          />
        )}

        {activeTab === 'chat' && (
          <div className="max-w-3xl mx-auto space-y-6 pb-16">
            <div className="bg-[#FFFFFF] rounded-2xl p-8 border border-slate-200 shadow-xs text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#24263e]">
                {lang === 'vi' ? 'Hệ Thống Đàm Phán & Chống Lừa Đảo AI' : 'Smart Negotiation & Anti-Fraud Chat'}
              </h2>
              <p className="text-xs sm:text-sm text-[#24263e]/70 max-w-lg mx-auto">
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
                className="px-5 py-2.5 bg-gradient-to-r from-[#c34c36] to-[#fce5da] hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
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
            setChatListing(item);
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
          currentRole={currentRole}
          onClose={() => setChatListing(null)}
          onBuyClick={(item, agreedPrice, negotiationId) => {
            if (!currentUser) {
              setPendingCheckoutItem(item);
              requireAuth(undefined, lang === 'vi'
                ? 'Vui lòng đăng nhập để tiến hành mua hàng bảo đảm Escrow và kiểm định Hub.'
                : 'Please log in to purchase with Escrow protection.');
              return;
            }
            setChatListing(null);
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
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            kycStatus: 'verified',
            emailVerified: true,
          };
          setCurrentUser(profileUser);
          setCurrentRole(user.role);
          setStoredUser(profileUser);
          showToast(
            lang === 'vi'
              ? `Chào mừng ${user.name} (${user.role === 'buyer' ? 'Người Mua' : user.role === 'seller' ? 'Người Bán' : user.role === 'inspector' ? 'Kỹ Sư Hub' : user.role === 'staff' ? 'Nhân Viên Vận Hành' : 'Quản Trị'}) đã đăng nhập!`
              : `Welcome ${user.name}! Logged in successfully as ${user.role.toUpperCase()}.`
          );
          if (user.role === 'admin') {
            setActiveTab('admin-dashboard');
          } else if (user.role === 'inspector') {
            setActiveTab('inspection-hub');
          } else if (user.role === 'staff') {
            setActiveTab('staff-workspace');
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
          setCurrentUser(updated);
          setStoredUser(updated);
          showToast(
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
        currentCredit={userCreditBalance}
        userCredit={userCredit}
        walletBalance={walletBalance}
        onCreditUpdated={(newBal) => setUserCreditBalance(newBal)}
        onUserCreditUpdated={(newCredit) => setUserCredit(newCredit)}
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

      {/* E-Commerce Footer */}
      {activeTab !== 'admin-dashboard' && activeTab !== 'inspection-hub' && activeTab !== 'staff-workspace' && (
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
