import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Users,
  Layers,
  Search,
  RefreshCw,
  History,
  Save,
  Plus,
  Edit3,
  Trash2,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Briefcase,
  Building2,
  Store,
  ShoppingBag,
  Award,
  Sparkles,
  Filter,
  ArrowRight,
  Clock,
  Loader2,
  HelpCircle,
  SlidersHorizontal,
  FileText,
  Wallet
} from 'lucide-react';
import {
  adminRbacService,
  PermissionResponseDto,
  RolePermissionsResponseDto,
  RolePermissionAuditResponseDto,
  CreatePermissionRequestDto
} from '../../services/adminRbacService';
import { dialogService } from '../../utils/dialogService';

interface PermissionsTabProps {
  triggerNotice?: (msg: string) => void;
  onRolesUpdated?: (roles: RolePermissionsResponseDto[]) => void;
}

// Module categorization mapping
export interface PermissionModuleInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badgeClass: string;
  bgLight: string;
}

export const PERMISSION_MODULES: PermissionModuleInfo[] = [
  {
    id: 'system',
    name: 'Quản Trị & Cấu Hình',
    description: 'Bảo mật hệ thống, quản trị RBAC, bảng giá, hoa hồng sàn và xử lý tài khoản',
    icon: Shield,
    color: '#c34c36',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    bgLight: 'bg-rose-50/50'
  },
  {
    id: 'users',
    name: 'Tài Khoản & Định Danh eKYC',
    description: 'Hồ sơ người dùng, duyệt eKYC căn cước công dân và cảnh báo vi phạm',
    icon: Users,
    color: '#2563eb',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    bgLight: 'bg-blue-50/50'
  },
  {
    id: 'listings',
    name: 'Tin Đăng & Kiểm Duyệt Sản Phẩm',
    description: 'Tạo bài đăng, định giá AI, phê duyệt và gỡ bỏ tin đăng thiết bị đồ cũ',
    icon: FileText,
    color: '#d97706',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    bgLight: 'bg-amber-50/50'
  },
  {
    id: 'inspection',
    name: 'Kiểm Định & Trạm Hub Kỹ Thuật',
    description: 'Trạm hub trung chuyển, điều phối kiểm định viên, checklist kỹ thuật và biên bản kiểm định',
    icon: CheckCircle2,
    color: '#059669',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bgLight: 'bg-emerald-50/50'
  },
  {
    id: 'finance',
    name: 'Tài Chính, Ví Sàn & Đơn Hàng',
    description: 'Duyệt rút tiền, giữ tiền giải ngân (escrow), điểm credit và kiểm soát gian lận',
    icon: Wallet,
    color: '#7c3aed',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    bgLight: 'bg-purple-50/50'
  },
  {
    id: 'ai_utils',
    name: 'Tiện Ích, Trợ Lý AI & Cá Nhân',
    description: 'Trợ lý AI Chatbot, tải lên hình ảnh đa phương tiện và cập nhật hồ sơ cá nhân',
    icon: Sparkles,
    color: '#0891b2',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    bgLight: 'bg-cyan-50/50'
  }
];

// Rich Vietnamese display details for all standard Spring Boot permission codes
export const PERMISSION_METADATA_VI: Record<string, { name: string; desc: string; module: string }> = {
  // 1. Quản trị & Cấu hình
  'ADMIN_RBAC_MANAGE': {
    name: 'Quản trị Phân quyền RBAC',
    desc: 'Cho phép thay đổi ma trận phân quyền, quản lý vai trò và danh mục quyền hệ thống.',
    module: 'system'
  },
  'ADMIN_STAFF_MANAGE': {
    name: 'Quản lý Nhân sự & Staff',
    desc: 'Cho phép tạo tài khoản, chỉ định và giám sát nhân viên vận hành sàn.',
    module: 'system'
  },
  'ADMIN_PRICING_MANAGE': {
    name: 'Quản trị Bảng giá Dịch vụ & Credit',
    desc: 'Cấu hình đơn giá Credit cho đăng tin, định giá AI và các gói nạp.',
    module: 'system'
  },
  'ADMIN_COMMISSION_MANAGE': {
    name: 'Quản trị Biểu phí & Hoa hồng Sàn',
    desc: 'Cấu hình tỷ lệ hoa hồng đơn hàng escrow theo danh mục và bậc giá trị.',
    module: 'system'
  },
  'ADMIN_CONFIG_MANAGE': {
    name: 'Cấu hình Tham số Hệ thống',
    desc: 'Quản trị cấu hình toàn cục, thời gian giải ngân và hạn mức hệ thống.',
    module: 'system'
  },
  'ADMIN_CATALOG_MANAGE': {
    name: 'Quản trị Danh mục Sản phẩm & AI',
    desc: 'Thêm, sửa, xóa danh mục thiết bị, thông số kỹ thuật và mẫu AI nhận diện.',
    module: 'system'
  },
  'ADMIN_PERMANENT_BAN': {
    name: 'Khóa Vĩnh viễn Tài khoản (Ban)',
    desc: 'Quyền cao nhất để đóng băng và vô hiệu hóa vĩnh viễn tài khoản người dùng vi phạm.',
    module: 'system'
  },
  'ADMIN_HIGH_VALUE_PAYOUT': {
    name: 'Duyệt Giải ngân Giá trị Cao',
    desc: 'Phê duyệt các giao dịch rút tiền hoặc thanh toán vượt hạn mức thông thường.',
    module: 'system'
  },
  'ROLE_READ': {
    name: 'Xem Danh mục Vai trò',
    desc: 'Xem danh sách các vai trò và cấu trúc quyền trong hệ thống.',
    module: 'system'
  },

  // 2. Tài khoản & Định danh eKYC
  'USER_READ_ANY': {
    name: 'Xem Chi tiết Mọi Tài khoản',
    desc: 'Tra cứu thông tin hồ sơ, lịch sử giao dịch và trạng thái của bất kỳ người dùng nào.',
    module: 'users'
  },
  'USER_STATUS_UPDATE': {
    name: 'Cập nhật Trạng thái Tài khoản',
    desc: 'Kích hoạt, tạm khóa hoặc mở khóa tài khoản người mua và người bán.',
    module: 'users'
  },
  'SELLER_VERIFICATION_READ_ANY': {
    name: 'Xem Hồ sơ Định danh eKYC',
    desc: 'Xem toàn bộ danh sách và chi tiết yêu cầu xác thực eKYC CCCD của người bán.',
    module: 'users'
  },
  'SELLER_VERIFICATION_REVIEW': {
    name: 'Phê duyệt / Từ chối eKYC',
    desc: 'Thực hiện duyệt hoặc từ chối hồ sơ định danh người bán sau khi đối soát CCCD.',
    module: 'users'
  },
  'SELLER_VERIFICATION_SUBMIT': {
    name: 'Gửi Hồ sơ eKYC Cá nhân',
    desc: 'Người dùng tải ảnh CCCD và khuôn mặt để yêu cầu nâng cấp lên Người Bán.',
    module: 'users'
  },
  'SELLER_VERIFICATION_READ_SELF': {
    name: 'Theo dõi Trạng thái eKYC Cá nhân',
    desc: 'Xem kết quả và phản hồi hồ sơ xác thực của chính tài khoản mình.',
    module: 'users'
  },
  'STAFF_USER_WARN': {
    name: 'Gửi Cảnh báo Vi phạm',
    desc: 'Gửi thông báo cảnh cáo tới người dùng khi có dấu hiệu gian lận hoặc vi phạm quy tắc.',
    module: 'users'
  },
  'STAFF_USER_TEMP_RESTRICT': {
    name: 'Hạn chế Tài khoản Tạm thời',
    desc: 'Tạm ngưng quyền đăng bài hoặc giao dịch của người dùng trong thời gian xử lý vi phạm.',
    module: 'users'
  },

  // 3. Bài đăng & Kiểm duyệt
  'POST_REVIEW': {
    name: 'Duyệt Bài đăng Sản phẩm',
    desc: 'Phê duyệt hoặc từ chối bài đăng đồ cũ sau khi đối chiếu kết quả kiểm duyệt AI.',
    module: 'listings'
  },
  'STAFF_LISTING_REVIEW': {
    name: 'Xem xét Bài đăng Báo cáo',
    desc: 'Đánh giá các tin đăng bị người dùng báo cáo hoặc AI gắn cờ nghi ngờ.',
    module: 'listings'
  },
  'POST_CREATE': {
    name: 'Tạo Tin đăng Mới',
    desc: 'Quyền đăng bài bán thiết bị gia dụng lên sàn giao dịch.',
    module: 'listings'
  },
  'POST_UPDATE': {
    name: 'Chỉnh sửa Tin đăng',
    desc: 'Cập nhật hình ảnh, thông số kỹ thuật và giá bán của bài đăng.',
    module: 'listings'
  },
  'POST_DELETE': {
    name: 'Xóa / Ẩn Tin đăng',
    desc: 'Gỡ bài đăng khỏi sàn giao dịch.',
    module: 'listings'
  },
  'LISTING_CREATE_SELF': {
    name: 'Tạo Bản nháp Tin Đăng',
    desc: 'Tạo bản nháp bài đăng bán đồ cũ của chính mình.',
    module: 'listings'
  },
  'LISTING_PUBLISH_SELF': {
    name: 'Xuất bản Tin đăng Cá nhân',
    desc: 'Nộp bài đăng cá nhân lên sàn để chờ duyệt và hiển thị công khai.',
    module: 'listings'
  },
  'LISTING_VALUATION_SELF': {
    name: 'Sử dụng AI Định giá Thiết bị',
    desc: 'Sử dụng dịch vụ AI để gợi ý giá bán tối ưu dựa trên hình ảnh và thông số thiết bị.',
    module: 'listings'
  },

  // 4. Kiểm định & Hub
  'INSPECTION_CENTER_ACCOUNT_MANAGE': {
    name: 'Quản lý Tài khoản Trạm Hub',
    desc: 'Tạo và cấp quyền tài khoản cho các đối tác trạm kiểm định chất lượng.',
    module: 'inspection'
  },
  'INSPECTION_STAFF_MANAGE': {
    name: 'Quản lý Nhân sự Kiểm định',
    desc: 'Phân công và điều phối các kiểm định viên tại trạm.',
    module: 'inspection'
  },
  'INSPECTION_ORDER_ASSIGN': {
    name: 'Phân công Đơn Kiểm định',
    desc: 'Chỉ định kiểm định viên chịu trách nhiệm kiểm tra thiết bị cho đơn hàng.',
    module: 'inspection'
  },
  'INSPECTION_ORDER_READ_ANY': {
    name: 'Xem Toàn bộ Đơn Kiểm định',
    desc: 'Theo dõi tiến độ kiểm định thiết bị của tất cả các đơn hàng trên toàn hệ thống.',
    module: 'inspection'
  },
  'INSPECTION_CHECKLIST_MANAGE': {
    name: 'Quản trị Tiêu chuẩn Checklist',
    desc: 'Cấu hình bộ tiêu chí kiểm tra máy móc điện lạnh, điện gia dụng.',
    module: 'inspection'
  },
  'INSPECTION_FEE_MANAGE': {
    name: 'Quản trị Biểu phí Kiểm định',
    desc: 'Cấu hình phí kiểm định tại Hub và kiểm định tận nơi cho từng loại máy móc.',
    module: 'inspection'
  },
  'INSPECTION_ORDER_READ_SELF': {
    name: 'Xem Đơn Kiểm định của Mình',
    desc: 'Kiểm định viên xem các đơn được giao, hoặc người dùng theo dõi đơn của thiết bị mình.',
    module: 'inspection'
  },
  'INSPECTION_REPORT_SUBMIT': {
    name: 'Phát hành Biên bản Kiểm định',
    desc: 'Nhập thông số đánh giá, tải ảnh biên bản và ký duyệt kết quả kiểm tra chất lượng.',
    module: 'inspection'
  },
  'INSPECTION_REQUEST_SELF': {
    name: 'Yêu cầu Dịch vụ Kiểm định',
    desc: 'Người mua hoặc người bán gửi yêu cầu kiểm định chất lượng cho sản phẩm.',
    module: 'inspection'
  },

  // 5. Tài chính, Ví & Đơn hàng
  'STAFF_PAYOUT_REVIEW': {
    name: 'Xem xét Yêu cầu Rút tiền',
    desc: 'Kiểm tra hồ sơ yêu cầu rút tiền ví của người bán và đối soát tài khoản ngân hàng.',
    module: 'finance'
  },
  'STAFF_PAYOUT_HOLD': {
    name: 'Tạm giữ Lệnh Rút tiền',
    desc: 'Đóng băng lệnh rút tiền khi phát hiện giao dịch có dấu hiệu tranh chấp hoặc bất thường.',
    module: 'finance'
  },
  'STAFF_DISPUTE_REVIEW': {
    name: 'Xem xét Khiếu nại / Tranh chấp',
    desc: 'Ghi nhận và thu thập chứng cứ khiếu nại giữa người mua và người bán.',
    module: 'finance'
  },
  'STAFF_FRAUD_REVIEW': {
    name: 'Rà soát Gian lận Giao dịch',
    desc: 'Phân tích các giao dịch nghi vấn rửa tiền hoặc mua bán giả mạo.',
    module: 'finance'
  },
  'CREDIT_READ_SELF': {
    name: 'Xem Số dư & Lịch sử Credit',
    desc: 'Kiểm tra số dư điểm credit đăng tin và lịch sử biến động số dư cá nhân.',
    module: 'finance'
  },
  'CREDIT_PURCHASE_SELF': {
    name: 'Mua Gói Nạp Credit',
    desc: 'Thực hiện thanh toán trực tuyến qua cổng để nạp credit vào tài khoản.',
    module: 'finance'
  },

  // 6. Tiện ích & AI
  'AI_CHAT_SELF': {
    name: 'Trò chuyện cùng Trợ lý AI',
    desc: 'Sử dụng chatbot AI tư vấn kỹ thuật, gợi ý sản phẩm và hỗ trợ người dùng.',
    module: 'ai_utils'
  },
  'MEDIA_UPLOAD_SELF': {
    name: 'Tải lên Hình ảnh & Video',
    desc: 'Tải ảnh sản phẩm, ảnh giấy tờ và video kiểm định lên kho lưu trữ.',
    module: 'ai_utils'
  },
  'PROFILE_READ_SELF': {
    name: 'Xem Thông tin Cá nhân',
    desc: 'Đọc thông tin hồ sơ tài khoản và địa chỉ của chính mình.',
    module: 'ai_utils'
  },
  'PROFILE_UPDATE_SELF': {
    name: 'Cập nhật Thông tin Cá nhân',
    desc: 'Chỉnh sửa họ tên, số điện thoại, ảnh đại diện và địa chỉ nhận hàng.',
    module: 'ai_utils'
  },
  'PASSWORD_CHANGE_SELF': {
    name: 'Đổi Mật khẩu Tài khoản',
    desc: 'Tự thay đổi mật khẩu đăng nhập của chính tài khoản mình.',
    module: 'ai_utils'
  }
};

// Role visual helpers
interface RoleMeta {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  colorClass: string;
  accentBorder: string;
  badgeBg: string;
}

const ROLE_META_MAP: Record<string, RoleMeta> = {
  ADMIN: {
    title: 'Quản Trị Viên Tối Cao',
    subtitle: 'Toàn quyền kiểm soát và điều hành toàn bộ nền tảng SecondLife',
    icon: ShieldAlert,
    colorClass: 'text-rose-600',
    accentBorder: 'border-l-rose-600',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  STAFF: {
    title: 'Nhân Viên Vận Hành Sàn',
    subtitle: 'Phê duyệt bài đăng, duyệt rút tiền ví và hỗ trợ người dùng',
    icon: Briefcase,
    colorClass: 'text-indigo-600',
    accentBorder: 'border-l-indigo-600',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  INSPECTOR: {
    title: 'Kiểm Định Viên Kỹ Thuật',
    subtitle: 'Thao tác checklist kiểm định thiết bị, phát hành biên bản chất lượng',
    icon: Award,
    colorClass: 'text-emerald-600',
    accentBorder: 'border-l-emerald-600',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  INSPECTION_CENTER: {
    title: 'Trung Tâm Hub Đối Tác',
    subtitle: 'Quản lý trạm trung chuyển, phân công kiểm định viên tại trạm',
    icon: Building2,
    colorClass: 'text-cyan-600',
    accentBorder: 'border-l-cyan-600',
    badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200'
  },
  SELLER: {
    title: 'Người Bán Hàng',
    subtitle: 'Đăng tin bán thiết bị gia dụng, nạp credit và nộp hồ sơ eKYC',
    icon: Store,
    colorClass: 'text-amber-600',
    accentBorder: 'border-l-amber-600',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  BUYER: {
    title: 'Người Mua Hàng',
    subtitle: 'Tìm kiếm, mua hàng, đặt cọc giữ tiền escrow và đánh giá',
    icon: ShoppingBag,
    colorClass: 'text-sky-600',
    accentBorder: 'border-l-sky-600',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200'
  }
};

export const PermissionsTab: React.FC<PermissionsTabProps> = ({
  triggerNotice = () => {},
  onRolesUpdated
}) => {
  // Main view state: Role Matrix vs Permission Catalog
  const [subTab, setSubTab] = useState<'matrix' | 'catalog'>('matrix');

  // Loading & Action states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Data from backend
  const [permissions, setPermissions] = useState<PermissionResponseDto[]>([]);
  const [roles, setRoles] = useState<RolePermissionsResponseDto[]>([]);

  // Selected role for Matrix view
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('STAFF');
  const [expectedCodes, setExpectedCodes] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED' | 'ASSIGNABLE'>('ALL');

  // Modals state
  const [auditModal, setAuditModal] = useState<{ roleCode: string; items: RolePermissionAuditResponseDto[] } | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [editingPerm, setEditingPerm] = useState<PermissionResponseDto | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<CreatePermissionRequestDto>({
    code: '',
    name: '',
    description: '',
    assignableRoles: ['STAFF']
  });

  // Load all RBAC data from Backend
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [fetchedPerms, fetchedRoles] = await Promise.all([
        adminRbacService.getPermissions(),
        adminRbacService.getRoles()
      ]);

      const permsList = fetchedPerms || [];
      const rolesList = fetchedRoles || [];

      setPermissions(permsList);
      setRoles(rolesList);
      if (onRolesUpdated) onRolesUpdated(rolesList);

      // Keep or set active role
      const currentRole = rolesList.find((r) => r.code === selectedRoleCode) || rolesList[0];
      if (currentRole) {
        setSelectedRoleCode(currentRole.code);
        setExpectedCodes([...(currentRole.permissionCodes || [])]);
        setSelectedCodes([...(currentRole.permissionCodes || [])]);
      }
    } catch (err: any) {
      console.error('Error loading RBAC:', err);
      triggerNotice('Không thể tải dữ liệu phân quyền RBAC: ' + (err?.message || 'Lỗi mạng'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRoleCode, onRolesUpdated, triggerNotice]);

  useEffect(() => {
    loadData();
  }, []);

  // Handle switching selected role
  const handleSelectRole = async (role: RolePermissionsResponseDto) => {
    setSelectedRoleCode(role.code);
    setExpectedCodes([...(role.permissionCodes || [])]);
    setSelectedCodes([...(role.permissionCodes || [])]);

    // Fetch fresh copy from backend to avoid any stale data
    try {
      const fresh = await adminRbacService.getRole(role.code);
      if (fresh && fresh.permissionCodes) {
        setExpectedCodes([...fresh.permissionCodes]);
        setSelectedCodes([...fresh.permissionCodes]);
      }
    } catch {
      // Fallback already assigned
    }
  };

  // Find active role
  const currentRole = useMemo(() => {
    return roles.find((r) => r.code === selectedRoleCode) || roles[0];
  }, [roles, selectedRoleCode]);

  // Compute changes / diff
  const addedCodes = useMemo(() => {
    return selectedCodes.filter((c) => !expectedCodes.includes(c));
  }, [selectedCodes, expectedCodes]);

  const removedCodes = useMemo(() => {
    return expectedCodes.filter((c) => !selectedCodes.includes(c));
  }, [selectedCodes, expectedCodes]);

  const hasUnsavedChanges = addedCodes.length > 0 || removedCodes.length > 0;

  // Toggle single permission for role
  const handleTogglePermission = (permCode: string) => {
    if (!currentRole?.editable) {
      triggerNotice(`Vai trò ${currentRole?.code || ''} được bảo mật cố định, không thể chỉnh sửa.`);
      return;
    }

    const perm = permissions.find((p) => p.code === permCode);
    if (!perm) return;

    const isAssignable = perm.assignableRoles?.includes(selectedRoleCode);
    if (!isAssignable) {
      triggerNotice(`Chính sách hệ thống không cho phép gán quyền "${permCode}" cho vai trò "${selectedRoleCode}".`);
      return;
    }

    setSelectedCodes((prev) =>
      prev.includes(permCode) ? prev.filter((c) => c !== permCode) : [...prev, permCode]
    );
  };

  // Batch toggle for a module
  const handleSelectAllInGroup = (groupPerms: PermissionResponseDto[]) => {
    if (!currentRole?.editable) return;
    const assignableCodes = groupPerms
      .filter((p) => p.assignableRoles?.includes(selectedRoleCode))
      .map((p) => p.code);

    setSelectedCodes((prev) => {
      const set = new Set([...prev, ...assignableCodes]);
      return Array.from(set);
    });
  };

  const handleDeselectAllInGroup = (groupPerms: PermissionResponseDto[]) => {
    if (!currentRole?.editable) return;
    const groupCodes = new Set(groupPerms.map((p) => p.code));
    setSelectedCodes((prev) => prev.filter((c) => !groupCodes.has(c)));
  };

  // Reset changes
  const handleResetChanges = () => {
    setSelectedCodes([...expectedCodes]);
    triggerNotice('Đã hoàn tác toàn bộ thay đổi chưa lưu.');
  };

  // Save changes to backend
  const handleSaveMatrix = async () => {
    if (!currentRole?.editable) {
      triggerNotice('Không thể chỉnh sửa vai trò này.');
      return;
    }

    setIsSaving(true);
    try {
      await adminRbacService.replaceRolePermissions(selectedRoleCode, {
        expectedPermissionCodes: expectedCodes,
        permissionCodes: selectedCodes
      });

      triggerNotice(`Đã lưu thành công ma trận quyền cho vai trò ${currentRole.name || currentRole.code}!`);
      // Update expectedCodes
      setExpectedCodes([...selectedCodes]);

      // Update in local roles list
      setRoles((prev) =>
        prev.map((r) =>
          r.code === selectedRoleCode ? { ...r, permissionCodes: [...selectedCodes] } : r
        )
      );
      if (onRolesUpdated) {
        onRolesUpdated(
          roles.map((r) =>
            r.code === selectedRoleCode ? { ...r, permissionCodes: [...selectedCodes] } : r
          )
        );
      }
    } catch (err: any) {
      if (err?.message?.includes('409') || err?.status === 409) {
        triggerNotice('⚠️ Xung đột dữ liệu (HTTP 409): Ma trận quyền vừa bị thay đổi bởi quản trị viên khác. Hệ thống đang tải lại...');
        await loadData(true);
      } else {
        triggerNotice(err?.message || 'Lưu ma trận quyền thất bại.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Open Audit Modal
  const handleOpenAuditModal = async (roleCode: string) => {
    setIsLoadingAudit(true);
    try {
      const res = await adminRbacService.getRolePermissionAudit(roleCode);
      setAuditModal({
        roleCode,
        items: res?.items || []
      });
    } catch (err: any) {
      triggerNotice('Không thể tải nhật ký phân quyền: ' + (err?.message || 'Lỗi mạng'));
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (perm: PermissionResponseDto) => {
    setEditingPerm({ ...perm });
    setIsEditModalOpen(true);
  };

  // Save Edit Permission
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerm) return;

    setIsSavingEdit(true);
    try {
      await adminRbacService.updatePermission(editingPerm.code, {
        name: editingPerm.name,
        description: editingPerm.description,
        assignableRoles: editingPerm.assignableRoles
      });
      triggerNotice(`Đã cập nhật thông tin quyền "${editingPerm.code}" thành công.`);
      setIsEditModalOpen(false);
      setEditingPerm(null);
      await loadData(true);
    } catch (err: any) {
      triggerNotice(err?.message || 'Cập nhật quyền thất bại.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Create Permission
  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.code.trim() || !createForm.name.trim()) {
      triggerNotice('Vui lòng nhập đầy đủ mã quyền và tên chức năng.');
      return;
    }

    setIsCreating(true);
    try {
      await adminRbacService.createPermission(createForm);
      triggerNotice(`Đã thêm quyền mới "${createForm.code}" thành công.`);
      setIsCreateModalOpen(false);
      setCreateForm({
        code: '',
        name: '',
        description: '',
        assignableRoles: ['STAFF']
      });
      await loadData(true);
    } catch (err: any) {
      triggerNotice(err?.message || 'Thêm quyền mới thất bại.');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete Permission
  const handleDeletePermission = async (permCode: string) => {
    const confirmed = await dialogService.confirm(
      `Bạn có chắc chắn muốn xóa quyền "${permCode}" khỏi hệ thống không? Chỉ có thể xóa quyền chưa được gán vào vai trò nào.`,
      { title: 'Xác Nhận Xóa Quyền', type: 'warning' }
    );
    if (!confirmed) return;

    try {
      await adminRbacService.deletePermission(permCode);
      triggerNotice(`Đã xóa quyền "${permCode}" thành công.`);
      await loadData(true);
    } catch (err: any) {
      triggerNotice(err?.message || 'Xóa quyền thất bại.');
    }
  };

  // Helper to categorize a permission
  const getPermModule = useCallback((code: string): string => {
    if (PERMISSION_METADATA_VI[code]?.module) {
      return PERMISSION_METADATA_VI[code].module;
    }
    const upper = code.toUpperCase();
    if (upper.startsWith('ADMIN_') || upper.startsWith('ROLE_')) return 'system';
    if (upper.startsWith('USER_') || upper.startsWith('SELLER_VERIFICATION_')) return 'users';
    if (upper.startsWith('POST_') || upper.startsWith('LISTING_')) return 'listings';
    if (upper.startsWith('INSPECTION_')) return 'inspection';
    if (upper.startsWith('STAFF_PAYOUT_') || upper.startsWith('CREDIT_')) return 'finance';
    if (upper.startsWith('AI_') || upper.startsWith('MEDIA_') || upper.startsWith('PROFILE_')) return 'ai_utils';
    return 'system';
  }, []);

  // Filtered permissions list
  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const viMeta = PERMISSION_METADATA_VI[p.code];
        const matchCode = p.code.toLowerCase().includes(term);
        const matchName = (p.name || '').toLowerCase().includes(term);
        const matchDesc = (p.description || '').toLowerCase().includes(term);
        const matchViName = (viMeta?.name || '').toLowerCase().includes(term);
        const matchViDesc = (viMeta?.desc || '').toLowerCase().includes(term);

        if (!matchCode && !matchName && !matchDesc && !matchViName && !matchViDesc) {
          return false;
        }
      }

      // 2. Module filter
      if (selectedModuleFilter !== 'ALL') {
        const mod = getPermModule(p.code);
        if (mod !== selectedModuleFilter) return false;
      }

      // 3. Status filter (in Matrix view)
      if (subTab === 'matrix') {
        const isAssigned = selectedCodes.includes(p.code);
        const isAssignable = p.assignableRoles?.includes(selectedRoleCode);

        if (statusFilter === 'ASSIGNED' && !isAssigned) return false;
        if (statusFilter === 'UNASSIGNED' && isAssigned) return false;
        if (statusFilter === 'ASSIGNABLE' && !isAssignable) return false;
      }

      return true;
    });
  }, [permissions, searchTerm, selectedModuleFilter, statusFilter, subTab, selectedCodes, selectedRoleCode, getPermModule]);

  // Group filtered permissions by Module
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionResponseDto[]> = {};
    PERMISSION_MODULES.forEach((m) => {
      groups[m.id] = [];
    });

    filteredPermissions.forEach((p) => {
      const mod = getPermModule(p.code);
      if (groups[mod]) {
        groups[mod].push(p);
      } else {
        if (!groups['system']) groups['system'] = [];
        groups['system'].push(p);
      }
    });

    return groups;
  }, [filteredPermissions, getPermModule]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3 text-slate-500 shadow-xs">
        <Loader2 className="w-8 h-8 animate-spin text-[#c34c36]" />
        <span className="text-sm font-bold">Đang tải ma trận phân quyền hệ thống (RBAC)...</span>
      </div>
    );
  }

  const roleMeta = ROLE_META_MAP[selectedRoleCode] || {
    title: currentRole?.name || selectedRoleCode,
    subtitle: currentRole?.description || 'Vai trò người dùng trong hệ thống',
    icon: Shield,
    colorClass: 'text-slate-700',
    accentBorder: 'border-l-slate-600',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  const RoleIcon = roleMeta.icon;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 1. TOP HEADER & MAIN TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-[#c34c36] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#c34c36]/10 text-[#c34c36] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                PHÂN QUYỀN HỆ THỐNG & BẢO MẬT VAI TRÒ (RBAC)
              </h2>
              <p className="text-xs text-slate-500">
                Quản trị ma trận phân quyền chi tiết, chính sách gán quyền API và bảo vệ điểm cuối của hệ thống
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Main Switcher: Matrix vs Catalog */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setSubTab('matrix')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                subTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#c34c36]" />
              <span>Ma Trận Quyền Vai Trò</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('catalog')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                subTab === 'catalog'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#24263e]" />
              <span>Từ Điển Quyền Hệ Thống ({permissions.length})</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#c34c36]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Tổng Vai Trò</span>
            <Users className="w-4 h-4 text-[#24263e]" />
          </div>
          <div className="text-2xl font-black text-slate-900">{roles.length}</div>
          <span className="text-[11px] text-slate-500">ADMIN, STAFF, INSPECTOR, ...</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Tổng Quyền Chức Năng</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{permissions.length}</div>
          <span className="text-[11px] text-slate-500">
            {permissions.filter((p) => p.systemPermission).length} cốt lõi • {permissions.filter((p) => !p.systemPermission).length} tùy biến
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Quyền Đang Gán ({selectedRoleCode})</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {selectedCodes.length} <span className="text-sm font-semibold text-slate-500">/ {permissions.length}</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Tỷ lệ phủ: {Math.round((selectedCodes.length / (permissions.length || 1)) * 100)}%
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Bảo Mật Vai Trò</span>
            {currentRole?.editable ? (
              <Unlock className="w-4 h-4 text-emerald-600" />
            ) : (
              <Lock className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="text-base font-bold text-slate-900 mt-1">
            {currentRole?.editable ? (
              <span className="text-emerald-700 flex items-center gap-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Cho phép tùy biến
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Cố định hệ thống
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">
            {currentRole?.editable ? 'Admin có thể gán/bỏ quyền' : 'Khóa cứng bảo vệ an toàn'}
          </span>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      {subTab === 'matrix' ? (
        /* ========================================================================= */
        /* SCREEN A: ROLE MATRIX VIEW (SPLIT LAYOUT)                                 */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Role Selector Deck (4 Cols) */}
          <div className="lg:col-span-4 space-y-3.5">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#24263e]" />
                <span>Danh Sách Vai Trò ({roles.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400">Chọn để cấu hình</span>
            </div>

            <div className="space-y-2.5">
              {roles.map((role) => {
                const isSelected = role.code === selectedRoleCode;
                const rMeta = ROLE_META_MAP[role.code] || {
                  title: role.name || role.code,
                  subtitle: role.description || '',
                  icon: Shield,
                  colorClass: 'text-slate-700',
                  accentBorder: 'border-l-slate-600',
                  badgeBg: 'bg-slate-100 text-slate-700 border-slate-200'
                };
                const IconComponent = rMeta.icon;
                const assignedCount = role.code === selectedRoleCode ? selectedCodes.length : (role.permissionCodes || []).length;
                const percent = Math.round((assignedCount / (permissions.length || 1)) * 100);

                return (
                  <div
                    key={role.code}
                    onClick={() => handleSelectRole(role)}
                    className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none relative ${
                      isSelected
                        ? 'bg-white border-[#24263e] shadow-md ring-2 ring-[#24263e]/10'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isSelected ? 'bg-[#24263e] text-white border-[#24263e]' : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">{rMeta.title}</span>
                            {!role.editable && (
                              <span title="Bảo mật cố định, không thể chỉnh sửa">
                                <Lock className="w-3 h-3 text-amber-500" />
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 font-semibold">{role.code}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          isSelected ? 'bg-[#24263e] text-white border-[#24263e]' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {assignedCount} quyền
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-1">{rMeta.subtitle}</p>

                    {/* Mini progress bar */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Độ phủ quyền: {percent}%</span>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isSelected ? 'bg-[#c34c36]' : 'bg-slate-400'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Safety policy note */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Quy tắc An Toàn Phân Quyền (RBAC)</span>
              </div>
              <p className="text-amber-800/90 leading-relaxed">
                • Vai trò <strong>ADMIN</strong> luôn có 100% quyền hệ thống và được khóa bảo vệ.<br />
                • Các vai trò nghiệp vụ (<strong>STAFF, INSPECTOR...</strong>) chỉ được cấp các quyền thuộc chính sách cho phép của vai trò đó.
              </p>
            </div>
          </div>

          {/* Right Column: Permission Matrix Control (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Active Role Banner */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#24263e] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <RoleIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      {roleMeta.title} ({selectedRoleCode})
                    </h3>
                    {currentRole?.editable ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Đang cấu hình
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Cố định (Không thể sửa)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{roleMeta.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenAuditModal(selectedRoleCode)}
                  disabled={isLoadingAudit}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nhật Ký</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveMatrix}
                  disabled={!currentRole?.editable || !hasUnsavedChanges || isSaving}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    !currentRole?.editable || !hasUnsavedChanges
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#c34c36] hover:bg-[#a63f2d] text-white shadow-md ring-2 ring-[#c34c36]/20'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu Ma Trận Quyền</span>
                </button>
              </div>
            </div>

            {/* Unsaved Changes Banner */}
            {hasUnsavedChanges && (
              <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in slide-in-from-top-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 font-black text-xs">
                    !
                  </span>
                  <div className="text-xs">
                    <strong className="font-bold">Bạn có thay đổi chưa lưu:</strong>{' '}
                    {addedCodes.length > 0 && (
                      <span className="text-emerald-700 font-bold mr-1.5">+{addedCodes.length} quyền gán mới</span>
                    )}
                    {removedCodes.length > 0 && (
                      <span className="text-rose-700 font-bold">-{removedCodes.length} quyền gỡ bỏ</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleResetChanges}
                    className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-[11px] font-bold text-amber-900 transition cursor-pointer"
                  >
                    Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMatrix}
                    disabled={isSaving}
                    className="px-3 py-1 rounded-lg bg-[#c34c36] hover:bg-[#a63f2d] text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
                  >
                    Lưu thay đổi ngay
                  </button>
                </div>
              </div>
            )}

            {/* Search and Filters Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên chức năng, mã quyền hoặc mô tả..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#c34c36] bg-slate-50 focus:bg-white transition"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Status Quick Filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                  <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        statusFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ASSIGNED')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        statusFilter === 'ASSIGNED'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Đã cấp ({selectedCodes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('UNASSIGNED')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        statusFilter === 'UNASSIGNED'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Chưa cấp
                    </button>
                  </div>
                </div>
              </div>

              {/* Module Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Chuyên mục:</span>
                <button
                  type="button"
                  onClick={() => setSelectedModuleFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedModuleFilter === 'ALL'
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Tất cả ({filteredPermissions.length})
                </button>
                {PERMISSION_MODULES.map((m) => {
                  const Icon = m.icon;
                  const countInMod = permissions.filter((p) => getPermModule(p.code) === m.id).length;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedModuleFilter(m.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        selectedModuleFilter === m.id
                          ? 'bg-[#24263e] text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{m.name}</span>
                      <span className="opacity-70 text-[10px]">({countInMod})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grouped Permission Accordion / Sections */}
            <div className="space-y-4">
              {PERMISSION_MODULES.map((mod) => {
                const groupPerms = groupedPermissions[mod.id] || [];
                if (groupPerms.length === 0) return null;

                const assignedInGroup = groupPerms.filter((p) => selectedCodes.includes(p.code)).length;
                const ModIcon = mod.icon;
                const isGroupFullyAssigned = assignedInGroup === groupPerms.length && groupPerms.length > 0;

                return (
                  <div
                    key={mod.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
                  >
                    {/* Module Header */}
                    <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{ backgroundColor: `${mod.color}15`, color: mod.color, borderColor: `${mod.color}30` }}
                        >
                          <ModIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                              {mod.name}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-200 text-slate-700">
                              {assignedInGroup}/{groupPerms.length} quyền
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 hidden sm:block">{mod.description}</p>
                        </div>
                      </div>

                      {/* Group Quick Actions */}
                      {currentRole?.editable && (
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleSelectAllInGroup(groupPerms)}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 transition cursor-pointer"
                          >
                            + Chọn tất cả
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeselectAllInGroup(groupPerms)}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-300 transition cursor-pointer"
                          >
                            - Bỏ chọn
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Permission Cards Grid */}
                    <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {groupPerms.map((perm) => {
                        const isChecked = selectedCodes.includes(perm.code);
                        const isAssignable = perm.assignableRoles?.includes(selectedRoleCode);
                        const canToggle = currentRole?.editable && isAssignable;
                        const viMeta = PERMISSION_METADATA_VI[perm.code];
                        const displayName = viMeta?.name || perm.name || perm.code;
                        const displayDesc = viMeta?.desc || perm.description || 'Chức năng hệ thống';

                        return (
                          <div
                            key={perm.code}
                            onClick={() => {
                              if (canToggle) handleTogglePermission(perm.code);
                            }}
                            className={`p-3 rounded-xl border-2 transition-all flex items-start gap-3 select-none ${
                              isChecked
                                ? 'bg-emerald-50/40 border-emerald-400 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            } ${canToggle ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
                          >
                            {/* Toggle Switch */}
                            <div className="pt-0.5 shrink-0">
                              <div
                                className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                                  isChecked ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                                }`}
                              >
                                <div className="w-4 h-4 rounded-full bg-white shadow-xs transition-transform" />
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className={`text-xs font-bold ${isChecked ? 'text-emerald-950' : 'text-slate-800'}`}>
                                  {displayName}
                                </span>
                                {perm.systemPermission && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                                    CORE
                                  </span>
                                )}
                              </div>

                              <div className="mt-0.5">
                                <span className="font-mono text-[10px] text-slate-500 font-semibold block truncate">
                                  {perm.code}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                {displayDesc}
                              </p>

                              {/* Policy notice if not assignable */}
                              {!isAssignable && (
                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>Không áp dụng cho vai trò này theo chính sách</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredPermissions.length === 0 && (
                <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 space-y-2">
                  <Search className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-xs font-bold">Không tìm thấy quyền chức năng nào phù hợp với bộ lọc</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedModuleFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* SCREEN B: PERMISSION CATALOG VIEW (DICTIONARY & CUSTOM PERMISSIONS)        */
        /* ========================================================================= */
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Từ Điển & Danh Mục Toàn Bộ Quyền Hệ Thống
              </h3>
              <p className="text-xs text-slate-500">
                Toàn bộ {permissions.length} mã quyền endpoint đã được đăng ký và chính sách phân bổ cho các vai trò
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Quyền Mới (Custom Permission)</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-md w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã quyền, tên quyền..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedModuleFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedModuleFilter === 'ALL'
                    ? 'bg-[#24263e] text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                Tất cả ({permissions.length})
              </button>
              {PERMISSION_MODULES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModuleFilter(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedModuleFilter === m.id
                      ? 'bg-[#24263e] text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-[11px] font-bold">
                  <th className="py-3 px-4">Mã Quyền (Code)</th>
                  <th className="py-3 px-4">Tên Chức Năng Tiếng Việt</th>
                  <th className="py-3 px-4">Chuyên Mục</th>
                  <th className="py-3 px-4">Mô Tả Chi Tiết</th>
                  <th className="py-3 px-4">Vai Trò Được Phép Gán</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPermissions.map((perm) => {
                  const viMeta = PERMISSION_METADATA_VI[perm.code];
                  const modId = getPermModule(perm.code);
                  const mod = PERMISSION_MODULES.find((m) => m.id === modId);

                  return (
                    <tr key={perm.code} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{perm.code}</span>
                          {perm.systemPermission ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              CORE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                              CUSTOM
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800">
                        {viMeta?.name || perm.name}
                      </td>

                      <td className="py-3 px-4">
                        {mod && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${mod.badgeClass}`}>
                            {mod.name}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs leading-relaxed">
                        {viMeta?.desc || perm.description || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(perm.assignableRoles || []).map((r) => (
                            <span
                              key={r}
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
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
                            onClick={() => handleOpenEdit(perm)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                          >
                            Sửa
                          </button>
                          {!perm.systemPermission && (
                            <button
                              type="button"
                              onClick={() => handleDeletePermission(perm.code)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                            >
                              Xóa
                            </button>
                          )}
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

      {/* ========================================================================= */}
      {/* MODAL 1: AUDIT LOG (NHẬT KÝ THAY ĐỔI PHÂN QUYỀN VAI TRÒ)                  */}
      {/* ========================================================================= */}
      {auditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Nhật Ký Thay Đổi Quyền: {auditModal.roleCode}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Lịch sử phân bổ và thu hồi quyền hạn qua API RBAC
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditModal(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {auditModal.items.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  Chưa có lịch sử thay đổi quyền cho vai trò này.
                </div>
              ) : (
                auditModal.items.map((item, idx) => (
                  <div key={item.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Thực hiện bởi: <strong className="text-[#24263e]">{item.changedBy || 'Admin'}</strong>
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {item.changedAt ? new Date(item.changedAt).toLocaleString('vi-VN') : '—'}
                      </span>
                    </div>

                    {item.grantedPermissions && item.grantedPermissions.length > 0 && (
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                        <span className="font-bold text-emerald-800 block mb-1">Quyền được cấp mới (Granted):</span>
                        <div className="flex flex-wrap gap-1">
                          {item.grantedPermissions.map((p, i) => (
                            <span key={i} className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                              +{p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.revokedPermissions && item.revokedPermissions.length > 0 && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-100">
                        <span className="font-bold text-rose-800 block mb-1">Quyền bị thu hồi (Revoked):</span>
                        <div className="flex flex-wrap gap-1">
                          {item.revokedPermissions.map((p, i) => (
                            <span key={i} className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-mono text-[10px]">
                              -{p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditModal(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT PERMISSION                                                  */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingPerm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">
                Chỉnh Sửa Thông Tin Quyền: {editingPerm.code}
              </h4>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mã Quyền (Code)</label>
                <input
                  type="text"
                  value={editingPerm.code}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên Hiển Thị Chức Năng</label>
                <input
                  type="text"
                  value={editingPerm.name}
                  onChange={(e) => setEditingPerm({ ...editingPerm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#c34c36] outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mô Tả Quyền Hạn</label>
                <textarea
                  rows={3}
                  value={editingPerm.description || ''}
                  onChange={(e) => setEditingPerm({ ...editingPerm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#c34c36] outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-4 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Cập Nhật</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE CUSTOM PERMISSION                                         */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleCreatePermission}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">
                Thêm Quyền Chức Năng Mới (Custom Permission)
              </h4>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mã Quyền (Code in UPPERCASE) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Vd: STAFF_EXPORT_REPORT"
                  value={createForm.code}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      code: e.target.value.toUpperCase().replace(/\s+/g, '_')
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#c34c36] outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên Hiển Thị <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Vd: Xuất báo cáo nhân viên"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#c34c36] outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mô Tả Chức Năng</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả quyền hạn này cho phép thực hiện hành động gì..."
                  value={createForm.description || ''}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#c34c36] outline-none resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Các Vai Trò Được Phép Gán Quyền Này:
                </label>
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  {roles.map((r) => {
                    const checked = createForm.assignableRoles.includes(r.code);
                    return (
                      <label key={r.code} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setCreateForm((prev) => ({
                              ...prev,
                              assignableRoles: checked
                                ? prev.assignableRoles.filter((code) => code !== r.code)
                                : [...prev.assignableRoles, r.code]
                            }));
                          }}
                          className="w-4 h-4 rounded text-[#c34c36] focus:ring-[#c34c36]"
                        />
                        <span>{r.code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Tạo Quyền</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
