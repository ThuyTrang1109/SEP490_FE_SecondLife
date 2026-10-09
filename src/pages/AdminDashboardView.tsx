import React, { useState, useMemo, useEffect } from 'react';
import {
  EscrowOrder,
  DisputeCase,
  Listing,
  Language,
  EscrowStatus,
  UserProfile
} from '../types';
import { translations, formatVND } from '../utils/translations';
import {
  adminService,
  adminPostService,
  adminRbacService,
  adminCreditPricingService,
  healthService,
  UserAdminResponseDto,
  SellerVerificationResponseDto,
  PermissionResponseDto,
  RolePermissionsResponseDto,
  RolePermissionAuditResponseDto,
  UserRolesResponseDto,
  UserRoleAuditResponseDto,
  CreditPricingRuleResponseDto,
  CreditDiscountTierResponseDto,
  CreatePermissionRequestDto
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
} from 'lucide-react';
import { CatalogAiTab } from '../components/admin/CatalogAiTab';

interface AdminDashboardViewProps {
  orders: EscrowOrder[];
  disputes: DisputeCase[];
  listings: Listing[];
  onResolveDispute: (disputeId: string, decision: 'REFUND_BUYER' | 'RELEASE_SELLER') => void;
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
  | 'disputes'
  | 'hubs'
  | 'ai-settings'
  | 'customers'
  | 'seller-kyc'
  | 'permissions'
  | 'credit-pricing';

interface BookingAppointment {
  id: string;
  stt: number;
  customerName: string;
  phone: string;
  gender: string;
  content: string;
  bookingDate: string;
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'PENDING';
}

interface CustomerContact {
  id: string;
  stt: number;
  customerName: string;
  content: string;
  receivedDate: string;
  status: 'PENDING' | 'RESOLVED';
  email: string;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  orders: initialOrders,
  disputes,
  listings: initialListings,
  onResolveDispute,
  lang,
  onViewWebsite,
  currentUser,
  onOpenProfile,
  onLogout,
  onOpenListingDetail
}) => {
  const t = translations[lang];

  // Active sub-tab in Admin Dashboard
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

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

  // Dispute review state
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>(disputes[0]?.id || '');
  const activeDispute = disputes.find((d) => d.id === selectedDisputeId) || disputes[0];

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
          const mapped: Listing[] = items.map((post: any) => {
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
              status: (post.status === 'ACTIVE' ? 'active' : post.status === 'DRAFT' ? 'draft' : 'reserved') as any,
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
  const [verificationFilterTab, setVerificationFilterTab] = useState<'ALL' | 'NEEDS_REVIEW' | 'APPROVED' | 'RESUBMIT_REQUIRED' | 'REJECTED' | 'EKYC_PENDING'>('ALL');
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
  const [selectedBookingModal, setSelectedBookingModal] = useState<BookingAppointment | null>(null);
  const [selectedContactModal, setSelectedContactModal] = useState<CustomerContact | null>(null);
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
  // RBAC STATE & HANDLERS (Permissions, Roles, Audit)
  // =========================================================================
  const [rbacSubTab, setRbacSubTab] = useState<'roles' | 'permissions'>('roles');
  const [permissionsList, setPermissionsList] = useState<PermissionResponseDto[]>([]);
  const [rolesList, setRolesList] = useState<RolePermissionsResponseDto[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('STAFF');
  const [expectedPermissionCodes, setExpectedPermissionCodes] = useState<string[]>([]);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([]);
  const [permSearchTerm, setPermSearchTerm] = useState<string>('');
  const [editingPerm, setEditingPerm] = useState<PermissionResponseDto | null>(null);
  const [roleAuditModalData, setRoleAuditModalData] = useState<{ roleCode: string; items: RolePermissionAuditResponseDto[] } | null>(null);
  const [isLoadingRbac, setIsLoadingRbac] = useState<boolean>(false);
  const [isSavingRbac, setIsSavingRbac] = useState<boolean>(false);

  const loadRbacData = async () => {
    setIsLoadingRbac(true);
    try {
      const [perms, roles] = await Promise.all([
        adminRbacService.getPermissions(),
        adminRbacService.getRoles()
      ]);
      setPermissionsList(perms || []);
      setRolesList(roles || []);

      const curRole = (roles || []).find(r => r.code === selectedRoleCode) || (roles || [])[0];
      if (curRole) {
        setSelectedRoleCode(curRole.code);
        setExpectedPermissionCodes([...curRole.permissionCodes]);
        setSelectedPermissionCodes([...curRole.permissionCodes]);
      }
    } catch (err: any) {
      triggerNotice('Không thể tải dữ liệu RBAC: ' + (err.message || 'Lỗi kết nối'));
    } finally {
      setIsLoadingRbac(false);
    }
  };

  const handleSelectRole = async (role: RolePermissionsResponseDto) => {
    setSelectedRoleCode(role.code);
    setExpectedPermissionCodes([...role.permissionCodes]);
    setSelectedPermissionCodes([...role.permissionCodes]);
    try {
      const fresh = await adminRbacService.getRole(role.code);
      if (fresh && fresh.permissionCodes) {
        setExpectedPermissionCodes([...fresh.permissionCodes]);
        setSelectedPermissionCodes([...fresh.permissionCodes]);
      }
    } catch {
      // Fallback already populated from role object
    }
  };

  const handleOpenEditPermission = async (perm: PermissionResponseDto) => {
    setEditingPerm(perm);
    try {
      const fresh = await adminRbacService.getPermission(perm.code);
      if (fresh) {
        setEditingPerm(fresh);
      }
    } catch {
      // Fallback already set
    }
  };

  const handleTogglePermissionForRole = (permCode: string) => {
    const curRole = rolesList.find(r => r.code === selectedRoleCode);
    if (!curRole || !curRole.editable) {
      triggerNotice('Vai trò ADMIN được quản lý bảo mật cố định, không thể chỉnh sửa.');
      return;
    }
    const perm = permissionsList.find(p => p.code === permCode);
    if (!perm || !perm.assignableRoles?.includes(selectedRoleCode)) {
      triggerNotice(`Quyền ${permCode} không thuộc chính sách cho phép gán của vai trò ${selectedRoleCode}`);
      return;
    }
    setSelectedPermissionCodes(prev =>
      prev.includes(permCode) ? prev.filter(c => c !== permCode) : [...prev, permCode]
    );
  };

  const handleSaveRolePermissions = async () => {
    const curRole = rolesList.find(r => r.code === selectedRoleCode);
    if (!curRole || !curRole.editable) {
      triggerNotice('Không thể sửa đổi bộ quyền của vai trò này.');
      return;
    }
    setIsSavingRbac(true);
    try {
      await adminRbacService.replaceRolePermissions(selectedRoleCode, {
        expectedPermissionCodes,
        permissionCodes: selectedPermissionCodes
      });
      triggerNotice(`Đã cập nhật ma trận quyền cho vai trò ${selectedRoleCode} thành công!`);
      await loadRbacData();
    } catch (err: any) {
      if (err?.message?.includes('409') || err?.status === 409) {
        triggerNotice('⚠️ Xung đột dữ liệu (HTTP 409): Ma trận quyền vừa bị thay đổi bởi quản trị viên khác. Hệ thống đang tải lại...');
        await loadRbacData();
      } else {
        triggerNotice(err?.message || 'Lưu ma trận quyền thất bại');
      }
    } finally {
      setIsSavingRbac(false);
    }
  };

  const handleViewRoleAudit = async (roleCode: string) => {
    try {
      const res = await adminRbacService.getRolePermissionAudit(roleCode);
      setRoleAuditModalData({ roleCode, items: res?.items || [] });
    } catch (err: any) {
      triggerNotice('Không thể tải nhật ký phân quyền: ' + (err.message || ''));
    }
  };

  const handleSaveEditPermission = async () => {
    if (!editingPerm) return;
    try {
      await adminRbacService.updatePermission(editingPerm.code, {
        name: editingPerm.name,
        description: editingPerm.description
      });
      triggerNotice(`Đã cập nhật thông tin quyền ${editingPerm.code} thành công.`);
      setEditingPerm(null);
      await loadRbacData();
    } catch (err: any) {
      triggerNotice(err?.message || 'Cập nhật quyền thất bại');
    }
  };

  // RBAC Create & Delete Permission Handlers (POST & DELETE /api/admin/permissions)
  const [isCreatePermModalOpen, setIsCreatePermModalOpen] = useState(false);
  const [isCreatingPerm, setIsCreatingPerm] = useState(false);
  const [newPermForm, setNewPermForm] = useState<CreatePermissionRequestDto>({
    code: '',
    name: '',
    description: '',
    assignableRoles: ['STAFF']
  });

  const handleCreatePermissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPermForm.code.trim() || !newPermForm.name.trim()) {
      triggerNotice('Vui lòng nhập mã quyền và tên chức năng.');
      return;
    }
    setIsCreatingPerm(true);
    try {
      await adminRbacService.createPermission(newPermForm);
      triggerNotice(`Đã khởi tạo quyền ${newPermForm.code} thành công.`);
      setIsCreatePermModalOpen(false);
      setNewPermForm({ code: '', name: '', description: '', assignableRoles: ['STAFF'] });
      await loadRbacData();
    } catch (err: any) {
      triggerNotice(err?.message || 'Tạo quyền mới thất bại');
    } finally {
      setIsCreatingPerm(false);
    }
  };

  const handleDeletePermission = async (permissionCode: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa quyền "${permissionCode}" không? Quyền chỉ có thể xóa khi chưa được gán vào vai trò nào.`)) {
      return;
    }
    try {
      await adminRbacService.deletePermission(permissionCode);
      triggerNotice(`Đã xóa quyền ${permissionCode} thành công.`);
      await loadRbacData();
    } catch (err: any) {
      triggerNotice(err?.message || 'Xóa quyền thất bại');
    }
  };

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
      if (items.length > 0) {
        const mappedListings: Listing[] = items.map((p: any) => ({
          id: p.id,
          title: p.title || 'Bản Nháp (Chưa có tên)',
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
          sellerName: p.user?.fullName || p.user?.email || p.sellerName || 'Người bán ẩn danh',
          sellerRating: 5.0,
          sellerCompletedOrders: 0,
          sellerVerified: true,
          status: p.status === 'ACTIVE' ? 'active' : p.status === 'DRAFT' ? 'draft' : p.status === 'REJECTED' ? 'rejected' : p.status === 'PENDING_REVIEW' ? 'pending' : 'draft',
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
        triggerNotice(`Đã đồng bộ ${mappedListings.length} bài đăng từ máy chủ Backend.`);
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
  // CREDIT PRICING & DISCOUNT TIERS STATE & HANDLERS
  // =========================================================================
  const [creditPrices, setCreditPrices] = useState<CreditPricingRuleResponseDto[]>([]);
  const [discountTiers, setDiscountTiers] = useState<CreditDiscountTierResponseDto[]>([]);
  const [isLoadingPricing, setIsLoadingPricing] = useState<boolean>(false);
  const [editingPriceType, setEditingPriceType] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<number>(0);
  const [showAddTierModal, setShowAddTierModal] = useState<boolean>(false);
  const [newTierData, setNewTierData] = useState({ minQuantity: 10, maxQuantity: 50, discountRate: 0.1, active: true });

  const loadCreditPricingData = async () => {
    setIsLoadingPricing(true);
    try {
      const [prices, tiers] = await Promise.all([
        adminCreditPricingService.getCreditPrices(),
        adminCreditPricingService.getDiscountTiers()
      ]);
      setCreditPrices(prices || []);
      setDiscountTiers(tiers || []);
    } catch (err: any) {
      triggerNotice('Không thể tải bảng giá credit: ' + (err.message || ''));
    } finally {
      setIsLoadingPricing(false);
    }
  };

  const handleUpdateCreditPrice = async (creditType: 'LISTING' | 'VALUATION', newPrice: number) => {
    try {
      await adminCreditPricingService.updateCreditPrice(creditType, newPrice);
      triggerNotice(`Đã cập nhật đơn giá ${creditType} thành ${formatVND(newPrice)}`);
      setEditingPriceType(null);
      await loadCreditPricingData();
    } catch (err: any) {
      triggerNotice(err?.message || 'Cập nhật giá thất bại');
    }
  };

  const handleCreateDiscountTier = async () => {
    try {
      await adminCreditPricingService.createDiscountTier({
        minQuantity: Number(newTierData.minQuantity),
        maxQuantity: newTierData.maxQuantity ? Number(newTierData.maxQuantity) : null,
        discountRate: Number(newTierData.discountRate),
        active: newTierData.active
      });
      triggerNotice('Đã tạo mới bậc chiết khấu thành công!');
      setShowAddTierModal(false);
      await loadCreditPricingData();
    } catch (err: any) {
      triggerNotice(err?.message || 'Tạo bậc chiết khấu thất bại');
    }
  };

  const handleToggleTierActive = async (tierId: string, newActive: boolean) => {
    const tier = discountTiers.find((t) => t.id === tierId);
    if (!tier) return;
    try {
      await adminCreditPricingService.updateDiscountTier(tierId, {
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        discountRate: tier.discountRate,
        active: newActive
      });
      triggerNotice(`Đã ${newActive ? 'kích hoạt' : 'tạm dừng'} bậc chiết khấu.`);
      await loadCreditPricingData();
    } catch (err: any) {
      triggerNotice(err?.message || 'Cập nhật trạng thái bậc chiết khấu thất bại');
    }
  };

  // Tự động load dữ liệu khi chuyển sang tab permissions, credit-pricing hoặc listings
  useEffect(() => {
    if (activeTab === 'permissions') {
      loadRbacData();
    } else if (activeTab === 'credit-pricing') {
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
    if (currentStatus && currentStatus !== 'NEEDS_REVIEW' && currentStatus !== 'SUBMITTED' && currentStatus !== 'PENDING') {
      triggerNotice(`Chỉ hồ sơ ở trạng thái chờ duyệt mới có thể phê duyệt bởi Quản trị viên (Trạng thái hiện tại: ${currentStatus}).`);
      return;
    }
    setReviewingAction('APPROVE');
    setReviewNoticeMsg({ text: 'Đang tiến hành phê duyệt và cấp vai trò Người bán (SELLER)...', type: 'info' });
    try {
      await adminService.approveSellerVerification(id);
      setReviewNoticeMsg({ text: 'Đã hoàn thành xong! Hồ sơ người bán đã được phê duyệt thành công.', type: 'success' });
      triggerNotice('Đã phê duyệt hồ sơ người bán thành công! Vai trò SELLER đã được gán.');
      const res = await adminService.getSellerVerifications({ page: 0, size: 50 });
      if (res?.items) setBackendVerifications(res.items);
      const updated = await adminService.getSellerVerificationById(id).catch(() => null);
      if (updated) {
        setSelectedVerificationDetail(updated);
      } else {
        setSelectedVerificationDetail((prev: any) => prev ? { ...prev, status: 'APPROVED' } : null);
      }
    } catch (err: any) {
      setReviewNoticeMsg({ text: 'Phê duyệt thất bại: ' + (err?.message || ''), type: 'error' });
      triggerNotice(err.message || 'Phê duyệt hồ sơ thất bại');
    } finally {
      setReviewingAction(null);
    }
  };

  const handleRejectSellerVerificationWithReason = async (id: string, reason?: string, code?: string) => {
    const finalReason = reason || verReviewReason || 'Hồ sơ chưa đạt yêu cầu kiểm định định danh eKYC.';
    const finalCode = code || rejectionReasonCode || 'IMAGE_TOO_BLURRY';
    setReviewingAction('REJECT');
    setReviewNoticeMsg({ text: 'Đang xử lý từ chối hồ sơ người bán...', type: 'info' });
    try {
      await adminService.rejectSellerVerification(id, {
        reasonCode: finalCode,
        rejectionReason: finalReason,
        allowResubmission: false
      });
      setReviewNoticeMsg({ text: 'Đã hoàn thành xong! Đã từ chối hồ sơ xác thực của người bán.', type: 'success' });
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
      setReviewNoticeMsg({ text: 'Từ chối thất bại: ' + (err?.message || ''), type: 'error' });
      triggerNotice(err.message || 'Từ chối hồ sơ thất bại');
    } finally {
      setReviewingAction(null);
    }
  };

  const handleRequestResubmitSellerVerificationWithReason = async (id: string, reason?: string, code?: string) => {
    const finalReason = reason || verReviewReason || 'Ảnh CCCD/chân dung bị mờ, vui lòng chụp lại rõ nét.';
    const finalCode = code || rejectionReasonCode || 'IMAGE_TOO_BLURRY';
    setReviewingAction('RESUBMIT');
    setReviewNoticeMsg({ text: 'Đang gửi yêu cầu nộp lại chứng từ cho người bán...', type: 'info' });
    try {
      await adminService.requestResubmitSellerVerification(id, {
        reasonCode: finalCode,
        rejectionReason: finalReason
      });
      setReviewNoticeMsg({ text: 'Đã hoàn thành xong! Đã gửi yêu cầu nộp lại ảnh chứng từ cho người bán.', type: 'success' });
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
      setReviewNoticeMsg({ text: 'Yêu cầu nộp lại thất bại: ' + (err?.message || ''), type: 'error' });
      triggerNotice(err.message || 'Yêu cầu nộp lại hồ sơ thất bại');
    } finally {
      setReviewingAction(null);
    }
  };

  const handleRejectSellerVerification = async () => {
    if (!rejectModalVerificationId) return;
    await handleRejectSellerVerificationWithReason(rejectModalVerificationId, rejectionReasonText, rejectionReasonCode);
    setRejectionReasonText('');
  };

  const handleRetrySellerVerification = async (id: string) => {
    setReviewingAction('RETRY');
    setReviewNoticeMsg({ text: 'Đang yêu cầu hệ thống thử lại quy trình eKYC...', type: 'info' });
    try {
      await adminService.retrySellerVerification(id);
      setReviewNoticeMsg({ text: 'Đã hoàn thành xong! Kích hoạt thử lại eKYC thành công.', type: 'success' });
      triggerNotice('Đã kích hoạt thử lại eKYC qua hệ thống thành công!');
      const res = await adminService.getSellerVerifications({ page: 0, size: 50 });
      if (res?.items) setBackendVerifications(res.items);
      if (selectedVerificationDetail?.id === id) {
        const updated = await adminService.getSellerVerificationById(id).catch(() => null);
        if (updated) setSelectedVerificationDetail(updated);
      }
    } catch (err: any) {
      setReviewNoticeMsg({ text: 'Thử lại thất bại: ' + (err?.message || ''), type: 'error' });
      triggerNotice(err.message || 'Thử lại eKYC thất bại');
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
      alert(err.message || 'Cập nhật trạng thái người dùng thất bại');
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
      alert(err.message || 'Tạo tài khoản Trạm Hub thất bại');
    }
  };

  // Bookings Data (Khách hàng đặt lịch)
  const [bookings, setBookings] = useState<BookingAppointment[]>([]);

  // Customer Contacts (Khách hàng liên hệ)
  const [contacts, setContacts] = useState<CustomerContact[]>([]);

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

  // Filtered Listings
  const filteredListings = useMemo(() => {
    return localListings.filter((item) => {
      const title = item?.title || '';
      const sellerName = item?.sellerName || '';
      const itemId = item?.id || '';
      const matchSearch =
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = listingCategoryFilter === 'ALL' || item.category === listingCategoryFilter;
      const isNotDraft = item.status !== 'draft';
      return matchSearch && matchCat && isNotDraft;
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
      label: lang === 'vi' ? 'QUẢN LÝ BÁN HÀNG' : 'SALES ORDERS',
      icon: Package,
      badge: localOrders.length || 1,
      badgeColor: 'bg-[#fce5da]'
    },
    {
      id: 'disputes' as AdminTab,
      label: lang === 'vi' ? 'PHÂN XỬ TRANH CHẤP' : 'DISPUTE RESOLUTION',
      icon: Gavel,
      badge: disputes.length || 0,
      badgeColor: 'bg-[#c34c36]'
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
      badge: backendUsers.length || 44
    },
    {
      id: 'hubs' as AdminTab,
      label: lang === 'vi' ? 'QUẢN LÝ TRẠM HUB' : 'HUB CENTERS',
      icon: Building2,
      badge: 3
    },
    {
      id: 'ai-settings' as AdminTab,
      label: lang === 'vi' ? 'CẤU HÌNH THUẬT TOÁN AI' : 'AI CONFIGURATION',
      icon: Sliders,
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

          {/* ======================================================== */}
          {/* TAB: OVERVIEW (EXACT DASHBOARD FROM SCREENSHOT)           */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* ROW 1: 4 SMALL STAT BOXES (AdminLTE Small-Boxes) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Box 1: ĐƠN HÀNG (SecondLife Brand Beige) */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e]">
                      {localOrders.length || 1}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      ĐƠN HÀNG
                    </div>
                  </div>
                  {/* Watermark Icon */}
                  <ShoppingBag className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  {/* Footer link */}
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 2: SẢN PHẨM (SecondLife Brand Beige) */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e]">
                      {localListings.length || 65}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      SẢN PHẨM
                    </div>
                  </div>
                  {/* Watermark Icon */}
                  <BarChart3 className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  {/* Footer link */}
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 3: KHÁCH HÀNG (SecondLife Brand Beige) */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e]">
                      44
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      KHÁCH HÀNG
                    </div>
                  </div>
                  {/* Watermark Icon */}
                  <UserPlus className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  {/* Footer link */}
                  <button
                    onClick={() => setActiveTab('customers')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 4: BÀI VIẾT / TRANH CHẤP (SecondLife Brand Beige) */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e]">
                      {disputes.length || 12}
                    </div>
                    <div className="text-xs uppercase font-black tracking-wider mt-1 text-[#24263e]/80">
                      BÀI VIẾT & TRANH CHẤP
                    </div>
                  </div>
                  {/* Watermark Icon */}
                  <PieChart className="w-18 h-18 text-[#24263e]/15 absolute -right-2 top-2 z-0 group-hover:scale-110 transition-transform duration-300" />
                  {/* Footer link */}
                  <button
                    onClick={() => setActiveTab('disputes')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ROW 2: FULL-WIDTH TABLE: KHÁCH HÀNG ĐẶT LỊCH (Orange top-border) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#fce5da] overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    KHÁCH HÀNG ĐẶT LỊCH
                  </h3>
                  <button
                    onClick={() => toggleCardCollapse('booking')}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title={collapsedCards.booking ? 'Mở rộng' : 'Thu nhỏ'}
                  >
                    {collapsedCards.booking ? (
                      <Plus className="w-4 h-4" />
                    ) : (
                      <Minus className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Table Content */}
                {!collapsedCards.booking && (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                            <th className="py-2.5 px-4 w-14">STT</th>
                            <th className="py-2.5 px-4">Tên khách hàng</th>
                            <th className="py-2.5 px-4">SĐT</th>
                            <th className="py-2.5 px-4">Giới Tính</th>
                            <th className="py-2.5 px-4">nội dung</th>
                            <th className="py-2.5 px-4 whitespace-nowrap">BOOK NGÀY</th>
                            <th className="py-2.5 px-4 text-center w-16">Xem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bookings.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 font-mono font-medium text-slate-500">
                                {item.stt}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                                {item.customerName}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                {item.phone}
                              </td>
                              <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                {item.gender}
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={item.content}>
                                {item.content}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                {item.bookingDate}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => setSelectedBookingModal(item)}
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#fce5da] hover:text-white text-slate-700 text-[11px] font-medium transition cursor-pointer"
                                >
                                  Xem
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Bottom Action */}
                    <div className="p-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => triggerNotice('Đang tải danh sách toàn bộ 85 lịch hẹn khách hàng đặt kiểm định & bưu tá...')}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-[#fce5da] hover:text-[#fce5da] text-xs font-semibold text-slate-700 transition cursor-pointer"
                      >
                        Xem tất cả
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ROW 3: TWO 50% WIDTH CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Card: ĐƠN ĐẶT HÀNG MỚI (SecondLife Dark Navy / Pink accent) */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                        ĐƠN ĐẶT HÀNG MỚI
                      </h3>
                      <button
                        onClick={() => toggleCardCollapse('newOrders')}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        {collapsedCards.newOrders ? (
                          <Plus className="w-4 h-4" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Table Content */}
                    {!collapsedCards.newOrders && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                              <th className="py-2.5 px-4">Mã đơn hàng</th>
                              <th className="py-2.5 px-4">Tên khách hàng</th>
                              <th className="py-2.5 px-4">Trạng thái</th>
                              <th className="py-2.5 px-4">Ngày đặt hàng</th>
                              <th className="py-2.5 px-4 text-center">Chi tiết</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {localOrders.slice(0, 4).map((ord, idx) => (
                              <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {idx === 0 ? 'DH-QK1NA' : ord.id}
                                </td>
                                <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                                  {idx === 0 ? 'kt05' : ord.buyerName}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#c34c36]/15 text-[#24263e] border border-[#c34c36]/30">
                                    Đơn hàng mới
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                  {idx === 0 ? '2025-04-10' : new Date(ord.createdAt).toISOString().split('T')[0]}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => setSelectedOrderModal(ord)}
                                    className="px-2.5 py-1 rounded bg-gradient-to-r from-[#c34c36] to-[#fce5da] hover:opacity-90 text-white text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 mx-auto shadow-xs"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Chi tiết</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  {!collapsedCards.newOrders && (
                    <div className="p-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-[#c34c36] hover:text-[#24263e] text-xs font-semibold text-slate-700 transition cursor-pointer"
                      >
                        Xem tất cả đơn hàng
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Card: KHÁCH HÀNG LIÊN HỆ (Pink top-border) */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                        KHÁCH HÀNG LIÊN HỆ
                      </h3>
                      <button
                        onClick={() => toggleCardCollapse('contacts')}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        {collapsedCards.contacts ? (
                          <Plus className="w-4 h-4" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Table Content */}
                    {!collapsedCards.contacts && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                              <th className="py-2.5 px-4 w-12">STT</th>
                              <th className="py-2.5 px-4">Tên khách hàng</th>
                              <th className="py-2.5 px-4">nội dung</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Ngày nhận</th>
                              <th className="py-2.5 px-4 text-center w-14">Xem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {contacts.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-mono font-medium text-slate-500">
                                  {c.stt}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                                  {c.customerName}
                                </td>
                                <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={c.content}>
                                  {c.content}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                                  {c.receivedDate}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => setSelectedContactModal(c)}
                                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#c34c36] hover:text-white text-slate-700 text-[11px] font-medium transition cursor-pointer"
                                  >
                                    Xem
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  {!collapsedCards.contacts && (
                    <div className="p-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => triggerNotice('Đang tải toàn bộ hòm thư hỗ trợ khách hàng...')}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-[#c34c36] hover:text-[#24263e] text-xs font-semibold text-slate-700 transition cursor-pointer"
                      >
                        Xem tất cả liên hệ
                      </button>
                    </div>
                  )}
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
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition cursor-pointer shadow-xs flex items-center gap-1"
                                title="Xem chi tiết bài đăng"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{lang === 'vi' ? 'Chi tiết' : 'View'}</span>
                              </button>
                              <button
                                onClick={() => handleToggleListingStatus(item.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer shadow-xs flex items-center gap-1"
                                title="Phê duyệt bài đăng công khai"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{lang === 'vi' ? 'Duyệt' : 'Approve'}</span>
                              </button>
                              <button
                                onClick={() => handleDeleteListing(item.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition cursor-pointer shadow-xs flex items-center gap-1"
                                title="Từ chối / Gỡ bài đăng"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{lang === 'vi' ? 'Từ Chối' : 'Reject'}</span>
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
          {/* TAB: DISPUTES (PHÂN XỬ TRANH CHẤP & AI EVIDENCE)         */}
          {/* ======================================================== */}
          {activeTab === 'disputes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Cases */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Gavel className="w-4 h-4 text-[#24263e]" />
                    <span>Hồ Sơ Cần Phán Quyết ({disputes.length})</span>
                  </h3>
                  <span className="text-[11px] bg-[#c34c36]/15 text-[#24263e] font-bold px-2 py-0.5 rounded border border-[#c34c36]/30">
                    Chờ Quyết Định
                  </span>
                </div>

                <div className="space-y-2.5">
                  {disputes.map((disp) => {
                    const isSelected = disp.id === activeDispute?.id;
                    return (
                      <div
                        key={disp.id}
                        onClick={() => setSelectedDisputeId(disp.id)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer ${isSelected
                            ? 'bg-[#c34c36] text-white border-[#c34c36] shadow-sm'
                            : 'bg-white border-slate-200 hover:border-[#c34c36] text-slate-800'
                          }`}
                      >
                        <div className="flex items-center justify-between text-[11px] opacity-80">
                          <span className="font-mono font-bold">#{disp.id}</span>
                          <span>{new Date(disp.openedAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="text-xs font-bold mt-1">
                          Lý do: {disp.reason === 'NOT_AS_DESCRIBED' ? 'Hàng không đúng mô tả' : 'Hàng va đập khi vận chuyển'}
                        </div>
                        <p className="text-xs opacity-75 mt-1 line-clamp-2">"{disp.description}"</p>
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                          <span className="opacity-70">Người mua: {disp.buyerName}</span>
                          <span className="font-bold text-[#24263e]">Xem chứng cứ &rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Dispute Evidence Review */}
              <div className="lg:col-span-8">
                {activeDispute ? (
                  <div className="bg-white rounded-xl p-5 border border-slate-200 border-t-4 border-t-[#c34c36] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Hồ Sơ Trọng Tài #{activeDispute.id} (Đơn #{activeDispute.orderId})
                        </h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Người mua: <strong className="text-slate-800">{activeDispute.buyerName}</strong> vs Người bán: <strong className="text-slate-800">{activeDispute.sellerName}</strong>
                        </div>
                      </div>
                      <span className="bg-[#c34c36]/15 text-[#24263e] text-xs font-bold px-2 py-0.5 rounded">
                        Chờ Phán Quyết
                      </span>
                    </div>

                    {/* AI Engine Box */}
                    <div className="bg-[#fce5da] text-[#24263e] rounded-xl p-4 border border-[#24263e]/15 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#24263e]/15">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[#24263e] text-white flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <h5 className="font-bold text-xs text-[#24263e]">
                            AI Evidence Engine - Phân Tích Bằng Chứng Hình Ảnh
                          </h5>
                        </div>
                        <span className="text-[10px] font-black text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded">94.8% Match</span>
                      </div>

                      <div className="text-xs space-y-1.5 text-[#24263e]/90 font-medium">
                        <p>• Đối chiếu ảnh Hub vs Ảnh người mua: Phát hiện xước móp 4.2mm phát sinh trong quá trình vận chuyển bưu tá.</p>
                        <p>• Khuyến nghị: <strong className="text-[#24263e] font-black underline">HOÀN TIỀN 100% CHO NGƯỜI MUA</strong> từ quỹ bảo hiểm Escrow.</p>
                      </div>

                      <div className="pt-2 flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => {
                            onResolveDispute(activeDispute.id, 'REFUND_BUYER');
                            triggerNotice(`Admin đã phán quyết HOÀN TIỀN 100% cho người mua #${activeDispute.buyerName}.`);
                          }}
                          className="px-3 py-1.5 bg-[#24263e] hover:bg-black text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Duyệt Hoàn Tiền Buyer
                        </button>
                        <button
                          onClick={() => {
                            onResolveDispute(activeDispute.id, 'RELEASE_SELLER');
                            triggerNotice('Admin đã phán quyết Bác khiếu nại, giải ngân cho người bán.');
                          }}
                          className="px-3 py-1.5 bg-white/60 hover:bg-white/80 text-[#24263e] rounded-lg text-xs font-bold transition cursor-pointer border border-[#24263e]/20"
                        >
                          Bác Khiếu Nại (Giải Ngân Seller)
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                    <CheckCircle2 className="w-8 h-8 text-[#24263e] mx-auto mb-2" />
                    <p className="font-bold text-slate-800 text-xs">Không có tranh chấp nào cần giải quyết</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: SELLER-KYC (DUYỆT HỒ SƠ ĐỊNH DANH NGƯỜI BÁN)        */}
          {/* ======================================================== */}
          {activeTab === 'seller-kyc' && (() => {
            const needsReviewCount = backendVerifications.filter(v => v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING').length;
            const approvedCount = backendVerifications.filter(v => v.status === 'APPROVED').length;
            const resubmitCount = backendVerifications.filter(v => v.status === 'RESUBMIT_REQUIRED').length;
            const rejectedCount = backendVerifications.filter(v => v.status === 'REJECTED').length;
            const ekycPendingCount = backendVerifications.filter(v => v.status === 'EKYC_PENDING' || v.ekycStatus === 'PENDING').length;

            const filteredList = backendVerifications.filter((v) => {
              if (verificationFilterTab !== 'ALL') {
                if (verificationFilterTab === 'NEEDS_REVIEW') {
                  if (v.status !== 'NEEDS_REVIEW' && v.status !== 'SUBMITTED' && v.status !== 'PENDING') return false;
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
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 border-t-4 border-t-rose-600 p-5 space-y-4">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-rose-600" />
                      <span>Thẩm Định & Duyệt Hồ Sơ Định Danh Người Bán (Seller eKYC Review)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Phân quyền dành riêng cho Quản trị viên: Đối soát CCCD, ảnh selfie, chỉ số khớp mặt & quyết định cấp quyền gian hàng
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handleRefreshSellerVerifications}
                      disabled={isLoadingVerifications}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Làm mới danh sách hồ sơ"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVerifications ? 'animate-spin text-rose-600' : 'text-slate-500'}`} />
                      <span>{isLoadingVerifications ? 'Đang tải...' : 'Làm Mới'}</span>
                    </button>
                  </div>
                </div>

                {/* Subtab Filters & Search Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setVerificationFilterTab('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        verificationFilterTab === 'ALL'
                          ? 'bg-[#24263e] text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      Tất Cả ({backendVerifications.length})
                    </button>
                    <button
                      onClick={() => setVerificationFilterTab('NEEDS_REVIEW')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        verificationFilterTab === 'NEEDS_REVIEW'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      <span>Cần Duyệt</span>
                      {needsReviewCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          verificationFilterTab === 'NEEDS_REVIEW' ? 'bg-white/30 text-white' : 'bg-amber-600 text-white'
                        }`}>
                          {needsReviewCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setVerificationFilterTab('APPROVED')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        verificationFilterTab === 'APPROVED'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      Đã Phê Duyệt ({approvedCount})
                    </button>
                    <button
                      onClick={() => setVerificationFilterTab('RESUBMIT_REQUIRED')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        verificationFilterTab === 'RESUBMIT_REQUIRED'
                          ? 'bg-orange-600 text-white shadow-xs'
                          : 'bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200'
                      }`}
                    >
                      Yêu Cầu Nộp Lại ({resubmitCount})
                    </button>
                    <button
                      onClick={() => setVerificationFilterTab('REJECTED')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        verificationFilterTab === 'REJECTED'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      Đã Từ Chối ({rejectedCount})
                    </button>
                    <button
                      onClick={() => setVerificationFilterTab('EKYC_PENDING')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        verificationFilterTab === 'EKYC_PENDING'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      Đang eKYC ({ekycPendingCount})
                    </button>
                  </div>

                  <div className="relative min-w-[240px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={verificationSearchTerm}
                      onChange={(e) => setVerificationSearchTerm(e.target.value)}
                      placeholder="Tìm theo Shop, Tên, CCCD, SĐT..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500 bg-white"
                    />
                  </div>
                </div>

                {/* Table Data */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600 text-[11px] font-bold">
                        <th className="py-3 px-4">Gian Hàng & Người Bán</th>
                        <th className="py-3 px-4">Định Danh CCCD</th>
                        <th className="py-3 px-4">Chỉ Số eKYC</th>
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
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                v.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                v.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                v.status === 'RESUBMIT_REQUIRED' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                                v.status === 'NEEDS_REVIEW' || v.status === 'SUBMITTED' || v.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse' :
                                'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}>
                                {v.status}
                              </span>
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
                          <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                            <ShieldCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            Không tìm thấy hồ sơ xác thực người bán nào phù hợp bộ lọc.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#fce5da]" />
                    <span>Danh Sách Trạm Kiểm Định Hub & Quản Lý Kỹ Thuật Viên</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tạo tài khoản Trạm Kiểm Định Hub mới và quản lý năng lực xử lý kiểm định thiết bị
                  </p>
                </div>
                <button
                  onClick={() => setShowAddHubModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white text-xs font-bold shadow-sm hover:opacity-95 transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Tài Khoản Hub Mới</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hubCenters.map((hub) => (
                  <div
                    key={hub.id}
                    className="bg-white rounded-xl p-5 border border-slate-200 border-t-4 border-t-[#fce5da] shadow-xs space-y-3"
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
          {/* TAB: AI-SETTINGS (CẤU HÌNH THUẬT TOÁN AI & RỦI RO)        */}
          {/* ======================================================== */}
          {activeTab === 'ai-settings' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-[#c34c36] text-[#24263e] flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tham Số Thuật Toán AI & Ngưỡng Kiểm Soát Rủi Ro Sàn
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phiên bản mô hình: <span className="font-mono font-bold text-[#24263e]">{modelVersion}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Setting 1 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800">
                      Ngưỡng Phát Hiện Ảnh Trùng Lặp:
                    </label>
                    <span className="font-bold text-sm text-[#24263e] font-mono">{duplicateThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={98}
                    value={duplicateThreshold}
                    onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                    className="w-full accent-[#c34c36] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Từ chối tin nếu ảnh trùng lặp &gt; {duplicateThreshold}% so với thư viện tin cũ.
                  </p>
                </div>

                {/* Setting 2 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800">
                      Cảnh Báo Giá Bất Thường:
                    </label>
                    <span className="font-bold text-sm text-[#24263e] font-mono">&lt; {priceAnomalyThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={60}
                    value={priceAnomalyThreshold}
                    onChange={(e) => setPriceAnomalyThreshold(Number(e.target.value))}
                    className="w-full accent-[#c34c36] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Cảnh báo kiểm tra nếu giá người bán thấp hơn {priceAnomalyThreshold}% so với AI định giá.
                  </p>
                </div>

                {/* Setting 3 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800">
                      Tỷ Lệ Thu Phí Sàn Escrow:
                    </label>
                    <span className="font-bold text-sm text-slate-900 font-mono">{commissionRate}%</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.1}
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-full accent-[#c34c36] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Tỷ lệ tính trên giá trị giao dịch mỗi đơn hàng thành công.
                  </p>
                </div>

                {/* Setting 4 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800">
                      Độ Tin Cậy AI Khuyến Nghị Phán Quyết:
                    </label>
                    <span className="font-bold text-sm text-emerald-600 font-mono">{autoApproveAiConfidence}%</span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={99}
                    value={autoApproveAiConfidence}
                    onChange={(e) => setAutoApproveAiConfidence(Number(e.target.value))}
                    className="w-full accent-[#c34c36] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Độ tin cậy của mô hình vision để đưa ra đề xuất cho trọng tài Admin.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => triggerNotice('Đã lưu thành công cấu hình tham số thuật toán AI.')}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB: PERMISSIONS (PHÂN QUYỀN HỆ THỐNG - RBAC)            */}
          {/* ======================================================== */}
          {activeTab === 'permissions' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] p-5 space-y-5">
              {/* Header & Sub-tab switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Hệ Thống Phân Quyền Vai Trò & Bảo Mật (RBAC Matrix)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quản trị danh mục quyền hạn, chính sách gán quyền và ma trận phân quyền giữa các vai trò
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setRbacSubTab('roles')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        rbacSubTab === 'roles'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ma Trận Quyền Vai Trò
                    </button>
                    <button
                      type="button"
                      onClick={() => setRbacSubTab('permissions')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        rbacSubTab === 'permissions'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Danh Mục Quyền Hệ Thống
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={loadRbacData}
                    disabled={isLoadingRbac}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                    title="Tải lại dữ liệu"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingRbac ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {isLoadingRbac ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
                  <span className="text-xs">Đang tải ma trận phân quyền RBAC...</span>
                </div>
              ) : rbacSubTab === 'roles' ? (
                /* SCREEN 2: ROLE MATRIX VIEW */
                <div className="space-y-4">
                  {/* Role Selector Tabs */}
                  <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500 mr-1">Vai trò:</span>
                    {rolesList.map((role) => (
                      <button
                        key={role.code}
                        type="button"
                        onClick={() => handleSelectRole(role)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          selectedRoleCode === role.code
                            ? 'bg-[#24263e] text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{role.name || role.code}</span>
                        {!role.editable && (
                          <span title="Vai trò bảo mật cố định">
                            <Lock className="w-3 h-3 text-amber-300" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Role Detail Banner */}
                  {(() => {
                    const curRole = rolesList.find((r) => r.code === selectedRoleCode);
                    const isEditable = curRole?.editable ?? false;
                    return (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-extrabold text-[#24263e]">
                              {curRole?.code}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">— {curRole?.name}</span>
                            {isEditable ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Cho phép tùy biến quyền
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Cố định (Không thể chỉnh sửa)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            Đang gán {selectedPermissionCodes.length}/{permissionsList.length} quyền hệ thống
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewRoleAudit(selectedRoleCode)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Nhật ký thay đổi</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveRolePermissions}
                            disabled={!isEditable || isSavingRbac}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              !isEditable
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-[#c34c36] hover:bg-[#a63f2d] text-white shadow-xs'
                            }`}
                          >
                            {isSavingRbac && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>Lưu Ma Trận Quyền</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Search Permissions */}
                  <div className="relative max-w-sm">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={permSearchTerm}
                      onChange={(e) => setPermSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm mã quyền, chức năng..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#c34c36]"
                    />
                  </div>

                  {/* Permissions Checklist Table */}
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                          <th className="py-2.5 px-4 w-12 text-center">Gán</th>
                          <th className="py-2.5 px-4">Mã quyền (Code)</th>
                          <th className="py-2.5 px-4">Tên chức năng</th>
                          <th className="py-2.5 px-4">Mô tả chi tiết</th>
                          <th className="py-2.5 px-4">Chính sách gán</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {permissionsList
                          .filter(
                            (p) =>
                              !permSearchTerm ||
                              p.code.toLowerCase().includes(permSearchTerm.toLowerCase()) ||
                              p.name.toLowerCase().includes(permSearchTerm.toLowerCase()) ||
                              (p.description && p.description.toLowerCase().includes(permSearchTerm.toLowerCase()))
                          )
                          .map((perm) => {
                            const isChecked = selectedPermissionCodes.includes(perm.code);
                            const curRole = rolesList.find((r) => r.code === selectedRoleCode);
                            const isRoleEditable = curRole?.editable ?? false;
                            const isAssignable = perm.assignableRoles?.includes(selectedRoleCode) ?? false;
                            const canToggle = isRoleEditable && isAssignable;

                            return (
                              <tr
                                key={perm.code}
                                className={`transition ${
                                  isChecked ? 'bg-amber-50/20' : 'hover:bg-slate-50/50'
                                }`}
                              >
                                <td className="py-2.5 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={!canToggle}
                                    onChange={() => handleTogglePermissionForRole(perm.code)}
                                    className={`w-4 h-4 rounded border-slate-300 text-[#c34c36] focus:ring-[#c34c36] ${
                                      !canToggle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                    }`}
                                  />
                                </td>
                                <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                                  <div className="flex items-center gap-1.5">
                                    <span>{perm.code}</span>
                                    {perm.systemPermission && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                        SYSTEM
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-slate-800">{perm.name}</td>
                                <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-xs">
                                  {perm.description || '—'}
                                </td>
                                <td className="py-2.5 px-4">
                                  {perm.assignableRoles && perm.assignableRoles.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {perm.assignableRoles.map((r) => (
                                        <span
                                          key={r}
                                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                            r === selectedRoleCode
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}
                                        >
                                          {r}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Tất cả</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* SCREEN 1: PERMISSION CATALOG VIEW */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative max-w-sm">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          value={permSearchTerm}
                          onChange={(e) => setPermSearchTerm(e.target.value)}
                          placeholder="Tìm kiếm mã quyền, tên..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#c34c36]"
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        Tổng số: <strong>{permissionsList.length}</strong> quyền chức năng hệ thống
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsCreatePermModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm Quyền Mới (Custom Permission)</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                          <th className="py-2.5 px-4">Mã Quyền (Code)</th>
                          <th className="py-2.5 px-4">Tên Hiển Thị</th>
                          <th className="py-2.5 px-4">Mô Tả Chức Năng</th>
                          <th className="py-2.5 px-4">Loại Quyền</th>
                          <th className="py-2.5 px-4">Vai Trò Được Phép Gán</th>
                          <th className="py-2.5 px-4 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {permissionsList
                          .filter(
                            (p) =>
                              !permSearchTerm ||
                              p.code.toLowerCase().includes(permSearchTerm.toLowerCase()) ||
                              p.name.toLowerCase().includes(permSearchTerm.toLowerCase()) ||
                              (p.description && p.description.toLowerCase().includes(permSearchTerm.toLowerCase()))
                          )
                          .map((perm) => (
                            <tr key={perm.code} className="hover:bg-slate-50/50 transition">
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">{perm.code}</td>
                              <td className="py-3 px-4 font-semibold text-slate-800">{perm.name}</td>
                              <td className="py-3 px-4 text-slate-500 text-[11px] max-w-sm">
                                {perm.description || '—'}
                              </td>
                              <td className="py-3 px-4">
                                {perm.systemPermission ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    Cốt lõi (System)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                    Tiêu chuẩn
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {(perm.assignableRoles || []).map((r) => (
                                    <span
                                      key={r}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditPermission(perm)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                  >
                                    Sửa
                                  </button>
                                  {!perm.systemPermission && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePermission(perm.code)}
                                      title="Xóa quyền tùy biến khỏi hệ thống"
                                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                                    >
                                      Xóa
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
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
                              {(rule as any).description || (rule.creditType === 'LISTING' ? 'Phí nạp lượt đăng tin sản phẩm trên sàn' : 'Phí lượt kiểm định và thẩm định chất lượng')}
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

                  {/* Section 2: Discount Tiers */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        2. Các Bậc Chiết Khấu Ưu Đãi Nạp Số Lượng Lớn (Discount Tiers)
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowAddTierModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm bậc mới</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-600 text-[11px] font-bold">
                            <th className="py-2.5 px-4">Số lượng tối thiểu</th>
                            <th className="py-2.5 px-4">Số lượng tối đa</th>
                            <th className="py-2.5 px-4">Mức giảm giá (%)</th>
                            <th className="py-2.5 px-4">Trạng thái áp dụng</th>
                            <th className="py-2.5 px-4 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {discountTiers.length > 0 ? (
                            discountTiers.map((tier) => (
                              <tr key={tier.id} className="hover:bg-slate-50/50 transition">
                                <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                  {tier.minQuantity} credits
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600">
                                  {tier.maxQuantity ? `${tier.maxQuantity} credits` : 'Không giới hạn (∞)'}
                                </td>
                                <td className="py-3 px-4 font-bold text-emerald-700">
                                  {(tier.discountRate * 100).toFixed(0)}%
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      tier.active
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {tier.active ? 'Đang hoạt động' : 'Tạm dừng'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTierActive(tier.id, !tier.active)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                      tier.active
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    {tier.active ? 'Tắt' : 'Kích hoạt'}
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400">
                                Chưa có bậc chiết khấu nào được cấu hình.
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
      {/* MODAL: BOOKING DETAILS (FROM "Xem" BUTTON)               */}
      {/* ======================================================== */}
      {selectedBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#fce5da]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Thông Tin Lịch Hẹn #{selectedBookingModal.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBookingModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-900">{selectedBookingModal.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-mono font-bold text-slate-900">{selectedBookingModal.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Thời gian hẹn:</span>
                <span className="font-mono text-slate-900">{selectedBookingModal.bookingDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Giới tính / Nhóm:</span>
                <span>{selectedBookingModal.gender}</span>
              </div>
              <div className="py-2">
                <span className="text-slate-500 block mb-1">Nội dung yêu cầu:</span>
                <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-800 leading-relaxed">
                  {selectedBookingModal.content}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedBookingModal(null)}
                className="px-4 py-1.5 rounded-lg bg-[#c34c36] text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Đã xem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONTACT DETAILS (FROM "Xem" BUTTON)               */}
      {/* ======================================================== */}
      {selectedContactModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#24263e]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Nội Dung Khách Hàng Liên Hệ
                </h3>
              </div>
              <button
                onClick={() => setSelectedContactModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-900">{selectedContactModal.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-900">{selectedContactModal.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Thời gian nhận:</span>
                <span className="font-mono text-slate-900">{selectedContactModal.receivedDate}</span>
              </div>
              <div className="py-2">
                <span className="text-slate-500 block mb-1">Nội dung phản ánh / yêu cầu:</span>
                <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-800 leading-relaxed">
                  {selectedContactModal.content}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  triggerNotice(`Đã gửi phản hồi qua email cho khách hàng ${selectedContactModal.customerName}.`);
                  setSelectedContactModal(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white text-xs font-semibold transition cursor-pointer"
              >
                Gửi Phản Hồi
              </button>
              <button
                onClick={() => setSelectedContactModal(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
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

                {/* Terminal status notice */}
                {selectedVerificationDetail.status === 'APPROVED' && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block font-bold">Hồ sơ đã được PHÊ DUYỆT thành công!</strong>
                      <span className="text-[11px] text-emerald-700">Người dùng đã được cấp quyền bán hàng (Role: SELLER). Các nút thao tác đã được khóa để bảo vệ tính toàn vẹn dữ liệu.</span>
                    </div>
                  </div>
                )}

                {selectedVerificationDetail.status === 'REJECTED' && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <strong className="block font-bold">Hồ sơ đã BỊ TỪ CHỐI!</strong>
                      <span className="text-[11px] text-rose-700">Lý do: {selectedVerificationDetail.rejectionReason || 'Chưa đạt yêu cầu thẩm định identity'}. Quy trình xét duyệt cho hồ sơ này đã kết thúc.</span>
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
                  <label className="font-bold text-slate-800 text-xs block">
                    Lý do & Hướng dẫn bổ sung {isTerminalStatus && '(Đã ghi nhận)'}:
                  </label>

                  {!isTerminalStatus ? (
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

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">Mã nguyên nhân:</label>
                          <select
                            value={rejectionReasonCode}
                            onChange={(e) => setRejectionReasonCode(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500 bg-white"
                          >
                            <option value="IMAGE_TOO_BLURRY">Ảnh chụp bị mờ / không rõ nét</option>
                            <option value="FACE_MISMATCH">Khuôn mặt không khớp chân dung CCCD</option>
                            <option value="DOCUMENT_SUSPECTED_FAKE">Nghi vấn giấy tờ giả mạo</option>
                            <option value="DOCUMENT_EXPIRED">Giấy tờ đã hết hạn sử dụng</option>
                            <option value="DOCUMENT_NOT_FULLY_VISIBLE">Giấy tờ bị khuất / mất góc</option>
                            <option value="SELFIE_QUALITY_LOW">Chất lượng ảnh chân dung kém</option>
                            <option value="CONFIRMED_IDENTITY_MISMATCH">Thông tin định danh không khớp</option>
                            <option value="DUPLICATE_IDENTITY">Số giấy tờ đã gắn tài khoản khác</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">Nội dung lý do chi tiết:</label>
                          <input
                            type="text"
                            value={verReviewReason}
                            onChange={(e) => setVerReviewReason(e.target.value)}
                            placeholder="Nhập lý do từ chối hoặc yêu cầu nộp lại..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs">
                      {selectedVerificationDetail.rejectionReason || 'Hồ sơ đã được phê duyệt và lưu trữ trên hệ thống.'}
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
                ) : (
                  <div className="w-full sm:w-auto flex flex-wrap items-center gap-2.5 justify-end">
                    {/* Thử lại eKYC nếu có lỗi */}
                    {(selectedVerificationDetail.status === 'EKYC_PENDING' || selectedVerificationDetail.ekycStatus === 'PROVIDER_ERROR') && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleRetrySellerVerification(selectedVerificationDetail.id)}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
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
                      onClick={() => handleRejectSellerVerificationWithReason(selectedVerificationDetail.id, verReviewReason, rejectionReasonCode)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
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
                      onClick={() => handleRequestResubmitSellerVerificationWithReason(selectedVerificationDetail.id, verReviewReason, rejectionReasonCode)}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
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
                <label className="block text-slate-700 font-bold mb-1">Chi tiết lý do từ chối:</label>
                <textarea
                  rows={3}
                  value={rejectionReasonText}
                  onChange={(e) => setRejectionReasonText(e.target.value)}
                  placeholder="Nhập hướng dẫn cụ thể để người bán bổ sung lại giấy tờ..."
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
      {/* MODAL: CREATE CUSTOM PERMISSION (POST /admin/permissions) */}
      {/* ======================================================== */}
      {isCreatePermModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleCreatePermissionSubmit}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#c34c36]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Thêm Quyền Mới (Custom Permission)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatePermModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Mã Quyền (Code) *:</label>
                <input
                  type="text"
                  required
                  placeholder="VÍ DỤ: REPORT_EXPORT_SELF"
                  value={newPermForm.code}
                  onChange={(e) => setNewPermForm({ ...newPermForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg font-mono border border-slate-300 outline-none focus:border-[#c34c36]"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Tên Chức Năng *:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Xuất báo cáo thống kê cá nhân"
                  value={newPermForm.name}
                  onChange={(e) => setNewPermForm({ ...newPermForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-[#c34c36]"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Mô Tả Nghiệp Vụ:</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả quyền hạn..."
                  value={newPermForm.description || ''}
                  onChange={(e) => setNewPermForm({ ...newPermForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-[#c34c36]"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Các Vai Trò Cho Phép Gán:</label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {['ADMIN', 'STAFF', 'SELLER', 'BUYER', 'INSPECTOR'].map((r) => {
                    const checked = newPermForm.assignableRoles.includes(r);
                    return (
                      <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setNewPermForm(prev => ({
                              ...prev,
                              assignableRoles: checked
                                ? prev.assignableRoles.filter(x => x !== r)
                                : [...prev.assignableRoles, r]
                            }));
                          }}
                          className="w-3.5 h-3.5 rounded text-[#c34c36] focus:ring-[#c34c36]"
                        />
                        <span className="font-semibold text-slate-800">{r}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreatePermModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isCreatingPerm}
                className="px-5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCreatingPerm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Khởi Tạo Quyền</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT PERMISSION INFO (MÀN HÌNH 1)                 */}
      {/* ======================================================== */}
      {editingPerm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#c34c36]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Chỉnh Sửa Thông Tin Quyền
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPerm(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-500 font-bold block mb-1">Mã Quyền (Code - Không thể sửa):</label>
                <input
                  type="text"
                  disabled
                  value={editingPerm.code}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 font-mono text-slate-600 border border-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Tên Hiển Thị Chức Năng:</label>
                <input
                  type="text"
                  value={editingPerm.name}
                  onChange={(e) => setEditingPerm({ ...editingPerm, name: e.target.value })}
                  placeholder="Ví dụ: Thẩm định hồ sơ bán hàng..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-[#c34c36]"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Mô Tả Chi Tiết:</label>
                <textarea
                  rows={3}
                  value={editingPerm.description || ''}
                  onChange={(e) => setEditingPerm({ ...editingPerm, description: e.target.value })}
                  placeholder="Nhập mô tả nghiệp vụ của quyền hạn..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-[#c34c36]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPerm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditPermission}
                className="px-5 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold transition cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ROLE AUDIT LOGS (MÀN HÌNH 2)                      */}
      {/* ======================================================== */}
      {roleAuditModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#24263e]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Nhật Ký Thay Đổi Quyền Của Vai Trò: <span className="font-mono text-[#c34c36]">{roleAuditModalData.roleCode}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRoleAuditModalData(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 text-xs pr-1">
              {roleAuditModalData.items && roleAuditModalData.items.length > 0 ? (
                roleAuditModalData.items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800">
                        Hành động: <span className="text-[#c34c36] font-mono">{item.action}</span>
                      </span>
                      <span className="text-slate-500 font-mono">
                        {new Date(item.changedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-rose-50/60 border border-rose-100">
                        <span className="font-bold text-rose-800 block mb-1">Quyền bị thu hồi (Revoked):</span>
                        <div className="flex flex-wrap gap-1">
                          {item.revokedPermissions && item.revokedPermissions.length > 0 ? (
                            item.revokedPermissions.map((p, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono">
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">Không có</span>
                          )}
                        </div>
                      </div>

                      <div className="p-2 rounded bg-emerald-50/60 border border-emerald-100">
                        <span className="font-bold text-emerald-800 block mb-1">Quyền được bổ sung (Granted):</span>
                        <div className="flex flex-wrap gap-1">
                          {item.grantedPermissions && item.grantedPermissions.length > 0 ? (
                            item.grantedPermissions.map((p, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">Không có</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400">
                  Chưa có nhật ký thay đổi nào cho vai trò này.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRoleAuditModalData(null)}
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

      {/* ======================================================== */}
      {/* MODAL: ADD DISCOUNT TIER                                 */}
      {/* ======================================================== */}
      {showAddTierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Thêm Bậc Chiết Khấu Mới (Discount Tier)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTierModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Số Lượng Credit Tối Thiểu (Min):</label>
                <input
                  type="number"
                  min={1}
                  value={newTierData.minQuantity}
                  onChange={(e) => setNewTierData({ ...newTierData, minQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-600 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Số Lượng Credit Tối Đa (Max - để trống nếu ∞):</label>
                <input
                  type="number"
                  min={newTierData.minQuantity}
                  value={newTierData.maxQuantity || ''}
                  onChange={(e) =>
                    setNewTierData({
                      ...newTierData,
                      maxQuantity: e.target.value ? Number(e.target.value) : (undefined as any)
                    })
                  }
                  placeholder="Ví dụ: 100 (Bỏ trống nếu không giới hạn)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Tỷ Lệ Giảm Giá (%):</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={(newTierData.discountRate * 100).toFixed(0)}
                  onChange={(e) =>
                    setNewTierData({ ...newTierData, discountRate: Number(e.target.value) / 100 })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-emerald-600 font-mono font-bold text-emerald-700"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Ví dụ: Nhập 15 tương đương giảm 15%</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddTierModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateDiscountTier}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Tạo Bậc Chiết Khấu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
