import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderTree,
  Tag,
  MessageSquareQuote,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Check,
  X,
  Clock,
  Flame,
  Eye,
  Save
} from 'lucide-react';
import { Language } from '../../types';
import {
  adminCatalogService,
  AdminCategory,
  AdminItem,
  AdminCategoryQuestionTemplate,
  AdminTemplateProposal,
  TemplateProposalStatus
} from '../../services/adminCatalogService';
import { parseQuestionItem } from '../../utils/questionParser';
import { dialogService } from '../../utils/dialogService';

interface CatalogAiTabProps {
  lang: Language;
}

type SubTabType = 'categories' | 'items' | 'templates' | 'proposals';
type ProposalFilterStatus = 'ALL' | TemplateProposalStatus;

export const CatalogAiTab: React.FC<CatalogAiTabProps> = ({ lang: _lang }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('categories');

  // Data states
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [templates, setTemplates] = useState<AdminCategoryQuestionTemplate[]>([]);
  const [proposals, setProposals] = useState<AdminTemplateProposal[]>([]);
  const [pendingProposalsCount, setPendingProposalsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingProposalAction, setIsSubmittingProposalAction] = useState(false);

  // Filter states
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('');
  const [templateItemFilter, setTemplateItemFilter] = useState<string>('');
  const [proposalStatusFilter, setProposalStatusFilter] = useState<ProposalFilterStatus>('PENDING');
  const [proposalCategoryFilter, setProposalCategoryFilter] = useState<string>('');

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Edit states
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<AdminCategoryQuestionTemplate | null>(null);
  const [reviewingProposal, setReviewingProposal] = useState<AdminTemplateProposal | null>(null);
  const [rejectingProposal, setRejectingProposal] = useState<AdminTemplateProposal | null>(null);

  // Form states
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');

  const [templateCategoryId, setTemplateCategoryId] = useState('');
  const [templateItemId, setTemplateItemId] = useState('');
  const [templateText, setTemplateText] = useState('');

  const [proposalDraftText, setProposalDraftText] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const refreshPendingCount = useCallback(async () => {
    try {
      const pendingList = await adminCatalogService.getTemplateProposals('PENDING');
      setPendingProposalsCount(Array.isArray(pendingList) ? pendingList.length : 0);
    } catch (err) {
      console.error('Failed to fetch pending template proposals count:', err);
    }
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const data = await adminCatalogService.getAllCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await adminCatalogService.getAllItems();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await adminCatalogService.getAllTemplates();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProposals = useCallback(async (statusFilter: ProposalFilterStatus) => {
    setIsLoading(true);
    try {
      const statusParam = statusFilter === 'ALL' ? undefined : statusFilter;
      const data = await adminCatalogService.getTemplateProposals(statusParam);
      setProposals(data);
      if (statusFilter === 'PENDING') {
        setPendingProposalsCount(data.length);
      } else {
        setPendingProposalsCount(
          statusFilter === 'ALL'
            ? data.filter(p => p.status === 'PENDING').length
            : pendingProposalsCount
        );
        if (statusFilter !== 'ALL') {
          await refreshPendingCount();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [pendingProposalsCount, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (activeSubTab === 'categories') {
      loadCategories();
    } else if (activeSubTab === 'items') {
      loadCategories();
      loadItems();
    } else if (activeSubTab === 'templates') {
      loadCategories();
      loadItems();
      loadTemplates();
    } else if (activeSubTab === 'proposals') {
      loadCategories();
      loadProposals(proposalStatusFilter);
    }
  }, [activeSubTab, proposalStatusFilter]);

  // Helper to render structured question preview lines
  const renderTemplateLinesPreview = (rawText: string) => {
    const lines = (rawText || '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return (
        <div className="text-xs text-gray-400 italic py-4 text-center">
          Chưa có câu hỏi nào. Hãy nhập câu hỏi theo cú pháp mẫu bên trái.
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {lines.map((line, idx) => {
          const parsed = parseQuestionItem(line, idx);
          return (
            <div
              key={idx}
              className="bg-white p-3 rounded-xl shadow-2xs border border-gray-100 flex flex-col gap-1.5"
            >
              <div className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-md bg-[#24263e] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <h5 className="text-xs font-bold text-[#24263e] leading-snug">{parsed.label}</h5>
              </div>
              {parsed.hint && (
                <p className="text-[10px] text-gray-400 italic ml-7">{parsed.hint}</p>
              )}
              {parsed.examples.length > 0 && (
                <div className="flex gap-1.5 ml-7 flex-wrap">
                  {parsed.examples.map((ex, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200/70 rounded-full text-[10px] font-bold"
                    >
                      + {ex}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // CATEGORY ACTIONS
  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      await dialogService.warning('Vui lòng nhập tên danh mục');
      return;
    }
    try {
      if (editingCategory) {
        await adminCatalogService.updateCategory(editingCategory.id, { name: catName, description: catDesc });
      } else {
        await adminCatalogService.createCategory({ name: catName, description: catDesc });
      }
      setIsCategoryModalOpen(false);
      loadCategories();
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi lưu danh mục');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const confirmed = await dialogService.confirm(
      'Bạn có chắc chắn muốn xóa danh mục này? Các sản phẩm thuộc danh mục cũng có thể bị ảnh hưởng.',
      { title: 'Xác Nhận Xóa Danh Mục', type: 'warning' }
    );
    if (!confirmed) return;
    try {
      await adminCatalogService.deleteCategory(id);
      loadCategories();
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi xóa danh mục');
    }
  };

  const openCategoryModal = (cat?: AdminCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCatName(cat.name);
      setCatDesc(cat.description || '');
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatDesc('');
    }
    setIsCategoryModalOpen(true);
  };

  // ITEM ACTIONS
  const handleSaveItem = async () => {
    if (!itemName.trim() || !itemCategoryId) {
      await dialogService.warning('Vui lòng nhập tên và chọn danh mục');
      return;
    }
    try {
      if (editingItem) {
        await adminCatalogService.updateItem(editingItem.id, { name: itemName, categoryId: itemCategoryId });
      } else {
        await adminCatalogService.createItem({ name: itemName, categoryId: itemCategoryId });
      }
      setIsItemModalOpen(false);
      loadItems();
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi lưu loại sản phẩm');
    }
  };

  const handleDeleteItem = async (id: string) => {
    const confirmed = await dialogService.confirm(
      'Bạn có chắc chắn muốn xóa loại sản phẩm này?',
      { title: 'Xác Nhận Xóa Loại Sản Phẩm', type: 'warning' }
    );
    if (!confirmed) return;
    try {
      await adminCatalogService.deleteItem(id);
      loadItems();
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi xóa loại sản phẩm');
    }
  };

  const openItemModal = (item?: AdminItem) => {
    if (item) {
      setEditingItem(item);
      setItemName(item.name);
      setItemCategoryId(item.category.id);
    } else {
      setEditingItem(null);
      setItemName('');
      setItemCategoryId(itemCategoryFilter || (categories.length > 0 ? categories[0].id : ''));
    }
    setIsItemModalOpen(true);
  };

  // OFFICIAL TEMPLATE ACTIONS
  const handleSaveTemplate = async () => {
    if (!templateCategoryId || !templateText.trim()) {
      await dialogService.warning('Vui lòng chọn Danh mục và nhập nội dung kịch bản câu hỏi');
      return;
    }
    try {
      const normalizedItemId =
        templateItemId && templateItemId !== '__CATEGORY_ONLY__' ? templateItemId : null;

      if (editingTemplate) {
        await adminCatalogService.updateTemplate(editingTemplate.id, {
          categoryId: templateCategoryId,
          itemId: normalizedItemId,
          templateText: templateText.trim()
        });
      } else {
        await adminCatalogService.createTemplate({
          categoryId: templateCategoryId,
          itemId: normalizedItemId,
          templateText: templateText.trim()
        });
      }
      setIsTemplateModalOpen(false);
      loadTemplates();
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi lưu kịch bản');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const confirmed = await dialogService.confirm(
      'Bạn có chắc chắn muốn xóa kịch bản chính thức này khỏi cơ sở dữ liệu?',
      { title: 'Xác Nhận Xóa Kịch Bản', type: 'warning' }
    );
    if (!confirmed) return;
    try {
      await adminCatalogService.deleteTemplate(id);
      loadTemplates();
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi xóa kịch bản');
    }
  };

  const openTemplateModal = (tpl?: AdminCategoryQuestionTemplate) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setTemplateCategoryId(tpl.categoryId);
      setTemplateItemId(tpl.itemId || '');
      setTemplateText(tpl.templateText);
    } else {
      setEditingTemplate(null);
      setTemplateCategoryId(templateCategoryFilter || (categories.length > 0 ? categories[0].id : ''));
      setTemplateItemId(
        templateItemFilter && templateItemFilter !== '__CATEGORY_ONLY__' ? templateItemFilter : ''
      );
      setTemplateText('');
    }
    setIsTemplateModalOpen(true);
  };

  const appendSampleQuestionLine = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter(prev => {
      const trimmed = prev.trimEnd();
      const sample = '**Thông số kỹ thuật chuyên biệt cần hỏi?** (Ví dụ: Lựa chọn 1, Lựa chọn 2, Lựa chọn 3, Lựa chọn 4)';
      return trimmed ? `${trimmed}\n${sample}` : sample;
    });
  };

  // AI PROPOSAL REVIEW ACTIONS
  const openProposalReviewModal = (proposal: AdminTemplateProposal) => {
    setReviewingProposal(proposal);
    setProposalDraftText(proposal.templateText);
    setIsProposalModalOpen(true);
  };

  const handleSaveProposalDraft = async () => {
    if (!reviewingProposal) return;
    if (!proposalDraftText.trim()) {
      await dialogService.warning('Nội dung kịch bản không được để trống');
      return;
    }
    setIsSubmittingProposalAction(true);
    try {
      await adminCatalogService.updateTemplateProposal(reviewingProposal.id, {
        templateText: proposalDraftText.trim()
      });
      await dialogService.success('Đã lưu bản chỉnh sửa tạm thời cho đề xuất này.');
      await loadProposals(proposalStatusFilter);
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi lưu bản chỉnh sửa đề xuất');
    } finally {
      setIsSubmittingProposalAction(false);
    }
  };

  const handleApproveProposal = async (proposal: AdminTemplateProposal, customText?: string) => {
    const finalText = (customText !== undefined ? customText : proposal.templateText).trim();
    if (!finalText) {
      await dialogService.warning('Nội dung kịch bản duyệt không được để trống');
      return;
    }

    if (customText === undefined) {
      const targetName = proposal.itemName || `Chung danh mục ${proposal.categoryName}`;
      const confirmed = await dialogService.confirm(
        `Duyệt và lưu chính thức kịch bản câu hỏi cho "${targetName}" xuống cơ sở dữ liệu? Từ các lần đăng bài tiếp theo, người bán sẽ nhận ngay kịch bản chuẩn này.`,
        { title: 'Xác Nhận Duyệt Xuống DB', type: 'info' }
      );
      if (!confirmed) return;
    }

    setIsSubmittingProposalAction(true);
    try {
      await adminCatalogService.approveTemplateProposal(proposal.id, {
        templateText: finalText
      });
      setIsProposalModalOpen(false);
      setReviewingProposal(null);
      await dialogService.success('Đã duyệt và lưu kịch bản câu hỏi chính thức vào cơ sở dữ liệu!');
      await loadProposals(proposalStatusFilter);
      await refreshPendingCount();
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi duyệt kịch bản');
    } finally {
      setIsSubmittingProposalAction(false);
    }
  };

  const openRejectProposalModal = (proposal: AdminTemplateProposal) => {
    setRejectingProposal(proposal);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmRejectProposal = async () => {
    if (!rejectingProposal) return;
    setIsSubmittingProposalAction(true);
    try {
      await adminCatalogService.rejectTemplateProposal(rejectingProposal.id, {
        reason: rejectReason.trim() || null
      });
      setIsRejectModalOpen(false);
      setRejectingProposal(null);
      if (reviewingProposal?.id === rejectingProposal.id) {
        setIsProposalModalOpen(false);
        setReviewingProposal(null);
      }
      await loadProposals(proposalStatusFilter);
      await refreshPendingCount();
    } catch (err: any) {
      dialogService.error(err?.message || 'Lỗi khi từ chối đề xuất');
    } finally {
      setIsSubmittingProposalAction(false);
    }
  };

  const filteredTemplates = templates
    .filter(t => !templateCategoryFilter || t.categoryId === templateCategoryFilter)
    .filter(t => {
      if (!templateItemFilter) return true;
      if (templateItemFilter === '__CATEGORY_ONLY__') return !t.itemId;
      return t.itemId === templateItemFilter;
    });

  const filteredProposals = proposals.filter(
    p => !proposalCategoryFilter || p.categoryId === proposalCategoryFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-[#24263e]">Quản Lý Catalog & Kịch Bản AI</h2>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý danh mục, loại thiết bị, kịch bản câu hỏi chuẩn trong DB và duyệt đề xuất câu hỏi AI tạm thời
          </p>
        </div>
      </div>

      {/* Alert Banner when there are pending AI proposals */}
      {pendingProposalsCount > 0 && activeSubTab !== 'proposals' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-950">
                Có {pendingProposalsCount} kịch bản câu hỏi AI tạm thời đang chờ Admin duyệt
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                AI đã khởi tạo tạm câu hỏi chuyên biệt cho các mặt hàng chưa có kịch bản trong DB. Bạn có thể chỉnh sửa thủ công trước khi duyệt lưu xuống DB.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setProposalStatusFilter('PENDING');
              setActiveSubTab('proposals');
            }}
            className="px-4 py-2 bg-[#c34c36] hover:bg-[#a13b28] text-white text-xs font-bold rounded-xl transition shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" /> Xem & Duyệt Ngay
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('categories')}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'categories'
              ? 'border-[#c34c36] text-[#c34c36]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          Danh Mục (Categories)
        </button>

        <button
          onClick={() => setActiveSubTab('items')}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'items'
              ? 'border-[#c34c36] text-[#c34c36]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Tag className="w-4 h-4" />
          Loại Sản Phẩm (Items)
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'templates'
              ? 'border-[#c34c36] text-[#c34c36]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <MessageSquareQuote className="w-4 h-4" />
          Kịch Bản Chính Thức (DB)
        </button>

        <button
          onClick={() => setActiveSubTab('proposals')}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'proposals'
              ? 'border-[#c34c36] text-[#c34c36]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Đề Xuất AI Chờ Duyệt
          {pendingProposalsCount > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-rose-600 text-white">
              {pendingProposalsCount}
            </span>
          )}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      )}

      {/* TAB: CATEGORIES */}
      {!isLoading && activeSubTab === 'categories' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex justify-end">
            <button
              onClick={() => openCategoryModal()}
              className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-sm font-bold rounded-xl flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" /> Thêm Danh Mục Mới
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4">Tên Danh Mục</th>
                  <th className="p-4">Mô Tả</th>
                  <th className="p-4">ID Hệ Thống</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500 text-sm">
                      Chưa có dữ liệu danh mục
                    </td>
                  </tr>
                ) : (
                  categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 text-sm font-bold text-[#24263e]">{cat.name}</td>
                      <td className="p-4 text-sm text-gray-600">{cat.description || '-'}</td>
                      <td className="p-4 text-xs font-mono text-gray-400">{cat.id}</td>
                      <td className="p-4 flex items-center justify-end gap-2">
                        <button
                          onClick={() => openCategoryModal(cat)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ITEMS */}
      {!isLoading && activeSubTab === 'items' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-1/3 relative">
              <Search className="w-4 h-4 absolute left-3 text-gray-400" />
              <select
                value={itemCategoryFilter}
                onChange={e => setItemCategoryFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:outline-none appearance-none"
              >
                <option value="">Tất cả danh mục</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => openItemModal()}
              className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-sm font-bold rounded-xl flex items-center gap-2 transition shrink-0"
            >
              <Plus className="w-4 h-4" /> Thêm Loại Sản Phẩm
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4">Loại Sản Phẩm</th>
                  <th className="p-4">Thuộc Danh Mục</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.filter(i => !itemCategoryFilter || i.category.id === itemCategoryFilter).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500 text-sm">
                      Chưa có loại sản phẩm nào
                    </td>
                  </tr>
                ) : (
                  items
                    .filter(i => !itemCategoryFilter || i.category.id === itemCategoryFilter)
                    .map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 text-sm font-bold text-[#24263e]">{item.name}</td>
                        <td className="p-4 text-sm text-gray-600">
                          <span className="px-2 py-1 bg-amber-50 text-amber-800 rounded-md text-xs font-bold border border-amber-100">
                            {item.category.name}
                          </span>
                        </td>
                        <td className="p-4 flex items-center justify-end gap-2">
                          <button
                            onClick={() => openItemModal(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: OFFICIAL TEMPLATES */}
      {!isLoading && activeSubTab === 'templates' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex gap-2 w-full sm:w-2/3">
              <select
                value={templateCategoryFilter}
                onChange={e => {
                  setTemplateCategoryFilter(e.target.value);
                  setTemplateItemFilter('');
                }}
                className="w-1/2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:outline-none"
              >
                <option value="">Tất cả Danh mục</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={templateItemFilter}
                onChange={e => setTemplateItemFilter(e.target.value)}
                disabled={!templateCategoryFilter}
                className="w-1/2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:outline-none disabled:bg-gray-50"
              >
                <option value="">Tất cả loại SP & Kịch bản chung</option>
                <option value="__CATEGORY_ONLY__">Chỉ kịch bản chung toàn danh mục</option>
                {items
                  .filter(i => i.category.id === templateCategoryFilter)
                  .map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
            </div>
            <button
              onClick={() => openTemplateModal()}
              className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-sm font-bold rounded-xl flex items-center gap-2 transition shrink-0"
            >
              <Plus className="w-4 h-4" /> Thêm Kịch Bản Chính Thức
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredTemplates.map(tpl => {
              const catObj = categories.find(c => c.id === tpl.categoryId);
              const itemObj = items.find(i => i.id === tpl.itemId);
              const catLabel = catObj?.name || 'Không xác định';
              const itemLabel = itemObj?.name || 'Chung cho toàn danh mục';

              return (
                <div key={tpl.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-3 gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-1.5">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-md uppercase tracking-wider">
                          {catLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider ${
                            tpl.itemId
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {itemLabel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono">ID: {tpl.id}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openTemplateModal(tpl)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                      Preview câu hỏi & gợi ý chọn nhanh cho người bán
                    </h4>
                    {renderTemplateLinesPreview(tpl.templateText)}
                  </div>
                </div>
              );
            })}
            {filteredTemplates.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm bg-white rounded-2xl border border-gray-200">
                Chưa có kịch bản chính thức nào khớp bộ lọc
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: AI TEMPLATE PROPOSALS */}
      {!isLoading && activeSubTab === 'proposals' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col lg:flex-row justify-between gap-3 items-start lg:items-center">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'PENDING', label: 'Chờ duyệt' },
                  { id: 'APPROVED', label: 'Đã duyệt lưu DB' },
                  { id: 'REJECTED', label: 'Đã từ chối' },
                  { id: 'ALL', label: 'Tất cả' }
                ] as { id: ProposalFilterStatus; label: string }[]
              ).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setProposalStatusFilter(opt.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    proposalStatusFilter === opt.id
                      ? 'bg-[#24263e] text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                  {opt.id === 'PENDING' && pendingProposalsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-[#24263e] font-black">
                      {pendingProposalsCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="w-full lg:w-64">
              <select
                value={proposalCategoryFilter}
                onChange={e => setProposalCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:outline-none"
              >
                <option value="">Lọc theo Danh mục</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredProposals.map(proposal => {
              const isPending = proposal.status === 'PENDING';
              const isApproved = proposal.status === 'APPROVED';

              return (
                <div
                  key={proposal.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm transition ${
                    isPending ? 'border-amber-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-gray-100 pb-3 mb-3 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {isPending && (
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Chờ Admin Duyệt
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Đã Lưu Xuống DB
                          </span>
                        )}
                        {proposal.status === 'REJECTED' && (
                          <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Đã Từ Chối
                          </span>
                        )}

                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-md uppercase tracking-wider">
                          {proposal.categoryName}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-black rounded-md uppercase tracking-wider">
                          {proposal.itemName || 'Chung toàn danh mục'}
                        </span>
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                          <Flame className="w-3 h-3" /> {proposal.requestCount} lượt người bán sử dụng tạm
                        </span>
                      </div>

                      <p className="text-xs text-gray-500">
                        Khởi tạo lúc:{' '}
                        <span className="font-semibold text-gray-700">
                          {new Date(proposal.createdAt).toLocaleString('vi-VN')}
                        </span>
                        {proposal.reviewedAt && (
                          <>
                            {' • '}Xử lý lúc:{' '}
                            <span className="font-semibold text-gray-700">
                              {new Date(proposal.reviewedAt).toLocaleString('vi-VN')}
                            </span>
                          </>
                        )}
                      </p>

                      {proposal.status === 'REJECTED' && proposal.rejectionReason && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                          <strong>Lý do từ chối:</strong> {proposal.rejectionReason}
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => openProposalReviewModal(proposal)}
                          disabled={isSubmittingProposalAction}
                          className="px-3.5 py-2 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Chỉnh Sửa & Duyệt
                        </button>
                        <button
                          onClick={() => handleApproveProposal(proposal)}
                          disabled={isSubmittingProposalAction}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Duyệt Nhanh
                        </button>
                        <button
                          onClick={() => openRejectProposalModal(proposal)}
                          disabled={isSubmittingProposalAction}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Từ Chối
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                      Nội dung câu hỏi AI đã sinh tạm cho người bán
                    </h4>
                    {renderTemplateLinesPreview(proposal.templateText)}
                  </div>
                </div>
              );
            })}

            {filteredProposals.length === 0 && (
              <div className="p-10 text-center text-gray-500 text-sm bg-white rounded-2xl border border-gray-200">
                {proposalStatusFilter === 'PENDING'
                  ? 'Hiện không có kịch bản câu hỏi AI nào đang chờ duyệt.'
                  : 'Không có đề xuất nào khớp bộ lọc đã chọn.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsCategoryModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-xl border border-gray-200 animate-slideUp overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-black text-[#24263e] text-lg">
                {editingCategory ? 'Sửa Danh Mục' : 'Thêm Danh Mục Mới'}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Tên danh mục *</label>
                <input
                  type="text"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition"
                  placeholder="VD: Đồ điện tử..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Mô tả (Không bắt buộc)</label>
                <textarea
                  value={catDesc}
                  onChange={e => setCatDesc(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition resize-none"
                  placeholder="Chi tiết danh mục..."
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-5 py-2.5 rounded-xl font-bold bg-[#c34c36] hover:bg-[#a13b28] text-white transition text-sm shadow-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> {editingCategory ? 'Lưu Thay Đổi' : 'Tạo Danh Mục'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsItemModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-xl border border-gray-200 animate-slideUp overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-black text-[#24263e] text-lg">
                {editingItem ? 'Sửa Loại Sản Phẩm' : 'Thêm Loại Sản Phẩm'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Thuộc danh mục *</label>
                <select
                  value={itemCategoryId}
                  onChange={e => setItemCategoryId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition"
                >
                  <option value="" disabled>
                    -- Chọn danh mục --
                  </option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Tên loại sản phẩm *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition"
                  placeholder="VD: Smart Tivi, Máy lạnh Inverter..."
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveItem}
                className="px-5 py-2.5 rounded-xl font-bold bg-[#c34c36] hover:bg-[#a13b28] text-white transition text-sm shadow-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> {editingItem ? 'Lưu Thay Đổi' : 'Tạo Sản Phẩm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsTemplateModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl w-full max-w-5xl shadow-xl border border-gray-200 animate-slideUp overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="font-black text-[#24263e] text-lg">
                {editingTemplate ? 'Sửa Kịch Bản Chính Thức (DB)' : 'Thêm Kịch Bản Chính Thức Mới'}
              </h3>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">Danh mục áp dụng *</label>
                  <select
                    value={templateCategoryId}
                    onChange={e => {
                      setTemplateCategoryId(e.target.value);
                      setTemplateItemId('');
                    }}
                    className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition"
                  >
                    <option value="" disabled>
                      -- Chọn danh mục --
                    </option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">
                    Loại SP áp dụng (Để trống = Áp dụng chung toàn danh mục)
                  </label>
                  <select
                    value={templateItemId}
                    onChange={e => setTemplateItemId(e.target.value)}
                    disabled={!templateCategoryId}
                    className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition disabled:bg-gray-100"
                  >
                    <option value="">Áp dụng chung toàn danh mục</option>
                    {items
                      .filter(i => i.category.id === templateCategoryId)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-600">
                      Nội dung kịch bản câu hỏi (Markdown) *
                    </label>
                    <button
                      type="button"
                      onClick={() => appendSampleQuestionLine(setTemplateText)}
                      className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm dòng câu hỏi mẫu
                    </button>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-xl border border-blue-200 leading-relaxed">
                    Cú pháp mỗi dòng: <code>**[Câu hỏi]?** (Ví dụ: gợi ý 1, gợi ý 2, gợi ý 3)</code>
                  </div>
                  <textarea
                    value={templateText}
                    onChange={e => setTemplateText(e.target.value)}
                    rows={12}
                    className="w-full p-4 bg-slate-900 text-green-400 font-mono border-0 rounded-xl text-xs leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-none transition resize-y"
                    placeholder={`**Tần suất và mức độ sử dụng thực tế?** (Ví dụ: Mới dùng vài lần cất kho, Dùng ít 2-3 lần/tuần, Dùng hằng ngày)\n**Hiện trạng ngoại quan và phụ kiện đi kèm?** (Ví dụ: Đẹp 98-99% đủ remote + chân đế, Xước nhẹ đủ phụ kiện)\n**Tình trạng vận hành kỹ thuật và bảo hành?** (Ví dụ: Nguyên zin chưa sửa chữa, Còn bảo hành hãng)\n**Kích thước màn hình Tivi là bao nhiêu inch?** (Ví dụ: 43 inch, 50 inch, 55 inch, 65 inch)`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 block">
                    Xem trước giao diện câu hỏi của Người bán (Live Preview)
                  </label>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 max-h-[380px] overflow-y-auto">
                    {renderTemplateLinesPreview(templateText)}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-5 py-2.5 rounded-xl font-bold bg-[#c34c36] hover:bg-[#a13b28] text-white transition text-sm shadow-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> {editingTemplate ? 'Lưu Kịch Bản' : 'Tạo Kịch Bản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Review & Manual Edit Modal */}
      {isProposalModalOpen && reviewingProposal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !isSubmittingProposalAction && setIsProposalModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl w-full max-w-5xl shadow-xl border border-gray-200 animate-slideUp overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-start gap-4 shrink-0">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-md uppercase tracking-wider">
                    {reviewingProposal.categoryName}
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-black rounded-md uppercase tracking-wider">
                    {reviewingProposal.itemName || 'Chung toàn danh mục'}
                  </span>
                  <span className="px-2.5 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-bold rounded-md">
                    {reviewingProposal.requestCount} lượt người bán cần kịch bản này
                  </span>
                </div>
                <h3 className="font-black text-[#24263e] text-lg">
                  Chỉnh Sửa Thủ Công & Duyệt Lưu Kịch Bản Xuống DB
                </h3>
              </div>
              <button
                onClick={() => setIsProposalModalOpen(false)}
                disabled={isSubmittingProposalAction}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto grow">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                <strong>Hướng dẫn duyệt:</strong> Bạn có thể điều chỉnh lại câu chữ, thêm/bớt các gợi ý trả lời nhanh trong ngoặc <code>(Ví dụ: ...)</code> cho sát thực tế nhất trước khi bấm <strong>Duyệt & Lưu Xuống DB</strong>.
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-600">
                      Chỉnh sửa nội dung câu hỏi (Markdown) *
                    </label>
                    <button
                      type="button"
                      onClick={() => appendSampleQuestionLine(setProposalDraftText)}
                      className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm dòng câu hỏi
                    </button>
                  </div>
                  <textarea
                    value={proposalDraftText}
                    onChange={e => setProposalDraftText(e.target.value)}
                    rows={14}
                    className="w-full p-4 bg-slate-900 text-green-400 font-mono border-0 rounded-xl text-xs leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-none transition resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 block">
                    Xem trước trực tiếp giao diện hiển thị cho Người bán
                  </label>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 max-h-[400px] overflow-y-auto">
                    {renderTemplateLinesPreview(proposalDraftText)}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-wrap justify-between items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => openRejectProposalModal(reviewingProposal)}
                disabled={isSubmittingProposalAction}
                className="px-4 py-2.5 rounded-xl font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 transition text-xs flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Từ Chối Đề Xuất
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsProposalModalOpen(false)}
                  disabled={isSubmittingProposalAction}
                  className="px-4 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-xs"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveProposalDraft}
                  disabled={isSubmittingProposalAction}
                  className="px-4 py-2.5 rounded-xl font-bold bg-white border border-gray-300 hover:bg-gray-100 text-[#24263e] transition text-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Lưu Nháp Chỉnh Sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveProposal(reviewingProposal, proposalDraftText)}
                  disabled={isSubmittingProposalAction}
                  className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition text-xs shadow-sm flex items-center gap-1.5"
                >
                  {isSubmittingProposalAction ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Duyệt & Lưu Xuống DB
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Proposal Modal */}
      {isRejectModalOpen && rejectingProposal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !isSubmittingProposalAction && setIsRejectModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-xl border border-gray-200 animate-slideUp overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-black text-[#24263e] text-lg">Từ Chối Đề Xuất Kịch Bản AI</h3>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isSubmittingProposalAction}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                Đề xuất cho{' '}
                <strong>{rejectingProposal.itemName || rejectingProposal.categoryName}</strong> sẽ được đánh dấu từ chối và <strong>không lưu</strong> vào bảng kịch bản chính thức trong DB.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">
                  Lý do từ chối (Không bắt buộc)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-rose-400 focus:bg-white focus:outline-none transition resize-none"
                  placeholder="VD: Câu hỏi chưa sát thông số, sẽ tạo lại kịch bản khác..."
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isSubmittingProposalAction}
                className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmRejectProposal}
                disabled={isSubmittingProposalAction}
                className="px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white transition text-xs flex items-center gap-1.5"
              >
                {isSubmittingProposalAction ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
