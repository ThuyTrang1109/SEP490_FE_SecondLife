import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Check,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  Eye,
  Info,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { staffListingService } from '../../services/staffListingService';
import { StaffListingItemDTO } from '../../types';
import { formatVND } from '../../utils/translations';

interface ListingComparisonModalProps {
  postId: string;
  onClose: () => void;
  onActionSuccess: (msg: string) => void;
}

interface DuplicateMatchItem {
  postId: string;
  data: StaffListingItemDTO | null;
  notFound: boolean;
  isLoading: boolean;
}

export const ListingComparisonModal: React.FC<ListingComparisonModalProps> = ({
  postId,
  onClose,
  onActionSuccess,
}) => {
  const [currentPost, setCurrentPost] = useState<StaffListingItemDTO | null>(null);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const [currentError, setCurrentError] = useState<string | null>(null);

  // Duplicate matched posts
  const [matchedPosts, setMatchedPosts] = useState<DuplicateMatchItem[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // Approve / Reject state
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState(
    'Ảnh sản phẩm trùng với bài đăng khác trên hệ thống; vui lòng cung cấp ảnh thực tế của sản phẩm.'
  );
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Active photo gallery view
  const [activePhotoCurrent, setActivePhotoCurrent] = useState<string>('');
  const [activePhotoMatch, setActivePhotoMatch] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    setIsLoadingCurrent(true);
    setCurrentError(null);

    staffListingService
      .getStaffListingDetail(postId)
      .then((detail) => {
        if (!isMounted) return;
        setCurrentPost(detail);
        if (detail.imageUrls && detail.imageUrls.length > 0) {
          setActivePhotoCurrent(detail.imageUrls[0]);
        } else if (detail.imageUrl) {
          setActivePhotoCurrent(detail.imageUrl);
        }

        // Fetch duplicate matches
        const dupIds = detail.duplicateMatches || [];
        if (dupIds.length > 0) {
          const initialMatches: DuplicateMatchItem[] = dupIds.map((id) => ({
            postId: id,
            data: null,
            notFound: false,
            isLoading: true,
          }));
          setMatchedPosts(initialMatches);

          // Parallel fetch each matched post
          dupIds.forEach((dupId, idx) => {
            staffListingService
              .getStaffListingDetail(dupId)
              .then((dupData) => {
                if (!isMounted) return;
                setMatchedPosts((prev) => {
                  const updated = [...prev];
                  updated[idx] = {
                    postId: dupId,
                    data: dupData,
                    notFound: false,
                    isLoading: false,
                  };
                  return updated;
                });
                if (idx === 0) {
                  const firstImg = dupData.imageUrls?.[0] || dupData.imageUrl || '';
                  setActivePhotoMatch(firstImg);
                }
              })
              .catch((err: any) => {
                if (!isMounted) return;
                const is404 = err?.status === 404 || err?.message?.includes('404');
                setMatchedPosts((prev) => {
                  const updated = [...prev];
                  updated[idx] = {
                    postId: dupId,
                    data: null,
                    notFound: is404,
                    isLoading: false,
                  };
                  return updated;
                });
              });
          });
        } else {
          setMatchedPosts([]);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setCurrentError(err?.message || 'Không thể tải chi tiết bài đăng.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingCurrent(false);
      });

    return () => {
      isMounted = false;
    };
  }, [postId]);

  const handleApprove = async () => {
    if (!currentPost) return;
    setIsApproving(true);
    try {
      await staffListingService.approveStaffListing(currentPost.postId);
      onActionSuccess(`Đã phê duyệt bài đăng "${currentPost.title}" thành công!`);
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi phê duyệt bài đăng. Vui lòng thử lại.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPost) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setRejectError('Vui lòng nhập lý do từ chối.');
      return;
    }
    if (trimmed.length > 2000) {
      setRejectError('Lý do từ chối tối đa 2000 ký tự.');
      return;
    }

    setIsRejecting(true);
    setRejectError(null);
    try {
      await staffListingService.rejectStaffListing(currentPost.postId, trimmed);
      onActionSuccess(`Đã từ chối bài đăng "${currentPost.title}" với lý do: "${trimmed}"`);
      onClose();
    } catch (err: any) {
      setRejectError(err?.message || 'Lỗi khi từ chối bài đăng.');
    } finally {
      setIsRejecting(false);
    }
  };

  const activeMatchedPost = matchedPosts[activeMatchIndex] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-gray-200 flex flex-col my-auto text-[#24263e]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#ffe8d6] to-[#faf8f5] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#c34c36] text-white flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                  Thẩm Định & Đối Soát Bài Đăng Nghi Trùng (Staff Review)
                </h3>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded-md border border-slate-300 font-bold">
                  #{postId.slice(0, 12)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh trực quan 2 cột giữa bài chờ duyệt và các bài đối chiếu nghi trùng lặp ảnh / nội dung
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/80 text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-5 text-xs">
          {isLoadingCurrent ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#c34c36]" />
              <span className="font-bold text-sm">Đang tải dữ liệu bài đăng và các bài đối chiếu...</span>
            </div>
          ) : currentError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{currentError}</span>
            </div>
          ) : currentPost ? (
            <>
              {/* Review Reason Banner */}
              {currentPost.reviewReason && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-xs">Cảnh báo nghi trùng từ hệ thống kiểm duyệt:</span>
                    <p className="text-[11px] text-amber-900 mt-0.5">{currentPost.reviewReason}</p>
                  </div>
                </div>
              )}

              {/* TWO COLUMNS COMPARISON GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* COLUMN 1: BÀI CHỜ DUYỆT (PENDING) */}
                <div className="bg-[#faf8f5] p-4 sm:p-5 rounded-3xl border-2 border-orange-300 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-orange-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white font-black text-[10px] uppercase">
                        BÀI CHỜ DUYỆT
                      </span>
                      <span className="font-mono text-slate-700 font-bold text-[11px]">
                        #{currentPost.postId.slice(0, 10)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                      {currentPost.status}
                    </span>
                  </div>

                  {/* Photo Gallery Column 1 */}
                  <div className="space-y-2">
                    <div className="w-full h-56 rounded-2xl overflow-hidden bg-black/5 border border-slate-200 flex items-center justify-center">
                      {activePhotoCurrent ? (
                        <img
                          src={activePhotoCurrent}
                          alt="Ảnh bài duyệt"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-slate-400">Không có ảnh</span>
                      )}
                    </div>

                    {currentPost.imageUrls && currentPost.imageUrls.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 subtle-scrollbar">
                        {currentPost.imageUrls.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActivePhotoCurrent(img)}
                            className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                              activePhotoCurrent === img ? 'border-orange-600 shadow-xs' : 'border-gray-200 opacity-70'
                            }`}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-gray-200">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Tiêu đề bài đăng</span>
                      <h4 className="font-black text-slate-900 text-sm">{currentPost.title}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 block">Giá niêm yết:</span>
                        <strong className="text-orange-600 font-mono text-sm">{formatVND(currentPost.price)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Tình trạng máy:</span>
                        <span className="font-bold text-slate-700">{currentPost.itemCondition || 'USED'}</span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-black block mb-0.5">Mô tả sản phẩm:</span>
                      <p className="text-slate-700 text-xs leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap subtle-scrollbar p-2 bg-slate-50 rounded-xl">
                        {currentPost.description || 'Không có mô tả'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: CÁC BÀI ĐỐI CHIẾU NGHI TRÙNG (DUPLICATE MATCHES) */}
                <div className="bg-slate-50 p-4 sm:p-5 rounded-3xl border border-slate-300 space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-black text-[10px] uppercase">
                        BÀI ĐỐI CHIẾU ({matchedPosts.length})
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {matchedPosts.length > 0 ? 'Phát hiện nghi trùng' : 'Không có bài trùng'}
                      </span>
                    </div>

                    {matchedPosts.length > 1 && (
                      <div className="flex items-center gap-1">
                        {matchedPosts.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setActiveMatchIndex(idx);
                              const matchImg = matchedPosts[idx]?.data?.imageUrls?.[0] || matchedPosts[idx]?.data?.imageUrl || '';
                              setActivePhotoMatch(matchImg);
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              activeMatchIndex === idx
                                ? 'bg-[#24263e] text-white shadow-2xs'
                                : 'bg-white border text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Bài {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {matchedPosts.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                      <p className="font-bold text-slate-700">Không có bài đăng nghi trùng</p>
                      <p className="text-xs text-slate-400">
                        Bài đăng này không có ID trùng lặp nào trong danh sách đối chiếu của hệ thống.
                      </p>
                    </div>
                  ) : activeMatchedPost?.isLoading ? (
                    <div className="py-20 text-center text-slate-400 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-500" />
                      <p>Đang tải dữ liệu bài đối chiếu #{activeMatchedPost.postId.slice(0, 8)}...</p>
                    </div>
                  ) : activeMatchedPost?.notFound ? (
                    <div className="py-16 p-4 text-center bg-white rounded-2xl border border-dashed border-gray-300 space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="font-bold text-slate-700 text-xs">Bài đối chiếu không còn tồn tại</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        UUID: #{activeMatchedPost.postId}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Bài đăng đối chiếu có thể đã bị xóa hoặc ẩn khỏi cơ sở dữ liệu. Bạn vẫn có thể thẩm định bài chờ duyệt ở cột bên trái.
                      </p>
                    </div>
                  ) : activeMatchedPost?.data ? (
                    <>
                      {/* Photo Gallery Column 2 */}
                      <div className="space-y-2">
                        <div className="w-full h-56 rounded-2xl overflow-hidden bg-black/5 border border-slate-200 flex items-center justify-center">
                          {activePhotoMatch ? (
                            <img
                              src={activePhotoMatch}
                              alt="Ảnh bài đối chiếu"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-slate-400">Không có ảnh</span>
                          )}
                        </div>

                        {activeMatchedPost.data.imageUrls && activeMatchedPost.data.imageUrls.length > 1 && (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 subtle-scrollbar">
                            {activeMatchedPost.data.imageUrls.map((img, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActivePhotoMatch(img)}
                                className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                                  activePhotoMatch === img ? 'border-slate-800 shadow-xs' : 'border-gray-200 opacity-70'
                                }`}
                              >
                                <img src={img} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Details Column 2 */}
                      <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-black block">Tiêu đề đối chiếu</span>
                            <h4 className="font-black text-slate-900 text-sm">{activeMatchedPost.data.title}</h4>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {activeMatchedPost.data.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-slate-400 block">Giá niêm yết:</span>
                            <strong className="text-slate-800 font-mono text-sm">{formatVND(activeMatchedPost.data.price)}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Tình trạng:</span>
                            <span className="font-bold text-slate-700">{activeMatchedPost.data.itemCondition || 'USED'}</span>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-black block mb-0.5">Mô tả sản phẩm:</span>
                          <p className="text-slate-700 text-xs leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap subtle-scrollbar p-2 bg-slate-50 rounded-xl">
                            {activeMatchedPost.data.description || 'Không có mô tả'}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* REJECT FORM POPUP IF OPEN */}
              {showRejectForm && (
                <form onSubmit={handleReject} className="p-4 bg-rose-50 border border-rose-300 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Nhập lý do từ chối bài đăng (Gửi thông báo tới người bán):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                  </div>

                  {rejectError && (
                    <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-700 text-[11px] font-semibold">
                      {rejectError}
                    </div>
                  )}

                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nhập lý do cụ thể (tối đa 2000 ký tự)..."
                    className="w-full p-3 bg-white border border-rose-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500 shadow-2xs"
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {rejectReason.length} / 2000 ký tự
                    </span>
                    <button
                      type="submit"
                      disabled={isRejecting}
                      className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isRejecting ? 'Đang từ chối...' : 'Xác Nhận Từ Chối Tin'}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer Toolbar */}
        <div className="p-4 sm:p-5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-[#faf8f5] shrink-0">
          <div className="text-[11px] text-slate-500">
            {currentPost && (
              <span>
                Trạng thái hiện tại: <strong className="text-slate-800">{currentPost.status}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isApproving || isRejecting}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Đóng
            </button>

            {currentPost?.status === 'PENDING' && !showRejectForm && (
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={isApproving || isRejecting}
                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition cursor-pointer"
              >
                Từ Chối Tin
              </button>
            )}

            {currentPost?.status === 'PENDING' && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang duyệt...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Phê Duyệt Bài Đăng</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
