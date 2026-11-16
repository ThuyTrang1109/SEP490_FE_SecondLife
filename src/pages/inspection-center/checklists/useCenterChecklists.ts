import { useState, useMemo } from 'react';
import { inspectorService, InspectionChecklistResponse, CreateChecklistTemplateRequest } from '../../../services';
import { Language, ItemBackend, InspectionComplexityLevel } from '../../../types';
import { dialogService } from '../../../utils/dialogService';
import { APPLIANCE_PRESETS, type AppliancePreset } from './appliancePresets';
import type { useCenterCatalog } from './useCenterCatalog';
import type { useCenterPricing } from '../pricing/useCenterPricing';

interface Options {
  catalogItems: ReturnType<typeof useCenterCatalog>['catalogItems'];
  categories: ReturnType<typeof useCenterCatalog>['categories'];
  getPendingProposalForLevel: ReturnType<typeof useCenterPricing>['getPendingProposalForLevel'];
  isLevelFeeApproved: ReturnType<typeof useCenterPricing>['isLevelFeeApproved'];
  lang: Language;
  loadCategoriesAndItems: ReturnType<typeof useCenterCatalog>['loadCategoriesAndItems'];
  showNotice: (msg: string) => void;
}

export function useCenterChecklists({ catalogItems, categories, getPendingProposalForLevel, isLevelFeeApproved, lang, loadCategoriesAndItems, showNotice }: Options) {
  // Checklists & Catalog State
  const [checklists, setChecklists] = useState<InspectionChecklistResponse[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);


  // Search & Filter State
  const [checklistSearch, setChecklistSearch] = useState('');
  const [checklistCategoryFilter, setChecklistCategoryFilter] = useState('ALL');

  // Modal Create / Edit State
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedComplexityLevel, setSelectedComplexityLevel] = useState<InspectionComplexityLevel>('L1');
  const [checklistTitle, setChecklistTitle] = useState('');
  const [checklistDesc, setChecklistDesc] = useState('');
  const [checklistItems, setChecklistItems] = useState<{
    id?: string;
    itemTitle: string;
    criteriaDescription: string;
    mandatory: boolean;
  }[]>([
    {
      itemTitle: 'Kiểm tra an toàn điện & tiếp địa',
      criteriaDescription: 'Dây dẫn nguyên vẹn, không hở điện, chống rò rỉ và có tiếp địa đạt chuẩn.',
      mandatory: true,
    },
    {
      itemTitle: 'Kiểm tra vận hành chức năng chính',
      criteriaDescription: 'Chạy thử tải thực tế các chế độ điều khiển và tính ổn định linh kiện công suất.',
      mandatory: true,
    },
    {
      itemTitle: 'Kiểm tra ngoại quan & ốc niêm phong',
      criteriaDescription: 'Soi dấu hiệu cạy mở trái phép, trầy xước vỏ và các chi tiết cơ khí.',
      mandatory: false,
    },
  ]);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // Detail View Modal State
  const [viewingChecklist, setViewingChecklist] = useState<InspectionChecklistResponse | null>(null);
  const [isLoadingChecklistDetail, setIsLoadingChecklistDetail] = useState(false);

  const handleViewChecklistDetail = async (chk: InspectionChecklistResponse) => {
    setIsLoadingChecklistDetail(true);
    setViewingChecklist(chk);
    try {
      const full = await inspectorService.getChecklistById(chk.id);
      if (full) setViewingChecklist(full);
    } catch (e) {
      console.warn('Fallback to cached checklist:', e);
    } finally {
      setIsLoadingChecklistDetail(false);
    }
  };

  const loadChecklists = async () => {
    setIsLoadingChecklists(true);
    try {
      const data = await inspectorService.getChecklists();
      setChecklists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Lỗi tải checklists:', err);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const resetChecklistForm = () => {
    setEditingChecklistId(null);
    setSelectedCategoryId('');
    setSelectedProductId('');
    setSelectedItemId('');
    setSelectedComplexityLevel('L1');
    setChecklistTitle('');
    setChecklistDesc('');
    setChecklistItems([
      {
        itemTitle: 'Kiểm tra an toàn điện & tiếp địa',
        criteriaDescription: 'Dây dẫn nguyên vẹn, không hở điện, chống rò rỉ và có tiếp địa đạt chuẩn.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra vận hành chức năng chính',
        criteriaDescription: 'Chạy thử tải thực tế các chế độ điều khiển và tính ổn định linh kiện công suất.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra ngoại quan & ốc niêm phong',
        criteriaDescription: 'Soi dấu hiệu cạy mở trái phép, trầy xước vỏ và các chi tiết cơ khí.',
        mandatory: false,
      },
    ]);
  };

  const handleOpenCreateModal = (presetKey?: string) => {
    resetChecklistForm();
    const firstApproved = (['L1', 'L2', 'L3', 'L4'] as InspectionComplexityLevel[]).find((lvl) =>
      isLevelFeeApproved(lvl)
    );
    if (firstApproved) {
      setSelectedComplexityLevel(firstApproved);
    }
    if (presetKey) {
      const preset = APPLIANCE_PRESETS.find(p => p.key === presetKey);
      if (preset) {
        handleApplyPreset(preset);
      }
    }
    setIsChecklistModalOpen(true);
  };

  // Nhóm các Item đã có checklist được Admin duyệt (approvalStatus === 'APPROVED' và active === true) theo complexityLevel (L1–L4)
  const approvedItemsByLevel = useMemo(() => {
    const map: Record<InspectionComplexityLevel, { itemId: string; itemName: string; checklistTitle?: string }[]> = {
      L1: [],
      L2: [],
      L3: [],
      L4: [],
    };

    const seenItemIds = new Set<string>();

    checklists
      .filter((chk) => {
        const isApproved = String(chk.approvalStatus || '').toUpperCase() === 'APPROVED';
        const isActive = chk.active === true || (chk as any).isActive === true || (chk.active !== false && isApproved);
        return isApproved && isActive && chk.complexityLevel;
      })
      .forEach((chk) => {
        const lvl = chk.complexityLevel as InspectionComplexityLevel;
        if (map[lvl]) {
          const matchedItem = catalogItems.find((it) => it.id === chk.itemId);
          const name = chk.itemName || matchedItem?.name || chk.title;
          const itemId = chk.itemId || matchedItem?.id || chk.id;
          if (itemId && !seenItemIds.has(itemId)) {
            seenItemIds.add(itemId);
            map[lvl].push({
              itemId,
              itemName: name,
              checklistTitle: chk.title,
            });
          }
        }
      });

    return map;
  }, [checklists, catalogItems]);

  // Danh sách Item (loại sản phẩm) chưa được phân cấp L1–L4 (chưa có checklist nào được APPROVED & active)
  const unclassifiedItems = useMemo(() => {
    const approvedItemIds = new Set(
      checklists
        .filter((chk) => {
          const isApproved = String(chk.approvalStatus || '').toUpperCase() === 'APPROVED';
          const isActive = chk.active === true || (chk as any).isActive === true || (chk.active !== false && isApproved);
          return isApproved && isActive && chk.itemId;
        })
        .map((chk) => chk.itemId)
    );

    return catalogItems
      .filter((itm) => itm.selectable !== false)
      .map((itm) => {
        const cat = categories.find((c) => c.id === itm.categoryId);
        const pendingChecklist = checklists.find(
          (c) => c.itemId === itm.id && String(c.approvalStatus || '').toUpperCase() === 'PENDING_APPROVAL'
        );
        return {
          ...itm,
          categoryName: cat?.name || 'Gia dụng',
          isApproved: approvedItemIds.has(itm.id),
          pendingChecklist,
        };
      })
      .filter((itm) => !itm.isApproved);
  }, [catalogItems, checklists, categories]);

  // Mở modal tạo / cấu hình checklist cho Item cụ thể hoặc theo Level
  const handleOpenCreateChecklistForItem = (item?: ItemBackend, level?: InspectionComplexityLevel) => {
    if (categories.length === 0 || catalogItems.length === 0) {
      loadCategoriesAndItems();
    }
    resetChecklistForm();

    // Xác định cấp độ ưu tiên: cấp truyền vào nếu đã duyệt giá, hoặc cấp hợp lệ đầu tiên đã có giá duyệt
    let targetLevel = level;
    if (!targetLevel || !isLevelFeeApproved(targetLevel)) {
      const firstApproved = (['L1', 'L2', 'L3', 'L4'] as InspectionComplexityLevel[]).find((lvl) =>
        isLevelFeeApproved(lvl)
      );
      targetLevel = firstApproved || level || 'L1';
    }

    if (item) {
      setSelectedCategoryId(item.categoryId || '');
      setSelectedItemId(item.id || '');
      setChecklistTitle(`Bộ tiêu chuẩn kiểm định ${item.name}`);
      setChecklistDesc(`Quy chuẩn kiểm tra kỹ thuật an toàn và chức năng cho thiết bị ${item.name}. Đề xuất áp dụng cấp độ ${targetLevel}.`);
    }
    setSelectedComplexityLevel(targetLevel);
    setIsChecklistModalOpen(true);
  };

  const handleOpenEditModal = (chk: InspectionChecklistResponse) => {
    setEditingChecklistId(chk.id);
    setSelectedCategoryId(chk.categoryId || '');
    setSelectedProductId('');
    setSelectedItemId(chk.itemId || '');
    setSelectedComplexityLevel(chk.complexityLevel || 'L1');
    setChecklistTitle(chk.title || '');
    setChecklistDesc(chk.description || '');
    if (chk.items && chk.items.length > 0) {
      setChecklistItems(
        chk.items.map(it => ({
          id: it.id,
          itemTitle: it.itemTitle || (it as any).name || '',
          criteriaDescription: it.criteriaDescription || (it as any).description || '',
          mandatory: it.mandatory !== false,
        }))
      );
    } else {
      setChecklistItems([
        {
          itemTitle: 'Kiểm tra vận hành chức năng chính',
          criteriaDescription: 'Đo kiểm thông số kỹ thuật và độ ổn định thiết bị',
          mandatory: true,
        },
      ]);
    }
    setIsChecklistModalOpen(true);
  };

  const handleCloneChecklist = (chk: InspectionChecklistResponse) => {
    setEditingChecklistId(null);
    setSelectedCategoryId(chk.categoryId || '');
    setSelectedProductId('');
    setSelectedItemId(chk.itemId || '');
    setSelectedComplexityLevel(chk.complexityLevel || 'L1');
    setChecklistTitle(`[Bản sao] ${chk.title}`);
    setChecklistDesc(chk.description || '');
    if (chk.items && chk.items.length > 0) {
      setChecklistItems(
        chk.items.map(it => ({
          itemTitle: it.itemTitle || (it as any).name || '',
          criteriaDescription: it.criteriaDescription || (it as any).description || '',
          mandatory: it.mandatory !== false,
        }))
      );
    }
    setIsChecklistModalOpen(true);
    showNotice(lang === 'vi' ? 'Đã nhân bản bộ tiêu chuẩn. Bạn có thể chỉnh sửa và bấm Lưu.' : 'Checklist cloned. Edit and save.');
  };

  const handleApplyPreset = (preset: AppliancePreset) => {
    const matchedCategory = categories.find(c =>
      c.name.toLowerCase().includes(preset.categoryKeyword.toLowerCase()) ||
      preset.categoryKeyword.toLowerCase().includes(c.name.toLowerCase())
    );
    if (matchedCategory) {
      setSelectedCategoryId(matchedCategory.id);
    } else if (categories.length > 0 && preset.categoryKeyword !== 'Tất cả danh mục') {
      const kwFirst = preset.categoryKeyword.split(' ')[0].toLowerCase();
      const catFirst = categories.find(c => c.name.toLowerCase().includes(kwFirst));
      if (catFirst) setSelectedCategoryId(catFirst.id);
    }
    setChecklistTitle(preset.title);
    setChecklistDesc(preset.description);
    setChecklistItems(
      preset.items.map(it => ({
        itemTitle: it.itemTitle,
        criteriaDescription: it.criteriaDescription,
        mandatory: it.mandatory,
      }))
    );
  };

  const handleSaveChecklist = async () => {
    if (!selectedItemId) {
      await dialogService.warning(lang === 'vi' ? 'Vui lòng chọn loại thiết bị cụ thể (Item) cần lập bộ tiêu chuẩn' : 'Please select specific item');
      return;
    }

    // Kiểm tra và chặn đề xuất nếu cấp độ chưa có mức phí kiểm định được Admin duyệt (Phương án 1)
    if (!isLevelFeeApproved(selectedComplexityLevel)) {
      const pendingProp = getPendingProposalForLevel(selectedComplexityLevel);
      await dialogService.warning(
        lang === 'vi'
          ? `Cấp độ ${selectedComplexityLevel} hiện chưa có mức phí kiểm định được Admin phê duyệt ${pendingProp ? '(hiện đang có đề xuất giá chờ Admin xét duyệt)' : '(chưa có đề xuất giá)'
          }. Theo quy định hệ thống, trung tâm chỉ được lập và gửi đề xuất bộ tiêu chuẩn cho các cấp độ đã có biểu phí được Admin duyệt chính thức.`
          : `Complexity level ${selectedComplexityLevel} does not have an approved fee yet. Please wait for fee approval before submitting checklists.`
      );
      return;
    }

    // Chặn gửi trùng lặp nếu thiết bị này đã có đề xuất tiêu chuẩn đang chờ Admin duyệt
    const existingPendingChk = checklists.find(
      c => c.itemId === selectedItemId && (c.approvalStatus === 'PENDING_APPROVAL' || (c as any).status === 'PENDING_APPROVAL') && c.id !== editingChecklistId
    );
    if (existingPendingChk) {
      await dialogService.warning(
        lang === 'vi'
          ? `Thiết bị này hiện đã có bộ tiêu chuẩn "${existingPendingChk.title}" (v${existingPendingChk.revision || 1}) đang ở trạng thái CHỜ DUYỆT. Vui lòng chờ Admin xử trị hoặc rút đề xuất cũ trước khi tạo đề xuất mới.`
          : 'A proposal for this item is already pending approval.'
      );
      return;
    }
    if (!checklistTitle.trim()) {
      await dialogService.warning(lang === 'vi' ? 'Vui lòng nhập tên bộ tiêu chuẩn kiểm định' : 'Please enter checklist title');
      return;
    }
    if (checklistTitle.trim().length > 200) {
      await dialogService.warning(lang === 'vi' ? 'Tên bộ tiêu chuẩn không được vượt quá 200 ký tự' : 'Title cannot exceed 200 chars');
      return;
    }
    if (checklistDesc.trim().length > 10000) {
      await dialogService.warning(lang === 'vi' ? 'Mô tả căn cứ kỹ thuật không được vượt quá 10.000 ký tự' : 'Description cannot exceed 10000 chars');
      return;
    }
    const validItems = checklistItems.filter(i => i.itemTitle.trim());
    if (validItems.length === 0) {
      await dialogService.warning(lang === 'vi' ? 'Vui lòng thêm ít nhất một hạng mục kiểm định (1-100 tiêu chí)' : 'Please add at least one criteria item');
      return;
    }
    if (validItems.length > 100) {
      await dialogService.warning(lang === 'vi' ? 'Số lượng tiêu chí kiểm định không được vượt quá 100 tiêu chí' : 'Max 100 criteria');
      return;
    }
    const hasMandatory = validItems.some(i => i.mandatory);
    if (!hasMandatory) {
      await dialogService.warning(lang === 'vi' ? 'Phải có ít nhất một tiêu chí bắt buộc (Mandatory) trong bộ tiêu chuẩn' : 'At least one mandatory criterion is required');
      return;
    }
    const titles = validItems.map(i => i.itemTitle.trim().toLowerCase());
    const uniqueTitles = new Set(titles);
    if (uniqueTitles.size < titles.length) {
      await dialogService.warning(lang === 'vi' ? 'Tên các tiêu chí kiểm định không được trùng lặp' : 'Criteria titles must be unique');
      return;
    }

    setIsSavingChecklist(true);
    try {
      const selectedCat = categories.find(c => c.id === selectedCategoryId);
      const payload: CreateChecklistTemplateRequest = {
        itemId: selectedItemId,
        complexityLevel: selectedComplexityLevel,
        title: checklistTitle.trim(),
        description: checklistDesc.trim() || undefined,
        categoryId: selectedCategoryId || undefined,
        categoryName: selectedCat ? selectedCat.name : undefined,
        items: validItems.map((it, idx) => ({
          itemTitle: it.itemTitle.trim().slice(0, 255),
          criteriaDescription: (it.criteriaDescription || '').trim().slice(0, 4000) || undefined,
          mandatory: Boolean(it.mandatory),
          orderIndex: idx + 1,
        })),
      };

      if (editingChecklistId) {
        const updated = await inspectorService.updateChecklist(editingChecklistId, payload);
        showNotice(lang === 'vi' ? `Đã tạo phiên bản đề xuất mới cho bộ tiêu chuẩn "${checklistTitle}" (v${updated.revision || 2})!` : `New revision submitted!`);
      } else {
        await inspectorService.createChecklist(payload);
        showNotice(lang === 'vi' ? `Đã gửi đề xuất bộ tiêu chuẩn "${checklistTitle}" thành công! Đang chờ Admin duyệt.` : `Checklist proposal created!`);
      }

      setIsChecklistModalOpen(false);
      resetChecklistForm();
      await loadChecklists();
    } catch (err: any) {
      console.error('Lỗi lưu bộ tiêu chuẩn kiểm định:', err);
      dialogService.error(err?.message || (lang === 'vi' ? 'Không thể lưu bộ tiêu chuẩn kiểm định' : 'Failed to save checklist'));
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const handleDeleteChecklist = async (chk: InspectionChecklistResponse) => {
    if (chk.approvalStatus === 'APPROVED' || chk.approvalStatus === 'LEGACY') {
      await dialogService.warning(lang === 'vi' ? 'Không thể rút hoặc xóa bộ tiêu chuẩn đã được duyệt (APPROVED) hoặc thuộc phiên bản cũ (LEGACY).' : 'Cannot withdraw approved or legacy checklist');
      return;
    }

    const confirmed = await dialogService.confirm(
      lang === 'vi' ? `Bạn có chắc muốn rút đề xuất bộ tiêu chuẩn "${chk.title}"?` : `Withdraw proposal "${chk.title}"?`,
      { title: lang === 'vi' ? 'Xác Nhận Rút Đề Xuất' : 'Confirm Withdrawal', type: 'warning' }
    );
    if (!confirmed) return;

    try {
      await inspectorService.deleteChecklist(chk.id);
      showNotice(lang === 'vi' ? `Đã rút đề xuất bộ tiêu chuẩn "${chk.title}" thành công!` : `Checklist proposal withdrawn!`);
      if (viewingChecklist?.id === chk.id) {
        setViewingChecklist(null);
      }
      await loadChecklists();
    } catch (err: any) {
      console.error('Lỗi rút đề xuất checklist:', err);
      dialogService.error(err?.message || (lang === 'vi' ? 'Không thể rút đề xuất bộ tiêu chuẩn' : 'Failed to withdraw checklist'));
    }
  };

  // Checklist Statistics
  const checklistStats = useMemo(() => {
    const total = checklists.length;
    let totalItems = 0;
    let mandatoryItems = 0;
    const catSet = new Set<string>();

    checklists.forEach(c => {
      if (c.categoryId) catSet.add(c.categoryId);
      else if (c.categoryName) catSet.add(c.categoryName);
      (c.items || []).forEach(it => {
        totalItems++;
        if (it.mandatory !== false) mandatoryItems++;
      });
    });

    return {
      total,
      categoriesCount: catSet.size,
      totalItems,
      mandatoryItems,
    };
  }, [checklists]);

  // Filtered Checklists
  const filteredChecklists = useMemo(() => {
    return checklists.filter(chk => {
      if (checklistCategoryFilter !== 'ALL') {
        if (checklistCategoryFilter === 'GENERAL') {
          if (chk.categoryId) return false;
        } else if (chk.categoryId !== checklistCategoryFilter) {
          return false;
        }
      }
      if (checklistSearch.trim()) {
        const q = checklistSearch.toLowerCase();
        const matchTitle = (chk.title || '').toLowerCase().includes(q);
        const matchDesc = (chk.description || '').toLowerCase().includes(q);
        const matchCat = (chk.categoryName || '').toLowerCase().includes(q);
        const matchItems = (chk.items || []).some(
          it =>
            (it.itemTitle || '').toLowerCase().includes(q) ||
            (it.criteriaDescription || '').toLowerCase().includes(q)
        );
        return matchTitle || matchDesc || matchCat || matchItems;
      }
      return true;
    });
  }, [checklists, checklistCategoryFilter, checklistSearch]);

  return {
    approvedItemsByLevel,
    checklistCategoryFilter,
    checklistDesc,
    checklistItems,
    checklists,
    checklistSearch,
    checklistStats,
    checklistTitle,
    editingChecklistId,
    filteredChecklists,
    handleApplyPreset,
    handleCloneChecklist,
    handleDeleteChecklist,
    handleOpenCreateChecklistForItem,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleSaveChecklist,
    handleViewChecklistDetail,
    isChecklistModalOpen,
    isLoadingChecklists,
    isSavingChecklist,
    loadChecklists,
    resetChecklistForm,
    selectedCategoryId,
    selectedComplexityLevel,
    selectedItemId,
    setChecklistCategoryFilter,
    setChecklistDesc,
    setChecklistItems,
    setChecklistSearch,
    setChecklistTitle,
    setIsChecklistModalOpen,
    setSelectedCategoryId,
    setSelectedComplexityLevel,
    setSelectedItemId,
    setViewingChecklist,
    unclassifiedItems,
    viewingChecklist,
  };
}
