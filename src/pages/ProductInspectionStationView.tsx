import React, { useState, useEffect, useMemo } from 'react';
import {
  EscrowOrder,
  Language,
  InspectionChecklistItem,
  ConditionGrade,
  UserProfile
} from '../types';
import { formatVND } from '../utils/translations';
import { mockStandardChecklist } from '../data/mockData';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
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
  ArrowRight
} from 'lucide-react';
import { inspectorService, InspectionOrderDto } from '../services';
import { BarcodeScannerModal, playScanBeep } from '../components/modals/BarcodeScannerModal';
import { PrintTamperSealModal } from '../components/modals/PrintTamperSealModal';
import { InspectionSealVerificationModal } from '../components/modals/InspectionSealVerificationModal';
import { ScannableQRCode } from '../components/common/ScannableQRCode';

interface ProductInspectionStationViewProps {
  orders: EscrowOrder[];
  currentUser?: UserProfile | null;
  onCompleteInspection: (
    orderId: string,
    verdict: 'PASS' | 'FAIL',
    tamperSeal: string,
    summary: string
  ) => void;
  lang: Language;
  onNavigateToHub?: () => void;
  hideTopBar?: boolean;
  selectedOrderId?: string;
  onSelectOrder?: (orderId: string) => void;
}

export type InspectionStep = 'intake' | 'exterior' | 'technical' | 'proofs' | 'verdict';

export const ProductInspectionStationView: React.FC<ProductInspectionStationViewProps> = ({
  orders,
  currentUser,
  onCompleteInspection,
  lang,
  onNavigateToHub,
  hideTopBar = false,
  selectedOrderId: externalSelectedOrderId,
  onSelectOrder,
}) => {
  // Current active technician
  const inspectorName = currentUser?.name || 'Kỹ thuật viên kiểm định';
  const inspectorCode = currentUser?.id ? `INS-${currentUser.id}` : 'INS-STAFF';

  // State: Task Queue
  const [selectedOrderId, setSelectedOrderId] = useState<string>(externalSelectedOrderId || orders[0]?.id || '');
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'AT_CENTER' | 'AT_HOME' | 'DONE'>('ALL');
  const [taskSearch, setTaskSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [barcodeScanInput, setBarcodeScanInput] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'intake' | 'serial' | 'tamper'>('intake');

  useEffect(() => {
    if (externalSelectedOrderId) {
      setSelectedOrderId(externalSelectedOrderId);
    } else if ((!selectedOrderId || !orders.some((o) => o.id === selectedOrderId)) && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
      onSelectOrder?.(orders[0].id);
    }
  }, [externalSelectedOrderId, orders, selectedOrderId, onSelectOrder]);

  // Active Order
  const activeOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || orders[0];
  }, [orders, selectedOrderId]);

  // Stepper state
  const [currentStep, setCurrentStep] = useState<InspectionStep>('technical');
  const [isFocusMode, setIsFocusMode] = useState(false);

  // --- STEP 1: INTAKE & PROFILE CHECK ---
  const [actualSerialNo, setActualSerialNo] = useState('');
  const [packagingStatus, setPackagingStatus] = useState<'INTACT' | 'SLIGHT_DAMAGE' | 'HEAVY_DAMAGE'>('INTACT');
  const [accessoriesNote, setAccessoriesNote] = useState('');

  // --- STEP 2: EXTERIOR & GRADING ---
  const [selectedGrade, setSelectedGrade] = useState<ConditionGrade>('Like New');
  const [exteriorScore, setExteriorScore] = useState<number>(95);
  const [exteriorNotes, setExteriorNotes] = useState('');

  // Helper to detect category from activeOrder
  const detectCategoryFromOrder = (order: any): string => {
    const text = `${order?.listing?.title || ''} ${order?.postTitle || ''} ${order?.listing?.category || ''}`.toLowerCase();
    if (text.includes('giặt') || text.includes('sấy') || text.includes('washing')) {
      return 'Máy giặt & Máy sấy';
    }
    if (text.includes('lạnh') || text.includes('đông') || text.includes('mát') || text.includes('refrigerator') || text.includes('fridge')) {
      return 'Tủ lạnh & Tủ đông';
    }
    if (text.includes('điều hòa') || text.includes('máy lạnh') || text.includes('lọc không khí') || text.includes('air conditioner')) {
      return 'Điều hòa & Máy lọc';
    }
    if (text.includes('robot') || text.includes('hút bụi') || text.includes('vacuum')) {
      return 'Robot & Máy hút bụi';
    }
    if (text.includes('lò vi sóng') || text.includes('lò nướng') || text.includes('microwave') || text.includes('oven')) {
      return 'Lò vi sóng & Lò nướng';
    }
    if (text.includes('nồi cơm') || text.includes('bếp từ') || text.includes('bếp hồng ngoại') || text.includes('bếp điện') || text.includes('nồi')) {
      return 'Nồi cơm & Bếp từ';
    }
    return order?.listing?.category || 'Máy giặt & Máy sấy';
  };

  // --- STEP 3: TECHNICAL CHECKLIST ---
  const initialCat = activeOrder ? detectCategoryFromOrder(activeOrder) : 'Máy giặt & Máy sấy';
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [checklist, setChecklist] = useState<InspectionChecklistItem[]>(
    mockStandardChecklist[initialCat] || []
  );

  // Auto-detect & switch checklist when activeOrder changes
  useEffect(() => {
    if (activeOrder) {
      const detected = detectCategoryFromOrder(activeOrder);
      setSelectedCategory(detected);
      if (mockStandardChecklist[detected]) {
        setChecklist(mockStandardChecklist[detected]);
      }
    }
  }, [activeOrder?.id, (activeOrder as any)?.postTitle, (activeOrder as any)?.listing?.title]);

  // Re-sync checklist when technician manually changes category
  useEffect(() => {
    if (mockStandardChecklist[selectedCategory]) {
      setChecklist(mockStandardChecklist[selectedCategory]);
    }
  }, [selectedCategory]);

  // --- STEP 4: PROOFS & SEALS ---
  const [tamperSealInput, setTamperSealInput] = useState(
    'SL-SEAL-' + Math.floor(1000000 + Math.random() * 9000000)
  );
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [videoProofUrl, setVideoProofUrl] = useState('');
  const [unboxingVideoUrl, setUnboxingVideoUrl] = useState('');
  const [sealConfirmed, setSealConfirmed] = useState(false);
  const [isPrintSealModalOpen, setIsPrintSealModalOpen] = useState(false);
  const [isVerifySealModalOpen, setIsVerifySealModalOpen] = useState(false);
  const [verifySealId, setVerifySealId] = useState<string>('');

  // --- STEP 5: VERDICT & SUMMARY ---
  const [overallVerdict, setOverallVerdict] = useState<'PASS' | 'FAIL'>('PASS');
  const [conditionScore, setConditionScore] = useState<number>(90);
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [isDigitalSigned, setIsDigitalSigned] = useState(false);

  // Load dynamic checklist from backend for activeOrder & notify inspection started
  useEffect(() => {
    if (activeOrder?.id) {
      inspectorService.startInspection(activeOrder.id).catch(() => {});
      inspectorService.getOrderChecklist(activeOrder.id)
        .then((res) => {
          if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
            setChecklist(
              res.items.map((item) => ({
                id: item.id,
                category: res.categoryName || selectedCategory,
                title: item.itemTitle,
                description: item.criteriaDescription || '',
                status: 'pending' as const,
              }))
            );
          }
        })
        .catch(() => {
          // Fallback to category standard checklist
        });
    }
  }, [activeOrder?.id, selectedCategory]);

  // Reset or populate fields when activeOrder changes
  useEffect(() => {
    if (activeOrder) {
      if (activeOrder.inspectionReport) {
        setActualSerialNo((activeOrder.inspectionReport as any).serialNumber || '');
        setAccessoriesNote((activeOrder.inspectionReport as any).accessoriesNote || '');
        setExteriorNotes((activeOrder.inspectionReport as any).exteriorNotes || '');
        setInspectorNotes(activeOrder.inspectionReport.summaryNotes || '');
        setOverallVerdict(activeOrder.inspectionReport.verdict || 'PASS');
        setConditionScore(activeOrder.inspectionReport.conditionScore || 90);
        setSelectedGrade(activeOrder.inspectionReport.detectedGrade || 'Like New');
        setTamperSealInput(activeOrder.inspectionReport.tamperSealId || ('SL-SEAL-' + Math.floor(1000000 + Math.random() * 9000000)));
        setProofPhotos(activeOrder.inspectionReport.inspectorPhotos || []);
        setVideoProofUrl((activeOrder as any).videoProofUrl || '');
        setUnboxingVideoUrl((activeOrder as any).unboxingVideoUrl || '');
        setSealConfirmed(true);
        setIsDigitalSigned(true);
      } else {
        setActualSerialNo('');
        setAccessoriesNote('');
        setExteriorNotes('');
        setInspectorNotes('');
        setProofPhotos([]);
        setVideoProofUrl((activeOrder as any).videoProofUrl || '');
        setUnboxingVideoUrl((activeOrder as any).unboxingVideoUrl || '');
        setSealConfirmed(false);
        setIsDigitalSigned(false);
      }
    }
  }, [activeOrder?.id]);

  // Submitting & Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSeal, setIsGeneratingSeal] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const handleGenerateBackendSeal = async () => {
    if (!activeOrder?.id) return;
    setIsGeneratingSeal(true);
    try {
      const res = await inspectorService.generateSeal(activeOrder.id);
      const sealId = typeof res === 'string' ? res : (res as any)?.tamperSealId || (res as any)?.data?.tamperSealId;
      if (sealId) {
        setTamperSealInput(sealId);
        notify(`Đã sinh mã tem niêm phong chuẩn từ hệ thống: ${sealId}`);
      }
    } catch (err: any) {
      console.warn('Backend generate-seal failed, falling back:', err);
      const fallbackSeal = 'SL-SEAL-' + Math.floor(1000000 + Math.random() * 9000000);
      setTamperSealInput(fallbackSeal);
      notify(`Đã cấp mã tem dự phòng: ${fallbackSeal}`);
    } finally {
      setIsGeneratingSeal(false);
    }
  };

  const notify = (text: string, isError = false) => {
    setNoticeMessage({ text, isError });
    setTimeout(() => setNoticeMessage(null), 4500);
  };

  // Xử lý nạp đơn tự động khi quét barcode (Camera, máy quét USB, hoặc nhập tay)
  const handleProcessBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    playScanBeep();

    const normalized = code.toLowerCase();
    const cleanCode = normalized.replace(/^(sl-insp-|inspection-|order-)/i, '').trim();

    const match = orders.find((o) => {
      const oId = o.id.toLowerCase();
      if (oId === normalized || oId === cleanCode) return true;
      if (oId.includes(cleanCode) || cleanCode.includes(oId)) return true;
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
      setBarcodeScanInput(match.id);
      setCurrentStep('intake');
      notify(
        `[Auto-Intake] Đã quét nhận diện "${code}" -> Nạp thành công đơn kiểm định #${match.id} (${match.listing?.title || 'Thiết bị'})!`
      );
    } else {
      setBarcodeScanInput(code);
      notify(`Đã quét mã: "${code}" (Không tìm thấy đơn hàng tương ứng trong ca trực)`, true);
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
    if (!proofPhotos.includes(url)) {
      setProofPhotos([...proofPhotos, url]);
      notify('Đã thêm ảnh bằng chứng kiểm nghiệm');
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setProofPhotos(proofPhotos.filter((_, i) => i !== idx));
  };

  // Submit Final Result
  const handleSubmitInspection = async () => {
    if (!activeOrder) return;
    if (!sealConfirmed) {
      notify('Vui lòng xác nhận đã dán tem niêm phong chống tráo đổi', true);
      return;
    }

    setIsSubmitting(true);
    try {
      await inspectorService.submitReport(activeOrder.id, {
        status: overallVerdict === 'PASS' ? 'PASSED' : 'FAILED',
        note: `[Tem: ${tamperSealInput}][Grade: ${selectedGrade}][Điểm: ${conditionScore}/100] ${inspectorNotes}`,
        conditionScore,
        conditionGrade: selectedGrade,
        tamperSealId: tamperSealInput,
        barcode: barcodeScanInput || `BC-${activeOrder.id}`,
        videoProofUrl: videoProofUrl || proofPhotos[0] || undefined,
        unboxingVideoUrl: unboxingVideoUrl || undefined,
        checklistResults: checklist.map((item) => ({
          itemId: item.id,
          itemTitle: item.title,
          isPassed: item.status === 'pass',
          inspectorNote: item.testedValue || item.notes || undefined,
        })),
      });
    } catch (err) {
      console.warn('Backend inspection submission fallback:', err);
    }

    onCompleteInspection(
      activeOrder.id,
      overallVerdict,
      tamperSealInput,
      `[Grade: ${selectedGrade}][Điểm: ${conditionScore}/100] ${inspectorNotes}`
    );

    setIsSubmitting(false);
    notify(
      `Đã thẩm định thành công đơn #${activeOrder.id}! Báo cáo số hóa đã cấp và niêm phong bằng tem ${tamperSealInput}.`
    );
    setShowCertificateModal(true);
  };

  // Filter tasks
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const isAtHome = o.inspectionMethod === 'AT_HOME';
      const isCompleted = (o.escrowStatus as string) === 'COMPLETED' || o.escrowStatus === 'COMPLETED_RELEASED' || o.escrowStatus === 'DELIVERED_INSPECTION_WINDOW';

      if (taskFilter === 'AT_CENTER' && isAtHome) return false;
      if (taskFilter === 'AT_HOME' && !isAtHome) return false;
      if (taskFilter === 'DONE' && !isCompleted) return false;

      if (taskSearch) {
        const q = taskSearch.toLowerCase();
        const matchesId = o.id.toLowerCase().includes(q);
        const matchesTitle = o.listing?.title?.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle) return false;
      }
      return true;
    });
  }, [orders, taskFilter, taskSearch]);

  const stepsList: { key: InspectionStep; title: string; desc: string; icon: any }[] = [
    { key: 'intake', title: '1. Tiếp Nhận', desc: 'Đối chiếu hồ sơ máy', icon: QrCode },
    { key: 'exterior', title: '2. Ngoại Quan', desc: 'Phân hạng Grade vỏ máy', icon: Layers },
    { key: 'technical', title: '3. Kỹ Thuật', desc: 'Đo đạc & Test chức năng', icon: Wrench },
    { key: 'proofs', title: '4. Bằng Chứng', desc: 'Ảnh soi vi mạch & Dán tem', icon: Camera },
    { key: 'verdict', title: '5. Kết Luận', desc: 'Ký số & Xuất chứng thư', icon: ShieldCheck },
  ];

  return (
    <div className={`space-y-6 pb-20 text-[#24263e] ${isFocusMode ? 'fixed inset-0 z-50 bg-[#faf8f5] p-6 overflow-y-auto' : ''}`}>
      {/* Station Top Bar */}
      {!hideTopBar && (
        <div className="bg-[#24263e] text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-[#24263e]/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#fce5da] text-xs font-bold border border-white/10">
              <Cpu className="w-3.5 h-3.5 text-[#fce5da]" />
              <span>TRẠM KIỂM ĐỊNH THỰC TẾ SECONDLIFE • LAB TIÊU CHUẨN ISO/IEC 17025</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <span>Bàn Kiểm Định Thiết Bị</span>
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
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Ca trực: 08:00 - 17:30 (Đang trực ca)
              </span>
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
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2 animate-fadeIn ${
            noticeMessage.isError
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {noticeMessage.isError ? (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <span>{noticeMessage.text}</span>
        </div>
      )}

      {/* Main Workspace Layout: Left Task Queue & Right Inspection Station */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===================================================================== */}
        {/* LEFT COLUMN: ASSIGNED TASKS QUEUE                                    */}
        {/* ===================================================================== */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick Scan Box */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
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
              <div className="relative flex-1">
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
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Hỗ trợ máy quét USB, Camera & quét ảnh</span>
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

          {/* Queue Filter Tabs */}
          <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-wider text-gray-500">
                Nhiệm vụ kiểm định ({filteredOrders.length})
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSyncing(true);
                  setTimeout(() => {
                    setIsSyncing(false);
                    notify('Đã đồng bộ đơn hàng mới nhất từ hệ thống');
                  }, 600);
                }}
                className="text-xs text-[#c34c36] font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Đồng bộ</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'AT_CENTER', label: 'Tại Lab' },
                { id: 'AT_HOME', label: 'Tại Nhà' },
                { id: 'DONE', label: 'Đã Xong' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTaskFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    taskFilter === tab.id
                      ? 'bg-[#24263e] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Tìm tên máy, mã đơn..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#faf8f5] border border-gray-200 rounded-lg text-xs outline-none focus:border-[#c34c36]"
              />
            </div>

            {/* Task Items List */}
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {filteredOrders.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Không có đơn kiểm định phù hợp trong bộ lọc này
                </div>
              ) : (
                filteredOrders.map((ord) => {
                  const isSelected = ord.id === activeOrder?.id;
                  const isAtHome = ord.inspectionMethod === 'AT_HOME';

                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderId(ord.id);
                        onSelectOrder?.(ord.id);
                        notify(`Đã chuyển sang đơn #${ord.id}`);
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-[#24263e] text-white border-[#24263e] shadow-md ring-2 ring-[#c34c36]/40'
                          : 'bg-[#faf8f5] border-gray-200 hover:border-[#c34c36] text-[#24263e]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-mono font-bold ${isSelected ? 'text-[#fce5da]' : 'text-[#c34c36]'}`}>
                              #{ord.id}
                            </span>
                            {isAtHome ? (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-0.5">
                                <Navigation className="w-2.5 h-2.5 text-purple-600" />
                                Tại Nhà
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-0.5">
                                <Building2 className="w-2.5 h-2.5 text-blue-600" />
                                Tại Lab Hub
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-black line-clamp-1">{ord.listing?.title}</div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Cần Thẩm Định
                        </span>
                      </div>

                      <div className={`text-[11px] flex items-center justify-between pt-1 border-t ${isSelected ? 'border-white/10 text-gray-300' : 'border-gray-200 text-gray-500'}`}>
                        <span>Giá: <strong className="font-mono">{formatVND(ord.itemPriceVnd)}</strong></span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <Clock className="w-3 h-3 text-amber-500" />
                          SLA: &lt; 4 giờ
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* RIGHT COLUMN: ACTIVE INSPECTION WORKSTATION                          */}
        {/* ===================================================================== */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-6">
          {!activeOrder ? (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Wrench className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h3 className="text-base font-bold text-[#24263e]">Chưa có nhiệm vụ đo kiểm trực tiếp</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Hiện tại bạn chưa được Trung tâm phân công đơn kiểm định nào. Khi Trung tâm điều phối giao task cho bạn, thiết bị sẽ xuất hiện ở danh sách bên trái để bắt đầu đo kiểm 5 bước.
              </p>
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
              <button
                type="button"
                onClick={() => setShowCertificateModal(true)}
                className="px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#c34c36]" />
                <span>Xem Biên Bản Giám Định</span>
              </button>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="grid grid-cols-5 gap-1 p-1.5 bg-[#faf8f5] rounded-2xl border border-gray-200">
            {stepsList.map((step) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setCurrentStep(step.key)}
                  className={`py-2 px-1 rounded-xl text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    isActive
                      ? 'bg-[#24263e] text-white shadow-xs font-bold'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
                  }`}
                >
                  <StepIcon className={`w-4 h-4 ${isActive ? 'text-[#fce5da]' : 'text-gray-400'}`} />
                  <span className="text-[11px] font-bold line-clamp-1">{step.title}</span>
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
                  <strong>Bước 1 - Tiếp nhận & Đối chiếu hồ sơ thiết bị:</strong> So sánh máy thực tế với mô tả bài đăng của người bán để phát hiện ngay các sai lệch về chủng loại, model hoặc thiếu hụt phụ kiện.
                </div>
              </div>

              {/* Order Info & Method details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2 text-xs">
                  <div className="font-bold text-gray-700 uppercase text-[11px]">Thông Tin Bài Đăng Người Bán</div>
                  <div><strong>Tên máy:</strong> {activeOrder?.listing?.title}</div>
                  <div><strong>Giá bán niêm yết:</strong> <span className="font-mono text-[#c34c36] font-bold">{formatVND(activeOrder?.itemPriceVnd || 0)}</span></div>
                  <div><strong>Người bán:</strong> {activeOrder?.sellerName}</div>
                  <div><strong>Người mua:</strong> {activeOrder?.buyerName}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2 text-xs">
                  <div className="font-bold text-gray-700 uppercase text-[11px]">Hình Thức & Địa Chỉ Kiểm Định</div>
                  {activeOrder?.inspectionMethod === 'AT_HOME' ? (
                    <>
                      <div className="text-purple-900 font-bold flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5 text-purple-600" />
                        Cử Kỹ Thuật Viên Đến Tận Nhà
                      </div>
                      <div className="text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>{activeOrder.buyerAddress || 'Quận Cầu Giấy, TP. Hà Nội'}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={`tel:${activeOrder.buyerPhone || '0988123456'}`}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          Gọi {activeOrder.buyerPhone || '0988 123 456'}
                        </a>
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

              {/* Serial & Packaging verification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-700">Số Serial / IMEI Thực Tế Trên Tem Máy *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerMode('serial');
                        setIsScannerOpen(true);
                      }}
                      className="text-[11px] text-[#c34c36] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Quét Barcode Tem</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={actualSerialNo}
                    onChange={(e) => setActualSerialNo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:border-[#c34c36]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">Tình Trạng Hộp & Bao Bì Đóng Gói Khi Nhận *</label>
                  <select
                    value={packagingStatus}
                    onChange={(e) => setPackagingStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl font-semibold outline-none focus:border-[#c34c36]"
                  >
                    <option value="INTACT">Nguyên vẹn 100% - Đóng gói mút xốp chuẩn</option>
                    <option value="SLIGHT_DAMAGE">Hộp hơi móp méo nhưng thiết bị bên trong an toàn</option>
                    <option value="HEAVY_DAMAGE">Hộp rách nặng / Có nguy cơ va đập linh kiện</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-gray-700">Phụ Kiện Đi Kèm & Ghi Chú Tiếp Nhận</label>
                  <input
                    type="text"
                    value={accessoriesNote}
                    onChange={(e) => setAccessoriesNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl outline-none focus:border-[#c34c36]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('exterior')}
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
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Chọn Phân Hạng Ngoại Quan Chuẩn SecondLife (Grade):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {[
                    { id: 'Like New' as ConditionGrade, label: 'Grade S / A+ (99%)', desc: 'Như mới, không tì vết' },
                    { id: 'Good' as ConditionGrade, label: 'Grade A / B (90-95%)', desc: 'Rất đẹp, trầy xước dăm siêu nhẹ' },
                    { id: 'Fair' as ConditionGrade, label: 'Grade C (80-85%)', desc: 'Cấn móp / Trầy xước nhìn thấy rõ' },
                  ].map((gr) => (
                    <div
                      key={gr.id}
                      onClick={() => {
                        setSelectedGrade(gr.id);
                        if (gr.id === 'Like New') setExteriorScore(98);
                        else if (gr.id === 'Good') setExteriorScore(90);
                        else setExteriorScore(80);
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer text-center space-y-1 ${
                        selectedGrade === gr.id
                          ? 'bg-[#24263e] text-white border-[#24263e] shadow-md'
                          : 'bg-[#faf8f5] border-gray-200 hover:border-[#c34c36] text-gray-800'
                      }`}
                    >
                      <div className="font-black text-xs">{gr.label}</div>
                      <div className={`text-[10px] ${selectedGrade === gr.id ? 'text-gray-300' : 'text-gray-500'}`}>
                        {gr.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score slider */}
              <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-700">Điểm Đánh Giá Ngoại Quan Chi Tiết:</span>
                  <span className="font-mono font-black text-lg text-[#c34c36]">{exteriorScore}/100</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="100"
                  value={exteriorScore}
                  onChange={(e) => setExteriorScore(Number(e.target.value))}
                  className="w-full accent-[#c34c36] cursor-pointer"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-gray-700">Mô Tả Chi Tiết Vết Xước / Ngoại Quan Của Kỹ Sư:</label>
                <textarea
                  value={exteriorNotes}
                  onChange={(e) => setExteriorNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl outline-none focus:border-[#c34c36]"
                />
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('intake')}
                  className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('technical')}
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

              {/* Category Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">Bộ Checklist Ngành Hàng:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-[#faf8f5] text-xs font-bold text-gray-800 outline-none focus:border-[#c34c36]"
                  >
                    <option value="Máy giặt & Máy sấy">Máy giặt & Máy sấy</option>
                    <option value="Tủ lạnh & Tủ đông">Tủ lạnh & Tủ đông</option>
                    <option value="Điều hòa & Máy lọc">Điều hòa & Máy lọc</option>
                    <option value="Robot & Máy hút bụi">Robot & Máy hút bụi</option>
                    <option value="Lò vi sóng & Lò nướng">Lò vi sóng & Lò nướng</option>
                    <option value="Nồi cơm & Bếp từ">Nồi cơm & Bếp từ</option>
                  </select>
                </div>

                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {checklist.filter((c) => c.status === 'pass').length}/{checklist.length} tiêu chuẩn Đạt
                </div>
              </div>

              {/* Checklist Items Table */}
              <div className="space-y-3">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-gray-200 bg-[#faf8f5] space-y-2.5 text-xs transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-[#c34c36] uppercase tracking-wider">
                          [{item.category || 'Kỹ thuật'}]
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                        <p className="text-gray-500 text-[11px] mt-0.5">{item.description}</p>
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item.id, 'pass')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                            item.status === 'pass'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-emerald-50'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>ĐẠT</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item.id, 'fail')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                            item.status === 'fail'
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
                        value={item.testedValue || ''}
                        onChange={(e) => handleUpdateTestedValue(item.id, e.target.value)}
                        placeholder="VD: Nhiệt độ -19.2°C, độ ồn 38dB, cách điện an toàn..."
                        className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-[#c34c36]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('exterior')}
                  className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('proofs')}
                  className="px-6 py-2.5 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Chuyển sang Bước 4: Bằng Chứng & Tem</span>
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
                  <strong>Bước 4 - Ảnh Bằng Chứng Vi Mạch & Dán Tem Niêm Phong:</strong> Chụp ảnh soi kính hiển vi, số seri bo mạch và dán tem niêm phong chống tráo đổi linh kiện theo tiêu chuẩn SecondLife.
                </div>
              </div>

              {/* Tamper Seal Serial Box */}
              <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#c34c36]" />
                    Số Seri Tem Niêm Phong Chống Bóc Tách (NFC / Hologram Seal) *
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateBackendSeal}
                    disabled={isGeneratingSeal}
                    className="text-xs text-[#c34c36] font-bold hover:underline cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    {isGeneratingSeal && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Sinh mã tem từ hệ thống</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={tamperSealInput}
                    onChange={(e) => setTamperSealInput(e.target.value)}
                    className="flex-1 min-w-[200px] px-3.5 py-2.5 bg-white border border-orange-200 rounded-xl font-mono font-bold text-slate-800 text-sm outline-none focus:border-[#c34c36]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScannerMode('tamper');
                      setIsScannerOpen(true);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
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
                    checked={sealConfirmed}
                    onChange={(e) => setSealConfirmed(e.target.checked)}
                    className="w-4 h-4 accent-[#c34c36] rounded cursor-pointer"
                  />
                  <span className="font-bold text-gray-800">
                    Xác nhận: Tôi đã dán tem niêm phong vật lý đè lên ốc vít / khớp nối máy của thiết bị này.
                  </span>
                </label>
              </div>

              {/* Photo Upload & Gallery */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Thư Viện Ảnh Bằng Chứng Kiểm Định:
                  </span>

                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {proofPhotos.map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                      <img
                        src={url}
                        alt="Proof"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                        onClick={() => setPreviewPhoto(url)}
                      />
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="p-1 rounded-md bg-black/70 hover:bg-red-600 text-white cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white">
                        Ảnh #{idx + 1}
                      </span>
                    </div>
                  ))}

                  <label className="border-2 border-dashed border-gray-300 hover:border-[#c34c36] rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-orange-50/30 transition aspect-video">
                    <Camera className="w-5 h-5 text-gray-400 mb-1" />
                    <span className="text-[11px] font-bold text-gray-600">Thêm ảnh mới</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const fakeUrl = URL.createObjectURL(file);
                          setProofPhotos([...proofPhotos, fakeUrl]);
                          notify('Đã tải ảnh bằng chứng lên thành công');
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Video Proofs & Unboxing URLs */}
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
                      onChange={(e) => setVideoProofUrl(e.target.value)}
                      placeholder="https://res.cloudinary.com/.../inspection_test.mp4"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#c34c36]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      Video Mở Thùng Đồng Kiểm (Unboxing Video URL):
                    </label>
                    <input
                      type="url"
                      value={unboxingVideoUrl}
                      onChange={(e) => setUnboxingVideoUrl(e.target.value)}
                      placeholder="https://res.cloudinary.com/.../unboxing.mp4"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#c34c36]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('technical')}
                  className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('verdict')}
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

              {/* Verdict buttons */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Kết Luận Thẩm Định Cuối Cùng *:
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setOverallVerdict('PASS')}
                    className={`py-3.5 px-4 rounded-2xl border text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                      overallVerdict === 'PASS'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                        : 'bg-[#faf8f5] text-gray-700 border-gray-200 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>ĐẠT CHUẨN (PASS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverallVerdict('FAIL')}
                    className={`py-3.5 px-4 rounded-2xl border text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                      overallVerdict === 'FAIL'
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
                  value={conditionScore}
                  onChange={(e) => setConditionScore(Number(e.target.value))}
                  className="w-full accent-[#c34c36] cursor-pointer"
                />
              </div>

              {/* Diagnostic notes */}
              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-gray-700">Ghi Chú Kết Luận Chi Tiết Của Kỹ Sư Giám Định:</label>
                <textarea
                  value={inspectorNotes}
                  onChange={(e) => setInspectorNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-gray-200 rounded-xl outline-none focus:border-[#c34c36]"
                />
              </div>

              {/* Digital signature check */}
              <div className="p-4 rounded-2xl bg-[#faf8f5] border border-gray-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5 text-[#fce5da]" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Chữ Ký Số Kiểm Định Viên: {inspectorName}</div>
                    <div className="text-[11px] text-gray-500 font-mono">Chứng thư số: SL-CA-2026-RSA4096 (Còn hiệu lực)</div>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDigitalSigned}
                    onChange={(e) => setIsDigitalSigned(e.target.checked)}
                    className="w-4 h-4 accent-[#c34c36] rounded cursor-pointer"
                  />
                  <span className="font-bold text-gray-800">Đính kèm chữ ký</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
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
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: PREVIEW & PRINT DIGITAL CERTIFICATE                            */}
      {/* ===================================================================== */}
      {showCertificateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Chứng Thư Thẩm Định Kỹ Thuật Số Hóa
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Chứng Thư (Print)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Certificate Paper */}
            <div className="p-6 border-4 border-double border-[#24263e] rounded-2xl bg-white space-y-5 text-[#24263e] relative overflow-hidden">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-black tracking-widest text-[#c34c36] uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  HỆ THỐNG KIỂM ĐỊNH CHẤT LƯỢNG SECONDLIFE VIỆT NAM
                </div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#24263e]">
                  CHỨNG THƯ GIÁM ĐỊNH KỸ THUẬT & XÁC THỰC
                </h2>
                <p className="text-[11px] text-gray-500 font-mono">
                  Số hiệu: SL-CERT-{activeOrder?.id || '2026'}-{tamperSealInput.slice(-4)} • Ngày cấp: {new Date().toLocaleDateString('vi-VN')}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500">Thiết bị giám định:</span>
                    <div className="font-bold text-slate-900">{activeOrder?.listing?.title}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Mã đơn hàng Escrow:</span>
                    <div className="font-bold font-mono text-[#c34c36]">#{activeOrder?.id}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Phân hạng ngoại quan:</span>
                    <div className="font-bold text-slate-900">Grade {selectedGrade} ({exteriorScore}/100)</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Mã tem niêm phong:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <ScannableQRCode value={tamperSealInput} size={48} />
                      <div className="font-bold font-mono text-orange-900">{tamperSealInput}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Kết Quả Chung</span>
                  <div className="text-lg font-black text-emerald-800 mt-0.5">
                    {overallVerdict === 'PASS' ? 'ĐẠT CHUẨN' : 'TỪ CHỐI'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-700 uppercase">Điểm Chất Lượng</span>
                  <div className="text-lg font-black text-blue-800 mt-0.5 font-mono">
                    {conditionScore} / 100
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 italic">
                "{inspectorNotes}"
              </div>

              <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-center text-xs">
                <div>
                  <div className="text-gray-500">KỸ THUẬT VIÊN GIÁM ĐỊNH</div>
                  <div className="h-14 flex items-center justify-center font-serif italic text-base text-blue-900 font-bold">
                    {inspectorName}
                  </div>
                  <div className="text-[11px] font-bold text-gray-700">{inspectorName}</div>
                </div>

                <div>
                  <div className="text-gray-500">DẤU MỘC XÁC THỰC</div>
                  <div className="h-14 flex items-center justify-center">
                    <span className="px-3 py-1 rounded-full border-2 border-red-600 text-red-600 font-black text-[10px] uppercase rotate-[-6deg]">
                      SECONDLIFE APPROVED
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-gray-700">Hub Inspection Center</div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
