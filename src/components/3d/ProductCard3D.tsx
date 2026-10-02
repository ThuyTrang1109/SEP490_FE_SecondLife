import React, { useState, useRef } from 'react';
import { ShieldCheck, Sparkles, MapPin, Star, CheckCircle2, Box } from 'lucide-react';
import { Listing, Language } from '../../types';
import { formatVND } from '../../utils/translations';
import { soundFx } from '../../utils/soundEffects';

interface ProductCard3DProps {
  item: Listing;
  lang: Language;
  onSelectListing: (listing: Listing) => void;
  onOpen3DViewer: (listing: Listing) => void;
}

export const ProductCard3D: React.FC<ProductCard3DProps> = ({
  item,
  lang,
  onSelectListing,
  onOpen3DViewer
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotX = -((y - centerY) / centerY) * 4;
    const rotY = ((x - centerX) / centerX) * 4;

    setRotateX(rotX);
    setRotateY(rotY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const getConditionLabel = () => {
    if (item.conditionGrade === 'Like New') return lang === 'vi' ? 'Như mới (99%)' : 'Like New (99%)';
    if (item.conditionGrade === 'Good') return lang === 'vi' ? 'Tốt (95%)' : 'Good (95%)';
    return lang === 'vi' ? 'Khá (90%)' : 'Fair (90%)';
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelectListing(item)}
      style={{
        transform: isHovered
          ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)',
        transformStyle: 'preserve-3d',
        transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.3s ease-out'
      }}
      className="group relative bg-white rounded-2xl border border-slate-200 hover:border-[#c34c36] shadow-sm hover:shadow-md flex flex-col overflow-hidden cursor-pointer select-none transition-all duration-300"
    >
      {/* Photo container */}
      <div className="relative aspect-4/3 w-full bg-[#faf8f5] overflow-hidden">
        <img
          src={item.photos.front}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
          loading="lazy"
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#24263e]/85 text-white backdrop-blur-md shadow-xs"
          >
            {getConditionLabel()}
          </span>

          {item.isInspectionGuaranteed && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#24263e]/85 text-white backdrop-blur-md shadow-xs"
              title={lang === 'vi' ? 'Đã kiểm định tại SecondLife Hub' : 'Inspected at SecondLife Hub'}
            >
              <ShieldCheck className="w-3 h-3 text-white" />
              <span>Hub Verified</span>
            </span>
          )}
        </div>

        {/* 3D Model Trigger Button (Top Right) */}
        <div className="absolute top-2.5 right-2.5 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              soundFx.playScanBeep();
              onOpen3DViewer(item);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#24263e]/85 hover:bg-[#24263e] text-white backdrop-blur-md text-[11px] font-bold border border-white/20 shadow-xs transition-all cursor-pointer"
            title={lang === 'vi' ? 'Mở xem mô hình 3D 360°' : 'Open 3D 360° view'}
          >
            <Box className="w-3 h-3 text-white" />
            <span>3D</span>
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5 bg-white">
        <div>
          {/* Brand & Location */}
          <div className="flex items-center justify-between text-[11px] text-[#24263e]/60 mb-1">
            <span className="font-bold text-[#24263e] uppercase tracking-wide">
              {item.brand} • {item.purchaseYear}
            </span>
            <span className="flex items-center gap-1 text-[#24263e]/70 font-medium">
              <MapPin className="w-3 h-3 text-[#24263e]" />
              {item.location.split(',')[0]}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-[#24263e] text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-[#24263e] transition-colors">
            {item.title}
          </h3>
        </div>

        {/* AI Fair Price Range */}
        {item.aiPriceEstimation && (
          <div className="bg-[#faf8f5] rounded-xl p-2 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#24263e] flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-[#24263e]" />
                {lang === 'vi' ? 'Giá thị trường AI:' : 'AI Fair Range:'}
              </span>
              <span className="font-bold text-[#24263e] text-[11px]">
                {formatVND(item.aiPriceEstimation.minVnd)} - {formatVND(item.aiPriceEstimation.maxVnd)}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-[#24263e] h-full rounded-full" style={{ width: '85%' }} />
            </div>
          </div>
        )}

        {/* Price & Seller Info */}
        <div className="pt-2 border-t border-slate-100 flex items-end justify-between">
          <div>
            <div className="text-[10px] text-[#24263e]/60 font-medium">
              {item.originalPriceVnd && (
                <span className="line-through text-[#24263e]/40 mr-1.5">
                  {formatVND(item.originalPriceVnd)}
                </span>
              )}
              {lang === 'vi' ? 'Giá bán' : 'Price'}
            </div>
            <div className="text-base sm:text-lg font-black text-[#24263e] leading-none mt-0.5">
              {formatVND(item.priceVnd)}
            </div>
          </div>

          {/* Seller Profile & Trust Score */}
          <div className="text-right">
            <div className="text-[11px] font-bold text-[#24263e] flex items-center justify-end gap-1">
              <span className="truncate max-w-[110px]">{item.sellerName}</span>
              {item.sellerVerified && (
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              )}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1.5 mt-0.5 font-medium">
              <span className="inline-flex items-center gap-0.5 font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                <span>{item.sellerRating}</span>
              </span>
              <span className="inline-flex items-center gap-0.5 font-bold text-[#24263e] bg-slate-100 px-1.5 py-0.2 rounded" title={lang === 'vi' ? 'Điểm uy tín người bán' : 'Seller trust score'}>
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                <span>{item.sellerTrustScore || 98}đ uy tín</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
