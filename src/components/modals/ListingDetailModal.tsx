import React, { useState } from 'react';
import { X, ShieldCheck, Sparkles, CheckCircle2, Star, MapPin, MessageSquare, Info, Award, FileCheck2, Camera, Box } from 'lucide-react';
import { Listing, Language } from '../../types';
import { translations, formatVND } from '../../utils/translations';
import { ProductViewer3D } from '../3d/ProductViewer3D';
import { soundFx } from '../../utils/soundEffects';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 flex flex-col my-auto text-[#2b1d16]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#cea981] backdrop-blur-md px-6 py-4 border-b border-[#2b1d16]/15 flex items-center justify-between text-[#2b1d16]">
          <div className="flex items-center gap-2">
            <span className="bg-white text-[#2b1d16] text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2b1d16]" />
              {listing.conditionGrade === 'Like New' ? 'Grade A+ (99%)' : 'Grade A (95%)'}
            </span>
            <span className="text-xs text-[#2b1d16]/80 font-bold">
              Mã tin: #{listing.id}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#2b1d16] hover:bg-white/40 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Visual Mode Selector Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  soundFx.playChime();
                  setViewMode('photos');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'photos'
                    ? 'bg-[#2b1d16] text-white shadow-sm font-black'
                    : 'bg-[#f6f5eb] text-[#2b1d16] hover:bg-gray-200 border border-gray-200'
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
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === '3d'
                    ? 'bg-[#2b1d16] text-white shadow-sm font-black'
                    : 'bg-[#f6f5eb] text-[#2b1d16] hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Mô Hình 3D Xoay 360° & Soi Linh Kiện' : 'Interactive 3D 360° & X-Ray'}</span>
                <span className="bg-white text-[#2b1d16] text-[10px] px-1.5 py-0.2 rounded-full uppercase font-black">3D</span>
              </button>
            </div>

            <div className="text-xs text-[#2b1d16]/70 hidden sm:flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#2b1d16]" />
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
                <div className="relative aspect-4/3 w-full bg-[#f6f5eb] rounded-2xl overflow-hidden border border-gray-200">
                  <img
                    src={listing.photos[activePhotoKey] || listing.photos.front}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-[#2b1d16]/90 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10 font-bold">
                    <Camera className="w-3.5 h-3.5 text-white" />
                    <span>
                      {photoKeys.find((p) => p.key === activePhotoKey)?.[lang === 'vi' ? 'labelVi' : 'labelEn']}
                    </span>
                  </div>
                </div>

                {/* Thumbnails */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-[#2b1d16]/70 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#2b1d16]" />
                    <span>{t.photoChecklistTitle}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {photoKeys.map((item) => {
                      const isSelected = activePhotoKey === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActivePhotoKey(item.key)}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#2b1d16] ring-2 ring-[#2b1d16]/30 scale-102'
                              : 'border-gray-200 opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={listing.photos[item.key] || listing.photos.front}
                            alt={item.labelVi}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-[#2b1d16]/90 text-white text-[9px] py-0.5 text-center truncate px-1 font-bold">
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
                  <div className="flex items-center gap-2 text-xs text-[#2b1d16]/70 font-medium">
                    <span className="font-black text-[#2b1d16] uppercase tracking-wider">{listing.brand}</span>
                    <span>•</span>
                    <span>{listing.category}</span>
                    <span>•</span>
                    <span>{listing.purchaseYear}</span>
                  </div>

                  <h1 className="text-xl font-extrabold text-[#2b1d16] leading-snug">
                    {listing.title}
                  </h1>

                  {/* Price block */}
                  <div className="bg-[#f6f5eb] rounded-2xl p-4 border border-gray-200 space-y-1">
                    <div className="text-xs text-[#2b1d16]/70 font-medium">
                      {listing.originalPriceVnd && (
                        <span className="line-through text-[#2b1d16]/50 mr-2">
                          {formatVND(listing.originalPriceVnd)}
                        </span>
                      )}
                      {lang === 'vi' ? 'Giá người bán niêm yết' : 'Listing Price'}
                    </div>
                    <div className="text-2xl font-black text-[#2b1d16]">
                      {formatVND(listing.priceVnd)}
                    </div>
                    <div className="text-[11px] text-[#2b1d16] font-bold flex items-center gap-1 pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#2b1d16]" />
                      <span>{lang === 'vi' ? 'Tiền được giữ an toàn trong Escrow tới khi nhận máy' : 'Funds protected in Escrow until approved'}</span>
                    </div>
                  </div>

                  {/* Seller mini card */}
                  <div className="p-3 rounded-2xl bg-[#f6f5eb] border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#cea981] text-[#2b1d16] font-black flex items-center justify-center text-sm border border-[#2b1d16]/20">
                        {listing.sellerName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#2b1d16] flex items-center gap-1">
                          {listing.sellerName}
                          {listing.sellerVerified && (
                            <CheckCircle2 className="w-4 h-4 text-[#2b1d16]" />
                          )}
                        </div>
                        <div className="text-xs text-[#2b1d16]/70 flex items-center gap-2 font-medium">
                          <span className="flex items-center text-[#2b1d16] font-bold">
                            <Star className="w-3 h-3 fill-[#cea981] text-[#cea981] mr-0.5" />
                            {listing.sellerRating}
                          </span>
                          <span>•</span>
                          <span>{listing.sellerCompletedOrders} {lang === 'vi' ? 'giao dịch' : 'orders'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-[#2b1d16]/70 font-medium">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#2b1d16]" />
                        <span>{listing.location.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => onBuyClick(listing)}
                    className="w-full py-3 px-4 bg-[#2b1d16] hover:bg-black text-white rounded-xl font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>{lang === 'vi' ? 'Mua Bảo Đảm Escrow & Kiểm Định' : 'Buy with Escrow & Inspection'}</span>
                  </button>

                  <button
                    onClick={() => onChatClick(listing)}
                    className="w-full py-2.5 px-4 bg-white hover:bg-white/80 text-[#2b1d16] border border-[#2b1d16]/20 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-[#2b1d16]" />
                    <span>{lang === 'vi' ? 'Đàm Phán Giá / Chat Với Người Bán' : 'Negotiate / Chat with Seller'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Price Estimation & Valuation Deep-Dive */}
          {listing.aiPriceEstimation && (
            <div className="rounded-2xl bg-[#f6f5eb] p-5 border border-gray-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#2b1d16] text-white flex items-center justify-center shadow-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#2b1d16]">
                      {lang === 'vi' ? 'Mô Hình AI Định Giá Thị Trường SecondLife' : 'SecondLife AI Market Valuation'}
                    </h3>
                    <p className="text-xs text-[#2b1d16]/70 font-medium">
                      {lang === 'vi'
                        ? 'Dựa trên 1,420+ tin đăng và giao dịch thực tế tương đương tại Việt Nam'
                        : 'Calibrated with 1,420+ verified real transaction records in Vietnam'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#2b1d16] text-white px-3 py-1 rounded-full text-xs font-bold">
                  <Award className="w-3.5 h-3.5 text-white" />
                  <span>{lang === 'vi' ? 'Độ tin cậy mô hình' : 'Model Confidence'}: {listing.aiPriceEstimation.confidence}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-[#2b1d16]/70 font-semibold">{t.fairRange}</div>
                  <div className="text-sm font-black text-[#2b1d16]">
                    {formatVND(listing.aiPriceEstimation.minVnd)} - {formatVND(listing.aiPriceEstimation.maxVnd)}
                  </div>
                  <div className="text-[10px] text-[#2b1d16]/60 font-medium mt-0.5">{lang === 'vi' ? 'Biên độ thanh khoản tốt' : 'Optimal liquidity range'}</div>
                </div>

                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-[#2b1d16]/70 font-semibold">{t.suggestedPrice}</div>
                  <div className="text-sm font-black text-[#2b1d16]">
                    {formatVND(listing.aiPriceEstimation.suggestedVnd)}
                  </div>
                  <div className="text-[10px] text-[#2b1d16]/60 font-medium mt-0.5">{lang === 'vi' ? 'Thời gian bán ~ 7 ngày' : 'Avg. sale time ~ 7 days'}</div>
                </div>

                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-[#2b1d16]/70 font-semibold">{t.quickSalePrice}</div>
                  <div className="text-sm font-black text-[#2b1d16]">
                    {formatVND(listing.aiPriceEstimation.quickSaleVnd)}
                  </div>
                  <div className="text-[10px] text-[#2b1d16]/60 font-medium mt-0.5">{lang === 'vi' ? 'Bán nhanh trong 3 ngày' : 'Quick sale in 3 days'}</div>
                </div>
              </div>

              <div className="text-[11px] text-[#2b1d16] bg-[#FFFFFF] p-2.5 rounded-xl border border-gray-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#2b1d16] shrink-0 mt-0.5" />
                <span className="font-medium">{t.disclaimer}</span>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-[#2b1d16] uppercase tracking-wider text-[11px]">
              {lang === 'vi' ? 'Cam kết tình trạng người bán' : 'Seller Condition Statement'}
            </h3>
            <div className="bg-[#f6f5eb] rounded-2xl p-4 border border-gray-200 text-sm text-[#2b1d16] space-y-2 leading-relaxed">
              <div className="font-bold text-[#2b1d16] flex items-center gap-1.5 text-xs bg-white border border-[#2b1d16]/20 px-2.5 py-1 rounded-lg w-fit shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2b1d16]" />
                <span>{listing.declaredConditionText}</span>
              </div>
              <p className="whitespace-pre-line text-xs sm:text-sm text-[#2b1d16]">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Inspection Center Trust Workflow Badge */}
          <div className="p-4 rounded-2xl bg-[#f6f5eb] border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2b1d16] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="font-black text-[#2b1d16] text-sm">
                  {lang === 'vi' ? 'Dịch Vụ Kiểm Định Trung Tâm SecondLife Hub' : 'SecondLife Certified Inspection Service'}
                </div>
                <div className="text-xs text-[#2b1d16]/70 font-medium">
                  {lang === 'vi'
                    ? 'Kỹ sư chuyên trách tháo soi linh kiện, đo pin, test màn hình và dán tem niêm phong NFC trước khi giao.'
                    : 'Certified hardware engineers verify authentic parts, battery health, and apply tamper-proof NFC seals.'}
                </div>
              </div>
            </div>

            <span className="text-xs font-black text-[#2b1d16] bg-white border border-[#2b1d16]/20 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-xs">
              {lang === 'vi' ? 'Phí kiểm định: 250,000đ' : 'Inspection fee: 250,000 VND'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
