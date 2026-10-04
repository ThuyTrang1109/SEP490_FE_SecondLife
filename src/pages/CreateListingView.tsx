import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  Info,
  RefreshCw,
  Loader2,
  Plus,
  Bot,
  X,
  Send,
  History,
  Coins,
  Check,
  ExternalLink,
  Tag,
  DollarSign
} from 'lucide-react';
import {
  ItemCategory,
  ConditionGrade,
  Listing,
  Language,
  CategoryBackend,
  ItemBackend
} from '../types';
import { translations, formatVND } from '../utils/translations';
import {
  mediaService,
  postService,
  categoryService,
  itemService,
  aiChatService,
  sellerCreditService,
  CreditBalanceResponseDto,
  ListingDraftResponse,
  AiPriceEstimationResponse,
  PostSubmitResponse
} from '../services';

interface CreateListingViewProps {
  onListingCreated: (newListing: Listing) => void;
  lang: Language;
  onCancel: () => void;
}

export const CreateListingView: React.FC<CreateListingViewProps> = ({
  onListingCreated,
  lang,
  onCancel
}) => {
  const t = translations[lang];

  // 5 Linear Steps matching Main Flow 1 Guide
  // Step 1: Chọn Category, Item & Tải 3-6 ảnh
  // Step 2: Mô tả AI & Chỉnh sửa / Chat
  // Step 3: Lưu Draft & Xác nhận mô tả
  // Step 4: Định giá AI (1 credit VALUATION) & Chọn giá bán
  // Step 5: Xem lại & Gửi đăng (1 credit LISTING khi ACTIVE)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Credit Balance State
  const [credits, setCredits] = useState<CreditBalanceResponseDto | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [isPurchasingCredits, setIsPurchasingCredits] = useState(false);

  // Category & Item from Backend
  const [backendCategories, setBackendCategories] = useState<CategoryBackend[]>([]);
  const [backendItems, setBackendItems] = useState<ItemBackend[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Basic Form State
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('Panasonic');
  const [model, setModel] = useState('');
  const [purchaseYear, setPurchaseYear] = useState<number>(2024);
  const [itemCondition, setItemCondition] = useState<string>('USED_GOOD');
  const [description, setDescription] = useState('');
  const [finalPriceVnd, setFinalPriceVnd] = useState<number>(2200000);

  // Images state: Raw files for FormData & previews
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=600&q=80'
  ]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Post & AI Session IDs from Backend
  const [postId, setPostId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiInitialMessage, setAiInitialMessage] = useState<string>('');
  const [draftPost, setDraftPost] = useState<ListingDraftResponse | null>(null);

  // Step Loading States
  const [isInitializingPost, setIsInitializingPost] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isAcceptingDescription, setIsAcceptingDescription] = useState(false);
  const [descriptionAccepted, setDescriptionAccepted] = useState(false);

  // AI Chat & Finalize states in Step 2
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'ai' | 'user'; text: string; time: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isFinalizingChat, setIsFinalizingChat] = useState(false);

  // AI Valuation in Step 4
  const [isEstimatingPrice, setIsEstimatingPrice] = useState(false);
  const [valuationResult, setValuationResult] = useState<AiPriceEstimationResponse | null>(null);
  const [valuationHistory, setValuationHistory] = useState<any[]>([]);
  const [showValuationHistory, setShowValuationHistory] = useState(false);
  const [valuationRequestId, setValuationRequestId] = useState<string>('');

  // Submit in Step 5
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [submitResult, setSubmitResult] = useState<PostSubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load Seller Credits
  const loadCredits = async () => {
    setIsLoadingCredits(true);
    try {
      const res = await sellerCreditService.getCredits();
      if (res) setCredits(res);
    } catch (err) {
      console.warn('Không tải được số dư credit:', err);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  useEffect(() => {
    loadCredits();
  }, []);

  // Quick Purchase Credit for testing
  const handleQuickBuyCredit = async () => {
    setIsPurchasingCredits(true);
    try {
      await sellerCreditService.createPurchase({ listingQuantity: 2, valuationQuantity: 2 });
      alert(lang === 'vi' ? 'Đã tạo yêu cầu mua 2 LISTING & 2 VALUATION thành công!' : 'Created purchase request for 2 LISTING & 2 VALUATION!');
      await loadCredits();
    } catch (err: any) {
      alert('Mua credit thất bại: ' + (err?.message || 'Lỗi server'));
    } finally {
      setIsPurchasingCredits(false);
    }
  };

  // Load Categories on mount
  useEffect(() => {
    setIsLoadingCategories(true);
    categoryService.getCategories()
      .then((catList) => {
        if (Array.isArray(catList) && catList.length > 0) {
          setBackendCategories(catList);
          setSelectedCategoryId(catList[0].id);
        }
      })
      .catch((err) => console.error('Lỗi tải danh mục:', err))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  // Load Items when category changes
  useEffect(() => {
    if (selectedCategoryId) {
      setIsLoadingItems(true);
      itemService.getItemsByCategory(selectedCategoryId)
        .then((itemList) => {
          if (Array.isArray(itemList) && itemList.length > 0) {
            setBackendItems(itemList);
            setSelectedItemId(itemList[0].id);
          } else {
            setBackendItems([]);
            setSelectedItemId('');
          }
        })
        .catch((err) => console.error('Lỗi tải items:', err))
        .finally(() => setIsLoadingItems(false));
    }
  }, [selectedCategoryId]);

  // Handle Photo File selection (multi-file or single-file)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    if (files.length === 0) return;

    const remainingSlots = 6 - photoPreviews.length;
    const toAdd: File[] = files.slice(0, remainingSlots > 0 ? remainingSlots : 0);

    const newPreviews = toAdd.map((f: File) => URL.createObjectURL(f));
    setPhotoFiles((prev) => [...prev, ...toAdd]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Convert URLs or files into Blob array for postService.initPost
  const prepareImageBlobs = async (): Promise<(File | Blob)[]> => {
    if (photoFiles.length >= 3) {
      return photoFiles.slice(0, 6);
    }
    // If user kept preview URLs (e.g. demo placeholders), fetch them as Blobs
    const blobs: (File | Blob)[] = [...photoFiles];
    for (const url of photoPreviews) {
      if (blobs.length >= 6) break;
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        try {
          const res = await fetch(url);
          const b = await res.blob();
          blobs.push(b);
        } catch {
          // ignore fetch fail
        }
      }
    }
    return blobs;
  };

  // =========================================================================
  // STEP 1: Init Post (POST /api/v1/posts/init with multipart/form-data)
  // =========================================================================
  const handleInitPost = async () => {
    if (!selectedCategoryId) {
      alert(lang === 'vi' ? 'Vui lòng chọn Danh mục sản phẩm' : 'Please select a Category');
      return;
    }
    if (photoPreviews.length < 3 || photoPreviews.length > 6) {
      alert(lang === 'vi' ? 'Vui lòng tải lên từ 3 đến 6 ảnh sản phẩm hợp lệ' : 'Please upload 3 to 6 product images');
      return;
    }

    setIsInitializingPost(true);
    try {
      const imageBlobs = await prepareImageBlobs();

      const initRes = await postService.initPost({
        categoryId: selectedCategoryId,
        itemId: selectedItemId || undefined,
        images: imageBlobs
      });

      if (initRes && initRes.postId) {
        setPostId(initRes.postId);
        setSessionId(initRes.sessionId);
        setAiInitialMessage(initRes.aiInitialMessage || initRes.aiDescription || '');

        // Fetch draft details from server (GET /api/v1/posts/{postId})
        try {
          const draftRes = await postService.getPost(initRes.postId);
          setDraftPost(draftRes);
          if (draftRes.title) setTitle(draftRes.title);
          if (draftRes.description) setDescription(draftRes.description);
          if (draftRes.aiDescription && !description) setDescription(draftRes.aiDescription);
          if (draftRes.itemCondition) setItemCondition(draftRes.itemCondition);
          if (draftRes.descriptionAccepted) setDescriptionAccepted(true);
        } catch (fetchErr) {
          console.warn('GET /posts/{postId} chưa sẵn sàng, dùng dữ liệu ban đầu:', fetchErr);
        }

        // Initialize Chat messages
        setChatMessages([
          {
            role: 'ai',
            text: initRes.aiInitialMessage || (lang === 'vi'
              ? 'Chào bạn! Tôi là Trợ lý AI SecondLife. Sau khi phân tích ảnh sản phẩm, tôi đã chuẩn bị sẵn mô tả ban đầu. Hãy trò chuyện với tôi nếu muốn bổ sung chi tiết bảo hành, phụ kiện hoặc tình trạng máy nhé!'
              : 'Hello! I am SecondLife AI Assistant. I have analyzed your product photos and prepared a draft description. Chat with me to add accessories or warranty details!'),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        setCurrentStep(2);
      } else {
        throw new Error('Hệ thống không trả về postId từ init');
      }
    } catch (err: any) {
      alert('Khởi tạo bài đăng thất bại: ' + (err?.message || 'Lỗi server'));
    } finally {
      setIsInitializingPost(false);
    }
  };

  // =========================================================================
  // STEP 2: Chat with AI & Finalize (POST /api/v1/ai/chat & /finalize-chat)
  // =========================================================================
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isSendingChat || !sessionId || !postId) return;

    const userText = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', text: userText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setIsSendingChat(true);

    try {
      const res = await aiChatService.chat(userText, sessionId, postId);
      const reply = res?.reply || (res as any)?.message || (lang === 'vi' ? 'Đã ghi nhận thông tin sản phẩm của bạn.' : 'Noted your item details.');
      setChatMessages((prev) => [
        ...prev,
        { role: 'ai', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'ai', text: 'Lỗi phản hồi AI: ' + (err?.message || 'Vui lòng thử lại.'), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleFinalizeChatAndSync = async () => {
    if (!sessionId || !postId) return;
    setIsFinalizingChat(true);
    try {
      await postService.finalizeChat(sessionId);
      // Re-fetch draft from backend to populate latest generated description
      const updatedDraft = await postService.getPost(postId);
      setDraftPost(updatedDraft);
      if (updatedDraft.description) {
        setDescription(updatedDraft.description);
      }
      alert(lang === 'vi' ? 'AI đã tổng hợp cuộc hội thoại và cập nhật mô tả thành công!' : 'AI summarized the chat into your description!');
    } catch (err: any) {
      alert('Hoàn tất chat thất bại: ' + (err?.message || 'Lỗi kết nối'));
    } finally {
      setIsFinalizingChat(false);
    }
  };

  // =========================================================================
  // STEP 3: Save Draft & Accept Description (PUT /draft & POST /accept-description)
  // =========================================================================
  const handleSaveAndAcceptDescription = async () => {
    if (!postId) return;
    if (!title.trim()) {
      alert(lang === 'vi' ? 'Vui lòng nhập Tiêu đề bài đăng' : 'Please enter Title');
      return;
    }
    if (!description.trim()) {
      alert(lang === 'vi' ? 'Vui lòng nhập hoặc áp dụng Mô tả sản phẩm' : 'Please enter Description');
      return;
    }

    setIsAcceptingDescription(true);
    try {
      // 1. PUT /api/v1/posts/{postId}/draft
      await postService.updateDraft(postId, {
        title: title.trim(),
        description: description.trim(),
        itemCondition: itemCondition || 'USED',
        price: null
      });

      // 2. POST /api/v1/posts/{postId}/accept-description
      const acceptRes = await postService.acceptDescription(postId, description.trim());
      setDescriptionAccepted(true);
      setDraftPost(acceptRes);

      // Successfully confirmed description -> Advance to Step 4
      setCurrentStep(4);
    } catch (err: any) {
      alert('Xác nhận mô tả thất bại: ' + (err?.message || 'Lỗi server'));
    } finally {
      setIsAcceptingDescription(false);
    }
  };

  // =========================================================================
  // STEP 4: AI Price Estimation (POST /ai-price-estimation - Trừ 1 VALUATION)
  // =========================================================================
  const handleRunAiValuation = async () => {
    if (!postId) return;
    setIsEstimatingPrice(true);
    const reqId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`;
    setValuationRequestId(reqId);

    try {
      const res = await postService.estimatePrice(postId, reqId);
      setValuationResult(res);
      if (res.suggestedPrice) {
        setFinalPriceVnd(res.suggestedPrice);
      }
      // Re-fetch credits to reflect deduction of 1 VALUATION
      await loadCredits();
    } catch (err: any) {
      alert('Định giá AI thất bại: ' + (err?.message || 'Lỗi kết nối tới dịch vụ AI'));
    } finally {
      setIsEstimatingPrice(false);
    }
  };

  const handleLoadValuationHistory = async () => {
    if (!postId) return;
    try {
      const hist = await postService.getPriceEstimateHistory(postId, 0, 10);
      const items = hist?.items || hist?.content || (Array.isArray(hist) ? hist : []);
      setValuationHistory(items);
      setShowValuationHistory(true);
    } catch (err: any) {
      alert('Không thể tải lịch sử định giá: ' + (err?.message || ''));
    }
  };

  // =========================================================================
  // STEP 5: Final Submit (POST /api/v1/posts/submit/{postId})
  // =========================================================================
  const handleSubmitPostFinal = async () => {
    if (!postId) return;
    if (!finalPriceVnd || finalPriceVnd < 1000) {
      alert(lang === 'vi' ? 'Vui lòng nhập giá bán hợp lệ (tối thiểu 1.000 đ)' : 'Please enter valid price');
      return;
    }

    setIsSubmittingPost(true);
    setSubmitError(null);
    try {
      const submitRes = await postService.submitPost(postId, {
        title: title.trim(),
        description: description.trim(),
        price: finalPriceVnd
      });

      setSubmitResult(submitRes);
      // Reload credits (if ACTIVE, minus 1 LISTING)
      await loadCredits();
    } catch (err: any) {
      setSubmitError(err?.message || 'Gửi bài đăng thất bại');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const handleFinishAndExit = () => {
    if (!postId) return;
    const catName = backendCategories.find((c) => c.id === selectedCategoryId)?.name || 'Thiết bị điện tử';
    const newListing: Listing = {
      id: postId,
      title: title || 'Sản phẩm SecondLife',
      category: catName as ItemCategory,
      brand: brand || 'Hãng',
      model: model || 'Model',
      purchaseYear,
      priceVnd: finalPriceVnd,
      originalPriceVnd: finalPriceVnd * 1.3,
      conditionGrade: 'Like New',
      declaredConditionText: itemCondition,
      description: description || 'Mô tả bài đăng đã qua kiểm duyệt AI',
      location: 'Hà Nội / TP.HCM',
      sellerId: 'current-user',
      sellerName: 'Người bán SecondLife',
      sellerRating: 5.0,
      sellerCompletedOrders: 1,
      sellerVerified: true,
      status: (submitResult?.status === 'ACTIVE' ? 'active' : 'pending') as any,
      createdAt: new Date().toISOString(),
      isInspectionGuaranteed: finalPriceVnd > 5000000,
      requiresInspection: finalPriceVnd > 5000000,
      photos: {
        front: photoPreviews[0] || '',
        back: photoPreviews[1] || '',
        screenOrDetails: photoPreviews[2] || '',
        accessoriesOrBox: photoPreviews[3] || '',
        serialOrReceipt: photoPreviews[4] || '',
        extraDetail: photoPreviews[5] || ''
      },
      photoGallery: photoPreviews
    };
    onListingCreated(newListing);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Top Banner: Credit Status Bar & Navigation */}
      <div className="bg-[#24263e] text-white rounded-3xl p-5 shadow-lg border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#c34c36] text-white flex items-center justify-center shadow-md shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-wide">
                {lang === 'vi' ? 'Hệ Thống Đăng Tin & Định Giá AI (Main Flow 1)' : 'AI Listing & Valuation Pipeline'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                Backend Live
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
              <span>Số dư Credit của bạn:</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white/10 font-mono font-bold text-amber-300 flex items-center gap-1 border border-white/10">
                <span>🎯 {credits?.listing ?? 0}</span>
                <span className="text-[10px] text-slate-400">LISTING</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white/10 font-mono font-bold text-cyan-300 flex items-center gap-1 border border-white/10">
                <span>💡 {credits?.valuation ?? 0}</span>
                <span className="text-[10px] text-slate-400">VALUATION</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleQuickBuyCredit}
            disabled={isPurchasingCredits}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/20 transition cursor-pointer flex items-center gap-1.5"
            title="Tạo đơn mua 2 LISTING + 2 VALUATION"
          >
            {isPurchasingCredits ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 text-amber-300" />}
            <span>{lang === 'vi' ? 'Nạp thêm Credit' : 'Buy Credits'}</span>
          </button>
          <button
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
          >
            {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
          </button>
        </div>
      </div>

      {/* Pipeline Step Progress Bar (5 Steps) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs font-bold">
          {[
            { step: 1, label: '1. Sản Phẩm & 3-6 Ảnh' },
            { step: 2, label: '2. Mô Tả AI & Chat' },
            { step: 3, label: '3. Xác Nhận Mô Tả' },
            { step: 4, label: '4. Định Giá AI' },
            { step: 5, label: '5. Gửi Đăng Bài' }
          ].map((s) => {
            const isActive = currentStep === s.step;
            const isDone = currentStep > s.step;
            return (
              <div
                key={s.step}
                className={`py-2 px-3 rounded-xl flex items-center gap-2 border transition ${isActive
                    ? 'bg-[#24263e] text-white border-[#24263e] shadow-xs'
                    : isDone
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isActive
                      ? 'bg-[#c34c36] text-white'
                      : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                >
                  {isDone ? <Check className="w-3 h-3" /> : s.step}
                </div>
                <span className="truncate">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: CHỌN DANH MỤC, VẬT PHẨM & TẢI 3-6 ẢNH SẢN PHẨM                   */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-[#24263e] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#c34c36]" />
              <span>{lang === 'vi' ? 'Bước 1: Chọn Danh Mục Sản Phẩm & Tải 3-6 Ảnh' : 'Step 1: Select Category & Upload 3-6 Photos'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              AI sẽ phân tích toàn bộ ảnh cùng danh mục sản phẩm để tạo mô tả và gợi ý định giá chuẩn xác.
            </p>
          </div>

          {/* Category & Item Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#24263e]">
                {lang === 'vi' ? 'Danh Mục Sản Phẩm (Category) *' : 'Product Category *'}
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={isLoadingCategories}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              >
                {backendCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#24263e]">
                {lang === 'vi' ? 'Loại Thiết Bị (Item/Model thuộc Category)' : 'Item Type'}
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                disabled={isLoadingItems || backendItems.length === 0}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              >
                {backendItems.length > 0 ? (
                  backendItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))
                ) : (
                  <option value="">{isLoadingItems ? 'Đang tải vật phẩm...' : 'Chung theo danh mục'}</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#24263e]">Thương hiệu (Brand) *</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="VD: Panasonic, Toshiba, LG, Sony, Apple..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#24263e]">Năm sản xuất / Mua</label>
              <input
                type="number"
                value={purchaseYear}
                onChange={(e) => setPurchaseYear(Number(e.target.value))}
                min={2018}
                max={2026}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>
          </div>

          {/* Photo Checklist 3-6 Photos */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-[#24263e] flex items-center gap-2">
                  <span>Ảnh chụp sản phẩm thực tế (Yêu cầu 3 - 6 ảnh) *</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${photoPreviews.length >= 3 && photoPreviews.length <= 6
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                      }`}
                  >
                    Đã có: {photoPreviews.length}/6 ảnh
                  </span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Tải lên mặt trước, mặt sau, góc cạnh, tem nhãn/seri và phụ kiện để AI định giá tối ưu.
                </p>
              </div>

              {photoPreviews.length < 6 && (
                <label className="px-4 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 transition">
                  <UploadCloud className="w-4 h-4 text-amber-300" />
                  <span>+ Chọn thêm ảnh từ máy</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            {/* Photos Preview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {photoPreviews.map((previewUrl, idx) => (
                <div key={idx} className="relative group rounded-2xl overflow-hidden border border-gray-200 aspect-square bg-slate-100 shadow-xs">
                  <img src={previewUrl} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold">
                    #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition shadow-sm cursor-pointer"
                    title="Xóa ảnh"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {photoPreviews.length < 6 && (
                <label className="border-2 border-dashed border-gray-300 hover:border-[#c34c36] rounded-2xl flex flex-col items-center justify-center gap-1 aspect-square bg-slate-50 hover:bg-slate-100 transition cursor-pointer text-slate-500 text-center p-2">
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span className="text-[10px] font-bold">+ Thêm ảnh</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Action Button: Khởi tạo bài đăng */}
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={handleInitPost}
              disabled={isInitializingPost || photoPreviews.length < 3 || photoPreviews.length > 6}
              className={`px-8 py-3.5 rounded-2xl font-black text-sm shadow-md flex items-center gap-2.5 transition ${!isInitializingPost && photoPreviews.length >= 3 && photoPreviews.length <= 6
                  ? 'bg-gradient-to-r from-[#c34c36] to-[#24263e] text-white hover:opacity-95 cursor-pointer transform hover:-translate-y-0.5'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                }`}
            >
              {isInitializingPost ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>AI đang phân tích ảnh & khởi tạo draft...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>Khởi Tạo Bài Đăng & Phân Tích AI</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: MÔ TẢ AI, CHỈNH SỬA & TRỢ LÝ CHAT BỔ SUNG                         */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-[#24263e] flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#c34c36]" />
              <span>{lang === 'vi' ? 'Bước 2: Mô Tả Do AI Đề Xuất & Chỉnh Sửa Trực Tiếp' : 'Step 2: AI Description & Editing'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Bạn có thể sử dụng trực tiếp mô tả do AI tạo ra từ ảnh hoặc trò chuyện với Trợ lý để bổ sung thêm chi tiết.
            </p>
          </div>

          {/* AI Initial Description Suggestion Box */}
          {aiInitialMessage && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#24263e] flex items-center gap-1.5 uppercase text-[11px]">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Gợi ý mô tả từ Gemini / Ollama AI:
                </span>
                <button
                  type="button"
                  onClick={() => setDescription(aiInitialMessage)}
                  className="px-3 py-1 rounded-lg bg-[#24263e] hover:bg-black text-white text-[11px] font-bold transition cursor-pointer"
                >
                  Dùng mô tả này
                </button>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700 italic">
                "{aiInitialMessage}"
              </p>
            </div>
          )}

          {/* Main Editing Fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#24263e]">Tiêu đề bài đăng *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Tủ Lạnh Panasonic 250L Inverter Tiết Kiệm Điện"
                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#24263e]">Mô tả chi tiết sản phẩm *</label>
                <span className="text-[10px] text-slate-400">{description.length}/10.000 ký tự</span>
              </div>
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả chi tiết tình trạng máy móc, thời gian sử dụng, phụ kiện kèm theo..."
                className="w-full px-4 py-3 bg-slate-50 border border-gray-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#24263e]">Tình trạng phân loại (Item Condition)</label>
                <select
                  value={itemCondition}
                  onChange={(e) => setItemCondition(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
                >
                  <option value="NEW">Mới 100% (Nguyên hộp / Chưa qua sử dụng)</option>
                  <option value="LIKE_NEW">Như mới (Grade A+ 99%, hoạt động hoàn hảo)</option>
                  <option value="USED_GOOD">Đã qua sử dụng - Hoạt động tốt (Grade A)</option>
                  <option value="USED_FAIR">Đã qua sử dụng - Có xước nhẹ (Grade B)</option>
                  <option value="USED">Cũ bình thường (Grade C)</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI Chat Drawer / Accordion */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
            <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#24263e]">
                <Bot className="w-4 h-4 text-[#c34c36]" />
                <span>Trợ lý AI Hỗ trợ hoàn thiện mô tả (Chat & Tổng hợp)</span>
              </div>
              <button
                type="button"
                onClick={handleFinalizeChatAndSync}
                disabled={isFinalizingChat}
                className="px-3 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#b0402c] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
              >
                {isFinalizingChat ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>AI Tổng Hợp Lại Mô Tả</span>
              </button>
            </div>

            {/* Chat Messages */}
            <div className="p-4 max-h-52 overflow-y-auto space-y-3">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`flex items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-[#24263e] text-white flex items-center justify-center shrink-0 text-xs">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className={`p-3 rounded-2xl text-xs max-w-lg leading-relaxed ${m.role === 'user' ? 'bg-[#24263e] text-white' : 'bg-white border border-gray-200 text-slate-800'}`}>
                    <div>{m.text}</div>
                    <div className={`text-[9px] mt-1 text-right ${m.role === 'user' ? 'text-white/60' : 'text-slate-400'}`}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChatMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập chi tiết cần bổ sung cho AI (ví dụ: máy dùng 2 năm, cửa xước dăm nhẹ, đủ dây nguồn...)"
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#c34c36]"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isSendingChat}
                className="px-4 py-2 bg-[#24263e] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1 disabled:opacity-40 transition cursor-pointer"
              >
                {isSendingChat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Gửi</span>
              </button>
            </form>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Bước 1</span>
            </button>

            <button
              onClick={() => setCurrentStep(3)}
              disabled={!title.trim() || !description.trim()}
              className="px-6 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-black shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <span>Tiếp tục: Xác nhận mô tả</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: LƯU DRAFT & XÁC NHẬN MÔ TẢ (PUT /draft & POST /accept-description)*/}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-[#24263e] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{lang === 'vi' ? 'Bước 3: Lưu Draft & Xác Nhận Nội Dung Mô Tả' : 'Step 3: Save Draft & Accept Description'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Theo quy chuẩn hệ thống, mô tả phải được xác nhận trước khi bước vào quy trình định giá AI và đăng bài.
            </p>
          </div>

          {/* Summary Card of Description to Accept */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Nội dung sẽ được xác nhận:</span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${descriptionAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {descriptionAccepted ? '✓ Đã xác nhận trước đó' : 'Chờ xác nhận'}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 block">Tiêu đề:</span>
              <h4 className="text-sm font-black text-[#24263e]">{title}</h4>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 block">Phân loại tình trạng:</span>
              <span className="text-xs font-bold text-slate-800">{itemCondition}</span>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">Mô tả sản phẩm:</span>
              <div className="p-3 bg-white rounded-xl border border-gray-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {description}
              </div>
            </div>
          </div>

          {/* Responsibility Warning */}
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Quy định thẩm định nội dung:</span>
              <span>Khi bạn xác nhận mô tả, hệ thống sẽ lưu snapshot và khóa dữ liệu để AI tính toán khoảng giá hợp lý. Nếu sau này bạn sửa mô tả, trạng thái sẽ tự động đặt lại và cần xác nhận lại.</span>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Sửa lại mô tả</span>
            </button>

            <button
              onClick={handleSaveAndAcceptDescription}
              disabled={isAcceptingDescription}
              className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isAcceptingDescription ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu và xác nhận mô tả...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Xác Nhận Mô Tả & Tiếp Tục Định Giá AI</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: ĐỊNH GIÁ AI & CHỌN GIÁ BÁN                                        */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-[#24263e] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>{lang === 'vi' ? 'Bước 4: Định Giá Bằng AI & Chọn Giá Bán' : 'Step 4: AI Valuation & Set Price'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Sử dụng 1 lượt VALUATION để AI phân tích khoảng giá thị trường và đề xuất mức giá thanh khoản tốt nhất.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLoadValuationHistory}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <History className="w-3.5 h-3.5" />
              <span>Xem lịch sử định giá</span>
            </button>
          </div>

          {/* Credit VALUATION Box & Trigger Button */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-[#24263e] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Tín dụng Định Giá AI</span>
              <div className="text-base font-black flex items-center gap-2 mt-0.5">
                <span>Bạn đang có:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-mono font-black text-sm">
                  {credits?.valuation ?? 0} VALUATION
                </span>
              </div>
              <span className="text-[11px] text-slate-300 block mt-1">
                * Mỗi lần định giá thành công trừ 1 VALUATION. Retry do lỗi mạng không bị trừ lại.
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRunAiValuation}
                disabled={isEstimatingPrice || (credits?.valuation ?? 0) < 1}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isEstimatingPrice ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI đang phân tích thị trường...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Định Giá Bằng AI (1 Credit)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Valuation Result Card */}
          {valuationResult && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5 uppercase">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Kết quả định giá thành công từ mô hình {valuationResult.modelVersion || 'AI'}
                </span>
                <span className="text-[11px] text-emerald-700 font-bold font-mono">
                  Mã Y/c: {valuationRequestId ? valuationRequestId.slice(0, 8) : 'Live'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-xs">
                  <span className="text-[11px] text-slate-500 font-bold block">Khoảng giá hợp lý:</span>
                  <div className="text-sm font-black text-slate-800 mt-1">
                    {formatVND(valuationResult.fairPriceMin)} - {formatVND(valuationResult.fairPriceMax)}
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-300 shadow-xs ring-2 ring-emerald-500/20">
                  <span className="text-[11px] text-emerald-700 font-bold block">Giá đề xuất bán tốt nhất:</span>
                  <div className="text-base font-black text-[#c34c36] mt-1">
                    {formatVND(valuationResult.suggestedPrice)}
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-xs">
                  <span className="text-[11px] text-slate-500 font-bold block">Thời gian bán dự kiến:</span>
                  <div className="text-sm font-black text-slate-800 mt-1">
                    {valuationResult.expectedSellTime || '1 - 2 tuần'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setFinalPriceVnd(valuationResult.suggestedPrice)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Áp dụng giá AI đề xuất ({formatVND(valuationResult.suggestedPrice)})</span>
                </button>
              </div>
            </div>
          )}

          {/* History Modal / Drawer */}
          {showValuationHistory && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#24263e]">Lịch sử các lần định giá cho bài đăng này:</span>
                <button
                  onClick={() => setShowValuationHistory(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕ Đóng
                </button>
              </div>
              {valuationHistory.length > 0 ? (
                <div className="space-y-2">
                  {valuationHistory.map((h, i) => (
                    <div key={i} className="p-2.5 bg-white rounded-xl border border-gray-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">{formatVND(h.suggestedPrice)}</span>
                        <span className="text-[10px] text-slate-400 ml-2">Khoảng: {formatVND(h.fairPriceMin)} - {formatVND(h.fairPriceMax)}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'Vừa xong'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Chưa có lịch sử định giá trước đó.</p>
              )}
            </div>
          )}

          {/* Price Input Form */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#24263e] uppercase">
                Giá bán của bạn (VND) *
              </label>
              <span className="text-lg font-black text-[#c34c36]">
                {formatVND(finalPriceVnd)}
              </span>
            </div>

            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                value={finalPriceVnd}
                onChange={(e) => setFinalPriceVnd(Number(e.target.value))}
                step={50000}
                min={1000}
                className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            {/* High-value threshold notice (> 5,000,000 VND) */}
            {finalPriceVnd > 5000000 && (
              <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Sản phẩm giá trị cao (trên 5.000.000 VND):</span>
                  <span>Bài đăng sẽ tự động chuyển sang quy trình Kiểm định chất lượng của Kỹ thuật viên (PENDING_INSPECTION) trước khi hiển thị công khai trên Sàn. Chưa trừ credit LISTING cho tới khi kiểm định đạt chuẩn.</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Xác nhận mô tả</span>
            </button>

            <button
              onClick={() => setCurrentStep(5)}
              disabled={!finalPriceVnd || finalPriceVnd < 1000}
              className="px-6 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-black shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <span>Tiếp tục: Xem lại & Gửi đăng</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: XEM LẠI & GỬI ĐĂNG BÀI (POST /api/v1/posts/submit/{postId})       */}
      {/* ========================================================================= */}
      {currentStep === 5 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-[#24263e] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#c34c36]" />
              <span>{lang === 'vi' ? 'Bước 5: Xem Lại Thông Tin & Gửi Đăng Bài' : 'Step 5: Review & Submit Listing'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Kiểm tra toàn bộ thông tin lần cuối trước khi nộp duyệt bài đăng lên hệ thống SecondLife.
            </p>
          </div>

          {/* Final Summary Card */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tiêu đề bài đăng</span>
                <h4 className="text-base font-black text-[#24263e]">{title}</h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Giá niêm yết</span>
                <span className="text-xl font-black text-[#c34c36]">{formatVND(finalPriceVnd)}</span>
              </div>
            </div>

            {/* Photos Preview */}
            <div>
              <span className="text-xs font-bold text-slate-600 block mb-2">Bộ ảnh sản phẩm đã tải:</span>
              <div className="flex flex-wrap gap-2">
                {photoPreviews.map((p, i) => (
                  <img key={i} src={p} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-xs" />
                ))}
              </div>
            </div>

            {/* Description Preview */}
            <div>
              <span className="text-xs font-bold text-slate-600 block mb-1">Mô tả sản phẩm:</span>
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {description}
              </div>
            </div>

            {/* Credit Notice */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <span>Credit LISTING cần dùng: <strong>1 lượt</strong> (Chỉ trừ khi bài đăng chính thức chuyển sang <strong>ACTIVE</strong>).</span>
              <span className="font-bold">Số dư hiện tại: {credits?.listing ?? 0} lượt</span>
            </div>
          </div>

          {/* Submission Result Banner */}
          {submitResult && (
            <div
              className={`p-5 rounded-2xl border space-y-3 animate-fadeIn ${submitResult.status === 'ACTIVE'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : submitResult.status === 'PENDING'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : submitResult.status === 'PENDING_INSPECTION'
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
            >
              <div className="flex items-center gap-2.5">
                {submitResult.status === 'ACTIVE' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : submitResult.status === 'PENDING' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                ) : submitResult.status === 'PENDING_INSPECTION' ? (
                  <ShieldCheck className="w-6 h-6 text-cyan-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-black text-sm uppercase">
                    {submitResult.status === 'ACTIVE'
                      ? 'Đăng bài thành công! (ACTIVE)'
                      : submitResult.status === 'PENDING'
                        ? 'Nghi ngờ trùng lặp - Chờ STAFF kiểm duyệt (PENDING)'
                        : submitResult.status === 'PENDING_INSPECTION'
                          ? 'Chờ kiểm định chất lượng (PENDING_INSPECTION)'
                          : 'Bài đăng bị từ chối (REJECTED)'}
                  </h4>
                  <p className="text-xs mt-0.5">
                    {submitResult.status === 'ACTIVE'
                      ? 'Bài đăng của bạn đã được xuất bản công khai. Đã trừ 1 lượt LISTING.'
                      : submitResult.status === 'PENDING'
                        ? 'Phát hiện hình ảnh hoặc nội dung trùng với bài đăng khác trên sàn. Nhân viên Staff sẽ đối soát thủ công. Chưa trừ credit.'
                        : submitResult.status === 'PENDING_INSPECTION'
                          ? 'Sản phẩm có giá trị > 5 triệu đồng đang chờ Kỹ thuật viên trung tâm kiểm định tiếp nhận. Chưa trừ credit.'
                          : (submitResult.reviewReason || 'Bài đăng không đạt tiêu chuẩn nội dung của sàn. Không trừ credit.')}
                  </p>
                </div>
              </div>

              {submitResult.duplicateMatches && submitResult.duplicateMatches.length > 0 && (
                <div className="p-3 bg-white/80 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-slate-700 block">Danh sách bài đối chiếu trùng khớp:</span>
                  <div className="font-mono text-[11px] text-slate-600">
                    {submitResult.duplicateMatches.join(', ')}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={loadCredits}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Kiểm tra lại số dư credit
                </button>
                <button
                  type="button"
                  onClick={handleFinishAndExit}
                  className="px-4 py-1.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold transition cursor-pointer"
                >
                  Hoàn tất & Về Bàn làm việc
                </button>
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Navigation & Submit Button */}
          {!submitResult && (
            <div className="flex justify-between pt-4 border-t border-gray-100">
              <button
                onClick={() => setCurrentStep(4)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại Định giá</span>
              </button>

              <button
                onClick={handleSubmitPostFinal}
                disabled={isSubmittingPost || (credits?.listing ?? 0) < 1}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white font-black text-sm shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPost ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang gửi bài lên Backend...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                    <span>Gửi Đăng Bài Ngay (Trừ 1 LISTING khi ACTIVE)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
