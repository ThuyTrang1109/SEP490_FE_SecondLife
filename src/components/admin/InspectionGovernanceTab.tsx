import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Navigation,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit2,
  Save,
  X,
  ShieldCheck,
  Check,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
  AlertTriangle,
  Info,
  CheckSquare,
  Layers,
  Boxes,
  HelpCircle,
  Search,
  SlidersHorizontal,
  RotateCcw,
  Tag,
  DollarSign,
  Filter,
  Loader2,
  Clock,
  MapPin,
  History,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  User
} from 'lucide-react';
import {
  Language,
  InspectionComplexityLevel,
  InspectionChecklistStatus,
  InspectionChecklistSearchParams,
  InspectionChecklistPricingResponse,
  InspectionCenter,
  CategoryBackend,
  ItemBackend
} from '../../types';
import { formatVND } from '../../utils/translations';
import { categoryService } from '../../services/categoryService';
import { itemService } from '../../services/itemService';
import {
  inspectorService,
  InspectionFeeProposalResponse,
  InspectionTravelTierDto,
  InspectionFeeProposalStatus,
  InspectionChecklistResponse,
  InspectionReturnShippingPolicyHistoryItem,
  canManageInspectionFee
} from '../../services/inspectorService';

interface InspectionGovernanceTabProps {
  lang: Language;
  currentUser?: any;
}

export const InspectionGovernanceTab: React.FC<InspectionGovernanceTabProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'checklist_proposals' | 'proposals' | 'travel_tiers' | 'return_shipping_policy' | 'high_value_policy'>('checklist_proposals');

  // Return Shipping Reserve Policy state
  const [policyMarkupPercentage, setPolicyMarkupPercentage] = useState<number>(20);
  const [inputMarkupPercentage, setInputMarkupPercentage] = useState<string>('20');
  const [isEditingPolicy, setIsEditingPolicy] = useState<boolean>(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState<boolean>(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState<boolean>(false);
  const [policyValidationError, setPolicyValidationError] = useState<string | null>(null);

  // Return Shipping Policy History state
  const [policyHistory, setPolicyHistory] = useState<InspectionReturnShippingPolicyHistoryItem[]>([]);
  const [isLoadingPolicyHistory, setIsLoadingPolicyHistory] = useState<boolean>(false);
  const [policyHistoryPage, setPolicyHistoryPage] = useState<number>(0);
  const [policyHistoryTotalPages, setPolicyHistoryTotalPages] = useState<number>(1);
  const [policyHistoryTotalElements, setPolicyHistoryTotalElements] = useState<number>(0);

  // High Value Policy state (Ngưỡng giá bắt buộc kiểm định trước khi đăng)
  const [thresholdPrice, setThresholdPrice] = useState<number>(10000000);
  const [inputThresholdPrice, setInputThresholdPrice] = useState<string>('10000000');
  const [isEditingThreshold, setIsEditingThreshold] = useState<boolean>(false);
  const [isLoadingThreshold, setIsLoadingThreshold] = useState<boolean>(false);
  const [isSavingThreshold, setIsSavingThreshold] = useState<boolean>(false);
  const [thresholdValidationError, setThresholdValidationError] = useState<string | null>(null);
  const [thresholdVersion, setThresholdVersion] = useState<number>(1);

  // Checklist Proposals state (Item + Level L1-L4 + Search + Pricing)
  const [checklistProposals, setChecklistProposals] = useState<InspectionChecklistResponse[]>([]);
  const [isLoadingChecklistProposals, setIsLoadingChecklistProposals] = useState(false);
  const [checklistPage, setChecklistPage] = useState(0);
  const [checklistTotalPages, setChecklistTotalPages] = useState(1);
  const [checklistTotalElements, setChecklistTotalElements] = useState(0);

  // Search & Filter state for Checklist
  const [checklistKeyword, setChecklistKeyword] = useState('');
  const [checklistStatusFilter, setChecklistStatusFilter] = useState<'ALL' | string>('ALL');
  const [checklistComplexityFilter, setChecklistComplexityFilter] = useState<'ALL' | InspectionComplexityLevel>('ALL');
  const [checklistCategoryFilter, setChecklistCategoryFilter] = useState<string>('ALL');
  const [checklistItemFilter, setChecklistItemFilter] = useState<string>('ALL');
  const [checklistCenterFilter, setChecklistCenterFilter] = useState<string>('ALL');
  const [checklistActiveFilter, setChecklistActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Metadata catalogs
  const [categories, setCategories] = useState<CategoryBackend[]>([]);
  const [items, setItems] = useState<ItemBackend[]>([]);
  const [centers, setCenters] = useState<InspectionCenter[]>([]);

  const loadReturnShippingPolicy = useCallback(async () => {
    setIsLoadingPolicy(true);
    try {
      const res = await inspectorService.getReturnShippingPolicy();
      const val = typeof res?.markupPercentage === 'number' ? res.markupPercentage : 20;
      setPolicyMarkupPercentage(val);
      setInputMarkupPercentage(String(val));
    } catch (err) {
      console.warn('Failed to load return shipping policy:', err);
    } finally {
      setIsLoadingPolicy(false);
    }
  }, []);

  const loadReturnShippingPolicyHistory = useCallback(async (targetPage = 0) => {
    setIsLoadingPolicyHistory(true);
    try {
      const res = await inspectorService.getReturnShippingPolicyHistory(targetPage, 10);
      setPolicyHistory(res.items || []);
      setPolicyHistoryPage(res.page || 0);
      setPolicyHistoryTotalPages(res.totalPages || 1);
      setPolicyHistoryTotalElements(res.totalElements || 0);
    } catch (err) {
      console.warn('Failed to load return shipping policy history:', err);
    } finally {
      setIsLoadingPolicyHistory(false);
    }
  }, []);

  // Fetch return shipping policy when subtab selected or on mount
  useEffect(() => {
    if (activeSubTab === 'return_shipping_policy') {
      setIsEditingPolicy(false);
      setPolicyValidationError(null);
      loadReturnShippingPolicy();
      loadReturnShippingPolicyHistory(0);
    } else if (activeSubTab === 'high_value_policy') {
      setIsEditingThreshold(false);
      setThresholdValidationError(null);
      setIsLoadingThreshold(true);
      inspectorService.getAdminHighValueInspectionPolicy()
        .then((res) => {
          const val = typeof res?.thresholdPrice === 'number' && res.thresholdPrice > 0 ? res.thresholdPrice : 10000000;
          setThresholdPrice(val);
          setInputThresholdPrice(String(val));
          if (res?.version) setThresholdVersion(res.version);
        })
        .catch((err) => {
          console.warn('Failed to load high value inspection policy:', err);
        })
        .finally(() => {
          setIsLoadingThreshold(false);
        });
    }
  }, [activeSubTab, loadReturnShippingPolicy, loadReturnShippingPolicyHistory]);

  const handleSavePolicy = async () => {
    setPolicyValidationError(null);
    const trimmed = inputMarkupPercentage.trim().replace(',', '.');
    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0 || num > 100) {
      setPolicyValidationError('Tỷ lệ dự phòng phải là số từ 0 đến 100%.');
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setPolicyValidationError('Tỷ lệ dự phòng tối đa 2 chữ số thập phân (ví dụ: 15.5 hoặc 20).');
      return;
    }
    setIsSavingPolicy(true);
    try {
      const res = await inspectorService.updateReturnShippingPolicy(num);
      const updatedVal = typeof res?.markupPercentage === 'number' ? res.markupPercentage : num;
      setPolicyMarkupPercentage(updatedVal);
      setInputMarkupPercentage(String(updatedVal));
      setIsEditingPolicy(false);
      setFeedback({
        type: 'success',
        message: `Đã lưu thành công tỷ lệ dự phòng cước trả hàng kiểm định: ${updatedVal}%. Thay đổi sẽ áp dụng khi lấy báo giá mới.`
      });
      loadReturnShippingPolicyHistory(0);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Không thể lưu tỷ lệ dự phòng cước trả hàng.'
      });
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const handleSaveThreshold = async () => {
    setThresholdValidationError(null);
    const trimmed = inputThresholdPrice.trim().replace(/\D/g, '');
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num <= 0) {
      setThresholdValidationError('Ngưỡng giá bắt buộc kiểm định phải là số tiền VND lớn hơn 0.');
      return;
    }

    setIsSavingThreshold(true);
    try {
      const res = await inspectorService.updateAdminHighValueInspectionPolicy(num);
      const updatedVal = typeof res?.thresholdPrice === 'number' ? res.thresholdPrice : num;
      setThresholdPrice(updatedVal);
      setInputThresholdPrice(String(updatedVal));
      if (res?.version) setThresholdVersion(res.version);
      setIsEditingThreshold(false);
      setFeedback({
        type: 'success',
        message: `Đã lưu thành công ngưỡng giá bắt buộc kiểm định: ${formatVND(updatedVal)}. Sản phẩm có giá cao hơn ngưỡng này phải kiểm định trước khi đăng.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Không thể lưu ngưỡng giá kiểm định.'
      });
    } finally {
      setIsSavingThreshold(false);
    }
  };

  // Selected Checklist Proposal for Detail Modal
  const [viewingChecklistProposal, setViewingChecklistProposal] = useState<InspectionChecklistResponse | null>(null);

  // Review Checklist Modal state
  const [isReviewChecklistModalOpen, setIsReviewChecklistModalOpen] = useState(false);
  const [reviewingChecklist, setReviewingChecklist] = useState<InspectionChecklistResponse | null>(null);
  const [checklistReviewAction, setChecklistReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [checklistReviewReason, setChecklistReviewReason] = useState('');
  const [isSubmittingChecklistReview, setIsSubmittingChecklistReview] = useState(false);
  const [checklistReviewError, setChecklistReviewError] = useState<string | null>(null);

  // Permissions
  const hasFeeManagePermission = canManageInspectionFee(currentUser);
  const hasAdminConfigPermission = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toUpperCase();
    if (role === 'ADMIN') {
      const authorities: string[] = Array.isArray(currentUser.authorities)
        ? currentUser.authorities.map((a: any) => (typeof a === 'string' ? a : a.authority || ''))
        : Array.isArray(currentUser.permissions)
          ? currentUser.permissions
          : [];
      if (authorities.length === 0) return true;
      return authorities.includes('ADMIN_CONFIG_MANAGE') || authorities.includes('ROLE_ADMIN');
    }
    return false;
  }, [currentUser]);

  // Proposals state
  const [proposals, setProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [proposalStatusFilter, setProposalStatusFilter] = useState<'ALL' | InspectionFeeProposalStatus>('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [feeProposalTotal, setFeeProposalTotal] = useState<number>(0);
  const [travelProposalTotal, setTravelProposalTotal] = useState<number>(0);
  const [proposalBranchFilter, setProposalBranchFilter] = useState<'ALL' | 'HCM' | 'HANOI'>('ALL');
  const [travelBranchFilter, setTravelBranchFilter] = useState<'ALL' | 'HCM' | 'HANOI'>('ALL');
  const pageSize = 10;

  // Selected Proposal for Details & Diff View
  const [viewingProposal, setViewingProposal] = useState<InspectionFeeProposalResponse | null>(null);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<InspectionFeeProposalResponse | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Travel tiers state
  const [travelTiers, setTravelTiers] = useState<InspectionTravelTierDto[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);

  // Active applied pricing state (Bảng giá đang áp dụng tại các trung tâm)
  const [approvedFeeProposals, setApprovedFeeProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [approvedTravelProposals, setApprovedTravelProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [isLoadingActivePricing, setIsLoadingActivePricing] = useState<boolean>(false);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const loadActivePricing = useCallback(async () => {
    setIsLoadingActivePricing(true);
    try {
      const [feeRes, travelRes] = await Promise.allSettled([
        inspectorService.getAdminFeeProposals('APPROVED', 0, 50, false),
        inspectorService.getAdminFeeProposals('APPROVED', 0, 50, true),
      ]);
      if (feeRes.status === 'fulfilled') {
        setApprovedFeeProposals(feeRes.value.items || []);
      }
      if (travelRes.status === 'fulfilled') {
        setApprovedTravelProposals(travelRes.value.items || []);
      }
    } catch (err) {
      console.warn('Failed to load active pricing:', err);
    } finally {
      setIsLoadingActivePricing(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch
    inspectorService
      .getInspectionCenters(true)
      .then((loadedCenters) => {
        setCenters(loadedCenters);
        loadChecklistProposals(0, undefined, loadedCenters);
      })
      .catch(() => {
        loadChecklistProposals(0);
      });
    loadProposals(0, 'ALL', false);
    loadTravelTiers();
    loadActivePricing();

    // Fetch proposal counts for badges
    inspectorService.getAdminFeeProposals('ALL', 0, 1, false)
      .then((res) => setFeeProposalTotal(res.totalElements || 0))
      .catch(() => {});
    inspectorService.getAdminFeeProposals('ALL', 0, 1, true)
      .then((res) => setTravelProposalTotal(res.totalElements || 0))
      .catch(() => {});

    // Fetch catalogs for filters
    categoryService.getCategories().then(setCategories).catch(() => { });
    itemService.getItems().then(setItems).catch(() => { });
  }, [loadActivePricing]);

  // Filter items based on selected category
  const availableItems = useMemo(() => {
    if (checklistCategoryFilter === 'ALL') return items;
    return items.filter((i) => i.categoryId === checklistCategoryFilter);
  }, [items, checklistCategoryFilter]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    return [
      checklistKeyword.trim() !== '',
      checklistStatusFilter !== 'ALL',
      checklistComplexityFilter !== 'ALL',
      checklistCategoryFilter !== 'ALL',
      checklistItemFilter !== 'ALL',
      checklistCenterFilter !== 'ALL',
      checklistActiveFilter !== 'ALL',
    ].filter(Boolean).length;
  }, [
    checklistKeyword,
    checklistStatusFilter,
    checklistComplexityFilter,
    checklistCategoryFilter,
    checklistItemFilter,
    checklistCenterFilter,
    checklistActiveFilter,
  ]);

  // Helper dịch trạng thái phê duyệt bộ tiêu chuẩn sang tiếng Việt
  const getApprovalStatusLabel = (status?: string | null) => {
    if (!status) return '—';
    switch (status) {
      case 'PENDING_APPROVAL':
      case 'PENDING':
        return 'Chờ duyệt';
      case 'APPROVED':
        return 'Đã duyệt';
      case 'REJECTED':
        return 'Đã từ chối';
      case 'WITHDRAWN':
        return 'Đã rút';
      case 'LEGACY':
        return 'Bản cũ (hệ thống)';
      default:
        return status;
    }
  };

  // Helper dịch lý do chưa áp dụng sang tiếng Việt
  const getUnavailableReasonLabel = (reason?: string | null) => {
    if (!reason) return '';
    switch (reason) {
      case 'CHECKLIST_NOT_EFFECTIVE':
        return 'Bộ tiêu chuẩn chưa có hiệu lực';
      case 'NO_APPROVED_LEVEL_FEE':
        return 'Chưa duyệt biểu phí cấp độ';
      case 'ITEM_NOT_CLASSIFIED':
        return 'Chưa phân cấp thiết bị';
      case 'CENTER_UNAVAILABLE':
        return 'Trung tâm tạm ngừng hoạt động';
      case 'ITEM_NOT_SELECTABLE':
        return 'Thiết bị ngừng hỗ trợ';
      default:
        return reason;
    }
  };

  // Helper chuẩn hóa tiếng Việt để so sánh chính xác tuyệt đối
  const normalizeVN = (str?: string | null) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const isHcmText = (str?: string | null) => {
    if (!str) return false;
    const s = normalizeVN(str);
    return (
      s.includes('ho chi minh') ||
      s.includes('hcm') ||
      s.includes('sai gon') ||
      s.includes('saigon') ||
      s.includes('tp.hcm') ||
      s.includes('tphcm')
    );
  };

  const isHanoiText = (str?: string | null) => {
    if (!str) return false;
    const s = normalizeVN(str);
    return s.includes('ha noi') || s.includes('hanoi') || s.includes('hn');
  };

  // Nhận diện trung tâm Hà Nội và TP. Hồ Chí Minh từ danh mục trung tâm
  const hanoiCenter = useMemo(() => {
    return centers.find(
      (c) => isHanoiText(c.city) || isHanoiText(c.name) || isHanoiText(c.address)
    );
  }, [centers]);

  const hcmCenter = useMemo(() => {
    return centers.find(
      (c) => isHcmText(c.city) || isHcmText(c.name) || isHcmText(c.address)
    );
  }, [centers]);

  const otherCenters = useMemo(() => {
    return centers.filter((c) => c.id !== hanoiCenter?.id && c.id !== hcmCenter?.id);
  }, [centers, hanoiCenter, hcmCenter]);

  // Hàm trích xuất và hiển thị tên rõ ràng của trung tâm gửi đề xuất biểu phí
  const getProposalCenterInfo = useCallback(
    (proposal?: InspectionFeeProposalResponse | null) => {
      if (!proposal) {
        return {
          name: 'Trung tâm kiểm định',
          email: '',
          areaBadge: '',
          address: undefined as string | null | undefined,
          isHcm: false,
          isHanoi: false,
          branchKey: 'OTHER' as const,
        };
      }

      // 0. Nhận diện ưu tiên tuyệt đối dựa theo ID cố định và email hệ thống
      const pid = (proposal.proposedById || '').toLowerCase();
      const pEmail = (proposal.proposedByEmail || proposal.proposedByName || '').toLowerCase();
      const isKnownHanoi =
        pid === 'e844ef8a-6558-40ce-9ec7-28414d2ef701' ||
        pEmail.includes('center2') ||
        pEmail.includes('hanoi') ||
        pEmail.includes('hn');
      const isKnownHcm =
        pid === 'f5bd185b-0cf2-4e79-acb8-d9c1fdadc5ad' ||
        (pEmail.includes('center@') && !pEmail.includes('center2')) ||
        pEmail.includes('hcm') ||
        pEmail.includes('saigon');

      if (isKnownHanoi) {
        return {
          name: hanoiCenter?.name || 'Trung Tâm Kiểm Định SecondLife Hà Nội',
          email: proposal.proposedByEmail || (proposal.proposedByName?.includes('@') ? proposal.proposedByName : 'center2@secondlife.com'),
          areaBadge: 'Hà Nội',
          address: hanoiCenter?.address || 'Khu Công nghệ cao Hòa Lạc, Km29 Đại lộ Thăng Long, Hà Nội',
          isHcm: false,
          isHanoi: true,
          branchKey: 'HANOI' as const,
        };
      }
      if (isKnownHcm) {
        return {
          name: hcmCenter?.name || 'Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh',
          email: proposal.proposedByEmail || (proposal.proposedByName?.includes('@') ? proposal.proposedByName : 'center@secondlife.com'),
          areaBadge: 'TP. HCM',
          address: hcmCenter?.address || 'Công Ty TNHH Gianty, Đường B4, Phường An Khánh, TP. Thủ Đức, TP. HCM',
          isHcm: true,
          isHanoi: false,
          branchKey: 'HCM' as const,
        };
      }

      // 1. Tìm trong danh mục centers theo proposedById (User ID)
      let matched = proposal.proposedById
        ? centers.find((c) => c.id && c.id.toLowerCase() === proposal.proposedById?.toLowerCase())
        : null;

      // 2. Nếu không thấy theo ID, tìm theo tên nếu proposedByName không phải là email
      if (!matched && proposal.proposedByName && !proposal.proposedByName.includes('@')) {
        matched = centers.find(
          (c) => c.name && normalizeVN(c.name) === normalizeVN(proposal.proposedByName || '')
        );
      }

      // 3. Nếu tìm thấy trung tâm tương ứng trong hệ thống
      if (matched) {
        const isHcm = isHcmText(matched.city) || isHcmText(matched.name) || isHcmText(matched.address);
        const isHanoi = isHanoiText(matched.city) || isHanoiText(matched.name) || isHanoiText(matched.address);
        return {
          name: matched.name,
          email: proposal.proposedByEmail || (proposal.proposedByName?.includes('@') ? proposal.proposedByName : ''),
          areaBadge: isHcm ? 'TP. HCM' : isHanoi ? 'Hà Nội' : matched.city || '',
          address: matched.address,
          isHcm,
          isHanoi,
          branchKey: isHcm ? ('HCM' as const) : isHanoi ? ('HANOI' as const) : ('OTHER' as const),
        };
      }

      // 4. Nếu proposedByName là tên thật (không chứa ký tự @ của email)
      if (proposal.proposedByName && !proposal.proposedByName.includes('@')) {
        const isHcm = isHcmText(proposal.proposedByName);
        const isHanoi = isHanoiText(proposal.proposedByName);
        return {
          name: proposal.proposedByName,
          email: proposal.proposedByEmail || '',
          areaBadge: isHcm ? 'TP. HCM' : isHanoi ? 'Hà Nội' : '',
          address: undefined as string | null | undefined,
          isHcm,
          isHanoi,
          branchKey: isHcm ? ('HCM' as const) : isHanoi ? ('HANOI' as const) : ('OTHER' as const),
        };
      }

      // 5. Suy luận dựa trên email và danh mục trung tâm sẵn có
      const rawEmail = (proposal.proposedByEmail || proposal.proposedByName || '').toLowerCase();
      if (rawEmail.includes('hanoi') || rawEmail.includes('center2') || rawEmail.includes('hn')) {
        return {
          name: hanoiCenter?.name || 'Trung Tâm Kiểm Định SecondLife Hà Nội',
          email: proposal.proposedByEmail || proposal.proposedByName || '',
          areaBadge: 'Hà Nội',
          address: hanoiCenter?.address,
          isHcm: false,
          isHanoi: true,
          branchKey: 'HANOI' as const,
        };
      }

      if (hcmCenter || rawEmail.includes('hcm') || rawEmail.includes('center@') || rawEmail.includes('sg')) {
        return {
          name: hcmCenter?.name || 'Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh',
          email: proposal.proposedByEmail || proposal.proposedByName || '',
          areaBadge: 'TP. HCM',
          address: hcmCenter?.address,
          isHcm: true,
          isHanoi: false,
          branchKey: 'HCM' as const,
        };
      }

      if (centers.length > 0) {
        const isHcm = isHcmText(centers[0].city) || isHcmText(centers[0].name);
        const isHanoi = isHanoiText(centers[0].city) || isHanoiText(centers[0].name);
        return {
          name: centers[0].name,
          email: proposal.proposedByEmail || proposal.proposedByName || '',
          areaBadge: centers[0].city || '',
          address: centers[0].address,
          isHcm,
          isHanoi,
          branchKey: isHcm ? ('HCM' as const) : isHanoi ? ('HANOI' as const) : ('OTHER' as const),
        };
      }

      return {
        name: 'Trung Tâm Kiểm Định SecondLife',
        email: proposal.proposedByEmail || proposal.proposedByName || '',
        areaBadge: '',
        address: undefined as string | null | undefined,
        isHcm: false,
        isHanoi: false,
        branchKey: 'OTHER' as const,
      };
    },
    [centers, hcmCenter, hanoiCenter]
  );

  const isHanoiActive =
    checklistCenterFilter === 'HANOI' || (Boolean(hanoiCenter) && checklistCenterFilter === hanoiCenter?.id);
  const isHcmActive =
    checklistCenterFilter === 'HCM' || (Boolean(hcmCenter) && checklistCenterFilter === hcmCenter?.id);

  const getCenterDetails = useCallback(
    (chk: InspectionChecklistResponse) => {
      const centerId = chk.pricing?.inspectionCenterId || chk.createdById;
      const centerNameFromPricing = chk.pricing?.inspectionCenterName;

      // Tìm matchedCenter trong danh mục centers
      const matchedCenter = centers.find(
        (c) =>
          (centerId && c.id && c.id.toLowerCase() === centerId.toLowerCase()) ||
          (centerNameFromPricing && c.name && normalizeVN(c.name) === normalizeVN(centerNameFromPricing))
      );

      // Tổng hợp mọi văn bản liên quan đến trung tâm này
      const checkTexts = [
        centerNameFromPricing,
        matchedCenter?.name,
        matchedCenter?.city,
        matchedCenter?.address,
      ].filter(Boolean) as string[];

      const isHcm =
        checkTexts.some(isHcmText) ||
        (Boolean(centerId) && Boolean(hcmCenter?.id) && centerId === hcmCenter?.id);
      const isHanoi =
        !isHcm &&
        (checkTexts.some(isHanoiText) ||
          (Boolean(centerId) && Boolean(hanoiCenter?.id) && centerId === hanoiCenter?.id));

      let areaTitle = '';
      let areaBadge = '';
      let fullName = '';

      if (isHcm) {
        areaTitle = 'Thành phố HCM';
        areaBadge = 'TP. HCM';
        fullName = matchedCenter?.name || centerNameFromPricing || 'Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh';
        const norm = normalizeVN(fullName);
        if (norm === 'trung tam kiem dinh' || norm === 'trung tam tac gia' || !fullName) {
          fullName = 'Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh';
        }
      } else if (isHanoi) {
        areaTitle = 'Hà Nội';
        areaBadge = 'Hà Nội';
        fullName = matchedCenter?.name || centerNameFromPricing || 'Trung Tâm Kiểm Định SecondLife Hà Nội';
        const norm = normalizeVN(fullName);
        if (norm === 'trung tam kiem dinh' || norm === 'trung tam tac gia' || !fullName) {
          fullName = 'Trung Tâm Kiểm Định SecondLife Hà Nội';
        }
      } else {
        areaTitle = matchedCenter?.city || matchedCenter?.name || centerNameFromPricing || 'Trung tâm';
        areaBadge = matchedCenter?.city || 'Khác';
        fullName = matchedCenter?.name || centerNameFromPricing || 'Trung Tâm Kiểm Định';
      }

      return {
        isHcm,
        isHanoi,
        areaTitle,
        areaBadge,
        cityName: areaTitle,
        fullName,
      };
    },
    [centers, hanoiCenter, hcmCenter]
  );

  /**
   * Tự động bù đắp thông tin định giá (pricing enrichment fallback)
   * nếu Backend chưa trả trường pricing (do Backend chưa restart hoặc API cũ).
   */
  const enrichChecklistPricing = async (
    itemsList: InspectionChecklistResponse[],
    knownCenters: InspectionCenter[]
  ): Promise<InspectionChecklistResponse[]> => {
    const needsEnrichment = itemsList.some((it) => !it.pricing);
    if (!needsEnrichment) return itemsList;

    try {
      const feeRes = await inspectorService.getAdminFeeProposals('ALL', 0, 100);
      const feeList: InspectionFeeProposalResponse[] = feeRes.items || [];
      const centerMap = new Map<string, string>();
      knownCenters.forEach((c) => centerMap.set(c.id, c.name));

      return itemsList.map((chk) => {
        if (chk.pricing) return chk;

        const centerId = chk.createdById;
        const level = chk.complexityLevel;
        let centerName = (centerId && centerMap.get(centerId)) || '';

        // Legacy / chưa phân cấp
        if (!chk.itemId || !level || chk.approvalStatus === 'LEGACY') {
          return {
            ...chk,
            pricing: {
              inspectionCenterId: centerId,
              inspectionCenterName: centerName || 'Trung Tâm Kiểm Định Chính',
              complexityLevel: level,
              baseInspectionFee: null,
              pendingBaseInspectionFee: null,
              priceStatus: 'LEGACY',
              applicable: false,
              unavailableReason: 'ITEM_NOT_CLASSIFIED',
            },
          };
        }

        const centerFees = feeList.filter(
          (f) => f.complexityLevel === level && (!centerId || f.proposedById === centerId)
        );

        if (!centerName && centerFees.length > 0) {
          const firstWithCenter = centerFees.find((f) => f.proposedByName || f.proposedByEmail);
          if (firstWithCenter) {
            centerName = firstWithCenter.proposedByName || firstWithCenter.proposedByEmail || '';
          }
        }

        const approved = centerFees
          .filter((f) => f.status === 'APPROVED')
          .sort(
            (a, b) =>
              new Date(b.reviewedAt || b.createdAt || 0).getTime() -
              new Date(a.reviewedAt || a.createdAt || 0).getTime()
          )[0];

        const pending = centerFees
          .filter((f) => f.status === 'PENDING' || f.status === 'PENDING_APPROVAL')
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];

        let priceStatus: any = 'NOT_CONFIGURED';
        let unavailableReason: string | null = null;
        let applicable = false;

        if (approved) {
          priceStatus = 'APPROVED';
          if (chk.approvalStatus === 'APPROVED' && chk.active) {
            applicable = true;
            unavailableReason = null;
          } else {
            applicable = false;
            unavailableReason = 'CHECKLIST_NOT_EFFECTIVE';
          }
        } else if (pending) {
          priceStatus = 'PENDING_APPROVAL';
          applicable = false;
          unavailableReason = 'NO_APPROVED_LEVEL_FEE';
        } else {
          priceStatus = 'NOT_CONFIGURED';
          applicable = false;
          unavailableReason = 'NO_APPROVED_LEVEL_FEE';
        }

        const pricing: InspectionChecklistPricingResponse = {
          inspectionCenterId: centerId,
          inspectionCenterName: centerName || 'Trung Tâm Kiểm Định Chính',
          complexityLevel: level,
          baseInspectionFee: approved ? approved.baseInspectionFee : null,
          feeProposalId: approved?.id,
          feeReviewedAt: approved?.reviewedAt,
          pendingBaseInspectionFee: pending ? pending.baseInspectionFee : null,
          pendingFeeProposalId: pending?.id,
          priceStatus,
          applicable,
          unavailableReason,
        };

        return { ...chk, pricing };
      });
    } catch (e) {
      console.warn('Failed to enrich checklist pricing fallback:', e);
      return itemsList;
    }
  };

  const loadChecklistProposals = async (
    targetPage: number = 0,
    overrideFilters?: Partial<InspectionChecklistSearchParams>,
    currentCenters?: InspectionCenter[]
  ) => {
    setIsLoadingChecklistProposals(true);
    try {
      const kw = overrideFilters?.keyword !== undefined ? overrideFilters.keyword : checklistKeyword;
      const st = overrideFilters?.status !== undefined ? overrideFilters.status : checklistStatusFilter;
      const lvl = overrideFilters?.complexityLevel !== undefined ? overrideFilters.complexityLevel : checklistComplexityFilter;
      const cat = overrideFilters?.categoryId !== undefined ? overrideFilters.categoryId : checklistCategoryFilter;
      const itm = overrideFilters?.itemId !== undefined ? overrideFilters.itemId : checklistItemFilter;
      const ctr = overrideFilters?.inspectionCenterId !== undefined ? overrideFilters.inspectionCenterId : checklistCenterFilter;
      const act = overrideFilters?.active !== undefined
        ? overrideFilters.active
        : checklistActiveFilter === 'ALL'
          ? undefined
          : checklistActiveFilter === 'ACTIVE';

      const searchStatus = st && st !== 'ALL' && st !== 'PENDING_APPROVAL' ? (st as any) : undefined;
      const searchParams: InspectionChecklistSearchParams = {
        keyword: kw && kw.trim() ? kw.trim().slice(0, 120) : undefined,
        status: searchStatus,
        complexityLevel: lvl && lvl !== 'ALL' ? (lvl as any) : undefined,
        categoryId: cat && cat !== 'ALL' ? cat : undefined,
        itemId: itm && itm !== 'ALL' ? itm : undefined,
        inspectionCenterId: ctr && ctr !== 'ALL' ? ctr : undefined,
        active: act,
        page: targetPage,
        size: pageSize,
        sort: 'createdAt,desc',
      };

      const data = await inspectorService.getAdminChecklistProposals(searchParams);
      const rawList = data.items || (Array.isArray(data) ? data : []);
      const enrichedList = await enrichChecklistPricing(rawList, currentCenters || centers);

      let finalList = enrichedList;
      if (st === 'PENDING_APPROVAL') {
        finalList = enrichedList.filter(
          (c) => c.approvalStatus === 'PENDING_APPROVAL' || c.pricing?.pendingBaseInspectionFee != null
        );
      } else if (st === 'APPROVED') {
        finalList = enrichedList.filter(
          (c) => c.approvalStatus === 'APPROVED' && !c.pricing?.pendingBaseInspectionFee
        );
      }

      if (ctr && ctr !== 'ALL') {
        finalList = finalList.filter((c) => {
          const info = getCenterDetails(c);
          if (ctr === 'HANOI' || (hanoiCenter && ctr === hanoiCenter.id)) {
            return (
              info.isHanoi ||
              Boolean(hanoiCenter && (c.createdById === hanoiCenter.id || c.pricing?.inspectionCenterId === hanoiCenter.id))
            );
          }
          if (ctr === 'HCM' || (hcmCenter && ctr === hcmCenter.id)) {
            return (
              info.isHcm ||
              Boolean(hcmCenter && (c.createdById === hcmCenter.id || c.pricing?.inspectionCenterId === hcmCenter.id))
            );
          }
          return c.createdById === ctr || c.pricing?.inspectionCenterId === ctr;
        });
      }

      setChecklistProposals(finalList);
      setChecklistTotalPages(st === 'PENDING_APPROVAL' || st === 'APPROVED' ? Math.ceil(finalList.length / pageSize) || 1 : (data.totalPages || 1));
      setChecklistTotalElements(st === 'PENDING_APPROVAL' || st === 'APPROVED' ? finalList.length : (data.totalElements || rawList.length));
      setChecklistPage(data.page || 0);
    } catch (err: any) {
      console.warn('Failed to load admin checklist proposals:', err);
      setChecklistProposals([]);
    } finally {
      setIsLoadingChecklistProposals(false);
    }
  };

  const handleSearchChecklist = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setChecklistPage(0);
    loadChecklistProposals(0);
  };

  const handleChecklistStatusFilterChange = (newStatus: string) => {
    setChecklistStatusFilter(newStatus);
    setChecklistPage(0);
    loadChecklistProposals(0, { status: newStatus as any });
  };

  const handleChecklistCenterFilterChange = (key: string) => {
    setChecklistCenterFilter(key);
    setChecklistPage(0);

    let inspectionCenterId: string | undefined = undefined;
    let keywordOverride: string | undefined = undefined;

    if (key === 'ALL') {
      inspectionCenterId = undefined;
    } else if (key === 'HANOI' || key === hanoiCenter?.id) {
      if (hanoiCenter?.id && /^[0-9a-fA-F-]{36}$/.test(hanoiCenter.id)) {
        inspectionCenterId = hanoiCenter.id;
      } else {
        keywordOverride = 'Hà Nội';
      }
    } else if (key === 'HCM' || key === hcmCenter?.id) {
      if (hcmCenter?.id && /^[0-9a-fA-F-]{36}$/.test(hcmCenter.id)) {
        inspectionCenterId = hcmCenter.id;
      } else {
        keywordOverride = 'Hồ Chí Minh';
      }
    } else {
      if (/^[0-9a-fA-F-]{36}$/.test(key)) {
        inspectionCenterId = key;
      } else {
        const found = centers.find((c) => c.id === key);
        keywordOverride = found?.name || key;
      }
    }

    loadChecklistProposals(0, {
      inspectionCenterId,
      keyword: keywordOverride ?? (checklistKeyword.trim() ? checklistKeyword.trim() : undefined),
    });
  };

  const handleResetChecklistFilters = () => {
    setChecklistKeyword('');
    setChecklistStatusFilter('ALL');
    setChecklistComplexityFilter('ALL');
    setChecklistCategoryFilter('ALL');
    setChecklistItemFilter('ALL');
    setChecklistCenterFilter('ALL');
    setChecklistActiveFilter('ALL');
    setChecklistPage(0);
    loadChecklistProposals(0, {
      keyword: '',
      status: 'ALL',
      complexityLevel: undefined,
      categoryId: undefined,
      itemId: undefined,
      inspectionCenterId: undefined,
      active: undefined,
    });
  };

  const handleChecklistPageChange = (newPage: number) => {
    setChecklistPage(newPage);
    loadChecklistProposals(newPage);
  };

  const handleOpenReviewChecklist = (chk: InspectionChecklistResponse, action: 'APPROVE' | 'REJECT') => {
    setReviewingChecklist(chk);
    setChecklistReviewAction(action);
    setChecklistReviewReason('');
    setChecklistReviewError(null);
    setIsReviewChecklistModalOpen(true);
  };

  const handleSubmitChecklistReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingChecklist) return;

    if (checklistReviewAction === 'REJECT' && !checklistReviewReason.trim()) {
      setChecklistReviewError('Vui lòng nhập lý do từ chối để trung tâm kiểm định có thể chỉnh sửa');
      return;
    }

    setIsSubmittingChecklistReview(true);
    setChecklistReviewError(null);
    try {
      await inspectorService.reviewChecklistProposal(reviewingChecklist.id, {
        approved: checklistReviewAction === 'APPROVE',
        reason: checklistReviewReason.trim() || undefined,
      });
      setFeedback({
        type: 'success',
        message: checklistReviewAction === 'APPROVE'
          ? `Đã phê duyệt bộ tiêu chuẩn "${reviewingChecklist.title}" thành công! Tiêu chuẩn này hiện đang áp dụng cho ${reviewingChecklist.itemName || 'thiết bị'}.`
          : `Đã từ chối đề xuất bộ tiêu chuẩn "${reviewingChecklist.title}".`,
      });
      setIsReviewChecklistModalOpen(false);
      setReviewingChecklist(null);
      if (viewingChecklistProposal?.id === reviewingChecklist.id) {
        setViewingChecklistProposal(null);
      }
      await loadChecklistProposals(checklistPage);
    } catch (err: any) {
      console.error('Lỗi duyệt đề xuất checklist:', err);
      // Nếu là lỗi Conflict (409) do đề xuất đã được xử lý trước đó, vẫn tự động làm mới bảng danh sách
      if (err?.message?.includes('đã được xử lý') || err?.status === 409) {
        setFeedback({
          type: 'warning',
          message: 'Đề xuất checklist này đã được xử lý trước đó. Hệ thống đã cập nhật danh sách mới nhất.',
        });
        setIsReviewChecklistModalOpen(false);
        setReviewingChecklist(null);
        if (viewingChecklistProposal?.id === reviewingChecklist.id) {
          setViewingChecklistProposal(null);
        }
        await loadChecklistProposals(checklistPage);
      } else {
        setChecklistReviewError(err?.message || 'Thao tác phê duyệt thất bại');
      }
    } finally {
      setIsSubmittingChecklistReview(false);
    }
  };

  const loadProposals = async (
    targetPage: number = 0,
    statusFilter: string = proposalStatusFilter,
    travelOnly: boolean = activeSubTab === 'travel_tiers'
  ) => {
    setIsLoadingProposals(true);
    try {
      const data = await inspectorService.getAdminFeeProposals(statusFilter, targetPage, pageSize, travelOnly);
      setProposals(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalElements || 0);
      setPage(data.page || 0);
      if (travelOnly) {
        setTravelProposalTotal(data.totalElements || 0);
      } else {
        setFeeProposalTotal(data.totalElements || 0);
      }
    } catch (err: any) {
      console.warn('Failed to load admin fee proposals:', err);
      setProposals([]);
    } finally {
      setIsLoadingProposals(false);
    }
  };

  const handleStatusFilterChange = (newStatus: 'ALL' | InspectionFeeProposalStatus) => {
    setProposalStatusFilter(newStatus);
    setPage(0);
    loadProposals(0, newStatus, activeSubTab === 'travel_tiers');
  };

  // Lọc tách biệt giữa đề xuất biểu phí cơ sở L1-L4 và đề xuất cước di chuyển
  const displayedProposals = useMemo(() => {
    return proposals.filter((p) => {
      const tierCount = p.tiers?.length ?? 0;
      const isTravelOnly = tierCount > 0 && !p.categoryId && !p.complexityLevel;
      if (activeSubTab === 'travel_tiers') {
        return isTravelOnly;
      }
      return !isTravelOnly;
    });
  }, [proposals, activeSubTab]);

  // Phân loại đề xuất theo 2 chi nhánh TP. HCM và Hà Nội
  const hcmFeeProposals = useMemo(() => {
    return displayedProposals.filter((p) => {
      const info = getProposalCenterInfo(p);
      return info.isHcm || info.branchKey === 'HCM';
    });
  }, [displayedProposals, getProposalCenterInfo]);

  const hanoiFeeProposals = useMemo(() => {
    return displayedProposals.filter((p) => {
      const info = getProposalCenterInfo(p);
      return info.isHanoi || info.branchKey === 'HANOI';
    });
  }, [displayedProposals, getProposalCenterInfo]);

  // Danh sách đề xuất biểu phí độ phức tạp hiển thị theo bộ lọc chi nhánh
  const visibleFeeProposals = useMemo(() => {
    if (proposalBranchFilter === 'HCM') return hcmFeeProposals;
    if (proposalBranchFilter === 'HANOI') return hanoiFeeProposals;
    return displayedProposals;
  }, [proposalBranchFilter, hcmFeeProposals, hanoiFeeProposals, displayedProposals]);

  // Phân loại đề xuất cước di chuyển theo chi nhánh
  const hcmTravelProposals = useMemo(() => {
    return displayedProposals.filter((p) => {
      const info = getProposalCenterInfo(p);
      return info.isHcm || info.branchKey === 'HCM';
    });
  }, [displayedProposals, getProposalCenterInfo]);

  const hanoiTravelProposals = useMemo(() => {
    return displayedProposals.filter((p) => {
      const info = getProposalCenterInfo(p);
      return info.isHanoi || info.branchKey === 'HANOI';
    });
  }, [displayedProposals, getProposalCenterInfo]);

  // Danh sách đề xuất cước di chuyển hiển thị theo bộ lọc chi nhánh
  const visibleTravelProposals = useMemo(() => {
    if (travelBranchFilter === 'HCM') return hcmTravelProposals;
    if (travelBranchFilter === 'HANOI') return hanoiTravelProposals;
    return displayedProposals;
  }, [travelBranchFilter, hcmTravelProposals, hanoiTravelProposals, displayedProposals]);

  // Lấy biểu phí độ phức tạp đang áp dụng của từng chi nhánh
  const getActiveLevelFees = useCallback(
    (branchKey: 'HCM' | 'HANOI') => {
      const levels: { key: InspectionComplexityLevel; name: string }[] = [
        { key: 'L1', name: 'Đơn giản (L1)' },
        { key: 'L2', name: 'Trung bình (L2)' },
        { key: 'L3', name: 'Phức tạp (L3)' },
        { key: 'L4', name: 'Rất phức tạp (L4)' },
      ];

      // Lọc các proposal đã duyệt của chi nhánh
      const centerApproved = approvedFeeProposals.filter((p) => {
        const info = getProposalCenterInfo(p);
        const matchBranch =
          branchKey === 'HCM'
            ? info.isHcm || info.branchKey === 'HCM'
            : info.isHanoi || info.branchKey === 'HANOI';
        return matchBranch && (p.status === 'APPROVED' || !p.status);
      });

      return levels.map((lvl) => {
        const matched = centerApproved.find((p) => p.complexityLevel === lvl.key);
        return {
          level: lvl.key,
          levelName: lvl.name,
          fee: matched?.baseInspectionFee,
          proposalId: matched?.id,
          approvedAt: matched?.reviewedAt || matched?.updatedAt || matched?.createdAt,
          isConfigured: matched?.baseInspectionFee != null && matched.baseInspectionFee > 0,
        };
      });
    },
    [approvedFeeProposals, getProposalCenterInfo]
  );

  // Lấy bảng 6 bậc thang cước di chuyển đang áp dụng của từng chi nhánh
  const getActiveTravelTiers = useCallback(
    (branchKey: 'HCM' | 'HANOI') => {
      // Kết hợp tất cả đề xuất cước di chuyển APPROVED đã tải từ hệ thống
      const allApproved = [
        ...approvedTravelProposals,
        ...proposals.filter((p) => p.status === 'APPROVED' && (p.tiers?.length ?? 0) > 0),
      ];
      // Loại bỏ trùng lặp id
      const uniqueApproved = Array.from(new Map(allApproved.map((p) => [p.id, p])).values());

      // Lọc các đề xuất cước thuộc chi nhánh yêu cầu
      const centerApproved = uniqueApproved.filter((p) => {
        const info = getProposalCenterInfo(p);
        const matchBranch =
          branchKey === 'HCM'
            ? info.isHcm || info.branchKey === 'HCM'
            : info.isHanoi || info.branchKey === 'HANOI';
        return matchBranch && (p.status === 'APPROVED' || !p.status) && p.tiers && p.tiers.length > 0;
      });

      // Sắp xếp đề xuất được Admin phê duyệt mới nhất lên đầu
      const sortedApproved = [...centerApproved].sort((a, b) => {
        const timeA = new Date(a.reviewedAt || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.reviewedAt || b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      const latestApproved = sortedApproved[0];

      if (latestApproved && latestApproved.tiers && latestApproved.tiers.length > 0) {
        return {
          hasCustomTiers: true,
          proposalId: latestApproved.id,
          approvedAt: latestApproved.reviewedAt || latestApproved.updatedAt || latestApproved.createdAt,
          tiers: latestApproved.tiers,
        };
      }

      // Nếu chi nhánh chưa có đề xuất cước riêng được duyệt, sử dụng bảng bậc thang mặc định của hệ thống
      return {
        hasCustomTiers: false,
        proposalId: null,
        approvedAt: null,
        tiers: travelTiers,
      };
    },
    [approvedTravelProposals, proposals, travelTiers, getProposalCenterInfo]
  );

  const loadTravelTiers = async () => {
    setIsLoadingTiers(true);
    try {
      const data = await inspectorService.getAdminTravelTiers();
      const fallbackTiers: InspectionTravelTierDto[] = [
        { tierNumber: 1, name: 'Bậc 1: Cự ly gần (0 - 5 km)', fromKm: 0, toKm: 5, pricePerKm: 20000, status: 'ACTIVE' },
        { tierNumber: 2, name: 'Bậc 2: Cự ly trung bình (5 - 15 km)', fromKm: 5, toKm: 15, pricePerKm: 30000, status: 'ACTIVE' },
        { tierNumber: 3, name: 'Bậc 3: Ngoại thành gần (15 - 25 km)', fromKm: 15, toKm: 25, pricePerKm: 40000, status: 'ACTIVE' },
        { tierNumber: 4, name: 'Bậc 4: Ngoại thành xa (25 - 40 km)', fromKm: 25, toKm: 40, pricePerKm: 50000, status: 'ACTIVE' },
        { tierNumber: 5, name: 'Bậc 5: Tỉnh lân cận (40 - 60 km)', fromKm: 40, toKm: 60, pricePerKm: 60000, status: 'ACTIVE' },
        { tierNumber: 6, name: 'Bậc 6: Cự ly đặc biệt (> 60 km)', fromKm: 60, toKm: null, pricePerKm: 70000, status: 'ACTIVE' },
      ];
      const tiers = Array.isArray(data) && data.length > 0 ? data : fallbackTiers;
      setTravelTiers(tiers);
    } catch (err: any) {
      console.warn('Failed to load travel tiers:', err);
    } finally {
      setIsLoadingTiers(false);
    }
  };

  const handleOpenReview = (proposal: InspectionFeeProposalResponse, action: 'APPROVE' | 'REJECT') => {
    setSelectedProposal(proposal);
    setReviewAction(action);
    setReviewNote('');
    setReviewError(null);
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedProposal) return;
    if (reviewAction === 'REJECT' && !reviewNote.trim()) {
      setReviewError('Vui lòng nhập lý do từ chối đề xuất để trung tâm kiểm định nắm rõ');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      await inspectorService.reviewFeeProposal(selectedProposal.id, {
        approved: reviewAction === 'APPROVE',
        reason: reviewNote.trim() || undefined,
      });

      const isTravelProposal = (selectedProposal.tiers?.length ?? 0) > 0 && !selectedProposal.complexityLevel;
      setFeedback({
        type: 'success',
        message: reviewAction === 'APPROVE'
          ? (isTravelProposal
              ? 'Đã phê duyệt đề xuất cước di chuyển thành công! Bảng bậc cước di chuyển đã được tự động cập nhật.'
              : 'Đã phê duyệt đề xuất biểu phí độ phức tạp thành công! Bảng giá đang áp dụng đã được cập nhật.')
          : (isTravelProposal
              ? 'Đã từ chối đề xuất cước di chuyển thành công.'
              : 'Đã từ chối đề xuất biểu phí độ phức tạp thành công.')
      });

      // Cập nhật tức thời bảng cước di chuyển đang áp dụng của trung tâm vừa được duyệt
      if (reviewAction === 'APPROVE') {
        const newlyApproved: InspectionFeeProposalResponse = {
          ...selectedProposal,
          status: 'APPROVED',
          reviewedAt: new Date().toISOString(),
          reviewedByName: 'System Administrator',
        };
        if (isTravelProposal) {
          setApprovedTravelProposals((prev) => [
            newlyApproved,
            ...prev.filter((p) => p.id !== selectedProposal.id),
          ]);
        } else {
          setApprovedFeeProposals((prev) => [
            newlyApproved,
            ...prev.filter((p) => p.id !== selectedProposal.id),
          ]);
        }
      }

      setIsReviewModalOpen(false);
      setSelectedProposal(null);
      setReviewError(null);
      if (viewingProposal?.id === selectedProposal.id) {
        setViewingProposal(null);
      }
      // Reload both proposals, active travel tiers, and active applied pricing
      loadProposals(page, proposalStatusFilter, activeSubTab === 'travel_tiers');
      loadTravelTiers();
      loadActivePricing();
      inspectorService.getAdminFeeProposals('ALL', 0, 1, false).then(res => setFeeProposalTotal(res.totalElements || 0)).catch(() => {});
      inspectorService.getAdminFeeProposals('ALL', 0, 1, true).then(res => setTravelProposalTotal(res.totalElements || 0)).catch(() => {});
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const errorMsg = err?.message || '';
      if (status === 409 || errorMsg.includes('409') || errorMsg.toLowerCase().includes('already been reviewed')) {
        setFeedback({
          type: 'warning',
          message: 'Đề xuất này đã được một quản trị viên khác xử lý trước đó. Đang làm mới dữ liệu...'
        });
        setIsReviewModalOpen(false);
        setSelectedProposal(null);
        setReviewError(null);
        if (viewingProposal?.id === selectedProposal?.id) setViewingProposal(null);
        loadProposals(page, proposalStatusFilter, activeSubTab === 'travel_tiers');
        loadTravelTiers();
        loadActivePricing();
        inspectorService.getAdminFeeProposals('ALL', 0, 1, false).then(res => setFeeProposalTotal(res.totalElements || 0)).catch(() => {});
        inspectorService.getAdminFeeProposals('ALL', 0, 1, true).then(res => setTravelProposalTotal(res.totalElements || 0)).catch(() => {});
      } else {
        setReviewError(errorMsg || 'Xét duyệt đề xuất thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const renderFeeProposalCard = (proposal: InspectionFeeProposalResponse) => {
    const isPending = proposal.status === 'PENDING_APPROVAL' || proposal.status === 'PENDING';
    const centerInfo = getProposalCenterInfo(proposal);
    return (
      <div
        key={proposal.id}
        className={`p-5 rounded-2xl bg-white border transition shadow-2xs space-y-4 ${
          centerInfo.isHcm ? 'border-orange-200/80 hover:border-orange-400' : 'border-amber-200/80 hover:border-amber-400'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl shrink-0 ${centerInfo.isHcm ? 'bg-orange-50 text-orange-600' : 'bg-amber-50 text-amber-600'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-slate-900">
                  Đề xuất biểu phí #{proposal.id.slice(0, 8)}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${proposal.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : proposal.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800 animate-pulse'
                    }`}
                >
                  {proposal.status === 'PENDING_APPROVAL' || proposal.status === 'PENDING'
                    ? 'Chờ duyệt'
                    : proposal.status === 'APPROVED'
                      ? 'Đã phê duyệt'
                      : 'Đã từ chối'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1 text-xs text-slate-500">
                <span>Đề xuất bởi:</span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  <Building2 className={`w-3.5 h-3.5 shrink-0 ${centerInfo.isHcm ? 'text-orange-600' : 'text-amber-600'}`} />
                  {centerInfo.name}
                </span>
                {centerInfo.areaBadge && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    centerInfo.isHcm ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {centerInfo.areaBadge}
                  </span>
                )}
                {centerInfo.email && (
                  <span className="text-[11px] text-slate-500 font-medium">({centerInfo.email})</span>
                )}
                <span className="text-slate-300">•</span>
                <span>
                  Ngày gửi: {proposal.createdAt ? new Date(proposal.createdAt).toLocaleString('vi-VN') : 'Mới đây'}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {isPending && hasFeeManagePermission && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenReview(proposal, 'REJECT')}
                className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <X className="w-3.5 h-3.5" />
                <span>Từ chối</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenReview(proposal, 'APPROVE')}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Phê duyệt</span>
              </button>
            </div>
          )}
        </div>

        {/* Proposal Quick Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Phí kiểm định cơ sở đề xuất</span>
            <span className="text-base font-black text-[#c34c36] block mt-0.5">
              {formatVND(proposal.baseInspectionFee || 0)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Phạm vi / cấp độ áp dụng</span>
            {proposal.complexityLevel ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase bg-[#24263e] text-white">
                  Cấp {proposal.complexityLevel}
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {proposal.categoryName ? `(${proposal.categoryName})` : ''}
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-800 block mt-0.5">
                {proposal.categoryName || 'Tất cả danh mục sản phẩm'}
              </span>
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Người xét duyệt</span>
            <span className="text-xs font-bold text-slate-800 block mt-0.5">
              {proposal.reviewedByName ? `${proposal.reviewedByName} (Đã xử lý)` : 'Chờ Admin xử lý'}
            </span>
            {proposal.rejectReason && (
              <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
                Lý do từ chối: {proposal.rejectReason}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderActiveLevelFeeTable = (branchKey: 'HCM' | 'HANOI') => {
    const isHcm = branchKey === 'HCM';
    const center = isHcm ? hcmCenter : hanoiCenter;
    const centerName =
      center?.name ||
      (isHcm
        ? 'Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh'
        : 'Trung Tâm Kiểm Định SecondLife Hà Nội');
    const centerEmail = isHcm ? 'center@secondlife.com' : 'center2@secondlife.com';
    const centerBadge = isHcm ? 'TP. HCM' : 'Hà Nội';
    const activeFees = getActiveLevelFees(branchKey);
    const configuredCount = activeFees.filter((f) => f.isConfigured).length;

    return (
      <div
        className={`p-4 rounded-2xl border shadow-2xs space-y-3.5 ${
          isHcm
            ? 'bg-gradient-to-r from-orange-50/50 via-white to-white border-orange-200/80'
            : 'bg-gradient-to-r from-amber-50/50 via-white to-white border-amber-200/80'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isHcm ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Bảng giá độ phức tạp đang áp dụng
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isHcm ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {centerBadge}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{configuredCount}/4 cấp độ đã kích hoạt</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {centerName} • <span className="text-slate-400 font-normal">{centerEmail}</span>
              </p>
            </div>
          </div>
        </div>

        {configuredCount === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl border border-dashed border-slate-200 space-y-1">
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-1" />
            <p className="text-xs font-bold text-slate-700">Chi nhánh này hiện chưa kích hoạt bảng giá độ phức tạp.</p>
            <p className="text-[11px] text-slate-400">
              Mức phí sẽ được tự động kích hoạt ngay khi Admin phê duyệt đề xuất biểu phí từ trung tâm.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold tracking-wide text-xs">
                  <th className="py-2.5 px-3.5 w-24 text-center">Cấp độ</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Tên độ phức tạp</th>
                  <th className="py-2.5 px-4 text-right w-44">Đơn giá cơ sở đang áp dụng</th>
                  <th className="py-2.5 px-3.5 text-center w-36">Trạng thái</th>
                  <th className="py-2.5 px-3.5 text-right w-48">Căn cứ đề xuất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeFees.map((fee) => (
                  <tr key={fee.level} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                          fee.level === 'L1'
                            ? 'bg-emerald-100 text-emerald-800'
                            : fee.level === 'L2'
                              ? 'bg-blue-100 text-blue-800'
                              : fee.level === 'L3'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        Cấp {fee.level}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                      {fee.levelName}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-black text-sm text-[#c34c36]">
                      {fee.isConfigured ? (
                        formatVND(fee.fee || 0)
                      ) : (
                        <span className="text-slate-400 font-normal italic">Chưa áp dụng</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      {fee.isConfigured ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đang áp dụng</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                          <span>Chưa áp dụng</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap text-[11px] text-slate-500 font-medium">
                      {fee.proposalId ? (
                        <span>
                          Đề xuất #{fee.proposalId.slice(0, 8)}
                          {fee.approvedAt && (
                            <span className="block text-[10px] text-slate-400">
                              {new Date(fee.approvedAt).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Mặc định hệ thống</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderActiveTravelTierTable = (branchKey: 'HCM' | 'HANOI') => {
    const isHcm = branchKey === 'HCM';
    const center = isHcm ? hcmCenter : hanoiCenter;
    const centerName =
      center?.name ||
      (isHcm
        ? 'Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh'
        : 'Trung Tâm Kiểm Định SecondLife Hà Nội');
    const centerEmail = isHcm ? 'center@secondlife.com' : 'center2@secondlife.com';
    const centerBadge = isHcm ? 'TP. HCM' : 'Hà Nội';
    const activeData = getActiveTravelTiers(branchKey);

    return (
      <div
        className={`p-4 rounded-2xl border shadow-2xs space-y-3.5 ${
          isHcm
            ? 'bg-gradient-to-r from-blue-50/40 via-white to-white border-blue-200/80'
            : 'bg-gradient-to-r from-amber-50/40 via-white to-white border-amber-200/80'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isHcm ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Bảng 6 bậc thang cước di chuyển đang áp dụng
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isHcm ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {centerBadge}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Đang áp dụng ({activeData.tiers.length} bậc)</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {centerName} • <span className="text-slate-400 font-normal">{centerEmail}</span>
                {activeData.proposalId && (
                  <span className="text-blue-600 ml-1 font-bold">
                    (Căn cứ đề xuất đã duyệt #{activeData.proposalId.slice(0, 8)})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold tracking-wide text-xs">
                <th className="py-2.5 px-3.5 w-20 text-center">Bậc thang</th>
                <th className="py-2.5 px-4 min-w-[160px]">Tên hiển thị</th>
                <th className="py-2.5 px-3 w-36 text-center">Khoảng cách từ (km)</th>
                <th className="py-2.5 px-3 w-40 text-center">Khoảng cách đến (km)</th>
                <th className="py-2.5 px-4 w-44 text-right">Đơn giá / km đang áp dụng</th>
                <th className="py-2.5 px-3.5 w-32 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeData.tiers.map((tier, idx) => (
                <tr key={tier.tierNumber || idx} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-3.5 font-black text-slate-900 text-center">
                    #{tier.tierNumber || idx + 1}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {tier.name || `Bậc ${tier.tierNumber || idx + 1}`}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap font-semibold text-slate-700">
                    {tier.fromKm ?? 0} km
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap font-semibold text-slate-700">
                    {tier.toKm != null ? `${tier.toKm} km` : 'Không giới hạn (∞)'}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-black text-[#c34c36]">
                    {formatVND(tier.pricePerKm || 0)} / km
                  </td>
                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Đang kích hoạt</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 font-bold shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Quản trị biểu phí
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Xét duyệt các thông tin về tiêu chuẩn kỹ thuật, cấp độ, biểu phí kỹ thuật viên, cước vận chuyển, dự phòng hoàn...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              if (activeSubTab === 'checklist_proposals') {
                loadChecklistProposals(checklistPage);
              } else if (activeSubTab === 'proposals') {
                loadProposals(page, proposalStatusFilter, false);
              } else if (activeSubTab === 'travel_tiers') {
                loadTravelTiers();
                loadProposals(page, proposalStatusFilter, true);
              } else if (activeSubTab === 'return_shipping_policy') {
                loadReturnShippingPolicy();
                loadReturnShippingPolicyHistory(policyHistoryPage);
              } else if (activeSubTab === 'high_value_policy') {
                setIsLoadingThreshold(true);
                inspectorService
                  .getAdminHighValueInspectionPolicy()
                  .then((res) => {
                    const val = typeof res?.thresholdPrice === 'number' && res.thresholdPrice > 0 ? res.thresholdPrice : 10000000;
                    setThresholdPrice(val);
                    setInputThresholdPrice(String(val));
                    if (res?.version) setThresholdVersion(res.version);
                  })
                  .catch((err) => {
                    console.warn('Failed to load high value inspection policy:', err);
                  })
                  .finally(() => {
                    setIsLoadingThreshold(false);
                  });
              } else {
                loadTravelTiers();
              }
            }}
            disabled={isLoadingChecklistProposals || isLoadingProposals || isLoadingTiers || isLoadingPolicy || isLoadingPolicyHistory || isLoadingThreshold}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
            title="Tải lại dữ liệu tab hiện tại"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(isLoadingChecklistProposals || isLoadingProposals || isLoadingTiers || isLoadingPolicy || isLoadingPolicyHistory || isLoadingThreshold) ? 'animate-spin text-amber-600' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Balanced 5-Column Navigation Tab Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60">
        <button
          type="button"
          onClick={() => setActiveSubTab('checklist_proposals')}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'checklist_proposals'
            ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">Tiêu chuẩn & cấp độ</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${activeSubTab === 'checklist_proposals' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
            }`}>
            {checklistTotalElements}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('proposals');
            setProposalStatusFilter('ALL');
            setPage(0);
            loadProposals(0, 'ALL', false);
          }}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'proposals'
            ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <FileText className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">Biểu phí độ phức tạp</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${activeSubTab === 'proposals' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
            }`}>
            {feeProposalTotal || (activeSubTab === 'proposals' ? totalElements : 0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('travel_tiers');
            setProposalStatusFilter('ALL');
            setPage(0);
            loadProposals(0, 'ALL', true);
            loadTravelTiers();
          }}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'travel_tiers'
            ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <Navigation className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">Cước di chuyển</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${activeSubTab === 'travel_tiers' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
            }`}>
            {travelProposalTotal || totalElements || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('return_shipping_policy')}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'return_shipping_policy'
            ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <RotateCcw className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="truncate">Dự phòng trả hàng</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${activeSubTab === 'return_shipping_policy' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-600'
            }`}>
            {policyMarkupPercentage}%
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('high_value_policy')}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${activeSubTab === 'high_value_policy'
            ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <ShieldCheck className="w-4 h-4 text-cyan-600 shrink-0" />
          <span className="truncate">Ngưỡng giá bắt buộc kiểm định</span>

        </button>
      </div>

      {/* Permission alert if lacking INSPECTION_FEE_MANAGE */}
      {!hasFeeManagePermission && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>Lưu ý phân quyền:</strong> Tài khoản của bạn hiện ở chế độ chỉ đọc. Cần quyền{' '}
            <code className="font-mono px-1 py-0.5 rounded bg-amber-100 font-bold">INSPECTION_FEE_MANAGE</code> để phê
            duyệt đề xuất hoặc cập nhật biểu phí.
          </span>
        </div>
      )}

      {/* Global alert feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn ${feedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : feedback.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 0: ĐỀ XUẤT BỘ TIÊU CHUẨN & CẤP ĐỘ KIỂM ĐỊNH TỪ TRUNG TÂM (CHECKLIST)*/}
      {/* ===================================================================== */}
      {activeSubTab === 'checklist_proposals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Danh sách đề xuất bộ tiêu chuẩn kỹ thuật & cấp độ (L1–L4)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Mỗi loại thiết bị (Item) chỉ có 1 bộ tiêu chuẩn hiệu lực toàn sàn. Kèm biểu phí theo trung tâm tác giả và cấp độ L1–L4.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-2">
              <span>
                Tổng cộng: <strong className="text-slate-700">{checklistTotalElements}</strong> bộ tiêu chuẩn
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                10 mục / trang
              </span>
            </div>
          </div>

          {/* Search bar & quick filters */}
          <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-3">
            <form onSubmit={handleSearchChecklist} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={120}
                  value={checklistKeyword}
                  onChange={(e) => setChecklistKeyword(e.target.value)}
                  placeholder="Tìm kiếm theo tên thiết bị, danh mục, tiêu chuẩn, email/tên trung tâm tác giả... (tối đa 120 ký tự)"
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                />
                {checklistKeyword && (
                  <button
                    type="button"
                    onClick={() => {
                      setChecklistKeyword('');
                      setChecklistPage(0);
                      loadChecklistProposals(0, { keyword: '' });
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Xóa từ khóa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="submit"
                  disabled={isLoadingChecklistProposals}
                  className="px-4 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tìm kiếm</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${isFilterExpanded || activeFiltersCount > (checklistKeyword.trim() ? 1 : 0)
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  title="Mở rộng bộ lọc chi tiết"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                  <span>Bộ lọc</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetChecklistFilters}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                    title="Đặt lại toàn bộ bộ lọc"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Quick status filter pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Trạng thái:</span>
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
                { key: 'APPROVED', label: 'Đã phê duyệt' },
                { key: 'REJECTED', label: 'Đã từ chối' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleChecklistStatusFilterChange(st.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${checklistStatusFilter === st.key
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                    }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Quick Author Center filter pills (Trung Tâm Tác Giả: Hà Nội, TP. HCM) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
              <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Trung tâm tác giả:</span>
              </span>

              <button
                type="button"
                onClick={() => handleChecklistCenterFilterChange('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer self-stretch flex items-center ${checklistCenterFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                  }`}
              >
                Tất cả trung tâm
              </button>

              <button
                type="button"
                onClick={() => handleChecklistCenterFilterChange(hanoiCenter?.id || 'HANOI')}
                className={`px-3 py-1 rounded-lg text-left transition cursor-pointer border ${isHanoiActive
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-amber-50/50 border-slate-200/80'
                  }`}
                title={hanoiCenter?.name || 'Trung Tâm Kiểm Định SecondLife Hà Nội'}
              >
                <div className="flex items-center gap-1 text-xs font-extrabold">
                  <MapPin className={`w-3 h-3 shrink-0 ${isHanoiActive ? 'text-amber-200' : 'text-amber-600'}`} />
                  <span>Hà Nội</span>
                </div>
                <div className={`text-[10px] font-medium leading-tight mt-0.5 ${isHanoiActive ? 'text-amber-100' : 'text-slate-500'}`}>
                  {hanoiCenter?.name || 'Trung Tâm Kiểm Định SecondLife Hà Nội'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChecklistCenterFilterChange(hcmCenter?.id || 'HCM')}
                className={`px-3 py-1 rounded-lg text-left transition cursor-pointer border ${isHcmActive
                  ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-orange-50/50 border-slate-200/80'
                  }`}
                title={hcmCenter?.name || 'Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh'}
              >
                <div className="flex items-center gap-1 text-xs font-extrabold">
                  <MapPin className={`w-3 h-3 shrink-0 ${isHcmActive ? 'text-orange-200' : 'text-orange-600'}`} />
                  <span>Thành phố HCM</span>
                </div>
                <div className={`text-[10px] font-medium leading-tight mt-0.5 ${isHcmActive ? 'text-orange-100' : 'text-slate-500'}`}>
                  {hcmCenter?.name || 'Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh'}
                </div>
              </button>

              {otherCenters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleChecklistCenterFilterChange(c.id)}
                  className={`px-3 py-1 rounded-lg text-left transition cursor-pointer border ${checklistCenterFilter === c.id
                    ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  title={c.name}
                >
                  <div className="flex items-center gap-1 text-xs font-bold">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{c.city || c.name}</span>
                  </div>
                  <div className={`text-[10px] font-medium leading-tight mt-0.5 ${checklistCenterFilter === c.id ? 'text-slate-200' : 'text-slate-500'}`}>
                    {c.name}
                  </div>
                </button>
              ))}
            </div>

            {/* Collapsible Advanced Filters */}
            {isFilterExpanded && (
              <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 animate-fadeIn">
                {/* Complexity Level Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Cấp độ kỹ thuật
                  </label>
                  <select
                    value={checklistComplexityFilter}
                    onChange={(e) => {
                      const lvl = e.target.value as any;
                      setChecklistComplexityFilter(lvl);
                      setChecklistPage(0);
                      loadChecklistProposals(0, { complexityLevel: lvl !== 'ALL' ? lvl : undefined });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-amber-500"
                  >
                    <option value="ALL">-- Tất cả cấp độ --</option>
                    <option value="L1">Cấp L1 - Cơ bản</option>
                    <option value="L2">Cấp L2 - Nâng cao</option>
                    <option value="L3">Cấp L3 - Chuyên sâu</option>
                    <option value="L4">Cấp L4 - Phức tạp</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Danh mục
                  </label>
                  <select
                    value={checklistCategoryFilter}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setChecklistCategoryFilter(cat);
                      setChecklistItemFilter('ALL');
                      setChecklistPage(0);
                      loadChecklistProposals(0, { categoryId: cat !== 'ALL' ? cat : undefined, itemId: undefined });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-amber-500"
                  >
                    <option value="ALL">-- Tất cả danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Item Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Loại thiết bị (Item)
                  </label>
                  <select
                    value={checklistItemFilter}
                    onChange={(e) => {
                      const itm = e.target.value;
                      setChecklistItemFilter(itm);
                      setChecklistPage(0);
                      loadChecklistProposals(0, { itemId: itm !== 'ALL' ? itm : undefined });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-amber-500"
                  >
                    <option value="ALL">-- Tất cả loại thiết bị --</option>
                    {availableItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Inspection Center Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Trung tâm tác giả
                  </label>
                  <select
                    value={checklistCenterFilter}
                    onChange={(e) => handleChecklistCenterFilterChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-amber-500"
                  >
                    <option value="ALL">-- Tất cả trung tâm --</option>
                    <option value={hanoiCenter?.id || 'HANOI'}>
                      Trung Tâm Kiểm Định SecondLife Hà Nội (Hà Nội)
                    </option>
                    <option value={hcmCenter?.id || 'HCM'}>
                      Trung Tâm Kiểm Định SecondLife TP. Hồ Chí Minh (TP. HCM)
                    </option>
                    {otherCenters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active version filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Hiệu lực toàn sàn
                  </label>
                  <select
                    value={checklistActiveFilter}
                    onChange={(e) => {
                      const act = e.target.value as any;
                      setChecklistActiveFilter(act);
                      setChecklistPage(0);
                      loadChecklistProposals(0, { active: act === 'ALL' ? undefined : act === 'ACTIVE' });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-amber-500"
                  >
                    <option value="ALL">-- Tất cả phiên bản --</option>
                    <option value="ACTIVE">Đang kích hoạt</option>
                    <option value="INACTIVE">Chưa kích hoạt</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Checklist Proposals Table */}
          <div className="border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs table-auto">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs tracking-wide">
                  <th className="py-3 px-2 w-8 text-center">#</th>
                  <th className="py-3 px-2.5 w-[16%]">Loại thiết bị & danh mục</th>
                  <th className="py-3 px-1.5 w-[6%] text-center">Cấp độ</th>
                  <th className="py-3 px-2.5 w-[21%]">Bộ tiêu chuẩn</th>
                  <th className="py-3 px-2.5 w-[18%]">Trung tâm tác giả</th>
                  <th className="py-3 px-2.5 w-[14%] text-right">Biểu phí cơ sở</th>
                  <th className="py-3 px-1.5 w-[7%] text-center">Hiệu lực</th>
                  <th className="py-3 px-1.5 w-[8%] text-center">Trạng thái</th>
                  <th className="py-3 px-2 w-[6%] text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingChecklistProposals ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                      <span>Đang tải danh sách đề xuất tiêu chuẩn checklist & pricing...</span>
                    </td>
                  </tr>
                ) : checklistProposals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">Chưa có đề xuất bộ tiêu chuẩn nào phù hợp.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Thử điều chỉnh từ khóa hoặc bộ lọc tìm kiếm để xem kết quả khác.
                      </p>
                      {activeFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetChecklistFilters}
                          className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                        >
                          Xóa bộ lọc
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  checklistProposals.map((chk, idx) => {
                    const itemsCount = chk.items?.length || 0;
                    const mandatoryCount = (chk.items || []).filter((i) => i.mandatory !== false).length;
                    const pricing = chk.pricing;

                    return (
                      <tr key={chk.id} className="hover:bg-slate-50/50 transition">
                        {/* # */}
                        <td className="py-2.5 px-2 text-slate-400 font-mono text-center text-xs">
                          {checklistPage * pageSize + idx + 1}
                        </td>

                        {/* Loại Thiết Bị & Danh Mục */}
                        <td className="py-2.5 px-2.5">
                          {chk.itemName ? (
                            <div className="font-bold text-slate-900 text-xs line-clamp-1">{chk.itemName}</div>
                          ) : (
                            <div className="text-slate-400 italic text-xs">Chưa gắn Item cụ thể</div>
                          )}
                          {chk.categoryName && (
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                              {chk.itemName ? chk.categoryName : `Danh mục: ${chk.categoryName}`}
                            </div>
                          )}
                          {chk.supersedesId && (
                            <span className="text-[10px] text-blue-600 font-medium block mt-0.5">
                              (Thay thế v{(chk.revision || 2) - 1})
                            </span>
                          )}
                        </td>

                        {/* Cấp Độ */}
                        <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                          {chk.complexityLevel ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${chk.complexityLevel === 'L1'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : chk.complexityLevel === 'L2'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : chk.complexityLevel === 'L3'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                            >
                              {chk.complexityLevel}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200">
                              Chưa phân cấp
                            </span>
                          )}
                        </td>

                        {/* Bộ Tiêu Chuẩn */}
                        <td className="py-2.5 px-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs line-clamp-1">{chk.title}</span>
                            <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0">v{chk.revision || 1}</span>
                          </div>
                          {chk.description && (
                            <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5" title={chk.description}>
                              {chk.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-400">
                              {itemsCount} mục ({mandatoryCount} bắt buộc)
                            </span>
                            {chk.active && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                Đang kích hoạt
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Trung Tâm Tác Giả */}
                        {(() => {
                          const centerInfo = getCenterDetails(chk);
                          return (
                            <td className="py-2.5 px-2.5">
                              <div className="space-y-0.5">
                                {/* Tên khu vực kèm huy hiệu thành phố */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-slate-900 text-xs">
                                    {centerInfo.areaTitle}
                                  </span>
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold border ${centerInfo.isHanoi
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : centerInfo.isHcm
                                      ? 'bg-orange-50 text-orange-800 border-orange-200'
                                      : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}>
                                    <MapPin className="w-2.5 h-2.5 mr-0.5 shrink-0" />
                                    {centerInfo.areaBadge}
                                  </span>
                                </div>

                                {/* Hiện ra tên đầy đủ dưới tên */}
                                <div
                                  className="text-[11px] text-slate-700 font-medium leading-snug break-words"
                                  title={centerInfo.fullName}
                                >
                                  {centerInfo.fullName}
                                </div>

                                <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                                  {chk.createdAt ? new Date(chk.createdAt).toLocaleDateString('vi-VN') : '—'}
                                </div>
                              </div>
                            </td>
                          );
                        })()}

                        {/* Biểu Phí Cơ Sở */}
                        <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          {pricing?.pendingBaseInspectionFee != null ? (
                            <div>
                              <span className="font-black text-[#c34c36] text-xs">
                                {formatVND(pricing.pendingBaseInspectionFee)}
                              </span>
                              <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full inline-block mt-0.5 ml-1">
                                Chờ duyệt giá
                              </span>
                              {pricing.baseInspectionFee != null && (
                                <div className="text-[10px] text-slate-400 mt-0.5" title={`Giá hiện hành: ${formatVND(pricing.baseInspectionFee)}`}>
                                  (Giá cũ: {formatVND(pricing.baseInspectionFee)})
                                </div>
                              )}
                            </div>
                          ) : pricing?.baseInspectionFee != null ? (
                            <div>
                              <span className="font-black text-slate-900 text-xs">
                                {formatVND(pricing.baseInspectionFee)}
                              </span>
                              {pricing.applicable ? (
                                <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">
                                  Hiệu lực
                                </span>
                              ) : (
                                <span
                                  className="text-[9px] font-medium text-amber-700 bg-amber-50 px-1 py-0.2 rounded block border border-amber-200/60 mt-0.5 truncate max-w-[120px] ml-auto"
                                  title="Giá tham khảo của cấp này tại trung tâm tác giả; checklist chưa có hiệu lực toàn sàn"
                                >
                                  Giá tham khảo
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Chưa có giá được duyệt
                            </span>
                          )}
                        </td>

                        {/* Hiệu Lực Giá */}
                        <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                          {pricing?.pendingBaseInspectionFee != null ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Đang có đề xuất biểu phí mới chờ Admin phê duyệt">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Đang đổi giá</span>
                            </span>
                          ) : pricing?.applicable ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sẵn sàng</span>
                            </span>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Chưa áp dụng
                              </span>
                              {pricing?.unavailableReason && (
                                <span
                                  className="text-[9px] text-slate-500 mt-0.5 max-w-[90px] truncate"
                                  title={
                                    pricing.unavailableReason === 'CHECKLIST_NOT_EFFECTIVE'
                                      ? 'Bộ tiêu chuẩn chưa được duyệt hoặc chưa kích hoạt'
                                      : pricing.unavailableReason === 'NO_APPROVED_LEVEL_FEE'
                                        ? 'Trung tâm chưa có giá được duyệt cho cấp này'
                                        : pricing.unavailableReason === 'ITEM_NOT_CLASSIFIED'
                                          ? 'Chưa gắn loại thiết bị hoặc là bộ tiêu chuẩn cũ'
                                          : pricing.unavailableReason === 'CENTER_UNAVAILABLE'
                                            ? 'Trung tâm không đủ điều kiện hoạt động'
                                            : pricing.unavailableReason === 'ITEM_NOT_SELECTABLE'
                                              ? 'Loại thiết bị đã ngừng hỗ trợ'
                                              : pricing.unavailableReason
                                  }
                                >
                                  {pricing.unavailableReason === 'CHECKLIST_NOT_EFFECTIVE'
                                    ? ''
                                    : pricing.unavailableReason === 'NO_APPROVED_LEVEL_FEE'
                                      ? 'Chưa duyệt giá'
                                      : pricing.unavailableReason === 'ITEM_NOT_CLASSIFIED'
                                        ? 'Chưa phân cấp'
                                        : pricing.unavailableReason === 'CENTER_UNAVAILABLE'
                                          ? 'Trung tâm ngừng HĐ'
                                          : pricing.unavailableReason === 'ITEM_NOT_SELECTABLE'
                                            ? 'Item ngừng chọn'
                                            : pricing.unavailableReason}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Trạng Thái */}
                        <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                          {pricing?.pendingBaseInspectionFee != null ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 animate-pulse border border-amber-200 whitespace-nowrap" title="Trung tâm đang đề xuất đổi biểu phí mới, chờ Admin duyệt">
                              Chờ duyệt giá
                            </span>
                          ) : chk.approvalStatus === 'APPROVED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 whitespace-nowrap">
                              Đã duyệt
                            </span>
                          ) : chk.approvalStatus === 'REJECTED' ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 whitespace-nowrap">
                                Từ chối
                              </span>
                              {chk.rejectReason && (
                                <span className="text-[9px] text-rose-600 truncate max-w-[90px] mt-0.5" title={chk.rejectReason}>
                                  {chk.rejectReason}
                                </span>
                              )}
                            </div>
                          ) : chk.approvalStatus === 'WITHDRAWN' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 whitespace-nowrap">
                              Đã rút
                            </span>
                          ) : chk.approvalStatus === 'LEGACY' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap" title="Checklist hệ thống cũ">
                              Bản cũ
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 animate-pulse whitespace-nowrap">
                              Chờ duyệt
                            </span>
                          )}
                        </td>

                        {/* Thao Tác - Chỉ hiển thị Chi tiết */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingChecklistProposal(chk)}
                            className="h-7 px-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Xem chi tiết để phê duyệt hoặc từ chối đề xuất"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Checklist Pagination Controls */}
          {checklistProposals.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>
                  Trang <strong>{checklistPage + 1}</strong> / <strong>{Math.max(checklistTotalPages, 1)}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Tổng cộng <strong>{checklistTotalElements}</strong> bộ tiêu chuẩn
                </span>
                <span className="text-slate-300">•</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                  10 bộ tiêu chuẩn / trang
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChecklistPageChange(checklistPage - 1)}
                  disabled={checklistPage <= 0 || isLoadingChecklistProposals}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>
                {Array.from({ length: Math.max(checklistTotalPages, 1) }, (_, i) => i).map((pNum) => (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => handleChecklistPageChange(pNum)}
                    disabled={isLoadingChecklistProposals}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                      checklistPage === pNum
                        ? 'bg-[#24263e] text-white shadow-xs'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {pNum + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleChecklistPageChange(checklistPage + 1)}
                  disabled={checklistPage >= checklistTotalPages - 1 || isLoadingChecklistProposals}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: ĐỀ XUẤT BIỂU PHÍ CƠ SỞ (L1–L4) TỪ TRUNG TÂM                     */}
      {/* ===================================================================== */}
      {activeSubTab === 'proposals' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Biểu phí độ phức tạp theo chi nhánh
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Bảng giá độ phức tạp đang áp dụng và xét duyệt các đề xuất điều chỉnh mức phí L1–L4 phân chia theo 2 chi nhánh TP. Hồ Chí Minh và Hà Nội.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-medium shrink-0">
              Tổng cộng: <strong className="text-slate-700">{totalElements}</strong> đề xuất biểu phí
            </div>
          </div>

          {/* Branch Navigation Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Tất cả chi nhánh */}
            <button
              type="button"
              onClick={() => setProposalBranchFilter('ALL')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                proposalBranchFilter === 'ALL'
                  ? 'bg-[#24263e] text-white border-[#24263e] shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 ${proposalBranchFilter === 'ALL' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold block truncate">Tất cả chi nhánh</span>
                  <span className={`text-[10px] block truncate ${proposalBranchFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Toàn bộ 2 khu vực
                  </span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                proposalBranchFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {displayedProposals.length}
              </span>
            </button>

            {/* Chi nhánh TP. Hồ Chí Minh */}
            <button
              type="button"
              onClick={() => setProposalBranchFilter('HCM')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                proposalBranchFilter === 'HCM'
                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-orange-50/40 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 ${proposalBranchFilter === 'HCM' ? 'bg-white/10 text-white' : 'bg-orange-100 text-orange-700'}`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-extrabold block">Chi nhánh TP. HCM</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                      proposalBranchFilter === 'HCM' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-800'
                    }`}>
                      TP. HCM
                    </span>
                  </div>
                  <span className={`text-[10px] truncate block mt-0.5 ${proposalBranchFilter === 'HCM' ? 'text-orange-100' : 'text-slate-500'}`}>
                    {hcmCenter?.name || 'TTKD SecondLife TP. HCM'}
                  </span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                proposalBranchFilter === 'HCM' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-800'
              }`}>
                {hcmFeeProposals.length}
              </span>
            </button>

            {/* Chi nhánh Hà Nội */}
            <button
              type="button"
              onClick={() => setProposalBranchFilter('HANOI')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                proposalBranchFilter === 'HANOI'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-amber-50/40 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 ${proposalBranchFilter === 'HANOI' ? 'bg-white/10 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-extrabold block">Chi nhánh Hà Nội</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                      proposalBranchFilter === 'HANOI' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                    }`}>
                      Hà Nội
                    </span>
                  </div>
                  <span className={`text-[10px] truncate block mt-0.5 ${proposalBranchFilter === 'HANOI' ? 'text-amber-100' : 'text-slate-500'}`}>
                    {hanoiCenter?.name || 'TTKD SecondLife Hà Nội'}
                  </span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                proposalBranchFilter === 'HANOI' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {hanoiFeeProposals.length}
              </span>
            </button>
          </div>

          {/* Quick status filter pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-slate-500 mr-1">Lọc trạng thái:</span>
            {[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
              { key: 'APPROVED', label: 'Đã phê duyệt' },
              { key: 'REJECTED', label: 'Đã từ chối' }
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => handleStatusFilterChange(st.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${proposalStatusFilter === st.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Bảng giá độ phức tạp đang áp dụng theo chi nhánh */}
          <div className="space-y-4">
            {(proposalBranchFilter === 'ALL' || proposalBranchFilter === 'HCM') && renderActiveLevelFeeTable('HCM')}
            {(proposalBranchFilter === 'ALL' || proposalBranchFilter === 'HANOI') && renderActiveLevelFeeTable('HANOI')}
          </div>

          {/* Proposals List Section Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Danh sách đề xuất điều chỉnh biểu phí độ phức tạp</span>
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span>Hiển thị <strong>{visibleFeeProposals.length}</strong> đề xuất</span>
              <span className="text-slate-300">•</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                10 đề xuất / trang
              </span>
            </div>
          </div>

          {/* Proposals List Section */}
          {isLoadingProposals ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách đề xuất biểu phí...</p>
            </div>
          ) : visibleFeeProposals.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">
                {proposalBranchFilter === 'HCM'
                  ? 'Chi nhánh TP. HCM chưa có đề xuất biểu phí nào trong bộ lọc này.'
                  : proposalBranchFilter === 'HANOI'
                    ? 'Chi nhánh Hà Nội hiện chưa gửi đề xuất biểu phí độ phức tạp.'
                    : 'Chưa có đề xuất biểu phí độ phức tạp nào phù hợp.'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Các đề xuất điều chỉnh biểu phí cơ sở L1–L4 do các trung tâm kiểm định gửi lên sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {visibleFeeProposals.map((proposal) => renderFeeProposalCard(proposal))}
            </div>
          )}

          {/* Pagination Controls */}
          {visibleFeeProposals.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>
                  Trang <strong>{page + 1}</strong> / <strong>{Math.max(totalPages, 1)}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Tổng cộng <strong>{feeProposalTotal || totalElements}</strong> đề xuất
                </span>
                <span className="text-slate-300">•</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                  10 đề xuất / trang
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => loadProposals(page - 1, proposalStatusFilter, false)}
                  disabled={page <= 0 || isLoadingProposals}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>
                {Array.from({ length: Math.max(totalPages, 1) }, (_, i) => i).map((pNum) => (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => loadProposals(pNum, proposalStatusFilter, false)}
                    disabled={isLoadingProposals}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                      page === pNum
                        ? 'bg-[#24263e] text-white shadow-xs'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {pNum + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => loadProposals(page + 1, proposalStatusFilter, false)}
                  disabled={page >= totalPages - 1 || isLoadingProposals}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: ĐỀ XUẤT CƯỚC DI CHUYỂN TỪ CÁC TRUNG TÂM KIỂM ĐỊNH              */}
      {/* ===================================================================== */}
      {activeSubTab === 'travel_tiers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span>Danh sách đề xuất cước di chuyển từ các trung tâm kiểm định</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Xét duyệt các đề xuất điều chỉnh bảng 6 bậc thang cước di chuyển km do các trung tâm kiểm định gửi lên.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-medium shrink-0">
              Tổng cộng: <strong className="text-slate-700">{travelProposalTotal || totalElements}</strong> đề xuất cước
            </div>
          </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  Khu vực / Chi nhánh:
                </span>
                <button
                  type="button"
                  onClick={() => setTravelBranchFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    travelBranchFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({displayedProposals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTravelBranchFilter('HCM')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    travelBranchFilter === 'HCM'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  TP. HCM ({hcmTravelProposals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTravelBranchFilter('HANOI')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    travelBranchFilter === 'HANOI'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Hà Nội ({hanoiTravelProposals.length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 mr-1">Trạng thái:</span>
                {[
                  { key: 'ALL', label: 'Tất cả' },
                  { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
                  { key: 'APPROVED', label: 'Đã phê duyệt' },
                  { key: 'REJECTED', label: 'Đã từ chối' }
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => handleStatusFilterChange(st.key as any)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      proposalStatusFilter === st.key
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bảng 6 bậc thang cước di chuyển đang áp dụng theo chi nhánh */}
            <div className="space-y-4">
              {(travelBranchFilter === 'ALL' || travelBranchFilter === 'HCM') && renderActiveTravelTierTable('HCM')}
              {(travelBranchFilter === 'ALL' || travelBranchFilter === 'HANOI') && renderActiveTravelTierTable('HANOI')}
            </div>

            {/* Travel Proposals Section Title */}
            <div className="flex items-center justify-between pt-2">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span>Danh sách đề xuất cước di chuyển từ các trung tâm</span>
              </h4>
              <span className="text-[11px] text-slate-400 font-medium">
                {visibleTravelProposals.length} đề xuất theo bộ lọc
              </span>
            </div>

            {/* Travel proposals cards */}
            {isLoadingProposals ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách đề xuất cước di chuyển...</p>
              </div>
            ) : visibleTravelProposals.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <Navigation className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">
                  {travelBranchFilter === 'HCM'
                    ? 'Chi nhánh TP. HCM chưa có đề xuất cước di chuyển nào trong bộ lọc này.'
                    : travelBranchFilter === 'HANOI'
                      ? 'Chi nhánh Hà Nội chưa có đề xuất cước di chuyển nào trong bộ lọc này.'
                      : 'Chưa có đề xuất cước di chuyển nào phù hợp.'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Khi các trung tâm kiểm định gửi đề xuất điều chỉnh bảng bậc thang cước di chuyển km, thông tin sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {visibleTravelProposals.map((proposal) => {
                  const isPending = proposal.status === 'PENDING_APPROVAL' || proposal.status === 'PENDING';
                  const centerInfo = getProposalCenterInfo(proposal);
                  return (
                    <div
                      key={proposal.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition shadow-2xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-slate-900">
                                Đề xuất cước di chuyển #{proposal.id.slice(0, 8)}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${proposal.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : proposal.status === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800 animate-pulse'
                                  }`}
                              >
                                {proposal.status === 'PENDING_APPROVAL' || proposal.status === 'PENDING'
                                  ? 'Chờ duyệt'
                                  : proposal.status === 'APPROVED'
                                    ? 'Đã phê duyệt'
                                    : 'Đã từ chối'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1 text-xs text-slate-500">
                              <span>Đề xuất bởi:</span>
                              <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                {centerInfo.name}
                              </span>
                              {centerInfo.areaBadge && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                  {centerInfo.areaBadge}
                                </span>
                              )}
                              {centerInfo.email && (
                                <span className="text-[11px] text-slate-500">({centerInfo.email})</span>
                              )}
                              <span className="text-slate-300">•</span>
                              <span>
                                Ngày gửi: {proposal.createdAt ? new Date(proposal.createdAt).toLocaleString('vi-VN') : 'Mới đây'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {isPending && hasFeeManagePermission && (
                          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenReview(proposal, 'REJECT')}
                              className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Từ chối</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReview(proposal, 'APPROVE')}
                              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Phê duyệt</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Travel Proposal Key Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block">Bậc cước đề xuất</span>
                          <span className="text-base font-black text-blue-700 block mt-0.5">
                            {proposal.tiers?.length || 6} bậc
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block">Phạm vi / cấp độ áp dụng</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">
                            Kiểm định tại nhà
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block">Người xét duyệt</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">
                            {proposal.reviewedByName ? `${proposal.reviewedByName} (Đã xử lý)` : 'Chờ Admin xử lý'}
                          </span>
                          {proposal.rejectReason && (
                            <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
                              Lý do từ chối: {proposal.rejectReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 6 Tiers Display Grid */}
                      {proposal.tiers && proposal.tiers.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-700 block">
                            Các bậc cước di chuyển trong đề xuất ({proposal.tiers.length} bậc):
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            {proposal.tiers.map((t, idx) => (
                              <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 block">
                                  {t.name || `Bậc ${t.tierNumber || idx + 1}`}
                                </span>
                                <span className="text-xs font-bold text-slate-700 block mt-0.5">
                                  {t.fromKm ?? 0} - {t.toKm != null ? `${t.toKm} km` : 'Không giới hạn (∞)'}
                                </span>
                                <span className="text-xs font-black text-[#c34c36] block mt-1">
                                  {formatVND(t.pricePerKm || 0)}/km
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Travel Proposals Pagination */}
            {visibleTravelProposals.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span>
                    Trang <strong>{page + 1}</strong> / <strong>{Math.max(totalPages, 1)}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Tổng cộng <strong>{travelProposalTotal || totalElements}</strong> đề xuất cước
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                    10 đề xuất / trang
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadProposals(page - 1, proposalStatusFilter, true)}
                    disabled={page <= 0 || isLoadingProposals}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Trước</span>
                  </button>
                  {Array.from({ length: Math.max(totalPages, 1) }, (_, i) => i).map((pNum) => (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => loadProposals(pNum, proposalStatusFilter, true)}
                      disabled={isLoadingProposals}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                        page === pNum
                          ? 'bg-[#24263e] text-white shadow-xs'
                          : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {pNum + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => loadProposals(page + 1, proposalStatusFilter, true)}
                    disabled={page >= totalPages - 1 || isLoadingProposals}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    <span>Sau</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: DỰ PHÒNG CƯỚC TRẢ HÀNG KIỂM ĐỊNH (RETURN SHIPPING POLICY)     */}
      {/* ===================================================================== */}
      {activeSubTab === 'return_shipping_policy' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                <span>Cấu hình tỷ lệ dự phòng cước trả hàng kiểm định</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Tỷ lệ phần trăm dự phòng cước trả hàng từ Trung tâm về cho Người bán đối với đơn kiểm định tại trung tâm.
              </p>
            </div>

            {hasFeeManagePermission && (
              <div className="flex items-center gap-2 shrink-0">
                {isEditingPolicy ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPolicy(false);
                        setInputMarkupPercentage(String(policyMarkupPercentage));
                        setPolicyValidationError(null);
                      }}
                      disabled={isSavingPolicy}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePolicy}
                      disabled={isSavingPolicy || isLoadingPolicy}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    >
                      {isSavingPolicy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu cấu hình</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPolicy(true);
                      setInputMarkupPercentage(String(policyMarkupPercentage));
                      setPolicyValidationError(null);
                    }}
                    disabled={isLoadingPolicy}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Chỉnh sửa</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Cấu hình tỷ lệ */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">Tỷ lệ dự phòng hiện hành:</span>
                <span className="text-xl font-black text-purple-700 bg-purple-50 px-3 py-1 rounded-xl border border-purple-200">
                  {isLoadingPolicy ? '...' : `${policyMarkupPercentage}%`}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    {isEditingPolicy ? 'Cập nhật tỷ lệ phần trăm dự phòng mới (%):' : 'Tỷ lệ phần trăm dự phòng (%):'}
                  </label>
                  {!isEditingPolicy && hasFeeManagePermission && (
                    <span className="text-[11px] font-semibold text-slate-400">

                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      disabled={!isEditingPolicy || !hasFeeManagePermission || isSavingPolicy || isLoadingPolicy}
                      value={isEditingPolicy ? inputMarkupPercentage : policyMarkupPercentage}
                      onChange={(e) => {
                        setInputMarkupPercentage(e.target.value);
                        if (policyValidationError) setPolicyValidationError(null);
                      }}
                      placeholder="Nhập từ 0 đến 100..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 outline-none transition disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>

                  {!isEditingPolicy ? (
                    hasFeeManagePermission && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPolicy(true);
                          setInputMarkupPercentage(String(policyMarkupPercentage));
                          setPolicyValidationError(null);
                        }}
                        disabled={isLoadingPolicy}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Chỉnh sửa</span>
                      </button>
                    )
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPolicy(false);
                          setInputMarkupPercentage(String(policyMarkupPercentage));
                          setPolicyValidationError(null);
                        }}
                        disabled={isSavingPolicy}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePolicy}
                        disabled={!hasFeeManagePermission || isSavingPolicy || isLoadingPolicy}
                        className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed shrink-0"
                      >
                        {isSavingPolicy ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang lưu...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Lưu cấu hình</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {policyValidationError && isEditingPolicy && (
                  <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 animate-fadeIn">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{policyValidationError}</span>
                  </p>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Nhập giá trị từ <strong>0 đến 100</strong>, hỗ trợ tối đa <strong>2 chữ số thập phân</strong>. Cho phép giá trị 0% nếu không áp dụng dự phòng cước. Thay đổi áp dụng ngay cho các lượt lấy báo giá mới.
                </p>
              </div>

              {!hasFeeManagePermission && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Chỉ tài khoản Quản trị viên có quyền <code className="font-mono font-bold">INSPECTION_FEE_MANAGE</code> mới được thay đổi tỷ lệ dự phòng.</span>
                </div>
              )}
            </div>

            {/* Bảng diễn giải công thức và ví dụ */}
            <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/80 space-y-3 text-xs">
              <h4 className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                <span>📐 Ví dụ minh họa tính toán</span>
              </h4>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Khi người mua chọn kiểm định <strong>đưa đến trung tâm</strong>:
              </p>
              <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-200/60 font-mono text-[11px] text-slate-700">
                <div className="flex justify-between">
                  <span>Ví dụ:</span>

                </div>
                <div className="flex justify-between">
                  <span>Phí kiểm định cơ sở:</span>
                  <span className="font-bold text-slate-900">50.000 đ</span>
                </div>
                <div className="flex justify-between">
                  <span>Cước chiều đi (Người bán → Trung tâm):</span>
                  <span className="font-bold text-slate-900">30.000 đ</span>
                </div>
                <div className="flex justify-between text-purple-700">
                  <span>Tỷ lệ dự phòng cấu hình:</span>
                  <span className="font-bold">{policyMarkupPercentage}%</span>
                </div>
                <div className="flex justify-between text-purple-800 border-t border-slate-100 pt-1">
                  <span>Dự phòng cước trả hàng:</span>
                  <span className="font-bold">36.000 đ</span>
                </div>
                <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-bold">
                  <span>Tổng phí thu trước:</span>
                  <span className="text-[#c34c36]">116.000 đ</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic leading-relaxed">
                ↳ Khoản dự phòng 36.000đ sẽ được hoàn lại ví nếu người mua mua tiếp sau kiểm định ĐẠT, hoặc hoàn phần dư sau khi đối soát cước trả hàng thực tế.
              </p>
            </div>
          </div>

          {/* Lịch sử thay đổi tỷ lệ dự phòng */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Lịch sử thay đổi tỷ lệ dự phòng</span>
                    {policyHistoryTotalElements > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {policyHistoryTotalElements} lần thay đổi
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Ghi nhận mọi lần điều chỉnh tỷ lệ dự phòng cước trả hàng kiểm định trên hệ thống
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadReturnShippingPolicyHistory(policyHistoryPage)}
                disabled={isLoadingPolicyHistory}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 shadow-2xs"
                title="Tải lại lịch sử thay đổi"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPolicyHistory ? 'animate-spin text-purple-600' : ''}`} />
                <span>Tải lại</span>
              </button>
            </div>

            {/* Table or Loading / Empty state */}
            {isLoadingPolicyHistory ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span className="text-xs font-medium">Đang tải lịch sử thay đổi...</span>
              </div>
            ) : policyHistory.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-2">
                <History className="w-8 h-8 mx-auto stroke-1 opacity-50" />
                <p className="text-xs font-semibold text-slate-500">Chưa có bản ghi lịch sử thay đổi nào</p>
                <p className="text-[11px] text-slate-400">
                  Khi quản trị viên cập nhật tỷ lệ dự phòng, các phiên bản thay đổi sẽ được lưu trữ tại đây.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                      <th className="py-2.5 px-3 rounded-l-xl">#</th>
                      <th className="py-2.5 px-3">Thời gian thay đổi</th>
                      <th className="py-2.5 px-3 text-right">Tỷ lệ trước</th>
                      <th className="py-2.5 px-2 text-center w-8"></th>
                      <th className="py-2.5 px-3 text-left">Tỷ lệ mới</th>
                      <th className="py-2.5 px-3 text-right">Biến động</th>
                      <th className="py-2.5 px-3 rounded-r-xl">Người thực hiện</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {policyHistory.map((item, idx) => {
                      const prev = item.previousMarkupPercentage != null ? Number(item.previousMarkupPercentage) : null;
                      const next = Number(item.newMarkupPercentage);
                      const diff = prev != null ? next - prev : null;
                      const isCurrentUser =
                        currentUser?.id &&
                        item.changedBy &&
                        String(currentUser.id).toLowerCase() === String(item.changedBy).toLowerCase();

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                            {policyHistoryPage * 10 + idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 text-slate-800 font-medium whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {item.changedAt
                                  ? new Date(item.changedAt).toLocaleString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  })
                                  : '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-600">
                            {prev != null ? `${prev}%` : <span className="text-slate-400 font-normal italic">Khởi tạo</span>}
                          </td>
                          <td className="py-3 px-2 text-center text-slate-400">
                            <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                          </td>
                          <td className="py-3 px-3 text-left font-mono font-black text-purple-700">
                            {next}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {diff === null ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                                Ban đầu
                              </span>
                            ) : diff > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-200/60">
                                <ArrowUpRight className="w-3 h-3" />
                                +{Number(diff.toFixed(2))}%
                              </span>
                            ) : diff < 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/60">
                                <ArrowDownRight className="w-3 h-3" />
                                {Number(diff.toFixed(2))}%
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                0%
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {isCurrentUser ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-200/60">
                                <User className="w-3 h-3" />
                                <span>Bạn (Quản trị viên)</span>
                              </span>
                            ) : item.changedBy ? (
                              <span
                                className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md"
                                title={`Mã định danh quản trị viên: ${item.changedBy}`}
                              >
                                <User className="w-3 h-3 text-slate-400" />
                                <span>Quản trị viên ({item.changedBy.slice(0, 8)})</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Hệ thống</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {policyHistoryTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium text-[11px]">
                  Hiển thị trang <strong className="text-slate-700">{policyHistoryPage + 1}</strong> / <strong className="text-slate-700">{policyHistoryTotalPages}</strong> (Tổng số {policyHistoryTotalElements} lượt thay đổi)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadReturnShippingPolicyHistory(policyHistoryPage - 1)}
                    disabled={policyHistoryPage === 0 || isLoadingPolicyHistory}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: policyHistoryTotalPages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => loadReturnShippingPolicyHistory(i)}
                      disabled={isLoadingPolicyHistory}
                      className={`min-w-7 h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${i === policyHistoryPage
                        ? 'bg-purple-600 text-white'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => loadReturnShippingPolicyHistory(policyHistoryPage + 1)}
                    disabled={policyHistoryPage >= policyHistoryTotalPages - 1 || isLoadingPolicyHistory}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: NGƯỠNG GIÁ BẮT BUỘC KIỂM ĐỊNH (HIGH VALUE POLICY)              */}
      {/* ===================================================================== */}
      {activeSubTab === 'high_value_policy' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>Cấu hình ngưỡng giá bắt buộc kiểm định trước khi đăng</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Sản phẩm có giá cao hơn ngưỡng này phải kiểm định trước khi đăng.
              </p>
            </div>

            {hasAdminConfigPermission && (
              <div className="flex items-center gap-2 shrink-0">
                {isEditingThreshold ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingThreshold(false);
                        setInputThresholdPrice(String(thresholdPrice));
                        setThresholdValidationError(null);
                      }}
                      disabled={isSavingThreshold}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveThreshold}
                      disabled={isSavingThreshold || isLoadingThreshold}
                      className="px-4 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    >
                      {isSavingThreshold ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu cấu hình</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingThreshold(true);
                      setInputThresholdPrice(String(thresholdPrice));
                      setThresholdValidationError(null);
                    }}
                    disabled={isLoadingThreshold}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Chỉnh sửa</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Form cấu hình ngưỡng giá */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">Ngưỡng giá hiện hành:</span>
                <div className="text-right">
                  <span className="text-xl font-black text-cyan-800 bg-cyan-50 px-3 py-1 rounded-xl border border-cyan-200">
                    {isLoadingThreshold ? '...' : formatVND(thresholdPrice)}
                  </span>
                  {thresholdVersion && (
                    <span className="text-[10px] text-slate-400 block mt-1">Phiên bản chính sách: v{thresholdVersion}</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    {isEditingThreshold ? 'Cập nhật ngưỡng giá bắt buộc kiểm định (VND):' : 'Ngưỡng giá kiểm định bắt buộc (VND):'}
                  </label>
                  {!isEditingThreshold && hasAdminConfigPermission && (
                    <span className="text-[11px] font-semibold text-slate-400">
                      (Chế độ chỉ xem — bấm chỉnh sửa để thay đổi)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={1000}
                      step={100000}
                      disabled={!isEditingThreshold || !hasAdminConfigPermission || isSavingThreshold || isLoadingThreshold}
                      value={isEditingThreshold ? inputThresholdPrice : thresholdPrice}
                      onChange={(e) => {
                        setInputThresholdPrice(e.target.value);
                        if (thresholdValidationError) setThresholdValidationError(null);
                      }}
                      placeholder="Ví dụ: 10000000..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 outline-none transition disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      VND
                    </span>
                  </div>

                  {!isEditingThreshold ? (
                    hasAdminConfigPermission && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingThreshold(true);
                          setInputThresholdPrice(String(thresholdPrice));
                          setThresholdValidationError(null);
                        }}
                        disabled={isLoadingThreshold}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Chỉnh sửa</span>
                      </button>
                    )
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingThreshold(false);
                          setInputThresholdPrice(String(thresholdPrice));
                          setThresholdValidationError(null);
                        }}
                        disabled={isSavingThreshold}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveThreshold}
                        disabled={isSavingThreshold || isLoadingThreshold}
                        className="px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {isSavingThreshold ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang lưu...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Lưu ngưỡng giá</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isEditingThreshold && inputThresholdPrice && !isNaN(Number(inputThresholdPrice)) && (
                  <p className="text-[11px] text-cyan-800 font-medium italic">
                    Hiển thị tiền tệ: <strong>{formatVND(Number(inputThresholdPrice))}</strong>
                  </p>
                )}

                {thresholdValidationError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{thresholdValidationError}</span>
                  </div>
                )}

                <div className="p-3.5 bg-cyan-50/70 border border-cyan-200/80 rounded-2xl text-xs text-cyan-950 space-y-1">
                  <span className="font-bold block">Quy tắc áp dụng chính sách giá trị cao:</span>
                  <p>
                    Sản phẩm có giá cao hơn ngưỡng này phải kiểm định trước khi đăng.

                  </p>
                </div>
              </div>

              {!hasAdminConfigPermission && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Chỉ tài khoản Quản trị viên có quyền <code className="font-mono font-bold">ADMIN_CONFIG_MANAGE</code> mới được thay đổi ngưỡng giá.</span>
                </div>
              )}
            </div>

            {/* Hướng dẫn & Lưu ý chính sách */}
            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 space-y-3 text-xs">
              <span className="font-bold text-slate-900 block text-sm">
                Lưu ý quản trị & quyền hạn
              </span>
              <p className="text-slate-600 leading-relaxed">
                Ngưỡng giá này áp dụng ngay lập tức cho tất cả các bài đăng mới được gửi duyệt sau thời điểm lưu.
              </p>
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Quyền yêu cầu:</span>
                  <span className="font-mono font-bold text-slate-800">ADMIN</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Đối tượng chịu phí:</span>
                  <span className="font-bold text-slate-800">Người bán (100%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: SO SÁNH BẬC PHÍ CHI TIẾT (SIDE-BY-SIDE DIFF VIEW)           */}
      {/* ===================================================================== */}
      {viewingProposal && (() => {
        const isTravelOnly = (viewingProposal.tiers?.length ?? 0) > 0 && !viewingProposal.complexityLevel;
        const centerInfo = getProposalCenterInfo(viewingProposal);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {isTravelOnly
                        ? `Chi tiết & so sánh đề xuất cước di chuyển #${viewingProposal.id.slice(0, 8)}`
                        : `Chi tiết & so sánh đề xuất biểu phí #${viewingProposal.id.slice(0, 8)}`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Đề xuất bởi <strong>{centerInfo.name}</strong> {centerInfo.areaBadge ? `(${centerInfo.areaBadge})` : ''} •{' '}
                      {viewingProposal.createdAt ? new Date(viewingProposal.createdAt).toLocaleString('vi-VN') : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingProposal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Proposal Key Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl">
                <div>
                  {isTravelOnly ? (
                    <>
                      <span className="text-[11px] font-bold text-slate-400 block">Số bậc cước đề xuất</span>
                      <span className="text-lg font-black text-blue-600">
                        {viewingProposal.tiers?.length || 6} bậc thang
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Bảng bậc thang cước di chuyển kỹ thuật viên theo km
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-bold text-slate-400 block">Phí kiểm định cơ sở đề xuất</span>
                      <span className="text-lg font-black text-[#c34c36]">
                        {formatVND(viewingProposal.baseInspectionFee || 0)}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Phí cơ sở áp dụng theo danh mục sản phẩm trong CSDL
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Phạm vi áp dụng</span>
                  <span className="text-xs font-bold text-slate-800">
                    {isTravelOnly
                      ? 'Kiểm định tại nhà (Toàn quốc)'
                      : viewingProposal.complexityLevel
                        ? `Cấp ${viewingProposal.complexityLevel} (${viewingProposal.categoryName || 'Tất cả danh mục'})`
                        : viewingProposal.categoryName || 'Tất cả danh mục sản phẩm'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Trạng thái</span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black mt-1 ${viewingProposal.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : viewingProposal.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                      }`}
                  >
                    {viewingProposal.status === 'PENDING_APPROVAL' || viewingProposal.status === 'PENDING'
                      ? 'Chờ duyệt'
                      : viewingProposal.status === 'APPROVED'
                        ? 'Đã phê duyệt'
                        : 'Đã từ chối'}
                  </span>
                  {viewingProposal.rejectReason && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      Lý do từ chối: {viewingProposal.rejectReason}
                    </p>
                  )}
                </div>
              </div>

              {/* Side-by-Side Comparison Table (if has tiers) */}
              {viewingProposal.tiers && viewingProposal.tiers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 tracking-wide">
                    Bảng so sánh cước bậc thang di chuyển (Hiện hành vs đề xuất)
                  </h4>
                  <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-gray-100 text-xs">
                          <th className="py-2.5 px-3">Bậc</th>
                          <th className="py-2.5 px-3">Tên bậc</th>
                          <th className="py-2.5 px-3">Cự ly hiện hành</th>
                          <th className="py-2.5 px-3">Cự ly đề xuất</th>
                          <th className="py-2.5 px-3">Đơn giá hiện hành</th>
                          <th className="py-2.5 px-3">Đơn giá đề xuất</th>
                          <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(viewingProposal.tiers || []).map((proposedTier, idx) => {
                          const activeTier = travelTiers.find((t) => t.tierNumber === proposedTier.tierNumber) || travelTiers[idx];
                          const oldPrice = activeTier?.pricePerKm ?? 0;
                          const newPrice = proposedTier.pricePerKm ?? 0;
                          const diff = newPrice - oldPrice;

                          const oldDist = activeTier
                            ? `${activeTier.fromKm ?? 0} - ${activeTier.toKm != null ? `${activeTier.toKm} km` : '∞'}`
                            : '—';
                          const newDist = `${proposedTier.fromKm ?? 0} - ${proposedTier.toKm != null ? `${proposedTier.toKm} km` : '∞'
                            }`;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                #{proposedTier.tierNumber || idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {proposedTier.name}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {oldDist}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 font-mono">
                                {newDist}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {formatVND(oldPrice)}/km
                              </td>
                              <td className="py-2.5 px-3 font-bold text-[#c34c36] font-mono">
                                {formatVND(newPrice)}/km
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold font-mono">
                                {diff > 0 ? (
                                  <span className="text-rose-600">+{formatVND(diff)}</span>
                                ) : diff < 0 ? (
                                  <span className="text-blue-600">{formatVND(diff)}</span>
                                ) : (
                                  <span className="text-slate-400">Không đổi</span>
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

              {/* Bottom Actions if Pending */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button
                  onClick={() => setViewingProposal(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 cursor-pointer"
                >
                  Đóng
                </button>

                {(viewingProposal.status === 'PENDING_APPROVAL' || viewingProposal.status === 'PENDING') && hasFeeManagePermission && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const p = viewingProposal;
                        setViewingProposal(null);
                        handleOpenReview(p, 'REJECT');
                      }}
                      className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      <span>Từ chối đề xuất</span>
                    </button>
                    <button
                      onClick={() => {
                        const p = viewingProposal;
                        setViewingProposal(null);
                        handleOpenReview(p, 'APPROVE');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Phê duyệt đề xuất</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL 2: REVIEW PROPOSAL (APPROVE / REJECT DIALOG)                    */}
      {/* ===================================================================== */}
      {isReviewModalOpen && selectedProposal && (() => {
        const isTravelOnly = (selectedProposal.tiers?.length ?? 0) > 0 && !selectedProposal.complexityLevel;
        const centerInfo = getProposalCenterInfo(selectedProposal);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-xl ${reviewAction === 'APPROVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                  >
                    {reviewAction === 'APPROVE' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                  </div>
                  <h3 className="text-base font-black text-slate-900">
                    {isTravelOnly
                      ? (reviewAction === 'APPROVE' ? 'Phê duyệt đề xuất cước di chuyển' : 'Từ chối đề xuất cước di chuyển')
                      : (reviewAction === 'APPROVE' ? 'Phê duyệt đề xuất biểu phí' : 'Từ chối đề xuất biểu phí')}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsReviewModalOpen(false);
                    setReviewError(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                {isTravelOnly ? (
                  <>
                    Bạn đang thực hiện <strong>{reviewAction === 'APPROVE' ? 'phê duyệt' : 'từ chối'}</strong> đề xuất cước di chuyển #
                    <strong>{selectedProposal.id.slice(0, 8)}</strong> gồm <strong>{selectedProposal.tiers?.length || 6} bậc thang</strong> của{' '}
                    <strong className="text-blue-700">{centerInfo.name}</strong>.
                  </>
                ) : (
                  <>
                    Bạn đang thực hiện <strong>{reviewAction === 'APPROVE' ? 'phê duyệt' : 'từ chối'}</strong> đề xuất biểu phí #
                    <strong>{selectedProposal.id.slice(0, 8)}</strong> với mức phí cơ sở đề xuất:{' '}
                    <strong className="text-[#c34c36]">{formatVND(selectedProposal.baseInspectionFee || 0)}</strong>.
                  </>
                )}
              </p>

              {reviewError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{reviewError}</span>
                </div>
              )}

              {reviewAction === 'APPROVE' && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  {isTravelOnly
                    ? 'Khi phê duyệt, bảng 6 bậc thang cước di chuyển trên toàn hệ thống sẽ được tự động cập nhật theo các bậc trong đề xuất này.'
                    : `Khi phê duyệt, biểu phí cơ sở cấp ${selectedProposal.complexityLevel || 'L1–L4'} sẽ được kích hoạt cho trung tâm kiểm định.`}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Ghi chú / ý kiến phản hồi {reviewAction === 'REJECT' && <span className="text-rose-500">* (Bắt buộc)</span>}:
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => {
                    setReviewNote(e.target.value);
                    if (reviewError) setReviewError(null);
                  }}
                  placeholder={
                    reviewAction === 'APPROVE'
                      ? 'Nhập căn cứ phê duyệt (không bắt buộc)...'
                      : 'Nhập lý do từ chối để Trung tâm kiểm định nắm rõ và điều chỉnh lại...'
                  }
                  className={`w-full p-3 rounded-xl border text-xs outline-hidden transition ${
                    reviewError
                      ? 'border-rose-400 ring-2 ring-rose-200'
                      : 'border-gray-200 focus:ring-2 focus:ring-amber-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsReviewModalOpen(false);
                    setReviewError(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmittingReview}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer ${reviewAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                >
                  {isSubmittingReview && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{reviewAction === 'APPROVE' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: XEM CHI TIẾT BỘ TIÊU CHUẨN ĐỀ XUẤT */}
      {viewingChecklistProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-bold">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Chi tiết bộ tiêu chuẩn: {viewingChecklistProposal.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Loại thiết bị: <strong>{viewingChecklistProposal.itemName || 'Chưa gắn loại thiết bị cụ thể'}</strong>{' '}
                    {viewingChecklistProposal.categoryName ? `(Danh mục: ${viewingChecklistProposal.categoryName})` : ''} • Cấp độ: <strong>{viewingChecklistProposal.complexityLevel ? `Cấp ${viewingChecklistProposal.complexityLevel}` : 'Chưa phân cấp'}</strong> • Phiên bản: <strong>v{viewingChecklistProposal.revision || 1}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingChecklistProposal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Pricing details from author inspection center */}
            {viewingChecklistProposal.pricing && (
              <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2 shrink-0">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Building2 className="w-4 h-4 text-amber-600" />
                    <span>Biểu phí độ phức tạp của trung tâm tác giả</span>
                  </div>
                  {(() => {
                    const centerInfo = getCenterDetails(viewingChecklistProposal);
                    return (
                      <div className="text-right">
                        <span className="text-[11px] text-slate-900 font-bold block">
                          {centerInfo.fullName}
                        </span>
                        <span className="text-[10px] text-amber-700 font-semibold flex items-center justify-end gap-1">
                          <MapPin className="w-2.5 h-2.5 text-amber-600" />
                          <span>Khu vực: {centerInfo.areaTitle}</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-0.5">
                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block">Cấp độ áp dụng</span>
                    <span className="font-black text-slate-900 mt-0.5 block">
                      {viewingChecklistProposal.pricing.complexityLevel ? `Cấp ${viewingChecklistProposal.pricing.complexityLevel}` : 'Chưa phân cấp'}
                    </span>
                  </div>

                  {viewingChecklistProposal.pricing.pendingBaseInspectionFee != null ? (
                    <>
                      <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-300">
                        <span className="text-[10px] font-bold text-amber-700 block">Biểu phí đang đề xuất</span>
                        <span className="font-black text-[#c34c36] mt-0.5 block">
                          {formatVND(viewingChecklistProposal.pricing.pendingBaseInspectionFee)}
                        </span>
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-200/60 px-1 py-0.2 rounded mt-0.5 inline-block">
                          Chờ quản trị viên duyệt
                        </span>
                        {viewingChecklistProposal.pricing.baseInspectionFee != null && (
                          <div className="text-[10px] text-slate-400 line-through mt-0.5">
                            Giá cũ: {formatVND(viewingChecklistProposal.pricing.baseInspectionFee)}
                          </div>
                        )}
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 block">Trạng thái biểu phí</span>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 mt-1">
                          Chờ duyệt giá mới
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white p-2 rounded-xl border border-slate-200/70 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 block">Biểu phí cơ sở đã duyệt</span>
                      <span className="font-black text-emerald-700 mt-0.5 block">
                        {viewingChecklistProposal.pricing.baseInspectionFee != null
                          ? formatVND(viewingChecklistProposal.pricing.baseInspectionFee)
                          : 'Chưa có giá được duyệt'}
                      </span>
                      {viewingChecklistProposal.pricing.baseInspectionFee != null && !viewingChecklistProposal.pricing.applicable && (
                        <span className="text-[9px] text-amber-700 italic block mt-0.5">Giá tham khảo tại cấp đề xuất</span>
                      )}
                    </div>
                  )}

                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block">Hiệu lực áp dụng</span>
                    <div className="mt-0.5">
                      {viewingChecklistProposal.pricing.pendingBaseInspectionFee != null ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Đang đổi giá
                        </span>
                      ) : viewingChecklistProposal.pricing.applicable ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sẵn sàng áp dụng
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500">
                          Chưa hiệu lực {viewingChecklistProposal.pricing.unavailableReason ? `(${getUnavailableReasonLabel(viewingChecklistProposal.pricing.unavailableReason)})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {viewingChecklistProposal.pricing.pendingBaseInspectionFee != null && hasFeeManagePermission && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs text-amber-900 font-medium">
                        Trung tâm đang có đề xuất đổi giá cấp <strong>{viewingChecklistProposal.pricing.complexityLevel}</strong> sang <strong>{formatVND(viewingChecklistProposal.pricing.pendingBaseInspectionFee)}</strong>.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setViewingChecklistProposal(null);
                        setActiveSubTab('proposals');
                        setProposalStatusFilter('PENDING_APPROVAL');
                        loadProposals(0, 'PENDING_APPROVAL');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#24263e] hover:bg-black text-white text-[11px] font-bold shrink-0 cursor-pointer shadow-xs"
                    >
                      Sang tab Biểu phí KTV để duyệt
                    </button>
                  </div>
                )}

                <p className="text-[10px] text-slate-500 italic">
                  * Biểu phí cơ sở tính theo cấp độ tại trung tâm tác giả. Không có một giá chung duy nhất cho mỗi loại thiết bị trên toàn sàn; người mua chọn trung tâm nào sẽ tính phí theo bảng giá cấp độ của trung tâm đó.
                </p>
              </div>
            )}

            {viewingChecklistProposal.description && (
              <div className="p-3 bg-slate-50 rounded-xl text-slate-700 text-xs border border-slate-100 shrink-0">
                <strong>Căn cứ kỹ thuật & phạm vi:</strong> {viewingChecklistProposal.description}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
              <div className="font-bold text-slate-800 text-xs mb-2 flex items-center justify-between">
                <span>Danh sách {(viewingChecklistProposal.items || []).length} tiêu chí đo kiểm chi tiết:</span>
                <span className="text-[11px] font-normal text-slate-500">
                  (Bắt buộc: {(viewingChecklistProposal.items || []).filter((i) => i.mandatory !== false).length} / {(viewingChecklistProposal.items || []).length})
                </span>
              </div>
              {(viewingChecklistProposal.items || []).map((it, idx) => (
                <div
                  key={it.id || idx}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-slate-400 font-bold shrink-0 mt-0.5 text-xs">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 text-xs break-words leading-relaxed">
                        {it.itemTitle}
                      </span>
                    </div>
                    {it.criteriaDescription && (
                      <p className="text-[11px] text-slate-600 pl-6 break-words leading-relaxed">
                        {it.criteriaDescription}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 self-start pt-0.5">
                    {it.mandatory !== false ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 whitespace-nowrap shadow-2xs">
                        Bắt buộc (Đạt/Không đạt)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60 whitespace-nowrap shadow-2xs">
                        Tùy chọn
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>Trạng thái:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${viewingChecklistProposal.approvalStatus === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : viewingChecklistProposal.approvalStatus === 'REJECTED'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : viewingChecklistProposal.approvalStatus === 'PENDING_APPROVAL' ||
                        (viewingChecklistProposal.approvalStatus as string) === 'PENDING'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : viewingChecklistProposal.approvalStatus === 'WITHDRAWN'
                          ? 'bg-slate-100 text-slate-600 border-slate-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                >
                  {getApprovalStatusLabel(viewingChecklistProposal.approvalStatus)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {viewingChecklistProposal.approvalStatus === 'PENDING_APPROVAL' && hasFeeManagePermission && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenReviewChecklist(viewingChecklistProposal, 'REJECT');
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition"
                    >
                      <X className="w-4 h-4" />
                      <span>Từ chối đề xuất</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenReviewChecklist(viewingChecklistProposal, 'APPROVE');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Phê duyệt đề xuất</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setViewingChecklistProposal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PHÊ DUYỆT / TỪ CHỐI BỘ TIÊU CHUẨN */}
      {isReviewChecklistModalOpen && reviewingChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                {checklistReviewAction === 'APPROVE' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
                <span>
                  {checklistReviewAction === 'APPROVE' ? 'Phê duyệt bộ tiêu chuẩn' : 'Từ chối đề xuất bộ tiêu chuẩn'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsReviewChecklistModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitChecklistReview} className="space-y-4">
              {checklistReviewError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checklistReviewError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <div><strong>Tiêu chuẩn:</strong> {reviewingChecklist.title}</div>
                <div><strong>Thiết bị áp dụng:</strong> {reviewingChecklist.itemName || reviewingChecklist.categoryName}</div>
                <div><strong>Cấp độ kiểm định:</strong> Cấp {reviewingChecklist.complexityLevel || 'L1'}</div>
              </div>

              {checklistReviewAction === 'APPROVE' ? (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 space-y-1">
                  <p className="font-bold">Xác nhận phê duyệt:</p>
                  <p>Khi phê duyệt, bộ tiêu chuẩn này cùng cấp độ {reviewingChecklist.complexityLevel || 'L1'} sẽ trở thành tiêu chuẩn kỹ thuật có hiệu lực chính thức toàn hệ thống cho thiết bị này.</p>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lý do từ chối đề xuất <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={checklistReviewReason}
                    onChange={(e) => setChecklistReviewReason(e.target.value)}
                    placeholder="Nêu rõ lý do từ chối (ví dụ: thiếu tiêu chí kiểm tra rò điện, cấp độ L1 chưa tương xứng...)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:border-[#c34c36] outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsReviewChecklistModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChecklistReview}
                  className={`px-5 py-2 rounded-xl text-white font-bold transition cursor-pointer shadow-xs ${checklistReviewAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                >
                  {isSubmittingChecklistReview ? 'Đang xử lý...' : checklistReviewAction === 'APPROVE' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
