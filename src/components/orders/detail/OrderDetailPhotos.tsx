import { Clock, Layers } from 'lucide-react';
import type { EscrowOrder, Language } from '../../../types';
import type { InspectionOrderDto } from '../../../services/inspectorService';
import type { OrderPhotoStage } from '../../../types/orders/orderTypes';
import { getInspectionReportMedia } from '../../../utils/inspectionDecisionData';
import { translations } from '../../../utils/translations';

interface Props {
  order: EscrowOrder;
  detailInspectionDto: InspectionOrderDto | null;
  sellerPostPhotos?: string[];
  activePhotoStage: OrderPhotoStage;
  setActivePhotoStage: (stage: OrderPhotoStage) => void;
  lang: Language;
}

function uniquePhotoUrls(urls: string[]) {
  return Array.from(new Set(urls
    .filter((url) => typeof url === 'string' && url.trim().length > 0)
    .map((url) => url.trim())));
}

export function OrderDetailPhotos({
  order: detailModalOrder,
  detailInspectionDto,
  sellerPostPhotos,
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
        const postPhotos = uniquePhotoUrls(sellerPostPhotos ?? []);
        const listingPhotos = postPhotos.length > 0 ? postPhotos : uniquePhotoUrls(rawListingPhotos);

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
        const inspectorPhotos = uniquePhotoUrls(rawInspectorPhotos);

        const currentPhotos = activePhotoStage === 'inspector' && hasInspection
          ? inspectorPhotos
          : listingPhotos;

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
                      {activePhotoStage === 'inspector' ? (lang === 'vi' ? 'Ảnh soi Hub' : 'Hub Inspect Photo') : (lang === 'vi' ? 'Ảnh rao bán' : 'Listing Photo')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              (() => {
                if (activePhotoStage === 'inspector' && hasInspection) {
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
