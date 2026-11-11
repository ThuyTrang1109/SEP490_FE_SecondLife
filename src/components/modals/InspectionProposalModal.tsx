import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  Building2,
  Coins,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
  Loader2,
  MapPin,
  Phone,
  Info,
  Truck,
  Home
} from 'lucide-react';
import {
  inspectorService,
  InspectionQuoteResponse,
  InspectionOrderDto
} from '../../services/inspectorService';
import { Listing, Language, UserProfile, InspectionCenter, InspectionProposalPrefillData } from '../../types';
import { formatVND } from '../../utils/translations';
import { formatLalamoveVehicle } from './CheckoutModal';
import { getReusableInspectionQuote, isInspectionQuoteExpired } from '../../utils/inspectionChatDraft';

interface InspectionProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing;
  currentUser?: UserProfile | null;
  lang: Language;
  negotiationId?: string;
  agreedPrice?: number;
  initialData?: InspectionProposalPrefillData | null;
  onSubmitSuccess: (order: InspectionOrderDto) => void;
}

export const InspectionProposalModal: React.FC<InspectionProposalModalProps> = ({
  isOpen,
  onClose,
  listing,
  currentUser,
  lang,
  negotiationId,
  agreedPrice,
  initialData,
  onSubmitSuccess,
}) => {
  // Center selection
  const [centers, setCenters] = useState<InspectionCenter[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>(initialData?.centerId || '');
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [centerError, setCenterError] = useState<string | null>(null);

  // Method selection
  const [inspectionMethod, setInspectionMethod] = useState<'AT_CENTER' | 'AT_HOME'>(
    initialData?.inspectionMethod || 'AT_CENTER'
  );

  // Quote state
  interface CenterQuotesState {
    centerId: string;
    centerQuote?: InspectionQuoteResponse | null;
    homeQuote?: InspectionQuoteResponse | null;
  }

  const [quotesState, setQuotesState] = useState<CenterQuotesState>(() => {
    const savedQuote = getReusableInspectionQuote(initialData, listing.id);
    if (!savedQuote || !initialData?.centerId) return { centerId: '' };
    return {
      centerId: initialData.centerId,
      centerQuote: initialData.inspectionMethod === 'AT_CENTER' ? savedQuote : (savedQuote.atCenterTotalFee ? savedQuote : null),
      homeQuote: initialData.inspectionMethod === 'AT_HOME' ? savedQuote : (savedQuote.atHomeTotalFee ? savedQuote : null),
    };
  });

  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuote409, setIsQuote409] = useState(false);
  const quoteRequestIdRef = useRef(0);
  const quoteController = useRef<AbortController | null>(null);
  const buyerLatitude = initialData?.buyerLatitude ?? currentUser?.latitude ?? undefined;
  const buyerLongitude = initialData?.buyerLongitude ?? currentUser?.longitude ?? undefined;

  // Proposal configuration
  const [feePayer, setFeePayer] = useState<'BUYER_PAYS' | 'SELLER_PAYS' | 'SPLIT_50_50'>(
    initialData?.feePayer || (initialData?.feeSplit === 'BUYER_100' ? 'BUYER_PAYS' : initialData?.feeSplit === 'SELLER_100' ? 'SELLER_PAYS' : 'SPLIT_50_50')
  );
  const [agreedZinLoss, setAgreedZinLoss] = useState(Boolean(initialData?.isZinLossAcknowledged));

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 1. Fetch Centers on Open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingCenters(true);
    setCenterError(null);

    inspectorService
      .getInspectionCenters()
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : [];
        setCenters(list);
        const userCity = (currentUser as any)?.city || currentUser?.provinceName || '';
        const preferred = list.find((c) => c.city && userCity && c.city.toLowerCase().includes(userCity.toLowerCase())) || list[0];
        setSelectedCenterId((id) => list.some((center) => center.id === id) ? id : (preferred?.id || ''));
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to load inspection centers:', err);
        setCenterError(lang === 'vi' ? 'Không tải được danh sách trung tâm kiểm định.' : 'Failed to load inspection centers.');
      })
      .finally(() => {
        if (isMounted) setLoadingCenters(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, (currentUser as any)?.city, currentUser?.provinceName, lang]);

  // 2. Fetch Quote when Center or Method changes
  const fetchQuote = useCallback(async (centerId: string, method: 'AT_CENTER' | 'AT_HOME') => {
    if (!centerId || !listing.id) return;

    quoteController.current?.abort();
    const controller = new AbortController();
    quoteController.current = controller;
    const reqId = ++quoteRequestIdRef.current;
    setLoadingQuote(true);
    setQuoteError(null);
    setIsQuote409(false);
    setSubmitError(null);

    try {
      let q: InspectionQuoteResponse | null = null;
      let quoteErr: any = null;

      // Always try AT_CENTER first because BE computes both AT_CENTER (with Lalamove shipping) and AT_HOME packages
      try {
        q = await inspectorService.getQuote({
          postId: listing.id,
          inspectionCenterId: centerId,
          orderType: 'AT_CENTER',
          buyerLatitude,
          buyerLongitude,
          negotiationId,
        }, { signal: controller.signal });
      } catch (err: any) {
        if (controller.signal.aborted) return;
        quoteErr = err;
        // If AT_CENTER failed (e.g. shipping address issue), try AT_HOME if method is AT_HOME
        if (method === 'AT_HOME') {
          try {
            q = await inspectorService.getQuote({
              postId: listing.id,
              inspectionCenterId: centerId,
              orderType: 'AT_HOME',
              buyerLatitude,
              buyerLongitude,
              negotiationId,
            }, { signal: controller.signal });
            quoteErr = null;
          } catch (homeErr) {
            quoteErr = homeErr;
          }
        }
      }

      if (controller.signal.aborted || reqId !== quoteRequestIdRef.current) return;

      if (!q) {
        throw quoteErr || new Error(lang === 'vi' ? 'Không thể lấy báo giá kiểm định.' : 'Could not fetch inspection quote.');
      }

      const hasCenter = Boolean(q.shippingQuote && (q.atCenterPackage?.totalFee || q.atCenterTotalFee));
      const hasHome = Boolean(q.atHomePackage?.totalFee || q.atHomeTotalFee);

      setQuotesState((prev) => {
        const isSameCenter = prev.centerId === centerId;
        return {
          centerId,
          centerQuote: hasCenter ? q : (isSameCenter ? prev.centerQuote : null),
          homeQuote: hasHome ? q : (isSameCenter ? prev.homeQuote : null),
        };
      });
    } catch (err: any) {
      if (controller.signal.aborted || reqId !== quoteRequestIdRef.current) return;
      console.warn('Failed to fetch inspection quote:', err);

      const status = err?.status || err?.response?.status;
      const msg = err?.message || '';

      if (status === 409 || msg.includes('409') || msg.includes('báo giá')) {
        setIsQuote409(true);
        setQuoteError(msg || (lang === 'vi' ? 'Không thể lấy báo giá kiểm định.' : 'Could not fetch the inspection quote.'));
      } else {
        setQuoteError(
          msg || (lang === 'vi' ? 'Không thể lấy báo giá kiểm định từ trung tâm.' : 'Could not fetch quote from center.')
        );
      }
    } finally {
      if (!controller.signal.aborted && reqId === quoteRequestIdRef.current) {
        setLoadingQuote(false);
      }
    }
  }, [listing.id, buyerLatitude, buyerLongitude, negotiationId, lang]);

  useEffect(() => {
    if (!isOpen || !selectedCenterId) return;

    const hasCenterQuote =
      quotesState.centerId === selectedCenterId &&
      Boolean(quotesState.centerQuote) &&
      !isInspectionQuoteExpired(quotesState.centerQuote!, 'AT_CENTER');

    const hasHomeQuote =
      quotesState.centerId === selectedCenterId &&
      Boolean(quotesState.homeQuote || quotesState.centerQuote?.atHomeTotalFee);

    const needQuote =
      quotesState.centerId !== selectedCenterId ||
      (inspectionMethod === 'AT_CENTER' && !hasCenterQuote) ||
      (inspectionMethod === 'AT_HOME' && !hasHomeQuote);

    if (needQuote) {
      void fetchQuote(selectedCenterId, inspectionMethod);
    }
    return () => quoteController.current?.abort();
  }, [selectedCenterId, inspectionMethod, isOpen, fetchQuote, quotesState]);

  if (!isOpen) return null;

  // Selected center entity
  const selectedCenter = centers.find((c) => c.id === selectedCenterId) ||
    (initialData?.centerId === selectedCenterId && initialData?.centerName ? {
      name: initialData.centerName,
      phone: initialData.centerPhone,
      address: initialData.centerAddress,
    } : undefined);

  // Fee calculation from BE quote
  const isAtHome = inspectionMethod === 'AT_HOME';
  const currentCenterQuote = quotesState.centerId === selectedCenterId ? quotesState.centerQuote : null;
  const currentHomeQuote = quotesState.centerId === selectedCenterId ? (quotesState.homeQuote || quotesState.centerQuote) : null;
  const quote = isAtHome ? currentHomeQuote : currentCenterQuote;

  // AT_HOME package fees
  const atHomeBaseFee =
    currentHomeQuote?.baseInspectionFee ??
    (currentHomeQuote as any)?.baseFee ??
    currentCenterQuote?.baseInspectionFee ??
    (currentCenterQuote as any)?.baseFee ??
    0;
  const atHomeTravelFee =
    currentHomeQuote?.atHomePackage?.travelFeeRoundTrip ??
    currentHomeQuote?.travelFeeRoundTrip ??
    currentCenterQuote?.atHomePackage?.travelFeeRoundTrip ??
    currentCenterQuote?.travelFeeRoundTrip ??
    0;
  const atHomeTravelDistance =
    currentHomeQuote?.atHomePackage?.distanceKm ??
    currentHomeQuote?.travelDistanceKm ??
    currentCenterQuote?.atHomePackage?.distanceKm ??
    currentCenterQuote?.travelDistanceKm ??
    0;
  const atHomeQuotedTotal =
    currentHomeQuote?.atHomePackage?.totalFee ??
    currentHomeQuote?.atHomeTotalFee ??
    currentCenterQuote?.atHomePackage?.totalFee ??
    currentCenterQuote?.atHomeTotalFee ??
    (atHomeBaseFee > 0 ? atHomeBaseFee + atHomeTravelFee : undefined);
  const atHomeTotalFee = atHomeQuotedTotal ?? 0;

  // AT_CENTER package fees
  const atCenterBaseFee =
    currentCenterQuote?.baseInspectionFee ??
    (currentCenterQuote as any)?.baseFee ??
    atHomeBaseFee;
  const atCenterOutboundFee =
    currentCenterQuote?.shippingQuote?.outbound?.shippingFee ??
    currentCenterQuote?.shippingToCenterFee ??
    currentCenterQuote?.atCenterPackage?.shippingToCenterFee ??
    0;
  const atCenterReturnFee =
    currentCenterQuote?.shippingQuote?.returnReserve?.shippingFee ??
    currentCenterQuote?.returnShippingReserveFee ??
    currentCenterQuote?.atCenterPackage?.returnReserveFee ??
    0;
  const atCenterQuotedTotal =
    currentCenterQuote?.atCenterPackage?.totalFee ??
    currentCenterQuote?.atCenterTotalFee ??
    (currentCenterQuote?.shippingQuote ? atCenterBaseFee + atCenterOutboundFee + atCenterReturnFee : undefined);
  const atCenterTotalFee = atCenterQuotedTotal ?? 0;

  const activeTotalFee = isAtHome ? atHomeTotalFee : atCenterTotalFee;
  const splitOptions = isAtHome
    ? (currentHomeQuote?.atHomeSplitOptions || currentCenterQuote?.atHomeSplitOptions)
    : currentCenterQuote?.atCenterSplitOptions;
  const halfFee = splitOptions?.SPLIT_50_50 ?? Math.round(activeTotalFee / 2);
  const formatQuotedFee = (fee: number | undefined) => (fee === undefined || fee === null ? '—' : formatVND(fee));

  // Split calculation
  let buyerShare = 0;
  let sellerShare = 0;
  if (feePayer === 'BUYER_PAYS') {
    buyerShare = activeTotalFee;
    sellerShare = 0;
  } else if (feePayer === 'SELLER_PAYS') {
    buyerShare = 0;
    sellerShare = activeTotalFee;
  } else {
    // SPLIT_50_50
    buyerShare = halfFee;
    sellerShare = activeTotalFee - buyerShare;
  }

  // Quote expiration
  const quoteExpiresAt = !isAtHome && currentCenterQuote?.shippingQuote?.expiresAt ? new Date(currentCenterQuote.shippingQuote.expiresAt) : null;
  const isQuoteExpired = !isAtHome && currentCenterQuote ? isInspectionQuoteExpired(currentCenterQuote, 'AT_CENTER') : false;

  // Submit Handler
  const handleSubmitProposal = async () => {
    if (!selectedCenterId) {
      setSubmitError(lang === 'vi' ? 'Vui lòng chọn trung tâm kiểm định tiếp nhận.' : 'Please select an inspection center.');
      return;
    }
    if (!quote || loadingQuote || isQuoteExpired) {
      setSubmitError(lang === 'vi' ? 'Báo giá chưa sẵn sàng hoặc đã hết hạn. Vui lòng thử lại.' : 'Quote is not ready or has expired.');
      return;
    }
    if (!agreedZinLoss) {
      setSubmitError(lang === 'vi' ? 'Vui lòng xác nhận đồng ý điều khoản kiểm định và mở niêm phong.' : 'Please agree to inspection terms.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const config = quote.inspectionConfiguration;
      const expectedFeeProposalId = config?.feeProposalId || undefined;
      const expectedChecklistTemplateId = config?.checklistTemplateId || undefined;
      const shippingQuoteId = isAtHome ? undefined : currentCenterQuote?.shippingQuote?.id;

      const order = await inspectorService.createRequest({
        postId: listing.id,
        orderType: inspectionMethod,
        inspectionCenterId: selectedCenterId,
        buyerLatitude,
        buyerLongitude,
        feePayer: feePayer,
        buyerConsentZin: true,
        buyerConsentZinLoss: true,
        expectedFeeProposalId,
        expectedChecklistTemplateId,
        inspectionShippingQuoteId: shippingQuoteId,
        negotiationId: negotiationId || undefined,
      });

      const enrichedOrder: InspectionOrderDto = {
        ...order,
        inspectionFee: order?.inspectionFee ?? (isAtHome ? atHomeBaseFee : atCenterBaseFee),
        shippingFee: order?.shippingFee ?? (isAtHome ? 0 : atCenterOutboundFee),
        travelFee: order?.travelFee ?? (isAtHome ? atHomeTravelFee : 0),
        travelFeeRoundTrip: order?.travelFeeRoundTrip ?? (isAtHome ? atHomeTravelFee : 0),
        travelDistanceKm: order?.travelDistanceKm ?? (isAtHome ? atHomeTravelDistance : 0),
        returnShippingReserveFee: order?.returnShippingReserveFee ?? (isAtHome ? 0 : atCenterReturnFee),
        buyerFeeShare: order?.buyerFeeShare ?? buyerShare,
        sellerFeeShare: order?.sellerFeeShare ?? sellerShare,
        inspectionCenterId: order?.inspectionCenterId || selectedCenterId,
        buyerConsentZin: true,
        orderType: inspectionMethod,
        feePayer: feePayer,
        postPrice: listing.priceVnd,
        postTitle: listing.title,
        postImageUrl: listing.photos?.front,
        ...(selectedCenter?.name ? { centerName: selectedCenter.name } : {}),
      } as any;

      onSubmitSuccess(enrichedOrder);
      onClose();
    } catch (err: any) {
      console.warn('Failed to submit inspection request:', err);
      const status = err?.status || err?.response?.status;
      const msg = err?.message || '';

      if (status === 409 || msg.includes('409') || msg.includes('báo giá')) {
        setIsQuote409(true);
        setSubmitError(
          lang === 'vi'
            ? 'Báo giá từ trung tâm đã thay đổi. Đang tải lại báo giá mới, vui lòng kiểm tra và xác nhận lại.'
            : 'Quote has changed. Refreshing quote, please review updated amount.'
        );
        fetchQuote(selectedCenterId, inspectionMethod);
      } else {
        setSubmitError(
          msg || (lang === 'vi' ? 'Không thể tạo yêu cầu kiểm định. Vui lòng thử lại.' : 'Failed to create inspection request.')
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-[680px] w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
        {/* HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-[#24263e] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
              <ShieldCheck className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                {lang === 'vi' ? 'Đề Xuất Kiểm Định Tại Trung Tâm' : 'Center Inspection Proposal'}
              </h3>
              <p className="text-[11px] text-blue-200 font-medium">
                {lang === 'vi' ? 'Thương lượng chi phí kiểm định an toàn 100% qua Escrow Hub' : 'Negotiate inspection fee safely via Escrow Hub'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* PRODUCT CARD MINI */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <img
              src={listing.photos?.front || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
              alt={listing.title}
              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-xs text-slate-800 truncate">{listing.title}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-black text-[#c34c36]">
                  {formatVND(agreedPrice && agreedPrice > 0 ? agreedPrice : listing.priceVnd)}
                </span>
                {agreedPrice && agreedPrice > 0 && agreedPrice !== listing.priceVnd && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    Giá đã chốt đàm phán
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 1. CHỌN TRUNG TÂM KIỂM ĐỊNH */}
          <div className="space-y-2 bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-[#24263e] uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'vi' ? '1. Chọn Trung Tâm Kiểm Định Tiếp Nhận' : '1. Select Inspection Center'}</span>
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">
                {centers.length} {lang === 'vi' ? 'trung tâm' : 'centers'}
              </span>
            </div>

            {loadingCenters ? (
              <div className="py-3 flex items-center justify-center gap-2 text-xs text-slate-500 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>{lang === 'vi' ? 'Đang tải danh sách trung tâm...' : 'Loading centers...'}</span>
              </div>
            ) : centerError ? (
              <p className="text-xs text-rose-600 font-bold p-2 bg-rose-50 rounded-xl border border-rose-200">
                {centerError}
              </p>
            ) : (
              <select
                value={selectedCenterId}
                onChange={(e) => setSelectedCenterId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800 outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
              >
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.city ? `(${c.city})` : ''}
                  </option>
                ))}
              </select>
            )}

            {selectedCenter && (
              <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#c34c36] shrink-0" />
                    <span>{selectedCenter.name}</span>
                  </span>
                  {selectedCenter.phone && (
                    <span className="text-[10px] font-semibold text-slate-600 shrink-0 flex items-center gap-0.5">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>{selectedCenter.phone}</span>
                    </span>
                  )}
                </div>
                {selectedCenter.address && (
                  <p className="text-[10px] text-slate-600 pl-4">{selectedCenter.address}</p>
                )}
                <div className="flex items-center gap-2 pl-4 pt-0.5 text-[9px] text-slate-500 font-medium">
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                    🔬 Trạm thẩm định chuẩn ISO/IEC 17025
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. CHỌN PHƯƠNG THỨC KIỂM ĐỊNH */}
          <div className="space-y-2 bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-[#24263e] uppercase tracking-wide flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'vi' ? '2. Phương Thức Kiểm Định' : '2. Inspection Method'}</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={() => setInspectionMethod('AT_CENTER')}
                className={`p-2.5 rounded-xl border-2 transition cursor-pointer text-left ${inspectionMethod === 'AT_CENTER'
                    ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
              >
                <div className="font-extrabold text-xs text-slate-800 flex items-center justify-between">
                  <span>🏢 {lang === 'vi' ? 'Đưa đến trung tâm' : 'At Center'}</span>
                  {inspectionMethod === 'AT_CENTER' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {lang === 'vi' ? 'Lalamove giao hàng tới Hub' : 'Lalamove to Hub'}
                </div>
                <div className="mt-1 font-black text-xs text-blue-700">
                  {formatQuotedFee(atCenterQuotedTotal)}
                </div>
              </div>

              <div
                onClick={() => setInspectionMethod('AT_HOME')}
                className={`p-2.5 rounded-xl border-2 transition cursor-pointer text-left ${inspectionMethod === 'AT_HOME'
                    ? 'border-purple-600 bg-purple-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
              >
                <div className="font-extrabold text-xs text-slate-800 flex items-center justify-between">
                  <span>🏠 {lang === 'vi' ? 'Cử người đến nhà' : 'On-site'}</span>
                  {inspectionMethod === 'AT_HOME' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {lang === 'vi' ? 'Kỹ thuật viên tới nhà người bán' : 'Technician to seller'}
                </div>
                <div className="mt-1 font-black text-xs text-purple-700">
                  {formatQuotedFee(atHomeQuotedTotal)}
                </div>
              </div>
            </div>
          </div>

          {/* 3. CHI TIẾT BÁO GIÁ KIỂM ĐỊNH */}
          <div className="space-y-2 bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-[#24263e] uppercase tracking-wide flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {inspectionMethod === 'AT_HOME'
                    ? (lang === 'vi' ? '3. Báo Giá Kiểm Định Tại Nhà' : '3. On-site Inspection Fees')
                    : (lang === 'vi' ? '3. Báo Giá Kiểm Định Tại Trung Tâm' : '3. Center Inspection Fees')}
                </span>
              </label>
              {quoteExpiresAt && !isQuoteExpired && (
                <span className="text-[10px] text-slate-400 font-medium">
                  {lang === 'vi' ? 'Hạn báo giá:' : 'Valid until:'}{' '}
                  {quoteExpiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {loadingQuote && !quote ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-500 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>{lang === 'vi' ? 'Đang gọi API Lalamove & tính biểu phí...' : 'Calculating quotation...'}</span>
              </div>
            ) : quoteError && !quote ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-800">
                <div className="flex items-start gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{quoteError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchQuote(selectedCenterId, inspectionMethod)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{lang === 'vi' ? 'Lấy lại báo giá' : 'Refresh Quote'}</span>
                </button>
              </div>
            ) : !quote ? (
              <p className="text-xs text-slate-500">{lang === 'vi' ? 'Chưa có báo giá kiểm định.' : 'No inspection quote yet.'}</p>
            ) : inspectionMethod === 'AT_HOME' ? (
              <div className="space-y-2 text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
                {/* Dòng 1: Phí kiểm định cơ sở */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600">• {lang === 'vi' ? 'Phí kiểm định' : 'Inspection fee'}:</span>
                  <strong className="text-slate-900 font-bold">{formatVND(atHomeBaseFee)}</strong>
                </div>

                {/* Dòng 2: Phí di chuyển KTV đến nhà */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600 flex items-center gap-1">
                    <span>• {lang === 'vi' ? 'Phí di chuyển KTV đến nhà' : 'Technician travel fee'}:</span>
                    {atHomeTravelDistance > 0 && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-semibold">
                        {lang === 'vi' ? `Khứ hồi (${atHomeTravelDistance} km)` : `Round-trip (${atHomeTravelDistance} km)`}
                      </span>
                    )}
                  </span>
                  <strong className="text-slate-900 font-bold">{formatVND(atHomeTravelFee)}</strong>
                </div>

                {/* Dòng 3: Tổng phí thu trước */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm font-extrabold text-purple-900">
                  <span>• {lang === 'vi' ? 'Tổng phí thu trước' : 'Total upfront fee'}:</span>
                  <span className="font-black text-purple-700 text-base">{formatVND(atHomeTotalFee)}</span>
                </div>

                {/* Ghi chú */}
                <div className="text-[11px] text-slate-600 italic bg-purple-50/70 p-2 rounded-lg border border-purple-100 flex items-start gap-1.5 leading-snug">
                  <Info className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'vi'
                      ? 'Kỹ thuật viên mang thiết bị thẩm định tới tận địa chỉ người bán để kiểm tra toàn bộ linh kiện theo checklist.'
                      : 'Technician visits seller location with testing equipment.'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
                {/* Dòng 1: Phí kiểm định */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600">• {lang === 'vi' ? 'Phí kiểm định' : 'Inspection fee'}:</span>
                  <strong className="text-slate-900 font-bold">{formatVND(atCenterBaseFee)}</strong>
                </div>

                {/* Dòng 2: Cước Seller → Trung tâm */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600 flex items-center gap-1">
                    <span>• {lang === 'vi' ? 'Cước Seller → Trung tâm' : 'Seller → Center shipping'}:</span>
                    {currentCenterQuote?.shippingQuote?.outbound?.serviceType && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                        {formatLalamoveVehicle(currentCenterQuote.shippingQuote.outbound.serviceType).name}
                      </span>
                    )}
                  </span>
                  <strong className="text-slate-900 font-bold">{formatVND(atCenterOutboundFee)}</strong>
                </div>

                {/* Dòng 3: Tạm giữ dự phòng cước trả về Seller */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600 flex items-center gap-1">
                    <span>• {lang === 'vi' ? 'Tạm giữ dự phòng cước trả về Seller' : 'Return reserve fee'}:</span>
                    {currentCenterQuote?.shippingQuote?.returnReserve?.serviceType && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                        {formatLalamoveVehicle(currentCenterQuote.shippingQuote.returnReserve.serviceType).name}
                      </span>
                    )}
                  </span>
                  <strong className="text-slate-900 font-bold">{formatVND(atCenterReturnFee)}</strong>
                </div>

                {/* Dòng 4: Tổng phí thu trước */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm font-extrabold text-blue-900">
                  <span>• {lang === 'vi' ? 'Tổng phí thu trước' : 'Total upfront fee'}:</span>
                  <span className="font-black text-blue-700 text-base">{formatVND(atCenterTotalFee)}</span>
                </div>

                {/* Ghi chú về hoàn cước dự phòng */}
                <div className="text-[11px] text-slate-600 italic bg-blue-50/70 p-2 rounded-lg border border-blue-100 flex items-start gap-1.5 leading-snug">
                  <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'vi'
                      ? 'Dự phòng cước trả về sẽ được hoàn nếu Buyer mua tiếp hoặc hoàn phần dư sau khi đối soát cước trả hàng.'
                      : 'Return shipping reserve will be refunded if you proceed with purchase, or residual balance refunded after return shipping reconciliation.'}
                  </span>
                </div>

                {isQuoteExpired && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center justify-between">
                    <span>⏰ {lang === 'vi' ? 'Báo giá đã hết hạn' : 'Quote expired'}</span>
                    <button
                      type="button"
                      onClick={() => fetchQuote(selectedCenterId, inspectionMethod)}
                      className="px-2 py-0.5 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 cursor-pointer text-[10px]"
                    >
                      {lang === 'vi' ? 'Cập nhật giá mới' : 'Refresh'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. PHÂN CHIA TIỀN KIỂM ĐỊNH (3 LỰA CHỌN) */}
          <div className="space-y-2 bg-[#faf8f5] p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-[#24263e] uppercase tracking-wide flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-indigo-600" />
                <span>{lang === 'vi' ? '4. Phương Án Chia Phí Kiểm Định' : '4. Fee Split Options'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {/* Option 1: Người mua 100% */}
              <div
                onClick={() => setFeePayer('BUYER_PAYS')}
                className={`p-2.5 rounded-xl border-2 transition cursor-pointer text-center ${feePayer === 'BUYER_PAYS'
                    ? 'border-[#c34c36] bg-orange-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
              >
                <div className="font-extrabold text-xs text-slate-800">
                  {lang === 'vi' ? 'Người mua 100%' : 'Buyer 100%'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {lang === 'vi' ? 'Bạn chịu toàn bộ' : 'You pay full'}
                </div>
                <div className="mt-1 font-bold text-xs text-[#c34c36]">{formatQuotedFee(quote ? activeTotalFee : undefined)}</div>
              </div>

              {/* Option 2: Chia đôi 50% - 50% */}
              <div
                onClick={() => setFeePayer('SPLIT_50_50')}
                className={`p-2.5 rounded-xl border-2 transition cursor-pointer text-center relative ${feePayer === 'SPLIT_50_50'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
              >
                <span className="absolute -top-2 right-2 bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase">
                  Khuyên Dùng
                </span>
                <div className="font-extrabold text-xs text-slate-800">
                  {lang === 'vi' ? 'Chia đôi 50% - 50%' : 'Split 50% - 50%'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {lang === 'vi' ? 'Mỗi bên một nửa' : 'Half each'}
                </div>
                <div className="mt-1 font-bold text-xs text-indigo-700">
                  {formatQuotedFee(quote ? halfFee : undefined)}
                </div>
              </div>

              {/* Option 3: Người bán 100% */}
              <div
                onClick={() => setFeePayer('SELLER_PAYS')}
                className={`p-2.5 rounded-xl border-2 transition cursor-pointer text-center ${feePayer === 'SELLER_PAYS'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
              >
                <div className="font-extrabold text-xs text-slate-800">
                  {lang === 'vi' ? 'Người bán 100%' : 'Seller 100%'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {lang === 'vi' ? 'Người bán chịu' : 'Seller pays'}
                </div>
                <div className="mt-1 font-bold text-xs text-emerald-700">0 đ</div>
              </div>
            </div>

            {/* Hiển thị chi tiết số tiền mỗi bên chịu */}
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500">{lang === 'vi' ? 'Bạn thanh toán:' : 'You pay:'}</span>{' '}
                <strong className="text-[#c34c36] font-black">{formatQuotedFee(quote ? buyerShare : undefined)}</strong>
              </div>
              <div>
                <span className="text-slate-500">{lang === 'vi' ? 'Người bán chịu:' : 'Seller pays:'}</span>{' '}
                <strong className="text-slate-800 font-bold">{formatQuotedFee(quote ? sellerShare : undefined)}</strong>
              </div>
            </div>
          </div>

          {/* 5. CAM KẾT ĐIỀU KHOẢN MỞ NIÊM PHONG (ZIN) */}
          <div
            onClick={() => setAgreedZinLoss(!agreedZinLoss)}
            className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-start gap-2.5 ${agreedZinLoss ? 'bg-emerald-50/70 border-emerald-400' : 'bg-amber-50/70 border-amber-300'
              }`}
          >
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border transition ${agreedZinLoss ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300'
                }`}
            >
              {agreedZinLoss && <Check className="w-3.5 h-3.5" />}
            </div>
            <div className="text-xs text-slate-700 leading-snug select-none">
              <strong className="font-bold text-slate-900 block mb-0.5">
                {lang === 'vi' ? 'Đồng ý mở niêm phong & kiểm tra kỹ thuật máy' : 'Consent to disassembly inspection'}
              </strong>
              <span>
                {lang === 'vi'
                  ? 'Tôi đồng ý để kỹ thuật viên trung tâm kiểm định mở niêm phong/máy để đánh giá chi tiết tình trạng linh kiện bên trong sản phẩm.'
                  : 'I agree for inspection center technicians to unseal and inspect internal components.'}
              </span>
            </div>
          </div>

          {/* SUBMIT ERROR */}
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{submitError}</span>
                {isQuote409 && (
                  <button
                    type="button"
                    onClick={() => fetchQuote(selectedCenterId, inspectionMethod)}
                    className="block mt-1.5 text-xs font-bold text-blue-700 underline cursor-pointer"
                  >
                    {lang === 'vi' ? 'Nhấn để tải lại số tiền mới' : 'Click to load updated fees'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            {lang === 'vi' ? 'Hủy Bỏ' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmitProposal}
            disabled={isSubmitting || loadingQuote || !quote || isQuoteExpired || !agreedZinLoss}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-[#24263e] hover:opacity-95 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{lang === 'vi' ? 'Đang gửi đề xuất...' : 'Sending Proposal...'}</span>
              </>
            ) : (
              <span>{lang === 'vi' ? 'Gửi đề xuất cho người bán' : 'Send Inspection Proposal'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
