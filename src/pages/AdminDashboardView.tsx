import React, { useState, useMemo, useEffect } from 'react';
import {
  EscrowOrder,
  DisputeCase,
  Listing,
  Language,
  EscrowStatus,
  UserProfile,
  TopupPackage
} from '../types';
import { translations, formatVND } from '../utils/translations';
import { dialogService } from '../utils/dialogService';
import {
  adminService,
  adminPostService,
  adminRbacService,
  adminCreditPricingService,
  topupService,
  healthService,
  UserAdminResponseDto,
  SellerVerificationResponseDto,
  PermissionResponseDto,
  RolePermissionsResponseDto,
  RolePermissionAuditResponseDto,
  UserRolesResponseDto,
  UserRoleAuditResponseDto,
  CreditPricingRuleResponseDto,
  CreatePermissionRequestDto,
  reputationService,
  staffService
} from '../services';
import logoImg from '../assets/logo.png';
import {
  ShieldAlert,
  CheckCircle2,
  Download,
  Gavel,
  Sparkles,
  Sliders,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Tag,
  Building2,
  TrendingUp,
  Wallet,
  Lock,
  Unlock,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Truck,
  ShieldCheck,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Store,
  Layers,
  Trash2,
  Menu,
  ShoppingBag,
  BarChart3,
  PieChart,
  UserPlus,
  Minus,
  Plus,
  Home,
  ArrowRight,
  Calendar,
  Phone,
  Mail,
  UserCheck,
  AlertCircle,
  XCircle,
  Loader2,
  History,
  ScanFace,
  ZoomIn,
  MapPin,
  BadgeCheck,
  User,
  LogOut,
  Percent,
} from 'lucide-react';
import { CatalogAiTab } from '../components/admin/CatalogAiTab';
import { SystemWalletTab } from '../components/admin/SystemWalletTab';
import { CommissionRulesTab } from '../components/admin/CommissionRulesTab';
import { InspectionGovernanceTab } from '../components/admin/InspectionGovernanceTab';
import { WithdrawalsTab } from '../components/admin/WithdrawalsTab';
import { PermissionsTab } from '../components/admin/PermissionsTab';

interface AdminDashboardViewProps {
  orders: EscrowOrder[];
  disputes?: DisputeCase[];
  listings: Listing[];
  onResolveDispute?: (disputeId: string, decision: 'REFUND_BUYER' | 'RELEASE_SELLER') => void;
  lang: Language;
  onViewWebsite?: () => void;
  currentUser?: UserProfile | null;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onOpenListingDetail?: (listing: Listing) => void;
}

type AdminTab =
  | 'overview'
  | 'catalog-ai'
  | 'orders'
  | 'listings'
  | 'withdrawals'
  | 'hubs'
  | 'customers'
  | 'seller-kyc'
  | 'permissions'
  | 'credit-pricing'
  | 'system-wallet'
  | 'commission-rules'
  | 'inspection-governance';


export const VALID_ADMIN_TABS: AdminTab[] = [
  'overview',
  'catalog-ai',
  'orders',
  'listings',
  'withdrawals',
  'hubs',
  'customers',
  'seller-kyc',
  'permissions',
  'credit-pricing',
  'system-wallet',
  'commission-rules',
  'inspection-governance'
];

export const ADMIN_TAB_STORAGE_KEY = 'secondlife_admin_active_tab';

export function getInitialAdminTab(): AdminTab {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const subtab = params.get('subtab') as AdminTab;
    if (subtab && VALID_ADMIN_TABS.includes(subtab)) {
      return subtab;
    }
    try {
      const saved = sessionStorage.getItem(ADMIN_TAB_STORAGE_KEY) as AdminTab;
      if (saved && VALID_ADMIN_TABS.includes(saved)) {
        return saved;
      }
    } catch (e) {}
  }
  return 'overview';
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  orders: initialOrders,
  listings: initialListings,
  lang,
  onViewWebsite,
  currentUser,
  onOpenProfile,
  onLogout,
  onOpenListingDetail
}) => {
  const t = translations[lang];

  // Active sub-tab in Admin Dashboard (khôi phục từ URL param ?subtab= hoặc sessionStorage khi F5)
  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialAdminTab);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, activeTab);
    } catch (e) {}
    const currentUrl = new URL(window.location.href);
    if (activeTab && activeTab !== 'overview') {
      currentUrl.searchParams.set('subtab', activeTab);
    } else {
      currentUrl.searchParams.delete('subtab');
    }
    if (currentUrl.toString() !== window.location.href) {
      window.history.replaceState(null, '', currentUrl.toString());
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      const tab = getInitialAdminTab();
      setActiveTab(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sidebar toggle state (expanded / collapsed)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Collapsible cards state
  const [collapsedCards, setCollapsedCards] = useState<{ [key: string]: boolean }>({
    booking: false,
    newOrders: false,
    contacts: false
  });

  const toggleCardCollapse = (cardKey: string) => {
    setCollapsedCards((prev) => ({ ...prev, [cardKey]: !prev[cardKey] }));
  };

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [listingCategoryFilter, setListingCategoryFilter] = useState<string>('ALL');

  // Local state for listings and orders moderation
  const [localListings, setLocalListings] = useState<Listing[]>(initialListings);
  const [localOrders, setLocalOrders] = useState<EscrowOrder[]>(initialOrders);

  // Real backend users & seller verifications from Swagger API
  const [backendUsers, setBackendUsers] = useState<UserAdminResponseDto[]>([]);
  const [backendVerifications, setBackendVerifications] = useState<SellerVerificationResponseDto[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  useEffect(() => {
    if (initialListings && initialListings.length > 0) {
      setLocalListings(initialListings);
    }
  }, [initialListings]);

  useEffect(() => {
    if (activeTab === 'listings') {
      loadAdminPosts();
    }
  }, [activeTab]);

  useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setLocalOrders(initialOrders);
    }
  }, [initialOrders]);

  useEffect(() => {
    adminService.getAdminUsers({ page: 0, size: 20 })
      .then(res => {
        if (res && res.items && res.items.length > 0) {
          setBackendUsers(res.items);
        }
      })
      .catch(() => {});

    adminService.getSellerVerifications({ page: 0, size: 20 })
      .then(res => {
        if (res && res.items && res.items.length > 0) {
          setBackendVerifications(res.items);
        }
      })
      .catch(() => {});

    adminPostService.getAdminPosts()
      .then(res => {
        const items = Array.isArray(res) ? res : res?.items || res?.content || [];
        if (items.length > 0) {
          // Lọc bỏ hoàn toàn các bản nháp chưa hoàn thành (DRAFT) của các tài khoản người bán
          const nonDrafts = items.filter((post: any) => post.status !== 'DRAFT');
          const mapped: Listing[] = nonDrafts.map((post: any) => {
            const rawImages: string[] = Array.isArray(post.imageUrls) && post.imageUrls.length > 0
              ? post.imageUrls
              : (post.coverImageUrl ? [post.coverImageUrl] : post.imageUrl ? [post.imageUrl] : post.thumbnailUrl ? [post.thumbnailUrl] : []);
            const fallbackImage = 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800';
            const primaryImage = rawImages[0] || fallbackImage;

            return {
              id: post.id || `post-${Date.now()}`,
              title: post.title || 'Thiết bị gia dụng SecondLife',
              category: (post.category || 'Tủ lạnh & Tủ đông') as any,
              brand: post.brand || 'SecondLife',
              model: post.model || 'Model',
              purchaseYear: 2024,
              priceVnd: Number(post.price || post.priceVnd || 0),
              originalPriceVnd: Number(post.originalPriceVnd || post.aiSuggestedPrice || post.price || 0),
              conditionGrade: (post.itemCondition || post.condition || 'Like New') as any,
              declaredConditionText: post.itemCondition || post.condition || 'Tình trạng tốt',
              description: post.description || post.aiDescription || 'Đã qua thẩm định SecondLife.',
              location: post.location || 'Việt Nam',
              sellerId: post.user?.id || post.sellerId || 'seller',
              sellerName: post.user?.fullName || post.sellerName || 'Người bán SecondLife',
              sellerRating: 5.0,
              sellerCompletedOrders: 1,
              sellerVerified: true,
              status: (post.status === 'ACTIVE' ? 'active' : post.status === 'REJECTED' ? 'rejected' : post.status === 'PENDING_REVIEW' || post.status === 'PENDING' ? 'pending' : 'active') as any,
              backendStatus: post.status,
              createdAt: post.createdAt || new Date().toISOString(),
              isInspectionGuaranteed: true,
              requiresInspection: Number(post.price || post.priceVnd || 0) > 5000000,
              photos: {
                front: rawImages[0] || primaryImage,
                back: rawImages[1] || primaryImage,
                screenOrDetails: rawImages[2] || primaryImage,
                accessoriesOrBox: rawImages[3] || primaryImage,
                serialOrReceipt: rawImages[4] || primaryImage,
              },
              photoGallery: rawImages.length > 0 ? rawImages : [primaryImage],
            };
          });
          setLocalListings(mapped);
        }
      })
      .catch(() => {});
  }, []);

  // Seller Verification Review states
  const [selectedVerificationDetail, setSelectedVerificationDetail] = useState<any | null>(null);
  const [verificationFilterTab, setVerificationFilterTab] = useState<'ALL' | 'NEEDS_REVIEW' | 'PROVIDER_ERROR' | 'APPROVED' | 'RESUBMIT_REQUIRED' | 'REJECTED' | 'EKYC_PENDING'>('ALL');
  const [verificationSearchTerm, setVerificationSearchTerm] = useState<string>('');
  const [isLoadingVerifications, setIsLoadingVerifications] = useState<boolean>(false);
  const [rejectModalVerificationId, setRejectModalVerificationId] = useState<string | null>(null);
  const [rejectionReasonCode, setRejectionReasonCode] = useState<string>('IMAGE_TOO_BLURRY');
  const [rejectionReasonText, setRejectionReasonText] = useState<string>('');
  const [verReviewReason, setVerReviewReason] = useState<string>('Ảnh CMND/CCCD bị mờ hoặc không khớp thông tin');
  const [reviewingAction, setReviewingAction] = useState<'APPROVE' | 'REJECT' | 'RESUBMIT' | 'RETRY' | null>(null);
  const [reviewNoticeMsg, setReviewNoticeMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; title: string } | null>(null);

  // Inspection center creation modal state
  const [showAddHubModal, setShowAddHubModal] = useState<boolean>(false);
  const [newHubData, setNewHubData] = useState({
    hubCenterName: '',
    email: '',
    password: '',
    phone: '',
    city: 'TP. Hồ Chí Minh',
    address: '',
  });

  // Modal dialog states
  const [selectedOrderModal, setSelectedOrderModal] = useState<EscrowOrder | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Admin User Detail Modal states (Requirement 9)
  const [selectedUserDetailId, setSelectedUserDetailId] = useState<string | null>(null);
  const [userDetailModalData, setUserDetailModalData] = useState<UserAdminResponseDto | null>(null);
  const [isLoadingUserDetail, setIsLoadingUserDetail] = useState(false);
  const [userDetailError, setUserDetailError] = useState<string | null>(null);

  const handleViewUserDetail = async (userId: string) => {
    setSelectedUserDetailId(userId);
    setIsLoadingUserDetail(true);
    setUserDetailError(null);
    setUserDetailModalData(null);
    try {
      const data = await adminService.getAdminUserById(userId);
      setUserDetailModalData(data);
    } catch (err: any) {
      setUserDetailError(err?.message || 'Không thể tải thông tin chi tiết người dùng');
    } finally {
      setIsLoadingUserDetail(false);
    }
  };

  // =========================================================================
  // GỠ BỎ HẠN CHẾ BÁN HÀNG (POST /admin/sellers/{id}/reputation/lift-restriction)
  // =========================================================================
  const [liftRestrictionModal, setLiftRestrictionModal] = useState<{
    isOpen: boolean;
    sellerId: string;
    sellerName: string;
    reason: string;
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    sellerId: '',
    sellerName: '',
    reason: '',
    isSubmitting: false,
    error: null,
  });

  const handleOpenLiftRestrictionModal = (sellerId: string, sellerName: string) => {
    setLiftRestrictionModal({
      isOpen: true,
      sellerId,
      sellerName,
      reason: 'Người bán đã hoàn thành trách nhiệm khắc phục sự cố và cam kết tiêu chuẩn dịch vụ',
      isSubmitting: false,
      error: null,
    });
  };

  const handleConfirmLiftRestriction = async () => {
    if (!liftRestrictionModal.sellerId || !liftRestrictionModal.reason.trim()) {
      setLiftRestrictionModal((prev) => ({ ...prev, error: 'Vui lòng nhập lý do gỡ bỏ hạn chế bán hàng' }));
      return;
    }
    setLiftRestrictionModal((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await reputationService.liftRestriction(liftRestrictionModal.sellerId, liftRestrictionModal.reason.trim());
      triggerNotice(`Đã gỡ bỏ hạn chế bán hàng cho tài khoản ${liftRestrictionModal.sellerName} thành công!`);
      setLiftRestrictionModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      setLiftRestrictionModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err?.message || 'Không thể gỡ hạn chế bán hàng.',
      }));
    }
  };

  // Tra cứu hồ sơ eKYC nhanh theo User ID (GET /api/v1/staff/seller-verifications/user/{userId})
  const [userIdSearchInput, setUserIdSearchInput] = useState('');
  const [isSearchingByUserId, setIsSearchingByUserId] = useState(false);

  const handleLookupVerificationByUserId = async () => {
    if (!userIdSearchInput.trim()) return;
    setIsSearchingByUserId(true);
    try {
      const ver = await staffService.getVerificationByUserId(userIdSearchInput.trim());
      if (ver) {
        setSelectedVerificationDetail(ver);
        triggerNotice(`Đã tìm thấy hồ sơ eKYC của User #${userIdSearchInput.trim().slice(0, 8)}`);
      } else {
        triggerNotice('Không tìm thấy hồ sơ eKYC nào cho User ID này');
      }
    } catch (err: any) {
      triggerNotice(err?.message || 'Không tìm thấy hồ sơ eKYC theo User ID này');
    } finally {
      setIsSearchingByUserId(false);
    }
  };

  // =========================================================================
  // RBAC Roles list for User Role assignment modal
  // =========================================================================
  const [rolesList, setRolesList] = useState<RolePermissionsResponseDto[]>([]);

  useEffect(() => {
    adminRbacService.getRoles().then(roles => {
      if (roles) setRolesList(roles);
    }).catch(() => {});
  }, []);

  // Backend Health Status Check (GET /api/health)
  const [healthInfo, setHealthInfo] = useState<{ status: 'UNKNOWN' | 'UP' | 'DOWN'; latency?: number }>({
    status: 'UNKNOWN'
  });
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const checkBackendHealth = async () => {
    setIsLoadingHealth(true);
    const start = performance.now();
    try {
      const res = await healthService.checkHealth();
      const elapsed = Math.round(performance.now() - start);
      if (res && (res.status === 'UP' || res.status === 'OK' || (res as any).success !== false)) {
        setHealthInfo({ status: 'UP', latency: elapsed });
        triggerNotice(`Backend Spring Boot hoạt động tốt (${elapsed}ms). Trạng thái: UP.`);
      } else {
        setHealthInfo({ status: 'UP', latency: elapsed });
      }
    } catch {
      setHealthInfo({ status: 'DOWN' });
      triggerNotice('Không thể kết nối đến Backend Server (port 8080).');
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  // Post Moderation Live Sync (GET /api/v1/admin/posts)
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  const loadAdminPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const res = await adminPostService.getAdminPosts();
      const items = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
      // Lọc bỏ hoàn toàn các bản nháp chưa submit (DRAFT) của các người bán
      const validPosts = items.filter((p: any) => p.status !== 'DRAFT');
      if (validPosts.length > 0) {
        const mappedListings: Listing[] = validPosts.map((p: any) => ({
          id: p.id,
          title: p.title || 'Sản phẩm SecondLife',
          category: p.categoryName || 'Sản phẩm',
          brand: p.brand || 'Khác',
          model: p.model || '',
          purchaseYear: p.purchaseYear || 2024,
          priceVnd: p.price || 0,
          conditionGrade: p.itemCondition || 'USED',
          declaredConditionText: p.description || 'Chưa có mô tả',
          description: p.description || '',
          location: p.location || 'Toàn quốc',
          sellerId: p.user?.id || p.sellerId || '',
          sellerName: p.user?.fullName || p.user?.email || p.sellerName || 'Người bán',
          sellerRating: 5.0,
          sellerCompletedOrders: 0,
          sellerVerified: true,
          status: p.status === 'ACTIVE' ? 'active' : p.status === 'REJECTED' ? 'rejected' : p.status === 'PENDING_REVIEW' || p.status === 'PENDING' ? 'pending' : 'active',
          backendStatus: p.status,
          createdAt: p.createdAt || new Date().toISOString(),
          isInspectionGuaranteed: true,
          requiresInspection: true,
          photos: {
            front: p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800',
            back: p.imageUrls?.[1] || p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&q=80&w=800',
            screenOrDetails: p.imageUrls?.[2] || p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=800',
            accessoriesOrBox: p.imageUrls?.[3] || p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800',
            serialOrReceipt: p.imageUrls?.[4] || p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800'
          },
          photoGallery: p.imageUrls?.length > 0 ? p.imageUrls : ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=800'],
          suggestedAiPriceVnd: p.aiSuggestedPrice,
          aiPriceEstimation: p.aiSuggestedPrice && p.aiSuggestedPrice > 0 ? {
            minVnd: Math.round(Number(p.aiSuggestedPrice) * 0.9),
            maxVnd: Math.round(Number(p.aiSuggestedPrice) * 1.1),
            suggestedVnd: Number(p.aiSuggestedPrice),
            quickSaleVnd: Math.round(Number(p.aiSuggestedPrice) * 0.85),
            confidence: 96,
            daysToSell: 3,
          } : undefined
        }));
        setLocalListings(mappedListings);
        triggerNotice(`Đã đồng bộ ${mappedListings.length} bài đăng thực tế từ máy chủ Backend.`);
      }
    } catch (err: any) {
      console.warn('Backend load admin posts fallback:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // =========================================================================
  // USER ROLES MODAL STATE & HANDLERS (Screen 3)
  // =========================================================================
  const [userRoleModalUserId, setUserRoleModalUserId] = useState<string | null>(null);
  const [userRoleModalUserName, setUserRoleModalUserName] = useState<string>('');
  const [userRoleSnapshot, setUserRoleSnapshot] = useState<string[]>([]);
  const [userRoleSelected, setUserRoleSelected] = useState<string[]>([]);
  const [userRoleEffectivePerms, setUserRoleEffectivePerms] = useState<string[]>([]);
  const [userRoleAuditTrail, setUserRoleAuditTrail] = useState<UserRoleAuditResponseDto[] | null>(null);
  const [isLoadingUserRoles, setIsLoadingUserRoles] = useState<boolean>(false);
  const [isSavingUserRoles, setIsSavingUserRoles] = useState<boolean>(false);

  const handleOpenUserRolesModal = async (userId: string, name: string) => {
    setUserRoleModalUserId(userId);
    setUserRoleModalUserName(name);
    setUserRoleAuditTrail(null);
    setIsLoadingUserRoles(true);
    try {
      const res = await adminService.getUserRoles(userId);
      const roles = res?.roleCodes || [];
      setUserRoleSnapshot([...roles]);
      setUserRoleSelected([...roles]);
      setUserRoleEffectivePerms(res?.permissionCodes || []);
    } catch (err: any) {
      triggerNotice('Không thể tải danh sách vai trò người dùng: ' + (err.message || ''));
    } finally {
      setIsLoadingUserRoles(false);
    }
  };

  const handleToggleUserRole = (roleCode: string) => {
    setUserRoleSelected(prev =>
      prev.includes(roleCode) ? prev.filter(r => r !== roleCode) : [...prev, roleCode]
    );
  };

  const handleSaveUserRoles = async () => {
    if (!userRoleModalUserId) return;
    setIsSavingUserRoles(true);
    try {
      const res = await adminService.replaceUserRoles(userRoleModalUserId, {
        expectedRoleCodes: userRoleSnapshot,
        roleCodes: userRoleSelected
      });
      triggerNotice(`Đã gán vai trò cho người dùng ${userRoleModalUserName} thành công! Phiên đăng nhập cũ của người dùng này đã được thu hồi.`);
      setUserRoleSnapshot([...(res?.roleCodes || userRoleSelected)]);
      setUserRoleSelected([...(res?.roleCodes || userRoleSelected)]);
      setUserRoleEffectivePerms(res?.permissionCodes || []);
      // Cập nhật lại danh sách users hiển thị
      adminService.getAdminUsers({ page: 0, size: 20 })
        .then(u => { if (u?.items) setBackendUsers(u.items); })
        .catch(() => {});
    } catch (err: any) {
      if (err?.message?.includes('409') || err?.status === 409) {
        triggerNotice('⚠️ Xung đột dữ liệu (HTTP 409): Vai trò của người dùng đã thay đổi trước đó. Đang tải lại...');
        handleOpenUserRolesModal(userRoleModalUserId, userRoleModalUserName);
      } else {
        triggerNotice(err?.message || 'Cập nhật vai trò thất bại');
      }
    } finally {
      setIsSavingUserRoles(false);
    }
  };

  const handleViewUserRoleAudit = async (userId: string) => {
    try {
      const res = await adminService.getUserRoleAudit(userId);
      setUserRoleAuditTrail(res?.items || []);
    } catch (err: any) {
      triggerNotice('Không thể tải lịch sử kiểm toán vai trò: ' + (err.message || ''));
    }
  };

  // =========================================================================
  // CREDIT PRICING & TOPUP PACKAGES (CHIẾT KHẤU GÓI NẠP) STATE & HANDLERS
  // =========================================================================
  const [creditPrices, setCreditPrices] = useState<CreditPricingRuleResponseDto[]>([]);
  const [topupPackages, setTopupPackages] = useState<TopupPackage[]>([]);
  const [isLoadingPricing, setIsLoadingPricing] = useState<boolean>(false);
  const [editingPriceType, setEditingPriceType] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<number>(0);

  const loadCreditPricingData = async () => {
    setIsLoadingPricing(true);
    try {
      const [pricesRes, packagesRes] = await Promise.allSettled([
        adminCreditPricingService.getCreditPrices(),
        topupService.getTopupPackages()
      ]);

      if (pricesRes.status === 'fulfilled') {
        const pricesData = pricesRes.value;
        const pricesList = Array.isArray(pricesData) ? pricesData : (pricesData as any)?.data || [];
        setCreditPrices(pricesList);
      } else {
        console.warn('Failed to load credit prices:', pricesRes.reason);
      }

      if (packagesRes.status === 'fulfilled') {
        const pkgData = packagesRes.value;
        const pkgList = Array.isArray(pkgData) ? pkgData : (pkgData as any)?.data || [];
        setTopupPackages(pkgList);
      } else {
        console.warn('Failed to load topup packages:', packagesRes.reason);
      }
    } catch (err: any) {
      triggerNotice('Không thể tải bảng giá credit: ' + (err.message || ''));
    } finally {
      setIsLoadingPricing(false);
    }
  };

  const handleUpdateCreditPrice = async (creditType: string, newPrice: number) => {
    try {
      await adminCreditPricingService.updateCreditPrice(creditType, newPrice);
      triggerNotice(`Đã cập nhật đơn giá ${creditType} thành ${formatVND(newPrice)}`);
      setEditingPriceType(null);
      await loadCreditPricingData();
    } catch (err: any) {
      triggerNotice(err?.message || 'Cập nhật giá thất bại');
    }
  };

  // Tự động load dữ liệu khi chuyển sang tab credit-pricing hoặc listings
  useEffect(() => {
    if (activeTab === 'credit-pricing') {
      loadCreditPricingData();
    } else if (activeTab === 'listings') {
      loadAdminPosts();
    }
  }, [activeTab]);

  // AI & Platform Configurations
  const [duplicateThreshold, setDuplicateThreshold] = useState(85);
  const [priceAnomalyThreshold, setPriceAnomalyThreshold] = useState(45);
  const [commissionRate, setCommissionRate] = useState(2.5);
  const [autoApproveAiConfidence, setAutoApproveAiConfidence] = useState(92);
  const [modelVersion] = useState('LightGBM-v3.4-Ensemble-Gemini3.8');

  // Notification / Alert toast
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const formatScore = (val: number | null | undefined) => {
    if (val === undefined || val === null) return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
    return `${pct}%`;
  };

  const QUICK_VERIFICATION_REASONS = [
    'Ảnh CMND/CCCD bị mờ, chói lóa không nhận diện được chữ số',
    'Ảnh khuôn mặt selfie không khớp với chân dung trên CCCD',
    'Giấy tờ bị mất góc, mờ quốc huy hoặc có dấu hiệu can thiệp',
    'Thông tin họ tên/ngày sinh không trùng khớp với hồ sơ đăng ký',
    'Chưa chụp rõ ràng 2 mặt thẻ CCCD/CMND',
    'Ảnh chụp từ màn hình hoặc bản photo, yêu cầu chụp bản gốc'
  ];

  const handleRefreshSellerVerifications = async () => {
    setIsLoadingVerifications(true);
    try {
      const res = await adminService.getSellerVerifications({ page: 0, size: 50 });
      if (res?.items) {
        setBackendVerifications(res.items);
      }
      triggerNotice('Đã làm mới danh sách hồ sơ xác minh người bán.');
    } catch (err: any) {
      triggerNotice('Lỗi tải danh sách xác minh: ' + (err.message || ''));
    } finally {
      setIsLoadingVerifications(false);
    }
  };

  const handleOpenVerificationDetailModal = async (item: any) => {
    setSelectedVerificationDetail(item);
    setReviewNoticeMsg(null);
    setVerReviewReason(item.rejectionReason || 'Ảnh CMND/CCCD bị mờ hoặc không khớp thông tin');
    setRejectionReasonCode(item.reasonCode && item.reasonCode !== 'NONE' ? item.reasonCode : 'IMAGE_TOO_BLURRY');
    try {
      const fullDetail = await adminService.getSellerVerificationById(item.id);
      if (fullDetail) {
        setSelectedVerificationDetail((prev: any) => ({ ...(prev || {}), ...fullDetail }));
        if (fullDetail.rejectionReason) {
          setVerReviewReason(fullDetail.rejectionReason);
        }
        if (fullDetail.reasonCode && fullDetail.reasonCode !== 'NONE') {
          setRejectionReasonCode(fullDetail.reasonCode);
        }
      }
    } catch (err) {
      console.warn('Backend getSellerVerificationById fallback:', err);
    }
  };

  const handleApproveSellerVerification = async (id: string, currentStatus?: string) => {
    if (currentStatus && !['SUBMITTED', 'EKYC_PENDING', 'NEEDS_REVIEW', 'PENDING'].includes(currentStatus)) {
      triggerNotice(`Chỉ hồ sơ ở trạng thái chờ duyệt (SUBMITTED, EKYC_PENDING, NEEDS_REVIEW) mới có thể phê duyệt bởi Quản trị viên (Trạng thái hiện tại: ${currentStatus}).`);
      return;
    }
    setReviewingAction('APPROVE');
    setReviewNoticeMsg({ text: 'Đang tiến hành phê duyệt và cấp vai trò Người bán (SELLER)...', type: 'info' });
    try {
      const result = await adminService.approveSellerVerification(id);
      setReviewNoticeMsg({ text: 'Đã hoàn tất! Hồ sơ người bán đã được phê duyệt thành công, vai trò SELLER đã được kích hoạt.', type: 'success' });
      triggerNotice('Đã phê duyệt hồ sơ người bán thành công! Vai trò SELLER đã được cấp.');
      const res = await adminService.getSellerVerifications({ page: 0, size: 50 });
      if (res?.items) setBackendVerifications(res.items);
      const updated = await adminService.getSellerVerificationById(id).catch(() => null);
      if (updated) {
        setSelectedVerificationDetail(updated);
      } else if (result) {
        setSelectedVerificationDetail(result);
      } else {
        setSelectedVerificationDetail((prev: any) => prev ? { ...prev, status: 'APPROVED' } : null);
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('409') || err?.status === 409) {
        setReviewNoticeMsg({ text: 'Hồ sơ đã thay đổi trạng thái trên hệ thống (409 Conflict). Đang đồng bộ lại dữ liệu...', type: 'error' });
        triggerNotice('Hồ sơ đã thay đổi trạng thái. Đang làm mới dữ liệu...');
        const updated = await adminService.getSellerVerificationById(id).catch(() => null);
        if (updated) setSelectedVerificationDetail(updated);
        const res = await adminService.getSellerVerifications({ page: 0, size: 50 }).catch(() => null);
        if (res?.items) setBackendVerifications(res.items);
      } else {
        setReviewNoticeMsg({ text: 'Phê duyệt thất bại: ' + errMsg, type: 'error' });
        triggerNotice(errMsg || 'Phê duyệt hồ sơ thất bại');
      }
    } finally {
      setReviewingAction(null);
    }
  };

  const handleRejectSellerVerificationWithReason = async (id: string, reason?: string) => {
    const rawReason = (reason || verReviewReason || '').trim();
    if (!rawReason) {
      triggerNotice('Vui lòng nhập lý do từ chối hồ sơ (tối đa 1000 ký tự).');
      return;
    }
    const finalReason = rawReason.length > 1000 ? rawReason.substring(0, 1000) : rawReason;
    setReviewingAction('REJECT');
    setReviewNoticeMsg({ text: 'Đang xử lý từ chối hồ sơ người bán...', type: 'info' });
    try {
      await adminService.rejectSellerVerification(id, {
        rejectionReason: finalReason
      });
      setReviewNoticeMsg({ text: 'Đã từ chối hồ sơ xác thực. Hồ sơ đã kết thúc (REJECTED).', type: 'success' });
      triggerNotice('Đã từ chối hồ sơ xác thực người bán.');
      setRejectModalVerificationId(null);
      const res = await adminService.getSellerVerifications({ page: 0, size: 50 });
      if (res?.items) setBackendVerifications(res.items);
      const updated = await adminService.getSellerVerificationById(id).catch(() => null);
      if (updated) {
        setSelectedVerificationDetail(updated);
      } else {
        setSelectedVerificationDetail((prev: any) => prev ? { ...prev, status: 'REJECTED', rejectionReason: finalReason } : null);
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('409') || err?.status === 409) {
        setReviewNoticeMsg({ text: 'Hồ sơ đã thay đổi trạng thái trên hệ thống (409 Conflict). Đang đồng bộ lại dữ liệu...', type: 'error' });
        triggerNotice('Hồ sơ đã thay đổi trạng thái. Đang làm mới dữ liệu...');
        const updated = await adminService.getSellerVerificationById(id).catch(() => null);
        if (updated) setSelectedVerificationDetail(updated);
        const res = await adminService.getSellerVerifications({ page: 0, size: 50 }).catch(() => null);
        if (res?.items) setBackendVerifications(res.items);
      } else {
        setReviewNoticeMsg({ text: 'Từ chối thất bại: ' + errMsg, type: 'error' });
        triggerNotice(errMsg || 'Từ chối hồ sơ thất bại');
      }
    } finally {
      setReviewingAction(null);
    }
  };

  const handleRequestResubmitSellerVerificationWithReason = async (id: string, reason?: string) => {
    const rawReason = (reason || verReviewReason || '').trim();
    if (!rawReason) {
      triggerNotice('Vui lòng nhập lý do/hướng dẫn yêu cầu nộp lại chứng từ (tối đa 1000 ký tự).');
      return;
    }
    const finalReason = rawReason.length > 1000 ? rawReason.substring(0, 1000) : rawReason;
    setReviewingAction('RESUBMIT');
    setReviewNoticeMsg({ text: 'Đang gửi yêu cầu nộp lại chứng từ cho người bán...', type: 'info' });
    try {
      await adminService.requestResubmitSellerVerification(id, {
        rejectionReason: finalReason
      });
      setReviewNoticeMsg({ text: 'Đã gửi yêu cầu nộp lại ảnh chứng từ (RESUBMIT_REQUIRED). Đang chờ người bán cập nhật.', type: 'success' });
      triggerNotice('Đã gửi yêu cầu bổ sung/chụp lại eKYC cho người bán.');
      const res = await adminService.getSellerVerifications({ page: 0, size: 50 });
      if (res?.items) setBackendVerifications(res.items);
      const updated = await adminService.getSellerVerificationById(id).catch(() => null);
      if (updated) {
        setSelectedVerificationDetail(updated);
      } else {
        setSelectedVerificationDetail((prev: any) => prev ? { ...prev, status: 'RESUBMIT_REQUIRED', rejectionReason: finalReason } : null);
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('409') || err?.status === 409) {
        setReviewNoticeMsg({ text: 'Hồ sơ đã thay đổi trạng thái trên hệ thống (409 Conflict). Đang đồng bộ lại dữ liệu...', type: 'error' });
        triggerNotice('Hồ sơ đã thay đổi trạng thái. Đang làm mới dữ liệu...');
        const updated = await adminService.getSellerVerificationById(id).catch(() => null);
        if (updated) setSelectedVerificationDetail(updated);
        const res = await adminService.getSellerVerifications({ page: 0, size: 50 }).catch(() => null);
        if (res?.items) setBackendVerifications(res.items);
      } else {
        setReviewNoticeMsg({ text: 'Yêu cầu nộp lại thất bại: ' + errMsg, type: 'error' });
        triggerNotice(errMsg || 'Yêu cầu nộp lại hồ sơ thất bại');
      }
    } finally {
      setReviewingAction(null);
    }
  };

  const handleRejectSellerVerification = async () => {
    if (!rejectModalVerificationId) return;
    const reason = (rejectionReasonText || 'Hồ sơ chưa đạt yêu cầu kiểm định định danh eKYC.').trim();
    await handleRejectSellerVerificationWithReason(rejectModalVerificationId, reason);
    setRejectionReasonText('');
  };

  const handleRetrySellerVerification = async (id: string) => {
    setReviewingAction('RETRY');
    setReviewNoticeMsg({ text: 'Đang kích hoạt thử lại quy trình eKYC với đối tác VNPT từ ảnh đã lưu...', type: 'info' });
    try {
      const res = await adminService.retrySellerVerification(id);
      const updated = await adminService.getSellerVerificationById(id).catch(() => res);
      if (updated) setSelectedVerificationDetail(updated);
      const listRes = await adminService.getSellerVerifications({ page: 0, size: 50 });
      if (listRes?.items) setBackendVerifications(listRes.items);

      const statusText = updated?.status || res?.status || 'Đã gửi yêu cầu';
      const ekycText = updated?.ekycStatus || res?.ekycStatus || '';
      setReviewNoticeMsg({
        text: `Đã hoàn tất thử lại eKYC! Kết quả hiện tại: Trạng thái ${statusText} ${ekycText ? `(${ekycText})` : ''}`,
        type: 'success'
      });
      triggerNotice(`Đã kích hoạt thử lại eKYC. Kết quả: ${statusText}`);
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('409') || err?.status === 409) {
        setReviewNoticeMsg({ text: 'Hồ sơ không ở trạng thái hợp lệ để retry hoặc đã đổi trạng thái (409 Conflict). Đang tải lại...', type: 'error' });
        triggerNotice('Hồ sơ đã đổi trạng thái, đang làm mới...');
        const updated = await adminService.getSellerVerificationById(id).catch(() => null);
        if (updated) setSelectedVerificationDetail(updated);
        const listRes = await adminService.getSellerVerifications({ page: 0, size: 50 });
        if (listRes?.items) setBackendVerifications(listRes.items);
      } else {
        setReviewNoticeMsg({ text: 'Thử lại thất bại: ' + errMsg, type: 'error' });
        triggerNotice(errMsg || 'Thử lại eKYC thất bại');
      }
    } finally {
      setReviewingAction(null);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await adminService.updateUserStatus(userId, {
        status: nextStatus as any,
        reason: 'Thay đổi trạng thái bởi Admin'
      });
      triggerNotice(`Đã chuyển trạng thái tài khoản thành ${nextStatus}.`);
      const res = await adminService.getAdminUsers({ page: 0, size: 20 });
      if (res?.items) setBackendUsers(res.items);
    } catch (err: any) {
      dialogService.error(err.message || 'Cập nhật trạng thái người dùng thất bại', 'Lỗi Cập Nhật');
    }
  };

  const handleCreateHubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.createInspectionCenterAccount({
        fullName: newHubData.hubCenterName.trim(),
        email: newHubData.email.trim(),
        password: newHubData.password,
        phone: newHubData.phone.trim() || undefined,
        hubCenterName: newHubData.hubCenterName.trim() || undefined,
        city: newHubData.city,
        address: newHubData.address
      });
      triggerNotice('Tạo tài khoản Trạm Kiểm Định Hub thành công!');
      setShowAddHubModal(false);
      setNewHubData({
        hubCenterName: '',
        email: '',
        password: '',
        phone: '',
        city: 'TP. Hồ Chí Minh',
        address: '',
      });
    } catch (err: any) {
      dialogService.error(err.message || 'Tạo tài khoản Trạm Hub thất bại', 'Lỗi Tạo Trạm Hub');
    }
  };

  // Financial & Operational Metrics
  const totalGmv = useMemo(() => {
    return localOrders.reduce((sum, o) => sum + (o.itemPriceVnd || 0), 0);
  }, [localOrders]);

  const escrowHeld = useMemo(() => {
    return localOrders
      .filter((o) => o.escrowStatus !== 'COMPLETED_RELEASED' && o.escrowStatus !== 'REFUNDED_TO_BUYER')
      .reduce((sum, o) => sum + (o.totalPaidVnd || o.itemPriceVnd || 0), 0);
  }, [localOrders]);

  const platformEarnings = useMemo(() => {
    return Math.round(totalGmv * (commissionRate / 100));
  }, [totalGmv, commissionRate]);

  const completedOrdersCount = useMemo(() => {
    return localOrders.filter((o) => o.escrowStatus === 'COMPLETED_RELEASED').length;
  }, [localOrders]);

  // Listing moderation actions
  const handleToggleListingStatus = async (id: string) => {
    try {
      await adminPostService.approvePost(id).catch(() => {});
    } catch (err) {
      console.warn('Admin approve post API info:', err);
    }
    setLocalListings((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = item.status === 'active' ? 'draft' : 'active';
          triggerNotice(`Đã chuyển trạng thái tin đăng #${id} sang ${newStatus === 'active' ? 'Hiển thị (Đã duyệt)' : 'Tạm ẩn'}.`);
          return { ...item, status: newStatus as any };
        }
        return item;
      })
    );
  };

  const handleDeleteListing = async (id: string) => {
    try {
      await adminPostService.rejectPost(id, 'Vi phạm quy định đăng bài').catch(() => {});
    } catch (err) {
      console.warn('Admin reject post API info:', err);
    }
    setLocalListings((prev) => prev.filter((item) => item.id !== id));
    triggerNotice(`Đã gỡ bỏ / từ chối tin đăng #${id} khỏi sàn giao dịch.`);
  };

  // Order escrow manual release
  const handleForceReleaseEscrow = (orderId: string) => {
    setLocalOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          triggerNotice(`Đã can thiệp giải phóng Escrow thành công cho đơn #${orderId}. Tiền đã chuyển cho người bán.`);
          return { ...ord, escrowStatus: 'COMPLETED_RELEASED' as EscrowStatus };
        }
        return ord;
      })
    );
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return localOrders.filter((ord) => {
      const matchSearch =
        ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.listing.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = orderStatusFilter === 'ALL' || ord.escrowStatus === orderStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [localOrders, searchQuery, orderStatusFilter]);

  // Danh sách các bài đăng đã thành công / đang hiển thị trên sàn (loại trừ hoàn toàn bản nháp DRAFT của người bán)
  const activeListings = useMemo(() => {
    return localListings.filter((item) => {
      const isDraft = item.status === 'draft' || (item as any).backendStatus === 'DRAFT';
      const isSuccessful = item.status === 'active' || (item as any).backendStatus === 'ACTIVE';
      return isSuccessful && !isDraft;
    });
  }, [localListings]);

  // Filtered Listings cho tab Quản Lý Bài Đăng (chỉ hiển thị bài đăng hợp lệ/thành công, tuyệt đối không lấy bản nháp DRAFT)
  const filteredListings = useMemo(() => {
    return localListings.filter((item) => {
      const isDraft = item.status === 'draft' || (item as any).backendStatus === 'DRAFT';
      if (isDraft) return false;
      const title = item?.title || '';
      const sellerName = item?.sellerName || '';
      const itemId = item?.id || '';
      const matchSearch =
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = listingCategoryFilter === 'ALL' || item.category === listingCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [localListings, searchQuery, listingCategoryFilter]);

  // Hub Center Performance
  const hubCenters = [
    {
      id: 'HUB-HAN-01',
      name: 'SecondLife Hub Cầu Giấy (Hà Nội)',
      location: '180 Cầu Giấy, Quận Cầu Giấy, Hà Nội',
      technicians: 14,
      dailyCapacity: 45,
      currentInTesting: 18,
      passRate: 93.4,
      nfcIssued: 1420,
      leadTechnician: 'Nguyễn Văn Hải (Level 4 Master Tech)'
    },
    {
      id: 'HUB-DAD-01',
      name: 'SecondLife Hub Hải Châu (Đà Nẵng)',
      location: '92 Phan Châu Trinh, Quận Hải Châu, Đà Nẵng',
      technicians: 8,
      dailyCapacity: 28,
      currentInTesting: 9,
      passRate: 95.1,
      nfcIssued: 840,
      leadTechnician: 'Lê Hoàng Khang (Level 3 Senior Tech)'
    },
    {
      id: 'HUB-SGN-01',
      name: 'SecondLife Hub Quận 10 (TP. Hồ Chí Minh)',
      location: '268 Lý Thường Kiệt, Quận 10, TP.HCM',
      technicians: 18,
      dailyCapacity: 65,
      currentInTesting: 24,
      passRate: 91.8,
      nfcIssued: 2190,
      leadTechnician: 'Trần Minh Tuấn (Level 4 Master Tech)'
    }
  ];

  // Helper for Status Badge
  const getEscrowStatusBadge = (status: EscrowStatus) => {
    switch (status) {
      case 'AWAITING_PAYMENT':
        return {
          label: lang === 'vi' ? 'Chờ Thanh Toán' : 'Awaiting Payment',
          bg: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      case 'HELD_IN_ESCROW':
        return {
          label: lang === 'vi' ? 'Đang Giữ Ký Quỹ' : 'Held in Escrow',
          bg: 'bg-sky-50 text-sky-700 border-sky-200'
        };
      case 'INSPECTION_IN_PROGRESS':
        return {
          label: lang === 'vi' ? 'Đang Test Tại Hub' : 'Hub Testing',
          bg: 'bg-purple-50 text-purple-700 border-purple-200'
        };
      case 'INSPECTION_PASSED':
        return {
          label: lang === 'vi' ? 'Hub Đạt & Dán NFC' : 'Passed & NFC Sealed',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'SHIPPED_TO_BUYER':
        return {
          label: lang === 'vi' ? 'Đang Giao Bưu Tá' : 'Courier Delivering',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'COMPLETED_RELEASED':
        return {
          label: lang === 'vi' ? 'Đã Giải Ngân Xong' : 'Disbursed / Completed',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
        };
      case 'DISPUTED':
        return {
          label: lang === 'vi' ? 'Đang Tranh Chấp' : 'Disputed',
          bg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse'
        };
      case 'REFUNDED_TO_BUYER':
        return {
          label: lang === 'vi' ? 'Đã Hoàn Tiền' : 'Refunded',
          bg: 'bg-gray-100 text-gray-700 border-gray-300'
        };
      default:
        return { label: status, bg: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  // Navigation Items matching the screenshot
  const navItems = [
    {
      id: 'overview' as AdminTab,
      label: 'DASHBOARD',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'listings' as AdminTab,
      label: lang === 'vi' ? 'QUẢN LÝ BÀI ĐĂNG' : 'POSTS MANAGEMENT',
      icon: Tag,
      badge: localListings.length
    },
    {
      id: 'catalog-ai' as AdminTab,
      label: lang === 'vi' ? 'DANH MỤC SẢN PHẨM & AI' : 'PRODUCT CATALOG & AI',
      icon: Layers,
      badge: null
    },
    {
      id: 'orders' as AdminTab,
      label: lang === 'vi' ? 'QUẢN LÝ ĐƠN HÀNG' : 'SALES ORDERS',
      icon: Package,
      badge: localOrders.length || null,
      badgeColor: 'bg-[#fce5da]'
    },
    {
      id: 'withdrawals' as AdminTab,
      label: lang === 'vi' ? 'DUYỆT RÚT TIỀN VÍ' : 'WALLET WITHDRAWALS',
      icon: Wallet,
      badge: null
    },
    {
      id: 'seller-kyc' as AdminTab,
      label: lang === 'vi' ? 'DUYỆT eKYC NGƯỜI BÁN' : 'SELLER KYC REVIEW',
      icon: ShieldCheck,
      badge: backendVerifications.filter(v => v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING').length || null,
      badgeColor: 'bg-rose-600'
    },
    {
      id: 'customers' as AdminTab,
      label: lang === 'vi' ? 'QUẢN LÝ KHÁCH HÀNG' : 'CUSTOMERS',
      icon: Users,
      badge: backendUsers.length || null
    },
    {
      id: 'hubs' as AdminTab,
      label: lang === 'vi' ? 'TRẠM KIỂM ĐỊNH HUB' : 'HUB CENTERS',
      icon: Building2,
      badge: null
    },
    {
      id: 'permissions' as AdminTab,
      label: lang === 'vi' ? 'PHÂN QUYỀN HỆ THỐNG' : 'ROLES & PERMISSIONS',
      icon: ShieldCheck,
      badge: null
    },
    {
      id: 'credit-pricing' as AdminTab,
      label: lang === 'vi' ? 'BẢNG GIÁ & CHIẾT KHẤU' : 'CREDIT & PRICING',
      icon: Tag,
      badge: null
    },
    {
      id: 'system-wallet' as AdminTab,
      label: lang === 'vi' ? 'VÍ HỆ THỐNG & ĐỐI SOÁT' : 'SYSTEM WALLET',
      icon: Wallet,
      badge: null
    },
    {
      id: 'commission-rules' as AdminTab,
      label: lang === 'vi' ? 'QUY TẮC HOA HỒNG SÀN' : 'COMMISSION RULES',
      icon: Percent,
      badge: null
    },
    {
      id: 'inspection-governance' as AdminTab,
      label: lang === 'vi' ? 'BIỂU PHÍ KIỂM ĐỊNH' : 'INSPECTION GOVERNANCE',
      icon: ShieldCheck,
      badge: null
    }
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#24263e] flex flex-col font-sans">
      {/* 1. TOP NAVIGATION BAR */}
      {/* 1. TOP NAVIGATION BAR */}
      <header className="bg-[#24263e] text-white h-13 sm:h-14 flex items-center justify-between px-3 sm:px-4 border-b border-white/10 shrink-0 sticky top-0 z-40 shadow-sm">
        {/* Left: Brand + Toggle + Xem website */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo Brand */}
          <div
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 font-black tracking-tight text-white cursor-pointer select-none pr-3 sm:pr-4 border-r border-white/15"
          >
            <div className="logo-badge bg-white p-1 rounded-lg shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img
                src={logoImg}
                alt="SecondLife Logo"
                className="h-7 sm:h-8 w-auto object-contain"
              />
            </div>
            <span className="font-black text-sm sm:text-base tracking-wider uppercase text-white hidden xs:inline">
              WEB ADMIN
            </span>
          </div>

          {/* Toggle Sidebar Button */}
          <button
            onClick={() => {
              setIsSidebarCollapsed(!isSidebarCollapsed);
              setIsMobileSidebarOpen(!isMobileSidebarOpen);
            }}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition cursor-pointer"
            title={lang === 'vi' ? 'Đóng / Mở menu' : 'Toggle menu'}
          >
            <Menu className="w-5 h-5" />
          </button>

        </div>

        {/* Right: Admin Profile */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
            title={lang === 'vi' ? 'Hồ sơ quản trị viên' : 'Admin Profile'}
          >
            <div className="w-7 h-7 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs border border-white/20">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt="Admin"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#c34c36] text-white flex items-center justify-center font-black text-[11px]">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
            </div>
            <span className="text-xs font-black text-white hidden sm:inline">{currentUser?.name || 'Admin'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-white hidden sm:inline" />
          </button>

          {/* User Dropdown */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white text-[#24263e] rounded-2xl shadow-2xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in">
              <div className="px-3.5 py-2.5 border-b border-gray-100">
                <p className="font-black text-[#24263e] text-xs truncate">
                  {currentUser?.name || (lang === 'vi' ? 'Quản Trị Viên Hệ Thống' : 'System Administrator')}
                </p>
                <p className="text-[11px] text-gray-500 font-medium truncate">{currentUser?.email || 'admin@secondlife.vn'}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#c34c36]/10 text-[#c34c36] font-extrabold text-[10px]">
                  {lang === 'vi' ? 'Quyền: Toàn Quyền Admin' : 'Role: Super Admin'}
                </span>
              </div>
              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onOpenProfile?.();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center gap-2 text-[#24263e] font-bold cursor-pointer transition"
                >
                  <User className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>{lang === 'vi' ? 'Hồ Sơ Cá Nhân' : 'Admin Profile'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onLogout?.();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-xl text-rose-600 flex items-center gap-2 cursor-pointer font-bold transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Đăng Xuất' : 'Log Out'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 2. BODY CONTAINER: SIDEBAR + MAIN WORKSPACE */}
      <div className="flex-1 flex relative">
        {/* LEFT SIDEBAR */}
        <aside
          className={`bg-[#fce5da] text-[#24263e] border-r border-[#24263e]/15 transition-all duration-300 flex flex-col shrink-0 select-none z-30 sticky top-13 sm:top-14 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] ${isSidebarCollapsed ? 'w-16' : 'w-60 sm:w-64'
            } ${isMobileSidebarOpen
              ? 'fixed inset-y-13 left-0 shadow-2xl block'
              : 'hidden md:flex'
            }`}
        >
          {/* User Block */}
          <div
            onClick={() => onOpenProfile?.()}
            className="p-3.5 sm:p-4 border-b border-[#24263e]/15 flex items-center gap-3 cursor-pointer hover:bg-black/5 transition"
            title={lang === 'vi' ? 'Xem hồ sơ cá nhân' : 'View profile'}
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 border border-[#24263e]/20 overflow-hidden flex items-center justify-center">
                {currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt="Admin"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#c34c36] text-white flex items-center justify-center font-black text-sm">
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
                  </div>
                )}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#fce5da] absolute bottom-0 right-0"></span>
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <h4 className="font-black text-xs sm:text-sm text-[#24263e] truncate">
                  {currentUser?.name || 'Admin'}
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  <span>Online</span>
                </div>
              </div>
            )}
          </div>

          {/* Section: MAIN NAVIGATION */}
          <div className="px-4 pt-4 pb-2 text-[10px] font-black text-[#24263e]/80 uppercase tracking-wider">
            {!isSidebarCollapsed ? 'MAIN NAVIGATION' : '•••'}
          </div>

          {/* Nav List */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-1 pb-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition cursor-pointer group ${isActive
                      ? 'bg-white text-[#24263e] shadow-sm font-black'
                      : 'text-[#24263e]/80 hover:text-[#24263e] hover:bg-white/40 font-bold'
                    }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${isActive ? 'text-[#24263e]' : 'text-[#24263e]/75 group-hover:text-[#24263e]'
                        }`}
                    />
                    {!isSidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge !== null && item.badge !== undefined && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${item.badgeColor || 'bg-slate-700 text-slate-200'
                            }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${isActive ? 'text-[#24263e] translate-x-0.5' : 'text-[#24263e]/50 group-hover:text-[#24263e]'
                          }`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer info */}
          {!isSidebarCollapsed && (
            <div className="p-3 border-t border-[#24263e]/10 text-[10px] text-[#24263e]/70 text-center">
              <span className="font-semibold text-[#24263e]">SecondLife Platform</span> v2.4
            </div>
          )}
        </aside>

        {/* Backdrop for mobile sidebar */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
          ></div>
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0">
          {/* Page Title & Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'overview'
                  ? 'Dashboard'
                  : navItems.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>

            {/* Breadcrumbs */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <button
                  onClick={() => setActiveTab('overview')}
                  className="hover:text-[#24263e] transition cursor-pointer"
                >
                  Home
                </button>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-800 capitalize">
                  {activeTab === 'overview' ? 'Dashboard' : activeTab}
                </span>
              </div>
            </div>
          </div>

          {/* Notification Alert Banner */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-md flex items-center gap-3 animate-in fade-in font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs">{actionNotice}</span>
              <button
                onClick={() => setActionNotice(null)}
                className="ml-auto text-emerald-600 hover:text-emerald-800 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-5 animate-fadeIn">
              {/* ROW 1: 4 KPI STAT BOXES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Box 1: BÀI ĐĂNG THÀNH CÔNG */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
                      {activeListings.length}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      BÀI ĐĂNG THÀNH CÔNG
                    </div>
                  </div>
                  <Tag className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Quản lý bài đăng ({activeListings.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 2: NGƯỜI DÙNG HỆ THỐNG */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
                      {backendUsers.length || 0}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      NGƯỜI DÙNG TOÀN SÀN
                    </div>
                  </div>
                  <Users className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  <button
                    onClick={() => setActiveTab('customers')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem danh sách tài khoản</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 3: HỒ SƠ eKYC CHỜ DUYỆT */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#c34c36] font-mono">
                      {backendVerifications.filter(v => v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING').length}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      eKYC NGƯỜI BÁN CHỜ DUYỆT
                    </div>
                  </div>
                  <ShieldCheck className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  <button
                    onClick={() => setActiveTab('seller-kyc')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Thẩm định hồ sơ</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 4: LỆNH RÚT TIỀN VÍ */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-2xl sm:text-3xl font-black tracking-tight text-[#24263e]">
                      RÚT TIỀN
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      GIẢI NGÂN NGÂN HÀNG
                    </div>
                  </div>
                  <Wallet className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  <button
                    onClick={() => setActiveTab('withdrawals')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Duyệt yêu cầu rút tiền</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ROW 2: BÀI ĐĂNG THÀNH CÔNG GẦN ĐÂY TRÊN SÀN (CHỈ LẤY BÀI ĐĂNG THÀNH CÔNG, LOẠI BỎ BẢN NHÁP DRAFT) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#c34c36]" />
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                      DANH SÁCH BÀI ĐĂNG THÀNH CÔNG GẦN ĐÂY TRÊN SÀN
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {activeListings.length} tin hoạt động
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-4 w-12">#</th>
                        <th className="py-2.5 px-4">Sản Phẩm / Tin Đăng</th>
                        <th className="py-2.5 px-4">Giá Bán</th>
                        <th className="py-2.5 px-4">Người Bán</th>
                        <th className="py-2.5 px-4">Trạng Thái</th>
                        <th className="py-2.5 px-4 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeListings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Hiện chưa có bài đăng nào được duyệt thành công trên sàn.
                          </td>
                        </tr>
                      ) : (
                        activeListings.slice(0, 5).map((listing, idx) => (
                          <tr key={listing.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-medium text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {listing.photoGallery?.[0] || listing.photos?.front || (listing as any).imageUrl ? (
                                  <img
                                    src={listing.photoGallery?.[0] || listing.photos?.front || (listing as any).imageUrl}
                                    alt={listing.title}
                                    className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                    <Tag className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                                    {listing.title}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span>ID: #{listing.id.substring(0, 8)}</span>
                                    {listing.brand && <span>• {listing.brand}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#c34c36] whitespace-nowrap">
                              {formatVND(listing.priceVnd || (listing as any).price || 0)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{listing.sellerName || 'Người bán'}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{listing.sellerAddress || ''}</div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Đang hiển thị
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleToggleListingStatus(listing.id)}
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#24263e] hover:text-white text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Ẩn tin
                                </button>
                                {onOpenListingDetail && (
                                  <button
                                    onClick={() => onOpenListingDetail(listing)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                    title="Xem chi tiết tin đăng"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-[#c34c36] hover:text-[#c34c36] text-xs font-semibold text-slate-700 transition cursor-pointer flex items-center gap-1"
                  >
                    <span>Quản lý tất cả {activeListings.length} bài đăng thành công</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ROW 3: TWO 50% WIDTH CARDS (eKYC REVIEW & SYSTEM FINANCIAL OVERVIEW) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Card: HỒ SƠ eKYC NGƯỜI BÁN CẦN XÉT DUYỆT */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-rose-500 overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-rose-600" />
                        <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                          HỒ SƠ eKYC NGƯỜI BÁN MỚI NHẤT
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        {backendVerifications.filter(v => v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING').length} chờ duyệt
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                            <th className="py-2.5 px-4">Người Dùng</th>
                            <th className="py-2.5 px-4">Giấy Tờ</th>
                            <th className="py-2.5 px-4">Trạng Thái</th>
                            <th className="py-2.5 px-4 text-center">Xử Lý</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {backendVerifications.slice(0, 4).map((v) => (
                            <tr key={v.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 font-medium text-slate-800">
                                <div className="font-bold text-slate-900">{v.userFullName || 'Người bán'}</div>
                                <div className="text-[10px] text-slate-400">{v.userEmail || ''}</div>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                <div>{v.verificationType || 'CCCD'}</div>
                                <div className="text-[10px] text-slate-400">{v.documentNumberMasked || '••••••••'}</div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                    v.status === 'APPROVED'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : v.status === 'REJECTED'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {v.status === 'APPROVED' ? 'Đã duyệt' : v.status === 'REJECTED' ? 'Từ chối' : 'Cần thẩm định'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => setActiveTab('seller-kyc')}
                                  className="px-2.5 py-1 rounded bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Xem
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setActiveTab('seller-kyc')}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-rose-400 hover:text-rose-600 text-xs font-semibold text-slate-700 transition cursor-pointer"
                    >
                      Mở trang Thẩm định eKYC
                    </button>
                  </div>
                </div>

                {/* Right Card: TỔNG QUAN TÀI CHÍNH & VÍ HỆ THỐNG */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-emerald-500 overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                          TỔNG QUAN TÀI CHÍNH & VÍ HỆ THỐNG
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        VND
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">Ký quỹ đang tạm giữ (Escrow)</span>
                          <span className="text-base sm:text-lg font-black text-slate-900 font-mono mt-0.5 block">
                            {formatVND(escrowHeld)}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">Doanh thu sàn tạm tính</span>
                          <span className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-0.5 block">
                            {formatVND(platformEarnings)}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[#faf8f5] border border-slate-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Tổng giá trị đơn hàng (GMV)</span>
                          <span className="text-sm font-black text-[#24263e] font-mono">
                            {formatVND(totalGmv)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 block">Đơn hoàn thành</span>
                          <span className="text-sm font-bold text-slate-800 font-mono">
                            {completedOrdersCount} đơn
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 italic">
                        * Quản lý chi tiết từng bút toán giao dịch, tiền ship và hoa hồng chiết khấu trong mục Ví hệ thống và Quy tắc hoa hồng sàn.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setActiveTab('commission-rules')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer"
                    >
                      Biểu phí hoa hồng
                    </button>
                    <button
                      onClick={() => setActiveTab('system-wallet')}
                      className="px-3.5 py-1.5 rounded-lg bg-[#24263e] hover:bg-[#c34c36] text-white text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <span>Xem Ví Hệ Thống</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* ======================================================== */}
          {/* TAB: CATALOG & AI */}
          {/* ======================================================== */}
          {activeTab === 'catalog-ai' && (
            <div className="max-w-7xl mx-auto animate-fadeIn">
              <CatalogAiTab lang={lang} />
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: ORDERS (QUẢN LÝ BÁN HÀNG & KÝ QUỸ ESCROW)           */}
          {/* ======================================================== */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] p-5 space-y-4">
              {/* Unlinked Backend Notice */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs font-bold text-rose-800">
                <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 text-[11px]">❌</span>
                <span>[GIAO DIỆN MOCK / CHƯA LIÊN KẾT BACKEND API] Mục quản lý đơn hàng bán lẻ này hiện đang sử dụng dữ liệu tĩnh cục bộ, Backend chưa cung cấp endpoint quản trị đơn hàng.</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Danh Sách Đơn Hàng Giao Dịch Qua Quỹ Escrow ({filteredOrders.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Toàn bộ đơn hàng được phong tỏa tài chính cho đến khi Kỹ sư Hub nghiệm thu và khách kiểm hàng
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm mã đơn, tên khách..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#c34c36]"
                    />
                  </div>

                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none bg-white cursor-pointer"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="HELD_IN_ESCROW">Đang giữ ký quỹ</option>
                    <option value="INSPECTION_IN_PROGRESS">Đang kiểm định Hub</option>
                    <option value="SHIPPED_TO_BUYER">Đang giao bưu tá</option>
                    <option value="COMPLETED_RELEASED">Đã giải ngân</option>
                    <option value="DISPUTED">Đang tranh chấp</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-bold">Mã Đơn</th>
                      <th className="pb-3 font-bold">Sản Phẩm</th>
                      <th className="pb-3 font-bold">Người Mua</th>
                      <th className="pb-3 font-bold">Người Bán</th>
                      <th className="pb-3 font-bold text-right">Giá Trị Đơn</th>
                      <th className="pb-3 font-bold">Trạng Thái Escrow</th>
                      <th className="pb-3 font-bold text-center">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((ord) => {
                      const badge = getEscrowStatusBadge(ord.escrowStatus);
                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 font-mono font-bold text-slate-900">
                            #{ord.id}
                          </td>
                          <td className="py-3">
                            <div className="font-bold text-slate-900 max-w-[200px] truncate">
                              {ord.listing.title}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Mã máy: {ord.listing.modelCode || 'STD-APP'}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-slate-800">{ord.buyerName}</div>
                            <span className="text-[10px] text-slate-400">{ord.buyerPhone}</span>
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-slate-800">{ord.sellerName}</div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="font-bold text-slate-900">
                              {formatVND(ord.totalPaidVnd || ord.itemPriceVnd)}
                            </div>
                            <span className="text-[10px] text-slate-400">Phí sàn: 2.5%</span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            {ord.escrowStatus !== 'COMPLETED_RELEASED' &&
                              ord.escrowStatus !== 'REFUNDED_TO_BUYER' ? (
                              <button
                                onClick={() => handleForceReleaseEscrow(ord.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition cursor-pointer shadow-xs"
                                title="Can thiệp giải ngân ngay cho người bán"
                              >
                                Giải Ngân Escrow
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Đã xong</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: LISTINGS (QUẢN TRỊ DANH MỤC & SẢN PHẨM)             */}
          {/* ======================================================== */}
          {activeTab === 'listings' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#fce5da] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Danh Sách Sản Phẩm & Tin Đăng Bán Trên Sàn ({filteredListings.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kiểm duyệt tính trung thực, đối chiếu gợi ý AI và quản lý trạng thái hiển thị
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm tên sản phẩm, thương hiệu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#c34c36]"
                    />
                  </div>

                  <select
                    value={listingCategoryFilter}
                    onChange={(e) => setListingCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none bg-white cursor-pointer"
                  >
                    <option value="ALL">Tất cả ngành hàng</option>
                    <option value="Tủ Lạnh">Tủ Lạnh</option>
                    <option value="Máy Giặt">Máy Giặt</option>
                    <option value="Máy Pha Cà Phê">Máy Pha Cà Phê</option>
                    <option value="Robot Hút Bụi">Robot Hút Bụi</option>
                  </select>

                  <button
                    type="button"
                    onClick={loadAdminPosts}
                    disabled={isLoadingPosts}
                    title="Tải danh sách bài đăng thực tế từ database Backend Spring Boot"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPosts ? 'animate-spin' : ''}`} />
                    <span>Làm mới từ Backend</span>
                  </button>
                </div>
              </div>

              {/* Listings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-bold">Ảnh & Sản Phẩm</th>
                      <th className="pb-3 font-bold">Danh Mục</th>
                      <th className="pb-3 font-bold">Người Bán</th>
                      <th className="pb-3 font-bold text-right">Giá Niêm Yết</th>

                      <th className="pb-3 font-bold text-center">Trạng Thái</th>
                      <th className="pb-3 font-bold text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredListings.map((item) => {
                      const isVisible = item.status === 'active' || item.status === 'pending';
                      const isDraft = item.status === 'draft';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  item.photoGallery?.[0] ||
                                  'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=150&q=80'
                                }
                                alt={item.title || 'Product'}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                              />
                              <div>
                                <div className="font-bold text-slate-900 max-w-[180px] truncate">{item.title}</div>
                                <span className="text-[10px] text-slate-500 font-mono">ID: #{item.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-slate-800">{item.category}</div>
                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              Grade {item.conditionGrade || 'A'}
                            </span>
                          </td>
                          <td className="py-3 font-medium text-slate-800">{item.sellerName}</td>
                          <td className="py-3 text-right font-bold text-slate-900">
                            {formatVND(item.priceVnd)}
                          </td>

                          <td className="py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${isVisible
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isDraft 
                                    ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                              {isVisible ? 'Đang Hiển Thị' : isDraft ? 'Bản Nháp' : 'Tạm Ẩn'}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => onOpenListingDetail?.(item as any)}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition cursor-pointer shadow-xs flex items-center gap-1.5"
                                title="Xem chi tiết bài đăng"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{lang === 'vi' ? 'Chi tiết' : 'View'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: SELLER-KYC (DUYỆT HỒ SƠ ĐỊNH DANH NGƯỜI BÁN)        */}
          {/* ======================================================== */}
          {activeTab === 'seller-kyc' && (() => {
            const needsReviewCount = backendVerifications.filter(v => v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING').length;
            const providerErrorCount = backendVerifications.filter(v => v.status === 'EKYC_PENDING' && v.ekycStatus === 'PROVIDER_ERROR').length;
            const approvedCount = backendVerifications.filter(v => v.status === 'APPROVED').length;
            const resubmitCount = backendVerifications.filter(v => v.status === 'RESUBMIT_REQUIRED').length;
            const rejectedCount = backendVerifications.filter(v => v.status === 'REJECTED').length;
            const ekycPendingCount = backendVerifications.filter(v => v.status === 'EKYC_PENDING').length;

            const filteredList = backendVerifications.filter((v) => {
              if (verificationFilterTab !== 'ALL') {
                if (verificationFilterTab === 'NEEDS_REVIEW') {
                  if (v.status !== 'NEEDS_REVIEW' && v.status !== 'SUBMITTED' && v.status !== 'PENDING') return false;
                } else if (verificationFilterTab === 'PROVIDER_ERROR') {
                  if (v.status !== 'EKYC_PENDING' || v.ekycStatus !== 'PROVIDER_ERROR') return false;
                } else if (v.status !== verificationFilterTab) {
                  return false;
                }
              }
              if (verificationSearchTerm.trim()) {
                const q = verificationSearchTerm.toLowerCase();
                const name = (v.userFullName || '').toLowerCase();
                const shop = (v.shopName || '').toLowerCase();
                const email = (v.userEmail || '').toLowerCase();
                const docNum = (v.documentNumber || v.documentNumberMasked || '').toLowerCase();
                const phone = (v.phone || '').toLowerCase();
                const id = (v.id || '').toLowerCase();
                return name.includes(q) || shop.includes(q) || email.includes(q) || docNum.includes(q) || phone.includes(q) || id.includes(q);
              }
              return true;
            });

            return (
              <div className="space-y-4">
                {/* 1. Header Banner */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-sm shadow-rose-200 shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                          Thẩm Định & Duyệt Hồ Sơ eKYC Người Bán
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          VNPT eKYC Engine
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Đối soát CCCD, sinh trắc học khuôn mặt và phê duyệt quyền kinh doanh gian hàng
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefreshSellerVerifications}
                    disabled={isLoadingVerifications}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-2xs self-start sm:self-auto shrink-0 bg-white"
                    title="Làm mới danh sách hồ sơ"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVerifications ? 'animate-spin text-rose-600' : 'text-slate-500'}`} />
                    <span>{isLoadingVerifications ? 'Đang đồng bộ...' : 'Làm Mới Dữ Liệu'}</span>
                  </button>
                </div>

                {/* 2. Interactive KPI Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Card: Tất cả */}
                  <button
                    type="button"
                    onClick={() => setVerificationFilterTab('ALL')}
                    className={`p-3.5 rounded-2xl text-left transition-all border cursor-pointer ${
                      verificationFilterTab === 'ALL'
                        ? 'bg-[#24263e] text-white border-[#24263e] shadow-md ring-2 ring-[#24263e]/15'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${verificationFilterTab === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
                        Tổng Hồ Sơ
                      </span>
                      <Layers className={`w-3.5 h-3.5 ${verificationFilterTab === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-2xl font-black font-mono">
                      {backendVerifications.length}
                    </div>
                    <span className={`text-[10px] font-medium block mt-0.5 ${verificationFilterTab === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
                      Toàn bộ hồ sơ nộp
                    </span>
                  </button>

                  {/* Card: Cần Duyệt */}
                  <button
                    type="button"
                    onClick={() => setVerificationFilterTab('NEEDS_REVIEW')}
                    className={`p-3.5 rounded-2xl text-left transition-all border cursor-pointer ${
                      verificationFilterTab === 'NEEDS_REVIEW'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-amber-50/50 hover:bg-amber-50 text-amber-900 border-amber-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${verificationFilterTab === 'NEEDS_REVIEW' ? 'text-white/90' : 'text-amber-800'}`}>
                        Cần Duyệt
                      </span>
                      <Clock className={`w-3.5 h-3.5 ${verificationFilterTab === 'NEEDS_REVIEW' ? 'text-white' : 'text-amber-600'}`} />
                    </div>
                    <div className="text-2xl font-black font-mono">
                      {needsReviewCount}
                    </div>
                    <span className={`text-[10px] font-medium block mt-0.5 ${verificationFilterTab === 'NEEDS_REVIEW' ? 'text-white/90' : 'text-amber-700'}`}>
                      {needsReviewCount > 0 ? '● Chờ thẩm định' : 'Đã thẩm định xong'}
                    </span>
                  </button>

                  {/* Card: Lỗi Provider VNPT */}
                  <button
                    type="button"
                    onClick={() => setVerificationFilterTab('PROVIDER_ERROR')}
                    className={`p-3.5 rounded-2xl text-left transition-all border cursor-pointer ${
                      verificationFilterTab === 'PROVIDER_ERROR'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/20'
                        : 'bg-rose-50/50 hover:bg-rose-50 text-rose-900 border-rose-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${verificationFilterTab === 'PROVIDER_ERROR' ? 'text-white/90' : 'text-rose-800'}`}>
                        Lỗi Provider VNPT
                      </span>
                      <AlertTriangle className={`w-3.5 h-3.5 ${verificationFilterTab === 'PROVIDER_ERROR' ? 'text-white' : 'text-rose-600'}`} />
                    </div>
                    <div className="text-2xl font-black font-mono">
                      {providerErrorCount}
                    </div>
                    <span className={`text-[10px] font-medium block mt-0.5 ${verificationFilterTab === 'PROVIDER_ERROR' ? 'text-white/90' : 'text-rose-700'}`}>
                      {providerErrorCount > 0 ? '⚠️ Cần bấm thử lại' : 'Kết nối ổn định'}
                    </span>
                  </button>

                  {/* Card: Yêu Cầu Nộp Lại */}
                  <button
                    type="button"
                    onClick={() => setVerificationFilterTab('RESUBMIT_REQUIRED')}
                    className={`p-3.5 rounded-2xl text-left transition-all border cursor-pointer ${
                      verificationFilterTab === 'RESUBMIT_REQUIRED'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-md ring-2 ring-orange-500/20'
                        : 'bg-orange-50/50 hover:bg-orange-50 text-orange-900 border-orange-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${verificationFilterTab === 'RESUBMIT_REQUIRED' ? 'text-white/90' : 'text-orange-800'}`}>
                        Chờ Nộp Lại
                      </span>
                      <RefreshCw className={`w-3.5 h-3.5 ${verificationFilterTab === 'RESUBMIT_REQUIRED' ? 'text-white' : 'text-orange-600'}`} />
                    </div>
                    <div className="text-2xl font-black font-mono">
                      {resubmitCount}
                    </div>
                    <span className={`text-[10px] font-medium block mt-0.5 ${verificationFilterTab === 'RESUBMIT_REQUIRED' ? 'text-white/90' : 'text-orange-700'}`}>
                      Đang chờ seller cập nhật
                    </span>
                  </button>

                  {/* Card: Đã Phê Duyệt */}
                  <button
                    type="button"
                    onClick={() => setVerificationFilterTab('APPROVED')}
                    className={`p-3.5 rounded-2xl text-left transition-all border cursor-pointer col-span-2 sm:col-span-1 ${
                      verificationFilterTab === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                        : 'bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900 border-emerald-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${verificationFilterTab === 'APPROVED' ? 'text-white/90' : 'text-emerald-800'}`}>
                        Đã Phê Duyệt
                      </span>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${verificationFilterTab === 'APPROVED' ? 'text-white' : 'text-emerald-600'}`} />
                    </div>
                    <div className="text-2xl font-black font-mono">
                      {approvedCount}
                    </div>
                    <span className={`text-[10px] font-medium block mt-0.5 ${verificationFilterTab === 'APPROVED' ? 'text-white/90' : 'text-emerald-700'}`}>
                      Đã cấp quyền SELLER
                    </span>
                  </button>
                </div>

                {/* 3. Main Data Card with Toolbar & Table */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                  {/* Toolbar: Segmented Tab Bar & Search Input */}
                  <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/40">
                    {/* Segmented Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 shrink-0">
                      <button
                        type="button"
                        onClick={() => setVerificationFilterTab('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                          verificationFilterTab === 'ALL'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        Tất Cả ({backendVerifications.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setVerificationFilterTab('NEEDS_REVIEW')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          verificationFilterTab === 'NEEDS_REVIEW'
                            ? 'bg-white text-amber-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        <span>Cần Duyệt</span>
                        {needsReviewCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500 text-white">
                            {needsReviewCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setVerificationFilterTab('PROVIDER_ERROR')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          verificationFilterTab === 'PROVIDER_ERROR'
                            ? 'bg-white text-rose-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        <span>Lỗi Provider</span>
                        {providerErrorCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-600 text-white animate-pulse">
                            {providerErrorCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setVerificationFilterTab('EKYC_PENDING')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                          verificationFilterTab === 'EKYC_PENDING'
                            ? 'bg-white text-blue-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        Đang eKYC ({ekycPendingCount})
                      </button>

                      <button
                        type="button"
                        onClick={() => setVerificationFilterTab('RESUBMIT_REQUIRED')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                          verificationFilterTab === 'RESUBMIT_REQUIRED'
                            ? 'bg-white text-orange-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        Yêu Cầu Nộp Lại ({resubmitCount})
                      </button>

                      <button
                        type="button"
                        onClick={() => setVerificationFilterTab('APPROVED')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                          verificationFilterTab === 'APPROVED'
                            ? 'bg-white text-emerald-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        Đã Duyệt ({approvedCount})
                      </button>

                      <button
                        type="button"
                        onClick={() => setVerificationFilterTab('REJECTED')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                          verificationFilterTab === 'REJECTED'
                            ? 'bg-white text-rose-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        Đã Từ Chối ({rejectedCount})
                      </button>
                    </div>

                    {/* Search Bars: Text filter and Fast User ID lookup */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                      <div className="relative w-full lg:w-60 shrink-0">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={verificationSearchTerm}
                          onChange={(e) => setVerificationSearchTerm(e.target.value)}
                          placeholder="Tìm Shop, Tên, CCCD, SĐT..."
                          className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 bg-white transition shadow-2xs"
                        />
                        {verificationSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setVerificationSearchTerm('')}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Fast lookup by User ID (GET /staff/seller-verifications/user/{userId}) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="text"
                          value={userIdSearchInput}
                          onChange={(e) => setUserIdSearchInput(e.target.value)}
                          placeholder="User ID..."
                          className="w-32 sm:w-36 px-2.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-500 bg-white font-mono shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={handleLookupVerificationByUserId}
                          disabled={isSearchingByUserId || !userIdSearchInput.trim()}
                          className="px-3 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50 shrink-0"
                          title="Tra cứu hồ sơ eKYC theo User ID (GET /staff/seller-verifications/user/{userId})"
                        >
                          {isSearchingByUserId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                          <span>Tìm ID</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Table Data */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Gian Hàng & Người Bán</th>
                          <th className="py-3 px-4">Định Danh CCCD</th>
                          <th className="py-3 px-4">Chỉ Số eKYC (VNPT)</th>
                          <th className="py-3 px-4">Đánh Giá Rủi Ro</th>
                          <th className="py-3 px-4">Trạng Thái Hồ Sơ</th>
                          <th className="py-3 px-4 text-right">Thao Tác Quản Trị</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredList.length > 0 ? (
                          filteredList.map((v) => (
                            <tr key={v.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 text-[13px] flex items-center gap-1.5">
                                  <Store className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span>{v.shopName || v.userFullName || 'Gian Hàng SecondLife'}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>{v.userFullName || '—'}</span>
                                  {v.phone && <span>• {v.phone}</span>}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]" title={v.userEmail || ''}>
                                  {v.userEmail || v.userId}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <span className="font-mono font-bold text-slate-800 text-[12px] block">
                                  {v.documentNumber || v.documentNumberMasked || '—'}
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  <span>{v.verificationType || 'CITIZEN_ID'}</span>
                                  {v.resubmissionCount > 0 && (
                                    <span className="ml-1 text-orange-600 font-bold">
                                      (Lần {v.resubmissionCount + 1})
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <div className="space-y-0.5 text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 text-[10px]">Khớp mặt:</span>
                                    <span className="font-mono font-bold text-indigo-700">
                                      {formatScore(v.faceMatchScore)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 text-[10px]">Thực thể sống:</span>
                                    <span className="font-mono font-bold text-emerald-700">
                                      {formatScore(v.livenessScore)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 text-[10px]">Giấy tờ:</span>
                                    <span className="font-mono font-bold text-amber-700">
                                      {formatScore(v.documentScore)}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  v.riskStatus === 'CLEAR' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  v.riskStatus === 'BLOCK' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}>
                                  {v.riskStatus || 'NOT_EVALUATED'}
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Provider: <strong className="text-slate-600">{v.providerName || 'VNPT'}</strong>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex flex-col gap-1 items-start">
                                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    v.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                    v.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                    v.status === 'RESUBMIT_REQUIRED' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                                    v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse' :
                                    'bg-blue-100 text-blue-800 border border-blue-300'
                                  }`}>
                                    {v.status}
                                  </span>

                                  {v.ekycStatus === 'PROVIDER_ERROR' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      ⚠️ Lỗi Provider VNPT
                                    </span>
                                  )}

                                  {(v.reasonCodeDescription || v.rejectionReason) && (
                                    <span className="text-[10px] text-slate-500 line-clamp-1 max-w-[200px]" title={v.reasonCodeDescription || v.rejectionReason}>
                                      {v.reasonCodeDescription || v.rejectionReason}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenVerificationDetailModal(v)}
                                    className="px-3 py-1.5 rounded-xl bg-[#24263e] hover:bg-[#c34c36] text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                    title="Xem toàn bộ ảnh CCCD, điểm chi tiết & Thẩm định"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem & Thẩm Định</span>
                                  </button>
                                  {v.status === 'EKYC_PENDING' && v.ekycStatus === 'PROVIDER_ERROR' && (
                                    <button
                                      type="button"
                                      disabled={reviewingAction === 'RETRY'}
                                      onClick={() => handleRetrySellerVerification(v.id)}
                                      className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                                      title="Thử lại pipeline eKYC với đối tác VNPT"
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 ${reviewingAction === 'RETRY' ? 'animate-spin' : ''}`} />
                                      <span className="hidden sm:inline">Thử Lại</span>
                                    </button>
                                  )}
                                  {(v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING') && (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveSellerVerification(v.id, v.status)}
                                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer shadow-2xs"
                                      title="Phê duyệt nhanh hồ sơ này"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-14 text-center">
                              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3 shadow-inner">
                                <ShieldCheck className="w-7 h-7 text-slate-400" />
                              </div>
                              <h4 className="font-bold text-slate-800 text-sm">
                                Không tìm thấy hồ sơ xác thực nào
                              </h4>
                              <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                                {verificationSearchTerm
                                  ? `Không có kết quả nào phù hợp với từ khóa "${verificationSearchTerm}".`
                                  : verificationFilterTab !== 'ALL'
                                  ? `Hiện không có hồ sơ nào ở mục "${verificationFilterTab}".`
                                  : 'Chưa có hồ sơ người bán nào gửi yêu cầu xác thực eKYC.'}
                              </p>
                              {(verificationFilterTab !== 'ALL' || verificationSearchTerm) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVerificationFilterTab('ALL');
                                    setVerificationSearchTerm('');
                                  }}
                                  className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Đặt lại bộ lọc</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ======================================================== */}
          {/* TAB: CUSTOMERS (QUẢN LÝ KHÁCH HÀNG & NGƯỜI DÙNG)        */}
          {/* ======================================================== */}
          {activeTab === 'customers' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#fce5da] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Danh Sách Khách Hàng & Tài Khoản Hoạt Động ({backendUsers.length || 44} Thành Viên)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quản lý danh tính người mua, người bán đã xác thực căn cước & bảo chứng tài chính
                  </p>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Tìm tên, SĐT, email..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#fce5da]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                      <th className="py-2.5 px-4">Tên khách hàng</th>
                      <th className="py-2.5 px-4">Số điện thoại</th>
                      <th className="py-2.5 px-4">Email</th>
                      <th className="py-2.5 px-4">Vai trò</th>
                      <th className="py-2.5 px-4">Trạng thái Tài khoản</th>
                      <th className="py-2.5 px-4">Xác thực Email OTP</th>
                      <th className="py-2.5 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backendUsers.length > 0 ? (
                      backendUsers
                        .filter((u) =>
                          !userSearchTerm ||
                          u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                          (u.fullName && u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
                          (u.phone && u.phone.includes(userSearchTerm))
                        )
                        .map((user, i) => (
                          <tr key={user.id || i} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-bold text-slate-900">{user.fullName || 'Thành viên SecondLife'}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">{user.phone || '—'}</td>
                            <td className="py-3 px-4 text-slate-600">{user.email}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {user.roles && user.roles.length > 0 ? user.roles.join(', ') : 'BUYER'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                user.accountStatus === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {user.accountStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {user.emailVerified ? (
                                <span className="flex items-center gap-1 w-fit px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-sm">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Đã xác thực
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 w-fit px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-sm">
                                  <AlertTriangle className="w-3 h-3" />
                                  Chờ xác thực
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {user.roles?.includes('SELLER') && (
                                  <button
                                    onClick={() => handleOpenLiftRestrictionModal(user.id, user.fullName || user.email)}
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center gap-1 transition cursor-pointer"
                                    title="Gỡ bỏ hạn chế bán hàng (POST /admin/sellers/{id}/reputation/lift-restriction)"
                                  >
                                    <Unlock className="w-3 h-3 text-amber-600" />
                                    <span>Gỡ hạn chế</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenUserRolesModal(user.id, user.fullName || user.email)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1 transition cursor-pointer"
                                  title="Phân vai trò tài khoản"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Vai trò</span>
                                </button>
                                <button
                                  onClick={() => handleViewUserDetail(user.id)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition cursor-pointer"
                                  title="Xem chi tiết tài khoản"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Chi tiết</span>
                                </button>
                                <button
                                  onClick={() => handleToggleUserStatus(user.id, user.accountStatus)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                    user.accountStatus === 'ACTIVE'
                                      ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                  }`}
                                >
                                  {user.accountStatus === 'ACTIVE' ? 'Khóa' : 'Mở Khóa'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    ) : (
                      [
                        { name: 'Nguyễn Văn An', phone: '0912 345 678', email: 'an.nguyen@gmail.com', role: 'Người mua', status: 'ACTIVE', kyc: 'Đã xác thực OTP' },
                        { name: 'Cửa hàng Gia Dụng Đức', phone: '0988 765 432', email: 'kt05@gmail.com', role: 'Người bán', status: 'ACTIVE', kyc: 'Đã xác thực OTP' }
                      ].map((user, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">{user.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{user.phone}</td>
                          <td className="py-3 px-4 text-slate-600">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {user.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="flex items-center gap-1 w-fit px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-sm">
                              <CheckCircle2 className="w-3 h-3" />
                              Đã xác thực
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-[10px] text-slate-400 font-bold">—</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: HUBS (QUẢN LÝ TRẠM HUB KIỂM ĐỊNH)                   */}
          {/* ======================================================== */}
          {activeTab === 'hubs' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#c34c36]" />
                    <span>Danh Sách Trạm Kiểm Định Hub & Quản Lý Kỹ Thuật Viên</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tạo tài khoản Trạm Kiểm Định Hub mới và quản trị đối tác kiểm định trên hệ thống
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => setActiveTab('inspection-governance')}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Biểu Phí Kiểm Định</span>
                  </button>
                  <button
                    onClick={() => setShowAddHubModal(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white text-xs font-bold shadow-sm hover:opacity-95 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tạo Tài Khoản Hub Mới</span>
                  </button>
                </div>
              </div>

              {/* Hub Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hubCenters.map((hub) => (
                  <div
                    key={hub.id}
                    className="bg-white rounded-xl p-5 border border-slate-200 border-t-4 border-t-[#c34c36] shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="p-2 rounded-lg bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đang Hoạt Động
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">{hub.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{hub.location}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Kỹ sư kiểm định</span>
                        <span className="font-bold text-slate-900">{hub.technicians} nhân sự</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Công suất tối đa</span>
                        <span className="font-bold text-slate-900">{hub.dailyCapacity} máy/ngày</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Đang test</span>
                        <span className="font-bold text-[#24263e]">{hub.currentInTesting} máy</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Tỷ lệ Đạt (Pass)</span>
                        <span className="font-bold text-emerald-600">{hub.passRate}%</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
                      <span>Tem NFC đã dán:</span>
                      <strong className="text-slate-900 font-mono">{hub.nfcIssued} tem</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: WITHDRAWALS (DUYỆT YÊU CẦU RÚT TIỀN VÍ)             */}
          {/* ======================================================== */}
          {activeTab === 'withdrawals' && (
            <WithdrawalsTab lang={lang} onNotice={triggerNotice} />
          )}

          {/* ======================================================== */}
          {/* TAB: PERMISSIONS (PHÂN QUYỀN HỆ THỐNG - RBAC)            */}
          {/* ======================================================== */}
          {activeTab === 'permissions' && (
            <PermissionsTab
              triggerNotice={triggerNotice}
              onRolesUpdated={(updatedRoles) => setRolesList(updatedRoles)}
            />
          )}

          {/* ======================================================== */}
          {/* TAB: CREDIT PRICING & TIERS (QUẢN TRỊ ĐƠN GIÁ CREDIT)    */}
          {/* ======================================================== */}
          {activeTab === 'credit-pricing' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-emerald-600 p-5 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Quản Trị Bảng Giá Credit & Chính Sách Chiết Khấu Gói Nạp
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cấu hình đơn giá Credit cho đăng tin (LISTING), thẩm định (VALUATION) và các bậc ưu đãi số lượng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadCreditPricingData}
                  disabled={isLoadingPricing}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer self-start sm:self-auto"
                  title="Tải lại dữ liệu"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingPricing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {isLoadingPricing ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-xs">Đang tải bảng giá dịch vụ credit...</span>
                </div>
              ) : (
                <>
                  {/* Section 1: Base Credit Pricing */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      1. Đơn Giá Dịch Vụ Cơ Bản Theo Loại Credit
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {creditPrices.map((rule) => {
                        const isEditing = editingPriceType === rule.creditType;
                        return (
                          <div
                            key={rule.creditType}
                            className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded text-xs font-bold font-mono bg-emerald-100 text-emerald-800">
                                {rule.creditType}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {(rule as any).updatedAt ? `Cập nhật: ${new Date((rule as any).updatedAt).toLocaleDateString('vi-VN')}` : 'Hệ thống'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              {(rule as any).description || (
                                rule.creditType === 'LISTING'
                                  ? 'Phí nạp lượt đăng tin sản phẩm trên sàn'
                                  : rule.creditType === 'VALUATION'
                                    ? 'Phí lượt kiểm định và thẩm định chất lượng'
                                    : 'Phí lượt trò chuyện và tư vấn định giá cùng AI'
                              )}
                            </p>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-semibold">Đơn giá / 1 Credit:</span>
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editPriceValue}
                                    onChange={(e) => setEditPriceValue(Number(e.target.value))}
                                    className="w-32 px-2 py-1 rounded border border-emerald-400 text-sm font-bold font-mono outline-none"
                                  />
                                ) : (
                                  <span className="text-lg font-extrabold text-[#24263e]">
                                    {formatVND(rule.unitPrice || (rule as any).unitPriceVnd || 0)}
                                  </span>
                                )}
                              </div>

                              <div>
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCreditPrice(rule.creditType, editPriceValue)}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPriceType(null)}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPriceType(rule.creditType);
                                      setEditPriceValue(rule.unitPrice || (rule as any).unitPriceVnd || 0);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition cursor-pointer"
                                  >
                                    Đổi giá
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Gói Nạp & Chính Sách Chiết Khấu Ưu Đãi (Topup Packages from Backend) */}
                  <div className="space-y-4 pt-5 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          2. Danh Sách Gói Nạp & Chính Sách Chiết Khấu Ưu Đãi (Topup Packages)
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Các gói nạp định sẵn (Combo & Gói lẻ) đang mở bán cho người bán kèm tỷ lệ chiết khấu (%) thực tế từ Backend
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {topupPackages.length} gói nạp hệ thống
                        </span>
                      </div>
                    </div>

                    {/* Quick Metrics for Topup Packages */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Tổng Gói Nạp</div>
                        <div className="text-xl font-black text-slate-900 mt-0.5">{topupPackages.length}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200">
                        <div className="text-[10px] text-purple-800 font-bold uppercase">Gói Combo</div>
                        <div className="text-xl font-black text-purple-800 mt-0.5">
                          {topupPackages.filter(p => (p.postCredits || 0) > 0 && ((p.chatCredits || 0) > 0 || (p.valuationCredits || 0) > 0)).length}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200">
                        <div className="text-[10px] text-blue-800 font-bold uppercase">Gói Chuyên Biệt</div>
                        <div className="text-xl font-black text-blue-800 mt-0.5">
                          {topupPackages.filter(p => !((p.postCredits || 0) > 0 && ((p.chatCredits || 0) > 0 || (p.valuationCredits || 0) > 0))).length}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                        <div className="text-[10px] text-rose-800 font-bold uppercase">Chiết Khấu Cao Nhất</div>
                        <div className="text-xl font-black text-rose-700 mt-0.5">
                          {topupPackages.length > 0
                            ? `-${Math.max(...topupPackages.map(p => Number(p.discountPercentage || 0))).toFixed(1)}%`
                            : '0%'}
                        </div>
                      </div>
                    </div>

                    {/* Topup Packages Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-bold">
                            <th className="py-2.5 px-4">Tên Gói & Mô Tả</th>
                            <th className="py-2.5 px-3 text-center">Đăng Tin</th>
                            <th className="py-2.5 px-3 text-center">Chat AI</th>
                            <th className="py-2.5 px-3 text-center">Định Giá AI</th>
                            <th className="py-2.5 px-4 text-right">Giá Gói (VNĐ)</th>
                            <th className="py-2.5 px-4 text-center">Ưu Đãi Chiết Khấu</th>
                            <th className="py-2.5 px-4 text-center">Trạng Thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {topupPackages.length > 0 ? (
                            topupPackages.map((pkg) => {
                              const isCombo = (pkg.postCredits || 0) > 0 && ((pkg.chatCredits || 0) > 0 || (pkg.valuationCredits || 0) > 0);
                              const discount = Number(pkg.discountPercentage || 0);

                              return (
                                <tr key={pkg.id} className="hover:bg-slate-50/70 transition">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                                        isCombo ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {isCombo ? '🎁' : '⚡'}
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                          <span>{pkg.name || pkg.packageName}</span>
                                          {isCombo && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-700 uppercase">
                                              Combo
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                          {pkg.description || 'Gói nạp điểm dịch vụ SecondLife'}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                                    {pkg.postCredits ? `${pkg.postCredits} tin` : '—'}
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                                    {pkg.chatCredits ? `${pkg.chatCredits} lượt` : '—'}
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                                    {pkg.valuationCredits ? `${pkg.valuationCredits} lượt` : '—'}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-extrabold text-[#c34c36] whitespace-nowrap text-sm">
                                    {formatVND(pkg.price || pkg.priceVnd || 0)}
                                  </td>
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
                                    {discount > 0 ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                        Tiết kiệm {discount.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                        Giá chuẩn (0%)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Đang mở bán
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400">
                                Chưa có gói nạp nào được khởi tạo trên máy chủ Backend.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: SYSTEM WALLET & ACCOUNTING RECONCILIATION           */}
          {/* ======================================================== */}
          {activeTab === 'system-wallet' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#24263e] p-5">
              <SystemWalletTab />
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: COMMISSION RULES & REVISION ENGINE                 */}
          {/* ======================================================== */}
          {activeTab === 'commission-rules' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] p-5">
              <CommissionRulesTab />
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: INSPECTION GOVERNANCE & TRAVEL TIERS                */}
          {/* ======================================================== */}
          {activeTab === 'inspection-governance' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-amber-500 p-5">
              <InspectionGovernanceTab lang={lang} />
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: ORDER DETAILS (FROM "Chi tiết" BUTTON)            */}
      {/* ======================================================== */}
      {selectedOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#24263e]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Chi Tiết Đơn Hàng #{selectedOrderModal.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrderModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-800">{selectedOrderModal.listing.title}</div>
                <div className="text-slate-500">Mã thiết bị: {selectedOrderModal.listing.modelCode || 'STD-DEVICE'}</div>
                <div className="text-base font-extrabold text-[#24263e]">
                  {formatVND(selectedOrderModal.totalPaidVnd || selectedOrderModal.itemPriceVnd)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-700">
                <div className="p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Người Mua</span>
                  <span className="font-bold text-slate-900">{selectedOrderModal.buyerName}</span>
                  <span className="text-[11px] text-slate-500 block">{selectedOrderModal.buyerPhone}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Người Bán</span>
                  <span className="font-bold text-slate-900">{selectedOrderModal.sellerName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 text-sky-800 text-xs">
                <span>Trạng thái phong tỏa:</span>
                <span className="font-bold uppercase">{selectedOrderModal.escrowStatus}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setSelectedOrderModal(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  handleForceReleaseEscrow(selectedOrderModal.id);
                  setSelectedOrderModal(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                Giải Ngân Escrow
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ======================================================== */}
      {/* MODAL: SELLER eKYC VERIFICATION DETAIL & REVIEW          */}
      {/* ======================================================== */}
      {selectedVerificationDetail && (() => {
        const isTerminalStatus = selectedVerificationDetail.status === 'APPROVED' || selectedVerificationDetail.status === 'REJECTED';
        const isResubmitRequired = selectedVerificationDetail.status === 'RESUBMIT_REQUIRED';
        const isProviderError = selectedVerificationDetail.status === 'EKYC_PENDING' && selectedVerificationDetail.ekycStatus === 'PROVIDER_ERROR';
        const canReview = ['SUBMITTED', 'EKYC_PENDING', 'NEEDS_REVIEW', 'PENDING'].includes(selectedVerificationDetail.status);
        const isProcessing = reviewingAction !== null;

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* FIXED HEADER */}
              <div className="shrink-0 px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-slate-900 uppercase">
                        Thẩm Định eKYC Người Bán #{selectedVerificationDetail.id}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedVerificationDetail.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        selectedVerificationDetail.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                        selectedVerificationDetail.status === 'RESUBMIT_REQUIRED' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                        'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {selectedVerificationDetail.status}
                      </span>
                      {selectedVerificationDetail.ekycStatus === 'PROVIDER_ERROR' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          ⚠️ PROVIDER_ERROR
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selectedVerificationDetail.shopName ? (
                        <>Gian hàng: <strong className="text-slate-800">{selectedVerificationDetail.shopName}</strong> • </>
                      ) : null}
                      Người nộp: <strong className="text-slate-800">{selectedVerificationDetail.userFullName || 'Người bán SecondLife'}</strong> • Số CCCD: <strong className="font-mono text-slate-800">{selectedVerificationDetail.documentNumber || selectedVerificationDetail.documentNumberMasked || '—'}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVerificationDetail(null)}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* SCROLLABLE BODY */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                {/* Notice message banner */}
                {reviewNoticeMsg && (
                  <div className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold ${
                    reviewNoticeMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' :
                    reviewNoticeMsg.type === 'error' ? 'bg-rose-50 text-rose-900 border border-rose-200' :
                    'bg-blue-50 text-blue-900 border border-blue-200'
                  }`}>
                    {reviewNoticeMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
                     reviewNoticeMsg.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> :
                     <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
                    <span>{reviewNoticeMsg.text}</span>
                  </div>
                )}

                {/* Provider Error Notice Banner */}
                {isProviderError && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <strong className="block font-bold">Gián đoạn kết nối đối tác eKYC VNPT (PROVIDER_ERROR)</strong>
                      <span className="text-[11px] text-amber-800">
                        Hồ sơ đã được tiếp nhận nhưng đối soát eKYC tự động bị gián đoạn do sự cố kết nối hoặc cấu hình VNPT. Quản trị viên hãy kiểm tra dịch vụ và bấm <strong>"Thử Lại eKYC"</strong> bên dưới để chạy lại quy trình từ ảnh đã lưu.
                      </span>
                    </div>
                  </div>
                )}

                {/* Resubmit Required Notice Banner */}
                {isResubmitRequired && (
                  <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 text-xs flex items-center gap-2.5">
                    <RefreshCw className="w-5 h-5 text-orange-600 shrink-0" />
                    <div>
                      <strong className="block font-bold">Hồ sơ đang ở trạng thái YÊU CẦU NỘP LẠI (RESUBMIT_REQUIRED)</strong>
                      <span className="text-[11px] text-orange-800">
                        Lý do: <em>{selectedVerificationDetail.rejectionReason || 'Chụp lại ảnh chứng từ rõ nét'}</em>. Đang chờ người bán đăng nhập để tải lại ảnh mới. Các thao tác thẩm định tạm khóa cho đến khi người bán nộp lại.
                      </span>
                    </div>
                  </div>
                )}

                {/* Terminal status notice */}
                {selectedVerificationDetail.status === 'APPROVED' && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block font-bold">Hồ sơ đã được PHÊ DUYỆT thành công!</strong>
                      <span className="text-[11px] text-emerald-700">Người dùng đã được cấp quyền bán hàng (Role: SELLER). Các nút thao tác đã được đóng để bảo vệ tính toàn vẹn dữ liệu.</span>
                    </div>
                  </div>
                )}

                {selectedVerificationDetail.status === 'REJECTED' && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <strong className="block font-bold">Hồ sơ đã BỊ TỪ CHỐI và kết thúc!</strong>
                      <span className="text-[11px] text-rose-700">Lý do: {selectedVerificationDetail.rejectionReason || 'Chưa đạt yêu cầu thẩm định identity'}. Quy trình xét duyệt hồ sơ này đã đóng. Người dùng cần tạo hồ sơ mới nếu muốn đăng ký lại.</span>
                    </div>
                  </div>
                )}

                {/* Section 1: Thông tin Gian hàng & Người bán */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-rose-600" />
                      <span className="font-bold text-slate-900 text-xs">
                        Thông Tin Đăng Ký Gian Hàng & Liên Hệ
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      Mã tài khoản: <strong className="font-mono text-slate-800">{selectedVerificationDetail.userId}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Tên gian hàng / Hotline:</span>
                      <span className="font-bold text-slate-800 text-[13px] block">
                        {selectedVerificationDetail.shopName || selectedVerificationDetail.userFullName || 'Gian Hàng SecondLife'}
                      </span>
                      <span className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {selectedVerificationDetail.phone || 'Chưa cung cấp SĐT'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Người nộp hồ sơ & Email:</span>
                      <span className="font-bold text-slate-800 text-[13px] block">
                        {selectedVerificationDetail.userFullName || 'Chưa cập nhật tên'}
                      </span>
                      <span className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5 truncate" title={selectedVerificationDetail.userEmail || ''}>
                        <Mail className="w-3 h-3 text-slate-400" />
                        {selectedVerificationDetail.userEmail || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Định danh CCCD / CMND:</span>
                      <span className="font-mono font-bold text-slate-900 text-[13px] block">
                        {selectedVerificationDetail.documentNumber || selectedVerificationDetail.documentNumberMasked || '—'}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Loại: <strong>{selectedVerificationDetail.verificationType || 'CITIZEN_ID'}</strong>
                        {selectedVerificationDetail.resubmissionCount > 0 && ` • Đã nộp lại ${selectedVerificationDetail.resubmissionCount} lần`}
                      </span>
                    </div>
                  </div>

                  {selectedVerificationDetail.pickupAddress && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-start gap-1.5 text-xs text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800">Địa chỉ kho bưu tá lấy hàng: </span>
                        <span>{selectedVerificationDetail.pickupAddress}</span>
                      </div>
                    </div>
                  )}

                  {/* Provider Reference ID & Client Session nếu có */}
                  {(selectedVerificationDetail.providerReferenceId || selectedVerificationDetail.clientSession) && (
                    <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                      {selectedVerificationDetail.providerReferenceId && (
                        <div>
                          <span className="font-bold text-slate-800">Mã đối tác (Ref ID): </span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900">
                            {selectedVerificationDetail.providerReferenceId}
                          </span>
                        </div>
                      )}
                      {selectedVerificationDetail.clientSession && (
                        <div>
                          <span className="font-bold text-slate-800">Phiên client: </span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900">
                            {selectedVerificationDetail.clientSession}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 2: Kết quả eKYC & Chỉ số đánh giá rủi ro (Khớp Mặt, Thực Thể Sống, Chất Lượng Giấy Tờ) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Kết Quả Thẩm Định eKYC & Đánh Giá Rủi Ro:</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Provider: <strong className="text-slate-800">{selectedVerificationDetail.providerName || 'VNPT eKYC'}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Khớp Mặt */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border border-indigo-100 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between text-indigo-700 mb-1">
                        <span className="text-[11px] font-bold">Khớp Mặt</span>
                        <ScanFace className="w-4 h-4" />
                      </div>
                      <div className="font-black text-2xl text-indigo-950 font-mono">
                        {formatScore(selectedVerificationDetail.faceMatchScore)}
                      </div>
                      <span className="text-[10px] text-indigo-600 font-medium mt-1">
                        {selectedVerificationDetail.faceMatchScore !== undefined && selectedVerificationDetail.faceMatchScore !== null
                          ? (Number(selectedVerificationDetail.faceMatchScore) >= 0.8 || Number(selectedVerificationDetail.faceMatchScore) >= 80 ? '✓ Đạt chuẩn đối soát' : '⚠️ Độ khớp thấp')
                          : 'Chờ đối soát ảnh'}
                      </span>
                    </div>

                    {/* Thực Thể Sống */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-100 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between text-emerald-700 mb-1">
                        <span className="text-[11px] font-bold">Thực Thể Sống</span>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="font-black text-2xl text-emerald-950 font-mono">
                        {formatScore(selectedVerificationDetail.livenessScore)}
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium mt-1">
                        {selectedVerificationDetail.livenessScore !== undefined && selectedVerificationDetail.livenessScore !== null
                          ? '✓ Người thật (Active)'
                          : 'Chưa kiểm tra'}
                      </span>
                    </div>

                    {/* Chất Lượng Giấy Tờ */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/80 to-orange-50/50 border border-amber-100 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between text-amber-700 mb-1">
                        <span className="text-[11px] font-bold">Chất Lượng Giấy Tờ</span>
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="font-black text-2xl text-amber-950 font-mono">
                        {formatScore(selectedVerificationDetail.documentScore)}
                      </div>
                      <span className="text-[10px] text-amber-600 font-medium mt-1">
                        {selectedVerificationDetail.documentScore !== undefined && selectedVerificationDetail.documentScore !== null
                          ? '✓ CCCD đạt chuẩn OCR'
                          : 'Chưa đánh giá'}
                      </span>
                    </div>

                    {/* Đánh Giá Rủi Ro */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50/80 to-pink-50/50 border border-purple-100 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between text-purple-700 mb-1">
                        <span className="text-[11px] font-bold">Đánh Giá Rủi Ro</span>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="font-black text-base text-purple-950 font-mono uppercase truncate">
                        {selectedVerificationDetail.riskStatus || 'NOT_EVALUATED'}
                      </div>
                      <span className="text-[10px] text-purple-600 font-medium mt-1">
                        Điểm: {formatScore(selectedVerificationDetail.riskScore)}
                      </span>
                    </div>
                  </div>

                  {/* Ghi chú nguyên tắc nghiệp vụ theo Section 7 & 8 */}
                  <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Lưu ý thẩm định:</strong> Các điểm số eKYC do hệ thống VNPT trả về mang tính tham khảo kỹ thuật. Quản trị viên đưa ra quyết định thẩm định cuối cùng dựa trên đối chiếu thực tế tính xác thực của ảnh CCCD và chân dung.
                    </span>
                  </div>
                </div>

                {/* Section 3: Hình ảnh Đối chiếu Danh tính (3 ảnh) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Hình Ảnh Đối Chiếu Danh Tính & Giấy Tờ:</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Bấm vào ảnh để phóng to toàn màn hình</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Mặt trước */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-600 block">1. CCCD Mặt Trước</span>
                      <div
                        onClick={() => selectedVerificationDetail.documentFrontUrl && setPreviewImageModal({ url: selectedVerificationDetail.documentFrontUrl, title: 'CCCD Mặt Trước' })}
                        className="group relative aspect-4/3 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer hover:border-indigo-500 transition shadow-xs"
                      >
                        {selectedVerificationDetail.documentFrontUrl ? (
                          <>
                            <img src={selectedVerificationDetail.documentFrontUrl} alt="CCCD Mặt trước" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold gap-1">
                              <ZoomIn className="w-4 h-4" />
                              <span>Phóng to</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">Chưa có ảnh</span>
                        )}
                      </div>
                    </div>

                    {/* Mặt sau */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-600 block">2. CCCD Mặt Sau</span>
                      <div
                        onClick={() => selectedVerificationDetail.documentBackUrl && setPreviewImageModal({ url: selectedVerificationDetail.documentBackUrl, title: 'CCCD Mặt Sau' })}
                        className="group relative aspect-4/3 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer hover:border-indigo-500 transition shadow-xs"
                      >
                        {selectedVerificationDetail.documentBackUrl ? (
                          <>
                            <img src={selectedVerificationDetail.documentBackUrl} alt="CCCD Mặt sau" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold gap-1">
                              <ZoomIn className="w-4 h-4" />
                              <span>Phóng to</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">Chưa có ảnh</span>
                        )}
                      </div>
                    </div>

                    {/* Chân dung selfie */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-600 block">3. Chân Dung Selfie</span>
                      <div
                        onClick={() => selectedVerificationDetail.selfieUrl && setPreviewImageModal({ url: selectedVerificationDetail.selfieUrl, title: 'Ảnh Chân Dung Selfie' })}
                        className="group relative aspect-4/3 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer hover:border-indigo-500 transition shadow-xs"
                      >
                        {selectedVerificationDetail.selfieUrl ? (
                          <>
                            <img src={selectedVerificationDetail.selfieUrl} alt="Selfie Chân dung" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold gap-1">
                              <ZoomIn className="w-4 h-4" />
                              <span>Phóng to</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">Chưa có ảnh</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Lịch sử xử lý từ Provider (Audit Trail) */}
                {selectedVerificationDetail.eventHistory && selectedVerificationDetail.eventHistory.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Lịch sử sự kiện xử lý (Audit Trail):</span>
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                      {selectedVerificationDetail.eventHistory.map((ev: any, idx: number) => (
                        <div key={ev.id || idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-800">{ev.eventType}</span>
                            {ev.notes && <p className="text-slate-600 text-[10px] mt-0.5">{ev.notes}</p>}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString('vi-VN') : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 5: Lý do & Ghi chú thẩm định */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs block">
                      Lý do & Hướng dẫn bổ sung {(!canReview) && '(Đã ghi nhận)'}:
                    </label>
                    {selectedVerificationDetail.reasonCodeDescription && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        Diễn giải: <strong className="text-slate-700">{selectedVerificationDetail.reasonCodeDescription}</strong>
                      </span>
                    )}
                  </div>

                  {canReview ? (
                    <>
                      {/* Quick reason chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_VERIFICATION_REASONS.map((r, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setVerReviewReason(r)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
                          >
                            + {r}
                          </button>
                        ))}
                      </div>

                      <div className="pt-1">
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">
                          Nội dung lý do chi tiết (rejectionReason - tối đa 1000 ký tự):
                        </label>
                        <input
                          type="text"
                          maxLength={1000}
                          value={verReviewReason}
                          onChange={(e) => setVerReviewReason(e.target.value)}
                          placeholder="Nhập lý do từ chối hoặc yêu cầu nộp lại..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs space-y-1">
                      <p className="font-medium">
                        {selectedVerificationDetail.rejectionReason || 'Hồ sơ đã được xử lý và lưu trữ trên hệ thống.'}
                      </p>
                      {selectedVerificationDetail.reasonCode && selectedVerificationDetail.reasonCode !== 'NONE' && (
                        <p className="text-[11px] text-slate-500">
                          Mã lý do: <strong className="font-mono">{selectedVerificationDetail.reasonCode}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* FIXED FOOTER */}
              <div className="shrink-0 p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedVerificationDetail(null)}
                  className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Đóng
                </button>

                {isTerminalStatus ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      Hồ sơ ở trạng thái <strong>{selectedVerificationDetail.status}</strong> — Các thao tác đã đóng.
                    </span>
                    <button
                      type="button"
                      disabled={true}
                      className="px-4 py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-xs cursor-not-allowed opacity-60"
                    >
                      Từ Chối
                    </button>
                    <button
                      type="button"
                      disabled={true}
                      className="px-4 py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-xs cursor-not-allowed opacity-60"
                    >
                      Yêu Cầu Nộp Lại
                    </button>
                    <button
                      type="button"
                      disabled={true}
                      className="px-5 py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-xs cursor-not-allowed opacity-60"
                    >
                      Phê Duyệt
                    </button>
                  </div>
                ) : isResubmitRequired ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-orange-700">
                      Đang chờ người bán tải lại ảnh chứng từ (RESUBMIT_REQUIRED) — Các thao tác tạm khóa.
                    </span>
                    <button
                      type="button"
                      disabled={true}
                      className="px-4 py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-xs cursor-not-allowed opacity-60"
                    >
                      Từ Chối
                    </button>
                    <button
                      type="button"
                      disabled={true}
                      className="px-4 py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-xs cursor-not-allowed opacity-60"
                    >
                      Yêu Cầu Nộp Lại
                    </button>
                    <button
                      type="button"
                      disabled={true}
                      className="px-5 py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-xs cursor-not-allowed opacity-60"
                    >
                      Phê Duyệt
                    </button>
                  </div>
                ) : (
                  <div className="w-full sm:w-auto flex flex-wrap items-center gap-2.5 justify-end">
                    {/* Thử lại eKYC khi ĐỒNG THỜI status = EKYC_PENDING và ekycStatus = PROVIDER_ERROR theo Mục 7.2 */}
                    {isProviderError && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleRetrySellerVerification(selectedVerificationDetail.id)}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        title="Thử lại quy trình eKYC với đối tác VNPT từ ảnh đã lưu"
                      >
                        {reviewingAction === 'RETRY' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span>Thử Lại eKYC</span>
                      </button>
                    )}

                    {/* 1. Từ chối hồ sơ */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRejectSellerVerificationWithReason(selectedVerificationDetail.id, verReviewReason)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
                      title="Từ chối hồ sơ và kết thúc quy trình"
                    >
                      {reviewingAction === 'REJECT' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span>Từ Chối Hồ Sơ</span>
                    </button>

                    {/* 2. Yêu cầu nộp lại */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRequestResubmitSellerVerificationWithReason(selectedVerificationDetail.id, verReviewReason)}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
                      title="Yêu cầu người bán chụp lại hoặc bổ sung ảnh giấy tờ"
                    >
                      {reviewingAction === 'RESUBMIT' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Yêu Cầu Nộp Lại</span>
                    </button>

                    {/* 3. Phê duyệt eKYC */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApproveSellerVerification(selectedVerificationDetail.id, selectedVerificationDetail.status)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
                      title="Phê duyệt hồ sơ và cấp vai trò SELLER"
                    >
                      {reviewingAction === 'APPROVE' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Phê Duyệt eKYC</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* MODAL: IMAGE PREVIEW LIGHTBOX                            */}
      {/* ======================================================== */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] bg-slate-900 rounded-3xl p-4 shadow-2xl border border-slate-700 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 text-white">
              <span className="font-bold text-sm">{previewImageModal.title}</span>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl max-h-[78vh] flex items-center justify-center bg-black/50">
              <img
                src={previewImageModal.url}
                alt={previewImageModal.title}
                className="max-w-full max-h-[78vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REJECT REASON INPUT POPUP                         */}
      {/* ======================================================== */}
      {rejectModalVerificationId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <span>Nhập Lý Do Từ Chối eKYC Người Bán</span>
              </h3>
              <button
                onClick={() => setRejectModalVerificationId(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Mã lý do từ chối (Reason Code):</label>
                <select
                  value={rejectionReasonCode}
                  onChange={(e) => setRejectionReasonCode(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-rose-600"
                >
                  <option value="INVALID_DOCUMENT">Giấy tờ không hợp lệ / không chính chủ</option>
                  <option value="DOCUMENT_EXPIRED">Giấy tờ hết hạn sử dụng</option>
                  <option value="FACIAL_MISMATCH">Khuôn mặt selfie không khớp với ảnh CCCD</option>
                  <option value="BLURRY_IMAGE">Hình ảnh mờ, chói sáng không nhìn rõ chữ</option>
                  <option value="OTHER">Lý do khác (Nhập chi tiết bên dưới)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Chi tiết lý do từ chối (rejectionReason - tối đa 1000 ký tự):</label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={rejectionReasonText}
                  onChange={(e) => setRejectionReasonText(e.target.value)}
                  placeholder="Nhập lý do cụ thể (tối đa 1000 ký tự)..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:border-rose-600"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setRejectModalVerificationId(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleRejectSellerVerification}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE INSPECTION CENTER (HUB) ACCOUNT             */}
      {/* ======================================================== */}
      {showAddHubModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#fce5da]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Tạo Tài Khoản Trạm Kiểm Định (Hub) Mới
                </h3>
              </div>
              <button
                onClick={() => setShowAddHubModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHubAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Tên Trạm Hub / Trung tâm:</label>
                <input
                  type="text"
                  required
                  value={newHubData.hubCenterName}
                  onChange={(e) => setNewHubData({ ...newHubData, hubCenterName: e.target.value })}
                  placeholder="Ví dụ: Trạm Kiểm Định Hub Tân Bình"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#fce5da]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email đăng nhập Quản lý Hub:</label>
                <input
                  type="email"
                  required
                  value={newHubData.email}
                  onChange={(e) => setNewHubData({ ...newHubData, email: e.target.value })}
                  placeholder="hub.tanbinh@secondlife.vn"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#fce5da]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mật khẩu khởi tạo:</label>
                <input
                  type="password"
                  required
                  value={newHubData.password}
                  onChange={(e) => setNewHubData({ ...newHubData, password: e.target.value })}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#fce5da]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tỉnh / Thành phố:</label>
                  <input
                    type="text"
                    required
                    value={newHubData.city}
                    onChange={(e) => setNewHubData({ ...newHubData, city: e.target.value })}
                    placeholder="TP. Hồ Chí Minh"
                    className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#fce5da]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Số điện thoại trạm:</label>
                  <input
                    type="tel"
                    required
                    value={newHubData.phone}
                    onChange={(e) => setNewHubData({ ...newHubData, phone: e.target.value })}
                    placeholder="0909123456"
                    className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#fce5da]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Địa chỉ chi tiết trạm Hub:</label>
                <input
                  type="text"
                  required
                  value={newHubData.address}
                  onChange={(e) => setNewHubData({ ...newHubData, address: e.target.value })}
                  placeholder="123 Cộng Hòa, Phường 13, Q. Tân Bình"
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#fce5da]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddHubModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white text-xs font-bold transition cursor-pointer shadow-sm hover:opacity-95"
                >
                  Tạo Tài Khoản Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin User Detail Modal (Requirement 9) */}
      {selectedUserDetailId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#c34c36]/20 to-[#fce5da]/20 flex items-center justify-center text-[#24263e]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Chi Tiết Tài Khoản Người Dùng</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedUserDetailId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserDetailId(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingUserDetail ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#24263e] animate-spin" />
                <p className="text-xs text-slate-500">Đang tải dữ liệu từ máy chủ (GET /admin/users/{selectedUserDetailId})...</p>
              </div>
            ) : userDetailError ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Lỗi khi tải thông tin:</span>
                </div>
                <p>{userDetailError}</p>
                <button
                  onClick={() => handleViewUserDetail(selectedUserDetailId)}
                  className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-rose-700 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            ) : userDetailModalData ? (
              <div className="space-y-4 text-xs">
                {/* User Header Info Card */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#c34c36] to-[#fce5da] text-white flex items-center justify-center text-xl font-black shadow-md overflow-hidden shrink-0">
                    {userDetailModalData.avatarUrl ? (
                      <img src={userDetailModalData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (userDetailModalData.fullName || userDetailModalData.email || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-900 text-sm">{userDetailModalData.fullName || 'Thành viên SecondLife'}</h4>
                    <p className="text-slate-500 font-mono">{userDetailModalData.email}</p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        userDetailModalData.accountStatus === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {userDetailModalData.accountStatus}
                      </span>
                      {userDetailModalData.emailVerified ? (
                        <span className="flex items-center gap-1 w-fit px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-sm">
                          <CheckCircle2 className="w-3 h-3" />
                          Đã xác thực
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 w-fit px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-sm">
                          <AlertTriangle className="w-3 h-3" />
                          Chưa xác thực
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-slate-100 bg-white space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold block">Số điện thoại:</span>
                    <span className="font-mono text-slate-800 font-bold text-xs">{userDetailModalData.phone || 'Chưa cung cấp'}</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-100 bg-white space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold block">Vai trò (Roles):</span>
                    <div className="flex flex-wrap gap-1">
                      {userDetailModalData.roles && userDetailModalData.roles.length > 0 ? (
                        userDetailModalData.roles.map((r, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold">
                            {r}
                          </span>
                        ))
                      ) : (
                        <span className="font-mono text-slate-500">BUYER</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-100 bg-white space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold block">Ngày tạo tài khoản:</span>
                    <span className="font-mono text-slate-700 text-xs">
                      {userDetailModalData.createdAt ? new Date(userDetailModalData.createdAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-100 bg-white space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold block">Cập nhật gần nhất:</span>
                    <span className="font-mono text-slate-700 text-xs">
                      {userDetailModalData.updatedAt ? new Date(userDetailModalData.updatedAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  </div>
                </div>

                {/* Permissions if any */}
                {userDetailModalData.permissions && userDetailModalData.permissions.length > 0 && (
                  <div className="p-3 rounded-xl border border-slate-100 bg-white space-y-1.5">
                    <span className="text-[11px] text-slate-400 font-bold block">Quyền hạn hệ thống (Permissions):</span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {userDetailModalData.permissions.map((p, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-mono font-medium">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedUserDetailId(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: USER ROLES MANAGEMENT (MÀN HÌNH 3)                */}
      {/* ======================================================== */}
      {userRoleModalUserId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Phân Quyền Vai Trò Người Dùng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUserRoleModalUserId(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingUserRoles ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs">Đang tải vai trò và quyền hạn của người dùng...</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* User info */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{userRoleModalUserName}</span>
                    <span className="text-slate-400 font-mono text-[10px]">ID: {userRoleModalUserId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewUserRoleAudit(userRoleModalUserId)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-white text-[11px] font-bold text-slate-600 flex items-center gap-1 transition cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Lịch sử vai trò</span>
                  </button>
                </div>

                {/* Important Alert */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="block font-bold">Lưu ý quan trọng về phiên làm việc:</strong>
                    Khi cập nhật vai trò, hệ thống sẽ tự động tăng <code>tokenVersion</code> và thu hồi toàn bộ Refresh Token của tài khoản. Người dùng sẽ cần đăng nhập lại để nhận quyền mới.
                  </div>
                </div>

                {/* Role Checkboxes */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">Các vai trò áp dụng cho tài khoản:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {rolesList.map((r) => {
                      const isSelected = userRoleSelected.includes(r.code);
                      return (
                        <label
                          key={r.code}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50/40 text-indigo-900 font-bold'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setUserRoleSelected((prev) =>
                                prev.includes(r.code)
                                  ? prev.filter((c) => c !== r.code)
                                  : [...prev, r.code]
                              );
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-xs">{r.name || r.code}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Effective Permissions preview */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 font-bold block">
                    Quyền thực tế hiện hành (Effective Permissions: {userRoleEffectivePerms.length} quyền):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 rounded-lg bg-slate-50 border border-slate-100">
                    {userRoleEffectivePerms.length > 0 ? (
                      userRoleEffectivePerms.map((p, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-mono"
                        >
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Chưa có quyền hạn nào được gán</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUserRoleModalUserId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveUserRoles}
                disabled={isSavingUserRoles || isLoadingUserRoles}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                {isSavingUserRoles && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Lưu Phân Vai Trò</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: USER ROLE AUDIT TRAIL LOGS                        */}
      {/* ======================================================== */}
      {userRoleAuditTrail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Lịch Sử Thay Đổi Vai Trò Của Tài Khoản
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUserRoleAuditTrail(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 text-xs pr-1">
              {userRoleAuditTrail.length > 0 ? (
                userRoleAuditTrail.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800">
                        Thao tác: <span className="text-indigo-600 font-mono">{item.action}</span>
                      </span>
                      <span className="text-slate-500 font-mono">
                        {new Date(item.changedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-500">Vai trò cũ:</span>
                      <span className="font-mono font-bold text-rose-700">
                        {item.oldRoles && item.oldRoles.length > 0 ? item.oldRoles.join(', ') : 'Trống'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-500">Vai trò mới:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {item.newRoles && item.newRoles.length > 0 ? item.newRoles.join(', ') : 'Trống'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400">
                  Chưa có lịch sử thay đổi vai trò nào được ghi nhận.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUserRoleAuditTrail(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GỠ BỎ HẠN CHẾ BÁN HÀNG CHO SELLER (POST /admin/sellers/{id}/reputation/lift-restriction) */}
      {liftRestrictionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Gỡ Bỏ Hạn Chế Bán Hàng</h3>
                  <p className="text-[11px] text-slate-400 font-mono">POST /api/v1/admin/sellers/{'{id}'}/reputation/lift-restriction</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLiftRestrictionModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            {liftRestrictionModal.error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {liftRestrictionModal.error}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div>Người bán: <strong className="text-slate-900">{liftRestrictionModal.sellerName}</strong></div>
                <div className="text-[11px] font-mono text-slate-500">ID: {liftRestrictionModal.sellerId}</div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lý do gỡ hạn chế & bảo chứng uy tín:</label>
                <textarea
                  rows={3}
                  required
                  value={liftRestrictionModal.reason}
                  onChange={(e) => setLiftRestrictionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Nhập lý do gỡ bỏ hạn chế bán hàng..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLiftRestrictionModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmLiftRestriction}
                disabled={liftRestrictionModal.isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {liftRestrictionModal.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác Nhận Gỡ Hạn Chế</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
