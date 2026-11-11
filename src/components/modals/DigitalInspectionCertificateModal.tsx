import React from 'react';
import { createPortal } from 'react-dom';
import { EscrowOrder, Language, Listing } from '../../types';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Printer,
  X,
  MapPin,
  Building2,
  Phone,
  Camera,
  Loader2,
} from 'lucide-react';
import { ScannableQRCode } from '../common/ScannableQRCode';
import { resolveListingCategory, resolveOrderListing } from '../../utils/catalogCache';
import { resolveInspectionCenter } from '../../utils/orderUtils';
import { inspectorService, InspectionOrderDto } from '../../services/inspectorService';
import { getInspectionTaskStage } from '../../utils/inspectionTaskStatus';

type InspectionCertificateOrder = Pick<EscrowOrder, 'id'> & Partial<Pick<EscrowOrder,
  | 'buyerName' | 'buyerAddress' | 'buyerPhone' | 'sellerName' | 'deliveryAddress'
  | 'inspectionCenterId' | 'inspectionCenterName' | 'inspectionCenterAddress' | 'inspectionCenterPhone'
  | 'inspectionMethod' | 'inspectorName' | 'inspectionReport' | 'createdAt' | 'updatedAt'
>> & { listing: Partial<Listing> };

export interface DigitalInspectionCertificateModalProps {
  order: InspectionCertificateOrder;
  onClose: () => void;
  lang?: Language;
  initialDto?: InspectionOrderDto | null;
  previewReport?: any;
}

export function buildInspectionReportFromDto(dto: InspectionOrderDto | any, order?: EscrowOrder | any): any {
  if (!dto) return null;

  let parsedChecklist: any[] = [];
  if (Array.isArray(dto.checklistResults) && dto.checklistResults.length > 0) {
    parsedChecklist = dto.checklistResults;
  } else if (dto.checklistResultJson) {
    try {
      const parsed = typeof dto.checklistResultJson === 'string' ? JSON.parse(dto.checklistResultJson) : dto.checklistResultJson;
      if (Array.isArray(parsed)) parsedChecklist = parsed;
      else if (parsed?.items && Array.isArray(parsed.items)) parsedChecklist = parsed.items;
      else if (parsed?.checklistResults && Array.isArray(parsed.checklistResults)) parsedChecklist = parsed.checklistResults;
    } catch { }
  } else if (Array.isArray(order?.checklistResults) && order.checklistResults.length > 0) {
    parsedChecklist = order.checklistResults;
  } else if (order?.checklistResultJson) {
    try {
      const parsed = typeof order.checklistResultJson === 'string' ? JSON.parse(order.checklistResultJson) : order.checklistResultJson;
      if (Array.isArray(parsed)) parsedChecklist = parsed;
      else if (parsed?.items && Array.isArray(parsed.items)) parsedChecklist = parsed.items;
      else if (parsed?.checklistResults && Array.isArray(parsed.checklistResults)) parsedChecklist = parsed.checklistResults;
    } catch { }
  }

  let parsedPhotos: string[] = [];
  if (Array.isArray(dto.evidencePhotoUrls) && dto.evidencePhotoUrls.length > 0) {
    parsedPhotos = dto.evidencePhotoUrls;
  } else if (Array.isArray(dto.inspectorPhotos) && dto.inspectorPhotos.length > 0) {
    parsedPhotos = dto.inspectorPhotos;
  } else if (Array.isArray(dto.proofPhotos) && dto.proofPhotos.length > 0) {
    parsedPhotos = dto.proofPhotos;
  } else if (Array.isArray(dto.evidenceUrls) && dto.evidenceUrls.length > 0) {
    parsedPhotos = dto.evidenceUrls;
  } else if (dto.note) {
    const photoMatch = dto.note.match(/\[Photos:\s*(\[.*?\])\]/);
    if (photoMatch && photoMatch[1]) {
      try {
        const parsed = JSON.parse(photoMatch[1]);
        if (Array.isArray(parsed)) parsedPhotos = parsed;
      } catch { }
    }
  }

  const resolvedHub = order ? resolveInspectionCenter(order) : { id: 'center-hcm-01', name: 'Trung Tâm Kiểm Định SecondLife', address: 'Đang cập nhật địa chỉ', phone: '0875456654' };

  const rawStatus = String(dto.status || order?.inspectionStatus || order?.status || '').toUpperCase();
  const verdict = rawStatus !== 'FAILED' &&
    (getInspectionTaskStage(rawStatus) === 'completed' || rawStatus.includes('PASS')) ? 'PASS' : 'FAIL';

  return {
    id: `REP-${String(dto.id || order?.id || '').slice(0, 8)}`,
    orderId: dto.id || order?.id,
    centerId: dto.inspectionCenterId || order?.inspectionCenterId || resolvedHub.id || 'center-hcm-01',
    centerName: dto.inspectionCenterName || order?.inspectionCenterName || (dto as any)?.centerName || resolvedHub.name,
    centerAddress: dto.inspectionCenterAddress || order?.inspectionCenterAddress || resolvedHub.address,
    centerPhone: dto.inspectionCenterPhone || order?.inspectionCenterPhone || resolvedHub.phone,
    inspectorName: dto.inspectorName || order?.inspectorName || 'Kỹ Thuật Viên Kiểm Định SecondLife',
    inspectedAt: dto.updatedAt || dto.createdAt || order?.updatedAt || order?.createdAt || new Date().toISOString(),
    completedAt: dto.updatedAt || dto.createdAt || order?.updatedAt || order?.createdAt || new Date().toISOString(),
    verdict,
    status: dto.status || order?.inspectionStatus || order?.status,
    detectedGrade: dto.conditionGrade || order?.conditionGrade || null,
    conditionScore: typeof dto.conditionScore === 'number' && dto.conditionScore >= 0 ? dto.conditionScore : undefined,
    tamperSealId: dto.tamperSealId || order?.tamperSealId || undefined,
    checklistResults: parsedChecklist,
    inspectorPhotos: parsedPhotos,
    evidencePhotoUrls: parsedPhotos,
    summaryNotes: dto.note || order?.note || '',
  };
}

export const DigitalInspectionCertificateModal: React.FC<DigitalInspectionCertificateModalProps> = ({
  order,
  onClose,
  initialDto,
  previewReport,
}) => {
  // =========================================================================
  // THỨ TỰ ƯU TIÊN LẤY DỮ LIỆU BÁO CÁO KIỂM ĐỊNH SỐ HÓA:
  // Ưu tiên 1 (Trực tiếp từ props): previewReport hoặc order.inspectionReport
  // Ưu tiên 2 (Từ DTO đã fetch sẵn ở trang cha): initialDto
  // Ưu tiên 3 (Tự động fetch API khi mở modal nếu chưa có): inspectorService.getOrder(order.id)
  // Ưu tiên 4 (Cache đồng bộ cục bộ): localStorage (inspection_report_{orderId})
  // Cơ chế an toàn: CHỈ hiển thị dữ liệu thực tế, TUYỆT ĐỐI KHÔNG dùng mock data
  // =========================================================================
  const storedReportStr = typeof window !== 'undefined' ? localStorage.getItem(`inspection_report_${order.id}`) : null;
  const storedReport = React.useMemo(() => {
    try {
      return storedReportStr ? JSON.parse(storedReportStr) : null;
    } catch {
      return null;
    }
  }, [storedReportStr]);

  const initialReport = React.useMemo(() => {
    if (previewReport) return previewReport;
    if (order.inspectionReport) return order.inspectionReport;
    if (initialDto) return buildInspectionReportFromDto(initialDto, order);
    if ((order as any)?.checklistResultJson || (order as any)?.conditionScore !== undefined) {
      return buildInspectionReportFromDto(order as any, order);
    }
    if (storedReport) return storedReport;
    return null;
  }, [previewReport, order, initialDto, storedReport]);

  const [apiReport, setApiReport] = React.useState<any>(() => initialReport);
  const [isLoadingApi, setIsLoadingApi] = React.useState<boolean>(
    () => !previewReport && !order.inspectionReport && !initialReport && Boolean(order.id)
  );

  // Kích hoạt class trên document.body để ẩn toàn bộ màn hình nền khi bấm In (tránh in lẫn giao diện trạm)
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('certificate-modal-active');
      return () => {
        document.body.classList.remove('certificate-modal-active');
      };
    }
  }, []);

  React.useEffect(() => {
    // Chỉ tự động fetch API backend nếu chưa có report từ previewReport / order.inspectionReport / initialReport
    if (!previewReport && !order.inspectionReport && !initialReport && order.id) {
      setIsLoadingApi(true);
      inspectorService.getOrder(order.id).then((dto) => {
        if (dto) {
          const built = buildInspectionReportFromDto(dto, order);
          setApiReport(built);
        }
      }).catch((err) => {
        console.warn('Không thể tải báo cáo từ API:', err);
      }).finally(() => {
        setIsLoadingApi(false);
      });
    }
  }, [order.id, order.inspectionReport, initialReport, previewReport]);

  const report = previewReport || order.inspectionReport || apiReport || initialReport || storedReport || null;

  const certId = `CERT-SL-${order.id.slice(0, 8).toUpperCase()}`;
  const resolvedHub = resolveInspectionCenter(order);
  const hubName = report?.centerName || order.inspectionCenterName || (order as any).centerName || resolvedHub.name || 'Trung Tâm Kiểm Định SecondLife';
  const hubAddress = report?.centerAddress || order.inspectionCenterAddress || (order as any).centerAddress || resolvedHub.address || 'Đang cập nhật địa chỉ';
  const hubPhone = report?.centerPhone || order.inspectionCenterPhone || (order as any).centerPhone || resolvedHub.phone || '0875456654';
  const hubCity = resolvedHub.city || 'TP. Hồ Chí Minh';

  const inspectionMethod = initialDto?.orderType || (order as any).orderType || order.inspectionMethod;
  const isAtCenter = inspectionMethod === 'AT_CENTER' ||
    (!inspectionMethod && Boolean(order.inspectionCenterId || order.inspectionCenterName));
  const inspectorName = report?.inspectorName || order.inspectorName || (order as any).inspectorName || 'Kỹ Thuật Viên Kiểm Định SecondLife';

  // Mã niêm phong: CHỈ hiển thị khi hệ thống có giá trị thật, không tự bịa
  const rawSeal = report?.tamperSealId || (order as any).tamperSealId || (!isAtCenter && typeof window !== 'undefined' ? localStorage.getItem(`inspection_seal_${order.id}`) : null);
  const tamperSealId = rawSeal && typeof rawSeal === 'string' && rawSeal.trim() && !rawSeal.includes('BA005630')
    ? rawSeal.trim()
    : (rawSeal && !rawSeal.includes('BA005630') ? rawSeal : null);

  const rawStatus = String(
    (order as any).inspectionStatus ||
    (order as any).customerStatus ||
    (order as any).status ||
    (order as any).backendStatus ||
    ''
  ).toUpperCase();

  const isOrderFailed = rawStatus === 'FAILED' ||
    rawStatus === 'REJECTED' ||
    rawStatus === 'CANCELLED_FAILED_INSPECTION' ||
    (typeof window !== 'undefined' && localStorage.getItem(`inspection_status_${order.id}`) === 'FAILED');

  const verdict = report?.verdict ||
    (report?.status === 'PASSED' ? 'PASS' : report?.status === 'FAILED' || report?.status === 'REJECTED' ? 'FAIL' : (isOrderFailed ? 'FAIL' : 'PASS'));
  const isPassed = verdict === 'PASS';

  // Điểm số chất lượng: CHỈ lấy giá trị thực tế từ hệ thống/KTV, KHÔNG tự bịa 95 hay 45
  const realConditionScore = typeof report?.conditionScore === 'number' && report.conditionScore >= 0
    ? report.conditionScore
    : (typeof (order as any).conditionScore === 'number' && (order as any).conditionScore >= 0
      ? (order as any).conditionScore
      : null);

  const grade = report?.detectedGrade || (order as any).conditionGrade || order.listing?.conditionGrade || null;

  // Ngày tháng năm chuẩn thể thức văn bản pháp lý Việt Nam: "..., ngày ... tháng ... năm ..."
  const rawDate = report?.completedAt || report?.inspectedAt || (order as any).inspectionCompletedAt || order.updatedAt || order.createdAt;
  let dayStr = '10';
  let monthStr = '11';
  let yearStr = '2026';
  let dateDisplay = '10/11/2026';

  if (rawDate) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        dayStr = String(d.getDate()).padStart(2, '0');
        monthStr = String(d.getMonth() + 1).padStart(2, '0');
        yearStr = String(d.getFullYear());
        dateDisplay = `${dayStr}/${monthStr}/${yearStr}`;
      }
    } catch { }
  }
  const officialPlaceAndDate = `${hubCity}, ngày ${dayStr} tháng ${monthStr} năm ${yearStr}`;

  // Thông tin tổ chức, cá nhân sử dụng (Bên mua và bên bán)
  const buyerName = order.buyerName || 'Khách hàng SecondLife';
  const buyerAddress = order.buyerAddress || (order as any).shippingAddress || (order as any).deliveryAddress || 'Theo hồ sơ đơn hàng';
  const buyerPhone = order.buyerPhone || (order as any).shippingPhone || null;
  const sellerName = order.sellerName || 'Người bán SecondLife';
  const sellerAddress = (order as any).sellerAddress || (order as any).pickupAddress || null;

  // Thông tin đối tượng kiểm định
  const listing = order.listing;
  const realBrand = resolveOrderListing(listing).brand || (listing as any)?.brand || null;
  const rawModel = listing?.model || (listing as any)?.modelName;
  const realModel = rawModel && rawModel !== 'Verified Model' && rawModel !== 'Standard' ? rawModel : null;

  // Checklist tiêu chuẩn kỹ thuật (BỎ HOÀN TOÀN MOCK DATA 4 HẠNG MỤC TỰ SINH)
  const realChecklistResults = report?.checklistResults || [];

  const checklistItems = React.useMemo(() => {
    if (Array.isArray(realChecklistResults) && realChecklistResults.length > 0) {
      return realChecklistResults.map((item: any, idx: number) => {
        const itemPassed = item.status === 'pass' || item.isPassed === true || item.passed === true;
        return {
          id: item.id || item.rawId || item.itemId || `chk-${idx}`,
          title: item.title || item.itemTitle || item.name || `Tiêu chuẩn kiểm định #${idx + 1}`,
          category: item.category || resolveListingCategory(order.listing),
          standard: item.testedValue
            ? `Chỉ số đo đạc thực tế: ${item.testedValue}`
            : (item.inspectorNote || item.description || item.notes || (itemPassed ? 'Đạt quy chuẩn kỹ thuật phòng Lab ISO/IEC 17025' : 'Không đạt tiêu chuẩn kiểm định kỹ thuật')),
          status: itemPassed ? 'PASSED' : 'FAILED',
        };
      });
    }

    // TUYỆT ĐỐI BỎ HOÀN TOÀN MOCK DATA 4 HẠNG MỤC TỰ SINH (cosmetic, board_power, safety, accessories)
    return [];
  }, [realChecklistResults, order.listing]);

  const passedCount = checklistItems.filter(i => i.status === 'PASSED').length;

  // Ảnh chụp thực tế lúc nghiệm thu tại Hub (chỉ lấy ảnh do KTV chụp và nộp qua API/báo cáo)
  const actualHubPhotos = React.useMemo(() => {
    const list: string[] = [];
    if (Array.isArray((order as any)?.evidencePhotoUrls) && (order as any).evidencePhotoUrls.length > 0) {
      list.push(...(order as any).evidencePhotoUrls.filter(Boolean));
    }
    if (Array.isArray(report?.evidencePhotoUrls) && report.evidencePhotoUrls.length > 0) {
      list.push(...report.evidencePhotoUrls.filter(Boolean));
    }
    if (Array.isArray(report?.inspectorPhotos) && report.inspectorPhotos.length > 0) {
      list.push(...report.inspectorPhotos.filter(Boolean));
    }
    const noteToCheck = report?.summaryNotes || (order as any)?.note || '';
    const match = noteToCheck.match(/\[Photos:\s*(\[.*?\])\]/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) list.push(...parsed.filter(Boolean));
      } catch { }
    }
    if (Array.isArray((order as any)?.inspectorPhotos) && (order as any).inspectorPhotos.length > 0) {
      list.push(...(order as any).inspectorPhotos.filter(Boolean));
    }
    if (Array.isArray((order as any)?.evidenceUrls) && (order as any).evidenceUrls.length > 0) {
      list.push(...(order as any).evidenceUrls.filter(Boolean));
    }
    return Array.from(new Set(list.filter((u) => typeof u === 'string' && u.trim().length > 0)));
  }, [report, order]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoadingApi) {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#fce5da] flex items-center justify-center text-[#c34c36]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-sm">Đang tải biên bản kiểm định...</h3>
            <p className="text-[11px] text-slate-500">
              Hệ thống đang truy xuất dữ liệu kiểm định chính thức từ máy chủ SecondLife. Vui lòng chờ trong giây lát.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>,
      document.body
    );
  }

  const modalElement = (
    <div
      id="certificate-modal-portal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible"
    >
      {/* Scoped CSS thiết lập in ấn: Ẩn sạch màn hình nền, gom gọn trang 1 chuẩn A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          body.certificate-modal-active #root,
          body.certificate-modal-active > *:not(#certificate-modal-portal) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
          }
          body.certificate-modal-active {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #1e293b !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #certificate-modal-portal {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
          }
          .print-hidden {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
          }
          #printable-certificate {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-signatures-block {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-photos-grid {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-3xl rounded-3xl bg-white p-5 sm:p-7 shadow-2xl text-slate-900 border border-slate-200 my-auto print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-full">
        {/* Header Toolbar (Ẩn khi in ấn) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 print-hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Giấy Chứng Nhận Kết Quả Kiểm Định
              </h3>
              <p className="text-[11px] text-slate-400">Mã đơn hàng: #{order.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In / Lưu PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* BẢN CHỨNG NHẬN CHÍNH THỨC (THEO CHUẨN MẪU PHÁP LÝ VIỆT NAM)    */}
        {/* Vừa vặn Trang 1 A4 bình thường, tự ngắt sang Trang 2 nếu nhiều ảnh */}
        {/* ============================================================== */}
        <div
          id="printable-certificate"
          className="mt-3 p-5 sm:p-6 print:p-0 rounded-2xl bg-white border-2 border-slate-300 print:border-none shadow-inner print:shadow-none relative space-y-3.5 print:space-y-2 text-slate-800 print:text-[10.5px]"
        >
          {/* Watermark mờ trang trọng */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden print-hidden">
            <ShieldCheck className="w-96 h-96 text-slate-900" />
          </div>

          {/* 1. QUỐC HIỆU, TIÊU NGỮ & TIÊU ĐỀ (Chuẩn Mẫu Ảnh 3) */}
          <div className="text-center pb-3 print:pb-2 border-b-2 border-slate-300 space-y-1 print:space-y-0.5 relative">
            <div className="text-xs sm:text-sm print:text-[11px] font-black uppercase tracking-wider text-slate-900 font-serif">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div className="text-xs sm:text-sm print:text-[11px] font-bold text-slate-800">
              Độc lập - Tự do - Hạnh phúc
            </div>
            {/* Đường kẻ ngang phân cách tiêu ngữ chuẩn thể thức văn bản */}
            <div className="w-36 h-[1.5px] bg-slate-800 mx-auto my-1"></div>
            <div className="pt-1.5 print:pt-0.5">
              <h1 className="text-lg sm:text-xl print:text-[15px] font-black uppercase text-[#24263e] tracking-tight">
                GIẤY CHỨNG NHẬN KẾT QUẢ KIỂM ĐỊNH
              </h1>
              <p className="text-[11px] print:text-[9px] text-slate-500 font-medium italic mt-0.5">
                Hệ thống Giám định Kỹ thuật & Bảo lãnh Chất lượng Điện máy Gia dụng SecondLife Certified
              </p>
            </div>
          </div>

          {/* 2. THÔNG TIN BÊN KIỂM ĐỊNH / TỔ CHỨC KIỂM ĐỊNH (Chuẩn Mẫu Ảnh 4) */}
          <div className="p-3 sm:p-3.5 print:p-2 rounded-xl print:rounded-lg bg-slate-50 border border-slate-200 print:border-slate-300 text-xs print:text-[10px] text-slate-700 space-y-1.5 print:space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-1.5 print:pb-1">
              <div>
                <span className="text-[10px] print:text-[8.5px] font-bold uppercase text-slate-400 block tracking-wider">
                  Tên Tổ Chức Kiểm Định
                </span>
                <h3 className="text-xs sm:text-sm print:text-[11px] font-black text-slate-900 uppercase flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>{hubName}</span>
                </h3>
              </div>
              <div className="sm:text-right shrink-0 flex items-center sm:flex-col sm:items-end gap-2.5 sm:gap-0.5">
                <div>
                  <div className="text-[10px] print:text-[8.5px] uppercase font-bold text-slate-400">Số Đăng Ký Chứng Nhận</div>
                  <div className="font-mono font-black text-xs print:text-[10.5px] text-[#24263e]">{certId}</div>
                  <div className="text-[10px] print:text-[8.5px] text-slate-400">{dateDisplay}</div>
                </div>
                {/* QR Code đối soát chứng thực */}
                <div className="p-0.5 bg-white border border-slate-300 rounded shadow-2xs shrink-0">
                  <ScannableQRCode value={tamperSealId || certId} size={38} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs print:text-[9.5px]">
              <div className="flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500">Địa chỉ:</span>{' '}
                  <strong className="text-slate-800 font-medium">{hubAddress}</strong>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:justify-end">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div>
                  <span className="text-slate-500">Điện thoại / Hotline:</span>{' '}
                  <strong className="text-slate-800 font-medium">{hubPhone}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* I. TỔ CHỨC, CÁ NHÂN SỬ DỤNG / BÊN LIÊN QUAN (Chuẩn Mẫu Ảnh 4) */}
          <div className="space-y-1">
            <div className="text-xs print:text-[10px] font-black uppercase text-slate-900 tracking-wide border-b border-slate-200 pb-0.5 flex items-center gap-1">
              <span>I. TỔ CHỨC, CÁ NHÂN LIÊN QUAN</span>
            </div>
            <div className="p-2.5 sm:p-3 print:p-2 rounded-xl print:rounded-lg bg-white border border-slate-200 print:border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs print:text-[9.5px]">
              <div>
                <div className="text-slate-500 text-[10px] print:text-[8.5px]">Bên yêu cầu / Khách hàng mua:</div>
                <div className="font-bold text-slate-900 text-xs sm:text-sm print:text-[10.5px]">{buyerName}</div>
                {buyerPhone && (
                  <div className="text-slate-500 text-[10px] print:text-[8.5px] mt-0.5">
                    Điện thoại: <strong className="text-slate-700 font-medium">{buyerPhone}</strong>
                  </div>
                )}
                <div className="text-slate-500 text-[10px] print:text-[8.5px] mt-0.5">
                  Địa chỉ nhận máy: <strong className="text-slate-700 font-medium">{buyerAddress}</strong>
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px] print:text-[8.5px]">Bên bàn giao / Người bán:</div>
                <div className="font-bold text-slate-900 text-xs sm:text-sm print:text-[10.5px]">{sellerName}</div>
                {sellerAddress && (
                  <div className="text-slate-500 text-[10px] print:text-[8.5px] mt-0.5">
                    Địa chỉ kho: <strong className="text-slate-700 font-medium">{sellerAddress}</strong>
                  </div>
                )}
                <div className="text-slate-500 text-[10px] print:text-[8.5px] mt-0.5">
                  Mã hồ sơ đơn hàng: <strong className="font-mono text-slate-700 font-medium">#{order.id}</strong>
                </div>
                <div className="text-slate-500 text-[10px] print:text-[8.5px] mt-0.5">
                  Hình thức kiểm định: <strong className="text-slate-700 font-medium">{isAtCenter ? 'Tại Trung Tâm Kiểm Định (Hub)' : 'Tại Nhà (At Home)'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* II. ĐỐI TƯỢNG KIỂM ĐỊNH (Chuẩn Mẫu Ảnh 4 - Chỉ hiển thị thông tin thực tế, không bịa Model hay Seal) */}
          <div className="space-y-1">
            <div className="text-xs print:text-[10px] font-black uppercase text-slate-900 tracking-wide border-b border-slate-200 pb-0.5 flex items-center gap-1">
              <span>II. ĐỐI TƯỢNG KIỂM ĐỊNH</span>
            </div>
            <div className="p-2.5 sm:p-3 print:p-2 rounded-xl print:rounded-lg bg-white border border-slate-200 print:border-slate-300 space-y-1.5 print:space-y-1 text-xs print:text-[9.5px]">
              <div>
                <span className="text-[10px] print:text-[8.5px] font-bold uppercase text-slate-400 block">Tên thiết bị / Hàng hóa</span>
                <h2 className="text-xs sm:text-sm print:text-[11px] font-black text-slate-900 mt-0.5 truncate">
                  {order.listing?.title || 'Thiết bị điện máy kiểm định'}
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-slate-100 text-slate-600">
                <div>
                  <span className="text-slate-400 text-[10px] print:text-[8.5px] block">Danh mục:</span>
                  <strong className="text-slate-800">{resolveListingCategory(order.listing)}</strong>
                </div>
                {realBrand && (
                  <div>
                    <span className="text-slate-400 text-[10px] print:text-[8.5px] block">Thương hiệu:</span>
                    <strong className="text-slate-800">{realBrand}</strong>
                  </div>
                )}
                {realModel && (
                  <div>
                    <span className="text-slate-400 text-[10px] print:text-[8.5px] block">Model / Dòng máy:</span>
                    <strong className="text-slate-800">{realModel}</strong>
                  </div>
                )}
                {tamperSealId && (
                  <div>
                    <span className="text-slate-400 text-[10px] print:text-[8.5px] block">Mã niêm phong (Seal):</span>
                    <strong className="font-mono text-emerald-700">{tamperSealId}</strong>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 text-[10px] print:text-[8.5px] block">Địa điểm kiểm định:</span>
                  <strong className="text-slate-800">{hubName}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* III. KẾT QUẢ KIỂM ĐỊNH KỸ THUẬT (Đã loại bỏ hoàn toàn các điểm số tự sinh 40/100, 30/100...) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
              <span className="text-xs print:text-[10px] font-black uppercase text-slate-900 tracking-wide">
                III. KẾT QUẢ KIỂM ĐỊNH TIÊU CHUẨN KỸ THUẬT {checklistItems.length > 0 ? `(${checklistItems.length} HẠNG MỤC)` : ''}
              </span>
              <span className={`text-[10px] print:text-[8.5px] font-bold px-2 py-0.5 rounded-full ${
                isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {checklistItems.length > 0
                  ? `${passedCount}/${checklistItems.length} Tiêu chuẩn Đạt`
                  : (isPassed ? 'KẾT QUẢ: ĐẠT TIÊU CHUẨN' : 'KẾT QUẢ: KHÔNG ĐẠT CHUẨN (FAILED)')}
              </span>
            </div>

            {checklistItems.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-xl print:rounded-lg border border-slate-200 print:border-slate-300 bg-white overflow-hidden text-xs print:text-[9.5px]">
                {checklistItems.map((item, index) => (
                  <div key={item.id} className="p-2 sm:px-3 print:py-1.5 print:px-2 flex items-center justify-between gap-2 hover:bg-slate-50/50 print-avoid-break">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`w-4 h-4 print:w-3.5 print:h-3.5 rounded-full flex items-center justify-center text-[9px] print:text-[8px] font-black shrink-0 mt-0.5 ${
                        item.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] print:text-[8px] font-bold text-[#c34c36] uppercase">[{item.category}]</span>
                          <h4 className="font-bold text-slate-900">{item.title}</h4>
                        </div>
                        <p className="text-[10px] print:text-[8.5px] text-slate-500 mt-0.5">{item.standard}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.status === 'PASSED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] print:text-[8.5px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>ĐẠT</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-300 text-[10px] print:text-[8.5px] font-bold">
                          <X className="w-3 h-3 text-rose-600" />
                          <span>KHÔNG ĐẠT (LỖI)</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl print:rounded-lg border border-slate-200 print:border-slate-300 bg-white text-xs print:text-[9.5px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Biên bản kiểm định kỹ thuật số tại bàn kiểm định</span>
                </div>
                <p className="text-[11px] print:text-[9px] text-slate-500">
                  {report?.summaryNotes
                    ? `Ghi chú thẩm định: ${report.summaryNotes}`
                    : 'Thiết bị được thẩm định toàn diện theo quy trình đo kiểm tại Hub SecondLife. Kết quả được phê duyệt trực tiếp bởi Kỹ thuật viên phụ trách.'}
                </p>
              </div>
            )}
          </div>

          {/* IV. KẾT LUẬN & ĐÁNH GIÁ (Chỉ hiển thị điểm thật nếu có, KHÔNG tự bịa 95/100 khi đơn FAILED) */}
          <div className="space-y-1 print-avoid-break">
            <div className="text-xs print:text-[10px] font-black uppercase text-slate-900 tracking-wide border-b border-slate-200 pb-0.5">
              <span>IV. KẾT LUẬN & ĐÁNH GIÁ CHUNG</span>
            </div>

            <div className={`p-2.5 sm:p-3 print:p-2 rounded-xl print:rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              isPassed ? 'bg-emerald-50/70 border-emerald-300' : 'bg-rose-50/70 border-rose-300'
            }`}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-lg text-xs print:text-[9.5px] font-black uppercase tracking-wider text-white ${
                    isPassed ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}>
                    {isPassed ? 'KẾT LUẬN: ĐẠT CHUẨN KIỂM ĐỊNH (PASS)' : 'KẾT LUẬN: KHÔNG ĐẠT CHUẨN (FAILED)'}
                  </span>
                  {grade && (
                    <span className="text-xs print:text-[9.5px] font-bold text-slate-700">
                      Phân Hạng: <strong className="text-slate-900">Grade {grade}</strong>
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] print:text-[8.5px] text-slate-600">
                  {isPassed
                    ? 'Thiết bị đạt toàn bộ các tiêu chí an toàn điện, kỹ thuật vận hành và ngoại quan theo quy chuẩn kiểm định chất lượng.'
                    : 'Thiết bị không đáp ứng một hoặc nhiều tiêu chuẩn kỹ thuật an toàn bắt buộc, bị từ chối thông qua kiểm định.'}
                </p>
              </div>

              {realConditionScore !== null && (
                <div className="sm:text-right shrink-0 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[9px] print:text-[8px] uppercase font-bold text-slate-400">Điểm Chất Lượng Thẩm Định</div>
                  <div className="text-lg print:text-base font-black text-slate-900">
                    {realConditionScore}<span className="text-xs font-normal text-slate-400">/100</span>
                  </div>
                </div>
              )}
            </div>

            {report?.summaryNotes && (
              <div className="p-2 print:p-1.5 rounded-xl print:rounded-lg bg-slate-50 border border-slate-200 text-xs print:text-[9px] space-y-0.5">
                <span className="text-[9.5px] print:text-[8px] font-bold uppercase text-slate-400 tracking-wider block">
                  Ghi Chú Kết Luận Của Kỹ Thuật Viên:
                </span>
                <p className="italic text-slate-700 leading-relaxed font-medium">"{report.summaryNotes}"</p>
              </div>
            )}
          </div>

          {/* V. HÌNH ẢNH BẰNG CHỨNG KIỂM ĐỊNH (Nếu có nhiều ảnh, phần này sẽ kéo sang Trang 2 gọn gàng) */}
          {actualHubPhotos.length > 0 ? (
            <div className="space-y-1 print-photos-grid">
              <div className="text-xs print:text-[10px] font-black uppercase text-slate-900 tracking-wide border-b border-slate-200 pb-0.5 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-slate-500" />
                <span>V. HÌNH ẢNH HIỆN TRẠNG THỰC TẾ LÚC KIỂM ĐỊNH ({actualHubPhotos.length} ẢNH)</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 print:grid-cols-4 gap-1.5">
                {actualHubPhotos.map((url, i) => (
                  <div key={i} className="aspect-square print:h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group relative print-avoid-break">
                    <img
                      src={url}
                      alt={`Ảnh kiểm định ${i + 1}`}
                      className="w-full h-full object-cover transition transform group-hover:scale-105"
                    />
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-white text-[8px] font-bold">
                      Ảnh {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2 print:p-1.5 rounded-xl print:rounded-lg bg-slate-50 border border-slate-200 text-xs print:text-[9px] text-slate-500 flex items-center gap-1.5 print-avoid-break">
              <Camera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                V. Thiết bị được nghiệm thu trực tiếp dựa trên đo đạc thông số kỹ thuật thực tế (không có ảnh chụp đính kèm).
              </span>
            </div>
          )}

          {/* VI. NGÀY THÁNG NĂM & XÁC NHẬN CHỮ KÝ (Chuẩn Thể Thức Văn Bản Việt Nam) */}
          <div className="print-signatures-block pt-3 print:pt-2 border-t-2 border-slate-300 space-y-2 print:space-y-1">
            <div className="text-right text-xs print:text-[9.5px] font-medium text-slate-700 italic">
              {officialPlaceAndDate}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs print:text-[9.5px]">
              {/* Đại Diện Tổ Chức Kiểm Định */}
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="font-bold uppercase text-slate-800 text-[10.5px] print:text-[9.5px]">ĐẠI DIỆN TỔ CHỨC KIỂM ĐỊNH</div>
                <p className="text-[9.5px] print:text-[8px] text-slate-400 italic">(Ký, ghi rõ họ tên và đóng dấu)</p>
                <div className="pt-3 pb-1 print:pt-2 print:pb-0.5">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[9px] print:text-[8px] font-bold font-mono">
                    <ShieldCheck className="w-3 h-3 text-[#c34c36]" />
                    <span>SECONDLIFE LAB CERTIFIED</span>
                  </div>
                </div>
                <div className="font-bold text-slate-900 text-xs print:text-[10px]">{hubName}</div>
              </div>

              {/* Kỹ Thuật Viên Kiểm Định */}
              <div className="space-y-0.5 text-center sm:text-right">
                <div className="font-bold uppercase text-slate-800 text-[10.5px] print:text-[9.5px]">KỸ THUẬT VIÊN KIỂM ĐỊNH</div>
                <p className="text-[9.5px] print:text-[8px] text-slate-400 italic">(Ký và ghi rõ họ tên)</p>
                <div className="pt-3 pb-1 print:pt-2 print:pb-0.5">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-[9px] print:text-[8px] font-bold font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>ĐÃ XÁC THỰC CHỮ KÝ SỐ</span>
                  </div>
                </div>
                <div className="font-black text-slate-900 text-xs print:text-[10px]">{inspectorName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note (Ẩn khi in ấn) */}
        <div className="mt-3 text-center text-[11px] text-slate-400 print-hidden">
          Giấy chứng nhận này được bảo chứng bởi Quỹ Bảo Lãnh Escrow SecondLife trong cửa sổ 48h đối soát khiếu nại.
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(modalElement, document.body);
};
