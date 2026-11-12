import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  EscrowOrder,
  Language,
  InspectionChecklistItem,
  ConditionGrade,
  UserProfile
} from '../types';
import { formatVND } from '../utils/translations';
import { getInspectionTaskStage } from '../utils/inspectionTaskStatus';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
  Barcode,
  Camera,
  Wrench,
  Search,
  Filter,
  Check,
  X,
  Printer,
  ChevronRight,
  ChevronLeft,
  Navigation,
  MapPin,
  Phone,
  Clock,
  Building2,
  Sparkles,
  FileText,
  UserCheck,
  RefreshCw,
  Loader2,
  Maximize2,
  Minimize2,
  Trash2,
  Eye,
  Info,
  Calendar,
  Layers,
  Cpu,
  Zap,
  Thermometer,
  ShieldAlert,
  ArrowRight,
  PackageCheck,
  Package,
  Lock
} from 'lucide-react';
import { inspectorService, InspectionOrderDto, InspectionChecklistResponse, SubmitInspectionReportRequest, mediaService } from '../services';
import { BarcodeScannerModal, playScanBeep } from '../components/modals/BarcodeScannerModal';
import { PrintTamperSealModal } from '../components/modals/PrintTamperSealModal';
import { InspectionSealVerificationModal } from '../components/modals/InspectionSealVerificationModal';
import { ScannableQRCode } from '../components/common/ScannableQRCode';
import { resolveListingCategory, resolveOrderListing } from '../utils/catalogCache';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';
import { getInspectionRemoteMediaUrl, isInspectionProofImage } from '../utils/inspectionDecisionData';
import { markListingInspectionPassed } from '../utils/listingInspection';
import { getAtHomeIntakeCode } from '../components/inspection/AtHomeIntakeBarcode';

interface ProductInspectionStationViewProps {
  orders: EscrowOrder[];
  currentUser?: UserProfile | null;
  onCompleteInspection: (
    orderId: string,
    verdict: 'PASS' | 'FAIL',
    tamperSeal: string,
    summary: string,
    meta?: {
      conditionScore?: number;
      conditionGrade?: ConditionGrade;
      checklistResults?: any[];
      inspectorPhotos?: string[];
      evidencePhotoUrls?: string[];
      inspectorNotes?: string;
      videoProofUrl?: string;
      unboxingVideoUrl?: string;
      order?: EscrowOrder;
    }
  ) => void;
  lang: Language;
  onNavigateToHub?: () => void;
  hideTopBar?: boolean;
  selectedOrderId?: string;
  onSelectOrder?: (orderId: string) => void;
  onResultSaved: (order: InspectionOrderDto) => void;
  initialStep?: InspectionStep;
}

export interface PhotoUploadItem {
  id: string;
  file?: File;
  previewUrl: string;
  remoteUrl?: string;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export type InspectionStep = 'intake' | 'exterior' | 'technical' | 'proofs' | 'verdict';

/**
 * Sinh mã tem niêm phong chuẩn SHA-256 khớp 100% với TamperSealServiceImpl của Backend:
 * Định dạng: SL-SEAL-{YYYYMMDD}-{6CHAR_HEX}-{2CHAR_CHECKSUM}
 */
export async function generateValidSealCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const hexChars = '0123456789ABCDEF';
  let randomCode = '';
  for (let i = 0; i < 6; i++) {
    randomCode += hexChars.charAt(Math.floor(Math.random() * 16));
  }

  const salt = 'SecondLife-TamperSeal-Salt-2026';
  const payloadToHash = `${dateStr}-${randomCode}-${salt}`;

  let checksum = '88';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(payloadToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      checksum = hashHex.substring(0, 2).toUpperCase();
    } catch { }
  }
  return `SL-SEAL-${dateStr}-${randomCode}-${checksum}`;
}

export const isOrderReceivedAtHub = (order: any): boolean => {
  if (!order) return false;
  if (order.inspectionMethod === 'AT_HOME' || order.orderType === 'AT_HOME') return true;
  const s = String(order.status || order.backendStatus || order.escrowStatus || '').toUpperCase();
  if (['RECEIVED_AT_CENTER', 'AWAITING_INSPECTION', 'INSPECTING', 'PASSED', 'FAILED', 'COMPLETED', 'DELIVERING_TO_BUYER', 'SHIPPED_TO_BUYER'].includes(s)) {
    return true;
  }
  if (typeof window !== 'undefined') {
    if (localStorage.getItem(`hub_package_received_${order.id}`) === 'true') {
      return true;
    }
  }
  return false;
};

export const isOrderInspectionCompleted = (order: any): boolean => {
  if (!order) return false;
  if (order.inspectionStatus) {
    const stage = getInspectionTaskStage(order.inspectionStatus);
    return stage === 'completed' || (stage === 'cancelled' && Boolean(order.inspectionReport));
  }
  const s = String(order.status || order.backendStatus || order.escrowStatus || '').toUpperCase();
  if (['PASSED', 'FAILED', 'COMPLETED', 'COMPLETED_RELEASED', 'DELIVERED_INSPECTION_WINDOW', 'INSPECTION_PASSED', 'INSPECTION_FAILED'].includes(s)) {
    return true;
  }
  if (Boolean(order.inspectionReport)) return true;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`inspection_status_${order.id}`);
    if (stored === 'PASSED' || stored === 'FAILED') return true;
  }
  return false;
};

function getStationReport(order: EscrowOrder) {
  if (order.inspectionStatus || order.inspectionReport) return order.inspectionReport;
  try {
    const stored = localStorage.getItem(`inspection_report_${order.id}`);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

export const ProductInspectionStationView: React.FC<ProductInspectionStationViewProps> = ({
  orders,
  currentUser,
  onCompleteInspection,
  lang,
  onNavigateToHub,
  hideTopBar = false,
  selectedOrderId: externalSelectedOrderId,
  onSelectOrder,
  onResultSaved,
  initialStep = 'intake',
}) => {
  // Current active technician
  const inspectorName = currentUser?.name || 'Kỹ thuật viên kiểm định';
  const inspectorCode = currentUser?.id ? `INS-${currentUser.id}` : 'INS-STAFF';

  // State: Active Order & Image Gallery
  const [selectedOrderId, setSelectedOrderId] = useState<string>(externalSelectedOrderId || '');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [barcodeScanInput, setBarcodeScanInput] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'intake' | 'serial' | 'tamper'>('intake');
  const [atHomeVerifyInput, setAtHomeVerifyInput] = useState('');

  useEffect(() => {
    if (externalSelectedOrderId) {
      setSelectedOrderId(externalSelectedOrderId);
      setCurrentStep('intake');
    } else if (externalSelectedOrderId === '') {
      setSelectedOrderId('');
    }
  }, [externalSelectedOrderId]);

  // Active Order (chỉ tải khi đã quét mã hoặc chọn đơn cụ thể, không tự ý nạp orders[0])
  const activeOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Danh sách hình ảnh bài đăng sản phẩm để KTV trực tiếp đối chiếu
  const productImages = useMemo(() => {
    if (!activeOrder) return [];
    const images: string[] = [];
    const anyOrder = activeOrder as any;
    const listing = activeOrder.listing as any;

    if (Array.isArray(anyOrder.postImageUrls) && anyOrder.postImageUrls.length > 0) {
      images.push(...anyOrder.postImageUrls.filter(Boolean));
    }
    if (anyOrder.postImageUrl) {
      images.push(anyOrder.postImageUrl);
    }
    if (Array.isArray(listing?.photoGallery) && listing.photoGallery.length > 0) {
      images.push(...listing.photoGallery.filter(Boolean));
    }
    if (Array.isArray(listing?.photos?.listingPhotos) && listing.photos.listingPhotos.length > 0) {
      images.push(...listing.photos.listingPhotos.filter(Boolean));
    }
    if (listing?.photos?.front) images.push(listing.photos.front);
    if (listing?.photos?.screenOrDetails) images.push(listing.photos.screenOrDetails);
    if (listing?.photos?.back) images.push(listing.photos.back);
    if (listing?.imageUrl) images.push(listing.imageUrl);
    if (anyOrder.imageUrl) images.push(anyOrder.imageUrl);

    return Array.from(new Set(images.filter((img) => typeof img === 'string' && img.trim().length > 0)));
  }, [activeOrder]);

  // Tự động chuyển về ảnh đầu tiên khi chuyển đơn hàng
  useEffect(() => {
    setActiveImageIndex(0);
  }, [activeOrder?.id]);

  const isAtHomeOrder = Boolean(activeOrder?.inspectionMethod === 'AT_HOME' || (activeOrder as any)?.orderType === 'AT_HOME');
  const isAtCenterOrder = !isAtHomeOrder;
  const [arrivedSignalTime, setArrivedSignalTime] = useState<string | null>(null);
  const isInspectorArrived = activeOrder ? Boolean(
    arrivedSignalTime ||
    (typeof window !== 'undefined' && localStorage.getItem(`at_home_inspector_arrived_${activeOrder.id}`)) ||
    activeOrder.inspectionStatus === 'INSPECTING' ||
    (activeOrder as any).status === 'INSPECTING' ||
    (activeOrder as any).backendStatus === 'INSPECTING'
  ) : false;
  const isCompletedOrder = Boolean(activeOrder && isOrderInspectionCompleted(activeOrder));

  // Stepper state - Bắt đầu từ Bước 1: Tiếp nhận (intake)
  const [currentStep, setCurrentStep] = useState<InspectionStep>(initialStep || 'intake');
  const [isFocusMode, setIsFocusMode] = useState(false);

  // --- STEP 1: INTAKE & PROFILE CHECK ---
  const [actualSerialNo, setActualSerialNo] = useState('');
  const [packagingStatus, setPackagingStatus] = useState<'INTACT' | 'SLIGHT_DAMAGE' | 'HEAVY_DAMAGE'>('INTACT');
  const [accessoriesNote, setAccessoriesNote] = useState('');

  // --- STEP 2: EXTERIOR & GRADING ---
  const [selectedGrade, setSelectedGrade] = useState<ConditionGrade>('Like New');
  const [exteriorScore, setExteriorScore] = useState<number>(95);
  const [exteriorNotes, setExteriorNotes] = useState('');

  // --- STEP 3: TECHNICAL CHECKLIST ---
  const [backendChecklist, setBackendChecklist] = useState<InspectionChecklistResponse | null>(null);
  const [checklist, setChecklist] = useState<InspectionChecklistItem[]>([]);
  const [checklistLoad, setChecklistLoad] = useState<{ orderId: string; message?: string } | null>(null);
  const [checklistRetry, setChecklistRetry] = useState(0);
  const isChecklistLoaded = Boolean(activeOrder && checklistLoad?.orderId === activeOrder.id);
  const canUseChecklist = isChecklistLoaded && checklist.length > 0;
  const listingCategory = resolveListingCategory(activeOrder?.listing);
  const selectedCategory = (isChecklistLoaded && (backendChecklist?.categoryName || backendChecklist?.itemName)) || listingCategory;

  const mapBackendItems = (
    res: InspectionChecklistResponse,
    orderId: string,
    fallbackCat: string
  ): InspectionChecklistItem[] => {
    return (res.items || []).map((item, idx) => {
      const orderIdx = item.orderIndex ?? (idx + 1);
      const uniqueId = item.id ? String(item.id) : `chk-ord-${orderId}-${orderIdx}-${idx}`;
      return {
        id: uniqueId,
        rawId: item.id || null,
        category: res.categoryName || res.itemName || fallbackCat,
        title: item.itemTitle || (item as any).name || `Tiêu chuẩn ${orderIdx}`,
        description: item.criteriaDescription || '',
        mandatory: item.mandatory !== false,
        status: 'pending' as const,
        orderIndex: orderIdx,
      };
    });
  };

  // --- STEP 4: PROOFS & SEALS ---
  const [tamperSealInput, setTamperSealInput] = useState(
    'SL-SEAL-' + Math.floor(1000000 + Math.random() * 9000000)
  );
  const [photoUploadItems, setPhotoUploadItems] = useState<PhotoUploadItem[]>([]);
  const proofPhotos = useMemo(
    () => photoUploadItems.filter((p) => p.status === 'success' && p.remoteUrl).map((p) => p.remoteUrl!),
    [photoUploadItems]
  );
  const [videoProofUrl, setVideoProofUrl] = useState('');
  const [unboxingVideoUrl, setUnboxingVideoUrl] = useState('');
  const [sealConfirmed, setSealConfirmed] = useState(false);
  const [isPrintSealModalOpen, setIsPrintSealModalOpen] = useState(false);
  const [isVerifySealModalOpen, setIsVerifySealModalOpen] = useState(false);
  const [verifySealId, setVerifySealId] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // --- STEP 5: VERDICT & SUMMARY ---
  const [overallVerdict, setOverallVerdict] = useState<'PASS' | 'FAIL'>('PASS');
  const [conditionScore, setConditionScore] = useState<number>(0);
  const [inspectorNotes, setInspectorNotes] = useState('');

  const dispatchNote = useMemo(() => {
    if (!activeOrder?.id) return '';
    try {
      const direct = localStorage.getItem(`order_dispatch_note_${activeOrder.id}`);
      if (direct) return direct;
      const raw = localStorage.getItem(`order_assigned_inspector_${activeOrder.id}`);
      return raw ? JSON.parse(raw)?.dispatchNote || '' : '';
    } catch {
      return '';
    }
  }, [activeOrder?.id]);

  const assignedSellerInfo = useMemo(() => {
    if (!activeOrder?.id) return null;
    try {
      const raw = localStorage.getItem(`order_assigned_inspector_${activeOrder.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          sellerAddress: parsed.sellerAddress,
          sellerPhone: parsed.sellerPhone,
          sellerName: parsed.sellerName,
        };
      }
    } catch {}
    return null;
  }, [activeOrder?.id]);

  const resolvedSellerAddress = useMemo(() => {
    return (
      assignedSellerInfo?.sellerAddress ||
      (activeOrder as any)?.sellerAddress ||
      activeOrder?.listing?.location ||
      (activeOrder as any)?.listing?.sellerAddress ||
      'Ngã tư Công Lý – Einstein, Công Lý, Phường Thủ Đức, Thành phố Hồ Chí Minh'
    );
  }, [assignedSellerInfo, activeOrder]);

  const resolvedSellerPhone = useMemo(() => {
    return (
      assignedSellerInfo?.sellerPhone ||
      (activeOrder as any)?.sellerPhone ||
      (activeOrder as any)?.seller?.phone ||
      '0918 234 567'
    );
  }, [assignedSellerInfo, activeOrder]);

  const resolvedSellerName = useMemo(() => {
    return (
      assignedSellerInfo?.sellerName ||
      (activeOrder as any)?.sellerName ||
      activeOrder?.sellerName ||
      'Thị Thùy Trang Nguyễn'
    );
  }, [assignedSellerInfo, activeOrder]);
  const [isDigitalSigned, setIsDigitalSigned] = useState(false);

  useEffect(() => {
    let active = true;
    if (activeOrder?.id && !isCompletedOrder) {
      if (isAtCenterOrder) {
        // Luồng tại trung tâm: gọi start với body rỗng.
        // Chỉ tiếp tục từ giao diện khi BE xác nhận trạng thái INSPECTING. Nếu gọi start lỗi, tải lại đơn.
        inspectorService.startInspection(activeOrder.id)
          .catch(async () => {
            try {
              const reloaded = await inspectorService.getOrder(activeOrder.id);
              if (active && reloaded && isOrderInspectionCompleted({ inspectionStatus: reloaded.status })) {
                onResultSaved(reloaded);
              }
            } catch { }
          });
      } else {
        void inspectorService.startInspection(activeOrder.id).catch(() => { });
      }
    }
    return () => { active = false; };
  }, [activeOrder?.id, isCompletedOrder, isAtCenterOrder]);

  // Load the saved report or the checklist assigned by the API.
  useEffect(() => {
    setChecklistLoad(null);
    setChecklist([]);
    setBackendChecklist(null);
    if (!activeOrder?.id) return;
    const orderId = activeOrder.id;

    const effectiveReport = getStationReport(activeOrder);

    // Nếu đơn hàng đã có biên bản kiểm định hoàn thành với checklistResults, tải lại chính xác
    if (effectiveReport?.checklistResults?.length) {
      setChecklist(
        effectiveReport.checklistResults.map((item: any, idx: number) => ({
          ...item,
          id: item.id || `chk-report-${idx}`,
          rawId: item.rawId ?? item.id,
        }))
      );
      setChecklistLoad({ orderId });
      return;
    }

    if (isCompletedOrder) {
      setChecklistLoad({ orderId, message: 'Biên bản chưa có kết quả checklist.' });
      return;
    }

    let active = true;
    inspectorService
      .getOrderChecklist(orderId)
      .then((res) => {
        if (!active) return;
        if (Array.isArray(res?.items) && res.items.length > 0) {
          setBackendChecklist(res);
          setChecklist(mapBackendItems(res, orderId, listingCategory));
          setChecklistLoad({ orderId });
        } else {
          setChecklistLoad({ orderId, message: 'Chưa có checklist cho đơn kiểm định này.' });
        }
      })
      .catch((err) => {
        if (active) setChecklistLoad({ orderId, message: err?.message || 'Không tải được checklist từ máy chủ.' });
      });
    return () => { active = false; };
  }, [activeOrder?.id, activeOrder?.inspectionReport?.checklistResults, isCompletedOrder, checklistRetry]);

  // Reset or populate fields when activeOrder changes
  useEffect(() => {
    if (activeOrder) {
      const effectiveReport = getStationReport(activeOrder);

      if (effectiveReport) {
        setActualSerialNo((effectiveReport as any).serialNumber || '');
        setAccessoriesNote((effectiveReport as any).accessoriesNote || '');
        setExteriorNotes((effectiveReport as any).exteriorNotes || '');
        setInspectorNotes(effectiveReport.summaryNotes || '');
        setOverallVerdict(effectiveReport.verdict || 'PASS');
        setConditionScore(effectiveReport.conditionScore || 90);
        setSelectedGrade(effectiveReport.detectedGrade || 'Like New');
        setTamperSealInput(effectiveReport.tamperSealId || ('SL-SEAL-' + Math.floor(1000000 + Math.random() * 9000000)));
        const repPhotos: string[] = (effectiveReport as any).evidencePhotoUrls?.length
          ? (effectiveReport as any).evidencePhotoUrls
          : (effectiveReport.inspectorPhotos || []);
        setPhotoUploadItems(
          repPhotos.map((url: string, i: number) => ({
            id: `rep-${i}`,
            previewUrl: url,
            remoteUrl: url,
            status: 'success',
          }))
        );
        setVideoProofUrl((activeOrder as any).videoProofUrl || (effectiveReport as any).videoProofUrl || '');
        setUnboxingVideoUrl((activeOrder as any).unboxingVideoUrl || (effectiveReport as any).unboxingVideoUrl || '');
        setSealConfirmed(true);
        setIsDigitalSigned(true);
        setCurrentStep('verdict');
      } else {
        setActualSerialNo('');
        setAccessoriesNote('');
        setExteriorNotes('');
        setInspectorNotes('');
        setConditionScore(0);
        setSelectedGrade('Like New');
        const ordPhotos: string[] = (activeOrder as any).evidencePhotoUrls?.length
          ? (activeOrder as any).evidencePhotoUrls
          : ((activeOrder as any).inspectorPhotos?.length ? (activeOrder as any).inspectorPhotos : []);
        if (ordPhotos.length > 0) {
          setPhotoUploadItems(
            ordPhotos.map((url: string, i: number) => ({
              id: `ord-${i}`,
              previewUrl: url,
              remoteUrl: url,
              status: 'success',
            }))
          );
        } else {
          setPhotoUploadItems([]);
        }
        setVideoProofUrl((activeOrder as any).videoProofUrl || '');
        setUnboxingVideoUrl((activeOrder as any).unboxingVideoUrl || '');
        setSealConfirmed(false);
        setIsDigitalSigned(false);
        setCurrentStep('intake');
      }
    }
  }, [activeOrder?.id]);

  // Submitting & Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingResult = useRef(false);
  const [isGeneratingSeal, setIsGeneratingSeal] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const livePreviewReport = useMemo(() => {
    if (!activeOrder) return null;
    const effectiveReport = getStationReport(activeOrder);
    if (isCompletedOrder && effectiveReport) return effectiveReport;
    const validPhotos = (proofPhotos || [])
      .map((p: any) => (typeof p === 'string' ? p : p?.url))
      .filter((u): u is string => Boolean(u && typeof u === 'string' && !u.startsWith('blob:') && !u.startsWith('data:')));
    return {
      id: `REP-${activeOrder.id.slice(0, 8)}`,
      orderId: activeOrder.id,
      centerId: activeOrder.inspectionCenterId || 'center-hcm-01',
      centerName: activeOrder.inspectionCenterName || 'Trung Tâm Kiểm Định SecondLife',
      inspectorName: inspectorName,
      inspectedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      verdict: overallVerdict,
      status: overallVerdict === 'PASS' ? 'PASSED' : 'FAILED',
      detectedGrade: selectedGrade,
      conditionScore: conditionScore,
      tamperSealId: isAtCenterOrder ? undefined : (tamperSealInput || undefined),
      checklistResults: checklist.map((item) => ({
        id: item.id,
        itemId: item.rawId ?? (item.id && !item.id.startsWith('chk-') ? item.id : null),
        itemTitle: item.title,
        category: item.category,
        passed: item.status === 'pass',
        isPassed: item.status === 'pass',
        testedValue: item.testedValue,
        notes: item.notes,
        inspectorNote: item.testedValue || item.notes,
      })),
      inspectorPhotos: validPhotos,
      evidencePhotoUrls: validPhotos,
      summaryNotes: inspectorNotes,
    };
  }, [activeOrder, isCompletedOrder, inspectorName, overallVerdict, selectedGrade, conditionScore, isAtCenterOrder, tamperSealInput, checklist, proofPhotos, inspectorNotes]);

  const handleGenerateBackendSeal = async () => {
    if (!activeOrder?.id) return;
    setIsGeneratingSeal(true);
    try {
      const res = await inspectorService.generateSeal(activeOrder.id);
      const sealId = typeof res === 'string' ? res : (res as any)?.tamperSealId || (res as any)?.data?.tamperSealId;
      if (sealId) {
        setTamperSealInput(sealId);
        notify(`Đã sinh mã tem niêm phong chuẩn từ hệ thống: ${sealId}`);
        return;
      }
      throw new Error('Không nhận được mã tem từ máy chủ');
    } catch (err: any) {
      console.warn('Backend generate-seal failed, generating valid SHA-256 seal fallback:', err);
      const fallbackSeal = await generateValidSealCode();
      setTamperSealInput(fallbackSeal);
      notify(`Đã cấp mã tem niêm phong chuẩn Checksum SHA-256: ${fallbackSeal}`);
    } finally {
      setIsGeneratingSeal(false);
    }
  };

  const notify = (text: string, isError = false) => {
    setNoticeMessage({ text: translateSystemNotification(text), isError });
    setTimeout(() => setNoticeMessage(null), 4500);
  };

  // Xử lý nạp đơn tự động khi quét barcode (Camera, máy quét USB, hoặc nhập tay)
  const handleProcessBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    playScanBeep();

    const normalized = code.toLowerCase();
    const cleanCode = normalized.replace(/^(sl-insp-|inspection-|order-|sl-athome-|athome-|#)/i, '').trim();

    const match = orders.find((o) => {
      const oId = o.id.toLowerCase();
      if (oId === normalized || oId === cleanCode) return true;
      if (cleanCode && (oId.startsWith(cleanCode) || oId.includes(cleanCode) || cleanCode.includes(oId))) return true;
      const intakeCode = getAtHomeIntakeCode(o.id).toLowerCase();
      if (intakeCode === normalized || intakeCode.includes(normalized) || normalized.includes(intakeCode)) return true;
      if (o.listingId && (o.listingId.toLowerCase().includes(cleanCode) || cleanCode.includes(o.listingId.toLowerCase()))) return true;
      if (o.listing?.title && o.listing.title.toLowerCase().includes(cleanCode)) return true;
      if (o.inspectionReport?.tamperSealId && (o.inspectionReport.tamperSealId.toLowerCase().includes(cleanCode) || cleanCode.includes(o.inspectionReport.tamperSealId.toLowerCase()))) return true;
      if (
        o.shippingLegs?.some(
          (leg) => leg.trackingNumber && (leg.trackingNumber.toLowerCase().includes(cleanCode) || cleanCode.includes(leg.trackingNumber.toLowerCase()))
        )
      ) {
        return true;
      }
      return false;
    });

    if (match) {
      setSelectedOrderId(match.id);
      onSelectOrder?.(match.id);
      setBarcodeScanInput(match.id);
      setCurrentStep('intake');

      const isAtHomeOrder = match.inspectionMethod === 'AT_HOME' || (match as any).orderType === 'AT_HOME';
      const arrivedAt = new Date().toISOString();
      setArrivedSignalTime(arrivedAt);
      try {
        localStorage.setItem(`at_home_inspector_arrived_${match.id}`, arrivedAt);
        localStorage.setItem(`order_inspecting_${match.id}`, 'true');
        localStorage.setItem(`inspection_status_${match.id}`, 'INSPECTING');
        window.dispatchEvent(new CustomEvent('secondlife_inspector_arrived', {
          detail: { orderId: match.id, arrivedAt }
        }));
        window.dispatchEvent(new StorageEvent('storage', {
          key: `at_home_inspector_arrived_${match.id}`,
          newValue: arrivedAt
        }));
      } catch (err) {
        console.warn('Failed to record inspector arrival:', err);
      }

      notify(
        isAtHomeOrder
          ? `[Xác Thực Tại Nhà] Đã quét nhận diện mã "${code}" thành công! Kỹ thuật viên đã đến và đang kiểm tra thiết bị #${match.id.slice(0, 8)}.`
          : `[Auto-Intake] Đã quét nhận diện "${code}" -> Nạp thành công đơn kiểm định #${match.id.slice(0, 8)} (${match.listing?.title || 'Thiết bị'})!`
      );
    } else {
      setBarcodeScanInput(code);
      notify(`Đã quét mã: "${code}" (Không tìm thấy đơn hàng tương ứng trong ca trực)`, true);
    }
  };

  // Xác thực mã tiếp nhận tại nhà từ Người bán đưa cho KTV
  const handleVerifyAtHomeIntake = (order: EscrowOrder) => {
    const entered = (atHomeVerifyInput || '').trim().toLowerCase();
    const expectedIntake = getAtHomeIntakeCode(order.id).toLowerCase();
    const shortId = order.id.slice(0, 8).toLowerCase();

    if (!entered || entered === expectedIntake || entered.includes(shortId) || expectedIntake.includes(entered) || order.id.toLowerCase().includes(entered)) {
      playScanBeep();
      const arrivedAt = new Date().toISOString();
      setArrivedSignalTime(arrivedAt);
      try {
        localStorage.setItem(`at_home_inspector_arrived_${order.id}`, arrivedAt);
        localStorage.setItem(`order_inspecting_${order.id}`, 'true');
        localStorage.setItem(`inspection_status_${order.id}`, 'INSPECTING');
        window.dispatchEvent(new CustomEvent('secondlife_inspector_arrived', {
          detail: { orderId: order.id, arrivedAt }
        }));
        window.dispatchEvent(new StorageEvent('storage', {
          key: `at_home_inspector_arrived_${order.id}`,
          newValue: arrivedAt
        }));
      } catch (err) {
        console.warn('Failed to record inspector arrival:', err);
      }
      notify(`[Xác Thực Tại Nhà] Kỹ thuật viên đã xác nhận có mặt tại nhà và đang kiểm tra thiết bị #${order.id.slice(0, 8)}.`);
      setAtHomeVerifyInput('');
    } else {
      notify(`Mã tiếp nhận "${atHomeVerifyInput}" không khớp với đơn hàng #${order.id.slice(0, 8)}. Vui lòng kiểm tra lại.`, true);
    }
  };

  // Điều hướng quét mã linh hoạt theo mục tiêu
  const handleScanCode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    if (scannerMode === 'serial') {
      playScanBeep();
      setActualSerialNo(code);
      notify(`Đã quét & cập nhật số Serial/IMEI máy: ${code}`);
    } else if (scannerMode === 'tamper') {
      playScanBeep();
      setTamperSealInput(code);
      notify(`Đã quét & ghi nhận mã tem niêm phong: ${code}`);
    } else {
      handleProcessBarcode(code);
    }
  };

  // Toggle checklist item
  const handleToggleChecklist = (id: string, status: 'pass' | 'fail') => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  // Update tested value on checklist item
  const handleUpdateTestedValue = (id: string, value: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, testedValue: value } : item))
    );
  };

  // Add proof photo
  const handleAddProofPhoto = (url: string) => {
    setPhotoUploadItems((prev) => {
      if (prev.some((p) => p.remoteUrl === url)) return prev;
      return [...prev, { id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, previewUrl: url, remoteUrl: url, status: 'success' }];
    });
    notify('Đã thêm ảnh bằng chứng kiểm nghiệm');
  };

  const handleRemovePhoto = (idxOrId: number | string) => {
    setPhotoUploadItems((prev) => {
      const item = typeof idxOrId === 'number' ? prev[idxOrId] : prev.find((p) => p.id === idxOrId);
      if (item?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return typeof idxOrId === 'number' ? prev.filter((_, i) => i !== idxOrId) : prev.filter((p) => p.id !== idxOrId);
    });
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f && f.type.startsWith('image/'));
    if (fileList.length === 0) return;

    if (photoUploadItems.length + fileList.length > 10) {
      notify(`Chỉ được tải lên tối đa 10 ảnh bằng chứng (hiện có ${photoUploadItems.length} ảnh, bạn chọn thêm ${fileList.length} ảnh)!`, true);
      return;
    }

    const newItems: PhotoUploadItem[] = fileList.map((file) => ({
      id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
    }));

    setPhotoUploadItems((prev) => [...prev, ...newItems]);
    setIsUploadingPhoto(true);

    try {
      if (fileList.length === 1) {
        const item = newItems[0];
        try {
          const res = await mediaService.uploadImage(item.file!, 'secondlife/inspections/proofs');
          const uploadedUrl = (res as any)?.url || (res as any)?.data?.url;
          if (uploadedUrl) {
            setPhotoUploadItems((prev) =>
              prev.map((p) => (p.id === item.id ? { ...p, status: 'success', remoteUrl: uploadedUrl, errorMessage: undefined } : p))
            );
            notify('Đã tải ảnh bằng chứng lên máy chủ thành công');
          } else {
            throw new Error('Máy chủ không trả về URL ảnh');
          }
        } catch (uploadErr: any) {
          setPhotoUploadItems((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: 'error', errorMessage: uploadErr?.message || 'Tải ảnh thất bại' } : p))
          );
          notify(uploadErr?.message || 'Tải ảnh thất bại', true);
        }
      } else {
        try {
          const resList = await mediaService.uploadMultipleImages(fileList, 'secondlife/inspections/proofs');
          const urlList = Array.isArray(resList) ? resList.map((r: any) => r?.url || r?.data?.url || r).filter(Boolean) : [];
          setPhotoUploadItems((prev) =>
            prev.map((p) => {
              const matchedIdx = newItems.findIndex((ni) => ni.id === p.id);
              if (matchedIdx !== -1) {
                const url = urlList[matchedIdx];
                if (url && typeof url === 'string') {
                  return { ...p, status: 'success', remoteUrl: url, errorMessage: undefined };
                } else {
                  return { ...p, status: 'error', errorMessage: 'Lỗi tải ảnh lên máy chủ' };
                }
              }
              return p;
            })
          );
          notify(`Đã tải lên ${urlList.length}/${fileList.length} ảnh bằng chứng`);
        } catch (multiErr: any) {
          for (const item of newItems) {
            try {
              const res = await mediaService.uploadImage(item.file!, 'secondlife/inspections/proofs');
              const url = (res as any)?.url || (res as any)?.data?.url;
              if (url) {
                setPhotoUploadItems((prev) =>
                  prev.map((p) => (p.id === item.id ? { ...p, status: 'success', remoteUrl: url, errorMessage: undefined } : p))
                );
              } else {
                throw new Error('Không nhận được URL');
              }
            } catch (singleErr: any) {
              setPhotoUploadItems((prev) =>
                prev.map((p) => (p.id === item.id ? { ...p, status: 'error', errorMessage: singleErr?.message || 'Lỗi tải ảnh' } : p))
              );
            }
          }
        }
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRetryUpload = async (id: string) => {
    const target = photoUploadItems.find((p) => p.id === id);
    if (!target || !target.file) return;

    setPhotoUploadItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'uploading', errorMessage: undefined } : p))
    );

    try {
      const res = await mediaService.uploadImage(target.file, 'secondlife/inspections/proofs');
      const uploadedUrl = (res as any)?.url || (res as any)?.data?.url;
      if (uploadedUrl) {
        setPhotoUploadItems((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'success', remoteUrl: uploadedUrl, errorMessage: undefined } : p))
        );
        notify('Đã tải lại ảnh thành công!');
      } else {
        throw new Error('Máy chủ không trả về URL ảnh');
      }
    } catch (err: any) {
      setPhotoUploadItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'error', errorMessage: err?.message || 'Tải ảnh thất bại' } : p))
      );
      notify(err?.message || 'Tải ảnh thất bại, vui lòng thử lại', true);
    }
  };

  const handleUploadProofPhoto = async (file: File) => {
    return handleUploadFiles([file]);
  };

  // Submit Final Result
  const handleSubmitInspection = async () => {
    if (submittingResult.current) return;
    if (!activeOrder) {
      notify('Không tìm thấy thông tin đơn hàng cần thẩm định', true);
      return;
    }

    if (isOrderInspectionCompleted(activeOrder)) {
      notify('Đơn hàng này đã có kết quả kiểm định chính thức, không thể kiểm định lại.', true);
      return;
    }

    if (!canUseChecklist) {
      notify('Cần tải checklist của đơn trước khi nộp biên bản.', true);
      return;
    }

    const pendingMandatory = checklist.filter((item) => item.mandatory && item.status === 'pending');
    if (pendingMandatory.length > 0) {
      notify(`Vui lòng đánh giá tất cả ${pendingMandatory.length} tiêu chuẩn bắt buộc (*) trước khi nộp biên bản!`, true);
      return;
    }

    const hasFailedMandatory = checklist.some((item) => item.mandatory && item.status !== 'pass');
    if (overallVerdict === 'PASS' && hasFailedMandatory) {
      notify('Không thể kết luận ĐẠT (PASSED) khi có tiêu chí bắt buộc không đạt yêu cầu.', true);
      return;
    }

    // Với AT_CENTER: kiểm tra số lượng ảnh hợp lệ 1-10
    const validEvidencePhotoUrls = proofPhotos
      .map((url) => url.trim())
      .filter((url) => getInspectionRemoteMediaUrl(url) || isInspectionProofImage(url));

    if (isAtCenterOrder) {
      if (validEvidencePhotoUrls.length < 1 || validEvidencePhotoUrls.length > 10) {
        notify('Yêu cầu từ 1 đến 10 ảnh bằng chứng đã upload thành công lên máy chủ trước khi nộp!', true);
        return;
      }
    }

    let effectiveSeal = tamperSealInput;
    if (!isAtCenterOrder) {
      if (!effectiveSeal) {
        effectiveSeal = 'SL-SEAL-' + Math.floor(1000000 + Math.random() * 9000000);
        setTamperSealInput(effectiveSeal);
      }
      setSealConfirmed(true);
    }
    setIsDigitalSigned(true);

    submittingResult.current = true;
    setIsSubmitting(true);
    try {
      // 1. Đảm bảo đơn đã chuyển sang trạng thái INSPECTING trên backend trước khi submit
      try {
        await inspectorService.startInspection(activeOrder.id).catch(() => { });
      } catch { }

      // 2. Nộp kết quả thẩm định lên backend API
      const persistedVideoUrl = isAtHomeOrder ? getInspectionRemoteMediaUrl(videoProofUrl) : undefined;
      const persistedUnboxingUrl = isAtHomeOrder ? getInspectionRemoteMediaUrl(unboxingVideoUrl) : undefined;

      const payload: SubmitInspectionReportRequest = isAtCenterOrder ? {
        status: overallVerdict === 'PASS' ? 'PASSED' : 'FAILED',
        note: inspectorNotes.trim() || undefined,
        conditionScore,
        conditionGrade: selectedGrade,
        checklistResults: checklist.map((item) => ({
          itemId: item.rawId ?? (item.id && !item.id.startsWith('chk-') ? item.id : null),
          itemTitle: item.title,
          passed: item.status === 'pass',
          isPassed: item.status === 'pass',
          inspectorNote: (item.testedValue || item.notes || '').slice(0, 4000) || undefined,
        })),
        evidencePhotoUrls: validEvidencePhotoUrls,
      } : {
        status: overallVerdict === 'PASS' ? 'PASSED' : 'FAILED',
        note: `[Tem: ${effectiveSeal}][Grade: ${selectedGrade}][Điểm: ${conditionScore}/100][Bao bì: ${packagingStatus === 'INTACT' ? 'Nguyên vẹn' : packagingStatus === 'SLIGHT_DAMAGE' ? 'Hơi móp méo' : 'Hư hại'}]${accessoriesNote ? ` [Phụ kiện: ${accessoriesNote}]` : ''}${validEvidencePhotoUrls.length > 0 ? ` [Photos: ${JSON.stringify(validEvidencePhotoUrls)}]` : ''} ${inspectorNotes}`,
        conditionScore,
        conditionGrade: selectedGrade,
        tamperSealId: effectiveSeal,
        barcode: barcodeScanInput || `BC-${activeOrder.id}`,
        videoProofUrl: persistedVideoUrl || undefined,
        unboxingVideoUrl: persistedUnboxingUrl || undefined,
        proofPhotos: validEvidencePhotoUrls,
        inspectorPhotos: validEvidencePhotoUrls,
        evidenceUrls: validEvidencePhotoUrls,
        evidencePhotoUrls: validEvidencePhotoUrls,
        checklistResults: checklist.map((item) => ({
          itemId: item.rawId ?? (item.id && !item.id.startsWith('chk-') ? item.id : null),
          itemTitle: item.title,
          passed: item.status === 'pass',
          isPassed: item.status === 'pass',
          inspectorNote: (item.testedValue || item.notes || '').slice(0, 4000) || undefined,
        })),
      };

      const submittedDto = await inspectorService.submitReport(activeOrder.id, payload);
      if (!submittedDto?.id || !isOrderInspectionCompleted({ inspectionStatus: submittedDto.status })) {
        throw new Error('BE chưa xác nhận biên bản kiểm định đã được phát hành.');
      }
      onResultSaved(submittedDto);

      // 3. Hoàn tất kiểm định trong state ứng dụng và localStorage
      try {
        const resultStatus = overallVerdict === 'PASS' ? 'PASSED' : 'FAILED';
        localStorage.setItem(`inspection_status_${activeOrder.id}`, resultStatus);
        if (overallVerdict === 'PASS') {
          markListingInspectionPassed(
            (activeOrder as any).postId || activeOrder.listing?.id || (activeOrder as any).listingId,
            activeOrder.listing?.title || (activeOrder as any).postTitle || (activeOrder as any).title
          );
        }
        if (!isAtCenterOrder) {
          localStorage.setItem(`inspection_seal_${activeOrder.id}`, effectiveSeal);
        }

        const fullReport = {
          id: `REP-${Math.floor(1000 + Math.random() * 9000)}`,
          orderId: activeOrder.id,
          centerId: activeOrder.inspectionCenterId || 'center-hcm-01',
          centerName: activeOrder.inspectionCenterName || 'SecondLife Hub Flagship Lab',
          inspectorName: inspectorName,
          inspectedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          verdict: overallVerdict,
          status: resultStatus,
          detectedGrade: selectedGrade,
          conditionScore: conditionScore,
          tamperSealId: isAtCenterOrder ? undefined : effectiveSeal,
          checklistResults: checklist.map((item) => ({
            id: item.id,
            rawId: item.rawId,
            category: item.category || selectedCategory,
            title: item.title,
            description: item.description || '',
            status: item.status === 'pass' ? 'pass' : 'fail',
            notes: item.notes,
            testedValue: item.testedValue,
          })),
          inspectorPhotos: validEvidencePhotoUrls,
          evidencePhotoUrls: validEvidencePhotoUrls,
          summaryNotes: isAtCenterOrder ? inspectorNotes : `[Grade: ${selectedGrade}][Điểm: ${conditionScore}/100] ${inspectorNotes}`,
        };
        localStorage.setItem(`inspection_report_${activeOrder.id}`, JSON.stringify(fullReport));

        window.dispatchEvent(new CustomEvent('secondlife_inspection_completed', {
          detail: { orderId: activeOrder.id, status: resultStatus }
        }));
      } catch { }

      onCompleteInspection(
        activeOrder.id,
        overallVerdict,
        isAtCenterOrder ? '' : effectiveSeal,
        isAtCenterOrder ? inspectorNotes : `[Grade: ${selectedGrade}][Điểm: ${conditionScore}/100] ${inspectorNotes}`,
        {
          conditionScore,
          conditionGrade: selectedGrade,
          checklistResults: checklist.map((item) => ({
            id: item.id,
            rawId: item.rawId,
            category: item.category,
            title: item.title,
            description: item.description || '',
            status: item.status === 'pass' ? 'pass' : 'fail',
            notes: item.notes,
            testedValue: item.testedValue,
          })),
          inspectorPhotos: validEvidencePhotoUrls,
          evidencePhotoUrls: validEvidencePhotoUrls,
          inspectorNotes,
          videoProofUrl: persistedVideoUrl,
          unboxingVideoUrl: persistedUnboxingUrl,
          order: {
            ...activeOrder,
            ...(submittedDto || {}),
          },
        }
      );

      notify(
        isAtCenterOrder
          ? `Đã thẩm định thành công đơn #${activeOrder.id}! Biên bản kiểm định đã được nộp thành công.`
          : `Đã thẩm định thành công đơn #${activeOrder.id}! Báo cáo số hóa đã cấp và niêm phong bằng tem ${effectiveSeal}.`
      );
    } catch (err: any) {
      console.error('Lỗi khi nộp biên bản kiểm định:', err);
      // Xử lý mất mạng hoặc lỗi: Đọc lại chi tiết đơn để xác định kết quả trước khi cho thử lại
      try {
        const reloaded = await inspectorService.getOrder(activeOrder.id);
        if (reloaded && isOrderInspectionCompleted({ inspectionStatus: reloaded.status })) {
          notify(`Đơn hàng #${activeOrder.id} đã được hệ thống lưu kết quả thành công!`);
          onResultSaved(reloaded);
          return;
        }
      } catch { }
      notify(err?.message || 'Không thể lưu biên bản kiểm định lên hệ thống. Vui lòng kiểm tra lại ảnh hoặc kết nối.', true);
    } finally {
      submittingResult.current = false;
      setIsSubmitting(false);
    }
  };

  const stepsList: { key: InspectionStep; title: string; desc: string; icon: any }[] = [
    { key: 'intake', title: '1. Tiếp Nhận', desc: 'Đối chiếu hồ sơ máy', icon: QrCode },
    { key: 'exterior', title: '2. Ngoại Quan', desc: 'Phân hạng Grade vỏ máy', icon: Layers },
    { key: 'technical', title: '3. Kỹ Thuật', desc: 'Đo đạc & Test chức năng', icon: Wrench },
    {
      key: 'proofs',
      title: isAtCenterOrder ? '4. Ảnh Bằng Chứng' : '4. Bằng Chứng & Niêm Phong',
      desc: isAtCenterOrder ? 'Ảnh chụp hiện trạng máy' : 'Ảnh soi vi mạch & Dán tem',
      icon: Camera,
    },
    { key: 'verdict', title: '5. Kết Luận', desc: 'Ký số & Xuất chứng thư', icon: ShieldCheck },
  ];

  // Thứ tự bắt buộc tuần tự 5 bước
  const STEP_ORDER: InspectionStep[] = ['intake', 'exterior', 'technical', 'proofs', 'verdict'];

  // Bước cao nhất đã mở khóa cho đơn hàng hiện tại (0: intake, 1: exterior, 2: technical, 3: proofs, 4: verdict)
  const [maxReachedStepIndex, setMaxReachedStepIndex] = useState<number>(0);

  // Tự động đồng bộ bước khi đổi đơn hàng
  useEffect(() => {
    if (isOrderInspectionCompleted(activeOrder)) {
      setMaxReachedStepIndex(4);
    } else {
      setMaxReachedStepIndex(0);
      setCurrentStep('intake');
    }
  }, [activeOrder?.id]);

  // Điều hướng có kiểm soát không cho nhảy cóc các bước
  const handleSelectStep = (targetStep: InspectionStep) => {
    const targetIdx = STEP_ORDER.indexOf(targetStep);
    const isCompleted = isOrderInspectionCompleted(activeOrder);

    if (!isCompleted && targetIdx > maxReachedStepIndex) {
      notify(`Không thể nhảy cóc sang "${stepsList[targetIdx]?.title || 'bước này'}"! Quy trình kiểm định yêu cầu hoàn thành tuần tự từ Bước 1 đến Bước 5.`, true);
      return;
    }
    setCurrentStep(targetStep);
  };

  // Chuyển sang bước tiếp theo tuần tự
  const handleNextStep = (nextStep: InspectionStep) => {
    const nextIdx = STEP_ORDER.indexOf(nextStep);

    // Kiểm tra điều kiện bắt buộc ở Bước 3 Kỹ thuật: phải hoàn thành các tiêu chuẩn bắt buộc (*)
    if (currentStep === 'technical' && !isCompletedOrder) {
      if (!canUseChecklist) {
        notify('Cần tải checklist của đơn trước khi chuyển bước.', true);
        return;
      }
      const pendingMandatory = checklist.filter((item) => item.mandatory && item.status === 'pending');
      if (pendingMandatory.length > 0) {
        notify(`Vui lòng kiểm tra và đánh giá tất cả ${pendingMandatory.length} tiêu chuẩn bắt buộc (*) trước khi sang Bước 4!`, true);
        return;
      }
    }

    if (currentStep === 'proofs' && !isCompletedOrder) {
      if (isAtCenterOrder) {
        if (proofPhotos.length < 1) {
          notify('Vui lòng tải lên ít nhất 1 ảnh bằng chứng hiện trạng trước khi chuyển sang Bước 5!', true);
          return;
        }
        if (proofPhotos.length > 10) {
          notify('Tối đa 10 ảnh bằng chứng được phép nộp!', true);
          return;
        }
      } else {
        if (proofPhotos.length === 0) {
          notify('Vui lòng thêm ảnh bằng chứng trước khi chuyển bước!', true);
          return;
        }
        if (!sealConfirmed) {
          notify('Vui lòng xác nhận đã dán tem niêm phong trước khi chuyển sang Bước 5!', true);
          return;
        }
      }
    }

    if (nextIdx > maxReachedStepIndex) {
      setMaxReachedStepIndex(nextIdx);
    }
    setCurrentStep(nextStep);
  };

  // Kiểm tra một bước đã hoàn thành để hiển thị tích Xanh báo hiệu đã ổn
  const isStepCompleted = (stepKey: InspectionStep, idx: number): boolean => {
    const isCompleted = isOrderInspectionCompleted(activeOrder);
    if (isCompleted) return true;

    // Nếu KTV đã hoàn thành bước này và tiến tới các bước tiếp theo
    if (idx < maxReachedStepIndex) return true;

    // Hoặc kiểm tra điều kiện hoàn thành của bước hiện tại:
    switch (stepKey) {
      case 'intake':
        return maxReachedStepIndex > 0;
      case 'exterior':
        return maxReachedStepIndex > 1;
      case 'technical': {
        const pendingMandatory = checklist.filter((item) => item.mandatory && item.status === 'pending');
        return canUseChecklist && (maxReachedStepIndex > 2 || pendingMandatory.length === 0);
      }
      case 'proofs':
        if (isAtCenterOrder) {
          return maxReachedStepIndex > 3 || (proofPhotos.length >= 1 && proofPhotos.length <= 10);
        }
        return maxReachedStepIndex > 3 || (proofPhotos.length > 0 && sealConfirmed);
      case 'verdict':
        if (isAtCenterOrder) {
          return Boolean(overallVerdict && (proofPhotos.length >= 1 || isDigitalSigned));
        }
        return Boolean(overallVerdict && (sealConfirmed || isDigitalSigned));
      default:
        return false;
    }
  };

  return (
    <div className={`space-y-6 pb-20 text-[#24263e] print:hidden ${isFocusMode ? 'fixed inset-0 z-50 bg-[#faf8f5] p-6 overflow-y-auto' : ''}`}>
      {/* Station Top Bar */}
      {!hideTopBar && (
        <div className="bg-[#24263e] text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-[#24263e]/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#fce5da] text-xs font-bold border border-white/10">
              <Cpu className="w-3.5 h-3.5 text-[#fce5da]" />
              <span>TRẠM KIỂM ĐỊNH THỰC TẾ SECONDLIFE • LAB TIÊU CHUẨN ISO/IEC 17025</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <span>Khu vực kiểm định</span>
              <span className="text-xs bg-[#c34c36] text-white px-2.5 py-0.5 rounded-full font-bold">
                Station #{inspectorCode}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 font-medium flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-[#fce5da] font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                Kỹ thuật viên: {inspectorName}
              </span>
              <span>•</span>

            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateToHub && (
              <button
                type="button"
                onClick={onNavigateToHub}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-white/15"
              >
                <Building2 className="w-3.5 h-3.5 text-[#fce5da]" />
                <span>Về Hub Quản Lý</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="px-4 py-2.5 rounded-xl bg-white text-[#24263e] hover:bg-gray-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              {isFocusMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>Thoát Toàn Màn Hình</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#c34c36]" />
                  <span>Chế Độ Tập Trung (Focus)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {noticeMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2 animate-fadeIn ${noticeMessage.isError
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
        >
          {noticeMessage.isError ? (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <span>{translateSystemNotification(noticeMessage.text)}</span>
        </div>
      )}

      {/* Intake scanner above the full-width inspection workstation */}
      <div className="flex flex-col gap-6">
        <div className="w-full max-w-2xl">
          {/* Quick Scan Box */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#24263e] flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#c34c36]" />
                <span>Quét Barcode / Mã Đơn Nhận Máy</span>
              </span>
              <span className="text-[10px] bg-red-50 text-[#c34c36] border border-red-100 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c34c36] animate-pulse"></span>
                Auto-Intake
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  value={barcodeScanInput}
                  onChange={(e) => setBarcodeScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleProcessBarcode(barcodeScanInput);
                    }
                  }}
                  placeholder="Quét mã vạch hoặc nhập mã đơn..."
                  className="w-full pl-3.5 pr-8 py-2 bg-[#faf8f5] border border-gray-200 rounded-xl text-xs font-mono outline-none focus:border-[#c34c36] focus:bg-white transition"
                />
                {barcodeScanInput && (
                  <button
                    type="button"
                    onClick={() => setBarcodeScanInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    title="Xóa mã"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Nút bật Camera Quét */}
              <button
                type="button"
                onClick={() => {
                  setScannerMode('intake');
                  setIsScannerOpen(true);
                }}
                className="px-3 py-2 bg-[#c34c36] hover:bg-[#a83b27] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                title="Bật camera quét trực tiếp mã Barcode hoặc QR Code"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Quét</span>
              </button>

              {/* Nút Nhận thủ công */}
              <button
                type="button"
                onClick={() => handleProcessBarcode(barcodeScanInput)}
                className="px-3.5 py-2 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer transition shrink-0"
              >
                Nhận
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
              <span className="flex items-center gap-1">

              </span>
              <button
                type="button"
                onClick={() => {
                  setScannerMode('intake');
                  setIsScannerOpen(true);
                }}
                className="text-[#c34c36] hover:underline font-bold text-[11px] cursor-pointer"
              >
                Mở Camera
              </button>
            </div>
          </div>

        </div>

        <div className="min-w-0 w-full bg-white rounded-3xl p-4 sm:p-6 border border-gray-200 shadow-sm space-y-6">
          {!activeOrder ? (
            <div className="py-24 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200/60 text-[#c34c36] flex items-center justify-center shadow-2xs">
                <QrCode className="w-10 h-10 stroke-[1.75]" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg font-black text-[#24263e]">
                  Sẵn Sàng Tiếp Nhận Thiết Bị Đo Kiểm
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Vui lòng quét Barcode hoặc nhập mã đơn hàng ở khung phía trên để bắt đầu đo kiểm 5 bước.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode('intake');
                    setIsScannerOpen(true);
                  }}
                  className="px-4 py-2.5 bg-[#c34c36] hover:bg-[#a83b27] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Mở Camera Quét Mã</span>
                </button>
              </div>
            </div>
          ) : isAtHomeOrder ? (
            /* =================================================================== */
            /* KIỂM ĐỊNH TẠI NHÀ: HIỂN THỊ THÔNG TIN SẢN PHẨM & LỊCH HẸN TƯƠNG ỨNG */
            /* =================================================================== */
            <div className="space-y-6 animate-fadeIn">
              {/* Header đơn tại nhà */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Navigation className="w-3.5 h-3.5 text-purple-600" />
                      Kiểm Định Tại Nhà Khách Hàng (On-site)
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-500">
                      Mã: #{activeOrder?.id}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-[#24263e] mt-1">
                    {activeOrder?.listing?.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {isCompletedOrder && (
                    <button
                      type="button"
                      onClick={() => setShowCertificateModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      title="Xem biên bản giám định & chứng thư số"
                    >
                      <Printer className="w-3.5 h-3.5 text-purple-200" />
                      <span>Xem Biên Bản</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderId('');
                      onSelectOrder?.('');
                    }}
                    className="px-3 py-2 rounded-xl border border-purple-200 hover:bg-purple-50 text-xs font-bold text-purple-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    title="Đóng đơn hiện tại và quay về màn hình chờ quét barcode"
                  >
                    <QrCode className="w-3.5 h-3.5 text-purple-600" />
                    <span>Quét Đơn Khác</span>
                  </button>
                </div>
              </div>

              {/* Banner khóa hồ sơ khi kiểm định đã hoàn tất */}
              {isCompletedOrder && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border border-amber-300 flex items-center justify-between gap-3 text-xs text-amber-950 shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-amber-950 text-sm flex items-center gap-2 flex-wrap">
                        <span>Hồ Sơ Đã Hoàn Tất Kiểm Định Tận Nơi (Đã Khóa)</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${overallVerdict === 'PASS' || (activeOrder?.inspectionReport as any)?.overallVerdict === 'PASS' || activeOrder?.inspectionReport?.verdict === 'PASS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                          {overallVerdict === 'PASS' || (activeOrder?.inspectionReport as any)?.overallVerdict === 'PASS' || activeOrder?.inspectionReport?.verdict === 'PASS' ? 'Đã Đạt Chuẩn' : 'Từ Chối'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Kỹ thuật viên đã hoàn thành biên bản kiểm tra và ký số phát hành. Hồ sơ hiện ở chế độ chỉ đọc.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Thông tin lịch hẹn & Địa chỉ khảo sát tận nơi */}
              <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 font-bold text-purple-900 text-sm">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>Thông Tin Lịch Hẹn & Địa Chỉ Người Bán Cần Đến Khảo Sát</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-200 text-purple-900 border border-purple-300">
                    KTV Lưu Động
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Thời gian KTV có mặt:</span>
                    <span className="font-black text-purple-950 text-sm">
                      🕒 {activeOrder.appointmentScheduledAt ? new Date(activeOrder.appointmentScheduledAt).toLocaleString('vi-VN') : 'Chưa chốt giờ'}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Địa chỉ nhà người bán (Khảo sát tận nơi):</span>
                    <span className="font-extrabold text-slate-800 text-xs block leading-snug">
                      📍 {resolvedSellerAddress}
                    </span>
                    <div className="text-[11px] text-slate-600 font-medium flex items-center gap-2 pt-0.5">
                      <span>👤 {resolvedSellerName}</span>
                      <span>📞 {resolvedSellerPhone}</span>
                    </div>
                  </div>
                </div>

                {(activeOrder.appointmentNote || (activeOrder as any).note) && (
                  <div className="text-[11px] text-purple-900 italic bg-white/90 p-2.5 rounded-lg border border-purple-200">
                    💬 <strong>Ghi chú đón KTV từ người bán:</strong> {activeOrder.appointmentNote || (activeOrder as any).note}
                  </div>
                )}
              </div>

              {/* Xác thực tiếp nhận thiết bị tại nhà (Nhập hoặc Quét mã vạch Người Bán) */}
              {!isInspectorArrived ? (
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Barcode className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-amber-950">
                          Xác Thực Tiếp Nhận Thiết Bị Tại Nhà
                        </h4>
                        <p className="text-[11px] text-amber-800">
                          Người bán đã được cấp 1 mã vạch và mã tiếp nhận. Vui lòng quét hoặc nhập mã để bắt đầu đo kiểm.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-700 animate-spin" />
                      Chờ Quét Mã
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={atHomeVerifyInput}
                        onChange={(e) => setAtHomeVerifyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVerifyAtHomeIntake(activeOrder);
                          }
                        }}
                        placeholder={`Nhập mã tiếp nhận từ Người bán (VD: ${getAtHomeIntakeCode(activeOrder.id)})...`}
                        className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerMode('intake');
                        setIsScannerOpen(true);
                      }}
                      className="px-3.5 py-2.5 bg-[#c34c36] hover:bg-[#a83b27] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                      title="Mở camera quét mã barcode của người bán"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Quét Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyAtHomeIntake(activeOrder)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Xác Nhận Có Mặt</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-emerald-900 block">
                        Kỹ thuật viên đã đến và đang kiểm tra
                      </span>
                      <span className="text-[11px] text-emerald-700">
                        Đã xác thực tiếp nhận tại nhà thành công. Hệ thống đã cập nhật trạng thái bên người bán.
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Đang Đo Kiểm
                  </span>
                </div>
              )}

              {/* Grid 2 cột: Ảnh sản phẩm và Thông tin chi tiết */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Cột 1: Ảnh sản phẩm bài đăng người bán */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase text-gray-500 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-[#c34c36]" />
                      Ảnh Thiết Bị Bài Đăng
                    </span>
                    {productImages.length > 0 && (
                      <span className="text-[10px] text-gray-400 font-mono">
                        {activeImageIndex + 1}/{productImages.length}
                      </span>
                    )}
                  </div>

                  {productImages.length > 0 ? (
                    <div className="space-y-2">
                      <div
                        className="relative group rounded-2xl overflow-hidden border border-gray-200 bg-slate-50 cursor-pointer aspect-4/3 flex items-center justify-center shadow-2xs"
                        onClick={() => setPreviewPhoto(productImages[activeImageIndex] || productImages[0])}
                        title="Nhấn để phóng to ảnh xem chi tiết"
                      >
                        <img
                          src={productImages[activeImageIndex] || productImages[0]}
                          alt={activeOrder?.listing?.title || 'Ảnh sản phẩm'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold backdrop-blur-[1px]">
                          <Maximize2 className="w-4 h-4" />
                          <span>Phóng to ảnh</span>
                        </div>
                      </div>

                      {productImages.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {productImages.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActiveImageIndex(idx)}
                              className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${activeImageIndex === idx ? 'border-purple-600 shadow-xs' : 'border-gray-200 opacity-60'
                                }`}
                            >
                              <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center rounded-2xl bg-[#faf8f5] border border-dashed border-gray-200 text-gray-400 space-y-1">
                      <Camera className="w-8 h-8 mx-auto text-gray-300" />
                      <p className="text-xs">Chưa có ảnh bài đăng</p>
                    </div>
                  )}
                </div>

                {/* Cột 2: Thông tin sản phẩm & Khách hàng */}
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2">
                    <div className="font-bold text-gray-700 uppercase text-[11px] pb-1 border-b border-gray-200/80">
                      Thông Tin Sản Phẩm Bài Đăng
                    </div>
                    <div><strong>Tên sản phẩm:</strong> {activeOrder?.listing?.title}</div>
                    <div>
                      <strong>Giá niêm yết:</strong>{' '}
                      <span className="font-mono text-[#c34c36] font-bold">
                        {formatVND(activeOrder?.itemPriceVnd || activeOrder?.listing?.priceVnd || 0)}
                      </span>
                    </div>
                    <div><strong>Người bán:</strong> {activeOrder?.sellerName}</div>
                    <div><strong>Người mua:</strong> {activeOrder?.buyerName}</div>
                    {activeOrder?.listing?.description && (
                      <div className="pt-1 text-gray-500 text-[11px] line-clamp-3">
                        <strong>Mô tả:</strong> {activeOrder.listing.description}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-purple-200 space-y-2.5 shadow-2xs">
                    <div className="font-bold text-purple-900 uppercase text-[11px] pb-1 border-b border-purple-100 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-purple-600" />
                      <span>Địa Chỉ & Liên Hệ Khách Hàng</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Địa chỉ khảo sát:</span>
                      <div className="font-semibold text-gray-900 mt-0.5">
                        {activeOrder.buyerAddress || 'Quận Cầu Giấy, TP. Hà Nội'}
                      </div>
                    </div>
                    <div className="pt-1 flex items-center justify-between">
                      <div>
                        <span className="text-gray-500">Số điện thoại:</span>
                        <div className="font-mono font-bold text-slate-800">
                          {activeOrder.buyerPhone || '0988 123 456'}
                        </div>
                      </div>
                      <a
                        href={`tel:${activeOrder.buyerPhone || '0988123456'}`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Gọi Điện</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Header of Active Order */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#c34c36] uppercase tracking-wider flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      Đang Kiểm Định Trực Tiếp
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-500">
                      Mã: #{activeOrder?.id}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-[#24263e] mt-0.5">
                    {activeOrder?.listing?.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {isCompletedOrder && (
                    <button
                      type="button"
                      onClick={() => setShowCertificateModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#24263e] hover:bg-black text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      title="Xem biên bản giám định & chứng thư số"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#fce5da]" />
                      <span>Xem Biên Bản</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderId('');
                      onSelectOrder?.('');
                    }}
                    className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    title="Đóng đơn hiện tại và quay về màn hình chờ quét barcode"
                  >
                    <QrCode className="w-3.5 h-3.5 text-gray-500" />
                    <span>Quét Đơn Khác</span>
                  </button>
                </div>
              </div>

              {/* Banner khóa hồ sơ khi kiểm định đã hoàn tất */}
              {isCompletedOrder && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-amber-950 text-sm flex items-center gap-2 flex-wrap">
                        <span>Hồ Sơ Đã Hoàn Tất Kiểm Định (Chế Độ Khóa Chỉ Đọc)</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${overallVerdict === 'PASS' || (activeOrder?.inspectionReport as any)?.overallVerdict === 'PASS' || activeOrder?.inspectionReport?.verdict === 'PASS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                          {overallVerdict === 'PASS' || (activeOrder?.inspectionReport as any)?.overallVerdict === 'PASS' || activeOrder?.inspectionReport?.verdict === 'PASS' ? 'Đạt Chuẩn (PASS)' : 'Từ Chối (FAIL)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Biên bản nghiệm thu và chữ ký số đã được phát hành chính thức. Tất cả các nút thao tác và biểu mẫu đã bị khóa để bảo toàn tính toàn vẹn của hồ sơ.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                    className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl shrink-0 flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#fce5da]" />
                    <span>Xem Biên Bản</span>
                  </button>
                </div>
              )}

              {/* Stepper Navigation */}
              <div className="grid grid-cols-5 gap-1 p-1.5 bg-[#faf8f5] rounded-2xl border border-gray-200">
                {stepsList.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isActive = currentStep === step.key;
                  const isCompletedOrder = Boolean(activeOrder && isOrderInspectionCompleted(activeOrder));
                  const isUnlocked = isCompletedOrder || idx <= maxReachedStepIndex;
                  const isCompleted = isStepCompleted(step.key, idx);

                  return (
                    <button
                      key={step.key}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => handleSelectStep(step.key)}
                      title={
                        !isUnlocked
                          ? `Chưa mở khóa: Cần hoàn thành tuần tự các bước trước đó`
                          : step.desc
                      }
                      className={`py-2 px-1 rounded-xl text-center transition flex flex-col items-center gap-1 relative ${isActive
                        ? 'bg-[#24263e] text-white shadow-xs font-bold cursor-default'
                        : isUnlocked
                          ? isCompleted
                            ? 'text-emerald-900 bg-emerald-50/70 hover:bg-emerald-100/70 cursor-pointer font-semibold border border-emerald-200/60'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-white/80 cursor-pointer font-semibold'
                          : 'opacity-40 text-gray-400 bg-transparent cursor-not-allowed'
                        }`}
                    >
                      <div className="flex items-center gap-1">
                        <StepIcon
                          className={`w-4 h-4 shrink-0 ${isActive
                            ? 'text-[#fce5da]'
                            : isUnlocked
                              ? isCompleted
                                ? 'text-emerald-600'
                                : 'text-[#c34c36]'
                              : 'text-gray-400'
                            }`}
                        />
                        {!isUnlocked && <Lock className="w-2.5 h-2.5 text-gray-400" />}
                      </div>
                      <div className="flex items-center justify-center w-full">
                        <span className="text-[11px] font-bold truncate">{step.title}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* =================================================================== */}
              {/* STEP 1: INTAKE & PROFILE MATCHING                                  */}
              {/* =================================================================== */}
              {currentStep === 'intake' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Bước 1 - Tiếp nhận & Đối chiếu ngoại quan thùng hàng:</strong>Đánh giá ngoại quan khi nhận hàng trước quá trình kiểm định chi tiết.
                    </div>
                  </div>

                  {/* Order Info & Method details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2 text-xs">
                      <div className="font-bold text-gray-700 uppercase text-[11px]">Thông Tin Bài Đăng Người Bán</div>
                      <div><strong>Tên máy:</strong> {activeOrder?.listing?.title}</div>
                      <div><strong>Giá bán:</strong> <span className="font-mono text-[#c34c36] font-bold">{formatVND(activeOrder?.itemPriceVnd || 0)}</span></div>
                      <div><strong>Người bán:</strong> {activeOrder?.sellerName}</div>
                      <div><strong>Người mua:</strong> {activeOrder?.buyerName}</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2 text-xs">
                      <div className="font-bold text-gray-700 uppercase text-[11px]">Hình Thức & Địa Chỉ Kiểm Định</div>
                      {isAtHomeOrder ? (
                        <>
                          <div className="text-purple-900 font-bold flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-purple-600" />
                            Khảo Sát & Đo Kiểm Tại Nhà Người Bán
                          </div>
                          <div className="text-slate-800 font-bold leading-snug">
                            📍 {resolvedSellerAddress}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Người bán: {resolvedSellerName} • SĐT: {resolvedSellerPhone}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-blue-900 font-bold flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            Bàn Giao Nhận Tại Phòng Lab Hub
                          </div>
                          <div className="text-gray-600">
                            Bưu tá giao hàng bọc đệm khí tới quầy tiếp nhận Hub.
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ghi chú hướng dẫn kỹ thuật từ Hub điều phối (nếu có) */}
                  {dispatchNote && (
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold text-amber-950">Ghi chú hướng dẫn kỹ thuật từ Hub:</div>
                        <p className="leading-relaxed text-amber-900 font-medium">{dispatchNote}</p>
                      </div>
                    </div>
                  )}

                  {/* Hiện trạng đóng gói & Phụ kiện khi tiếp nhận */}
                  <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-gray-200/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#c34c36]" />
                        <span className="font-bold text-gray-800 text-xs uppercase tracking-wide">
                          Hiện Trạng Đóng Gói & Phụ Kiện Khi Tiếp Nhận
                        </span>
                      </div>
                      {packagingStatus && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Đã ghi nhận bao bì (Ổn)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-700 flex items-center gap-1">
                          <span>Tình trạng hộp & Bao bì đóng gói khi nhận</span>
                          <span className="text-[#c34c36]">*</span>
                        </label>
                        <select
                          value={packagingStatus}
                          disabled={isCompletedOrder}
                          onChange={(e) => setPackagingStatus(e.target.value as any)}
                          className={`w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-semibold outline-none focus:border-[#c34c36] shadow-2xs text-gray-800 transition ${isCompletedOrder ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''}`}
                        >
                          <option value="INTACT">Nguyên vẹn 100% - Đóng gói mút xốp / bọc chuẩn</option>
                          <option value="SLIGHT_DAMAGE">Bao bì / hộp hơi trầy xước nhưng máy an toàn</option>
                          <option value="HEAVY_DAMAGE">Bao bì rách nặng / Thùng móp méo có nguy cơ va đập</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-700 flex items-center justify-between">
                          <span>Phụ Kiện Đi Kèm & Ghi Chú Tiếp Nhận</span>
                          <span className="text-[10px] text-gray-400 font-normal">(Tùy chọn)</span>
                        </label>
                        <input
                          type="text"
                          value={accessoriesNote}
                          disabled={isCompletedOrder}
                          onChange={(e) => setAccessoriesNote(e.target.value)}
                          placeholder="VD: Đầy đủ dây nguồn, phụ kiện, chân đế, phiếu bảo hành..."
                          className={`w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#c34c36] shadow-2xs text-gray-800 transition ${isCompletedOrder ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => handleNextStep('exterior')}
                      className="px-6 py-2.5 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Chuyển sang Bước 2: Ngoại Quan</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* STEP 2: EXTERIOR & COSMETIC GRADING                                */}
              {/* =================================================================== */}
              {currentStep === 'exterior' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Bước 2 - Kiểm tra Ngoại Quan & Phân Hạng Grade:</strong> Đánh giá mức độ trầy xước, cấn móp, độ nguyên vẹn của khung vỏ, kính chịu lực và các khớp nối.
                    </div>
                  </div>

                  {/* Grade Selection Cards */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Chọn Phân Hạng Ngoại Quan:
                      </label>
                      {selectedGrade && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Đã chọn {selectedGrade}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {[
                        { id: 'Like New' as ConditionGrade, label: 'Grade S / A+', desc: 'Như mới, không tì vết' },
                        { id: 'Good' as ConditionGrade, label: 'Grade A / B ', desc: 'Rất đẹp, trầy xước dăm siêu nhẹ' },
                        { id: 'Fair' as ConditionGrade, label: 'Grade C', desc: 'Cấn móp / Trầy xước nhìn thấy rõ' },
                      ].map((gr) => (
                        <div
                          key={gr.id}
                          onClick={() => {
                            if (isCompletedOrder) return;
                            setSelectedGrade(gr.id);
                            if (gr.id === 'Like New') setExteriorScore(98);
                            else if (gr.id === 'Good') setExteriorScore(90);
                            else setExteriorScore(80);
                          }}
                          className={`p-3.5 rounded-2xl border transition text-center space-y-1 ${isCompletedOrder ? 'cursor-not-allowed opacity-70 pointer-events-none' : 'cursor-pointer'
                            } ${selectedGrade === gr.id
                              ? 'bg-[#24263e] text-white border-[#24263e] shadow-md ring-2 ring-emerald-400'
                              : 'bg-[#faf8f5] border-gray-200 hover:border-[#c34c36] text-gray-800'
                            }`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-black text-xs">{gr.label}</span>
                            {selectedGrade === gr.id && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <div className={`text-[10px] ${selectedGrade === gr.id ? 'text-gray-300' : 'text-gray-500'}`}>
                            {gr.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5 text-xs">
                    <label className="font-bold text-gray-700">Mô tả chi tiết (Nếu có): </label>
                    <textarea
                      value={exteriorNotes}
                      readOnly={isCompletedOrder}
                      disabled={isCompletedOrder}
                      onChange={(e) => setExteriorNotes(e.target.value)}
                      rows={3}
                      className={`w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl outline-none focus:border-[#c34c36] ${isCompletedOrder ? 'bg-gray-100 cursor-not-allowed text-gray-700' : ''}`}
                    />
                  </div>

                  <div className="flex justify-between pt-3">
                    <button
                      type="button"
                      onClick={() => handleSelectStep('intake')}
                      className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Quay lại Bước 1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNextStep('technical')}
                      className="px-6 py-2.5 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Chuyển sang Bước 3: Kỹ Thuật</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* STEP 3: TECHNICAL & FUNCTIONAL CHECKLIST                           */}
              {/* =================================================================== */}
              {currentStep === 'technical' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Bước 3 - Kiểm Định Kỹ Thuật & Bo Mạch Phòng Lab:</strong> Thử tải điện áp, máy nén, cảm biến nhiệt, motor truyền động và đo đạc chỉ số vận hành thực tế.
                    </div>
                  </div>

                  {/* Category Display (Fixed from Listing) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-gray-700">Bộ Checklist ngành hàng:</span>
                      <div
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold text-gray-800 flex items-center gap-1.5 shadow-2xs"
                        title="Ngành hàng được trích xuất trực tiếp từ bài đăng sản phẩm, cố định theo quy trình kiểm định"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{selectedCategory}</span>
                      </div>
                      {isChecklistLoaded && backendChecklist?.title && (
                        <span
                          className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200"
                          title={backendChecklist.description || ''}
                        >
                          {backendChecklist.title}
                        </span>
                      )}
                    </div>

                    {canUseChecklist && <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shrink-0 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{checklist.filter((c) => c.status === 'pass').length}/{checklist.length} tiêu chuẩn Đạt</span>
                      </div>
                      {checklist.length > 0 && checklist.every((c) => !c.mandatory || c.status !== 'pending') && (
                        <div className="text-xs font-bold text-white bg-emerald-600 px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          <span>Đã ổn tất cả tiêu chuẩn bắt buộc</span>
                        </div>
                      )}
                    </div>}
                  </div>

                  {/* Checklist Items Table */}
                  <div className="space-y-3">
                    {!canUseChecklist && (
                      <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                        {!isChecklistLoaded && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>{isChecklistLoaded ? checklistLoad?.message : 'Đang tải checklist của đơn kiểm định…'}</span>
                        {isChecklistLoaded && !isCompletedOrder && (
                          <button type="button" onClick={() => setChecklistRetry((retry) => retry + 1)}
                            className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Tải lại
                          </button>
                        )}
                      </div>
                    )}
                    {canUseChecklist && checklist.map((item, idx) => (
                      <div
                        key={item.id || `chk-card-${idx}`}
                        className={`p-4 rounded-2xl border space-y-2.5 text-xs transition ${item.status === 'pass'
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : item.status === 'fail'
                            ? 'border-red-300 bg-red-50/20'
                            : 'border-gray-200 bg-[#faf8f5]'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-[#c34c36] uppercase tracking-wider">
                                [{item.category || selectedCategory || 'Kỹ thuật'}]
                              </span>
                              {item.status === 'pass' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  ĐÃ ỔN (ĐẠT)
                                </span>
                              )}
                              {item.status === 'fail' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-300">
                                  <X className="w-3 h-3 text-red-600" />
                                  PHÁT HIỆN LỖI
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
                              {item.status === 'pass' && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              <span>{item.title}</span>
                              {item.mandatory && (
                                <span className="text-[10px] text-red-500 font-bold ml-1">*Bắt buộc</span>
                              )}
                            </h4>
                            <p className="text-gray-500 text-[11px] mt-0.5">{item.description}</p>
                          </div>

                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isCompletedOrder}
                              onClick={() => handleToggleChecklist(item.id, 'pass')}
                              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${isCompletedOrder ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'
                                } ${item.status === 'pass'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-emerald-50'
                                }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>ĐẠT</span>
                            </button>

                            <button
                              type="button"
                              disabled={isCompletedOrder}
                              onClick={() => handleToggleChecklist(item.id, 'fail')}
                              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${isCompletedOrder ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'
                                } ${item.status === 'fail'
                                  ? 'bg-red-600 text-white shadow-xs'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-red-50'
                                }`}
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>LỖI</span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-200 flex items-center gap-2">
                          <span className="text-gray-500 text-[11px] shrink-0">Chỉ số đo đạc thực tế:</span>
                          <input
                            type="text"
                            readOnly={isCompletedOrder}
                            disabled={isCompletedOrder}
                            value={item.testedValue || ''}
                            onChange={(e) => handleUpdateTestedValue(item.id, e.target.value)}
                            placeholder="VD: Nhiệt độ -19.2°C, độ ồn 38dB, cách điện an toàn..."
                            className={`flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-[#c34c36] ${isCompletedOrder ? 'bg-gray-100 cursor-not-allowed text-gray-700' : ''}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-3">
                    <button
                      type="button"
                      onClick={() => handleSelectStep('exterior')}
                      className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Quay lại Bước 2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNextStep('proofs')}
                      disabled={!isCompletedOrder && !canUseChecklist}
                      className="px-6 py-2.5 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>Chuyển sang Bước 4: Bằng Chứng</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* STEP 4: PROOFS & TAMPER SEAL                                       */}
              {/* =================================================================== */}
              {currentStep === 'proofs' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      {isAtCenterOrder ? (
                        <>
                          <strong>Bước 4 - Ảnh Bằng Chứng Hiện Trạng Tại Hub:</strong> Chụp và tải lên từ 1 đến 10 ảnh hiện trạng máy (ảnh toàn cảnh, chi tiết linh kiện, số serial nếu có) trực tiếp tại Trạm kiểm định.
                        </>
                      ) : (
                        <>
                          <strong>Bước 4 - Ảnh Bằng Chứng Vi Mạch & Dán Tem Niêm Phong:</strong> Chụp ảnh soi kính hiển vi, số seri bo mạch và dán tem niêm phong chống tráo đổi linh kiện theo tiêu chuẩn SecondLife.
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tamper Seal Serial Box (Chỉ áp dụng cho đơn kiểm định tại nhà AT_HOME) */}
                  {!isAtCenterOrder && (
                    <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#c34c36]" />
                          Số Seri Tem Niêm Phong Chống Bóc Tách (NFC / Hologram Seal) *
                        </span>
                        <button
                          type="button"
                          onClick={handleGenerateBackendSeal}
                          disabled={isGeneratingSeal || isCompletedOrder}
                          className={`text-xs text-[#c34c36] font-bold hover:underline flex items-center gap-1 ${isCompletedOrder ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          {isGeneratingSeal && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>Sinh mã tem từ hệ thống</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={tamperSealInput}
                          readOnly={isCompletedOrder}
                          disabled={isCompletedOrder}
                          onChange={(e) => setTamperSealInput(e.target.value)}
                          className={`flex-1 min-w-[200px] px-3.5 py-2.5 bg-white border border-orange-200 rounded-xl font-mono font-bold text-slate-800 text-sm outline-none focus:border-[#c34c36] ${isCompletedOrder ? 'bg-gray-100 cursor-not-allowed text-gray-700' : ''}`}
                        />
                        <button
                          type="button"
                          disabled={isCompletedOrder}
                          onClick={() => {
                            setScannerMode('tamper');
                            setIsScannerOpen(true);
                          }}
                          className="px-3 py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Quét Barcode / QR tem niêm phong"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Quét Tem</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPrintSealModalOpen(true)}
                          className="px-3.5 py-2 bg-[#c34c36] hover:bg-[#a83b27] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                          title="Tạo mã in tem niêm phong chuẩn dán máy"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>In Tem QR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifySealId(tamperSealInput);
                            setIsVerifySealModalOpen(true);
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                          title="Tra cứu trạng thái xác thực tem trên Backend"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Xác Thực Tem</span>
                        </button>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          disabled={isCompletedOrder}
                          checked={sealConfirmed}
                          onChange={(e) => setSealConfirmed(e.target.checked)}
                          className="w-4 h-4 accent-[#c34c36] rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                          <span>Xác nhận: Tôi đã dán tem niêm phong vật lý đè lên ốc vít / khớp nối máy của thiết bị này.</span>
                          {sealConfirmed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ĐÃ DÁN TEM (ĐÃ ỔN)
                            </span>
                          )}
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Photo Upload & Gallery */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {isAtCenterOrder ? 'Thư Viện Ảnh Hiện Trạng Thiết Bị (1 - 10 ảnh) *:' : 'Thư Viện Ảnh Bằng Chứng Kiểm Định:'}
                      </span>
                      {proofPhotos.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Đã có {proofPhotos.length}/10 ảnh đã tải lên thành công (Đã ổn)
                        </span>
                      ) : isAtCenterOrder ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Yêu cầu từ 1 đến 10 ảnh bằng chứng đã upload thành công
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {photoUploadItems.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`relative group rounded-xl overflow-hidden border aspect-video bg-gray-100 ${item.status === 'error'
                            ? 'border-rose-400 bg-rose-50'
                            : item.status === 'uploading'
                              ? 'border-blue-300'
                              : 'border-gray-200'
                            }`}
                        >
                          <img
                            src={item.previewUrl}
                            alt={`Proof ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                            onClick={() => setPreviewPhoto(item.previewUrl)}
                          />

                          {item.status === 'uploading' && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white p-2">
                              <Loader2 className="w-5 h-5 animate-spin text-white mb-1" />
                              <span className="text-[10px] font-bold">Đang tải lên...</span>
                            </div>
                          )}

                          {item.status === 'error' && (
                            <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-2 text-center">
                              <AlertTriangle className="w-4 h-4 text-rose-300 mb-1" />
                              <span className="text-[9px] font-bold text-rose-100 line-clamp-2 mb-1.5">
                                {item.errorMessage || 'Tải ảnh thất bại'}
                              </span>
                              {!isCompletedOrder && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleRetryUpload(item.id)}
                                    className="px-2 py-0.5 rounded bg-white text-rose-900 font-bold text-[10px] hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>Thử lại</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhoto(item.id)}
                                    className="p-1 rounded bg-black/50 hover:bg-black text-white cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {item.status === 'success' && !isCompletedOrder && (
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(item.id)}
                                className="p-1 rounded-md bg-black/70 hover:bg-red-600 text-white cursor-pointer"
                                title="Xóa ảnh"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white">
                            Ảnh #{idx + 1} {item.status === 'success' ? '✓' : ''}
                          </span>
                        </div>
                      ))}

                      {!isCompletedOrder && photoUploadItems.length < 10 && (
                        <label className="border-2 border-dashed border-gray-300 hover:border-[#c34c36] rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-orange-50/30 transition aspect-video relative">
                          {isUploadingPhoto ? (
                            <div className="flex flex-col items-center gap-1.5 text-xs text-[#c34c36]">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="font-semibold text-[10px]">Đang tải ảnh lên...</span>
                            </div>
                          ) : (
                            <>
                              <Camera className="w-5 h-5 text-gray-400 mb-1" />
                              <span className="text-[11px] font-bold text-gray-600">Thêm ảnh mới</span>
                              <span className="text-[9px] text-gray-400">JPG, PNG, WEBP (Tối đa 10 ảnh)</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={isUploadingPhoto}
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleUploadFiles(e.target.files);
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {isAtHomeOrder && (
                    <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-3 text-xs">
                      <span className="font-extrabold text-[#24263e] uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-blue-600" />
                        Bằng Chứng Video Thử Nghiệm Máy & Mở Thùng (Cloudinary / S3 URL):
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-600 block mb-1">
                            Video Chẩn Đoán / Test Máy (Inspection Proof Video URL):
                          </label>
                          <input
                            type="url"
                            value={videoProofUrl}
                            readOnly={isCompletedOrder}
                            disabled={isCompletedOrder}
                            onChange={(e) => setVideoProofUrl(e.target.value)}
                            placeholder="https://res.cloudinary.com/.../inspection_test.mp4"
                            className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#c34c36] ${isCompletedOrder ? 'bg-gray-100 cursor-not-allowed text-gray-700' : ''}`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-600 block mb-1">
                            Video Mở Thùng Đồng Kiểm (Unboxing Video URL):
                          </label>
                          <input
                            type="url"
                            value={unboxingVideoUrl}
                            readOnly={isCompletedOrder}
                            disabled={isCompletedOrder}
                            onChange={(e) => setUnboxingVideoUrl(e.target.value)}
                            placeholder="https://res.cloudinary.com/.../unboxing.mp4"
                            className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#c34c36] ${isCompletedOrder ? 'bg-gray-100 cursor-not-allowed text-gray-700' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-3">
                    <button
                      type="button"
                      onClick={() => handleSelectStep('technical')}
                      className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Quay lại Bước 3
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNextStep('verdict')}
                      className="px-6 py-2.5 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Chuyển sang Bước 5: Kết Luận</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* STEP 5: FINAL VERDICT & DIGITAL SIGNATURE                           */}
              {/* =================================================================== */}
              {currentStep === 'verdict' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Bước 5 - Kết Luận, Ký Số & Phát Hành Chứng Thư:</strong> Hoàn tất thẩm định, chọn kết luận Đạt hoặc Từ chối và ký số điện tử để cấp Chứng thư giám định cho đơn hàng.
                    </div>
                  </div>

                  {isCompletedOrder && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-start sm:items-center gap-3 text-xs text-emerald-900 shadow-2xs">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                      <div>
                        <strong className="text-emerald-950 text-sm block">
                          {isAtCenterOrder
                            ? 'Đơn hàng đã có kết quả kiểm định chính thức từ Hub'
                            : 'Đơn hàng đã có kết quả kiểm định chính thức & niêm phong số hóa'}
                        </strong>
                        <span className="text-[11px] text-emerald-800">
                          Hồ sơ và kết quả đo kiểm đã được ký số phát hành chứng thư. Không được phép chỉnh sửa hoặc thẩm định lại.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Verdict buttons */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Kết Luận Thẩm Định Cuối Cùng *:
                      </label>
                      {overallVerdict && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Đã chốt: {overallVerdict === 'PASS' ? 'ĐẠT CHUẨN' : 'TỪ CHỐI'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        disabled={isCompletedOrder}
                        onClick={() => setOverallVerdict('PASS')}
                        className={`py-3.5 px-4 rounded-2xl border text-sm font-black transition flex items-center justify-center gap-2 ${isCompletedOrder ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'
                          } ${overallVerdict === 'PASS'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                            : 'bg-[#faf8f5] text-gray-700 border-gray-200 hover:bg-emerald-50'
                          }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>ĐẠT CHUẨN (PASS)</span>
                      </button>

                      <button
                        type="button"
                        disabled={isCompletedOrder}
                        onClick={() => setOverallVerdict('FAIL')}
                        className={`py-3.5 px-4 rounded-2xl border text-sm font-black transition flex items-center justify-center gap-2 ${isCompletedOrder ? 'cursor-not-allowed opacity-60 pointer-events-none' : 'cursor-pointer'
                          } ${overallVerdict === 'FAIL'
                            ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-300'
                            : 'bg-[#faf8f5] text-gray-700 border-gray-200 hover:bg-red-50'
                          }`}
                      >
                        <XCircle className="w-5 h-5" />
                        <span>TỪ CHỐI (REJECTED)</span>
                      </button>
                    </div>
                  </div>

                  {/* Quality score slider */}
                  <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-700">Điểm Đánh Giá Chất Lượng Tổng Thể:</span>
                      <span className="font-mono font-black text-xl text-[#c34c36]">{conditionScore}/100</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      disabled={isCompletedOrder}
                      value={conditionScore}
                      onChange={(e) => setConditionScore(Number(e.target.value))}
                      className={`w-full accent-[#c34c36] ${isCompletedOrder ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    />
                  </div>

                  {/* Diagnostic notes */}
                  <div className="space-y-1.5 text-xs">
                    <label className="font-bold text-gray-700">Ghi Chú Kết Luận Chi Tiết Của Kỹ Sư Giám Định:</label>
                    <textarea
                      value={inspectorNotes}
                      readOnly={isCompletedOrder}
                      disabled={isCompletedOrder}
                      onChange={(e) => setInspectorNotes(e.target.value)}
                      rows={3}
                      className={`w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl outline-none focus:border-[#c34c36] ${isCompletedOrder ? 'bg-gray-100 cursor-not-allowed text-gray-700' : ''}`}
                    />
                  </div>

                  {/* Digital signature & Seal check */}
                  <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-bold shrink-0">
                        <ShieldCheck className="w-5 h-5 text-[#fce5da]" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">Chữ Ký Số Kiểm Định Viên: {inspectorName}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {isAtCenterOrder ? (
                            <span>Chứng thư số: SL-CA-2026-RSA4096 (Còn hiệu lực) • Hình thức: Kiểm định tại Lab Hub</span>
                          ) : (
                            <span>Chứng thư số: SL-CA-2026-RSA4096 (Còn hiệu lực) • Tem: {tamperSealInput || 'Đã niêm phong'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {!isAtCenterOrder && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={isCompletedOrder}
                            checked={sealConfirmed}
                            onChange={(e) => setSealConfirmed(e.target.checked)}
                            className="w-4 h-4 accent-[#c34c36] rounded cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="font-bold text-gray-800 flex items-center gap-1">
                            <span>Đã dán tem</span>
                            {sealConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />}
                          </span>
                        </label>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isCompletedOrder}
                          checked={isDigitalSigned}
                          onChange={(e) => setIsDigitalSigned(e.target.checked)}
                          className="w-4 h-4 accent-[#c34c36] rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="font-bold text-gray-800 flex items-center gap-1">
                          <span>Đính kèm chữ ký</span>
                          {isDigitalSigned && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleSelectStep('proofs')}
                        className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Quay lại Bước 4
                      </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {isCompletedOrder ? (
                        <button
                          type="button"
                          onClick={() => setShowCertificateModal(true)}
                          className="w-full sm:w-auto px-8 py-3 bg-[#24263e] hover:bg-black text-white text-sm font-black rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition"
                        >
                          <Printer className="w-4 h-4 text-[#fce5da]" />
                          <span>Xem Biên Bản Giám Định</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowCertificateModal(true)}
                            className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                            <span>Xem Trước Chứng Thư</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSubmitInspection}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-8 py-3 bg-[#24263e] hover:bg-black text-white text-sm font-black rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Đang nộp kết quả & ký số...</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4 text-[#fce5da]" />
                                <span>Ký Số & Phát Hành Biên Bản Nghiệm Thu</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {noticeMessage && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fadeIn ${noticeMessage.isError
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                    >
                      {noticeMessage.isError ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <span>{translateSystemNotification(noticeMessage.text)}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: PREVIEW & PRINT DIGITAL CERTIFICATE                            */}
      {/* ===================================================================== */}
      {/* Official Digital Certificate Modal */}
      {showCertificateModal && activeOrder && (
        <DigitalInspectionCertificateModal
          order={activeOrder}
          previewReport={livePreviewReport}
          onClose={() => setShowCertificateModal(false)}
          lang={lang}
        />
      )}

      {/* Lightbox Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fadeIn"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-3xl w-full bg-black rounded-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewPhoto} alt="Proof" className="w-full max-h-[80vh] object-contain" />
          </div>
        </div>
      )}

      {/* Modal Quét Barcode & QR Code */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanCode}
        orders={orders}
        lang={lang}
      />

      {/* Modal In Tem Niêm Phong Chống Bóc Tách */}
      <PrintTamperSealModal
        isOpen={isPrintSealModalOpen}
        onClose={() => setIsPrintSealModalOpen(false)}
        tamperSealId={tamperSealInput}
        orderId={activeOrder?.id}
        productTitle={activeOrder?.listing?.title}
        conditionGrade={selectedGrade}
        conditionScore={conditionScore}
        inspectorName={inspectorName}
      />

      {/* Modal Tra Cứu & Xác Thực Tem Niêm Phong */}
      <InspectionSealVerificationModal
        isOpen={isVerifySealModalOpen}
        onClose={() => setIsVerifySealModalOpen(false)}
        initialSealId={verifySealId}
        onOpenScanner={() => {
          setIsVerifySealModalOpen(false);
          setScannerMode('tamper');
          setIsScannerOpen(true);
        }}
      />
    </div>
  );
};
