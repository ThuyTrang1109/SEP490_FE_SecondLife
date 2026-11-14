import React, { useState, useRef } from 'react';
import { inspectorService, InspectionTravelTierDto, InspectionFeeProposalResponse, InspectionFeeProposalStatus } from '../../../services';
import { loadCenterPricing } from '../../../services/inspectionCenterPricing';
import { InspectionComplexityLevel } from '../../../types';
import { dialogService } from '../../../utils/dialogService';
import { formatVND } from '../../../utils/translations';
import type { useCenterCatalog } from '../checklists/useCenterCatalog';

interface Options {
  categories: ReturnType<typeof useCenterCatalog>['categories'];
  loadCategoriesAndItems: ReturnType<typeof useCenterCatalog>['loadCategoriesAndItems'];
  showNotice: (msg: string) => void;
}

export function useCenterPricing({ categories, loadCategoriesAndItems, showNotice }: Options) {
  // 4-Level Fees (L1-L4) State
  const [currentLevelFees, setCurrentLevelFees] = useState<InspectionFeeProposalResponse[]>([]);
  const [levelFeeProposals, setLevelFeeProposals] = useState<InspectionFeeProposalResponse[]>([]);

  // Helper: Kiểm tra cấp độ L1-L4 đã có đề xuất đang chờ Admin duyệt hay chưa (chặn gửi trùng lặp)
  const getPendingProposalForLevel = (level: InspectionComplexityLevel) => {
    const all = [...levelFeeProposals, ...tierProposals];
    return all.find(
      (p) =>
        p &&
        String(p.complexityLevel || '').toUpperCase() === String(level).toUpperCase() &&
        (String(p.status || '').toUpperCase() === 'PENDING_APPROVAL' ||
          String(p.status || '').toUpperCase() === 'PENDING')
    );
  };

  // Helper: Lấy biểu phí đã được Admin phê duyệt cho cấp độ tương ứng
  const getApprovedFeeForLevel = (level?: InspectionComplexityLevel | string) => {
    if (!level) return null;
    const lvl = String(level).toUpperCase();
    return (
      currentLevelFees.find(
        (f) =>
          String(f.complexityLevel || '').toUpperCase() === lvl &&
          (String(f.status || '').toUpperCase() === 'APPROVED' || !f.status) &&
          f.baseInspectionFee != null &&
          f.baseInspectionFee > 0
      ) || null
    );
  };

  // Helper: Kiểm tra cấp độ L1-L4 đã có biểu phí được Admin duyệt chính thức hay chưa (Phương án 1)
  const isLevelFeeApproved = (level?: InspectionComplexityLevel | string): boolean => {
    return Boolean(getApprovedFeeForLevel(level));
  };
  const [isProposeLevelFeeModalOpen, setIsProposeLevelFeeModalOpen] = useState(false);
  const [proposingLevel, setProposingLevel] = useState<InspectionComplexityLevel>('L1');
  const [proposingLevelFeeAmount, setProposingLevelFeeAmount] = useState<number | ''>(50000);
  const [proposingLevelFeeError, setProposingLevelFeeError] = useState<string | null>(null);
  const [isSubmittingLevelFee, setIsSubmittingLevelFee] = useState(false);

  // Pricing & Travel Tiers State
  const [travelTiers, setTravelTiers] = useState<InspectionTravelTierDto[]>([]);
  const [tierProposals, setTierProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [pricingProposalFilter, setPricingProposalFilter] = useState<'ALL' | InspectionFeeProposalStatus>('ALL');
  const [pricingProposalPage, setPricingProposalPage] = useState<number>(0);
  const [pricingProposalTotalPages, setPricingProposalTotalPages] = useState<number>(1);
  const [pricingProposalTotalElements, setPricingProposalTotalElements] = useState<number>(0);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const pricingRequestRef = useRef(0);
  const [selectedProposalDetail, setSelectedProposalDetail] = useState<InspectionFeeProposalResponse | null>(null);

  // Propose Fee Modal State (2-step wizard)
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [proposeStep, setProposeStep] = useState<'edit' | 'preview'>('edit');
  const [proposeCategoryId, setProposeCategoryId] = useState<string>('');
  const [proposeBaseFee, setProposeBaseFee] = useState<number>(250000);
  const [proposeTiers, setProposeTiers] = useState<InspectionTravelTierDto[]>([]);
  const [proposeValidationError, setProposeValidationError] = useState<string | null>(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  const loadPricing = async (targetPage: number = 0, statusFilter: string = pricingProposalFilter, includeSummary = true) => {
    const requestId = ++pricingRequestRef.current;
    setIsLoadingPricing(true);
    try {
      const { tiers: tiersRes, history: propsRes, fees: currentFeesRes, pending: levelPropsRes } =
        await loadCenterPricing(targetPage, statusFilter, includeSummary);
      if (requestId !== pricingRequestRef.current) return;
      if (tiersRes.status === 'fulfilled' && tiersRes.value !== null) {
        const tiers = Array.isArray(tiersRes.value) ? tiersRes.value : [];
        setTravelTiers(tiers);
      }
      if (propsRes.status === 'fulfilled') {
        const props = propsRes.value as any;
        const list = Array.isArray(props?.items)
          ? props.items
          : Array.isArray(props?.content)
            ? props.content
            : Array.isArray(props)
              ? props
              : [];
        setTierProposals(list);
        setPricingProposalTotalPages(props.totalPages || 1);
        setPricingProposalTotalElements(props.totalElements ?? list.length);
        setPricingProposalPage(props.page || 0);
      }
      if (currentFeesRes.status === 'fulfilled' && currentFeesRes.value !== null) {
        const cFees = currentFeesRes.value;
        setCurrentLevelFees(Array.isArray(cFees) ? cFees : []);
      }
      if (levelPropsRes?.status === 'fulfilled') {
        setLevelFeeProposals(levelPropsRes.value);
      }
    } catch (err) {
      console.warn('Lỗi tải lịch sử đề xuất:', err);
    } finally {
      if (requestId === pricingRequestRef.current) setIsLoadingPricing(false);
    }
  };

  const handleProposeLevelFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProposingLevelFeeError(null);
    if (!proposingLevelFeeAmount || Number(proposingLevelFeeAmount) <= 0) {
      setProposingLevelFeeError('Vui lòng nhập mức phí kiểm định hợp lệ (lớn hơn 0đ)');
      return;
    }

    // Chặn gửi yêu cầu trùng lặp nếu cấp độ này đã có đề xuất đang chờ duyệt
    const existingPending = getPendingProposalForLevel(proposingLevel);
    if (existingPending) {
      setProposingLevelFeeError(`Cấp độ ${proposingLevel} hiện đã có một đề xuất (${formatVND(existingPending.baseInspectionFee || 0)}) đang chờ Admin duyệt. Mỗi cấp độ chỉ được tồn tại 1 yêu cầu chờ duyệt duy nhất.`);
      return;
    }

    setIsSubmittingLevelFee(true);
    try {
      const res = await inspectorService.proposeLevelFee({
        complexityLevel: proposingLevel,
        baseInspectionFee: Number(proposingLevelFeeAmount),
      });

      // Optimistically update levelFeeProposals so the card immediately reflects "Đang chờ Admin duyệt"
      const newProp: InspectionFeeProposalResponse = {
        id: res?.id || `prop-${Date.now()}`,
        complexityLevel: proposingLevel,
        baseInspectionFee: Number(proposingLevelFeeAmount),
        status: 'PENDING_APPROVAL',
        createdAt: res?.createdAt || new Date().toISOString(),
        ...(res || {}),
      };
      setLevelFeeProposals((prev) => [newProp, ...prev.filter((p) => p.id !== newProp.id)]);

      showNotice(`Đã gửi đề xuất biểu phí cho cấp độ ${proposingLevel} (${formatVND(Number(proposingLevelFeeAmount))}) thành công!`);
      setIsProposeLevelFeeModalOpen(false);
      await loadPricing();
    } catch (err: any) {
      console.error('Lỗi đề xuất biểu phí cấp độ:', err);
      setProposingLevelFeeError(err?.message || 'Không thể gửi đề xuất biểu phí');
    } finally {
      setIsSubmittingLevelFee(false);
    }
  };

  const handlePricingFilterChange = (newStatus: 'ALL' | InspectionFeeProposalStatus) => {
    setPricingProposalFilter(newStatus);
    setPricingProposalPage(0);
    loadPricing(0, newStatus, false);
  };

  const handleOpenProposeModal = () => {
    setProposeStep('edit');
    setProposeCategoryId('');
    setProposeBaseFee(250000);
    setProposeValidationError(null);
    if (travelTiers && travelTiers.length > 0) {
      setProposeTiers(JSON.parse(JSON.stringify(travelTiers)));
    } else {
      setProposeTiers([
        { tierNumber: 1, name: 'Bậc 1: Cự ly gần (0 - 5 km)', fromKm: 0, toKm: 5, pricePerKm: 20000, status: 'ACTIVE' },
        { tierNumber: 2, name: 'Bậc 2: Cự ly trung bình (5 - 15 km)', fromKm: 5, toKm: 15, pricePerKm: 30000, status: 'ACTIVE' },
        { tierNumber: 3, name: 'Bậc 3: Ngoại thành gần (15 - 25 km)', fromKm: 15, toKm: 25, pricePerKm: 40000, status: 'ACTIVE' },
        { tierNumber: 4, name: 'Bậc 4: Ngoại thành xa (25 - 40 km)', fromKm: 25, toKm: 40, pricePerKm: 50000, status: 'ACTIVE' },
        { tierNumber: 5, name: 'Bậc 5: Tỉnh lân cận (40 - 60 km)', fromKm: 40, toKm: 60, pricePerKm: 60000, status: 'ACTIVE' },
        { tierNumber: 6, name: 'Bậc 6: Cự ly đặc biệt (> 60 km)', fromKm: 60, toKm: null, pricePerKm: 70000, status: 'ACTIVE' },
      ]);
    }
    if (!categories || categories.length === 0) {
      loadCategoriesAndItems();
    }
    setIsProposeModalOpen(true);
  };

  const handleProposeTierChange = (index: number, field: keyof InspectionTravelTierDto, value: any) => {
    setProposeTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setProposeValidationError(null);
  };

  const validateProposeForm = (): string | null => {
    if (!proposeTiers || proposeTiers.length === 0) {
      return 'Biểu phí cần có ít nhất một bậc cước di chuyển';
    }
    for (let i = 0; i < proposeTiers.length; i++) {
      const t = proposeTiers[i];
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
          return `Bậc #${t.tierNumber || i + 1}: Khoảng cách đến (${toKm} km) phải lớn hơn khoảng cách từ (${fromKm} km)`;
        }
      }
      const price = Number(t.pricePerKm);
      if (isNaN(price) || price < 0) {
        return `Bậc #${t.tierNumber || i + 1}: Đơn giá / km phải là số không âm`;
      }
    }
    return null;
  };

  const handleProceedToPreview = () => {
    const error = validateProposeForm();
    if (error) {
      setProposeValidationError(error);
      return;
    }
    setProposeValidationError(null);
    setProposeStep('preview');
  };

  const handleSubmitProposal = async () => {
    const error = validateProposeForm();
    if (error) {
      setProposeValidationError(error);
      setProposeStep('edit');
      return;
    }
    setIsSubmittingProposal(true);
    try {
      await inspectorService.proposeTravelTiers({
        categoryId: proposeCategoryId ? proposeCategoryId : undefined,
        baseInspectionFee: Number(proposeBaseFee),
        tiers: proposeTiers.map((t) => ({
          tierNumber: t.tierNumber,
          name: t.name,
          fromKm: Number(t.fromKm),
          toKm: t.toKm != null && String(t.toKm).trim() !== '' ? Number(t.toKm) : null,
          pricePerKm: Number(t.pricePerKm),
          status: t.status || 'ACTIVE',
        })),
      });
      showNotice('Đã gửi đề xuất biểu phí lên Admin sàn thành công! Đề xuất đang chờ xét duyệt.');
      setIsProposeModalOpen(false);
      loadPricing(0, pricingProposalFilter, false);
    } catch (err: any) {
      dialogService.error(err?.message || 'Gửi đề xuất giá thất bại');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  return {
    currentLevelFees,
    getApprovedFeeForLevel,
    getPendingProposalForLevel,
    handleOpenProposeModal,
    handlePricingFilterChange,
    handleProceedToPreview,
    handleProposeLevelFeeSubmit,
    handleProposeTierChange,
    handleSubmitProposal,
    isLevelFeeApproved,
    isLoadingPricing,
    isProposeLevelFeeModalOpen,
    isProposeModalOpen,
    isSubmittingLevelFee,
    isSubmittingProposal,
    loadPricing,
    pricingProposalFilter,
    pricingProposalPage,
    pricingProposalTotalElements,
    pricingProposalTotalPages,
    proposeStep,
    proposeTiers,
    proposeValidationError,
    proposingLevel,
    proposingLevelFeeAmount,
    proposingLevelFeeError,
    selectedProposalDetail,
    setIsProposeLevelFeeModalOpen,
    setIsProposeModalOpen,
    setProposeStep,
    setProposingLevel,
    setProposingLevelFeeAmount,
    setProposingLevelFeeError,
    setSelectedProposalDetail,
    tierProposals,
    travelTiers,
  };
}
