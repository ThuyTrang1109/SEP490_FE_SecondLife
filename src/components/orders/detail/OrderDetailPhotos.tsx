import { Clock, Layers, Shield, ShieldCheck } from 'lucide-react';
import type { EscrowOrder, Language } from '../../../types';
import type { InspectionOrderDto } from '../../../services/inspectorService';
import type { OrderPhotoStage } from '../../../types/orders/orderTypes';
import { getInspectionReportMedia } from '../../../utils/inspectionDecisionData';
import { translations } from '../../../utils/translations';

interface Props {
  order: EscrowOrder;
  detailInspectionDto: InspectionOrderDto | null;
  activePhotoStage: OrderPhotoStage;
  setActivePhotoStage: (stage: OrderPhotoStage) => void;
  lang: Language;
}

export function OrderDetailPhotos({
  order: detailModalOrder,
  detailInspectionDto,
  activePhotoStage,
  setActivePhotoStage,
  lang,
}: Props) {
  const t = translations[lang];
  return (
    <>
      {/* Multi-Stage Photo Audit */}
      {(() => {
        const hasInspection = Boolean(
          detailModalOrder.hasInspectionService ||
          (detailModalOrder.inspectionFeeVnd && detailModalOrder.inspectionFeeVnd > 0) ||
          detailModalOrder.inspectionCenterId ||
          detailModalOrder.inspectionMethod ||
          (detailModalOrder as any).inspectionStatus
        );

        const stageTitle = hasInspection ? t.multiStageTitle : t.multiStageTitle2Stage;

        // 1. Listing photos (Giai đoạn 1 - Người bán)
        const rawListingPhotos: string[] = [];
        if (detailInspectionDto?.postImageUrls && Array.isArray(detailInspectionDto.postImageUrls)) {
          rawListingPhotos.push(...detailInspectionDto.postImageUrls);
        }
        if (detailInspectionDto?.postImageUrl) {
          rawListingPhotos.push(detailInspectionDto.postImageUrl);
        }
        if ((detailModalOrder as any).postImageUrls && Array.isArray((detailModalOrder as any).postImageUrls)) {
          rawListingPhotos.push(...(detailModalOrder as any).postImageUrls);
        }
        if (detailModalOrder.listing?.photoGallery && Array.isArray(detailModalOrder.listing.photoGallery)) {
          rawListingPhotos.push(...detailModalOrder.listing.photoGallery);
        }
        if (detailModalOrder.listing?.photos) {
          const p = detailModalOrder.listing.photos;
          if (p.front) rawListingPhotos.push(p.front);
          if (p.back) rawListingPhotos.push(p.back);
          if (p.screenOrDetails) rawListingPhotos.push(p.screenOrDetails);
          if (p.accessoriesOrBox) rawListingPhotos.push(p.accessoriesOrBox);
          if (p.serialOrReceipt) rawListingPhotos.push(p.serialOrReceipt);
        }
        if (detailModalOrder.multiStagePhotos?.listingPhotos && Array.isArray(detailModalOrder.multiStagePhotos.listingPhotos)) {
          rawListingPhotos.push(...detailModalOrder.multiStagePhotos.listingPhotos);
        }
        const listingPhotos = Array.from(new Set(
          rawListingPhotos
            .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            .map((u) => u.trim())
        ));

        // 2. Hub Inspector photos (Giai đoạn 2 - Kiểm định Hub)
        const rawInspectorPhotos: string[] = [];
        if (detailInspectionDto) {
          const reportMedia = getInspectionReportMedia(detailInspectionDto);
          if (reportMedia.photos && reportMedia.photos.length > 0) {
            rawInspectorPhotos.push(...reportMedia.photos);
          }
          if (detailInspectionDto.inspectorPhotos && Array.isArray(detailInspectionDto.inspectorPhotos)) {
            rawInspectorPhotos.push(...detailInspectionDto.inspectorPhotos);
          }
          if (detailInspectionDto.proofPhotos && Array.isArray(detailInspectionDto.proofPhotos)) {
            rawInspectorPhotos.push(...detailInspectionDto.proofPhotos);
          }
          if (detailInspectionDto.evidenceUrls && Array.isArray(detailInspectionDto.evidenceUrls)) {
            rawInspectorPhotos.push(...detailInspectionDto.evidenceUrls);
          }
        }
        if (detailModalOrder.inspectionReport?.inspectorPhotos && Array.isArray(detailModalOrder.inspectionReport.inspectorPhotos)) {
          rawInspectorPhotos.push(...detailModalOrder.inspectionReport.inspectorPhotos);
        }
        if ((detailModalOrder as any).inspectorPhotos && Array.isArray((detailModalOrder as any).inspectorPhotos)) {
          rawInspectorPhotos.push(...(detailModalOrder as any).inspectorPhotos);
        }
        if (detailModalOrder.multiStagePhotos?.inspectorPhotos && Array.isArray(detailModalOrder.multiStagePhotos.inspectorPhotos)) {
          rawInspectorPhotos.push(...detailModalOrder.multiStagePhotos.inspectorPhotos);
        }
        if (typeof window !== 'undefined') {
          try {
            const rawStored = localStorage.getItem(`inspection_report_${detailModalOrder.id}`);
            if (rawStored) {
              const parsed = JSON.parse(rawStored);
              if (parsed?.inspectorPhotos && Array.isArray(parsed.inspectorPhotos)) {
                rawInspectorPhotos.push(...parsed.inspectorPhotos);
              }
            }
          } catch { }
        }
        const inspectorPhotos = Array.from(new Set(
          rawInspectorPhotos
            .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            .map((u) => u.trim())
        ));

        // 3. Handover photos (Giai đoạn 3 - Niêm phong giao)
        const rawHandoverPhotos: string[] = [];
        if (detailModalOrder.multiStagePhotos?.handoverPhotos && Array.isArray(detailModalOrder.multiStagePhotos.handoverPhotos)) {
          rawHandoverPhotos.push(...detailModalOrder.multiStagePhotos.handoverPhotos);
        }
        if ((detailModalOrder as any).handoverPhotos && Array.isArray((detailModalOrder as any).handoverPhotos)) {
          rawHandoverPhotos.push(...(detailModalOrder as any).handoverPhotos);
        }
        if ((detailInspectionDto as any)?.tamperSealPhoto) {
          rawHandoverPhotos.push((detailInspectionDto as any).tamperSealPhoto);
        }
        if ((detailModalOrder as any).tamperSealPhoto) {
          rawHandoverPhotos.push((detailModalOrder as any).tamperSealPhoto);
        }
        if (typeof window !== 'undefined') {
          try {
            const rawSealPhoto = localStorage.getItem(`tamper_seal_photo_${detailModalOrder.id}`);
            if (rawSealPhoto) rawHandoverPhotos.push(rawSealPhoto);
          } catch { }
        }
        const handoverPhotos = Array.from(new Set(
          rawHandoverPhotos
            .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            .map((u) => u.trim())
        ));

        const currentPhotos = activePhotoStage === 'listing'
          ? listingPhotos
          : activePhotoStage === 'inspector'
            ? inspectorPhotos
            : handoverPhotos;

        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-[#24263e] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#24263e]" />
                <span>{stageTitle}</span>
              </div>

              <div className="flex items-center gap-1 bg-[#faf8f5] p-1 rounded-xl text-xs border border-gray-200">
                <button
                  onClick={() => setActivePhotoStage('listing')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${activePhotoStage === 'listing'
                    ? 'bg-[#24263e] text-white'
                    : 'text-[#24263e]/70'
                    }`}
                >
                  1. Người bán{listingPhotos.length > 0 ? ` (${listingPhotos.length})` : ''}
                </button>
                {hasInspection && (
                  <button
                    onClick={() => setActivePhotoStage('inspector')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${activePhotoStage === 'inspector'
                      ? 'bg-[#24263e] text-white'
                      : 'text-[#24263e]/70'
                      }`}
                  >
                    2. Kiểm định Hub{inspectorPhotos.length > 0 ? ` (${inspectorPhotos.length})` : ''}
                  </button>
                )}
                <button
                  onClick={() => setActivePhotoStage('handover')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${activePhotoStage === 'handover'
                    ? 'bg-[#24263e] text-white'
                    : 'text-[#24263e]/70'
                    }`}
                >
                  {hasInspection ? '3. Niêm phong giao' : '2. Niêm phong giao'}{handoverPhotos.length > 0 ? ` (${handoverPhotos.length})` : ''}
                </button>
              </div>
            </div>

            {currentPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {currentPhotos.map((photoUrl, idx) => (
                  <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden bg-[#faf8f5] border border-gray-200 group">
                    <img
                      src={photoUrl}
                      alt="Stage audit"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-1.5 left-1.5 bg-[#24263e]/85 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded border border-white/20 font-bold">
                      {activePhotoStage === 'listing' && (lang === 'vi' ? 'Ảnh rao bán' : 'Listing Photo')}
                      {activePhotoStage === 'inspector' && (lang === 'vi' ? 'Ảnh soi Hub' : 'Hub Inspect Photo')}
                      {activePhotoStage === 'handover' && (lang === 'vi' ? 'Ảnh niêm phong giao' : 'Handover Seal Photo')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              (() => {
                if (activePhotoStage === 'inspector') {
                  return (
                    <div className="py-7 px-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/40 flex flex-col items-center justify-center text-center">
                      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-2">
                        <Clock className="w-4 h-4 animate-pulse" />
                      </div>
                      <p className="text-xs font-bold text-amber-900">
                        {lang === 'vi' ? 'Chưa có ảnh kiểm định tại Hub' : 'Hub inspection photos pending'}
                      </p>
                      <p className="text-[11px] text-amber-700/80 max-w-sm mt-0.5">
                        {lang === 'vi'
                          ? 'Kỹ thuật viên phòng Lab sẽ chụp ảnh chi tiết ngoại quan, bo mạch và thông số kỹ thuật khi tiếp nhận máy kiểm định.'
                          : 'Lab technicians will capture detailed photos of cosmetic condition, motherboard, and component metrics during inspection.'}
                      </p>
                    </div>
                  );
                }

                if (activePhotoStage === 'handover') {
                  const sealId = detailInspectionDto?.tamperSealId ||
                    detailModalOrder.inspectionReport?.tamperSealId ||
                    (typeof window !== 'undefined' ? localStorage.getItem(`inspection_seal_${detailModalOrder.id}`) : null);

                  if (sealId) {
                    return (
                      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 flex-wrap">
                              <span>{lang === 'vi' ? 'Mã tem niêm phong:' : 'Tamper Seal ID:'}</span>
                              <span className="font-mono text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300 font-extrabold">{sealId}</span>
                            </div>
                            <p className="text-[11px] text-emerald-800/80">
                              {lang === 'vi'
                                ? 'Tem bảo mật NFC chống bóc tách, gắn kèm mã QR bảo đảm kiện hàng nguyên vẹn đến tay người mua.'
                                : 'Anti-tamper NFC security seal with encoded QR ensures the parcel remains intact to the buyer.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="py-7 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center">
                      <div className="w-9 h-9 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-500 mb-2">
                        <Shield className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        {lang === 'vi' ? 'Chưa bước vào giai đoạn niêm phong giao' : 'Handover & packaging stage pending'}
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">
                        {lang === 'vi'
                          ? 'Sau khi kiểm định ĐẠT CHUẨN, Hub sẽ dán tem niêm phong công nghệ cao và chụp ảnh kiện hàng trước khi bàn giao cho tài xế.'
                          : 'Upon passing inspection, Hub will apply the anti-tamper seal and record packaging photos prior to handover.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="py-6 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                    {lang === 'vi' ? 'Chưa có hình ảnh người bán cung cấp' : 'No listing photos available'}
                  </div>
                );
              })()
            )}
          </div>
        );
      })()}
    </>
  );
}
