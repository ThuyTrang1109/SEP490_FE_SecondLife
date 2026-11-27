import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  EscrowOrder,
  Language,
  InspectionChecklistItem,
  ConditionGrade,
  UserProfile
} from '../types';
import { formatConditionGrade, formatVND } from '../utils/translations';
import { getInspectionTaskStage } from '../utils/inspectionTaskStatus';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
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
import { getInspectionRemoteMediaUrl } from '../utils/inspectionDecisionData';
import { InspectionEvidenceErrors } from '../components/inspection/InspectionEvidenceErrors';
import {
  getInspectionBatchPhotoError,
  getInspectionEvidenceStepError,
  getInspectionPhotoUploadError,
  getInspectionPhotoSelectionErrors,
  getUploadedInspectionPhotoUrl,
  INSPECTION_PHOTO_ACCEPT,
  INSPECTION_PHOTO_LIMIT,
} from '../utils/inspectionEvidencePhotos';
import { getAtHomeIntakeCode } from '../components/inspection/AtHomeIntakeBarcode';
import { getOrderSellerAddress, getOrderSellerName, getOrderSellerPhone } from './inspection-center/dispatch/orderContacts';
import { canInspectorCheckIn, getOrderScheduledAppointmentTime } from '../utils/inspectionAppointmentTime';

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
  if (order.inspectionReport) return order.inspectionReport;
  try {
    const stored = localStorage.getItem(`inspection_report_${order.id}`);
    if (stored) return JSON.parse(stored);
  } catch { }
  return undefined;
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
  const [searchedOrder, setSearchedOrder] = useState<EscrowOrder | null>(null);
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [barcodeScanInput, setBarcodeScanInput] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'intake' | 'serial' | 'tamper'>('intake');


  useEffect(() => {
    if (externalSelectedOrderId) {
      setSelectedOrderId(externalSelectedOrderId);
      setCurrentStep('intake');
    } else if (externalSelectedOrderId === '') {
      setSelectedOrderId('');
    }
  }, [externalSelectedOrderId]);

  // Active Order (chỉ tải khi đã tìm kiếm / quét mã hoặc chọn đơn cụ thể, không tự ý nạp orders[0])
  const activeOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.id === selectedOrderId) || (searchedOrder?.id === selectedOrderId ? searchedOrder : null);
  }, [orders, selectedOrderId, searchedOrder]);

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
  const [atHomeViewMode, setAtHomeViewMode] = useState<'INFO' | 'WORKBENCH'>('INFO');
  useEffect(() => {
    setAtHomeViewMode('INFO');
  }, [activeOrder?.id]);

  const [checkedInAppointment, setCheckedInAppointment] = useState<{ orderId: string; scheduledAt: string | null } | null>(null);
  const [checkingInOrderId, setCheckingInOrderId] = useState<string | null>(null);
  const scheduledApptTime = useMemo(() => {
    return getOrderScheduledAppointmentTime(activeOrder);
  }, [activeOrder]);

  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const checkInEligibility = canInspectorCheckIn(scheduledApptTime, currentTimeMs);
  const isInspectorArrived = Boolean(activeOrder && (
    activeOrder.homeCheckedInAt ||
    activeOrder.inspectionStatus === 'INSPECTING' ||
    activeOrder.status === 'INSPECTING' ||
    (checkedInAppointment?.orderId === activeOrder.id && checkedInAppointment.scheduledAt === scheduledApptTime)
  ));
  const isCheckInBlocked = isAtHomeOrder && !isInspectorArrived && !checkInEligibility.allowed;
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
  const [photoSelectionErrors, setPhotoSelectionErrors] = useState<string[]>([]);
  const [hasTriedEvidenceStep, setHasTriedEvidenceStep] = useState(false);
  const proofPhotos = useMemo(
    () => [...new Set(photoUploadItems
      .filter((photo) => photo.status === 'success')
      .map((photo) => getUploadedInspectionPhotoUrl(photo.remoteUrl))
      .filter(Boolean))],
    [photoUploadItems]
  );
  const evidenceStepError = getInspectionEvidenceStepError(
    proofPhotos.length,
    photoUploadItems.some((photo) => photo.status === 'uploading')
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
    } catch { }
    return null;
  }, [activeOrder?.id]);

  const resolvedSellerAddress = useMemo(() => {
    return (
      getOrderSellerAddress(activeOrder) ||
      assignedSellerInfo?.sellerAddress ||
      (activeOrder as any)?.sellerAddress ||
      activeOrder?.listing?.location ||
      (activeOrder as any)?.listing?.sellerAddress ||
      'Kho người bán (Đang cập nhật địa chỉ)'
    );
  }, [assignedSellerInfo, activeOrder]);

  const resolvedSellerPhone = useMemo(() => {
    return (
      getOrderSellerPhone(activeOrder) ||
      assignedSellerInfo?.sellerPhone ||
      (activeOrder as any)?.sellerPhone ||
      (activeOrder as any)?.seller?.phone ||
      'Chưa cập nhật SĐT'
    );
  }, [assignedSellerInfo, activeOrder]);

  const resolvedSellerName = useMemo(() => {
    return (
      getOrderSellerName(activeOrder) ||
      assignedSellerInfo?.sellerName ||
      (activeOrder as any)?.sellerName ||
      activeOrder?.sellerName ||
      'Người bán'
    );
  }, [assignedSellerInfo, activeOrder]);
  const [isDigitalSigned, setIsDigitalSigned] = useState(false);

  useEffect(() => {
    let active = true;
    if (activeOrder?.id && !isCompletedOrder) {
      const startPayload = {
        orderCode: activeOrder.id,
        barcodeInput: barcodeScanInput || activeOrder.id,
        checkInCode: barcodeScanInput || activeOrder.id,
      };

      if (isAtCenterOrder) {
        // Luồng tại trung tâm: gọi start với payload.
        // Chỉ tiếp tục từ giao diện khi BE xác nhận trạng thái INSPECTING. Nếu gọi start lỗi, tải lại đơn.
        inspectorService.startInspection(activeOrder.id, startPayload)
          .catch(async () => {
            try {
              const reloaded = await inspectorService.getOrder(activeOrder.id);
              if (active && reloaded && isOrderInspectionCompleted({ inspectionStatus: reloaded.status })) {
                onResultSaved(reloaded);
              }
            } catch { }
          });
      }
    }
    return () => { active = false; };
  }, [activeOrder?.id, isCompletedOrder, isAtCenterOrder, barcodeScanInput]);

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
    setPhotoSelectionErrors([]);
    setHasTriedEvidenceStep(false);
    if (activeOrder) {
      const effectiveReport = getStationReport(activeOrder);

      if (effectiveReport) {
        setActualSerialNo((effectiveReport as any).serialNumber || '');
        const rawNote = (effectiveReport as any).note || (activeOrder as any).note || effectiveReport.summaryNotes || '';
        const packMatch = rawNote.match(/\[Bao bì:\s*([^\]]+)\]/i);
        if (packMatch) {
          const p = packMatch[1].toLowerCase();
          if (p.includes('rách') || p.includes('móp') || p.includes('hư hại') || p.includes('heavy')) {
            setPackagingStatus('HEAVY_DAMAGE');
          } else if (p.includes('xước') || p.includes('hơi') || p.includes('slight')) {
            setPackagingStatus('SLIGHT_DAMAGE');
          } else {
            setPackagingStatus('INTACT');
          }
        } else if ((effectiveReport as any).packagingStatus) {
          setPackagingStatus((effectiveReport as any).packagingStatus);
        } else {
          setPackagingStatus('INTACT');
        }

        const accMatch = rawNote.match(/\[Phụ kiện:\s*([^\]]+)\]/i);
        if (accMatch) {
          setAccessoriesNote(accMatch[1]);
        } else {
          setAccessoriesNote((effectiveReport as any).accessoriesNote || '');
        }

        const cleanNotes = rawNote.replace(/\[(Tem|Grade|Điểm|Bao bì|Phụ kiện|Photos):.*?\]/gi, '').trim();
        setExteriorNotes((effectiveReport as any).exteriorNotes || '');
        setInspectorNotes(cleanNotes || effectiveReport.summaryNotes || '');
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
        const rawNote = (activeOrder as any).note || '';
        const packMatch = rawNote.match(/\[Bao bì:\s*([^\]]+)\]/i);
        if (packMatch) {
          const p = packMatch[1].toLowerCase();
          if (p.includes('rách') || p.includes('móp') || p.includes('hư hại') || p.includes('heavy')) {
            setPackagingStatus('HEAVY_DAMAGE');
          } else if (p.includes('xước') || p.includes('hơi') || p.includes('slight')) {
            setPackagingStatus('SLIGHT_DAMAGE');
          } else {
            setPackagingStatus('INTACT');
          }
        } else if ((activeOrder as any).packagingStatus) {
          setPackagingStatus((activeOrder as any).packagingStatus);
        } else {
          setPackagingStatus('INTACT');
        }

        const accMatch = rawNote.match(/\[Phụ kiện:\s*([^\]]+)\]/i);
        setAccessoriesNote(accMatch ? accMatch[1] : ((activeOrder as any).accessoriesNote || ''));
        setActualSerialNo('');
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
    setTimeout(() => setNoticeMessage(null), 6000);
  };

  // Hàm tìm kiếm đơn hàng: Luôn gọi API Backend trước, sau đó đối chiếu làm giàu thông tin
  const findOrderFromAllSources = async (rawCode: string): Promise<EscrowOrder | null> => {
    const code = (rawCode || '').trim();
    if (!code) return null;

    const normalized = code.toLowerCase();
    const cleanCode = normalized.replace(/^(sl-insp-|inspection-|order-|sl-athome-|athome-|#)/i, '').trim();

    // 1. LUÔN GỌI API BACKEND TRƯỚC TIÊN ĐỂ TÌM KIẾM TRỰC TIẾP TỪ SERVER
    let apiFound: any = null;
    try {
      apiFound = await inspectorService.searchInspectionOrder(code);
    } catch (err) {
      console.warn('API search error:', err);
    }

    // 2. Tìm trong props orders để làm giàu dữ liệu hoặc fallback
    let match = orders.find((o) => {
      const oId = (o.id || '').toLowerCase();
      if (apiFound && (oId === String(apiFound.id || '').toLowerCase())) return true;
      if (oId === normalized || oId === cleanCode) return true;
      if (cleanCode && (oId.startsWith(cleanCode) || oId.includes(cleanCode) || cleanCode.includes(oId))) return true;
      const intakeCode = getAtHomeIntakeCode(o.id).toLowerCase();
      if (intakeCode === normalized || intakeCode.includes(normalized) || normalized.includes(intakeCode)) return true;
      if (o.listingId && (o.listingId.toLowerCase().includes(cleanCode) || cleanCode.includes(o.listingId.toLowerCase()))) return true;
      if (o.listing?.title && o.listing.title.toLowerCase().includes(cleanCode)) return true;
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
      if (apiFound) {
        return {
          ...match,
          ...apiFound,
          status: apiFound.status || match.status,
          inspectionStatus: apiFound.status || match.inspectionStatus,
        };
      }
      return match;
    }

    // 3. Nếu chưa có trong props orders, tìm trong localStorage (các đơn vừa đặt)
    if (typeof window !== 'undefined') {
      const storageKeys = ['recent_placed_orders', 'my_seller_inspection_orders', 'center_inspection_orders'];
      for (const k of storageKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const foundLocal = list.find((o: any) => {
                const oId = String(o.id || o.orderId || '').toLowerCase();
                if (apiFound && (oId === String(apiFound.id || '').toLowerCase())) return true;
                if (oId === normalized || oId === cleanCode) return true;
                if (cleanCode && (oId.startsWith(cleanCode) || oId.includes(cleanCode) || cleanCode.includes(oId))) return true;
                const intake = getAtHomeIntakeCode(o.id || o.orderId || '').toLowerCase();
                if (intake === normalized || intake.includes(normalized) || normalized.includes(intake)) return true;
                if (o.listing?.title && String(o.listing.title).toLowerCase().includes(cleanCode)) return true;
                return false;
              });
              if (foundLocal) {
                if (apiFound) {
                  return {
                    ...foundLocal,
                    ...apiFound,
                    status: apiFound.status || foundLocal.status,
                  } as EscrowOrder;
                }
                return foundLocal as EscrowOrder;
              }
            }
          }
        } catch { }
      }
    }

    if (apiFound) return apiFound as EscrowOrder;

    return null;
  };

  // Tìm kiếm đơn hàng theo mã vạch / mã đơn (gọi API tìm kiếm trước, thấy đơn mới sang bước xác nhận)
  const handleSearchOrder = async (rawCode: string) => {
    const code = (rawCode || '').trim();
    if (!code) {
      notify('Vui lòng nhập mã vạch, mã tiếp nhận hoặc mã đơn hàng để tìm kiếm!', true);
      return;
    }

    setIsSearchingOrder(true);
    playScanBeep();

    const match = await findOrderFromAllSources(code);
    setIsSearchingOrder(false);

    if (match) {
      setSearchedOrder(match);
      setSelectedOrderId(match.id);
      onSelectOrder?.(match.id);
      setBarcodeScanInput(match.id);
      setCurrentStep('intake');

      notify(
        `[Đã Tìm Thấy Đơn Hàng] #${match.id.slice(0, 8)} - "${match.listing?.title || 'Thiết bị'}". Vui lòng kiểm tra và bấm "Xác Nhận Đơn" để tiếp nhận!`
      );
    } else {
      setBarcodeScanInput(code);
      notify(`Không tìm thấy đơn hàng nào khớp với mã "${code}". Vui lòng kiểm tra lại!`, true);
    }
  };

  // Tiếp nhận việc (KTV xác nhận sau khi đã tìm thấy đơn)
  const handleAcceptTask = async (order: EscrowOrder, inputCode?: string) => {
    if (checkingInOrderId === order.id) return;
    const scheduledAt = getOrderScheduledAppointmentTime(order);
    const eligibility = canInspectorCheckIn(scheduledAt);
    if (!eligibility.allowed) {
      notify(eligibility.reason || 'Không thể check-in kiểm định tại nhà.', true);
      return;
    }

    setCheckingInOrderId(order.id);
    try {
      const result = await inspectorService.startInspection(order.id, {
        barcodeInput: inputCode || order.id,
        orderCode: order.id,
        checkInCode: inputCode || order.id,
      });

      const confirmedScheduledAt = result.appointmentScheduledAt || scheduledAt;
      setCheckedInAppointment({ orderId: order.id, scheduledAt: confirmedScheduledAt });
      markInspectorArrival(order.id, order, result.homeCheckedInAt);
      playScanBeep();
      notify(`Kỹ thuật viên đã tiếp nhận đơn #${order.id.slice(0, 8)}.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Không thể check-in kiểm định tại nhà.', true);
    } finally {
      setCheckingInOrderId((current) => current === order.id ? null : current);
    }
  };

  // Giữ alias cho tương thích ngược
  const handleProcessBarcode = (rawCode: string) => {
    handleSearchOrder(rawCode);
  };

  // Đồng bộ trạng thái KTV có mặt và đo kiểm cho tất cả các ID liên quan & đa store
  const markInspectorArrival = (orderId: string, matchedOrder: EscrowOrder & { orderId?: string }, checkedInAt?: string | null) => {
    const arrivedAt = checkedInAt || new Date().toISOString();
    const targetIds = Array.from(new Set([
      orderId,
      matchedOrder?.id,
      matchedOrder?.linkedOrderId,
      matchedOrder?.orderId,
      matchedOrder?.inspectionOrderId,
    ].filter(Boolean))) as string[];

    try {
      targetIds.forEach((id) => {
        localStorage.setItem(`at_home_inspector_arrived_${id}`, arrivedAt);
        localStorage.setItem(`order_inspecting_${id}`, 'true');
        localStorage.setItem(`inspection_status_${id}`, 'INSPECTING');
        localStorage.setItem(`order_confirmed_by_inspector_${id}`, 'true');
      });

      // Cập nhật recent_placed_orders
      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        if (rawRecent) {
          const list = JSON.parse(rawRecent);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (targetIds.includes(o.id) || targetIds.includes(o.linkedOrderId) || targetIds.includes(o.orderId)) {
                return {
                  ...o,
                  status: 'INSPECTING',
                  inspectionStatus: 'INSPECTING',
                  backendStatus: 'INSPECTING',
                  escrowStatus: 'INSPECTION_IN_PROGRESS',
                  inspectorArrivedAt: arrivedAt,
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        }
      } catch { }

      // Cập nhật my_seller_inspection_orders
      try {
        const rawSeller = localStorage.getItem('my_seller_inspection_orders');
        if (rawSeller) {
          const list = JSON.parse(rawSeller);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (targetIds.includes(o.id) || targetIds.includes(o.linkedOrderId) || targetIds.includes(o.orderId)) {
                return {
                  ...o,
                  status: 'INSPECTING',
                  inspectionStatus: 'INSPECTING',
                  backendStatus: 'INSPECTING',
                  escrowStatus: 'INSPECTION_IN_PROGRESS',
                  inspectorArrivedAt: arrivedAt,
                };
              }
              return o;
            });
            localStorage.setItem('my_seller_inspection_orders', JSON.stringify(updated));
          }
        }
      } catch { }

      // Kích hoạt đồng bộ cross-tab realtime qua storage key chuyên dụng
      localStorage.setItem('secondlife_inspector_arrived_sync', JSON.stringify({
        orderId,
        targetIds,
        arrivedAt,
        timestamp: Date.now(),
      }));

      window.dispatchEvent(new CustomEvent('secondlife_inspector_arrived', {
        detail: { orderId, targetIds, arrivedAt }
      }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: `at_home_inspector_arrived_${orderId}`,
        newValue: arrivedAt
      }));
    } catch (err) {
      console.warn('Failed to record inspector arrival:', err);
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

  const updatePhoto = (id: string, change: Pick<PhotoUploadItem, 'status' | 'remoteUrl' | 'errorMessage'>) => {
    setPhotoUploadItems((previous) => previous.map((item) => item.id === id ? { ...item, ...change } : item));
  };

  const uploadProofPhoto = async (id: string, file: File) => {
    try {
      const result = await mediaService.uploadImage(file, 'secondlife/inspections/proofs');
      const remoteUrl = getUploadedInspectionPhotoUrl(result?.url);
      if (!remoteUrl) throw new Error('Máy chủ không trả về URL ảnh.');
      updatePhoto(id, { status: 'success', remoteUrl, errorMessage: undefined });
    } catch (error) {
      updatePhoto(id, { status: 'error', errorMessage: getInspectionPhotoUploadError(error) });
    }
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0 || isUploadingPhoto || isCompletedOrder) return;

    const errors = getInspectionPhotoSelectionErrors(fileList, photoUploadItems.length);
    setPhotoSelectionErrors(errors);
    if (errors.length) return;

    const newItems = fileList.map((file) => ({
      id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading' as const,
    }));

    setPhotoUploadItems((previous) => [...previous, ...newItems]);
    setIsUploadingPhoto(true);
    try {
      if (newItems.length === 1) {
        const [item] = newItems;
        await uploadProofPhoto(item.id, item.file);
        return;
      }

      try {
        const results = await mediaService.uploadMultipleImages(fileList, 'secondlife/inspections/proofs');
        newItems.forEach((item, index) => {
          const remoteUrl = getUploadedInspectionPhotoUrl(results?.[index]?.url);
          updatePhoto(item.id, remoteUrl
            ? { status: 'success', remoteUrl }
            : { status: 'error', errorMessage: 'Máy chủ không trả về URL ảnh.' });
        });
      } catch (error) {
        // An indexed validation failure rejects the whole batch before storage.
        for (const [index, item] of newItems.entries()) {
          const message = getInspectionBatchPhotoError(error, index);
          if (message) updatePhoto(item.id, { status: 'error', errorMessage: message });
          else await uploadProofPhoto(item.id, item.file);
        }
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRetryUpload = async (id: string) => {
    const target = photoUploadItems.find((item) => item.id === id);
    if (!target?.file || target.status !== 'error' || isCompletedOrder) return;

    const errors = getInspectionPhotoSelectionErrors([target.file], photoUploadItems.length - 1);
    setPhotoSelectionErrors(errors);
    if (errors.length) return;

    updatePhoto(id, { status: 'uploading', errorMessage: undefined });
    await uploadProofPhoto(id, target.file);
  };

  const handleUploadProofPhoto = async (file: File) => {
    return handleUploadFiles([file]);
  };

  const requireUploadedEvidence = () => {
    if (isCompletedOrder || !evidenceStepError) return true;
    setHasTriedEvidenceStep(true);
    setCurrentStep('proofs');
    return false;
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

    if (!requireUploadedEvidence()) return;

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

    if (overallVerdict === 'PASS' && conditionScore <= 75) {
      notify(`Để kết luận ĐẠT CHUẨN (PASS), Điểm Đánh Giá Chất Lượng Tổng Thể phải lớn hơn 75 điểm (hiện tại: ${conditionScore}/100).`, true);
      return;
    }

    if (overallVerdict === 'FAIL' && conditionScore > 75) {
      notify(`Để kết luận TỪ CHỐI (REJECTED), Điểm Đánh Giá Chất Lượng Tổng Thể phải nhỏ hơn hoặc bằng 75 điểm (hiện tại: ${conditionScore}/100).`, true);
      return;
    }

    const validEvidencePhotoUrls = proofPhotos;
    let effectiveSeal = tamperSealInput;
    if (!isAtCenterOrder) {
      if (!effectiveSeal) {
        effectiveSeal = 'SL-SEAL-' + Math.floor(1000000 + Math.random() * 9000000);
        setTamperSealInput(effectiveSeal);
      }
      setSealConfirmed(true);
    }

    if (!isDigitalSigned) {
      notify('Bắt buộc tích vào "Đính kèm chữ ký" thì mới được đi tiếp!', true);
      return;
    }

    submittingResult.current = true;
    setIsSubmitting(true);
    try {
      if (!isAtHomeOrder) {
        await inspectorService.startInspection(activeOrder.id, {
          orderCode: activeOrder.id,
          barcodeInput: activeOrder.id,
          checkInCode: activeOrder.id,
        }).catch(() => { });
      }

      // 2. Nộp kết quả thẩm định lên backend API
      const persistedVideoUrl = isAtHomeOrder ? getInspectionRemoteMediaUrl(videoProofUrl) : undefined;
      const persistedUnboxingUrl = isAtHomeOrder ? getInspectionRemoteMediaUrl(unboxingVideoUrl) : undefined;

      const packagingLabel = packagingStatus === 'INTACT' ? 'Nguyên vẹn 100%' : packagingStatus === 'SLIGHT_DAMAGE' ? 'Trầy xước nhẹ' : 'Rách nặng / Móp méo';
      const packagingTag = `[Bao bì: ${packagingLabel}]`;
      const accessoriesTag = accessoriesNote.trim() ? ` [Phụ kiện: ${accessoriesNote.trim()}]` : '';
      const baseInspectorNotes = inspectorNotes.trim();

      const combinedNoteAtCenter = `${packagingTag}${accessoriesTag}${baseInspectorNotes ? ` ${baseInspectorNotes}` : ''}`.trim();
      const combinedNoteAtHome = `[Tem: ${effectiveSeal}][Grade: ${selectedGrade}][Điểm: ${conditionScore}/100]${packagingTag}${accessoriesTag}${validEvidencePhotoUrls.length > 0 ? ` [Photos: ${JSON.stringify(validEvidencePhotoUrls)}]` : ''}${baseInspectorNotes ? ` ${baseInspectorNotes}` : ''}`.trim();

      const payload: SubmitInspectionReportRequest = isAtCenterOrder ? {
        status: overallVerdict === 'PASS' ? 'PASSED' : 'FAILED',
        note: combinedNoteAtCenter || undefined,
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
        note: combinedNoteAtHome,
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
          packagingStatus,
          packagingCondition: packagingLabel,
          accessoriesNote: accessoriesNote.trim() || undefined,
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
          summaryNotes: baseInspectorNotes || (isAtCenterOrder ? combinedNoteAtCenter : combinedNoteAtHome),
          note: isAtCenterOrder ? combinedNoteAtCenter : combinedNoteAtHome,
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
        isAtCenterOrder ? combinedNoteAtCenter : combinedNoteAtHome,
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
    { key: 'exterior', title: '2. Ngoại Quan', desc: 'Phân hạng ngoại quan vỏ máy', icon: Layers },
    { key: 'technical', title: '3. Kỹ Thuật', desc: 'Đo đạc & Test chức năng', icon: Wrench },
    {
      key: 'proofs',
      title: '4. Ảnh Bằng Chứng',
      desc: isAtCenterOrder ? 'Ảnh chụp hiện trạng máy' : 'Ảnh hiện trạng & vi mạch',
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
    if (targetStep === 'verdict' && !requireUploadedEvidence()) return;
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

    if (nextStep === 'verdict' && !requireUploadedEvidence()) return;

    if (nextIdx > maxReachedStepIndex) {
      setMaxReachedStepIndex(nextIdx);
    }
    setCurrentStep(nextStep);
  };

  // Kiểm tra một bước đã hoàn thành để hiển thị tích Xanh báo hiệu đã ổn
  const isStepCompleted = (stepKey: InspectionStep, idx: number): boolean => {
    const isCompleted = isOrderInspectionCompleted(activeOrder);
    if (isCompleted) return true;
    if (stepKey === 'proofs') return !evidenceStepError;

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
      case 'verdict': {
        const isScoreValid = overallVerdict === 'PASS' ? conditionScore > 75 : conditionScore <= 75;
        return Boolean(overallVerdict && isScoreValid && isDigitalSigned);
      }
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

      {/* Notifications: Chỉ hiển thị ở đầu trang khi chưa chọn đơn hàng (màn hình tìm kiếm / quét barcode) */}
      {!activeOrder && noticeMessage && (
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
                <Search className="w-4 h-4 text-[#c34c36]" />
                <span>Tìm Kiếm Đơn Hàng / Quét Barcode</span>
              </span>
              <span className="text-[10px] bg-red-50 text-[#c34c36] border border-red-100 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c34c36] animate-pulse"></span>
                Tra Cứu &amp; Nhận Việc
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
                      handleSearchOrder(barcodeScanInput);
                    }
                  }}
                  placeholder="Nhập mã đơn, mã tiếp nhận (VD: SL-ATHOME-...) hoặc quét barcode..."
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

              {/* Nút Tìm kiếm */}
              <button
                type="button"
                onClick={() => handleSearchOrder(barcodeScanInput)}
                disabled={isSearchingOrder}
                className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer transition shrink-0 flex items-center gap-1.5 shadow-xs disabled:opacity-60"
                title="Tìm kiếm đơn hàng trong danh sách hoặc trên máy chủ"
              >
                {isSearchingOrder ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Tìm kiếm</span>
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
          ) : isAtHomeOrder && atHomeViewMode === 'INFO' ? (
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
                  {!isInspectorArrived && !isCompletedOrder && !isCheckInBlocked && (
                    <button
                      type="button"
                      disabled={checkingInOrderId === activeOrder.id}
                      onClick={() => void handleAcceptTask(activeOrder, barcodeScanInput)}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
                      title="Xác nhận tiếp nhận đơn hàng và bắt đầu kiểm định"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{checkingInOrderId === activeOrder.id ? 'Đang xác nhận…' : 'Xác Nhận Đơn'}</span>
                    </button>
                  )}
                  {isInspectorArrived && (
                    <button
                      type="button"
                      onClick={() => {
                        setAtHomeViewMode('WORKBENCH');
                        setCurrentStep('intake');
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
                      title="Mở bàn kiểm tra trực tiếp (Bắt đầu từ Bước 1: Tiếp nhận)"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Đến Bàn Kiểm Tra</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
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

              {!isCompletedOrder && isCheckInBlocked && (
                <div className="p-3.5 bg-amber-100/90 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs animate-fadeIn">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-black text-amber-900 flex items-center gap-1.5">
                      <span>{checkInEligibility.expired ? 'Đã quá hạn check-in' : 'Chưa thể check-in'}</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      {checkInEligibility.reason}
                    </p>
                  </div>
                </div>
              )}

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
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${overallVerdict === 'PASS' || activeOrder?.inspectionReport?.overallVerdict === 'PASS' || activeOrder?.inspectionReport?.verdict === 'PASS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                          {overallVerdict === 'PASS' || activeOrder?.inspectionReport?.overallVerdict === 'PASS' || activeOrder?.inspectionReport?.verdict === 'PASS' ? 'Đã Đạt Chuẩn' : 'Từ Chối'}
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

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Thời gian:</span>
                    <span className="font-black text-purple-950 text-sm">
                      🕒  {activeOrder.appointmentScheduledAt ? new Date(activeOrder.appointmentScheduledAt).toLocaleString('vi-VN') : 'Chưa chốt giờ'}
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

              {/* Trạng thái KTV đã đến và đang đo kiểm tại nhà */}
              {isInspectorArrived && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
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
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Đang Đo Kiểm
                    </span>
                  </div>
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

                {/* Cột 2: Thông tin sản phẩm bài đăng hiển thị đầy đủ */}
                <div className="space-y-4 text-xs">
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-3 shadow-2xs">
                    <div className="font-bold text-gray-700 uppercase text-[11px] pb-2 border-b border-gray-200/80 flex items-center justify-between flex-wrap gap-1">
                      <span>Thông Tin Sản Phẩm Bài Đăng</span>
                      {activeOrder?.listing?.id && (
                        <span className="font-mono text-gray-400 font-normal">
                          Mã bài đăng: #{String(activeOrder.listing.id).slice(0, 8)}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <strong className="text-gray-600">Tên sản phẩm:</strong>{' '}
                        <span className="font-bold text-gray-900">{activeOrder?.listing?.title || (activeOrder as any)?.postTitle}</span>
                      </div>

                      {(() => {
                        const rawDesc = activeOrder?.listing?.description || (activeOrder as any)?.description || '';
                        const origPriceMatch = rawDesc.match(/<!--(?:sl_orig_price|ORIGINAL_PRICE):(\d+)-->/i);
                        const extractedOrigPrice = origPriceMatch ? Number(origPriceMatch[1]) : 0;
                        const originalPrice = activeOrder?.listing?.originalPriceVnd || extractedOrigPrice || 0;
                        const cleanDesc = rawDesc.replace(/<!--[\s\S]*?-->/gi, '').trim();

                        return (
                          <>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                              <div>
                                <strong className="text-gray-600">Giá bài đăng:</strong>{' '}
                                <span className="font-mono text-[#c34c36] font-extrabold text-sm">
                                  {formatVND(activeOrder?.itemPriceVnd || activeOrder?.listing?.priceVnd || 0)}
                                </span>
                              </div>
                              {originalPrice > 0 && (
                                <div>
                                  <strong className="text-gray-600">Giá lúc mua mới:</strong>{' '}
                                  <span className="font-mono text-slate-400 line-through">
                                    {formatVND(originalPrice)}
                                  </span>
                                </div>
                              )}
                              {(activeOrder?.listing?.brand || activeOrder?.listing?.model) && (
                                <div>
                                  <strong className="text-gray-600">Thương hiệu / Model:</strong>{' '}
                                  <span className="font-semibold text-gray-800">
                                    {[activeOrder?.listing?.brand, activeOrder?.listing?.model].filter(Boolean).join(' - ')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {(activeOrder?.listing?.declaredConditionText || activeOrder?.listing?.conditionGrade || (activeOrder as any)?.condition || (activeOrder as any)?.itemCondition || (activeOrder as any)?.listing?.itemCondition) && (
                              <div>
                                <strong className="text-gray-600">Tình trạng công bố:</strong>{' '}
                                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  {formatConditionGrade(
                                    activeOrder?.listing?.declaredConditionText && activeOrder.listing.declaredConditionText !== 'Sản phẩm đã qua kiểm định cơ bản'
                                      ? activeOrder.listing.declaredConditionText
                                      : ((activeOrder?.listing as any)?.itemCondition || (activeOrder as any)?.itemCondition || activeOrder?.listing?.conditionGrade || (activeOrder as any)?.condition || 'USED_GOOD'),
                                    'vi'
                                  )}
                                </span>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pt-0.5">
                              <div>
                                <strong className="text-gray-600">Người bán:</strong>{' '}
                                <span className="font-semibold text-gray-800">{resolvedSellerName || activeOrder?.sellerName}</span>
                              </div>
                              <div>
                                <strong className="text-gray-600">Người mua:</strong>{' '}
                                <span className="font-semibold text-gray-800">{activeOrder?.buyerName}</span>
                              </div>
                            </div>

                            {activeOrder?.listing?.location && (
                              <div>
                                <strong className="text-gray-600">Khu vực đăng bán:</strong>{' '}
                                <span className="text-gray-700">{activeOrder.listing.location}</span>
                              </div>
                            )}

                            {cleanDesc && (
                              <div className="pt-2 border-t border-gray-200/80 space-y-1">
                                <strong className="text-gray-700 block">Mô tả chi tiết bài đăng:</strong>
                                <div className="text-gray-700 text-xs bg-white p-3 rounded-xl border border-gray-200 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
                                  {cleanDesc}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
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
                  {isAtHomeOrder && (
                    <button
                      type="button"
                      onClick={() => setAtHomeViewMode('INFO')}
                      className="px-3 py-2 rounded-xl border border-purple-200 hover:bg-purple-50 text-xs font-bold text-purple-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      title="Xem lại thông tin lịch hẹn và địa chỉ khảo sát"
                    >
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      <span>Xem Lịch Hẹn</span>
                    </button>
                  )}
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
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${overallVerdict === 'PASS' || activeOrder?.inspectionReport?.overallVerdict === 'PASS' || activeOrder?.inspectionReport?.verdict === 'PASS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                          {overallVerdict === 'PASS' || activeOrder?.inspectionReport?.overallVerdict === 'PASS' || activeOrder?.inspectionReport?.verdict === 'PASS' ? 'Đạt Chuẩn (PASS)' : 'Từ Chối (FAIL)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Biên bản nghiệm thu và chữ ký đã được phát hành chính thức. Tất cả các nút thao tác và biểu mẫu đã bị khóa để bảo toàn tính toàn vẹn của hồ sơ.
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
                            Bưu tá giao hàng tới quầy tiếp nhận Hub.
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
                          <option value="INTACT">Nguyên vẹn - Đóng gói mút xốp / bọc chuẩn</option>
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
                      <strong>Bước 2 - Kiểm tra Ngoại Quan & Phân Hạng:</strong> Đánh giá mức độ trầy xước, cấn móp, độ nguyên vẹn của khung vỏ, kính chịu lực và các khớp nối.
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
                          Đã chọn {selectedGrade === 'Like New' ? 'Hạng S / A+ (Như mới)' : selectedGrade === 'Good' ? 'Hạng A / B (Rất đẹp)' : 'Hạng C (Cấn móp / Trầy xước)'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {[
                        { id: 'Like New' as ConditionGrade, label: 'Hạng S / A+', desc: 'Như mới, không tì vết' },
                        { id: 'Good' as ConditionGrade, label: 'Hạng A / B', desc: 'Rất đẹp, trầy xước dăm siêu nhẹ' },
                        { id: 'Fair' as ConditionGrade, label: 'Hạng C', desc: 'Cấn móp / Trầy xước nhìn thấy rõ' },
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
                            : item.mandatory
                              ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-200/70'
                              : 'border-gray-200 bg-[#faf8f5]'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
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
                              {item.mandatory && item.status !== 'pass' && item.status !== 'fail' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                  Chưa đánh giá
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
                          <span className="text-gray-500 text-[11px] shrink-0">Đánh giá thực tế của kỹ thuật viên:</span>
                          <input
                            type="text"
                            readOnly={isCompletedOrder}
                            disabled={isCompletedOrder}
                            value={item.testedValue || ''}
                            onChange={(e) => handleUpdateTestedValue(item.id, e.target.value)}
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
                          <strong>Bước 4 - Ảnh Bằng Chứng Hiện Trạng & Vi Mạch:</strong> Chụp ảnh hiện trạng máy, chi tiết linh kiện và ảnh chụp thực tế theo tiêu chuẩn SecondLife.
                        </>
                      )}
                    </div>
                  </div>

                  {/* Photo Upload & Gallery */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {isAtCenterOrder ? 'Thư Viện Ảnh Hiện Trạng Thiết Bị (1 - 10 ảnh) *:' : 'Thư Viện Ảnh Bằng Chứng Kiểm Định:'}
                      </span>
                      {proofPhotos.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Đã tải lên {proofPhotos.length}/{INSPECTION_PHOTO_LIMIT} ảnh
                        </span>
                      ) : !isCompletedOrder ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Cần ít nhất 1 ảnh tải lên thành công
                        </span>
                      ) : null}
                    </div>

                    {!isCompletedOrder && (
                      <InspectionEvidenceErrors
                        photos={photoUploadItems}
                        selectionErrors={photoSelectionErrors}
                        stepError={hasTriedEvidenceStep ? evidenceStepError : null}
                      />
                    )}

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
                              <span className="mb-1.5 text-[10px] font-bold text-rose-100">Tải ảnh thất bại</span>
                              {!isCompletedOrder && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleRetryUpload(item.id)}
                                    aria-label={`Thử lại ảnh #${idx + 1}`}
                                    className="px-2 py-0.5 rounded bg-white text-rose-900 font-bold text-[10px] hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>Thử lại</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhoto(item.id)}
                                    aria-label={`Xóa ảnh #${idx + 1}`}
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

                      {!isCompletedOrder && photoUploadItems.length < INSPECTION_PHOTO_LIMIT && (
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
                              <span className="text-[10px] text-gray-500">JPG, PNG, WebP · Dưới 5 MB mỗi ảnh</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept={INSPECTION_PHOTO_ACCEPT}
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
                  <div className={`p-4 rounded-2xl border space-y-3 text-xs transition ${(overallVerdict === 'PASS' && conditionScore <= 75) || (overallVerdict === 'FAIL' && conditionScore > 75)
                    ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-200'
                    : 'bg-[#faf8f5] border-gray-200'
                    }`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-gray-700">Điểm Đánh Giá Chất Lượng Tổng Thể:</span>
                        <span className="block text-[11px] font-normal">
                          {overallVerdict === 'PASS' ? (
                            <span className="text-amber-700 font-semibold">Yêu cầu khi Đạt Chuẩn: Điểm số phải lớn hơn 75 (&gt; 75)</span>
                          ) : (
                            <span className="text-rose-700 font-semibold">Yêu cầu khi Từ Chối: Điểm số phải nhỏ hơn hoặc bằng 75 (≤ 75)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isCompletedOrder}
                          value={conditionScore}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            setConditionScore(val);
                          }}
                          className={`w-20 px-2 py-1 text-center font-mono font-black text-xl rounded-lg border outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${(overallVerdict === 'PASS' && conditionScore <= 75) || (overallVerdict === 'FAIL' && conditionScore > 75)
                            ? 'border-rose-400 text-rose-600 bg-white ring-1 ring-rose-300'
                            : 'border-gray-300 text-[#c34c36] bg-white focus:border-[#c34c36]'
                            } ${isCompletedOrder ? 'cursor-not-allowed opacity-60' : ''}`}
                        />
                        <span className="font-mono font-bold text-gray-500 text-sm">/ 100</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      disabled={isCompletedOrder}
                      value={conditionScore}
                      onChange={(e) => setConditionScore(Number(e.target.value))}
                      className={`w-full ${overallVerdict === 'FAIL' ? 'accent-red-600' : 'accent-[#c34c36]'} ${isCompletedOrder ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    />

                    <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                      <span>0 (Kém / Hỏng)</span>
                      <span className="text-amber-600 font-bold">Ngưỡng đạt: &gt; 75</span>
                      <span>100 (Xuất sắc)</span>
                    </div>

                    {!isCompletedOrder && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-gray-500 font-medium">Chọn nhanh:</span>
                        {(overallVerdict === 'FAIL' ? [
                          { score: 0, label: '0 (Kém / Hỏng)' },
                          { score: 30, label: '30' },
                          { score: 50, label: '50' },
                          { score: 60, label: '60' },
                          { score: 70, label: '70' },
                          { score: 75, label: '75 (Tối đa)' },
                        ] : [
                          { score: 76, label: '76 (Vừa đạt)' },
                          { score: 80, label: '80' },
                          { score: 85, label: '85' },
                          { score: 90, label: '90' },
                          { score: 95, label: '95' },
                          { score: 100, label: '100' },
                        ]).map((preset) => (
                          <button
                            key={preset.score}
                            type="button"
                            onClick={() => setConditionScore(preset.score)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${conditionScore === preset.score
                              ? overallVerdict === 'FAIL'
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-[#c34c36] text-white border-[#c34c36]'
                              : overallVerdict === 'FAIL'
                                ? 'bg-white text-gray-700 border-gray-200 hover:border-red-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-[#c34c36]'
                              }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {overallVerdict === 'PASS' && conditionScore <= 75 && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Kết luận ĐẠT CHUẨN (PASS) yêu cầu điểm chất lượng phải lớn hơn 75 (hiện tại: {conditionScore}/100). Vui lòng điều chỉnh lại điểm số.</span>
                      </div>
                    )}

                    {overallVerdict === 'FAIL' && conditionScore > 75 && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Kết luận TỪ CHỐI (REJECTED) yêu cầu điểm chất lượng không đạt (nhỏ hơn hoặc bằng 75 điểm, hiện tại: {conditionScore}/100). Vui lòng điều chỉnh lại điểm số.</span>
                      </div>
                    )}
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
                  <div className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${!isDigitalSigned
                      ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
                      : 'bg-emerald-50/30 border-emerald-300'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shrink-0 transition ${isDigitalSigned ? 'bg-emerald-700' : 'bg-[#24263e]'
                        }`}>
                        <ShieldCheck className={`w-5 h-5 ${isDigitalSigned ? 'text-white' : 'text-[#fce5da]'}`} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>Chữ Ký Số Kiểm Định Viên: {inspectorName}</span>
                          {!isDigitalSigned && (
                            <span className="text-[10px] text-amber-700 font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300">
                              Bắt buộc
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {isAtCenterOrder ? (
                            <span>Chứng thư số: • Hình thức: Kiểm định tại Lab Hub</span>
                          ) : (
                            <span>Chứng thư số: • Hình thức: Kiểm định tận nơi tại nhà</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          disabled={isCompletedOrder}
                          checked={isDigitalSigned}
                          onChange={(e) => setIsDigitalSigned(e.target.checked)}
                          className="w-4 h-4 accent-[#c34c36] rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className={`font-bold flex items-center gap-1 ${isDigitalSigned ? 'text-emerald-800' : 'text-slate-800'
                          }`}>
                          <span>Đính kèm chữ ký</span>
                          <span className="text-red-500 font-black">*</span>
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
                            disabled={isSubmitting || !isDigitalSigned}
                            className={`w-full sm:w-auto px-8 py-3 text-white text-sm font-black rounded-xl shadow-md flex items-center justify-center gap-2 transition ${isSubmitting || !isDigitalSigned
                                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                                : 'bg-[#24263e] hover:bg-black cursor-pointer shadow-lg'
                              }`}
                            title={!isDigitalSigned ? 'Bắt buộc tích vào "Đính kèm chữ ký" thì mới được đi tiếp' : ''}
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
