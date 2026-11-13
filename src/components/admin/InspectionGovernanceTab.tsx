import React, { useState, useEffect, useMemo } from 'react';
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
  Loader2
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
  canManageInspectionFee
} from '../../services/inspectorService';

interface InspectionGovernanceTabProps {
  lang: Language;
  currentUser?: any;
}

export const InspectionGovernanceTab: React.FC<InspectionGovernanceTabProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'checklist_proposals' | 'proposals' | 'travel_tiers' | 'return_shipping_policy'>('checklist_proposals');

  // Return Shipping Reserve Policy state
  const [policyMarkupPercentage, setPolicyMarkupPercentage] = useState<number>(20);
  const [inputMarkupPercentage, setInputMarkupPercentage] = useState<string>('20');
  const [isEditingPolicy, setIsEditingPolicy] = useState<boolean>(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState<boolean>(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState<boolean>(false);
  const [policyValidationError, setPolicyValidationError] = useState<string | null>(null);

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

  // Fetch return shipping policy when subtab selected or on mount
  useEffect(() => {
    if (activeSubTab === 'return_shipping_policy') {
      setIsEditingPolicy(false);
      setPolicyValidationError(null);
      setIsLoadingPolicy(true);
      inspectorService.getReturnShippingPolicy()
        .then((res) => {
          const val = typeof res?.markupPercentage === 'number' ? res.markupPercentage : 20;
          setPolicyMarkupPercentage(val);
          setInputMarkupPercentage(String(val));
        })
        .catch((err) => {
          console.warn('Failed to load return shipping policy:', err);
        })
        .finally(() => {
          setIsLoadingPolicy(false);
        });
    }
  }, [activeSubTab]);

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
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Không thể lưu tỷ lệ dự phòng cước trả hàng.'
      });
    } finally {
      setIsSavingPolicy(false);
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

  // Proposals state
  const [proposals, setProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [proposalStatusFilter, setProposalStatusFilter] = useState<'ALL' | InspectionFeeProposalStatus>('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const pageSize = 10;

  // Selected Proposal for Details & Diff View
  const [viewingProposal, setViewingProposal] = useState<InspectionFeeProposalResponse | null>(null);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<InspectionFeeProposalResponse | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Travel tiers state
  const [travelTiers, setTravelTiers] = useState<InspectionTravelTierDto[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);
  const [isEditingTiers, setIsEditingTiers] = useState(false);
  const [editedTiers, setEditedTiers] = useState<InspectionTravelTierDto[]>([]);
  const [tierValidationError, setTierValidationError] = useState<string | null>(null);

  // Preview before saving tiers directly
  const [isPreviewSaveTiersOpen, setIsPreviewSaveTiersOpen] = useState(false);
  const [isSavingTiers, setIsSavingTiers] = useState(false);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  useEffect(() => {
    // Initial data fetch
    inspectorService
      .getInspectionCenters()
      .then((loadedCenters) => {
        setCenters(loadedCenters);
        loadChecklistProposals(0, undefined, loadedCenters);
      })
      .catch(() => {
        loadChecklistProposals(0);
      });
    loadProposals(0, proposalStatusFilter);
    loadTravelTiers();

    // Fetch catalogs for filters
    categoryService.getCategories().then(setCategories).catch(() => {});
    itemService.getItems().then(setItems).catch(() => {});
  }, []);

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

      const searchParams: InspectionChecklistSearchParams = {
        keyword: kw && kw.trim() ? kw.trim().slice(0, 120) : undefined,
        status: st && st !== 'ALL' ? (st as any) : undefined,
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
      setChecklistProposals(enrichedList);
      setChecklistTotalPages(data.totalPages || 1);
      setChecklistTotalElements(data.totalElements || rawList.length);
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

  const loadProposals = async (targetPage: number = 0, statusFilter: string = proposalStatusFilter) => {
    setIsLoadingProposals(true);
    try {
      const data = await inspectorService.getAdminFeeProposals(statusFilter, targetPage, pageSize);
      setProposals(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalElements || 0);
      setPage(data.page || 0);
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
    loadProposals(0, newStatus);
  };

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
      setEditedTiers(JSON.parse(JSON.stringify(tiers)));
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
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedProposal) return;
    if (reviewAction === 'REJECT' && !reviewNote.trim()) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập lý do từ chối đề xuất để trung tâm kiểm định nắm rõ' });
      return;
    }

    setIsSubmittingReview(true);
    setFeedback(null);
    try {
      await inspectorService.reviewFeeProposal(selectedProposal.id, {
        approved: reviewAction === 'APPROVE',
        reason: reviewNote.trim() || undefined,
      });

      setFeedback({
        type: 'success',
        message: reviewAction === 'APPROVE'
          ? 'Đã phê duyệt đề xuất biểu phí thành công! Bảng bậc cước di chuyển đã được tự động cập nhật.'
          : 'Đã từ chối đề xuất biểu phí thành công.'
      });

      setIsReviewModalOpen(false);
      setSelectedProposal(null);
      if (viewingProposal?.id === selectedProposal.id) {
        setViewingProposal(null);
      }
      // Reload both proposals and active travel tiers
      loadProposals(page, proposalStatusFilter);
      loadTravelTiers();
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
        if (viewingProposal?.id === selectedProposal?.id) setViewingProposal(null);
        loadProposals(page, proposalStatusFilter);
        loadTravelTiers();
      } else {
        setFeedback({ type: 'error', message: errorMsg || 'Xét duyệt đề xuất thất bại. Vui lòng thử lại.' });
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Direct Tier Editing handlers
  const handleTierChange = (index: number, field: keyof InspectionTravelTierDto, value: any) => {
    const updated = [...editedTiers];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTiers(updated);
    setTierValidationError(null);
  };

  const validateEditedTiers = (): string | null => {
    if (!editedTiers || editedTiers.length === 0) {
      return 'Danh sách bậc thang không được để trống';
    }

    for (let i = 0; i < editedTiers.length; i++) {
      const t = editedTiers[i];
      if (!t.name || !t.name.trim()) {
        return `Bậc #${t.tierNumber || i + 1}: Tên bậc không được để trống`;
      }
      const fromKm = Number(t.fromKm);
      if (isNaN(fromKm) || fromKm < 0) {
        return `Bậc #${t.tierNumber || i + 1}: Khoảng cách từ (fromKm) phải là số không âm`;
      }
      if (t.toKm !== null && t.toKm !== undefined && String(t.toKm).trim() !== '') {
        const toKm = Number(t.toKm);
        if (isNaN(toKm) || toKm <= fromKm) {
          return `Bậc #${t.tierNumber || i + 1}: Khoảng cách đến (toKm = ${toKm}) phải lớn hơn khoảng cách từ (${fromKm} km)`;
        }
      }
      const price = Number(t.pricePerKm);
      if (isNaN(price) || price < 0) {
        return `Bậc #${t.tierNumber || i + 1}: Đơn giá / km phải là số không âm`;
      }
    }

    return null;
  };

  const handleOpenPreviewSaveTiers = () => {
    const err = validateEditedTiers();
    if (err) {
      setTierValidationError(err);
      return;
    }
    setTierValidationError(null);
    setIsPreviewSaveTiersOpen(true);
  };

  const handleConfirmSaveTiers = async () => {
    setIsSavingTiers(true);
    setFeedback(null);
    try {
      const saved = await inspectorService.updateAdminTravelTiers(editedTiers);
      setTravelTiers(saved);
      setEditedTiers(JSON.parse(JSON.stringify(saved)));
      setIsEditingTiers(false);
      setIsPreviewSaveTiersOpen(false);
      setFeedback({
        type: 'success',
        message: 'Đã cập nhật trực tiếp bảng 6 bậc thang cước di chuyển KTV thành công!'
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Cập nhật bảng bậc thang thất bại' });
    } finally {
      setIsSavingTiers(false);
    }
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
              Quản Trị Biểu Phí & Bậc Thang Kiểm Định
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Xét duyệt đề xuất từ Trung tâm kiểm định và kiểm soát bảng giá bậc thang di chuyển KTV toàn hệ thống
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
                loadProposals(page, proposalStatusFilter);
              } else {
                loadTravelTiers();
              }
            }}
            disabled={isLoadingChecklistProposals || isLoadingProposals || isLoadingTiers}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
            title="Tải lại dữ liệu tab hiện tại"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(isLoadingChecklistProposals || isLoadingProposals || isLoadingTiers) ? 'animate-spin text-amber-600' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Balanced 4-Column Navigation Tab Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60">
        <button
          type="button"
          onClick={() => setActiveSubTab('checklist_proposals')}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'checklist_proposals'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">Tiêu Chuẩn & Cấp Độ</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
            activeSubTab === 'checklist_proposals' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {checklistTotalElements}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('proposals')}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'proposals'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">Biểu Phí KTV</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
            activeSubTab === 'proposals' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {totalElements}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('travel_tiers')}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'travel_tiers'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Navigation className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">Cước Di Chuyển</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
            activeSubTab === 'travel_tiers' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {travelTiers.length || 6} bậc
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('return_shipping_policy')}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'return_shipping_policy'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="truncate">Dự Phòng Cước Trả Hàng</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
            activeSubTab === 'return_shipping_policy' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {policyMarkupPercentage}%
          </span>
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
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn ${
            feedback.type === 'success'
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
                Danh Sách Đề Xuất Bộ Tiêu Chuẩn Kỹ Thuật & Cấp Độ (L1–L4)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Mỗi loại thiết bị (Item) chỉ có 1 bộ tiêu chuẩn hiệu lực toàn sàn. Kèm biểu phí theo trung tâm tác giả và cấp độ L1–L4.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-medium shrink-0">
              Tổng cộng: <strong className="text-slate-700">{checklistTotalElements}</strong> bộ tiêu chuẩn
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
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                    isFilterExpanded || activeFiltersCount > (checklistKeyword.trim() ? 1 : 0)
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
                { key: 'WITHDRAWN', label: 'Đã rút' },
                { key: 'LEGACY', label: 'Bản cũ (Hệ thống)' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleChecklistStatusFilterChange(st.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    checklistStatusFilter === st.key
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Collapsible Advanced Filters */}
            {isFilterExpanded && (
              <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 animate-fadeIn">
                {/* Complexity Level Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Cấp Độ Kỹ Thuật
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Danh Mục
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Loại Thiết Bị (Item)
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Trung Tâm Tác Giả
                  </label>
                  <select
                    value={checklistCenterFilter}
                    onChange={(e) => {
                      const ctr = e.target.value;
                      setChecklistCenterFilter(ctr);
                      setChecklistPage(0);
                      loadChecklistProposals(0, { inspectionCenterId: ctr !== 'ALL' ? ctr : undefined });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-hidden focus:border-amber-500"
                  >
                    <option value="ALL">-- Tất cả trung tâm --</option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active version filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Hiệu Lực Toàn Sàn
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
                    <option value="ACTIVE">Đang kích hoạt (Active)</option>
                    <option value="INACTIVE">Chưa kích hoạt (Inactive)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Checklist Proposals Table */}
          <div className="border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs table-auto">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-2 w-8 text-center">#</th>
                  <th className="py-3 px-2.5 w-[16%]">Loại Thiết Bị & Danh Mục</th>
                  <th className="py-3 px-1.5 w-[7%] text-center">Cấp Độ</th>
                  <th className="py-3 px-2.5 w-[22%]">Bộ Tiêu Chuẩn</th>
                  <th className="py-3 px-2 w-[13%]">Trung Tâm Tác Giả</th>
                  <th className="py-3 px-2 w-[11%] text-right">Giá Cấp Đã Duyệt</th>
                  <th className="py-3 px-2 w-[10%] text-right">Giá Đang Đề Xuất</th>
                  <th className="py-3 px-1.5 w-[7%] text-center">Hiệu Lực</th>
                  <th className="py-3 px-1.5 w-[7%] text-center">Trạng Thái</th>
                  <th className="py-3 px-2 w-[7%] text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingChecklistProposals ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                      <span>Đang tải danh sách đề xuất tiêu chuẩn checklist & pricing...</span>
                    </td>
                  </tr>
                ) : checklistProposals.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
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
                              className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                chk.complexityLevel === 'L1'
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
                                Active
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Trung Tâm Tác Giả */}
                        <td className="py-2.5 px-2">
                          <div
                            className="font-bold text-slate-800 text-xs line-clamp-1"
                            title={pricing?.inspectionCenterName || 'Trung tâm tác giả'}
                          >
                            {pricing?.inspectionCenterName || 'Trung tâm tác giả'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {chk.createdAt ? new Date(chk.createdAt).toLocaleDateString('vi-VN') : '—'}
                          </div>
                        </td>

                        {/* Giá Cấp Đã Duyệt */}
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          {pricing?.baseInspectionFee != null ? (
                            <div>
                              <span className="font-black text-slate-900 text-xs">
                                {formatVND(pricing.baseInspectionFee)}
                              </span>
                              {pricing.applicable ? (
                                <span className="text-[10px] font-bold text-emerald-600 block">
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

                        {/* Giá Đang Đề Xuất */}
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          {pricing?.pendingBaseInspectionFee != null ? (
                            <div>
                              <span className="font-black text-[#c34c36] text-xs">
                                {formatVND(pricing.pendingBaseInspectionFee)}
                              </span>
                              <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                                Chờ duyệt giá
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>

                        {/* Hiệu Lực Giá */}
                        <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                          {pricing?.applicable ? (
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
                                      ? 'Checklist chưa được duyệt hoặc chưa active'
                                      : pricing.unavailableReason === 'NO_APPROVED_LEVEL_FEE'
                                      ? 'Trung tâm chưa có giá được duyệt cho cấp này'
                                      : pricing.unavailableReason === 'ITEM_NOT_CLASSIFIED'
                                      ? 'Chưa gắn Item hoặc là checklist cũ'
                                      : pricing.unavailableReason === 'CENTER_UNAVAILABLE'
                                      ? 'Trung tâm không đủ điều kiện hoạt động'
                                      : pricing.unavailableReason === 'ITEM_NOT_SELECTABLE'
                                      ? 'Item đã ngừng cho chọn'
                                      : pricing.unavailableReason
                                  }
                                >
                                  {pricing.unavailableReason === 'CHECKLIST_NOT_EFFECTIVE'
                                    ? 'Chờ duyệt CL'
                                    : pricing.unavailableReason === 'NO_APPROVED_LEVEL_FEE'
                                    ? 'Chưa duyệt giá'
                                    : pricing.unavailableReason === 'ITEM_NOT_CLASSIFIED'
                                    ? 'Chưa phân cấp'
                                    : pricing.unavailableReason === 'CENTER_UNAVAILABLE'
                                    ? 'TT ngừng HĐ'
                                    : pricing.unavailableReason === 'ITEM_NOT_SELECTABLE'
                                    ? 'Item ngừng chọn'
                                    : pricing.unavailableReason}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Trạng Thái Checklist */}
                        <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                          {chk.approvalStatus === 'APPROVED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 whitespace-nowrap">
                              Đã Duyệt
                            </span>
                          ) : chk.approvalStatus === 'REJECTED' ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 whitespace-nowrap">
                                Từ Chối
                              </span>
                              {chk.rejectReason && (
                                <span className="text-[9px] text-rose-600 truncate max-w-[90px] mt-0.5" title={chk.rejectReason}>
                                  {chk.rejectReason}
                                </span>
                              )}
                            </div>
                          ) : chk.approvalStatus === 'WITHDRAWN' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500 whitespace-nowrap">
                              Đã Rút
                            </span>
                          ) : chk.approvalStatus === 'LEGACY' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap" title="Checklist hệ thống cũ">
                              Bản Cũ
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 animate-pulse whitespace-nowrap">
                              Chờ Duyệt
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
          {checklistTotalPages > 1 && (
            <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">
                Trang <strong>{checklistPage + 1}</strong> / {checklistTotalPages} ({checklistTotalElements} bộ tiêu chuẩn)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleChecklistPageChange(checklistPage - 1)}
                  disabled={checklistPage <= 0 || isLoadingChecklistProposals}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChecklistPageChange(checklistPage + 1)}
                  disabled={checklistPage >= checklistTotalPages - 1 || isLoadingChecklistProposals}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition"
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
      {/* TAB 1: ĐỀ XUẤT BIỂU PHÍ (PROPOSALS)                                   */}
      {/* ===================================================================== */}
      {activeSubTab === 'proposals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Danh Sách Đề Xuất Biểu Phí KTV Từ Các Trung Tâm Kiểm Định
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Xét duyệt biểu phí cơ sở L1–L4 hoặc theo danh mục kèm bậc thang cước di chuyển do trung tâm đề xuất
              </p>
            </div>
            <div className="text-xs text-slate-400 font-medium shrink-0">
              Tổng cộng: <strong className="text-slate-700">{totalElements}</strong> đề xuất biểu phí
            </div>
          </div>

          {/* Filter Bar & Controls */}
          <div className="flex flex-wrap items-center gap-2">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  proposalStatusFilter === st.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Proposals List */}
          {isLoadingProposals ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách đề xuất biểu phí...</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có đề xuất biểu phí nào phù hợp.</p>
              <p className="text-xs text-slate-400 mt-1">
                Các đề xuất điều chỉnh bảng giá từ Quản lý Trung tâm kiểm định sẽ hiển thị tại đây
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {proposals.map((proposal) => {
                const isPending = proposal.status === 'PENDING_APPROVAL' || proposal.status === 'PENDING';
                return (
                  <div
                    key={proposal.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 transition shadow-2xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900">
                              Đề xuất biểu phí #{proposal.id.slice(0, 8)}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                                proposal.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : proposal.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800 animate-pulse'
                              }`}
                            >
                              {proposal.status === 'PENDING_APPROVAL' || proposal.status === 'PENDING'
                                ? 'Chờ Duyệt'
                                : proposal.status === 'APPROVED'
                                ? 'Đã Phê Duyệt'
                                : 'Đã Từ Chối'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Gửi bởi: <strong className="text-slate-700">{proposal.proposedByName || proposal.proposedByEmail || 'TTKD'}</strong> •{' '}
                            Ngày gửi: {proposal.createdAt ? new Date(proposal.createdAt).toLocaleString('vi-VN') : 'Mới đây'}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                        <button
                          type="button"
                          onClick={() => setViewingProposal(proposal)}
                          className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>So sánh bậc phí</span>
                        </button>

                        {isPending && hasFeeManagePermission && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>

                    {/* Proposal Quick Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Phí kiểm định cơ sở đề xuất</span>
                        <span className="text-base font-black text-[#c34c36] block mt-0.5">
                          {formatVND(proposal.baseInspectionFee || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Phạm vi / Cấp độ áp dụng</span>
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
                        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Người xét duyệt</span>
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

                    {/* Attached tiers preview */}
                    {proposal.tiers && proposal.tiers.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            Các bậc cước di chuyển trong đề xuất ({proposal.tiers.length} bậc):
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {proposal.tiers.map((t, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">
                Trang <strong>{page + 1}</strong> / {totalPages} ({totalElements} đề xuất)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadProposals(page - 1, proposalStatusFilter)}
                  disabled={page <= 0 || isLoadingProposals}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadProposals(page + 1, proposalStatusFilter)}
                  disabled={page >= totalPages - 1 || isLoadingProposals}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition"
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
      {/* TAB 2: BẢNG 6 BẬC THANG DI CHUYỂN HIỆN HÀNH (TRAVEL TIERS)            */}
      {/* ===================================================================== */}
      {activeSubTab === 'travel_tiers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Bảng 6 Bậc Thang Cước Di Chuyển Kỹ Thuật Viên
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Công thức tính phí di chuyển thực tế khi kiểm định tận nhà (Gói AT_HOME) dựa trên khoảng cách km
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isEditingTiers ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTiers(false);
                      setEditedTiers(JSON.parse(JSON.stringify(travelTiers)));
                      setTierValidationError(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenPreviewSaveTiers}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Xem Lại & Lưu Mới</span>
                  </button>
                </>
              ) : (
                hasFeeManagePermission && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTiers(true);
                      setEditedTiers(JSON.parse(JSON.stringify(travelTiers)));
                      setTierValidationError(null);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Chỉnh Sửa Trực Tiếp</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Policy Info Note */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Quy tắc vận hành bậc thang di chuyển</span>
            </div>
            <p>
              • Biểu phí gồm 6 bậc thang cố định áp dụng chung toàn quốc cho hình thức kiểm định tận nhà (AT_HOME).
            </p>
            <p>
              • Bậc cuối cùng được cấu hình với khoảng cách đến là <em>Không giới hạn (∞)</em> bằng cách để trống ô cự ly đến.
            </p>
            <p>
              • Phí vận chuyển hàng hóa về Trung tâm (Lab Hub) là khoản do đối tác giao vận (Lalamove) thực hiện, không quản trị tại bảng này.
            </p>
          </div>

          {/* Validation error message if any */}
          {tierValidationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{tierValidationError}</span>
            </div>
          )}

          {isLoadingTiers ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs text-slate-500 font-semibold">Đang tải bảng bậc thang...</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3.5 w-20 text-center">Bậc thang</th>
                    <th className="py-3 px-4 min-w-[180px]">Tên hiển thị</th>
                    <th className="py-3 px-3 w-36 text-center">Khoảng cách từ (km)</th>
                    <th className="py-3 px-3 w-40 text-center">Khoảng cách đến (km)</th>
                    <th className="py-3 px-4 w-44 text-right">Đơn giá / km (VND)</th>
                    <th className="py-3 px-3.5 w-32 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(isEditingTiers ? editedTiers : travelTiers).map((tier, idx) => (
                    <tr key={tier.tierNumber || idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-3.5 font-black text-slate-900 text-center">
                        #{tier.tierNumber || idx + 1}
                      </td>

                      <td className="py-3.5 px-4">
                        {isEditingTiers ? (
                          <input
                            type="text"
                            value={tier.name || ''}
                            onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                            className="w-full max-w-[200px] px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-bold text-slate-800">{tier.name || `Bậc ${tier.tierNumber || idx + 1}`}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            min={0}
                            value={tier.fromKm ?? 0}
                            onChange={(e) => handleTierChange(idx, 'fromKm', Number(e.target.value))}
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-center focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">{tier.fromKm ?? 0} km</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            min={0}
                            value={tier.toKm ?? ''}
                            placeholder="Không giới hạn"
                            onChange={(e) =>
                              handleTierChange(idx, 'toKm', e.target.value.trim() !== '' ? Number(e.target.value) : null)
                            }
                            className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-center focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {tier.toKm != null ? `${tier.toKm} km` : 'Không giới hạn (∞)'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isEditingTiers ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={tier.pricePerKm ?? 0}
                            onChange={(e) => handleTierChange(idx, 'pricePerKm', Number(e.target.value))}
                            className="w-32 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-[#c34c36] text-right focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        ) : (
                          <span className="font-black text-[#c34c36]">{formatVND(tier.pricePerKm || 0)} / km</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{tier.status || 'ACTIVE'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <span>Cấu Hình Tỷ Lệ Dự Phòng Cước Trả Hàng Kiểm Định</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Tỷ lệ phần trăm dự phòng cước trả hàng từ Trung tâm về cho Người bán đối với đơn kiểm định tại trung tâm (AT_CENTER)
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
                      Hủy Bỏ
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
                          <span>Lưu Cấu Hình</span>
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
                    <span>Chỉnh Sửa</span>
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
                      (Chế độ chỉ xem — bấm Chỉnh Sửa để thay đổi)
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
                        <span>Chỉnh Sửa</span>
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
                            <span>Lưu Cấu Hình</span>
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
              <h4 className="font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <span>📐 Ví Dụ Minh Họa Tính Toán</span>
              </h4>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Khi người mua chọn kiểm định <strong>Đưa đến trung tâm (AT_CENTER)</strong>:
              </p>
              <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-200/60 font-mono text-[11px] text-slate-700">
                <div className="flex justify-between">
                  <span>Phí kiểm định cơ sở:</span>
                  <span className="font-bold text-slate-900">50.000 đ</span>
                </div>
                <div className="flex justify-between">
                  <span>Cước chiều đi (Seller → Hub):</span>
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: SO SÁNH BẬC PHÍ CHI TIẾT (SIDE-BY-SIDE DIFF VIEW)           */}
      {/* ===================================================================== */}
      {viewingProposal && (
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
                    Chi Tiết & So Sánh Đề Xuất Biểu Phí #{viewingProposal.id.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đề xuất bởi {viewingProposal.proposedByName || viewingProposal.proposedByEmail} •{' '}
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
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Phí kiểm định cơ sở đề xuất</span>
                <span className="text-lg font-black text-[#c34c36]">
                  {formatVND(viewingProposal.baseInspectionFee || 0)}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Phí cơ sở áp dụng theo danh mục sản phẩm trong CSDL
                </p>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Danh mục áp dụng</span>
                <span className="text-xs font-bold text-slate-800">
                  {viewingProposal.categoryName || 'Tất cả danh mục sản phẩm'}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Trạng thái</span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase mt-1 ${
                    viewingProposal.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : viewingProposal.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {viewingProposal.status === 'PENDING_APPROVAL' || viewingProposal.status === 'PENDING'
                    ? 'Chờ Duyệt'
                    : viewingProposal.status === 'APPROVED'
                    ? 'Đã Phê Duyệt'
                    : 'Đã Từ Chối'}
                </span>
                {viewingProposal.rejectReason && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    Lý do từ chối: {viewingProposal.rejectReason}
                  </p>
                )}
              </div>
            </div>

            {/* Side-by-Side Comparison Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Bảng so sánh cước bậc thang di chuyển (Hiện hành vs Đề xuất)
              </h4>
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-gray-100 uppercase text-[11px]">
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
                      const newDist = `${proposedTier.fromKm ?? 0} - ${
                        proposedTier.toKm != null ? `${proposedTier.toKm} km` : '∞'
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
                    <span>Từ Chối Đề Xuất</span>
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
                    <span>Phê Duyệt Đề Xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: REVIEW PROPOSAL (APPROVE / REJECT DIALOG)                    */}
      {/* ===================================================================== */}
      {isReviewModalOpen && selectedProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl ${
                    reviewAction === 'APPROVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {reviewAction === 'APPROVE' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {reviewAction === 'APPROVE' ? 'Phê Duyệt Đề Xuất Biểu Phí' : 'Từ Chối Đề Xuất Biểu Phí'}
                </h3>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Bạn đang thực hiện <strong>{reviewAction === 'APPROVE' ? 'phê duyệt' : 'từ chối'}</strong> đề xuất biểu phí #
              <strong>{selectedProposal.id.slice(0, 8)}</strong> với mức phí cơ sở đề xuất:{' '}
              <strong className="text-[#c34c36]">{formatVND(selectedProposal.baseInspectionFee || 0)}</strong>.
            </p>

            {reviewAction === 'APPROVE' && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                Khi phê duyệt, bảng 6 bậc thang cước di chuyển trên toàn hệ thống sẽ được tự động cập nhật theo các bậc trong đề xuất này.
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Ghi chú / Ý kiến phản hồi {reviewAction === 'REJECT' && <span className="text-rose-500">* (Bắt buộc)</span>}:
              </label>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  reviewAction === 'APPROVE'
                    ? 'Nhập căn cứ phê duyệt (không bắt buộc)...'
                    : 'Nhập lý do từ chối để Trung tâm kiểm định nắm rõ và điều chỉnh lại...'
                }
                className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer ${
                  reviewAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingReview && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{reviewAction === 'APPROVE' ? 'Xác Nhận Phê Duyệt' : 'Xác Nhận Từ Chối'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: PREVIEW BEFORE DIRECT SAVING TIERS                          */}
      {/* ===================================================================== */}
      {isPreviewSaveTiersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Save className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Xem Lại Thay Đổi Bảng Bậc Thang Trước Khi Lưu
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewSaveTiersOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Bạn đang cập nhật trực tiếp biểu phí bậc thang di chuyển. Hãy kiểm tra lại các mức cước mới dưới đây:
            </p>

            <div className="overflow-x-auto border border-gray-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-gray-100 text-[11px] uppercase">
                    <th className="py-2.5 px-3">Bậc</th>
                    <th className="py-2.5 px-3">Tên bậc</th>
                    <th className="py-2.5 px-3">Khoảng cách</th>
                    <th className="py-2.5 px-3">Đơn giá mới</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editedTiers.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">#{t.tierNumber || idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{t.name}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono">
                        {t.fromKm ?? 0} - {t.toKm != null ? `${t.toKm} km` : 'Không giới hạn (∞)'}
                      </td>
                      <td className="py-2.5 px-3 font-black text-[#c34c36] font-mono">
                        {formatVND(t.pricePerKm || 0)} / km
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsPreviewSaveTiersOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 cursor-pointer"
              >
                Quay Lại Sửa
              </button>
              <button
                onClick={handleConfirmSaveTiers}
                disabled={isSavingTiers}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSavingTiers && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác Nhận Lưu Vào Hệ Thống</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: XEM CHI TIẾT BỘ TIÊU CHUẨN ĐỀ XUẤT */}
      {viewingChecklistProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-bold">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Chi Tiết Bộ Tiêu Chuẩn: {viewingChecklistProposal.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Loại thiết bị: <strong>{viewingChecklistProposal.itemName || 'Chưa gắn Item cụ thể'}</strong>{' '}
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
                    <span>Biểu Phí Kiểm Định Của Trung Tâm Tác Giả</span>
                  </div>
                  <span className="text-[11px] text-slate-700 font-bold">
                    {viewingChecklistProposal.pricing.inspectionCenterName || 'Trung tâm tác giả'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-0.5">
                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Cấp độ áp dụng</span>
                    <span className="font-black text-slate-900 mt-0.5 block">
                      {viewingChecklistProposal.pricing.complexityLevel ? `Cấp ${viewingChecklistProposal.pricing.complexityLevel}` : 'Chưa phân cấp'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Giá cấp đã duyệt</span>
                    <span className="font-black text-emerald-700 mt-0.5 block">
                      {viewingChecklistProposal.pricing.baseInspectionFee != null
                        ? formatVND(viewingChecklistProposal.pricing.baseInspectionFee)
                        : 'Chưa có giá được duyệt'}
                    </span>
                    {viewingChecklistProposal.pricing.baseInspectionFee != null && !viewingChecklistProposal.pricing.applicable && (
                      <span className="text-[9px] text-amber-700 italic block mt-0.5">Giá tham khảo tại cấp đề xuất</span>
                    )}
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Giá đang đề xuất</span>
                    <span className="font-black text-[#c34c36] mt-0.5 block">
                      {viewingChecklistProposal.pricing.pendingBaseInspectionFee != null
                        ? formatVND(viewingChecklistProposal.pricing.pendingBaseInspectionFee)
                        : 'Không có'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Hiệu lực áp dụng</span>
                    <div className="mt-0.5">
                      {viewingChecklistProposal.pricing.applicable ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sẵn sàng áp dụng
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500">
                          Chưa hiệu lực {viewingChecklistProposal.pricing.unavailableReason ? `(${viewingChecklistProposal.pricing.unavailableReason})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic">
                  * Biểu phí cơ sở tính theo cấp độ tại trung tâm tác giả. Không có một giá chung duy nhất cho mỗi Item trên toàn sàn; người mua chọn trung tâm nào sẽ tính phí theo bảng giá cấp độ của trung tâm đó.
                </p>
              </div>
            )}

            {viewingChecklistProposal.description && (
              <div className="p-3 bg-slate-50 rounded-xl text-slate-700 text-xs border border-slate-100 shrink-0">
                <strong>Căn cứ kỹ thuật & phạm vi:</strong> {viewingChecklistProposal.description}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="font-bold text-slate-800 text-xs mb-2">
                Danh sách {(viewingChecklistProposal.items || []).length} tiêu chí đo kiểm chi tiết:
              </div>
              {(viewingChecklistProposal.items || []).map((it, idx) => (
                <div
                  key={it.id || idx}
                  className="p-3 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-bold">#{idx + 1}</span>
                      <span className="font-bold text-slate-900">{it.itemTitle}</span>
                      {it.mandatory !== false ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          Bắt buộc (Pass/Fail)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          Tùy chọn
                        </span>
                      )}
                    </div>
                    {it.criteriaDescription && (
                      <p className="text-[11px] text-slate-600 pl-6">
                        {it.criteriaDescription}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                Trạng thái: <strong>{viewingChecklistProposal.approvalStatus}</strong>
              </span>
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
                      <span>Từ Chối Đề Xuất</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenReviewChecklist(viewingChecklistProposal, 'APPROVE');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Phê Duyệt Đề Xuất</span>
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
                  {checklistReviewAction === 'APPROVE' ? 'Phê Duyệt Bộ Tiêu Chuẩn' : 'Từ Chối Đề Xuất Bộ Tiêu Chuẩn'}
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
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChecklistReview}
                  className={`px-5 py-2 rounded-xl text-white font-bold transition cursor-pointer shadow-xs ${
                    checklistReviewAction === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmittingChecklistReview ? 'Đang xử lý...' : checklistReviewAction === 'APPROVE' ? 'Xác Nhận Phê Duyệt' : 'Xác Nhận Từ Chối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
