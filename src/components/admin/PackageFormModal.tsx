import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, Tag, Loader2, Check } from 'lucide-react';
import { TopupPackage } from '../../types';
import type { CreditPricingRuleResponseDto } from '../../services/adminCreditPricingService';
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
  creditPrices: CreditPricingRuleResponseDto[];
  onSave: (data: PackageFormData) => Promise<void>;
}

const CREDIT_TYPE_LABELS: Record<string, string> = {
  LISTING: 'Đăng tin',
  AI_CHAT: 'Chat AI',
  VALUATION: 'Định giá AI',
};

type CreditField = 'postCredits' | 'chatCredits' | 'valuationCredits';

interface PackageFormState {
  name: string;
  description: string;
  postCredits: string;
  chatCredits: string;
  valuationCredits: string;
  active: boolean;
}

// Kiểm tra số lượng lượt credit có hợp lệ (chỉ chấp nhận chuỗi số nguyên không âm hoặc rỗng khi đang gõ)
const isCreditValid = (val: string | number) => {
  const str = String(val ?? '').trim();
  if (str === '') return true;
  return /^\d+$/.test(str);
};

// Chuyển đổi an toàn sang số nguyên dương để tính giá và lưu dữ liệu
const getCreditNumber = (val: string | number) => {
  const str = String(val ?? '').trim();
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }
  return 0;
};

export const PackageFormModal: React.FC<PackageFormModalProps> = ({
  isOpen,
  onClose,
  editingPackage,
  creditPrices,
  onSave,
}) => {
  const [formData, setFormData] = useState<PackageFormState>({
    name: '',
    description: '',
    postCredits: '1',
    chatCredits: '0',
    valuationCredits: '0',
    active: true,
  });

  const [price, setPrice] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [pricingMode, setPricingMode] = useState<'price' | 'discount' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Helper tìm đơn giá VND đang hoạt động cho loại credit
  const getActiveCreditRule = (type: string) => {
    return creditPrices.find(
      (r) =>
        r.creditType === type &&
        r.active !== false &&
        (!r.currency || r.currency.toUpperCase() === 'VND') &&
        typeof r.unitPrice === 'number' &&
        r.unitPrice > 0
    );
  };

  // Danh sách các quyền lợi credit trong gói
  const creditItems = useMemo(
    () => [
      { type: 'LISTING', label: CREDIT_TYPE_LABELS.LISTING, quantity: getCreditNumber(formData.postCredits) },
      { type: 'AI_CHAT', label: CREDIT_TYPE_LABELS.AI_CHAT, quantity: getCreditNumber(formData.chatCredits) },
      { type: 'VALUATION', label: CREDIT_TYPE_LABELS.VALUATION, quantity: getCreditNumber(formData.valuationCredits) },
    ],
    [formData.postCredits, formData.chatCredits, formData.valuationCredits]
  );

  const activeCreditItems = creditItems.filter((item) => item.quantity > 0);
  const totalQuantity = activeCreditItems.reduce((sum, item) => sum + item.quantity, 0);

  // Trạng thái hợp lệ của từng ô số lượng credit
  const postCreditInvalid = !isCreditValid(formData.postCredits);
  const chatCreditInvalid = !isCreditValid(formData.chatCredits);
  const valuationCreditInvalid = !isCreditValid(formData.valuationCredits);

  // Tìm các loại credit có trong gói (quantity > 0) nhưng thiếu đơn giá hoạt động
  const missingPriceItems = activeCreditItems.filter((item) => !getActiveCreditRule(item.type));
  const hasMissingPrices = missingPriceItems.length > 0;

  // Tính giá mua lẻ bằng tổng số lượt của từng loại credit nhân với đơn giá VND đang hoạt động tương ứng
  const retailPrice: number | null = useMemo(() => {
    if (activeCreditItems.length === 0) return 0;
    if (hasMissingPrices) return null;
    return activeCreditItems.reduce((total, item) => {
      const rule = getActiveCreditRule(item.type)!;
      return total + item.quantity * rule.unitPrice;
    }, 0);
  }, [activeCreditItems, hasMissingPrices, creditPrices]);

  // Sync form state khi modal mở hoặc thay đổi gói cần sửa
  useEffect(() => {
    if (isOpen) {
      if (editingPackage) {
        const initPrice = editingPackage.price ?? editingPackage.priceVnd;
        const priceStr = typeof initPrice === 'number' && Number.isFinite(initPrice) ? String(initPrice) : '';
        setFormData({
          name: editingPackage.name || editingPackage.packageName || '',
          description: editingPackage.description || '',
          postCredits: String(editingPackage.postCredits ?? 0),
          chatCredits: String(editingPackage.chatCredits ?? 0),
          valuationCredits: String(editingPackage.valuationCredits ?? 0),
          active: editingPackage.active !== false,
        });
        if (priceStr.trim() !== '') {
          setPrice(priceStr);
          setDiscount('');
          setPricingMode('price');
        } else {
          setPrice('');
          setDiscount('');
          setPricingMode(null);
        }
      } else {
        setFormData({
          name: '',
          description: '',
          postCredits: '1',
          chatCredits: '0',
          valuationCredits: '0',
          active: true,
        });
        setPrice('');
        setDiscount('');
        setPricingMode(null);
      }
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, editingPackage]);

  // Tính giá bán khi người dùng nhập % giảm (ở chế độ discount)
  const calculatedPriceFromDiscount = useMemo(() => {
    if (pricingMode !== 'discount' || discount.trim() === '' || !retailPrice || retailPrice <= 0) return 0;
    const d = parseFloat(discount);
    if (isNaN(d)) return 0;
    return Math.round(retailPrice * (1 - d / 100) * 100) / 100;
  }, [pricingMode, discount, retailPrice]);

  // Tính % giảm khi người dùng nhập Giá bán thực tế (ở chế độ price)
  const calculatedDiscountFromPrice = useMemo(() => {
    if (pricingMode !== 'price' || price.trim() === '' || !retailPrice || retailPrice <= 0) return '';
    const p = parseFloat(price);
    if (isNaN(p)) return '';
    const rawDiscount = ((retailPrice - p) / retailPrice) * 100;
    return String(Math.round(rawDiscount * 100) / 100);
  }, [pricingMode, price, retailPrice]);

  // Giá bán áp dụng xem trước
  const displayPrice = useMemo(() => {
    if (pricingMode === 'price') {
      const p = parseFloat(price);
      return !isNaN(p) && p > 0 ? p : null;
    }
    if (pricingMode === 'discount') {
      return calculatedPriceFromDiscount > 0 ? calculatedPriceFromDiscount : null;
    }
    return null;
  }, [pricingMode, price, calculatedPriceFromDiscount]);

  // % giảm xem trước
  const displayDiscount = useMemo(() => {
    if (pricingMode === 'discount') {
      return discount.trim() !== '' ? discount : null;
    }
    if (pricingMode === 'price') {
      return calculatedDiscountFromPrice !== '' ? calculatedDiscountFromPrice : null;
    }
    return null;
  }, [pricingMode, discount, calculatedDiscountFromPrice]);

  // Xử lý thay đổi số lượng credit:
  // - Nếu người dùng nhập chữ tiếng Việt / ký tự không hợp lệ: không tự ý xóa mà hiển thị cảnh báo "Số lượng không hợp lệ"
  // - Nếu người dùng nhập số có số 0 ở đầu (ví dụ: "01", "001212"): tự động chuẩn hóa bỏ số 0 thừa thành "1", "1212"
  const handleCreditChange = (field: CreditField, rawVal: string) => {
    let cleanVal = rawVal;
    // Tự động bỏ số 0 thừa ở đầu nếu toàn bộ là chữ số (ví dụ: "01212" -> "1212", "00" -> "0")
    if (/^\d+$/.test(cleanVal) && cleanVal.length > 1 && cleanVal.startsWith('0')) {
      cleanVal = cleanVal.replace(/^0+/, '') || '0';
    }

    setFormData((prev) => ({
      ...prev,
      [field]: cleanVal,
    }));

    // Báo lỗi tức thì nếu chứa chữ cái, tiếng Việt hoặc ký tự không hợp lệ
    if (cleanVal.trim() !== '' && !/^\d+$/.test(cleanVal.trim())) {
      setError('Số lượng không hợp lệ: vui lòng chỉ nhập số nguyên không âm cho quyền lợi dịch vụ.');
    } else {
      setError((prevErr) =>
        prevErr && prevErr.includes('Số lượng không hợp lệ') ? null : prevErr
      );
    }
  };

  // Khi rời khỏi ô nhập credit:
  // - Nếu ô đang để trống thì đặt lại về '0'
  // - Nếu ô chứa chữ / tiếng Việt thì giữ nguyên để người dùng thấy lỗi và sửa
  const handleCreditBlur = (field: CreditField) => {
    const val = String(formData[field] ?? '').trim();
    if (val === '') {
      setFormData((prev) => ({ ...prev, [field]: '0' }));
    } else if (!/^\d+$/.test(val)) {
      setError('Số lượng không hợp lệ: vui lòng chỉ nhập số nguyên không âm cho quyền lợi dịch vụ.');
    }
  };

  // Chặn chữ cái cho ô nhập % giảm (chỉ cho phép số và 1 dấu chấm thập phân)
  const handleDiscountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      [
        'Backspace',
        'Delete',
        'Tab',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'Enter',
      ].includes(e.key)
    ) {
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    if (e.key === '.' && !discount.includes('.')) {
      return;
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // Người dùng nhập Giá bán thực tế -> Khóa ô % giảm
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
      val = val.replace(/^0+/, '') || '0';
      e.target.value = val;
    }
    setPrice(val);
    if (val.trim() === '') {
      setPricingMode(null);
    } else {
      setPricingMode('price');
    }
  };

  // Xóa giá bán -> Mở khóa cả hai ô
  const handleClearPrice = () => {
    setPrice('');
    setPricingMode(null);
  };

  // Người dùng nhập % giảm -> Khóa ô Giá bán thực tế
  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
      val = val.replace(/^0+/, '') || '0';
      e.target.value = val;
    }
    setDiscount(val);
    if (val.trim() === '') {
      setPricingMode(null);
    } else {
      setPricingMode('discount');
    }
  };

  // Xóa % giảm -> Mở khóa cả hai ô
  const handleClearDiscount = () => {
    setDiscount('');
    setPricingMode(null);
  };

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

    if (!isCreditValid(formData.postCredits) || !isCreditValid(formData.chatCredits) || !isCreditValid(formData.valuationCredits)) {
      setError('Số lượng không hợp lệ: vui lòng chỉ nhập số nguyên không âm cho quyền lợi dịch vụ.');
      return;
    }

    const posts = getCreditNumber(formData.postCredits);
    const chats = getCreditNumber(formData.chatCredits);
    const vals = getCreditNumber(formData.valuationCredits);
    if (posts < 0 || chats < 0 || vals < 0) {
      setError('Số lượng lượt dịch vụ phải là số nguyên không âm.');
      return;
    }
    if (posts + chats + vals <= 0) {
      setError('Gói phải chứa ít nhất 1 lượt dịch vụ (tổng lượt đăng tin, chat AI, định giá AI > 0).');
      return;
    }

    let finalPrice = 0;

    if (pricingMode === 'discount') {
      if (hasMissingPrices) {
        setError('Không thể lưu giá theo % giảm do thiếu đơn giá của loại credit có trong gói.');
        return;
      }
      if (discount.trim() === '') {
        setError('Vui lòng nhập % giảm mong muốn.');
        return;
      }
      const numDiscount = parseFloat(discount);
      if (isNaN(numDiscount) || numDiscount < 0 || numDiscount > 100) {
        setError('% giảm mong muốn phải từ 0% đến 100%.');
        return;
      }
      if (calculatedPriceFromDiscount < 1000) {
        setError('Giá bán sau khi giảm theo % tối thiểu là 1.000 VNĐ.');
        return;
      }
      finalPrice = calculatedPriceFromDiscount;
    } else if (pricingMode === 'price') {
      if (price.trim() === '') {
        setError('Vui lòng nhập giá bán thực tế (VNĐ).');
        return;
      }
      const numPrice = parseFloat(price);
      if (isNaN(numPrice) || !Number.isFinite(numPrice)) {
        setError('Giá bán thực tế phải là một số hợp lệ.');
        return;
      }
      if (numPrice < 1000) {
        setError('Giá bán cuối cùng của gói tối thiểu là 1.000 VNĐ.');
        return;
      }
      finalPrice = Math.round(numPrice * 100) / 100;
    } else {
      setError('Vui lòng nhập giá bán thực tế (VNĐ) hoặc % giảm mong muốn.');
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
        price: finalPrice,
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
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Ví dụ: 5 tin đăng, 25 lượt Chat AI, 5 lượt định giá..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition"
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
                  type="text"
                  inputMode="numeric"
                  value={formData.postCredits}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleCreditChange('postCredits', e.target.value)}
                  onBlur={() => handleCreditBlur('postCredits')}
                  className={`w-full px-2 py-1.5 rounded-lg border font-mono font-bold text-xs outline-none transition ${
                    postCreditInvalid
                      ? 'border-rose-400 bg-rose-50/60 text-rose-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-200'
                      : 'border-slate-300 bg-slate-50 text-slate-800 focus:border-emerald-500 focus:bg-white'
                  }`}
                />
                {postCreditInvalid ? (
                  <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">
                    Số lượng không hợp lệ
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">tin bài</span>
                )}
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <label className="block text-[11px] text-slate-600 mb-1 font-bold">Chat AI</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.chatCredits}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleCreditChange('chatCredits', e.target.value)}
                  onBlur={() => handleCreditBlur('chatCredits')}
                  className={`w-full px-2 py-1.5 rounded-lg border font-mono font-bold text-xs outline-none transition ${
                    chatCreditInvalid
                      ? 'border-rose-400 bg-rose-50/60 text-rose-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-200'
                      : 'border-slate-300 bg-slate-50 text-slate-800 focus:border-emerald-500 focus:bg-white'
                  }`}
                />
                {chatCreditInvalid ? (
                  <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">
                    Số lượng không hợp lệ
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">lượt chat</span>
                )}
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <label className="block text-[11px] text-slate-600 mb-1 font-bold">Định Giá AI</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.valuationCredits}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleCreditChange('valuationCredits', e.target.value)}
                  onBlur={() => handleCreditBlur('valuationCredits')}
                  className={`w-full px-2 py-1.5 rounded-lg border font-mono font-bold text-xs outline-none transition ${
                    valuationCreditInvalid
                      ? 'border-rose-400 bg-rose-50/60 text-rose-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-200'
                      : 'border-slate-300 bg-slate-50 text-slate-800 focus:border-emerald-500 focus:bg-white'
                  }`}
                />
                {valuationCreditInvalid ? (
                  <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">
                    Số lượng không hợp lệ
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">lượt định giá</span>
                )}
              </div>
            </div>
          </div>

          {/* Cấu Hình Giá Bán Loại Trừ & Khóa Tự Động */}
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cấu Hình Giá Bán Gói Dịch Vụ</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                (Khóa ô còn lại khi nhập)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Ô 1: Giá bán thực tế */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="package-price" className="text-slate-700 font-bold text-[11px] flex items-center gap-1">
                    <span>Giá bán thực tế (VNĐ)</span>
                    {pricingMode === 'discount' && (
                      <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        Đã khóa
                      </span>
                    )}
                  </label>
                  {pricingMode === 'price' && price.trim() !== '' && (
                    <button
                      type="button"
                      onClick={handleClearPrice}
                      className="text-[10px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      Xóa giá
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  id="package-price"
                  disabled={isSaving || pricingMode === 'discount'}
                  min={1000}
                  step="any"
                  value={pricingMode === 'discount' ? (calculatedPriceFromDiscount > 0 ? String(calculatedPriceFromDiscount) : '') : price}
                  onFocus={(e) => e.target.select()}
                  onChange={handlePriceChange}
                  placeholder={pricingMode === 'discount' ? 'Đã khóa (đang nhập %)' : 'Ví dụ: 80000'}
                  className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-mono font-extrabold text-sm transition ${
                    pricingMode === 'discount'
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-[#c34c36]'
                  }`}
                />
              </div>

              {/* Ô 2: % giảm mong muốn */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="package-discount" className="text-slate-700 font-bold text-[11px] flex items-center gap-1">
                    <span>% giảm mong muốn</span>
                    {pricingMode === 'price' && (
                      <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        Đã khóa
                      </span>
                    )}
                  </label>
                  {pricingMode === 'discount' && discount.trim() !== '' && (
                    <button
                      type="button"
                      onClick={handleClearDiscount}
                      className="text-[10px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      Xóa %
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="package-discount"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    disabled={isSaving || pricingMode === 'price' || hasMissingPrices}
                    value={pricingMode === 'price' ? (calculatedDiscountFromPrice !== '' ? calculatedDiscountFromPrice : '') : discount}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={handleDiscountKeyDown}
                    onChange={handleDiscountChange}
                    placeholder={hasMissingPrices ? 'Thiếu đơn giá' : pricingMode === 'price' ? 'Đã khóa (đang nhập giá)' : 'Ví dụ: 20'}
                    className={`w-full pl-3.5 pr-8 py-2.5 rounded-xl border outline-none font-mono text-sm transition ${
                      pricingMode === 'price' || hasMissingPrices
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-slate-800'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Hướng dẫn khóa và mở khóa ô */}
            {pricingMode === 'discount' && (
              <p className="text-[10px] text-slate-500 font-medium">
                ℹ️ Ô <strong>"Giá bán thực tế"</strong> đang bị khóa và tự động tính theo % giảm. Nhấn <button type="button" onClick={handleClearDiscount} className="text-rose-600 font-bold hover:underline inline">Xóa %</button> để chuyển sang nhập giá bán thực tế.
              </p>
            )}
            {pricingMode === 'price' && (
              <p className="text-[10px] text-slate-500 font-medium">
                ℹ️ Ô <strong>"% giảm mong muốn"</strong> đang bị khóa và tự động tính theo giá bán. Nhấn <button type="button" onClick={handleClearPrice} className="text-rose-600 font-bold hover:underline inline">Xóa giá</button> để chuyển sang nhập % giảm.
              </p>
            )}
            {!pricingMode && (
              <p className="text-[10px] text-slate-500 font-medium">
                💡 Khi nhập vào 1 ô, ô còn lại sẽ tự động khóa và hiển thị giá trị tính toán tương ứng. Xóa giá trị để mở khóa ô còn lại.
              </p>
            )}

            {/* Cảnh báo thiếu đơn giá hoạt động nếu có */}
            {hasMissingPrices && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-bold">Không thể chọn nhập theo % giảm:</span> Thiếu đơn giá VND đang hoạt động cho{' '}
                  {missingPriceItems.map((m) => `${m.label} (${m.type})`).join(', ')}. Bạn vẫn có thể nhập trực tiếp ô "Giá bán thực tế (VNĐ)".
                </div>
              </div>
            )}

            {/* Bảng xem trước: Giá mua lẻ & Giá bán dự kiến */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-semibold">Giá mua lẻ theo đơn giá (Retail Price):</span>
                <span className="font-bold text-slate-800 font-mono">
                  {retailPrice !== null && retailPrice > 0
                    ? formatVND(retailPrice)
                    : hasMissingPrices
                    ? 'Chưa xác định (thiếu đơn giá)'
                    : totalQuantity === 0
                    ? '0 VNĐ (chưa chọn quyền lợi)'
                    : '0 VNĐ'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-slate-100">
                <span className="text-slate-700 font-bold">
                  Giá bán áp dụng:
                </span>
                <div className="text-right">
                  <span className="font-black text-[#c34c36] text-sm font-mono">
                    {displayPrice !== null && displayPrice > 0
                      ? formatVND(displayPrice)
                      : 'Chưa nhập'}
                  </span>
                  {retailPrice !== null && retailPrice > 0 && displayPrice !== null && displayPrice > 0 && (
                    <span className="text-[10px] text-emerald-700 font-semibold ml-2">
                      {displayPrice < retailPrice ? (
                        <>(Tiết kiệm {formatVND(retailPrice - displayPrice)} · {displayDiscount ? `${displayDiscount}%` : ''})</>
                      ) : displayPrice === retailPrice ? (
                        <>(Đúng giá mua lẻ · 0%)</>
                      ) : null}
                    </span>
                  )}
                </div>
              </div>
            </div>
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
              onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
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
