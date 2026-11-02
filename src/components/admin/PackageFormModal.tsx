import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Tag, Loader2, Check } from 'lucide-react';
import { TopupPackage } from '../../types';
import { formatVND } from '../../utils/translations';

export interface PackageFormData {
  name: string;
  description: string;
  postCredits: number;
  chatCredits: number;
  valuationCredits: number;
  price: number;
  active: boolean;
}

interface PackageFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPackage: TopupPackage | null;
  onSave: (data: PackageFormData) => Promise<void>;
}

export const PackageFormModal: React.FC<PackageFormModalProps> = ({
  isOpen,
  onClose,
  editingPackage,
  onSave,
}) => {
  const [formData, setFormData] = useState<PackageFormData>({
    name: '',
    description: '',
    postCredits: 1,
    chatCredits: 0,
    valuationCredits: 0,
    price: 20000,
    active: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync form state only when modal opens or package target changes
  useEffect(() => {
    if (isOpen) {
      if (editingPackage) {
        setFormData({
          name: editingPackage.name || editingPackage.packageName || '',
          description: editingPackage.description || '',
          postCredits: Number(editingPackage.postCredits || 0),
          chatCredits: Number(editingPackage.chatCredits || 0),
          valuationCredits: Number(editingPackage.valuationCredits || 0),
          price: Number(editingPackage.price || editingPackage.priceVnd || 0),
          active: editingPackage.active !== false,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          postCredits: 1,
          chatCredits: 0,
          valuationCredits: 0,
          price: 20000,
          active: true,
        });
      }
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, editingPackage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = formData.name.trim();
    if (!nameTrimmed) {
      setError('Tên gói dịch vụ không được để trống.');
      return;
    }
    if (nameTrimmed.length > 100) {
      setError('Tên gói dịch vụ tối đa 100 ký tự.');
      return;
    }
    if (formData.description && formData.description.trim().length > 255) {
      setError('Mô tả gói tối đa 255 ký tự.');
      return;
    }
    const numPrice = Number(formData.price) || 0;
    if (numPrice < 1000) {
      setError('Giá gói tối thiểu là 1.000 VNĐ.');
      return;
    }
    const posts = Math.floor(Number(formData.postCredits) || 0);
    const chats = Math.floor(Number(formData.chatCredits) || 0);
    const vals = Math.floor(Number(formData.valuationCredits) || 0);
    if (posts < 0 || chats < 0 || vals < 0) {
      setError('Số lượng lượt dịch vụ phải là số nguyên không âm.');
      return;
    }
    if (posts + chats + vals <= 0) {
      setError('Gói phải chứa ít nhất 1 lượt dịch vụ (tổng lượt đăng tin, chat AI, định giá AI > 0).');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        name: nameTrimmed,
        description: formData.description.trim(),
        postCredits: posts,
        chatCredits: chats,
        valuationCredits: vals,
        price: numPrice,
        active: formData.active,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể lưu thông tin gói dịch vụ.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 transform transition-all scale-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-200">
              🎁
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                {editingPackage ? 'Chỉnh Sửa Gói Dịch Vụ' : 'Thêm Gói Dịch Vụ Mới'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {editingPackage
                  ? `Cập nhật thông số gói #${String(editingPackage.id).slice(0, 8)}... (version: ${editingPackage.packageVersion ?? 0})`
                  : 'Cấu hình quyền lợi và mức giá gói dịch vụ credit trên sàn'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Tên Gói Dịch Vụ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ví dụ: Gói Tiết Kiệm, Pro Combo, 10 Tin Đăng..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-bold transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mô Tả Gói (Hiển thị người mua)</label>
            <input
              type="text"
              maxLength={255}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ví dụ: 5 tin đăng, 25 lượt Chat AI, 5 lượt định giá..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Giá Bán Thực Tế (VNĐ) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              min={1000}
              step="any"
              value={formData.price === 0 ? '' : formData.price}
              onChange={(e) => {
                const val = e.target.value;
                setFormData(prev => ({ ...prev, price: val === '' ? 0 : Number(val) }));
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono font-extrabold text-[#c34c36] text-sm transition"
            />
            <span className="text-[10px] text-slate-400 mt-1 block font-medium">
              Số tiền người bán thực trả: {formatVND(Number(formData.price) || 0)}
            </span>
          </div>

          {/* Trạng thái mở bán Toggle */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="block text-slate-800 font-bold text-xs">Mở bán gói ngay lập tức</span>
              <span className="text-[10px] text-slate-500">Người bán có thể nhìn thấy và mua gói này khi đang mở bán</span>
            </div>
            <input
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* Quyền lợi Credits */}
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quyền Lợi Lượt Dịch Vụ Cấp Cho Người Bán</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <label className="block text-[11px] text-slate-600 mb-1 font-bold">Đăng Tin</label>
                <input
                  type="number"
                  min={0}
                  value={formData.postCredits}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, postCredits: val === '' ? 0 : Math.max(0, parseInt(val) || 0) }));
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-mono font-bold text-xs outline-none focus:border-emerald-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">tin bài</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <label className="block text-[11px] text-slate-600 mb-1 font-bold">Chat AI</label>
                <input
                  type="number"
                  min={0}
                  value={formData.chatCredits}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, chatCredits: val === '' ? 0 : Math.max(0, parseInt(val) || 0) }));
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-mono font-bold text-xs outline-none focus:border-emerald-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">lượt chat</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <label className="block text-[11px] text-slate-600 mb-1 font-bold">Định Giá AI</label>
                <input
                  type="number"
                  min={0}
                  value={formData.valuationCredits}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, valuationCredits: val === '' ? 0 : Math.max(0, parseInt(val) || 0) }));
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-mono font-bold text-xs outline-none focus:border-emerald-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">lượt định giá</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-200 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingPackage ? 'Lưu Thay Đổi' : 'Tạo Gói Dịch Vụ'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

