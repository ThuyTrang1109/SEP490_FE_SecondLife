import React, { useState, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  ShieldAlert,
  Image as ImageIcon,
  Trash2,
  ArrowRight,
  Package,
  Layers,
  Calendar,
  DollarSign
} from 'lucide-react';
import {
  userReportService,
  ReportReasonCode,
  CreateReportRequestDto,
  UserReportResponseDto
} from '../../services/userReportService';
import { orderService } from '../../services/orderService';
import { OrderBackend } from '../../types';
import { getStoredUser } from '../../services';

interface UserReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  orderId?: string;
  itemTitle?: string;
  onSuccess?: (report?: UserReportResponseDto) => void;
  onNavigateToDisputes?: () => void;
}

const ORDER_REPORT_REASONS: { code: ReportReasonCode; label: string; desc: string }[] = [
  {
    code: 'MISLEADING_DESCRIPTION',
    label: 'Mô tả sai lệch / không đúng thực tế',
    desc: 'Thông tin sản phẩm, tình trạng hoặc thông số kỹ thuật bị khai man, che giấu lỗi.',
  },
  {
    code: 'RETURN_NOT_AS_DESCRIBED',
    label: 'Hàng nhận được hư hỏng / khác biệt',
    desc: 'Sản phẩm nhận được bị nứt vỡ, thiếu phụ kiện hoặc khác biệt hoàn toàn với tin đăng.',
  },
  {
    code: 'ITEM_NOT_RECEIVED',
    label: 'Chưa nhận được hàng',
    desc: 'Đơn hàng quá hạn cam kết nhưng chưa nhận được sản phẩm từ người bán/vận chuyển.',
  },
  {
    code: 'COUNTERFEIT',
    label: 'Hàng giả / hàng nhái',
    desc: 'Sản phẩm không chính hãng, nghi ngờ hàng nhái hoặc vi phạm bản quyền.',
  },
  {
    code: 'FRAUD',
    label: 'Dấu hiệu lừa đảo / gian lận',
    desc: 'Yêu cầu chuyển tiền ngoài sàn, thông tin thanh toán gian lận hoặc mạo danh.',
  },
  {
    code: 'LATE_HANDOVER',
    label: 'Chậm bàn giao hàng hóa',
    desc: 'Người bán không chịu gửi hàng đúng hạn cho đơn vị vận chuyển hoặc Hub kiểm định.',
  },
  {
    code: 'SELLER_CANCELLATION',
    label: 'Người bán tự ý hủy giao dịch',
    desc: 'Hủy đơn vô cớ hoặc ép người mua hủy đơn ngoài hệ thống.',
  },
  {
    code: 'OTHER',
    label: 'Lý do khác',
    desc: 'Các hành vi vi phạm tiêu chuẩn cộng đồng hoặc tranh chấp đơn hàng khác.',
  },
];

const LISTING_REPORT_REASONS: { code: ReportReasonCode; label: string; desc: string }[] = [
  {
    code: 'FRAUD',
    label: 'Dấu hiệu lừa đảo / gian lận',
    desc: 'Yêu cầu giao dịch ngoài sàn, gian lận thông tin hoặc chiếm đoạt tài sản.',
  },
  {
    code: 'MISLEADING_DESCRIPTION',
    label: 'Mô tả sai lệch / gian dối thông tin',
    desc: 'Thông tin sản phẩm, hình ảnh khai man hoặc không đúng thực tế.',
  },
  {
    code: 'DUPLICATE_LISTING',
    label: 'Bài đăng trùng lặp / spam',
    desc: 'Đăng lặp lại một sản phẩm nhiều lần làm loãng thị trường.',
  },
  {
    code: 'OTHER',
    label: 'Vi phạm khác',
    desc: 'Nội dung phản cảm, vi phạm tiêu chuẩn cộng đồng hoặc chính sách sàn.',
  },
];

export const UserReportModal: React.FC<UserReportModalProps> = ({
  isOpen,
  onClose,
  postId,
  orderId,
  itemTitle,
  onSuccess,
  onNavigateToDisputes,
}) => {
  const isTargetFixed = !!(orderId || postId);
  const [targetType, setTargetType] = useState<'ORDER' | 'LISTING'>(orderId ? 'ORDER' : postId ? 'LISTING' : 'ORDER');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orderId || '');
  const [selectedPostId, setSelectedPostId] = useState<string>(postId || '');
  const [buyerOrders, setBuyerOrders] = useState<OrderBackend[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const [reasonCode, setReasonCode] = useState<ReportReasonCode>('MISLEADING_DESCRIPTION');
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<UserReportResponseDto | null>(null);

  const fetchBuyerOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await orderService.getBuyerOrders(0, 50);
      const list = res?.content || [];
      // Lọc các đơn hàng đã thanh toán / ký quỹ (BE cấm khiếu nại đơn chưa thanh toán PENDING_PAYMENT)
      const eligible = list.filter(
        (o: OrderBackend) => o.status !== 'PENDING_PAYMENT' && (o as any).escrowStatus !== 'AWAITING_PAYMENT'
      );
      setBuyerOrders(eligible);
      if (eligible.length > 0) {
        setSelectedOrderId((prev) => prev || eligible[0].id);
      }
    } catch (err: any) {
      console.warn('Lỗi tải danh sách đơn hàng đã mua từ BE:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Reset form whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setSubmittedReport(null);
      setErrorMessage(null);
      setDescription('');
      setEvidenceUrls([]);

      if (orderId) {
        setTargetType('ORDER');
        setSelectedOrderId(orderId);
        setReasonCode('MISLEADING_DESCRIPTION');
      } else if (postId) {
        setTargetType('LISTING');
        setSelectedPostId(postId);
        setReasonCode('FRAUD');
      } else {
        setTargetType('ORDER');
        setReasonCode('MISLEADING_DESCRIPTION');
        setSelectedOrderId('');
        setSelectedPostId('');
        fetchBuyerOrders();
      }
    }
  }, [isOpen, orderId, postId]);

  if (!isOpen) return null;

  const currentReasons = targetType === 'ORDER' ? ORDER_REPORT_REASONS : LISTING_REPORT_REASONS;
  const selectedOrderObj = buyerOrders.find((o) => o.id === selectedOrderId);

  const handleTargetTypeChange = (type: 'ORDER' | 'LISTING') => {
    setTargetType(type);
    setErrorMessage(null);
    if (type === 'ORDER') {
      setReasonCode('MISLEADING_DESCRIPTION');
      if (buyerOrders.length === 0 && !orderId) {
        fetchBuyerOrders();
      } else if (buyerOrders.length > 0 && !selectedOrderId) {
        setSelectedOrderId(buyerOrders[0].id);
      }
    } else {
      setReasonCode('FRAUD');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`File "${file.name}" vượt quá kích thước 15MB cho phép.`);
        }
        const res = await userReportService.uploadEvidence(file);
        if (res?.evidenceUrl) {
          setEvidenceUrls((prev) => [...prev, res.evidenceUrl]);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tải lên file bằng chứng.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMessage(null);

    const storedUser = getStoredUser();
    if (storedUser?.role === 'seller') {
      setErrorMessage('Tài khoản người bán không có quyền thực hiện tạo khiếu nại.');
      return;
    }

    const finalOrderId = targetType === 'ORDER' ? (orderId || selectedOrderId) : undefined;
    const finalPostId = targetType === 'LISTING' ? (postId || selectedPostId) : undefined;

    if (targetType === 'ORDER' && !finalOrderId) {
      setErrorMessage('Vui lòng chọn đơn hàng cần tạo khiếu nại.');
      return;
    }

    if (targetType === 'LISTING' && !finalPostId?.trim()) {
      setErrorMessage('Vui lòng nhập hoặc chọn mã bài đăng cần báo cáo vi phạm.');
      return;
    }

    if (description.trim().length < 10) {
      setErrorMessage('Vui lòng mô tả chi tiết lý do khiếu nại (tối thiểu 10 ký tự).');
      return;
    }

    if (description.trim().length > 2000) {
      setErrorMessage('Nội dung mô tả vi phạm không được vượt quá 2000 ký tự.');
      return;
    }

    setIsSubmitting(true);
    try {
      let res: UserReportResponseDto;
      if (targetType === 'LISTING' && finalPostId) {
        // Gọi API chuyên dụng báo cáo bài đăng: POST /api/v1/reports/listings/{postId}
        let listingReason = 'OTHER';
        const rCode = String(reasonCode);
        if (rCode === 'FRAUD' || rCode === 'MISLEADING_DESCRIPTION' || rCode === 'DUPLICATE_LISTING' || rCode === 'OTHER') {
          listingReason = rCode;
        } else {
          listingReason = 'OTHER';
        }

        res = await userReportService.reportListing(finalPostId.trim(), {
          reasonCode: listingReason,
          description: description.trim(),
          evidenceUrls,
        });
      } else {
        const payload: CreateReportRequestDto = {
          orderId: finalOrderId,
          reasonCode,
          description: description.trim(),
          evidenceUrls,
        };
        res = await userReportService.createReport(payload);
      }

      setSubmittedReport(res);
      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err: any) {
      let msg = err?.response?.data?.message || err?.message || 'Gửi khiếu nại thất bại. Vui lòng thử lại sau.';
      if (/Provide exactly one of postId or orderId/i.test(msg)) {
        msg = 'Vui lòng chọn đúng đối tượng đơn hàng hoặc bài đăng cần khiếu nại.';
      } else if (/Only the buyer of this order can report it/i.test(msg)) {
        msg = 'Chỉ người mua của đơn hàng này mới có quyền tạo khiếu nại.';
      } else if (/An unpaid order cannot be reported as a purchase/i.test(msg)) {
        msg = 'Đơn hàng này chưa thanh toán nên không thể thực hiện khiếu nại.';
      } else if (/You cannot report your own listing or order/i.test(msg)) {
        msg = 'Bạn không thể tự khiếu nại bài đăng hoặc đơn hàng của chính mình.';
      } else if (/already awaiting review/i.test(msg)) {
        msg = 'Đối tượng này đã có một khiếu nại đang chờ xử lý với lý do tương tự.';
      }
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl text-[#24263e] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
              isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {isSuccess ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-black text-base text-[#24263e]">
                {isSuccess ? 'Gửi Khiếu Nại Thành Công' : 'Báo Cáo & Khiếu Nại'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isSuccess ? 'Hệ thống đã tiếp nhận yêu cầu của bạn' : 'Bảo vệ quyền lợi người dùng sàn SecondLife'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* 1. SUCCESS VIEW */}
        {isSuccess ? (
          <div className="py-4 px-1 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm ring-8 ring-emerald-50">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900">
                Khiếu Nại Của Bạn Đã Được Ghi Nhận!
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Đội ngũ Trọng tài & Trust & Safety của SecondLife sẽ thụ lý và phản hồi trong vòng <strong>24 giờ</strong>. Khoản thanh toán Escrow đang được bảo vệ an toàn.
              </p>
            </div>

            {/* Thông tin biên bản khiếu nại */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Mã hồ sơ:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  #{submittedReport?.id ? submittedReport.id.slice(0, 8).toUpperCase() : 'DISPUTE'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Đối tượng:</span>
                <span className="font-bold text-slate-800 line-clamp-1 max-w-[220px]">
                  {itemTitle
                    ? itemTitle
                    : targetType === 'ORDER'
                    ? selectedOrderObj?.postTitle || `Đơn hàng #${(selectedOrderId || orderId)?.slice(0, 8)}`
                    : `Bài đăng #${(selectedPostId || postId)?.slice(0, 8)}`}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Lý do vi phạm:</span>
                <span className="font-semibold text-rose-700">
                  {currentReasons.find((r) => r.code === reasonCode)?.label}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-medium">Trạng thái:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px]">
                  Đang Chờ Xem Xét (OPEN)
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              {onNavigateToDisputes && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToDisputes();
                  }}
                  className="flex-1 py-3 px-4 bg-[#24263e] hover:bg-[#1a1c2e] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Đến Trang Khiếu Nại Của Tôi</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          /* 2. FORM VIEW (Nhập khiếu nại) */
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit(e);
              }}
              className="space-y-4 flex-1 overflow-y-auto pr-1 text-xs"
            >
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* A. TARGET SELECTION */}
              {isTargetFixed ? (
                /* Đã xác định sẵn đối tượng từ ngoài (như từ danh sách đơn hàng hoặc trang chi tiết tin đăng) */
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs shrink-0">
                  <span className="text-slate-400 font-medium">Đối tượng khiếu nại:</span>
                  <div className="font-bold text-slate-800 line-clamp-1 mt-0.5">
                    {itemTitle ? itemTitle : orderId ? `Đơn hàng: #${orderId.slice(0, 8)}` : `Tin đăng: #${postId?.slice(0, 8)}`}
                  </div>
                </div>
              ) : (
                /* Mở tự do từ Trang Khiếu Nại: Cho phép chọn Đơn hàng hoặc Bài đăng */
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleTargetTypeChange('ORDER')}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        targetType === 'ORDER'
                          ? 'bg-white text-[#24263e] shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5 text-[#c34c36]" />
                      <span>Đơn Hàng Của Tôi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTargetTypeChange('LISTING')}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        targetType === 'LISTING'
                          ? 'bg-white text-[#24263e] shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Bài Đăng Vi Phạm</span>
                    </button>
                  </div>

                  {targetType === 'ORDER' ? (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Chọn đơn hàng cần khiếu nại <span className="text-rose-500">*</span>
                      </label>
                      {isLoadingOrders ? (
                        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin text-[#c34c36]" />
                          <span>Đang tải danh sách đơn hàng đã mua từ hệ thống...</span>
                        </div>
                      ) : buyerOrders.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                          Bạn chưa có đơn hàng nào đã thanh toán / ký quỹ để khiếu nại. (Chỉ áp dụng cho các đơn hàng đã thanh toán qua Escrow).
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <select
                            value={selectedOrderId}
                            onChange={(e) => setSelectedOrderId(e.target.value)}
                            className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-semibold text-slate-800"
                          >
                            {buyerOrders.map((ord) => (
                              <option key={ord.id} value={ord.id}>
                                [Đơn #{ord.id.slice(0, 8).toUpperCase()}] {ord.postTitle || 'Sản phẩm'} - {Number(ord.totalPaid || ord.finalPrice || 0).toLocaleString('vi-VN')} đ
                              </option>
                            ))}
                          </select>

                          {selectedOrderObj && (
                            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] flex items-center justify-between">
                              <div className="space-y-0.5 truncate pr-2">
                                <div className="font-bold text-slate-800 truncate">
                                  {selectedOrderObj.postTitle || 'Đơn hàng Escrow'}
                                </div>
                                <div className="text-slate-500 flex items-center gap-2">
                                  <span className="flex items-center gap-1 font-mono">
                                    <Package className="w-3 h-3 text-slate-400" />
                                    #{selectedOrderObj.id.slice(0, 8).toUpperCase()}
                                  </span>
                                  {selectedOrderObj.createdAt && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      {new Date(selectedOrderObj.createdAt).toLocaleDateString('vi-VN')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-black text-[#c34c36]">
                                  {Number(selectedOrderObj.totalPaid || selectedOrderObj.finalPrice || 0).toLocaleString('vi-VN')} đ
                                </div>
                                <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {selectedOrderObj.status}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Mã bài đăng / Tin đăng cần báo cáo <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={selectedPostId}
                        onChange={(e) => setSelectedPostId(e.target.value)}
                        placeholder="Nhập mã bài đăng (Post ID hoặc UUID)..."
                        className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-mono text-slate-800"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* B. REASON SELECTION */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Lý do khiếu nại <span className="text-rose-500">*</span>
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as ReportReasonCode)}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] font-semibold text-slate-800"
                >
                  {currentReasons.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1 italic">
                  {currentReasons.find((r) => r.code === reasonCode)?.desc}
                </p>
              </div>

              {/* C. DESCRIPTION */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Mô tả chi tiết vi phạm <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {description.trim().length}/2000 ký tự (Tối thiểu 10)
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Vui lòng cung cấp chi tiết sự việc, mốc thời gian, nội dung tin nhắn hoặc sai khác thực tế..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#24263e] leading-relaxed"
                />
              </div>

              {/* D. PRIVATE EVIDENCE UPLOAD */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Tải file bằng chứng riêng tư (ảnh, video nhận hàng)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Tối đa 15MB/file</span>
                </label>

                <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1">
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
                    ) : (
                      <Upload className="w-6 h-6 text-slate-400" />
                    )}
                    <div className="text-[11px] font-bold text-slate-700">
                      {isUploading ? 'Đang tải bằng chứng lên Backend...' : 'Bấm để chọn file hoặc kéo thả ảnh/video vào đây'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Hỗ trợ JPG, PNG, WEBP, MP4 (Bảo mật riêng tư chỉ Staff/Admin xem xét)
                    </div>
                  </div>
                </div>

                {/* Evidence List */}
                {evidenceUrls.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Đã tải lên ({evidenceUrls.length} tệp)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {evidenceUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-[10px] font-mono text-slate-600 truncate">
                              {url.split('/').pop() || `Tệp ${idx + 1}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvidence(idx)}
                            className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e)}
                  disabled={
                    isSubmitting ||
                    description.trim().length < 10 ||
                    (targetType === 'ORDER' && !orderId && !selectedOrderId) ||
                    (targetType === 'LISTING' && !postId && !selectedPostId.trim())
                  }
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Đang Gửi Khiếu Nại...' : 'Gửi Khiếu Nại Vi Phạm'}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
