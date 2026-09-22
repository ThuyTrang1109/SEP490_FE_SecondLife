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
    if (item.conditionGrade === 'Like New') return 'Như mới (99%)';
    if (item.conditionGrade === 'Good') return 'Tốt (95%)';
    return 'Khá (90%)';
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
      className="group relative bg-white rounded-2xl border border-slate-200 hover:border-[#EC1577] shadow-sm hover:shadow-md flex flex-col overflow-hidden cursor-pointer select-none transition-all duration-300"
    >
      {/* Photo container */}
      <div className="relative aspect-4/3 w-full bg-[#F4F5F8] overflow-hidden">
        <img
          src={item.photos.front}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
          loading="lazy"
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#0E121B]/90 text-white backdrop-blur-md shadow-xs"
          >
            {getConditionLabel()}
          </span>

          {item.isInspectionGuaranteed && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-[#EC1577] to-[#F1622A] text-white backdrop-blur-md shadow-xs"
              title="Đã kiểm định tại SecondLife Hub"
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
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0E121B]/90 hover:bg-gradient-to-r hover:from-[#EC1577] hover:to-[#F1622A] text-white backdrop-blur-md text-[11px] font-bold border border-white/20 shadow-xs transition-all cursor-pointer"
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
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="font-bold text-[#0E121B] uppercase tracking-wide">
              {item.brand} • {item.purchaseYear}
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <MapPin className="w-3 h-3 text-[#EC1577]" />
              {item.location.split(',')[0]}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-[#0E121B] text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-[#EC1577] transition-colors">
            {item.title}
          </h3>
        </div>

        {/* AI Fair Price Range */}
        {item.aiPriceEstimation && (
          <div className="bg-[#F4F5F8] rounded-xl p-2 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#0E121B] flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-[#EC1577]" />
                {lang === 'vi' ? 'Giá thị trường AI:' : 'AI Fair Range:'}
              </span>
              <span className="font-bold text-[#0E121B] text-[11px]">
                {formatVND(item.aiPriceEstimation.minVnd)} - {formatVND(item.aiPriceEstimation.maxVnd)}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-gradient-to-r from-[#EC1577] to-[#F1622A] h-full rounded-full" style={{ width: '85%' }} />
            </div>
          </div>
        )}

        {/* Price & Seller Info */}
        <div className="pt-2 border-t border-slate-100 flex items-end justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-normal">
              {item.originalPriceVnd && (
                <span className="line-through text-slate-400 mr-1.5">
                  {formatVND(item.originalPriceVnd)}
                </span>
              )}
              {lang === 'vi' ? 'Giá bán' : 'Price'}
            </div>
            <div className="text-base sm:text-lg font-black text-[#EC1577] leading-none mt-0.5">
              {formatVND(item.priceVnd)}
            </div>
          </div>

          {/* Seller Profile */}
          <div className="text-right">
            <div className="text-[11px] font-bold text-[#0E121B] flex items-center justify-end gap-1">
              <span>{item.sellerName}</span>
              {item.sellerVerified && (
                <CheckCircle2 className="w-3 h-3 text-[#EC1577]" />
              )}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
              <Star className="w-2.5 h-2.5 text-[#EC1577] fill-[#EC1577]" />
              <span className="font-bold text-[#0E121B]">{item.sellerRating}</span>
              <span>({item.sellerCompletedOrders})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
