import React, { useState } from 'react';
import { Sparkles, Camera, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, ArrowLeft, UploadCloud, Info, RefreshCw } from 'lucide-react';
import { ItemCategory, ConditionGrade, Listing, PhotoChecklist, Language } from '../types';
import { translations, formatVND } from '../utils/translations';

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

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

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

  const [photos] = useState<PhotoChecklist>({
    front: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
    back: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80',
    screenOrDetails: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=1000&q=80',
    accessoriesOrBox: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
    serialOrReceipt: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80'
  });

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
    setCategory('Tủ lạnh & Tủ đông');
    setBrand('Hitachi');
    setModel('R-FW690PGV7X');
    setPurchaseYear(2024);
    setOriginalPriceVnd(29990000);
    setDeclaredCondition('Like New');
    setDeclaredConditionText('Tủ lạnh dùng 10 tháng giữ gìn cẩn thận, mặt kính bóng đẹp không vết xước. Máy nén êm ru, làm đá tự động cực nhanh.');
    setDescription('Gia đình chuyển nhà cần nhượng lại tủ lạnh Hitachi 540L 4 cửa cao cấp. Đầy đủ hóa đơn mua hàng tại Điện Máy Xanh, còn bảo hành máy nén 8 năm.');
    setFinalPriceVnd(18500000);
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

  const handleSubmit = () => {
    const newListing: Listing = {
      id: `listing-${Date.now().toString().slice(-6)}`,
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
      sellerName: 'Nguyễn Minh Tuấn',
      sellerRating: 4.9,
      sellerCompletedOrders: 38,
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
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 text-[#0E121B]">
      {/* Title & Quick demo helper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] border border-gray-200 text-[#0E121B] text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#EC1577]" />
            <span>AI Price Estimation & Verification Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0E121B] mt-2">
            {t.createListingTitle}
          </h1>
          <p className="text-xs sm:text-sm text-[#0E121B]/70">
            {t.createListingSubtitle}
          </p>
        </div>

        <button
          onClick={handleAutofillDemo}
          className="self-start sm:self-auto px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F4F5F8] text-[#0E121B] rounded-xl text-xs font-semibold border border-gray-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span>⚡ Điền nhanh mẫu thử nghiệm</span>
        </button>
      </div>

      {/* 3-Step Progress Bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div
          className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
            currentStep === 1
              ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] border-[#EC1577] text-white font-semibold'
              : 'bg-[#FFFFFF] border-gray-200 text-[#0E121B]/60'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold">{t.stepInfo}</div>
        </div>

        <div
          className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
            currentStep === 2
              ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] border-[#EC1577] text-white font-semibold'
              : 'bg-[#FFFFFF] border-gray-200 text-[#0E121B]/60'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold">{t.stepPhotos}</div>
        </div>

        <div
          className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
            currentStep === 3
              ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] border-[#EC1577] text-white font-semibold'
              : 'bg-[#FFFFFF] border-gray-200 text-[#0E121B]/60'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold">{t.stepValuation}</div>
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {currentStep === 1 && (
        <div className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-[#0E121B] flex items-center gap-2">
            <span>Thông tin sản phẩm</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0E121B]">{t.filterCategory} *</label>
              <select
                value={category}
                onChange={(e: any) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B]"
              >
                <option value="Tủ lạnh & Tủ đông" className="bg-[#FFFFFF] text-[#0E121B]">Tủ lạnh & Tủ đông (Refrigerators)</option>
                <option value="Máy giặt & Máy sấy" className="bg-[#FFFFFF] text-[#0E121B]">Máy giặt & Máy sấy (Washing Machines)</option>
                <option value="Điều hòa & Máy lọc" className="bg-[#FFFFFF] text-[#0E121B]">Điều hòa & Máy lọc không khí</option>
                <option value="Robot & Máy hút bụi" className="bg-[#FFFFFF] text-[#0E121B]">Robot hút bụi & Máy hút bụi</option>
                <option value="Lò vi sóng & Lò nướng" className="bg-[#FFFFFF] text-[#0E121B]">Lò vi sóng & Lò nướng</option>
                <option value="Nồi cơm & Bếp từ" className="bg-[#FFFFFF] text-[#0E121B]">Nồi cơm điện & Bếp từ</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0E121B]">{t.itemBrand} *</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="VD: Hitachi, Toshiba, LG, Panasonic..."
                className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#0E121B]">{t.itemTitle} *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Tủ Lạnh Hitachi Inverter 540L 4 Cửa R-FW690PGV7X"
                className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0E121B]">{t.purchaseYear} *</label>
              <input
                type="number"
                value={purchaseYear}
                onChange={(e) => setPurchaseYear(Number(e.target.value))}
                min={2018}
                max={2026}
                className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0E121B]">{t.originalPrice}</label>
              <input
                type="number"
                value={originalPriceVnd}
                onChange={(e) => setOriginalPriceVnd(Number(e.target.value))}
                step={500000}
                className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#0E121B]">{t.declaredCondition} *</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { grade: 'Like New', title: 'Như mới (99%)', desc: 'Không xước, máy nén êm, đủ phụ kiện' },
                  { grade: 'Good', title: 'Tốt (95%)', desc: 'Xước dăm rất nhẹ, máy zin' },
                  { grade: 'Fair', title: 'Khá (90%)', desc: 'Có cấn viền hoặc trầy xước' }
                ].map((item) => (
                  <button
                    key={item.grade}
                    type="button"
                    onClick={() => setDeclaredCondition(item.grade as ConditionGrade)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      declaredCondition === item.grade
                        ? 'border-[#EC1577] bg-[#EC1577]/10 text-[#0E121B] ring-1 ring-[#EC1577]'
                        : 'border-gray-200 bg-[#F4F5F8] text-[#0E121B]/70 hover:bg-[#FFFFFF]'
                    }`}
                  >
                    <div className="font-bold text-xs">{item.title}</div>
                    <div className="text-[10px] text-[#0E121B]/60 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#0E121B]">Tóm tắt tình trạng ngoại quan</label>
              <input
                type="text"
                value={declaredConditionText}
                onChange={(e) => setDeclaredConditionText(e.target.value)}
                placeholder="VD: Dán bảo vệ từ đầu, không trầy xước, chạy êm..."
                className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#0E121B]">{t.description}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Mô tả nguồn gốc mua hàng, lý do bán, các linh kiện kèm theo..."
                className="w-full px-3.5 py-2.5 bg-[#F4F5F8] border border-gray-200 rounded-xl text-sm text-[#0E121B] focus:outline-none focus:border-[#0E121B]"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-[#0E121B] hover:bg-[#F4F5F8] text-sm font-semibold cursor-pointer"
            >
              Hủy
            </button>

            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span>Tiếp tục: Tải bộ ảnh 5 góc</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 5-Photo Checklist Upload */}
      {currentStep === 2 && (
        <div className="bg-[#FFFFFF] rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#0E121B] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#EC1577]" />
              <span>{t.photoChecklistTitle}</span>
            </h2>
            <p className="text-xs text-[#0E121B]/70 mt-1">
              SecondLife yêu cầu chuẩn hóa 5 góc chụp để AI quét vết xước, nhận diện linh kiện và làm bằng chứng pháp lý trong Escrow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: 'front' as const, label: t.photoFront, desc: 'Mặt trước hiển thị tổng quan' },
              { key: 'back' as const, label: t.photoBack, desc: 'Mặt sau và 4 góc viền máy' },
              { key: 'screenOrDetails' as const, label: t.photoScreenOrDetails, desc: 'Chụp cận cảnh vết xước (nếu có)' },
              { key: 'accessoriesOrBox' as const, label: t.photoAccessories, desc: 'Hộp máy, cáp sạc, hóa đơn' },
              { key: 'serialOrReceipt' as const, label: t.photoSerialOrReceipt, desc: 'Ảnh chụp tem Serial / Mã máy' }
            ].map((slot) => (
              <div
                key={slot.key}
                className="border border-gray-200 rounded-2xl p-3 bg-[#F4F5F8] space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-[#0E121B]">{slot.label}</div>
                  <div className="text-[11px] text-[#0E121B]/60">{slot.desc}</div>
                </div>

                <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-[#FFFFFF] border border-gray-200">
                  <img
                    src={photos[slot.key]}
                    alt={slot.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white rounded-full p-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full py-1.5 px-2 bg-[#FFFFFF] hover:bg-[#F4F5F8] rounded-lg text-xs font-medium text-[#0E121B] border border-gray-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-gray-400" />
                  <span>Đổi ảnh góc này</span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-[#0E121B] hover:bg-[#F4F5F8] text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>

            <button
              onClick={() => {
                setCurrentStep(3);
                runAiValuation();
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 cursor-pointer"
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
            <h2 className="text-lg font-bold text-[#0E121B] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#EC1577]" />
              <span>{t.aiValuationResult}</span>
            </h2>

            <button
              onClick={runAiValuation}
              disabled={isAnalyzing}
              className="px-3 py-1.5 bg-[#F4F5F8] hover:bg-gray-200 text-[#0E121B] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-gray-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#EC1577] ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>Tính toán lại</span>
            </button>
          </div>

          {isAnalyzing ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#0E121B] text-[#EC1577] flex items-center justify-center mx-auto animate-pulse">
                <Sparkles className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="font-bold text-[#0E121B]">{t.analyzingMarket}</h3>
              <p className="text-xs text-[#0E121B]/70 max-w-md mx-auto">
                Hệ thống đang đối chiếu dữ liệu khấu hao theo năm sản xuất ({purchaseYear}), mức độ hao mòn ngoại quan ({declaredCondition}) và biên độ giao dịch thực tế...
              </p>
            </div>
          ) : aiEstimation ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#F4F5F8] border border-gray-200 rounded-2xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-[#0E121B]/70">{t.suggestedPrice}</div>
                  <div className="text-2xl font-black text-[#EC1577]">
                    {formatVND(aiEstimation.suggestedVnd)}
                  </div>
                  <div className="text-[11px] text-[#0E121B]/60">Dự kiến bán trong 7 ngày</div>
                </div>

                <div className="bg-[#F4F5F8] border border-gray-200 rounded-2xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-[#0E121B]/70">{t.fairRange}</div>
                  <div className="text-lg font-extrabold text-[#0E121B]">
                    {formatVND(aiEstimation.minVnd)} - {formatVND(aiEstimation.maxVnd)}
                  </div>
                  <div className="text-[11px] text-[#0E121B]/60">Biên độ chuẩn cho máy Grade A</div>
                </div>

                <div className="bg-[#F4F5F8] border border-gray-200 rounded-2xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-[#0E121B]/70">{t.quickSalePrice}</div>
                  <div className="text-2xl font-black text-[#0E121B]">
                    {formatVND(aiEstimation.quickSaleVnd)}
                  </div>
                  <div className="text-[11px] text-[#0E121B]/60">Khớp lệnh nhanh trong 3 ngày</div>
                </div>
              </div>

              <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 space-y-2">
                <div className="text-xs font-bold text-[#0E121B] uppercase tracking-wider">
                  Các yếu tố tác động tới định giá của AI:
                </div>
                <ul className="space-y-1 text-xs text-[#0E121B]/70">
                  {aiEstimation.keyFactors.map((factor, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#EC1577] shrink-0" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#F4F5F8] p-5 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-[#0E121B]">
                    {t.finalListingPrice}
                  </label>
                  <span className="text-xl font-bold text-[#EC1577]">
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
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-[#EC1577]"
                />

                <div className="flex justify-between text-[11px] text-[#0E121B]/60">
                  <span>Giá bán gấp: {formatVND(aiEstimation.quickSaleVnd)}</span>
                  <span>Đề xuất: {formatVND(aiEstimation.suggestedVnd)}</span>
                  <span>Giá cao: {formatVND(aiEstimation.maxVnd * 1.1)}</span>
                </div>

                {fraudWarning && (
                  <div className="p-3 rounded-xl bg-[#0E121B] border border-[#EC1577] text-white text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#EC1577] shrink-0 mt-0.5" />
                    <span>{fraudWarning}</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-[#0E121B]/70 bg-[#F4F5F8] p-3 rounded-xl border border-gray-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span>{t.disclaimer}</span>
              </div>
            </div>
          ) : null}

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-[#0E121B] hover:bg-[#F4F5F8] text-xs sm:text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại chỉnh sửa</span>
            </button>

            <button
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{t.publishListing}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
