import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Tag,
  MessageSquareQuote,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Check,
  X
} from 'lucide-react';
import { Language } from '../../types';
import {
  adminCatalogService,
  AdminCategory,
  AdminItem,
  AdminCategoryQuestionTemplate
} from '../../services/adminCatalogService';
import { parseQuestionItem } from '../../utils/questionParser';

interface CatalogAiTabProps {
  lang: Language;
}

export const CatalogAiTab: React.FC<CatalogAiTabProps> = ({ lang }) => {
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'items' | 'templates'>('categories');

  // Data states
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [templates, setTemplates] = useState<AdminCategoryQuestionTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter states
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('');
  const [templateItemFilter, setTemplateItemFilter] = useState<string>('');

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Edit states
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<AdminCategoryQuestionTemplate | null>(null);

  // Form states
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');

  const [templateCategoryId, setTemplateCategoryId] = useState('');
  const [templateItemId, setTemplateItemId] = useState('');
  const [templateText, setTemplateText] = useState('');

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

  useEffect(() => {
    if (activeSubTab === 'categories') loadCategories();
    if (activeSubTab === 'items') {
      loadCategories();
      loadItems();
    }
    if (activeSubTab === 'templates') {
      loadCategories();
      loadItems();
      loadTemplates();
    }
  }, [activeSubTab]);

  // CATEGORY ACTIONS
  const handleSaveCategory = async () => {
    if (!catName.trim()) return alert('Vui lòng nhập tên danh mục');
    try {
      if (editingCategory) {
        await adminCatalogService.updateCategory(editingCategory.id, { name: catName, description: catDesc });
      } else {
        await adminCatalogService.createCategory({ name: catName, description: catDesc });
      }
      setIsCategoryModalOpen(false);
      loadCategories();
    } catch (err) {
      alert('Lỗi khi lưu danh mục');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa danh mục này? Các sản phẩm thuộc danh mục cũng có thể bị ảnh hưởng.')) return;
    try {
      await adminCatalogService.deleteCategory(id);
      loadCategories();
    } catch (err) {
      alert('Lỗi khi xóa danh mục');
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
    if (!itemName.trim() || !itemCategoryId) return alert('Vui lòng nhập tên và chọn danh mục');
    try {
      if (editingItem) {
        await adminCatalogService.updateItem(editingItem.id, { name: itemName, categoryId: itemCategoryId });
      } else {
        await adminCatalogService.createItem({ name: itemName, categoryId: itemCategoryId });
      }
      setIsItemModalOpen(false);
      loadItems();
    } catch (err) {
      alert('Lỗi khi lưu loại sản phẩm');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa loại sản phẩm này?')) return;
    try {
      await adminCatalogService.deleteItem(id);
      loadItems();
    } catch (err) {
      alert('Lỗi khi xóa loại sản phẩm');
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

  // TEMPLATE ACTIONS
  const handleSaveTemplate = async () => {
    if (!templateCategoryId || !templateText.trim()) return alert('Vui lòng chọn danh mục và nhập nội dung kịch bản');
    try {
      if (editingTemplate) {
        await adminCatalogService.updateTemplate(editingTemplate.id, { 
          categoryId: templateCategoryId, 
          itemId: templateItemId || null, 
          templateText 
        });
      } else {
        await adminCatalogService.createTemplate({ 
          categoryId: templateCategoryId, 
          itemId: templateItemId || null, 
          templateText 
        });
      }
      setIsTemplateModalOpen(false);
      loadTemplates();
    } catch (err) {
      alert('Lỗi khi lưu kịch bản');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa kịch bản này?')) return;
    try {
      await adminCatalogService.deleteTemplate(id);
      loadTemplates();
    } catch (err) {
      alert('Lỗi khi xóa kịch bản');
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
      setTemplateItemId(templateItemFilter || '');
      setTemplateText('');
    }
    setIsTemplateModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-[#24263e]">Quản Lý Catalog & Kịch Bản AI</h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý cấu trúc danh mục, loại thiết bị và các kịch bản câu hỏi khảo sát động</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {[
          { id: 'categories', label: 'Danh Mục (Categories)', icon: FolderTree },
          { id: 'items', label: 'Loại Sản Phẩm (Items)', icon: Tag },
          { id: 'templates', label: 'Kịch Bản AI (Templates)', icon: MessageSquareQuote }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              activeSubTab === tab.id 
                ? 'border-[#c34c36] text-[#c34c36]' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
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
            <button onClick={() => openCategoryModal()} className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-sm font-bold rounded-xl flex items-center gap-2 transition">
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
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500 text-sm">Chưa có dữ liệu danh mục</td></tr>
                ) : categories.map(cat => (
                  <tr key={cat.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-sm font-bold text-[#24263e]">{cat.name}</td>
                    <td className="p-4 text-sm text-gray-600">{cat.description || '-'}</td>
                    <td className="p-4 text-xs font-mono text-gray-400">{cat.id}</td>
                    <td className="p-4 flex items-center justify-end gap-2">
                      <button onClick={() => openCategoryModal(cat)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
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
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={() => openItemModal()} className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-sm font-bold rounded-xl flex items-center gap-2 transition shrink-0">
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
                  <tr><td colSpan={3} className="p-8 text-center text-gray-500 text-sm">Chưa có loại sản phẩm nào</td></tr>
                ) : items
                  .filter(i => !itemCategoryFilter || i.category.id === itemCategoryFilter)
                  .map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-sm font-bold text-[#24263e]">{item.name}</td>
                    <td className="p-4 text-sm text-gray-600">
                      <span className="px-2 py-1 bg-amber-50 text-amber-800 rounded-md text-xs font-bold border border-amber-100">{item.category.name}</span>
                    </td>
                    <td className="p-4 flex items-center justify-end gap-2">
                      <button onClick={() => openItemModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: TEMPLATES */}
      {!isLoading && activeSubTab === 'templates' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex gap-2 w-full sm:w-1/2">
              <select 
                value={templateCategoryFilter}
                onChange={e => {
                  setTemplateCategoryFilter(e.target.value);
                  setTemplateItemFilter('');
                }}
                className="w-1/2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:outline-none"
              >
                <option value="">Lọc theo Danh mục</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select 
                value={templateItemFilter}
                onChange={e => setTemplateItemFilter(e.target.value)}
                disabled={!templateCategoryFilter}
                className="w-1/2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:outline-none disabled:bg-gray-50"
              >
                <option value="">Lọc theo SP (Chung)</option>
                {items.filter(i => i.category.id === templateCategoryFilter).map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <button onClick={() => openTemplateModal()} className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-sm font-bold rounded-xl flex items-center gap-2 transition shrink-0">
              <Plus className="w-4 h-4" /> Thêm Kịch Bản Mới
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {templates
              .filter(t => !templateCategoryFilter || t.categoryId === templateCategoryFilter)
              .filter(t => !templateItemFilter || t.itemId === templateItemFilter)
              .map(tpl => {
                const catName = categories.find(c => c.id === tpl.categoryId)?.name || 'Unknown';
                const itemName = items.find(i => i.id === tpl.itemId)?.name || 'Chung cho toàn danh mục';
                
                return (
                  <div key={tpl.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-3">
                      <div>
                        <div className="flex gap-2 mb-1.5">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-md uppercase tracking-wider">{catName}</span>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black rounded-md uppercase tracking-wider">{itemName}</span>
                        </div>
                        <p className="text-xs text-gray-500 font-mono">ID: {tpl.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openTemplateModal(tpl)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1">
                          <Edit2 className="w-3.5 h-3.5" /> Sửa
                        </button>
                        <button onClick={() => handleDeleteTemplate(tpl.id)} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-gray-100">
                      <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Preview nội dung</h4>
                      <div className="space-y-3">
                        {tpl.templateText.split('\n').filter(l => l.trim().startsWith('**')).map((line, idx) => {
                          const parsed = parseQuestionItem(line, idx);
                          return (
                            <div key={idx} className="bg-white p-3 rounded-xl shadow-2xs border border-gray-100 flex flex-col gap-1.5">
                              <div className="flex gap-2">
                                <span className="w-5 h-5 rounded-md bg-[#24263e] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                                <h5 className="text-xs font-bold text-[#24263e]">{parsed.label}</h5>
                              </div>
                              {parsed.hint && <p className="text-[10px] text-gray-400 italic ml-7">{parsed.hint}</p>}
                              {parsed.examples.length > 0 && (
                                <div className="flex gap-1 ml-7 flex-wrap">
                                  {parsed.examples.map((ex, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200/50 rounded-full text-[9px] font-bold">+{ex}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!tpl.templateText.includes('**') && (
                          <div className="text-xs text-gray-500 whitespace-pre-wrap">{tpl.templateText}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
            })}
            {templates.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm bg-white rounded-2xl border border-gray-200">Chưa có kịch bản mẫu nào được tạo</div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCategoryModalOpen(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-xl border border-gray-200 animate-slideUp overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-black text-[#24263e] text-lg">{editingCategory ? 'Sửa Danh Mục' : 'Thêm Danh Mục Mới'}</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Tên danh mục *</label>
                <input type="text" value={catName} onChange={e => setCatName(e.target.value)} className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition" placeholder="VD: Đồ điện tử..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Mô tả (Không bắt buộc)</label>
                <textarea value={catDesc} onChange={e => setCatDesc(e.target.value)} rows={3} className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition resize-none" placeholder="Chi tiết danh mục..." />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsCategoryModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-sm">Hủy</button>
              <button onClick={handleSaveCategory} className="px-5 py-2.5 rounded-xl font-bold bg-[#c34c36] hover:bg-[#a13b28] text-white transition text-sm shadow-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> {editingCategory ? 'Lưu Thay Đổi' : 'Tạo Danh Mục'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsItemModalOpen(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-xl border border-gray-200 animate-slideUp overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-black text-[#24263e] text-lg">{editingItem ? 'Sửa Loại Sản Phẩm' : 'Thêm Loại Sản Phẩm'}</h3>
              <button onClick={() => setIsItemModalOpen(false)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Thuộc danh mục *</label>
                <select value={itemCategoryId} onChange={e => setItemCategoryId(e.target.value)} className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition">
                  <option value="" disabled>-- Chọn danh mục --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Tên loại sản phẩm *</label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition" placeholder="VD: Máy lạnh Inverter..." />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsItemModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-sm">Hủy</button>
              <button onClick={handleSaveItem} className="px-5 py-2.5 rounded-xl font-bold bg-[#c34c36] hover:bg-[#a13b28] text-white transition text-sm shadow-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> {editingItem ? 'Lưu Thay Đổi' : 'Tạo Sản Phẩm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsTemplateModalOpen(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-2xl shadow-xl border border-gray-200 animate-slideUp overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="font-black text-[#24263e] text-lg">{editingTemplate ? 'Sửa Kịch Bản AI' : 'Thêm Kịch Bản AI Mới'}</h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto grow">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">Danh mục áp dụng *</label>
                  <select value={templateCategoryId} onChange={e => { setTemplateCategoryId(e.target.value); setTemplateItemId(''); }} className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition">
                    <option value="" disabled>-- Chọn danh mục --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">Loại SP áp dụng (Không chọn = Chung)</label>
                  <select value={templateItemId} onChange={e => setTemplateItemId(e.target.value)} disabled={!templateCategoryId} className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:bg-white focus:outline-none transition disabled:bg-gray-100">
                    <option value="">Áp dụng chung toàn danh mục</option>
                    {items.filter(i => i.category.id === templateCategoryId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 flex justify-between">
                  <span>Nội dung kịch bản (Markdown) *</span>
                  <a href="#" className="text-blue-600 hover:underline">Xem hướng dẫn format</a>
                </label>
                <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-xl border border-blue-200 leading-relaxed">
                  Cú pháp yêu cầu: <code>**[Câu hỏi]** (Ví dụ: gợi ý 1, gợi ý 2)</code> trên từng dòng.<br/>
                  Hệ thống sẽ tự động parse thành UI khảo sát người dùng.
                </div>
                <textarea 
                  value={templateText} 
                  onChange={e => setTemplateText(e.target.value)} 
                  rows={8} 
                  className="w-full p-4 bg-slate-900 text-green-400 font-mono border-0 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition resize-none" 
                  placeholder="**Hãng sản xuất** (Ví dụ: Samsung, LG, Panasonic)&#10;**Thời gian sử dụng** (Ví dụ: Dưới 6 tháng, 1 năm)..." 
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsTemplateModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-sm">Hủy</button>
              <button onClick={handleSaveTemplate} className="px-5 py-2.5 rounded-xl font-bold bg-[#c34c36] hover:bg-[#a13b28] text-white transition text-sm shadow-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> {editingTemplate ? 'Lưu Kịch Bản' : 'Tạo Kịch Bản'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
