import React, { useState } from 'react';
import { X, ShieldCheck, Sparkles, CheckCircle2, Star, Clock, MapPin, AlertCircle, ShoppingBag, MessageSquare, ChevronRight, Info, Award, FileCheck2, Camera, Box } from 'lucide-react';
import { Listing, Language } from '../types';
import { translations, formatVND } from '../utils/translations';
import { ProductViewer3D } from './ProductViewer3D';
import { soundFx } from '../utils/soundEffects';

interface ListingDetailModalProps {
  listing: Listing | null;
  onClose: () => void;
  onBuyClick: (listing: Listing) => void;
  onChatClick: (listing: Listing) => void;
  lang: Language;
  initialViewMode?: 'photos' | '3d';
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  onClose,
  onBuyClick,
  onChatClick,
  lang,
  initialViewMode = 'photos'
}) => {
  if (!listing) return null;
  const t = translations[lang];

  const photoKeys: Array<{ key: keyof typeof listing.photos; labelVi: string; labelEn: string }> = [
    { key: 'front', labelVi: '1. Mặt trước', labelEn: '1. Front' },
    { key: 'back', labelVi: '2. Mặt sau & Viền', labelEn: '2. Back & Frame' },
    { key: 'screenOrDetails', labelVi: '3. Soi vết xước', labelEn: '3. Scratches / Details' },
    { key: 'accessoriesOrBox', labelVi: '4. Phụ kiện / Hộp', labelEn: '4. Accessories & Box' },
    { key: 'serialOrReceipt', labelVi: '5. Serial / Hóa đơn', labelEn: '5. Serial / Proof' }
  ];

  const [viewMode, setViewMode] = useState<'photos' | '3d'>(initialViewMode);
  const [activePhotoKey, setActivePhotoKey] = useState<keyof typeof listing.photos>('front');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col my-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {listing.conditionGrade === 'Like New' ? 'Grade A+ (99%)' : 'Grade A (95%)'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Mã tin: #{listing.id}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Visual Mode Selector Tabs: 2D Photos vs 3D Interactive Model */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  soundFx.playChime();
                  setViewMode('photos');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${viewMode === 'photos'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Ảnh Thực Tế (5 Góc Chuẩn)' : 'Real Photos (5 Angles)'}</span>
              </button>

              <button
                onClick={() => {
                  soundFx.playScanBeep();
                  setViewMode('3d');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${viewMode === '3d'
                    ? 'bg-[#1B4D3E] text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200/80'
                  }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Mô Hình 3D Xoay 360° & Soi Linh Kiện' : 'Interactive 3D 360° & X-Ray'}</span>
                <span className="bg-white/20 text-[10px] px-1.5 py-0.2 rounded-full uppercase">3D</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 hidden sm:flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'vi' ? 'Dữ liệu quét 3D tại Hub giám định' : '3D Spatial Scan from Hub'}</span>
            </div>
          </div>

          {/* Conditional Display: 3D Full Viewer or 2D Photo Gallery */}
          {viewMode === '3d' ? (
            <div className="w-full">
              <ProductViewer3D listing={listing} lang={lang} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Gallery Column (7 cols) */}
              <div className="md:col-span-7 space-y-3">
                {/* Main Photo View */}
                <div className="relative aspect-4/3 w-full bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                  <img
                    src={listing.photos[activePhotoKey] || listing.photos.front}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {photoKeys.find((p) => p.key === activePhotoKey)?.[lang === 'vi' ? 'labelVi' : 'labelEn']}
                    </span>
                  </div>
                </div>

                {/* Standard 5-Photo Checklist Thumbnails */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t.photoChecklistTitle}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {photoKeys.map((item) => {
                      const isSelected = activePhotoKey === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActivePhotoKey(item.key)}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${isSelected
                              ? 'border-emerald-600 ring-2 ring-emerald-500/20 scale-102'
                              : 'border-slate-200 opacity-75 hover:opacity-100'
                            }`}
                        >
                          <img
                            src={listing.photos[item.key] || listing.photos.front}
                            alt={item.labelVi}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 text-white text-[9px] py-0.5 text-center truncate px-1">
                            {lang === 'vi' ? item.labelVi.split('.')[1] : item.labelEn.split('.')[1]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Price & Seller Action Column (5 cols) */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-bold text-emerald-700 uppercase tracking-wider">{listing.brand}</span>
                    <span>•</span>
                    <span>{listing.category}</span>
                    <span>•</span>
                    <span>{listing.purchaseYear}</span>
                  </div>

                  <h1 className="text-xl font-extrabold text-slate-900 leading-snug font-['Outfit']">
                    {listing.title}
                  </h1>

                  {/* Price block */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-1">
                    <div className="text-xs text-slate-500">
                      {listing.originalPriceVnd && (
                        <span className="line-through text-slate-400 mr-2">
                          {formatVND(listing.originalPriceVnd)}
                        </span>
                      )}
                      {lang === 'vi' ? 'Giá người bán niêm yết' : 'Listing Price'}
                    </div>
                    <div className="text-2xl font-black text-slate-900 font-['Outfit']">
                      {formatVND(listing.priceVnd)}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'vi' ? 'Tiền được giữ an toàn trong Escrow tới khi nhận máy' : 'Funds protected in Escrow until approved'}</span>
                    </div>
                  </div>

                  {/* Seller mini card */}
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm border border-emerald-300">
                        {listing.sellerName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-1">
                          {listing.sellerName}
                          {listing.sellerVerified && (
                            <CheckCircle2 className="w-4 h-4 text-blue-500 fill-blue-50" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="flex items-center text-amber-500 font-semibold">
                            <Star className="w-3 h-3 fill-amber-500 mr-0.5" />
                            {listing.sellerRating}
                          </span>
                          <span>•</span>
                          <span>{listing.sellerCompletedOrders} {lang === 'vi' ? 'giao dịch' : 'orders'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{listing.location.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => onBuyClick(listing)}
                    className="w-full py-3 px-4 bg-[#1B4D3E] hover:bg-[#153e32] active:bg-[#113127] text-white rounded-xl font-semibold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>{lang === 'vi' ? 'Mua Bảo Đảm Escrow & Kiểm Định' : 'Buy with Escrow & Inspection'}</span>
                  </button>

                  <button
                    onClick={() => onChatClick(listing)}
                    className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl font-medium text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-stone-500" />
                    <span>{lang === 'vi' ? 'Đàm Phán Giá / Chat Với Người Bán' : 'Negotiate / Chat with Seller'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Price Estimation & Valuation Deep-Dive */}
          {listing.aiPriceEstimation && (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 p-5 border border-emerald-200/80 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">
                      {lang === 'vi' ? 'Mô Hình AI Định Giá Thị Trường SecondLife' : 'SecondLife AI Market Valuation'}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {lang === 'vi'
                        ? 'Dựa trên 1,420+ tin đăng và giao dịch thực tế tương đương tại Việt Nam'
                        : 'Calibrated with 1,420+ verified real transaction records in Vietnam'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-300">
                  <Award className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Độ tin cậy mô hình: {listing.aiPriceEstimation.confidence}%</span>
                </div>
              </div>

              {/* Valuation stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-2xs">
                  <div className="text-[11px] text-slate-500">{t.fairRange}</div>
                  <div className="text-sm font-extrabold text-slate-800 font-['Outfit']">
                    {formatVND(listing.aiPriceEstimation.minVnd)} - {formatVND(listing.aiPriceEstimation.maxVnd)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Biên độ thanh khoản tốt</div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-2xs">
                  <div className="text-[11px] text-slate-500">{t.suggestedPrice}</div>
                  <div className="text-sm font-extrabold text-emerald-700 font-['Outfit']">
                    {formatVND(listing.aiPriceEstimation.suggestedVnd)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Thời gian bán ~ 7 ngày</div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-2xs">
                  <div className="text-[11px] text-slate-500">{t.quickSalePrice}</div>
                  <div className="text-sm font-extrabold text-amber-600 font-['Outfit']">
                    {formatVND(listing.aiPriceEstimation.quickSaleVnd)}
                  </div>
                  <div className="text-[10px] text-amber-700 font-medium mt-0.5">Bán nhanh trong 3 ngày</div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="text-[11px] text-slate-500 bg-white/70 p-2.5 rounded-xl border border-slate-200/60 flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{t.disclaimer}</span>
              </div>
            </div>
          )}

          {/* Description & Declared Condition */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              {lang === 'vi' ? 'Cam kết tình trạng người bán' : 'Seller Condition Statement'}
            </h3>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-sm text-slate-700 space-y-2 leading-relaxed">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{listing.declaredConditionText}</span>
              </div>
              <p className="whitespace-pre-line text-xs sm:text-sm text-slate-600">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Inspection Center Trust Workflow Badge */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  {lang === 'vi' ? 'Dịch Vụ Kiểm Định Trung Tâm SecondLife Hub' : 'SecondLife Certified Inspection Service'}
                </div>
                <div className="text-xs text-slate-600">
                  {lang === 'vi'
                    ? 'Kỹ sư chuyên trách tháo soi linh kiện, đo pin, test màn hình và dán tem niêm phong NFC trước khi giao.'
                    : 'Certified hardware engineers verify authentic parts, battery health, and apply tamper-proof NFC seals.'}
                </div>
              </div>
            </div>

            <span className="text-xs font-bold text-blue-700 bg-blue-100/90 px-3 py-1.5 rounded-xl whitespace-nowrap">
              Phí kiểm định: 250,000đ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
