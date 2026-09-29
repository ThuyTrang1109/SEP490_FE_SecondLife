import React, { useState, useEffect } from 'react';
import { Sparkles, Camera, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, ArrowLeft, UploadCloud, Info, RefreshCw, Loader2, Plus, Bot } from 'lucide-react';
import { ItemCategory, ConditionGrade, Listing, PhotoChecklist, Language, CategoryBackend, ItemBackend } from '../types';
import { translations, formatVND } from '../utils/translations';
import { mediaService, postService, categoryService, itemService } from '../services';
import { AiListingAssistant } from '../components/listing/AiListingAssistant';

interface CreateListingViewProps {
  onListingCreated: (newListing: Listing) => void;
  lang: Language;
  onCancel: () => void;
}

export const CreateListingView: React.FC<CreateListingViewProps> = ({
  onListingCreated,
  lang,
  onCancel
}) => {
  const t = translations[lang];

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Backend Category & Item
  const [backendCategories, setBackendCategories] = useState<CategoryBackend[]>([]);
  const [backendItems, setBackendItems] = useState<ItemBackend[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Helper validation: strictly require real backend IDs (not dummy UUIDs with all 0s, not Vietnamese text)
  const isValidBackendId = (id?: string | null): boolean => {
    if (!id || typeof id !== 'string') return false;
    const trimmed = id.trim();
    if (trimmed.length < 3) return false;
    if (/^0{8}-?0{4}-?0{4}-?0{4}-?0{11}[01]?$/i.test(trimmed)) return false;
    if (/[ àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(trimmed)) return false;
    return true;
  };

  const isRealCategoryId = Boolean(
    selectedCategoryId &&
    isValidBackendId(selectedCategoryId) &&
    backendCategories.some(c => c.id === selectedCategoryId)
  );

  const isRealItemId = Boolean(
    selectedItemId &&
    isValidBackendId(selectedItemId) &&
    backendItems.some(i => i.id === selectedItemId)
  );

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Tủ lạnh & Tủ đông');
  const [brand, setBrand] = useState('Hitachi');
  const [model, setModel] = useState('');
  const [purchaseYear, setPurchaseYear] = useState<number>(2024);
  const [originalPriceVnd, setOriginalPriceVnd] = useState<number>(29990000);
  const [declaredCondition, setDeclaredCondition] = useState<ConditionGrade>('Like New');
  const [declaredConditionText, setDeclaredConditionText] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAccessories] = useState<string[]>(['Sách HDSD', 'Khay đá & Khay trứng zin', 'Phiếu bảo hành hãng']);

  const isStep1Valid = Boolean(
    isRealCategoryId &&
    isRealItemId &&
    title.trim() &&
    brand.trim()
  );

  // Primary image base64 & AI Session / Post states
  const [primaryBase64, setPrimaryBase64] = useState<string>('');
  const [postId, setPostId] = useState<string | null>(null);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [aiInitialMessage, setAiInitialMessage] = useState<string>('');
  const [isInitializingPost, setIsInitializingPost] = useState(false);

  const [photos, setPhotos] = useState<PhotoChecklist>({
    front: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
    back: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80',
    screenOrDetails: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=1000&q=80',
    accessoriesOrBox: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
    serialOrReceipt: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80'
  });
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  // Fetch backend categories
  useEffect(() => {
    setIsLoadingCategories(true);
    categoryService.getCategories()
      .then((catList) => {
        if (Array.isArray(catList) && catList.length > 0) {
          setBackendCategories(catList);
          setSelectedCategoryId(catList[0].id);
          setCategory(catList[0].name as any);
        } else {
          setBackendCategories([]);
          setSelectedCategoryId('');
        }
      })
      .catch((err) => {
        console.error('Lỗi tải danh mục từ backend:', err);
        setBackendCategories([]);
        setSelectedCategoryId('');
      })
      .finally(() => setIsLoadingCategories(false));
  }, []);

  // Fetch backend items when category changes
  useEffect(() => {
    if (selectedCategoryId && isValidBackendId(selectedCategoryId)) {
      setIsLoadingItems(true);
      itemService.getItemsByCategory(selectedCategoryId)
        .then((itemList) => {
          if (Array.isArray(itemList) && itemList.length > 0) {
            setBackendItems(itemList);
            setSelectedItemId(itemList[0].id);
          } else {
            setBackendItems([]);
            setSelectedItemId('');
          }
        })
        .catch((err) => {
          console.error('Lỗi tải vật phẩm theo danh mục:', err);
          setBackendItems([]);
          setSelectedItemId('');
        })
        .finally(() => setIsLoadingItems(false));
    } else {
      setBackendItems([]);
      setSelectedItemId('');
    }
  }, [selectedCategoryId]);

  const handlePhotoUpload = async (key: keyof PhotoChecklist, file: File) => {
    try {
      setUploadingSlot(key);
      const res = await mediaService.uploadImage(file, 'product-listings');
      setPhotos(prev => ({ ...prev, [key]: res.url }));
      if (key === 'front') {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') setPrimaryBase64(reader.result);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      alert('Tải ảnh sản phẩm thất bại: ' + (err.message || 'Lỗi kết nối server'));
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleMultiplePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    try {
      setUploadingSlot('batch');
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPrimaryBase64(reader.result);
        }
      };
      reader.readAsDataURL(files[0]);

      // Call batch upload endpoint
      const uploadedList = await mediaService.uploadMultipleImages(files, 'product-listings');
      if (uploadedList && uploadedList.length > 0) {
        setPhotos(prev => ({
          ...prev,
          front: uploadedList[0]?.url || prev.front,
          back: uploadedList[1]?.url || prev.back,
          screenOrDetails: uploadedList[2]?.url || prev.screenOrDetails,
          accessoriesOrBox: uploadedList[3]?.url || prev.accessoriesOrBox,
          serialOrReceipt: uploadedList[4]?.url || prev.serialOrReceipt,
        }));
      }
    } catch (err: any) {
      alert('Tải nhiều ảnh thất bại: ' + (err.message || 'Lỗi server'));
    } finally {
      setUploadingSlot(null);
    }
  };

  const getEnsureBase64 = async (): Promise<string> => {
    if (primaryBase64) return primaryBase64;
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiEstimation, setAiEstimation] = useState<{
    minVnd: number;
    maxVnd: number;
    suggestedVnd: number;
    quickSaleVnd: number;
    confidence: number;
    daysToSell: number;
    keyFactors: string[];
  } | null>(null);

  const [fraudWarning, setFraudWarning] = useState<string | null>(null);
  const [finalPriceVnd, setFinalPriceVnd] = useState<number>(18500000);

  const handleAutofillDemo = () => {
    setTitle('Tủ Lạnh Hitachi Inverter 540L 4 Cửa R-FW690PGV7X Mặt Kính Đen');
    setBrand('Hitachi');
    setModel('R-FW690PGV7X');
    setPurchaseYear(2024);
    setOriginalPriceVnd(29990000);
    setDeclaredCondition('Like New');
    setDeclaredConditionText('Tủ lạnh dùng 10 tháng giữ gìn cẩn thận, mặt kính bóng đẹp không vết xước. Máy nén êm ru, làm đá tự động cực nhanh.');
    setDescription('Gia đình chuyển nhà cần nhượng lại tủ lạnh Hitachi 540L 4 cửa cao cấp. Đầy đủ hóa đơn mua hàng tại Điện Máy Xanh, còn bảo hành máy nén 8 năm.');
    setFinalPriceVnd(18500000);

    if (backendCategories.length > 0) {
      setSelectedCategoryId(backendCategories[0].id);
      setCategory(backendCategories[0].name as any);
      if (backendItems.length > 0) {
        setSelectedItemId(backendItems[0].id);
      }
    }
  };

  const runAiValuation = async () => {
    setIsAnalyzing(true);
    setFraudWarning(null);

    try {
      const res = await fetch('/api/ai/estimate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          brand,
          model,
          purchaseYear,
          declaredCondition,
          accessories: selectedAccessories,
          description,
          originalPriceVnd
        })
      });

      const data = await res.json();
      if (data.success && data.data) {
        const est = data.data;
        setAiEstimation({
          minVnd: est.fairPriceRange.minVnd,
          maxVnd: est.fairPriceRange.maxVnd,
          suggestedVnd: est.suggestedListingPriceVnd,
          quickSaleVnd: est.quickSalePriceVnd,
          confidence: est.confidenceScore || 95,
          daysToSell: est.expectedDaysToSell?.fairPrice || 7,
          keyFactors: est.keyValuationFactors || [
            'Khấu hao chu kỳ công nghệ theo niên hạn',
            'Tình trạng ngoại quan khai báo đạt chuẩn Grade A'
          ]
        });
        setFinalPriceVnd(est.suggestedListingPriceVnd);
      }
    } catch {
      setAiEstimation({
        minVnd: 19500000,
        maxVnd: 21800000,
        suggestedVnd: 20800000,
        quickSaleVnd: 19000000,
        confidence: 94,
        daysToSell: 5,
        keyFactors: [
          'Dữ liệu đối chiếu 142 giao dịch tương tự tại TP.HCM & Hà Nội',
          'Tình trạng linh kiện và phụ kiện đầy đủ giúp bán nhanh hơn 35%'
        ]
      });
      setFinalPriceVnd(20800000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePriceChange = (val: number) => {
    setFinalPriceVnd(val);
    if (aiEstimation) {
      if (val < aiEstimation.minVnd * 0.6) {
        setFraudWarning('Cảnh báo giá bất thường: Mức giá quá thấp so với thị trường có thể bị hệ thống AI nghi ngờ là hàng giả hoặc lừa đảo.');
      } else if (val > aiEstimation.maxVnd * 1.5) {
        setFraudWarning('Lưu ý: Mức giá cao hơn 50% so với thị trường sẽ khiến thời gian bán kéo dài (> 30 ngày).');
      } else {
        setFraudWarning(null);
      }
    }
  };

  const handleInitPostAndChat = async () => {
    if (!isRealCategoryId || !isRealItemId) {
      alert(
        lang === 'vi'
          ? 'Danh mục hoặc Vật phẩm chưa phải ID hợp lệ từ hệ thống Backend. Vui lòng quay lại Bước 1 kiểm tra.'
          : 'Category or Item is not a valid ID from the backend. Please check Step 1.'
      );
      return;
    }

    setIsInitializingPost(true);
    try {
      const base64Image = await getEnsureBase64();

      const initRes = await postService.initPost({
        categoryId: selectedCategoryId,
        itemId: selectedItemId,
        base64Image,
      });

      if (initRes && initRes.postId && initRes.sessionId) {
        setPostId(initRes.postId);
        setAiSessionId(initRes.sessionId);
        setAiInitialMessage(initRes.aiInitialMessage || '');
        setCurrentStep(4);
      } else {
        throw new Error('Hệ thống không trả về postId hoặc sessionId');
      }
    } catch (err: any) {
      alert('Khởi tạo bài đăng thất bại: ' + (err?.message || 'Lỗi kết nối server'));
    } finally {
      setIsInitializingPost(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 text-[#24263e]">
      {/* Title & Quick demo helper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] border border-gray-200 text-[#24263e] text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#24263e]" />
            <span>AI Price Estimation & Verification Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#24263e] mt-2">
            {t.createListingTitle}
          </h1>
          <p className="text-xs sm:text-sm text-[#24263e]/70">
            {t.createListingSubtitle}
          </p>
        </div>

        <button
          onClick={handleAutofillDemo}
          className="self-start sm:self-auto px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#faf8f5] text-[#24263e] rounded-xl text-xs font-semibold border border-gray-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span>⚡ Điền nhanh mẫu thử nghiệm</span>
        </button>
      </div>

      {/* 4-Step Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div
          className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
            currentStep === 1
              ? 'bg-gradient-to-r from-[#c34c36] to-[#fce5da] border-[#c34c36] text-white font-semibold'
              : 'bg-[#FFFFFF] border-gray-200 text-[#24263e]/60'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold">1. {t.stepInfo}</div>
        </div>

        <div
          className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
            currentStep === 2
              ? 'bg-gradient-to-r from-[#c34c36] to-[#fce5da] border-[#c34c36] text-white font-semibold'
              : 'bg-[#FFFFFF] border-gray-200 text-[#24263e]/60'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold">2. {t.stepPhotos}</div>
        </div>

        <div
          className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
            currentStep === 3
              ? 'bg-gradient-to-r from-[#c34c36] to-[#fce5da] border-[#c34c36] text-white font-semibold'
              : 'bg-[#FFFFFF] border-gray-200 text-[#24263e]/60'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold">3. {t.stepValuation}</div>
        </div>

        <div
          className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
            currentStep === 4
              ? 'bg-gradient-to-r from-[#c34c36] to-[#fce5da] border-[#c34c36] text-white font-semibold'
              : 'bg-[#FFFFFF] border-gray-200 text-[#24263e]/60'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold">4. {lang === 'vi' ? 'Trợ lý AI' : 'AI Assistant'}</div>
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {currentStep === 1 && (
        <div className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-[#24263e] flex items-center gap-2">
            <span>Thông tin sản phẩm</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e] flex items-center justify-between">
                <span>{t.filterCategory} *</span>
                {isLoadingCategories && (
                  <span className="text-[10px] text-amber-600 flex items-center gap-1 font-normal">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang tải...
                  </span>
                )}
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCategoryId(val);
                  const matched = backendCategories.find(c => c.id === val);
                  if (matched) setCategory(matched.name as any);
                }}
                className={`w-full px-3.5 py-2.5 bg-[#faf8f5] border rounded-xl text-sm text-[#24263e] focus:outline-none transition ${
                  isRealCategoryId ? 'border-gray-200 focus:border-[#c34c36]' : 'border-amber-400 bg-amber-50/30'
                }`}
              >
                {backendCategories.length > 0 ? (
                  backendCategories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-[#FFFFFF] text-[#24263e]">
                      {cat.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled className="bg-[#FFFFFF] text-[#24263e]">
                    {isLoadingCategories
                      ? (lang === 'vi' ? '-- Đang tải danh mục từ backend... --' : '-- Loading categories... --')
                      : (lang === 'vi' ? '-- Không có danh mục khả dụng --' : '-- No categories available --')}
                  </option>
                )}
              </select>
              {!isRealCategoryId && !isLoadingCategories && (
                <p className="text-[10px] text-amber-600 font-medium">
                  {lang === 'vi' ? '⚠️ Yêu cầu chọn danh mục có ID thật từ hệ thống.' : '⚠️ Valid backend category ID required.'}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e] flex items-center justify-between">
                <span>{lang === 'vi' ? 'Vật phẩm chi tiết (Item)' : 'Item'} *</span>
                {isLoadingItems && (
                  <span className="text-[10px] text-amber-600 flex items-center gap-1 font-normal">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang tải...
                  </span>
                )}
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-[#faf8f5] border rounded-xl text-sm text-[#24263e] focus:outline-none transition ${
                  isRealItemId ? 'border-gray-200 focus:border-[#c34c36]' : 'border-amber-400 bg-amber-50/30'
                }`}
              >
                {backendItems.length > 0 ? (
                  backendItems.map((itm) => (
                    <option key={itm.id} value={itm.id} className="bg-[#FFFFFF] text-[#24263e]">
                      {itm.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled className="bg-[#FFFFFF] text-[#24263e]">
                    {isLoadingItems
                      ? (lang === 'vi' ? '-- Đang tải vật phẩm... --' : '-- Loading items... --')
                      : (lang === 'vi' ? '-- Chọn danh mục để tải vật phẩm --' : '-- Select category first --')}
                  </option>
                )}
              </select>
              {!isRealItemId && !isLoadingItems && (
                <p className="text-[10px] text-amber-600 font-medium">
                  {lang === 'vi' ? '⚠️ Yêu cầu chọn vật phẩm có ID thật từ hệ thống.' : '⚠️ Valid backend item ID required.'}
                </p>
              )}
            </div>

            {(!isRealCategoryId || !isRealItemId) && (
              <div className="sm:col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {isLoadingCategories || isLoadingItems
                    ? (lang === 'vi' ? 'Đang tải dữ liệu Danh mục & Vật phẩm từ máy chủ backend...' : 'Loading categories and items from backend...')
                    : (lang === 'vi'
                        ? 'Chưa chọn được Danh mục hoặc Vật phẩm có ID thật từ Backend. Nút "Tiếp tục" sẽ được mở khi có đủ ID hệ thống.'
                        : 'Please select a valid Category and Item with real backend IDs to proceed.')}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e]">{t.itemBrand} *</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="VD: Hitachi, Toshiba, LG, Panasonic..."
                className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-sm text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e]">{t.itemTitle} *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Tủ Lạnh Hitachi Inverter 540L 4 Cửa R-FW690PGV7X"
                className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-sm text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e]">{t.purchaseYear} *</label>
              <input
                type="number"
                value={purchaseYear}
                onChange={(e) => setPurchaseYear(Number(e.target.value))}
                min={2018}
                max={2026}
                className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-sm text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e]">{t.originalPrice}</label>
              <input
                type="number"
                value={originalPriceVnd}
                onChange={(e) => setOriginalPriceVnd(Number(e.target.value))}
                step={500000}
                className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-sm text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e]">{t.declaredCondition} *</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    grade: 'Like New',
                    title: lang === 'vi' ? 'Như mới (99%)' : 'Like New (99%)',
                    desc: lang === 'vi' ? 'Không xước, máy nén êm, đủ phụ kiện' : 'No scratches, silent compressor, full accessories'
                  },
                  {
                    grade: 'Good',
                    title: lang === 'vi' ? 'Tốt (95%)' : 'Good (95%)',
                    desc: lang === 'vi' ? 'Xước dăm rất nhẹ, máy zin' : 'Minor micro-scratches, original parts'
                  },
                  {
                    grade: 'Fair',
                    title: lang === 'vi' ? 'Khá (90%)' : 'Fair (90%)',
                    desc: lang === 'vi' ? 'Có cấn viền hoặc trầy xước' : 'Visible scuffs or cosmetic wear'
                  }
                ].map((item) => (
                  <button
                    key={item.grade}
                    type="button"
                    onClick={() => setDeclaredCondition(item.grade as ConditionGrade)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      declaredCondition === item.grade
                        ? 'border-[#c34c36] bg-[#c34c36]/10 text-[#24263e] ring-1 ring-[#c34c36]'
                        : 'border-gray-200 bg-[#faf8f5] text-[#24263e]/70 hover:bg-[#FFFFFF]'
                    }`}
                  >
                    <div className="font-bold text-xs">{item.title}</div>
                    <div className="text-[10px] text-[#24263e]/60 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e]">
                {lang === 'vi' ? 'Tóm tắt tình trạng ngoại quan' : 'Condition Summary'}
              </label>
              <input
                type="text"
                value={declaredConditionText}
                onChange={(e) => setDeclaredConditionText(e.target.value)}
                placeholder={lang === 'vi' ? 'VD: Dán bảo vệ từ đầu, không trầy xước, chạy êm...' : 'E.g.: Protected from day 1, no scratches, runs smoothly...'}
                className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-sm text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#24263e]">{t.description}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={lang === 'vi' ? 'Mô tả nguồn gốc mua hàng, lý do bán, các linh kiện kèm theo...' : 'Describe origin, reason for sale, included accessories...'}
                className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl text-sm text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-[#24263e] hover:bg-[#faf8f5] text-sm font-semibold cursor-pointer"
            >
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </button>

            <button
              onClick={() => {
                if (!isRealCategoryId || !isRealItemId) {
                  alert(lang === 'vi' ? 'Vui lòng chọn danh mục và vật phẩm hợp lệ từ hệ thống.' : 'Please select valid category and item IDs.');
                  return;
                }
                setCurrentStep(2);
              }}
              disabled={!isStep1Valid || isLoadingCategories || isLoadingItems}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 transition ${
                isStep1Valid && !isLoadingCategories && !isLoadingItems
                  ? 'bg-gradient-to-r from-[#c34c36] to-[#fce5da] hover:opacity-90 text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
              }`}
              title={!isStep1Valid ? (lang === 'vi' ? 'Cần chọn Danh mục & Vật phẩm có ID thật từ Backend' : 'Valid category and item required') : ''}
            >
              <span>{lang === 'vi' ? 'Tiếp tục: Tải bộ ảnh 5 góc' : 'Next: Upload 5 Photos'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 5-Photo Checklist Upload */}
      {currentStep === 2 && (
        <div className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#24263e] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#24263e]" />
              <span>{t.photoChecklistTitle}</span>
            </h2>
            <p className="text-xs text-[#24263e]/70 mt-1">
              {lang === 'vi'
                ? 'SecondLife yêu cầu chuẩn hóa 5 góc chụp để AI quét vết xước, nhận diện linh kiện và làm bằng chứng pháp lý trong Escrow.'
                : 'SecondLife mandates 5 standard camera angles for AI defect scanning, parts verification, and Escrow dispute protection.'}
            </p>
          </div>

          {/* Multiple Image Upload Box (Requirement 8) */}
          <div className="p-4 rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#c34c36] bg-slate-50 transition flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#c34c36]/20 to-[#fce5da]/20 text-[#24263e] flex items-center justify-center shrink-0">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {lang === 'vi' ? 'Tải lên nhiều ảnh cùng lúc' : 'Upload multiple photos at once'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {lang === 'vi'
                    ? 'Chọn đồng thời nhiều ảnh để tải lên nhanh bằng hệ thống Media Cloudinary (tự động phân bổ vào các góc)'
                    : 'Select multiple photos to upload at once via Media Cloudinary (auto-assigned to angle slots)'}
                </div>
              </div>
            </div>

            <label className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white text-xs font-bold shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1.5 shrink-0">
              {uploadingSlot === 'batch' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'vi' ? 'Đang tải nhiều ảnh...' : 'Uploading batch...'}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Chọn nhiều ảnh' : 'Select Multiple Photos'}</span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                disabled={uploadingSlot !== null}
                onChange={handleMultiplePhotosUpload}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                key: 'front' as const,
                label: t.photoFront,
                desc: lang === 'vi' ? 'Mặt trước hiển thị tổng quan' : 'Front overall display'
              },
              {
                key: 'back' as const,
                label: t.photoBack,
                desc: lang === 'vi' ? 'Mặt sau và 4 góc viền máy' : 'Back side & 4 chassis corners'
              },
              {
                key: 'screenOrDetails' as const,
                label: t.photoScreenOrDetails,
                desc: lang === 'vi' ? 'Chụp cận cảnh vết xước (nếu có)' : 'Close-up of blemishes/screen'
              },
              {
                key: 'accessoriesOrBox' as const,
                label: t.photoAccessories,
                desc: lang === 'vi' ? 'Hộp máy, cáp sạc, hóa đơn' : 'Box, cords, warranty bill'
              },
              {
                key: 'serialOrReceipt' as const,
                label: t.photoSerialOrReceipt,
                desc: lang === 'vi' ? 'Ảnh chụp tem Serial / Mã máy' : 'Serial number / model sticker'
              }
            ].map((slot) => (
              <div
                key={slot.key}
                className="border border-gray-200 rounded-2xl p-3 bg-[#faf8f5] space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-[#24263e]">{slot.label}</div>
                  <div className="text-[11px] text-[#24263e]/60">{slot.desc}</div>
                </div>

                <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-[#FFFFFF] border border-gray-200">
                  <img
                    src={photos[slot.key]}
                    alt={slot.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-[#c34c36] to-[#fce5da] text-white rounded-full p-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                <label className="w-full py-1.5 px-2 bg-[#FFFFFF] hover:bg-[#faf8f5] rounded-lg text-xs font-medium text-[#24263e] border border-gray-200 flex items-center justify-center gap-1.5 cursor-pointer transition">
                  {uploadingSlot === slot.key ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-[#24263e] animate-spin" />
                      <span>{lang === 'vi' ? 'Đang tải ảnh...' : 'Uploading...'}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5 text-gray-400" />
                      <span>{lang === 'vi' ? 'Đổi ảnh góc này' : 'Replace Photo'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoUpload(slot.key, e.target.files[0])}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-[#24263e] hover:bg-[#faf8f5] text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Quay lại' : 'Back'}</span>
            </button>

            <button
              onClick={() => {
                setCurrentStep(3);
                runAiValuation();
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-[#c34c36] to-[#fce5da] hover:opacity-90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span>{t.runAiEstimation}</span>
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: AI Price Estimation & Final Publishing */}
      {currentStep === 3 && (
        <div className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#24263e] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#24263e]" />
              <span>{t.aiValuationResult}</span>
            </h2>

            <button
              onClick={runAiValuation}
              disabled={isAnalyzing}
              className="px-3 py-1.5 bg-[#faf8f5] hover:bg-gray-200 text-[#24263e] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-gray-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#24263e] ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{lang === 'vi' ? 'Tính toán lại' : 'Recalculate'}</span>
            </button>
          </div>

          {isAnalyzing ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#c34c36] text-[#24263e] flex items-center justify-center mx-auto animate-pulse">
                <Sparkles className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="font-bold text-[#24263e]">{t.analyzingMarket}</h3>
              <p className="text-xs text-[#24263e]/70 max-w-md mx-auto">
                {lang === 'vi'
                  ? `Hệ thống đang đối chiếu dữ liệu khấu hao theo năm sản xuất (${purchaseYear}), mức độ hao mòn ngoại quan (${declaredCondition}) và biên độ giao dịch thực tế...`
                  : `Matching tech depreciation for purchase year (${purchaseYear}), declared cosmetic grade (${declaredCondition}) with active liquidity benchmarks...`}
              </p>
            </div>
          ) : aiEstimation ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#faf8f5] border border-gray-200 rounded-2xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-[#24263e]/70">{t.suggestedPrice}</div>
                  <div className="text-2xl font-black text-[#24263e]">
                    {formatVND(aiEstimation.suggestedVnd)}
                  </div>
                  <div className="text-[11px] text-[#24263e]/60">
                    {lang === 'vi' ? 'Dự kiến bán trong 7 ngày' : 'Est. 7 days to sell'}
                  </div>
                </div>

                <div className="bg-[#faf8f5] border border-gray-200 rounded-2xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-[#24263e]/70">{t.fairRange}</div>
                  <div className="text-lg font-extrabold text-[#24263e]">
                    {formatVND(aiEstimation.minVnd)} - {formatVND(aiEstimation.maxVnd)}
                  </div>
                  <div className="text-[11px] text-[#24263e]/60">
                    {lang === 'vi' ? 'Biên độ chuẩn cho máy Grade A' : 'Standard range for Grade A'}
                  </div>
                </div>

                <div className="bg-[#faf8f5] border border-gray-200 rounded-2xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-[#24263e]/70">{t.quickSalePrice}</div>
                  <div className="text-2xl font-black text-[#24263e]">
                    {formatVND(aiEstimation.quickSaleVnd)}
                  </div>
                  <div className="text-[11px] text-[#24263e]/60">
                    {lang === 'vi' ? 'Khớp lệnh nhanh trong 3 ngày' : 'Quick match in 3 days'}
                  </div>
                </div>
              </div>

              <div className="bg-[#faf8f5] rounded-2xl p-4 border border-gray-200 space-y-2">
                <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider">
                  {lang === 'vi' ? 'Các yếu tố tác động tới định giá của AI:' : 'AI Valuation Drivers:'}
                </div>
                <ul className="space-y-1 text-xs text-[#24263e]/70">
                  {aiEstimation.keyFactors.map((factor, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#24263e] shrink-0" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#faf8f5] p-5 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-[#24263e]">
                    {t.finalListingPrice}
                  </label>
                  <span className="text-xl font-bold text-[#24263e]">
                    {formatVND(finalPriceVnd)}
                  </span>
                </div>

                <input
                  type="range"
                  min={Math.round(aiEstimation.minVnd * 0.7)}
                  max={Math.round(aiEstimation.maxVnd * 1.3)}
                  step={100000}
                  value={finalPriceVnd}
                  onChange={(e) => handlePriceChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[#c34c36]"
                />

                <div className="flex justify-between text-[11px] text-[#24263e]/60">
                  <span>{lang === 'vi' ? 'Giá bán gấp:' : 'Quick sale:'} {formatVND(aiEstimation.quickSaleVnd)}</span>
                  <span>{lang === 'vi' ? 'Đề xuất:' : 'Suggested:'} {formatVND(aiEstimation.suggestedVnd)}</span>
                  <span>{lang === 'vi' ? 'Giá cao:' : 'Higher limit:'} {formatVND(aiEstimation.maxVnd * 1.1)}</span>
                </div>

                {fraudWarning && (
                  <div className="p-3 rounded-xl bg-[#c34c36]/20 border border-[#c34c36] text-[#24263e] text-xs flex items-start gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-[#24263e] shrink-0 mt-0.5" />
                    <span>{fraudWarning}</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-[#24263e]/70 bg-[#faf8f5] p-3 rounded-xl border border-gray-200 flex items-start gap-2 font-medium">
                <Info className="w-4 h-4 text-[#24263e] shrink-0 mt-0.5" />
                <span>{t.disclaimer}</span>
              </div>
            </div>
          ) : null}

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-[#24263e] hover:bg-[#faf8f5] text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Quay lại chỉnh sửa' : 'Back to Edit'}</span>
            </button>

            <button
              onClick={handleInitPostAndChat}
              disabled={isInitializingPost || !isRealCategoryId || !isRealItemId}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 transition ${
                !isInitializingPost && isRealCategoryId && isRealItemId
                  ? 'bg-[#24263e] hover:bg-black text-white cursor-pointer font-black'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
              }`}
              title={(!isRealCategoryId || !isRealItemId) ? (lang === 'vi' ? 'Danh mục hoặc Vật phẩm chưa có ID thật từ Backend' : 'Invalid category or item ID') : ''}
            >
              {isInitializingPost ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'vi' ? 'Đang khởi tạo bài đăng...' : 'Initializing...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Tiếp tục: AI Trợ lý tạo mô tả' : 'Next: AI Listing Assistant'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: AI Listing Assistant */}
      {currentStep === 4 && postId && aiSessionId && (
        <AiListingAssistant
          sessionId={aiSessionId}
          postId={postId}
          aiInitialMessage={aiInitialMessage}
          lang={lang}
          onCancel={() => setCurrentStep(3)}
          onPostSubmitted={(submittedPostId) => {
            const newListing: Listing = {
              id: submittedPostId,
              title: title || `${brand} ${model}`,
              category,
              brand,
              model: model || 'Standard',
              purchaseYear,
              priceVnd: finalPriceVnd,
              originalPriceVnd,
              conditionGrade: declaredCondition,
              declaredConditionText: declaredConditionText || 'Tình trạng thực tế đúng như mô tả và ảnh chụp.',
              description: description || 'Sản phẩm đã qua sử dụng, cam kết nguyên bản.',
              location: 'Quận 1, TP. Hồ Chí Minh',
              sellerId: 'user-current',
              sellerName: 'Người Bán SecondLife',
              sellerRating: 5.0,
              sellerCompletedOrders: 1,
              sellerVerified: true,
              status: 'active',
              createdAt: new Date().toISOString(),
              isInspectionGuaranteed: true,
              requiresInspection: true,
              photos,
              photoGallery: [photos.front, photos.back, photos.screenOrDetails, photos.accessoriesOrBox],
              aiPriceEstimation: aiEstimation ? {
                minVnd: aiEstimation.minVnd,
                maxVnd: aiEstimation.maxVnd,
                suggestedVnd: aiEstimation.suggestedVnd,
                quickSaleVnd: aiEstimation.quickSaleVnd,
                confidence: aiEstimation.confidence,
                daysToSell: aiEstimation.daysToSell
              } : undefined
            };
            onListingCreated(newListing);
          }}
        />
      )}
    </div>
  );
};
