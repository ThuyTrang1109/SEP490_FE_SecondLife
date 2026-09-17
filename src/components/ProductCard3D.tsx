import React, { useState, useRef } from 'react';
import { ShieldCheck, Sparkles, MapPin, Clock, Star, CheckCircle2, Box, Eye } from 'lucide-react';
import { Listing, Language } from '../types';
import { formatVND } from '../utils/translations';
import { soundFx } from '../utils/soundEffects';

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
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotX = -((y - centerY) / centerY) * 7;
    const rotY = ((x - centerX) / centerX) * 7;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePosition({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
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
          ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)',
        transformStyle: 'preserve-3d',
        transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.4s ease-out'
      }}
      className="group relative bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-400/80 shadow-xs hover:shadow-xl hover:shadow-emerald-950/5 flex flex-col overflow-hidden cursor-pointer select-none transition-all duration-300"
    >
      {/* Dynamic 3D Glare Reflection */}
      {isHovered && (
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300 rounded-3xl"
          style={{
            background: `radial-gradient(circle 280px at ${glarePosition.x}% ${glarePosition.y}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 80%)`
          }}
        />
      )}

      {/* Photo container */}
      <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
        <img
          src={item.photos.front}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
          loading="lazy"
        />

        {/* Badges (Top Left) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
          {/* Condition Grade Badge */}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold shadow-md backdrop-blur-md transition-transform group-hover:translate-z-10 ${item.conditionGrade === 'Like New'
                ? 'bg-emerald-600/95 text-white shadow-emerald-900/20'
                : item.conditionGrade === 'Good'
                  ? 'bg-blue-600/95 text-white shadow-blue-900/20'
                  : 'bg-amber-600/95 text-white shadow-amber-900/20'
              }`}
          >
            {item.conditionGrade === 'Like New'
              ? 'Như mới (99%)'
              : item.conditionGrade === 'Good'
                ? 'Tốt (95%)'
                : 'Khá (90%)'}
          </span>

          {/* Inspection Guarantee Badge */}
          {item.isInspectionGuaranteed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-900/90 text-emerald-400 backdrop-blur-md border border-emerald-400/40 shadow-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'vi' ? 'Kiểm định Hub' : 'Inspected Hub'}</span>
            </span>
          )}
        </div>

        {/* 3D Model Trigger Button (Top Right) */}
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              soundFx.playScanBeep();
              onOpen3DViewer(item);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/85 hover:bg-emerald-600 text-emerald-300 hover:text-white backdrop-blur-md text-xs font-bold border border-emerald-400/30 shadow-lg transition-all transform hover:scale-105"
            title={lang === 'vi' ? 'Mở mô hình 3D xoay 360°' : 'Open 3D 360° model'}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D 360°</span>
          </button>
        </div>

        {/* Days to sell badge */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/70 backdrop-blur-md text-white px-2.5 py-0.5 rounded-lg text-[11px] font-medium z-10">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Dự kiến bán ~{item.aiPriceEstimation?.daysToSell || 5} ngày</span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3 bg-white">
        <div>
          {/* Brand & Location */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-bold text-emerald-700 uppercase tracking-wide bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              {item.brand} • {item.purchaseYear}
            </span>
            <span className="flex items-center gap-1 text-slate-500 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {item.location.split(',')[0]}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-slate-900 text-sm sm:text-base line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
            {item.title}
          </h3>
        </div>

        {/* AI Fair Price Range Bar */}
        {item.aiPriceEstimation && (
          <div className="bg-emerald-50/70 rounded-2xl p-2.5 border border-emerald-100/90 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-800 flex items-center gap-1 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                {lang === 'vi' ? 'Giá AI bảo chứng:' : 'AI Fair Range:'}
              </span>
              <span className="font-bold text-emerald-950">
                {formatVND(item.aiPriceEstimation.minVnd)} - {formatVND(item.aiPriceEstimation.maxVnd)}
              </span>
            </div>
            <div className="w-full bg-emerald-200/60 h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full" style={{ width: '85%' }} />
            </div>
          </div>
        )}

        {/* Price & Seller Info */}
        <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">
              {item.originalPriceVnd && (
                <span className="line-through text-slate-400 mr-1.5">
                  {formatVND(item.originalPriceVnd)}
                </span>
              )}
              {lang === 'vi' ? 'Giá niêm yết' : 'Listing Price'}
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-slate-900 leading-none mt-0.5">
              {formatVND(item.priceVnd)}
            </div>
          </div>

          {/* Seller Profile Pill */}
          <div className="text-right">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1">
              <span>{item.sellerName}</span>
              {item.sellerVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
              )}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1 mt-0.5">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className="font-bold text-slate-800">{item.sellerRating}</span>
              <span className="text-slate-400">({item.sellerCompletedOrders} đơn)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

