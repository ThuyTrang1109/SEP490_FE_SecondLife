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
      <div className="bg-[#FFFFFF] rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 flex flex-col my-auto text-[#0E121B]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0E121B]/95 backdrop-blur-md px-6 py-4 border-b border-white/10 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              {listing.conditionGrade === 'Like New' ? 'Grade A+ (99%)' : 'Grade A (95%)'}
            </span>
            <span className="text-xs text-white/70 font-medium">
              Mã tin: #{listing.id}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
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
                    ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-sm'
                    : 'bg-[#F4F5F8] text-[#0E121B] hover:bg-gray-200 border border-gray-200'
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
                    ? 'bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white shadow-sm font-bold'
                    : 'bg-[#F4F5F8] text-[#0E121B] hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Mô Hình 3D Xoay 360° & Soi Linh Kiện' : 'Interactive 3D 360° & X-Ray'}</span>
                <span className="bg-[#0E121B] text-[10px] px-1.5 py-0.2 rounded-full uppercase text-white">3D</span>
              </button>
            </div>

            <div className="text-xs text-gray-400 hidden sm:flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#EC1577]" />
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
                <div className="relative aspect-4/3 w-full bg-[#F4F5F8] rounded-2xl overflow-hidden border border-gray-200">
                  <img
                    src={listing.photos[activePhotoKey] || listing.photos.front}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-[#0E121B]/90 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                    <Camera className="w-3.5 h-3.5 text-[#EC1577]" />
                    <span>
                      {photoKeys.find((p) => p.key === activePhotoKey)?.[lang === 'vi' ? 'labelVi' : 'labelEn']}
                    </span>
                  </div>
                </div>

                {/* Thumbnails */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#EC1577]" />
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
                              ? 'border-[#EC1577] ring-2 ring-[#EC1577]/30 scale-102'
                              : 'border-gray-200 opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={listing.photos[item.key] || listing.photos.front}
                            alt={item.labelVi}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-[#0E121B]/90 text-white text-[9px] py-0.5 text-center truncate px-1">
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
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-bold text-[#0E121B] uppercase tracking-wider">{listing.brand}</span>
                    <span>•</span>
                    <span>{listing.category}</span>
                    <span>•</span>
                    <span>{listing.purchaseYear}</span>
                  </div>

                  <h1 className="text-xl font-extrabold text-[#0E121B] leading-snug">
                    {listing.title}
                  </h1>

                  {/* Price block */}
                  <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 space-y-1">
                    <div className="text-xs text-gray-400">
                      {listing.originalPriceVnd && (
                        <span className="line-through text-gray-400 mr-2">
                          {formatVND(listing.originalPriceVnd)}
                        </span>
                      )}
                      {lang === 'vi' ? 'Giá người bán niêm yết' : 'Listing Price'}
                    </div>
                    <div className="text-2xl font-black text-[#EC1577]">
                      {formatVND(listing.priceVnd)}
                    </div>
                    <div className="text-[11px] text-[#0E121B] font-medium flex items-center gap-1 pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#EC1577]" />
                      <span>{lang === 'vi' ? 'Tiền được giữ an toàn trong Escrow tới khi nhận máy' : 'Funds protected in Escrow until approved'}</span>
                    </div>
                  </div>

                  {/* Seller mini card */}
                  <div className="p-3 rounded-2xl bg-[#F4F5F8] border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0E121B] text-white font-black flex items-center justify-center text-sm border border-gray-200">
                        {listing.sellerName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#0E121B] flex items-center gap-1">
                          {listing.sellerName}
                          {listing.sellerVerified && (
                            <CheckCircle2 className="w-4 h-4 text-[#EC1577]" />
                          )}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-2">
                          <span className="flex items-center text-[#0E121B] font-semibold">
                            <Star className="w-3 h-3 fill-[#F1622A] text-[#F1622A] mr-0.5" />
                            {listing.sellerRating}
                          </span>
                          <span>•</span>
                          <span>{listing.sellerCompletedOrders} {lang === 'vi' ? 'giao dịch' : 'orders'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{listing.location.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => onBuyClick(listing)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#EC1577] to-[#F1622A] hover:opacity-90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>{lang === 'vi' ? 'Mua Bảo Đảm Escrow & Kiểm Định' : 'Buy with Escrow & Inspection'}</span>
                  </button>

                  <button
                    onClick={() => onChatClick(listing)}
                    className="w-full py-2.5 px-4 bg-[#0E121B] hover:bg-[#0E121B]/90 text-white rounded-xl font-medium text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <span>{lang === 'vi' ? 'Đàm Phán Giá / Chat Với Người Bán' : 'Negotiate / Chat with Seller'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Price Estimation & Valuation Deep-Dive */}
          {listing.aiPriceEstimation && (
            <div className="rounded-2xl bg-[#F4F5F8] p-5 border border-gray-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shadow-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0E121B]">
                      {lang === 'vi' ? 'Mô Hình AI Định Giá Thị Trường SecondLife' : 'SecondLife AI Market Valuation'}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {lang === 'vi'
                        ? 'Dựa trên 1,420+ tin đăng và giao dịch thực tế tương đương tại Việt Nam'
                        : 'Calibrated with 1,420+ verified real transaction records in Vietnam'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#0E121B] text-white px-3 py-1 rounded-full text-xs font-bold">
                  <Award className="w-3.5 h-3.5 text-[#EC1577]" />
                  <span>Độ tin cậy mô hình: {listing.aiPriceEstimation.confidence}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-gray-400">{t.fairRange}</div>
                  <div className="text-sm font-extrabold text-[#0E121B]">
                    {formatVND(listing.aiPriceEstimation.minVnd)} - {formatVND(listing.aiPriceEstimation.maxVnd)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium mt-0.5">Biên độ thanh khoản tốt</div>
                </div>

                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-gray-400">{t.suggestedPrice}</div>
                  <div className="text-sm font-extrabold text-[#EC1577]">
                    {formatVND(listing.aiPriceEstimation.suggestedVnd)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Thời gian bán ~ 7 ngày</div>
                </div>

                <div className="bg-[#FFFFFF] rounded-xl p-3 border border-gray-200 shadow-2xs">
                  <div className="text-[11px] text-gray-400">{t.quickSalePrice}</div>
                  <div className="text-sm font-extrabold text-[#0E121B]">
                    {formatVND(listing.aiPriceEstimation.quickSaleVnd)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium mt-0.5">Bán nhanh trong 3 ngày</div>
                </div>
              </div>

              <div className="text-[11px] text-[#0E121B] bg-[#FFFFFF] p-2.5 rounded-xl border border-gray-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span>{t.disclaimer}</span>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#0E121B] uppercase tracking-wider text-[11px]">
              {lang === 'vi' ? 'Cam kết tình trạng người bán' : 'Seller Condition Statement'}
            </h3>
            <div className="bg-[#F4F5F8] rounded-2xl p-4 border border-gray-200 text-sm text-[#0E121B] space-y-2 leading-relaxed">
              <div className="font-semibold text-white flex items-center gap-1.5 text-xs bg-[#0E121B] px-2.5 py-1 rounded-lg w-fit">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#EC1577]" />
                <span>{listing.declaredConditionText}</span>
              </div>
              <p className="whitespace-pre-line text-xs sm:text-sm text-[#0E121B]">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Inspection Center Trust Workflow Badge */}
          <div className="p-4 rounded-2xl bg-[#F4F5F8] border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-[#0E121B] text-sm">
                  {lang === 'vi' ? 'Dịch Vụ Kiểm Định Trung Tâm SecondLife Hub' : 'SecondLife Certified Inspection Service'}
                </div>
                <div className="text-xs text-gray-400">
                  {lang === 'vi'
                    ? 'Kỹ sư chuyên trách tháo soi linh kiện, đo pin, test màn hình và dán tem niêm phong NFC trước khi giao.'
                    : 'Certified hardware engineers verify authentic parts, battery health, and apply tamper-proof NFC seals.'}
                </div>
              </div>
            </div>

            <span className="text-xs font-bold text-white bg-[#0E121B] px-3 py-1.5 rounded-xl whitespace-nowrap">
              Phí kiểm định: 250,000đ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
