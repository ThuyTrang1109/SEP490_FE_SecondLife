import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
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
  DollarSign,
  PenLine,
  FileEdit,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MessageSquare,
  Truck,
  MapPin,
  Eye
} from 'lucide-react';
import {
  ItemCategory,
  ConditionGrade,
  Listing,
  Language,
  CategoryBackend,
  ItemBackend,
  UserProfile
} from '../types';
import { translations, formatVND } from '../utils/translations';
import { numberToVietnameseWords, formatVndInput } from '../utils/numberToWords';
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
  PostSubmitResponse,
  shippingService
} from '../services';
import { parseQuestionItem, splitCompoundQuestion } from '../utils/questionParser';
import { extractWardAndCity, getSavedSellerAddress } from '../utils/addressUtils';



/**
 * Loại bỏ các câu hỏi mẫu / gợi ý khảo sát do BE sinh ra nếu bị lọt vào ô mô tả sản phẩm.
 * Ví dụ:
 * **Tình trạng hoạt động** (Ví dụ: Hoạt động tốt, Cần vệ sinh/sửa chữa nhẹ, Hỏng một phần)
 * **Loại máy hút mùi** (Ví dụ: Âm tủ, Kính cong, Đảo độc lập, Treo tường cổ điển)
 * ...
 */
export const cleanDescriptionFromQuestionTemplate = (desc: string): string => {
  if (!desc || typeof desc !== 'string') return '';
  const lines = desc.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    // 1. Dạng chuẩn của template câu hỏi BE: **Tiêu đề** (Ví dụ: ...)
    if (/^[-*•\d\.\)]*\s*\*\*.*?\*\*\s*\([Vv]í\s*dụ\s*:?.*?\)/i.test(trimmed)) {
      return false;
    }
    // 2. Dạng khớp các trường khảo sát cụ thể mà BE sinh ra
    if (
      /^[-*•\d\.\)]*\s*(\*\*)?(Tình trạng hoạt động|Loại máy hút mùi|Loại máy|Thời gian đã qua sử dụng|Độ sạch sẽ và ngoại hình|Độ sạch sẽ|Các phụ kiện đi kèm|Phụ kiện đi kèm).*?(\(Ví\s*dụ|\(Gợi ý|\))/i.test(trimmed)
    ) {
      return false;
    }
    // 3. Dòng chỉ chứa gợi ý (Ví dụ: ...)
    if (/^\s*\([Vv]í\s*dụ\s*:.*?(\)|$)/i.test(trimmed)) {
      return false;
    }
    return true;
  });

  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

interface CreateListingViewProps {
  onListingCreated: (newListing: Listing) => void;
  lang: Language;
  onCancel: () => void;
  currentUser?: UserProfile | null;
  initialDraft?: Listing;
}

export const CreateListingView: React.FC<CreateListingViewProps> = ({
  onListingCreated,
  lang,
  onCancel,
  currentUser,
  initialDraft
}) => {
  const t = translations[lang];

  // 5 Linear Steps matching Main Flow 1 Guide
  // Step 1: Chọn Category, Item & Tải 3-6 ảnh
  // Step 2: Mô tả AI & Chỉnh sửa / Chat
  // Step 3: Lưu Draft & Xác nhận mô tả
  // Step 4: Định giá AI (1 credit VALUATION) & Chọn giá bán
  // Step 5: Xem lại & Gửi đăng (1 credit LISTING khi ACTIVE)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Credit Balance State
  const [credits, setCredits] = useState<CreditBalanceResponseDto | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);

  // Category & Item from Backend
  const [backendCategories, setBackendCategories] = useState<CategoryBackend[]>([]);
  const [backendItems, setBackendItems] = useState<ItemBackend[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Basic Form State
  const [title, setTitle] = useState('');
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const [sellerLocation, setSellerLocation] = useState<string>('');

  // Lấy địa chỉ của người bán (chỉ lấy phường và thành phố) từ hồ sơ hoặc địa chỉ kho đã lưu
  useEffect(() => {
    const resolveSellerLocation = async () => {
      // 1. Thử lấy địa chỉ kho bưu tá từ BE shippingService
      try {
        const [obRes, pickupRes] = await Promise.allSettled([
          shippingService.getSellerOnboarding(),
          shippingService.getPickupAddress(),
        ]);
        let pa: any = null;
        if (obRes.status === 'fulfilled' && obRes.value?.pickupAddress) {
          pa = obRes.value.pickupAddress;
        } else if (pickupRes.status === 'fulfilled' && pickupRes.value) {
          pa = pickupRes.value;
        }
        if (pa) {
          const loc = extractWardAndCity(pa.address, pa.wardName, pa.provinceName);
          if (loc) {
            setSellerLocation(loc);
            return;
          }
        }
      } catch (e) {
        // Fallback sang thông tin profile
      }

      // 2. Thử lấy từ currentUser profile
      const userLoc = extractWardAndCity(
        currentUser?.pickupAddress || currentUser?.address,
        currentUser?.wardName,
        currentUser?.provinceName
      );
      if (userLoc) {
        setSellerLocation(userLoc);
        return;
      }

      // 3. Thử lấy từ localStorage đã lưu của seller
      const saved = getSavedSellerAddress();
      const savedLoc = extractWardAndCity(saved.address, saved.wardName, saved.provinceName);
      if (savedLoc) {
        setSellerLocation(savedLoc);
      }
    };

    resolveSellerLocation();
  }, [currentUser]);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [purchaseYear, setPurchaseYear] = useState<number>(new Date().getFullYear());
  const [originalPriceVnd, setOriginalPriceVnd] = useState<number | ''>('');
  const [itemCondition, setItemCondition] = useState<string>('USED_GOOD');
  const [description, setDescription] = useState('');
  const [finalPriceVnd, setFinalPriceVnd] = useState<number>(0);
  const [isManualPricingInStep3, setIsManualPricingInStep3] = useState<boolean>(false);

  // Gợi ý thương hiệu đồ gia dụng thông minh theo Danh mục và Loại sản phẩm
  const brandSuggestionsData = useMemo(() => {
    const selectedCat = backendCategories.find(c => c.id === selectedCategoryId);
    const selectedItm = backendItems.find(i => i.id === selectedItemId);
    const itmName = (selectedItm?.name || '').toLowerCase();
    const catName = (selectedCat?.name || '').toLowerCase();

    // 1. Bàn ăn, Ghế ăn, Bàn ghế nội thất gia đình (Ưu tiên số 1: Bàn ăn thuộc Phòng ăn cũng là Bàn ghế, không được nhận nhầm sang đồ điện bếp)
    if (
      itmName.includes('bàn ăn') ||
      itmName.includes('ghế ăn') ||
      itmName.includes('bàn làm việc') ||
      itmName.includes('bàn học') ||
      itmName.includes('bàn trà') ||
      itmName.includes('bàn sofa') ||
      itmName.includes('bàn ban công') ||
      itmName.includes('bàn trang điểm') ||
      itmName.includes('ghế sofa') ||
      itmName.includes('ghế bành') ||
      itmName.includes('ghế xoay') ||
      itmName.includes('ghế công thái học') ||
      itmName.includes('sofa') ||
      itmName.includes('giường') ||
      itmName.includes('nệm') ||
      itmName.includes('đệm') ||
      itmName.includes('tủ quần áo') ||
      itmName.includes('tủ đầu giường') ||
      itmName.includes('tủ giày') ||
      itmName.includes('kệ sách') ||
      itmName.includes('giá sách') ||
      itmName.includes('kệ tivi') ||
      itmName.includes('giá phơi') ||
      itmName.includes('giàn phơi')
    ) {
      return {
        placeholder: 'VD: Hòa Phát, Xuân Hòa, IKEA, JYSK, An Cường, Hàng xưởng đặt đóng...',
        brands: ['Hòa Phát', 'Xuân Hòa', 'IKEA', 'JYSK', 'An Cường', 'Nhà Xinh', 'Duy Tân', 'Hoàng Anh Gia Lai', 'Hàng xưởng / Tự đóng', 'Hàng nhập khẩu']
      };
    }

    // 2. Bếp & Phòng ăn (Thiết bị điện & gia dụng nhà bếp)
    if (catName.includes('bếp') || catName.includes('phòng ăn') || catName.includes('kitchen') || catName.includes('dining')) {
      return {
        placeholder: 'VD: Cuckoo, Sunhouse, Tiger, Zojirushi, BlueStone, Philips, Kangaroo...',
        brands: ['Cuckoo', 'Sunhouse', 'Tiger', 'Zojirushi', 'BlueStone', 'Philips', 'Toshiba', 'Panasonic', 'Sharp', 'Kangaroo', 'Lock&Lock', 'Tefal']
      };
    }

    // 3. Phòng khách & Phòng ngủ
    if (catName.includes('khách') || catName.includes('ngủ') || catName.includes('living') || catName.includes('bedroom')) {
      return {
        placeholder: 'VD: Daikin, Panasonic, LG, Casper, Mitsubishi, Xiaomi...',
        brands: ['Panasonic', 'Daikin', 'LG', 'Samsung', 'Casper', 'Mitsubishi Electric', 'Xiaomi', 'Sony', 'Sharp', 'Toshiba']
      };
    }

    // 4. Ban công & Giặt sấy
    if (catName.includes('ban công') || catName.includes('giặt') || catName.includes('laundry')) {
      return {
        placeholder: 'VD: Electrolux, LG, Toshiba, Panasonic, Aqua, Samsung...',
        brands: ['Electrolux', 'LG', 'Toshiba', 'Panasonic', 'Aqua', 'Samsung', 'Whirlpool', 'Coex', 'Beko']
      };
    }

    // 5. Phòng tắm & Vệ sinh
    if (catName.includes('tắm') || catName.includes('vệ sinh') || catName.includes('bath')) {
      return {
        placeholder: 'VD: Ariston, Ferroli, Panasonic, Inax, Toto...',
        brands: ['Ariston', 'Ferroli', 'Panasonic', 'Inax', 'Toto', 'Kangaroo', 'Sunhouse', 'Electrolux', 'Karcher']
      };
    }

    // Fallback mặc định chung cho đồ gia dụng
    return {
      placeholder: 'VD: Panasonic, Toshiba, Sunhouse, Philips, BlueStone, Sharp...',
      brands: ['Panasonic', 'Toshiba', 'Sunhouse', 'Philips', 'Sharp', 'Electrolux', 'BlueStone', 'Kangaroo', 'Samsung', 'LG']
    };
  }, [selectedCategoryId, selectedItemId, backendCategories, backendItems]);

  // Kích thước và trọng lượng đóng gói (GHN)
  const [shippingWeight, setShippingWeight] = useState<number | ''>('');
  const [shippingLength, setShippingLength] = useState<number | ''>('');
  const [shippingWidth, setShippingWidth] = useState<number | ''>('');
  const [shippingHeight, setShippingHeight] = useState<number | ''>('');

  // Đơn vị và input nhập liệu thông minh cho kiện hàng GHN
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');
  const [rawWeightInput, setRawWeightInput] = useState<string>('');
  const [dimensionUnit, setDimensionUnit] = useState<'cm' | 'm'>('cm');
  const [rawLengthInput, setRawLengthInput] = useState<string>('');
  const [rawWidthInput, setRawWidthInput] = useState<string>('');
  const [rawHeightInput, setRawHeightInput] = useState<string>('');

  const handleWeightChange = (valStr: string) => {
    setRawWeightInput(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num > 0) {
      setShippingWeight(weightUnit === 'kg' ? Math.round(num * 1000) : Math.round(num));
    } else {
      setShippingWeight('');
    }
  };

  const handleWeightUnitSwitch = (newUnit: 'kg' | 'g') => {
    if (newUnit === weightUnit) return;
    setWeightUnit(newUnit);
    if (rawWeightInput && !isNaN(Number(rawWeightInput))) {
      const currentVal = Number(rawWeightInput);
      const converted = newUnit === 'g' ? Math.round(currentVal * 1000) : Number((currentVal / 1000).toFixed(2));
      setRawWeightInput(converted.toString());
      setShippingWeight(newUnit === 'g' ? converted : Math.round(converted * 1000));
    }
  };

  const handleDimensionChange = (field: 'length' | 'width' | 'height', valStr: string) => {
    if (field === 'length') setRawLengthInput(valStr);
    if (field === 'width') setRawWidthInput(valStr);
    if (field === 'height') setRawHeightInput(valStr);

    const num = parseFloat(valStr);
    if (!isNaN(num) && num > 0) {
      const inCm = dimensionUnit === 'm' ? Math.round(num * 100) : Math.round(num);
      if (field === 'length') setShippingLength(inCm);
      if (field === 'width') setShippingWidth(inCm);
      if (field === 'height') setShippingHeight(inCm);
    } else {
      if (field === 'length') setShippingLength('');
      if (field === 'width') setShippingWidth('');
      if (field === 'height') setShippingHeight('');
    }
  };

  const handleDimensionUnitSwitch = (newUnit: 'cm' | 'm') => {
    if (newUnit === dimensionUnit) return;
    setDimensionUnit(newUnit);
    const convert = (valStr: string) => {
      if (!valStr || isNaN(Number(valStr))) return valStr;
      const num = Number(valStr);
      return newUnit === 'm' ? Number((num / 100).toFixed(2)).toString() : Math.round(num * 100).toString();
    };
    if (rawLengthInput) setRawLengthInput(convert(rawLengthInput));
    if (rawWidthInput) setRawWidthInput(convert(rawWidthInput));
    if (rawHeightInput) setRawHeightInput(convert(rawHeightInput));
  };


  // Images state: Raw files for FormData & previews
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Post & AI Session IDs from Backend
  const [postId, setPostId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiInitialMessage, setAiInitialMessage] = useState<string>('');
  const [aiVisualReport, setAiVisualReport] = useState<string>('');
  const [draftPost, setDraftPost] = useState<ListingDraftResponse | null>(null);

  // Initialize from draft if provided
  useEffect(() => {
    if (initialDraft) {
      setPostId(initialDraft.id);
      setTitle(initialDraft.title || '');
      setBrand(initialDraft.brand || '');
      setModel(initialDraft.model || '');
      if (initialDraft.purchaseYear) setPurchaseYear(initialDraft.purchaseYear);
      if (initialDraft.originalPriceVnd) setOriginalPriceVnd(initialDraft.originalPriceVnd);
      if (initialDraft.priceVnd) setFinalPriceVnd(initialDraft.priceVnd);
      if (initialDraft.shippingWeight) setShippingWeight(initialDraft.shippingWeight);
      if (initialDraft.shippingLength) setShippingLength(initialDraft.shippingLength);
      if (initialDraft.shippingWidth) setShippingWidth(initialDraft.shippingWidth);
      if (initialDraft.shippingHeight) setShippingHeight(initialDraft.shippingHeight);
      if (initialDraft.shippingWeight) setRawWeightInput((Number(initialDraft.shippingWeight) / 1000).toString());
      if (initialDraft.shippingLength) setRawLengthInput(initialDraft.shippingLength.toString());
      if (initialDraft.shippingWidth) setRawWidthInput(initialDraft.shippingWidth.toString());
      if (initialDraft.shippingHeight) setRawHeightInput(initialDraft.shippingHeight.toString());
      if (initialDraft.conditionGrade) {
        // Map condition grade string back to enum value if needed
        const gradeMap: any = {
          'Like New': 'LIKE_NEW',
          'Good': 'USED_GOOD',
          'Fair': 'USED_FAIR'
        };
        setItemCondition(gradeMap[initialDraft.conditionGrade] || 'USED_GOOD');
      }
      if (initialDraft.description) {
        setDescription(cleanDescriptionFromQuestionTemplate(initialDraft.description));
      }
      if (initialDraft.photoGallery && initialDraft.photoGallery.length > 0) {
        setPhotoPreviews(initialDraft.photoGallery);
      } else if (initialDraft.photos) {
        const p = initialDraft.photos;
        setPhotoPreviews([p.front, p.back, p.screenOrDetails, p.accessoriesOrBox, p.serialOrReceipt, p.extraDetail].filter(Boolean) as string[]);
      }
      if (initialDraft.location) {
        setSellerLocation(initialDraft.location);
      }
      // Note: Category and Item might need to be resolved by name since initialDraft only stores the string in FE mapping
    }
  }, [initialDraft]);

  // Tự động loại bỏ các câu hỏi mẫu/gợi ý khảo sát nếu bị lọt vào ô mô tả sản phẩm ở bước 2
  useEffect(() => {
    if (
      description &&
      (/(\(Ví\s*dụ\s*:|\(ví\s*dụ\s*:|\*\*Tình trạng hoạt động\*\*|\*\*Loại máy hút mùi\*\*|\*\*Các phụ kiện đi kèm\*\*)/i.test(description))
    ) {
      const cleaned = cleanDescriptionFromQuestionTemplate(description);
      if (cleaned !== description) {
        setDescription(cleaned);
      }
    }
  }, [description]);

  // Mode: 'ai' | 'manual'
  const [initMode, setInitMode] = useState<'ai' | 'manual' | null>(null);
  const [postMode, setPostMode] = useState<'ai' | 'manual'>('ai');
  const [showAiChatDrawer, setShowAiChatDrawer] = useState<boolean>(true);
  const [showQuestionsList, setShowQuestionsList] = useState<boolean>(true);

  // Derived category & item question guide
  const currentCategory = backendCategories.find(c => c.id === selectedCategoryId);
  const currentItem = backendItems.find(i => i.id === selectedItemId);

  // Removed static currentQuestionGuide

  // Warning from AI Vision (Llava) if uploaded image is detected as catalog / stock photo
  const isCatalogPhotoWarning = useMemo(() => {
    if (!aiInitialMessage) return false;
    const lower = aiInitialMessage.toLowerCase();
    return (
      lower.includes('ảnh quảng cáo') ||
      lower.includes('ảnh catalog') ||
      lower.includes('không phải ảnh chụp thực tế') ||
      lower.includes('không có cơ sở để đánh giá ngoại hình')
    );
  }, [aiInitialMessage]);

  // Dynamic question parser: Extracts questions generated by Backend AI from aiInitialMessage
  const parsedAiQuestions = useMemo(() => {
    if (!aiInitialMessage) return [];

    // Tự động chuẩn hóa xuống dòng nếu chuỗi các câu hỏi bị dính liền trên 1 dòng
    let normalized = aiInitialMessage;
    normalized = normalized.replace(/\)\s+(?=[A-ZÀ-Ỹ0-9\*\#])/g, ')\n');
    normalized = normalized.replace(/\?\s+(?=[A-ZÀ-Ỹ0-9\*\#])/g, '?\n');

    const lines = normalized.split('\n');
    const questions: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Match "1. ...", "1) ...", "- 1. ...", "* 1. ..."
      const numMatch = trimmed.match(/^[-*•]?\s*(\d+)[\.\)]\s*(.+)$/);
      if (numMatch && numMatch[2]) {
        questions.push(numMatch[2].trim());
        continue;
      }
      // Match bullet with bold question: "- **Câu hỏi:** ..." or "* **Câu hỏi:** ..."
      const bulletBoldMatch = trimmed.match(/^[-*•]\s*(\**.*?\*\*.*)$/);
      if (bulletBoldMatch && bulletBoldMatch[1]) {
        questions.push(bulletBoldMatch[1].trim());
        continue;
      }
      // Match simple bullets with a question mark
      const bulletMatch = trimmed.match(/^[-*•]\s*(.+)$/);
      if (bulletMatch && bulletMatch[1] && bulletMatch[1].includes('?')) {
        questions.push(bulletMatch[1].trim());
        continue;
      }
      // Match any line ending with ? or having parenthesized hint (Ví dụ: ...)
      if (trimmed.endsWith('?') || /\((?:ví\s*dụ|vd|gợi\s*ý)/i.test(trimmed)) {
        questions.push(trimmed);
        continue;
      }
      // Match standalone line if longer than 5 chars
      if (trimmed.length > 5 && !trimmed.toLowerCase().startsWith('lưu ý') && !trimmed.toLowerCase().startsWith('chào bạn')) {
        questions.push(trimmed);
      }
    }

    // If we couldn't parse structured lines but the message contains a question mark,
    // we can split the text by '?' as a fallback.
    if (questions.length === 0 && normalized.includes('?')) {
      const parts = normalized.split('?').map(p => p.trim()).filter(p => p.length > 10);
      parts.forEach(p => questions.push(p + '?'));
    }

    // Final fallback: if nothing worked, just treat the whole message as one question so the form doesn't disappear
    if (questions.length === 0 && normalized.trim().length > 10) {
      questions.push(normalized.trim());
    }

    return questions;
  }, [aiInitialMessage]);

  // Effective questions to display: Solely rely on dynamic questions from Backend DB AI template
  const effectiveQuestions = useMemo(() => {
    const rawQuestions = parsedAiQuestions;
    const splittedQuestions = rawQuestions.flatMap(q => splitCompoundQuestion(q));

    // Deduplicate questions to prevent UI repetition
    const uniqueQuestions: string[] = [];
    const seenKeys = new Set<string>();

    for (const q of splittedQuestions) {
      // Clean string for comparison: remove non-alphanumeric, spaces, and make lowercase
      const cleanKey = q.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '').toLowerCase();
      if (!seenKeys.has(cleanKey)) {
        seenKeys.add(cleanKey);
        uniqueQuestions.push(q);
      }
    }

    // Lọc bỏ câu hỏi về Hãng / Thương hiệu vì người bán đã chọn hoặc điền ở bước đầu tiên
    return uniqueQuestions.filter(q => {
      const lower = q.toLowerCase().trim();
      // Giữ lại các câu hỏi liên quan đến bảo hành (ví dụ: "Bảo hành chính hãng không")
            if (lower.includes('bảo hành') || lower.includes('bo hnh')) return true;

      // Lọc bỏ câu hỏi về thời gian/năm mua/giá mua vì người bán đã điền ở Bước 1
      if (
        lower.includes('thời gian đã sử dụng') ||
        lower.includes('thời gian sử dụng') ||
        lower.includes('thời gian mua') ||
        lower.includes('thời gian bạn mua') ||
        lower.includes('năm mua') ||
        lower.includes('năm bạn mua') ||
        lower.includes('giá mua mới') ||
        lower.includes('giá lúc mua') ||
        lower.includes('giá gốc')
      ) {
        return false;
      }

      if (
        lower === 'hãng?' ||
        lower === 'hãng' ||
        lower.startsWith('hãng?') ||
        lower.startsWith('hãng:') ||
        lower.includes('hãng sản xuất') ||
        lower.includes('thương hiệu') ||
        lower.includes('nhà sản xuất') ||
        lower.includes('tên hãng') ||
        lower.includes('thuộc hãng nào') ||
        (lower.includes('hãng') && lower.length < 30)
      ) {
        return false;
      }
      return true;
    });
  }, [parsedAiQuestions]);

  
  // Questionnaire Answers State
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});

  // Tự động suy luận Tình trạng phân loại (Item Condition) từ câu trả lời khảo sát của người bán
  useEffect(() => {
    const allAnswers = Object.values(questionAnswers).join(' ').toLowerCase();
    if (!allAnswers) return;

    if (allAnswers.includes('mới 100%') || allAnswers.includes('nguyên hộp') || allAnswers.includes('chưa qua sử dụng') || allAnswers.includes('chưa dùng')) {
      setItemCondition('NEW');
    } else if (allAnswers.includes('like-new') || allAnswers.includes('like new') || allAnswers.includes('hàng lướt') || allAnswers.includes('99%') || allAnswers.includes('vài lần cất hộp')) {
      setItemCondition('LIKE_NEW');
    } else if (allAnswers.includes('xước nhẹ') || allAnswers.includes('cấn móp') || allAnswers.includes('tróc chống dính') || allAnswers.includes('trầy xước nhẹ') || allAnswers.includes('grade b')) {
      setItemCondition('USED_FAIR');
    } else if (allAnswers.includes('cũ bình thường') || allAnswers.includes('nhiều vết xước') || allAnswers.includes('hỏng nhẹ') || allAnswers.includes('grade c')) {
      setItemCondition('USED');
    } else if (allAnswers.includes('hoạt động tốt') || allAnswers.includes('nguyên bản') || allAnswers.includes('nấu chín đều') || allAnswers.includes('dùng đều đặn') || allAnswers.includes('grade a')) {
      setItemCondition('USED_GOOD');
    }
  }, [questionAnswers]);
  const [isApplyingAnswers, setIsApplyingAnswers] = useState(false);
  const [isSubmittingAnswersToAi, setIsSubmittingAnswersToAi] = useState(false);
  const [applySuccessNotice, setApplySuccessNotice] = useState<string | null>(null);

  const answeredCount = useMemo(() => {
    return (Object.values(questionAnswers) as string[]).filter((v) => v && typeof v === 'string' && v.trim().length > 0).length;
  }, [questionAnswers]);

  const handleAnswerChange = (idx: number, val: string) => {
    setQuestionAnswers((prev) => ({ ...prev, [idx]: val }));
    const qText = effectiveQuestions[idx] || '';
    if (qText.toLowerCase().includes('thương hiệu') || qText.toLowerCase().includes('hãng')) {
      const cleanBrand = val.trim();
      if (cleanBrand && cleanBrand.length < 30) {
        setBrand(cleanBrand);
      }
    }
  };

    // Tự động tạo tiêu đề bài đăng hấp dẫn chuẩn sàn TMĐT từ thông tin & khảo sát
  const buildSmartProductTitle = (): string => {
    const selectedCat = backendCategories.find(c => c.id === selectedCategoryId);
    const selectedItm = backendItems.find(i => i.id === selectedItemId);
    const itmName = selectedItm?.name || selectedCat?.name || 'Sản phẩm';
    const brandName = brand?.trim() || '';
    const modelName = model?.trim() || '';

    // Trích xuất thông số cốt lõi từ câu trả lời thông số kỹ thuật (câu 4) hoặc ảnh
    let keySpec = '';
    const answer4 = (questionAnswers[3] || '').trim();
    if (answer4) {
      const specMatch = answer4.match(/\b(\d+(?:[\.,]\d+)?\s*(?:l|lít|kg|w|watt|inch|inverter|cửa ngang|cửa trước|nắp gài|ngăn đá dưới))\b/i);
      if (specMatch) {
        keySpec = specMatch[0].toUpperCase();
      } else {
        const firstWords = answer4.split(/[,;\n]/)[0].trim();
        if (firstWords.length <= 25) {
          keySpec = firstWords;
        }
      }
    }

    // Trích xuất điểm nổi bật về tình trạng (Like New 99%, Hàng Lướt, Mới 99%...)
    let conditionHighlight = '';
    const allAnswers = Object.values(questionAnswers).join(' ').toLowerCase();
    if (allAnswers.includes('mới 100%') || allAnswers.includes('nguyên hộp') || allAnswers.includes('chưa bóc')) {
      conditionHighlight = 'Mới 100% Nguyên Hộp';
    } else if (allAnswers.includes('like-new') || allAnswers.includes('like new') || allAnswers.includes('hàng lướt') || allAnswers.includes('99%') || allAnswers.includes('vài lần')) {
      conditionHighlight = 'Hàng Lướt Like New 99%';
    } else if (allAnswers.includes('hoạt động tốt') || allAnswers.includes('nguyên bản') || allAnswers.includes('chưa từng sửa')) {
      conditionHighlight = 'Nguyên Bản Chạy Tốt';
    } else if (allAnswers.includes('xước nhẹ') || allAnswers.includes('cấn móp nhẹ')) {
      conditionHighlight = 'Hoạt Động Tốt Giá Tốt';
    } else {
      conditionHighlight = 'Chính Hãng Đẹp Bền';
    }

    const mainParts = [itmName, brandName, modelName, keySpec].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return `${mainParts} - ${conditionHighlight}`.trim();
  };

  // =========================================================================
  // Gợi ý tiêu đề bài đăng bằng AI (-1 credit AI)
  // =========================================================================
  const handleSuggestTitleWithAi = async () => {
    if ((credits?.chatCredits ?? 0) < 1) {
      showToast(lang === 'vi'
        ? 'Bạn đã hết lượt dùng AI chat (cần 1 credit). Vui lòng nạp thêm credit để AI gợi ý tiêu đề.'
        : 'Insufficient AI Chat credits. Please top up to use AI title suggestion.');
      return;
    }
    if (!postId) {
      const smartTitle = buildSmartProductTitle();
      setTitle(smartTitle);
      return;
    }

    setIsSuggestingTitle(true);
    try {
      const contextInfo = [
        brand ? `Hãng: ${brand}` : '',
        model ? `Model: ${model}` : '',
        itemCondition ? `Tình trạng: ${itemCondition}` : '',
        aiVisualReport ? `Ngoại quan: ${aiVisualReport.slice(0, 100)}` : ''
      ].filter(Boolean).join(', ');

      const res = await postService.suggestTitle(postId, contextInfo);
      if (res && res.title) {
        setTitle(res.title);
        await loadCredits();
        showToast(lang === 'vi' ? '✨ Đã tạo tiêu đề gợi ý từ AI (-1 credit)!' : '✨ Generated title suggestion with AI (-1 credit)!');
      } else {
        const smartTitle = buildSmartProductTitle();
        setTitle(smartTitle);
      }
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      if (errMsg.toLowerCase().includes('insufficient') || errMsg.toLowerCase().includes('credit')) {
        showToast(lang === 'vi' ? 'Bạn đã hết lượt dùng AI chat (hết credit).' : 'Insufficient AI chat credits.');
        await loadCredits();
      } else {
        // Fallback to client-side smart title generator
        const smartTitle = buildSmartProductTitle();
        setTitle(smartTitle);
        showToast(lang === 'vi' ? 'Không thể kết nối AI, đã tạo tiêu đề mẫu từ thông tin sẵn có.' : 'Used template title.');
      }
    } finally {
      setIsSuggestingTitle(false);
    }
  };

  // Tự động tổng hợp bài mô tả sản phẩm hoàn chỉnh, kết hợp cả ngoại quan từ ảnh và khảo sát thực tế
  const buildSmartProductDescription = (): string => {
    const sections: string[] = [];

    // 1. Ngoại hình & Thiết kế thực tế (Được AI Vision nhận diện từ ảnh chụp)
    if (aiVisualReport && aiVisualReport.trim()) {
      sections.push('✨ Ngoại hình & Thiết kế thực tế:\n' + aiVisualReport.trim());
    }

    // 2. Thông số cơ bản
    const basicSpecs: string[] = [];
    if (brand && brand.trim()) basicSpecs.push(`• Thương hiệu: ${brand.trim()}`);
    if (model && model.trim()) basicSpecs.push(`• Model: ${model.trim()}`);
    if (purchaseYear) basicSpecs.push(`• Năm mua: ${purchaseYear}`);
    if (originalPriceVnd) basicSpecs.push(`• Giá lúc mua mới: ${Number(originalPriceVnd).toLocaleString('vi-VN')} VNĐ`);

    if (basicSpecs.length > 0) {
      sections.push('📌 Thông số cơ bản:\n' + basicSpecs.join('\n'));
    }

    // 3. Hiện trạng sử dụng thực tế (Chuyển đổi câu hỏi thành tiêu đề tự nhiên, loại bỏ dấu ? thô sơ)
    const answerLines: string[] = [];
    effectiveQuestions.forEach((q, idx) => {
      const ans = questionAnswers[idx]?.trim();
      if (!ans) return;
      const parsed = parseQuestionItem(q, idx);

      let naturalLabel = parsed.label;
      const lower = naturalLabel.toLowerCase();
      if (lower.includes('tần suất') || lower.includes('mức độ sử dụng')) {
        naturalLabel = 'Tần suất & mức độ sử dụng';
      } else if (lower.includes('ngoại quan') || lower.includes('phụ kiện')) {
        naturalLabel = 'Hiện trạng ngoại quan & phụ kiện';
      } else if (lower.includes('thông số') || lower.includes('dung tích') || lower.includes('công suất')) {
        naturalLabel = 'Thông số kỹ thuật & công năng';
      } else if (lower.includes('hoạt động') || lower.includes('vận hành') || lower.includes('kỹ thuật') || lower.includes('bảo hành') || lower.includes('sửa chữa')) {
        naturalLabel = 'Tình trạng máy móc & bảo hành';
      } else {
        naturalLabel = naturalLabel.replace(/^(\d+[\.\)]\s*|\*\*)/, '').replace(/(\*\*|\?)\s*$/, '').trim();
      }

      answerLines.push(`• ${naturalLabel}: ${ans}`);
    });

    if (answerLines.length > 0) {
      sections.push('📋 Hiện trạng thực tế từ người bán:\n' + answerLines.join('\n'));
    }

    // 4. Cam kết người bán
    sections.push('💡 Cam kết: Sản phẩm hoạt động tốt, đúng như hình ảnh và thông tin mô tả. Khách mua có thể kiểm tra hàng thoải mái khi nhận.');

    return sections.join('\n\n').trim();
  };

  const handleApplyAnswersToDescription = () => {
    if (answeredCount === 0 && !aiVisualReport) {
      showToast(lang === 'vi' ? 'Vui lòng điền câu trả lời cho ít nhất một câu hỏi trước khi áp dụng.' : 'Please answer at least one question before applying.');
      return;
    }
    setIsApplyingAnswers(true);
    const fullSmartDesc = buildSmartProductDescription();
    if (fullSmartDesc) {
      setDescription(fullSmartDesc);
      setTitle(buildSmartProductTitle());
      setApplySuccessNotice(lang === 'vi' ? '✨ Đã tổng hợp đầy đủ ngoại hình và hiện trạng vào ô Mô tả bên dưới!' : '✨ Updated complete visual and condition details into description below!');
      setTimeout(() => setApplySuccessNotice(null), 4000);
    }
    setIsApplyingAnswers(false);
  };

  const handleSendAnswersToAi = async () => {
    if (answeredCount === 0) {
      showToast(lang === 'vi' ? 'Vui lòng điền câu trả lời cho ít nhất một câu hỏi trước khi gửi cho AI.' : 'Please answer at least one question before sending to AI.');
      return;
    }
    if (!sessionId || !postId) {
      handleApplyAnswersToDescription();
      return;
    }

    if ((credits?.chatCredits ?? 0) < 1) {
      showToast(lang === 'vi' ? 'Bạn đã hết lượt dùng AI hoàn thiện mô tả (cần 1 credit chat). Vui lòng nạp thêm credit.' : 'Out of AI chat credits.');
      return;
    }

    setIsSubmittingAnswersToAi(true);
    const formattedAnswers = effectiveQuestions
      .map((q, idx) => {
        const ans = questionAnswers[idx]?.trim();
        if (!ans) return null;
        const parsed = parseQuestionItem(q, idx);
        return `${parsed.label}: ${ans}`;
      })
      .filter(Boolean)
      .join(', ');

    const basicInfoParts: string[] = [];
    if (brand && brand.trim()) basicInfoParts.push(`Thương hiệu: ${brand.trim()}`);
    if (model && model.trim()) basicInfoParts.push(`Model: ${model.trim()}`);
    if (purchaseYear) basicInfoParts.push(`Năm mua: ${purchaseYear}`);
    if (originalPriceVnd) basicInfoParts.push(`Giá lúc mua: ${Number(originalPriceVnd).toLocaleString('vi-VN')} VNĐ`);

    const basicStr = basicInfoParts.length > 0 ? `Thông tin sản phẩm: ${basicInfoParts.join(', ')}.\n` : '';
    const visualStr = aiVisualReport ? `Ghi nhận ngoại quan từ ảnh chụp: ${aiVisualReport}.\n` : '';
    const surveyStr = formattedAnswers ? `Khảo sát hiện trạng thực tế từ người bán: ${formattedAnswers}.\n` : '';
    const promptMessage = `${basicStr}${visualStr}${surveyStr}`.trim();

    try {
      // Gửi trực tiếp promptMessage qua finalizeChat để AI biên tập mô tả và tiêu đề, trừ 1 credit chat
      const finalizeRes = await postService.finalizeChat(sessionId, promptMessage);
      const reply = finalizeRes?.description || (finalizeRes as any)?.message || '';
      
      if (reply) {
        const cleanedReply = cleanDescriptionFromQuestionTemplate(reply);
        setDescription(cleanedReply);
        const generatedTitle = (finalizeRes as any)?.title;
        if (generatedTitle && generatedTitle.trim()) {
          setTitle(generatedTitle.trim());
        } else {
          setTitle(buildSmartProductTitle());
        }
        setIsSessionCompleted(true);
        // Tải lại số dư credit ngay lập tức để cập nhật số lượt còn lại trên UI
        await loadCredits();
        setApplySuccessNotice(lang === 'vi' ? '✨ Trợ lý AI đã tổng hợp xong tiêu đề & mô tả (-1 credit AI)!' : '✨ AI generated engaging title and sales description below!');
        setTimeout(() => setApplySuccessNotice(null), 5000);
      } else {
        handleApplyAnswersToDescription();
      }
    } catch (err: any) {
      console.warn('Lỗi AI hoàn thiện mô tả:', err);
      if (err?.message?.toLowerCase().includes('insufficient') || err?.message?.toLowerCase().includes('credit')) {
        showToast(lang === 'vi' ? 'Bạn đã hết lượt dùng AI hoàn thiện mô tả (hết credit chat). Vui lòng nạp thêm credit.' : 'Out of AI credits.');
        await loadCredits();
      } else {
        handleApplyAnswersToDescription();
      }
    } finally {
      setIsSubmittingAnswersToAi(false);
    }
  };

  const [userChatCount, setUserChatCount] = useState<number>(0);
  const [isSessionCompleted, setIsSessionCompleted] = useState<boolean>(false);

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
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);
  const [showNoValuationModal, setShowNoValuationModal] = useState(false);
  const [mismatchType, setMismatchType] = useState<'item' | 'brand' | null>(null);
  const [detectedBrand, setDetectedBrand] = useState<string>('');
  const [imageMismatchReason, setImageMismatchReason] = useState<string | null>(null);
  const [showMismatchModal, setShowMismatchModal] = useState<boolean>(false);
  const [showAiScanConfirmModal, setShowAiScanConfirmModal] = useState<boolean>(false);

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
  const handleTriggerAiChat = () => {
    if (!selectedCategoryId) {
      showToast(lang === 'vi' ? 'Vui lòng chọn Danh mục sản phẩm trước khi quét AI' : 'Please select a Category');
      return;
    }
    if (photoPreviews.length < 3 || photoPreviews.length > 6) {
      showToast(lang === 'vi' ? 'Vui lòng tải lên từ 3 đến 6 ảnh sản phẩm hợp lệ' : 'Please upload 3 to 6 product images');
      return;
    }
    if ((credits?.chatCredits ?? 0) < 1) {
      showToast(lang === 'vi'
        ? 'Bạn đã hết lượt dùng AI chat (cần 1 credit). Vui lòng nạp thêm credit để quét hình ảnh sản phẩm.'
        : 'Insufficient AI Chat credits. Please top up to use AI visual scan.');
      return;
    }
    // Mở pop-up xác nhận để người dùng đối chiếu kỹ thông tin trước khi tiêu tốn credit
    setShowAiScanConfirmModal(true);
  };

  const handleInitPost = async (mode: 'ai' | 'manual' = 'ai') => {
    if (!selectedCategoryId) {
      showToast(lang === 'vi' ? 'Vui lòng chọn Danh mục sản phẩm' : 'Please select a Category');
      return;
    }
    if (photoPreviews.length < 3 || photoPreviews.length > 6) {
      showToast(lang === 'vi' ? 'Vui lòng tải lên từ 3 đến 6 ảnh sản phẩm hợp lệ' : 'Please upload 3 to 6 product images');
      return;
    }

    if (mode === 'ai' && (credits?.chatCredits ?? 0) < 1) {
      showToast(lang === 'vi'
        ? 'Bạn đã hết lượt dùng AI chat (cần 1 credit). Vui lòng nạp thêm credit để AI quét ngoại hình và hỗ trợ mô tả sản phẩm.'
        : 'Insufficient AI Chat credits. Please top up to use AI visual scan.');
      return;
    }

    setInitMode(mode);
    setPostMode(mode);
    setShowAiChatDrawer(mode === 'ai');
    setIsInitializingPost(true);
    try {
      const imageBlobs = await prepareImageBlobs();

      const initRes = await postService.initPost({
        categoryId: selectedCategoryId,
        itemId: selectedItemId || undefined,
        brand: brand?.trim() || undefined,
        model: model?.trim() || undefined,
        images: imageBlobs,
        mode: mode
      });

      if (initRes && initRes.postId) {
        if (mode === 'ai') {
          // Re-fetch credits to reflect deduction of 1 AI_CHAT credit
          await loadCredits();
        }
        setPostId(initRes.postId);
        setSessionId(initRes.sessionId);
        const questionnaireTemplate = initRes.aiInitialMessage || '';
        const visualAssessment = initRes.aiDescription || '';
        setAiInitialMessage(questionnaireTemplate);
        setAiVisualReport(visualAssessment);

        // Auto-generate title from selections if empty
        const selectedCat = backendCategories.find(c => c.id === selectedCategoryId);
        const selectedItm = backendItems.find(i => i.id === selectedItemId);
        const defaultTitle = `${brand ? brand + ' ' : ''}${model ? model + ' ' : ''}${selectedItm?.name || selectedCat?.name || 'Sản phẩm gia dụng'}`.trim();
        if (!title.trim() && defaultTitle) {
          setTitle(defaultTitle);
        }

        // QUAN TRỌNG: Không tự ý nhồi nhận xét ảnh hay câu hỏi khảo sát vào ô mô tả sản phẩm.
        // Để trống để người bán tự viết hoặc bấm "Gửi AI Hoàn Thiện Mô Tả" sau khi trả lời khảo sát.
        setDescription('');

        setDraftPost({
          postId: initRes.postId,
          id: initRes.postId,
          title: defaultTitle,
          description: '',
          aiDescription: visualAssessment,
          descriptionAccepted: false,
          imageUrls: photoPreviews,
          status: 'DRAFT',
        });

        // Reset chat tracking
        setUserChatCount(0);
        setIsSessionCompleted(false);
        setQuestionAnswers({});

        // Initialize Chat messages with tailored questions
        // Use Backend AI's initial combined message directly
        let initialAiText = initRes.aiInitialMessage;
        if (!initialAiText) {
          initialAiText = lang === 'vi'
            ? `Chào bạn! Tôi là Trợ lý AI SecondLife. Đã nhận diện ${photoPreviews.length} ảnh của sản phẩm. Bạn vui lòng bổ sung thêm thông tin nhé.`
            : `Hello! I am SecondLife AI Assistant. Detected ${photoPreviews.length} photos. Please provide more details.`;
        }

        setChatMessages([
          {
            role: 'ai',
            text: initialAiText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        setCurrentStep(2);
      } else {
        throw new Error('Hệ thống không trả về postId từ init');
      }
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      if (errMsg.includes('HÌNH ẢNH KHÔNG KHỚP THƯƠNG HIỆU') || errMsg.includes('KHÔNG KHỚP THƯƠNG HIỆU')) {
        let detected = '';
        const match = errMsg.match(/\[DETECTED_BRAND:\s*([^\]]+)\]/);
        if (match) {
          detected = match[1].trim();
        }
        const cleanMsg = errMsg
          .replace(/^(Khởi tạo bài đăng thất bại:\s*)?HÌNH ẢNH KHÔNG KHỚP THƯƠNG HIỆU:\s*/i, '')
          .replace(/\[DETECTED_BRAND:[^\]]+\]\s*/g, '')
          .trim();
        setMismatchType('brand');
        setDetectedBrand(detected);
        setImageMismatchReason(cleanMsg);
        setShowMismatchModal(true);
        await loadCredits();
      } else if (errMsg.includes('HÌNH ẢNH KHÔNG KHỚP') || errMsg.includes('không khớp với loại') || errMsg.includes('CẢNH_BÁO_KHÔNG_KHỚP')) {
        const cleanMsg = errMsg
          .replace(/^(Khởi tạo bài đăng thất bại:\s*)?HÌNH ẢNH KHÔNG KHỚP(\s*LOẠI SẢN PHẨM)?:\s*/i, '')
          .trim();
        setMismatchType('item');
        setDetectedBrand('');
        setImageMismatchReason(cleanMsg);
        setShowMismatchModal(true);
        await loadCredits();
      } else if (errMsg.toLowerCase().includes('insufficient') || errMsg.toLowerCase().includes('credit')) {
        showToast(lang === 'vi' ? 'Bạn đã hết lượt dùng AI chat. Vui lòng nạp thêm credit để AI quét hình ảnh sản phẩm.' : 'Insufficient AI chat credits. Please top up.');
        await loadCredits();
      } else {
        showToast('Khởi tạo bài đăng thất bại: ' + (errMsg || 'Lỗi server'));
      }
    } finally {
      setIsInitializingPost(false);
      setInitMode(null);
    }
  };

  // =========================================================================
  // STEP 2: Chat with AI & Finalize (POST /api/v1/ai/chat & /finalize-chat)
  // =========================================================================
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isSendingChat || !sessionId || !postId || isSessionCompleted) return;

    const userText = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', text: userText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setUserChatCount((prev) => prev + 1);
    setIsSendingChat(true);

    try {
      const res = await aiChatService.chat(userText, sessionId, postId);
      const reply = res?.reply || (res as any)?.message || (lang === 'vi' ? 'Đã ghi nhận thông tin sản phẩm của bạn.' : 'Noted your item details.');
      setChatMessages((prev) => [
        ...prev,
        { role: 'ai', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
      // Tự động gán mô tả nếu người dùng chưa nhập tay
      if (!description.trim() && reply) {
        setDescription(cleanDescriptionFromQuestionTemplate(reply));
      }
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      let displayError = 'Lỗi phản hồi AI: ' + (errMsg || 'Vui lòng thử lại.');
      if (errMsg.includes('Chat limit exceeded') || errMsg.includes('credit')) {
        displayError = '⚠️ Bạn đã sử dụng hết 5 tin nhắn miễn phí của bài đăng này. Vui lòng nạp thêm Chat Credit để tiếp tục hoặc bấm "Tiếp tục: Xác nhận mô tả" để tiến hành đăng bài.';
      } else if (errMsg.includes('completed') || errMsg.includes('Conflict')) {
        setIsSessionCompleted(true);
        displayError = 'ℹ️ Phiên hội thoại này đã được tổng hợp thành mô tả sản phẩm. Bạn có thể chỉnh sửa trực tiếp ở ô mô tả bên trên.';
      }
      setChatMessages((prev) => [
        ...prev,
        { role: 'ai', text: displayError, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleFinalizeChatAndSync = async () => {
    if (!sessionId || !postId) return;
    setIsFinalizingChat(true);
    try {
      const finalizeRes = await postService.finalizeChat(sessionId);
      if (finalizeRes?.description) {
        setDescription(cleanDescriptionFromQuestionTemplate(finalizeRes.description));
      }
      if (finalizeRes?.suggestedPrice) {
        const pNum = Number(finalizeRes.suggestedPrice);
        setFinalPriceVnd(pNum);
        setValuationResult({
          fairPriceMin: Math.round(pNum * 0.85),
          fairPriceMax: Math.round(pNum * 1.15),
          suggestedPrice: pNum,
          modelVersion: 'SecondLife-AI-v2.1',
          expectedSellTime: '3-5 ngày',
          createdAt: new Date().toISOString()
        });
      }
      setIsSessionCompleted(true);
      showToast(lang === 'vi' ? 'AI đã tổng hợp cuộc hội thoại và cập nhật mô tả thành công!' : 'AI summarized the chat into your description!');
    } catch (err: any) {
      showToast('Hoàn tất chat thất bại: ' + (err?.message || 'Lỗi kết nối'));
    } finally {
      setIsFinalizingChat(false);
    }
  };

  const handleGoToStep3 = async () => {
    let currentTitle = title.trim();
    let currentDesc = description.trim();

    // 1. Tự động sinh tiêu đề nếu người dùng chưa nhập
    if (!currentTitle) {
      const selectedCat = backendCategories.find(c => c.id === selectedCategoryId);
      const selectedItm = backendItems.find(i => i.id === selectedItemId);
      currentTitle = `${brand ? brand + ' ' : ''}${model ? model + ' ' : ''}${selectedItm?.name || selectedCat?.name || 'Sản phẩm gia dụng'}`.trim();
      setTitle(currentTitle);
    }

    // 1.5. Tự động tổng hợp đầy đủ ngoại hình từ ảnh và câu trả lời khảo sát vào mô tả nếu chưa có
    const currentAnsweredCount = (Object.values(questionAnswers) as string[]).filter((v) => v && typeof v === 'string' && v.trim().length > 0).length;
    if (!currentDesc && (currentAnsweredCount > 0 || aiVisualReport)) {
      currentDesc = buildSmartProductDescription();
      if (currentDesc) {
        setDescription(currentDesc);
      }
    }

    // 2. Tự động lấy mô tả từ tin nhắn AI gần nhất
    if (!currentDesc) {
      const lastAiMsg = [...chatMessages].reverse().find(m => m.role === 'ai' && !m.text.startsWith('Lỗi'));
      if (lastAiMsg?.text) {
        currentDesc = cleanDescriptionFromQuestionTemplate(lastAiMsg.text);
        setDescription(currentDesc);
      }
    } else {
      currentDesc = cleanDescriptionFromQuestionTemplate(currentDesc);
      setDescription(currentDesc);
    }

    // 3. Nếu vẫn chưa có và có phiên chat, gọi finalizeChat từ BE để tổng hợp
    if (!currentDesc && sessionId && postId) {
      try {
        setIsFinalizingChat(true);
        const finalizeRes = await postService.finalizeChat(sessionId);
        if (finalizeRes?.description) {
          currentDesc = cleanDescriptionFromQuestionTemplate(finalizeRes.description);
          setDescription(currentDesc);
        }
        if (finalizeRes?.suggestedPrice) {
          const pNum = Number(finalizeRes.suggestedPrice);
          setFinalPriceVnd(pNum);
          setValuationResult({
            fairPriceMin: Math.round(pNum * 0.85),
            fairPriceMax: Math.round(pNum * 1.15),
            suggestedPrice: pNum,
            modelVersion: 'SecondLife-AI-v2.1',
            expectedSellTime: '3-5 ngày',
            createdAt: new Date().toISOString()
          });
        }
        setIsSessionCompleted(true);
      } catch (err) {
        console.warn('Auto finalize chat warning:', err);
      } finally {
        setIsFinalizingChat(false);
      }
    }

    if (!currentTitle) {
      showToast(lang === 'vi' ? 'Vui lòng nhập Tiêu đề bài đăng.' : 'Please enter Listing Title.');
      return;
    }
    if (!currentDesc) {
      showToast(lang === 'vi' ? 'Vui lòng nhập Mô tả sản phẩm hoặc trò chuyện với AI để tạo mô tả.' : 'Please provide a Description or chat with AI.');
      return;
    }

    setCurrentStep(3);
  };

  // =========================================================================
  // STEP 3: Save Draft & Accept Description (PUT /draft & POST /accept-description)
  // =========================================================================
  const handleSaveAndAcceptDescription = async () => {
    if (!postId) return;
    if (!title.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập Tiêu đề bài đăng' : 'Please enter Title');
      return;
    }
    if (!description.trim()) {
      showToast(lang === 'vi' ? 'Vui lòng nhập hoặc áp dụng Mô tả sản phẩm' : 'Please enter Description');
      return;
    }

    if (isManualPricingInStep3) {
      if (!finalPriceVnd || finalPriceVnd < 1000) {
        showToast(lang === 'vi' ? 'Vui lòng nhập giá bán hợp lệ (ít nhất 1.000đ)' : 'Please enter a valid price (min 1,000)');
        return;
      }
    }

    setIsAcceptingDescription(true);
    try {
      // 1. PUT /api/v1/posts/{postId}/draft
      await postService.updateDraft(postId, {
        title: title.trim(),
        description: description.trim(),
        itemCondition: itemCondition || 'USED',
        price: isManualPricingInStep3 ? finalPriceVnd : null,
        shippingWeight: shippingWeight ? Number(shippingWeight) : undefined,
        shippingLength: shippingLength ? Number(shippingLength) : undefined,
        shippingWidth: shippingWidth ? Number(shippingWidth) : undefined,
        shippingHeight: shippingHeight ? Number(shippingHeight) : undefined,
      });

      // 2. POST /api/v1/posts/{postId}/accept-description
      const acceptRes = await postService.acceptDescription(postId, description.trim());
      setDescriptionAccepted(true);
      setDraftPost(acceptRes);

      if (isManualPricingInStep3) {
        setCurrentStep(5);
      } else {
        // Successfully confirmed description -> Advance to Step 4
        setCurrentStep(4);
        if (credits?.valuationCredits !== undefined && credits.valuationCredits > 0) {
          handleRunAiValuation();
        }
      }
    } catch (err: any) {
      showToast('Xác nhận mô tả thất bại: ' + (err?.message || 'Lỗi server'));
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
      if (err?.message?.includes('400') || err?.message?.toLowerCase().includes('insufficient') || err?.message?.toLowerCase().includes('không đủ lượt')) {
        setShowNoValuationModal(true);
      } else {
        showToast('Định giá AI thất bại: ' + (err?.message || 'Lỗi kết nối tới dịch vụ AI'));
      }
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
      showToast('Không thể tải lịch sử định giá: ' + (err?.message || ''));
    }
  };

  // =========================================================================
  // STEP 5: Final Submit (POST /api/v1/posts/submit/{postId})
  // =========================================================================
  const handleSubmitPostFinal = async () => {
    if (!postId) return;
    if (!finalPriceVnd || finalPriceVnd < 1000) {
      showToast(lang === 'vi' ? 'Vui lòng nhập giá bán hợp lệ (tối thiểu 1.000 đ)' : 'Please enter valid price');
      return;
    }

    if (!shippingWeight || !shippingLength || !shippingWidth || !shippingHeight) {
      showToast(lang === 'vi' ? 'Vui lòng nhập đầy đủ thông tin kích thước và trọng lượng kiện hàng' : 'Please enter shipping dimensions and weight');
      return;
    }

    // BE ShippingParcel: int, weight 1..50000 (gram), length/width/height 1..200 (cm)
    const parcel = {
      weight: Math.round(Number(shippingWeight)),
      length: Math.round(Number(shippingLength)),
      width: Math.round(Number(shippingWidth)),
      height: Math.round(Number(shippingHeight)),
    };
    if (parcel.weight < 1 || parcel.weight > 50000) {
      showToast(lang === 'vi' ? 'Trọng lượng phải từ 1 đến 50.000 gram (tối đa 50kg theo GHN)' : 'Weight must be 1–50000 grams');
      return;
    }
    if ([parcel.length, parcel.width, parcel.height].some((v) => v < 1 || v > 200)) {
      showToast(lang === 'vi' ? 'Dài/Rộng/Cao phải từ 1 đến 200 cm' : 'Length/Width/Height must be 1–200 cm');
      return;
    }

    setIsSubmittingPost(true);
    setSubmitError(null);

    // Lưu thông tin kiện hàng (Shipping Package) trước khi Submit Post
    try {
      await shippingService.updateShippingPackage(postId, parcel);
    } catch (err: any) {
      setSubmitError(
        (lang === 'vi' ? 'Không lưu được thông tin kiện hàng: ' : 'Failed to save shipping package: ') +
          (err?.message || '')
      );
      setIsSubmittingPost(false);
      return;
    }

    try {
      const submitRes = await postService.submitPost(postId, {
        title: title.trim(),
        description: description.trim(),
        price: finalPriceVnd,
        shippingWeight: parcel.weight,
        shippingLength: parcel.length,
        shippingWidth: parcel.width,
        shippingHeight: parcel.height
      });

      setSubmitResult(submitRes);
      // Reload credits (if ACTIVE, minus 1 LISTING)
      await loadCredits();
    } catch (err: any) {
      if (err?.message?.includes('400') || err?.message?.toLowerCase().includes('insufficient') || err?.message?.toLowerCase().includes('không đủ lượt')) {
        setShowNoCreditsModal(true);
      } else if (err?.message?.toLowerCase().includes('seller verification')) {
        setSubmitError(lang === 'vi'
          ? 'Tài khoản chưa hoàn tất hồ sơ xác thực người bán (eKYC). Vui lòng xác thực trước khi gửi đăng bài.'
          : 'An approved seller verification is required before publish');
      } else {
        setSubmitError(err?.message || 'Gửi bài đăng thất bại');
      }
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const handleFinishAndExit = () => {
    if (!postId) return;
    const catName = backendCategories.find((c) => c.id === selectedCategoryId)?.name || 'Thiết bị điện tử';

    // Địa chỉ của sản phẩm được cập nhật theo địa chỉ người bán (chỉ lấy phường và thành phố)
    const saved = getSavedSellerAddress();
    const finalLocation =
      sellerLocation ||
      extractWardAndCity(
        currentUser?.pickupAddress || currentUser?.address || saved.address,
        currentUser?.wardName || saved.wardName,
        currentUser?.provinceName || saved.provinceName
      ) ||
      '';
    const finalSellerAddress =
      currentUser?.pickupAddress ||
      currentUser?.address ||
      saved.address ||
      finalLocation;

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
      location: finalLocation,
      sellerAddress: finalSellerAddress,
      sellerId: currentUser?.id || 'current-user',
      sellerName: currentUser?.name || 'Người bán SecondLife',
      sellerRating: currentUser?.sellerRating || 5.0,
      sellerCompletedOrders: currentUser?.completedOrdersCount || 1,
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
                {lang === 'vi' ? 'Hệ Thống Đăng Tin & Định Giá AI' : 'AI Listing & Valuation Pipeline'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                Backend Live
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
              <span>Số dư Credit của bạn:</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white/10 font-mono font-bold text-amber-300 flex items-center gap-1 border border-white/10">
                <span>📝 {credits?.postCredits ?? 0}</span>
                <span className="text-[10px] text-slate-400">LISTING</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white/10 font-mono font-bold text-cyan-300 flex items-center gap-1 border border-white/10">
                <span>⚖️ {credits?.valuationCredits ?? 0}</span>
                <span className="text-[10px] text-slate-400">VALUATION</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white/10 font-mono font-bold text-emerald-300 flex items-center gap-1 border border-white/10">
                <span>🤖 {credits?.chatCredits ?? 0}</span>
                <span className="text-[10px] text-slate-400">AI CHAT</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
                placeholder={brandSuggestionsData.placeholder}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {brandSuggestionsData.brands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrand(b)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${brand === b ? 'bg-[#c34c36] text-white border border-[#c34c36]' : 'bg-white border border-gray-200 hover:border-[#c34c36] hover:text-[#c34c36] text-slate-700'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#24263e]">Năm mua</label>
              <input
                type="number"
                value={purchaseYear}
                onChange={(e) => setPurchaseYear(Number(e.target.value))}
                min={2018}
                max={2026}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#24263e]">Giá sản phẩm lúc mua (VNĐ)</label>
              <input
                type="text"
                value={originalPriceVnd ? formatVndInput(originalPriceVnd.toString()) : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setOriginalPriceVnd(raw ? Number(raw) : '');
                }}
                placeholder="VD: 5.000.000"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-[#24263e] focus:outline-none focus:border-[#c34c36]"
              />
              {originalPriceVnd !== '' && (
                <p className="text-[11px] text-emerald-600 font-medium italic">
                  {numberToVietnameseWords(Number(originalPriceVnd))}
                </p>
              )}
              {typeof originalPriceVnd === 'number' && originalPriceVnd > 0 && originalPriceVnd < 10000 && (
                <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-1 animate-fadeIn">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'vi' ? 'Giá bạn nhập có vẻ quá thấp (< 10.000đ). Vui lòng kiểm tra lại để AI định giá chính xác.' : 'Price seems too low (< 10,000 VND). Please verify.'}</span>
                </p>
              )}
              {typeof originalPriceVnd === 'number' && originalPriceVnd > 100000000 && (
                <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-1 animate-fadeIn">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'vi' ? 'Giá bạn nhập có vẻ bất hợp lý (> 100 triệu). Hãy kiểm tra lại số lượng số 0 để tránh AI định giá sai lệch.' : 'Price seems unusually high (> 100M VND). Please check zeros.'}</span>
                </p>
              )}
              <p className="text-[10.5px] text-slate-400 italic mt-1 leading-tight">
                Giá mua gốc chỉ mang tính chất tham khảo. Trợ lý AI sẽ tự động đối chiếu với giá thị trường thực tế của sản phẩm để định giá cho bạn.
              </p>
            </div>
          </div>

          {/* Photo Checklist 3-6 Photos */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs font-bold text-[#24263e] flex items-center gap-2">
                <span>Ảnh chụp sản phẩm thực tế (Yêu cầu 3 - 6 ảnh) *</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${photoPreviews.length >= 3 && photoPreviews.length <= 6
                    ? 'bg-emerald-100 text-emerald-800'
                    : photoPreviews.length === 0
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-rose-100 text-rose-800'
                    }`}
                >
                  Đã có: {photoPreviews.length}/6 ảnh
                </span>
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tải lên mặt trước, mặt sau, góc cạnh, tem nhãn/seri và phụ kiện để AI định giá tối ưu.
              </p>
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
                <label className="border-2 border-dashed border-gray-300 hover:border-[#c34c36] rounded-2xl flex flex-col items-center justify-center gap-1.5 aspect-square bg-slate-50 hover:bg-slate-100 transition cursor-pointer text-slate-500 text-center p-2 group shadow-xs">
                  <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center group-hover:scale-105 group-hover:border-[#c34c36] transition shadow-xs">
                    <Camera className="w-4.5 h-4.5 text-slate-500 group-hover:text-[#c34c36] transition" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 group-hover:text-[#c34c36] transition">+ Thêm ảnh</span>
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

          {/* Action Buttons: Tự Đăng Bài & Chat Với AI */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-100">
            <div className="text-xs text-slate-500 font-medium">
              <span>Đã chọn: <strong>{photoPreviews.length}/6 ảnh</strong>. Bạn có thể chọn tự điền thông tin hoặc để AI hỗ trợ.</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Nút 1: Tự đăng bài */}
              <button
                type="button"
                onClick={() => handleInitPost('manual')}
                disabled={isInitializingPost || photoPreviews.length < 3 || photoPreviews.length > 6}
                className="px-6 py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition cursor-pointer border-2 border-[#24263e]/20 bg-white text-[#24263e] hover:bg-slate-50 hover:border-[#24263e] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Tự nhập tiêu đề, mô tả và đăng bài nhanh chóng"
              >
                {isInitializingPost && initMode === 'manual' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#c34c36]" />
                    <span>Đang khởi tạo...</span>
                  </>
                ) : (
                  <>
                    <PenLine className="w-4 h-4 text-[#c34c36]" />
                    <span>Tự Đăng Bài</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                  </>
                )}
              </button>

              {/* Nút 2: Chat với AI */}
              <button
                type="button"
                onClick={handleTriggerAiChat}
                disabled={isInitializingPost || photoPreviews.length < 3 || photoPreviews.length > 6}
                className="px-7 py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2.5 transition cursor-pointer bg-gradient-to-r from-[#c34c36] to-[#24263e] text-white hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sử dụng trí tuệ nhân tạo để phân tích ảnh và hoàn thiện mô tả"
              >
                {isInitializingPost && initMode === 'ai' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>AI đang quét hình ảnh...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Chat Với AI</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-amber-200 font-bold">
                      -1 credit ({credits?.chatCredits ?? 0})
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: MÔ TẢ AI, CHỈNH SỬA & TRỢ LÝ CHAT BỔ SUNG                         */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-[#24263e] flex items-center gap-2">
                {postMode === 'ai' ? (
                  <>
                    <Bot className="w-5 h-5 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Bước 2: Hoàn Thiện Mô Tả Cùng Trợ Lý AI' : 'Step 2: AI Description & Chat'}</span>
                  </>
                ) : (
                  <>
                    <PenLine className="w-5 h-5 text-[#c34c36]" />
                    <span>{lang === 'vi' ? 'Bước 2: Tự Nhập Tiêu Đề & Mô Tả Sản Phẩm' : 'Step 2: Manual Title & Description'}</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {postMode === 'ai'
                  ? (lang === 'vi' ? 'Trò chuyện với Trợ lý AI để tự động hoàn thiện mô tả hoặc chỉnh sửa trực tiếp bên dưới.' : 'Chat with AI Assistant to refine your description or edit directly below.')
                  : (lang === 'vi' ? 'Bạn đang ở chế độ tự đăng bài. Nhập tiêu đề, mô tả và tình trạng của sản phẩm để tiếp tục.' : 'Manual mode: Enter title, description, and item condition to proceed.')}
              </p>
            </div>

            {/* Mode Switcher Pill */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setPostMode('manual');
                  setShowAiChatDrawer(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${postMode === 'manual' ? 'bg-white text-[#24263e] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Tự đăng bài</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPostMode('ai');
                  setShowAiChatDrawer(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${postMode === 'ai' ? 'bg-[#c34c36] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chat với AI</span>
              </button>
            </div>
          </div>

          {/* AI Vision Warning: Catalog / Promotional Photo Detected */}
          {postMode === 'ai' && isCatalogPhotoWarning && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 shadow-xs animate-fadeIn">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-black text-amber-900 uppercase flex items-center gap-1.5 text-[11px]">
                  <span>Nhận định từ AI Thị Giác (Llava Vision)</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">Ảnh catalog / quảng cáo</span>
                </div>
                <p className="leading-relaxed text-slate-700">
                  Hình ảnh bạn cung cấp là <strong>ảnh quảng cáo kỹ thuật số (ảnh catalog)</strong>, không phải ảnh chụp thực tế. Hệ thống AI chưa có cơ sở đánh giá độ hao mòn và tình trạng thực tế của sản phẩm.
                </p>
                <p className="text-[11px] text-amber-800 font-medium">
                  💡 <em>Khuyến nghị:</em> Hãy trả lời các câu hỏi bên dưới hoặc gửi ảnh thực tế qua chat để AI định giá chính xác và viết bài chuẩn nhất.
                </p>
              </div>
            </div>
          )}

          {/* AI Initial Description Suggestion Box (Only shown if AI produced an actual description and not just warning/questions) */}
          {postMode === 'ai' && aiInitialMessage && !isCatalogPhotoWarning && parsedAiQuestions.length === 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#24263e] flex items-center gap-1.5 uppercase text-[11px]">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Gợi ý mô tả từ Gemini / Ollama AI:
                </span>
                <button
                  type="button"
                  onClick={() => setDescription(cleanDescriptionFromQuestionTemplate(aiInitialMessage))}
                  className="px-3 py-1 rounded-lg bg-[#24263e] hover:bg-black text-white text-[11px] font-bold transition cursor-pointer"
                >
                  Dùng mô tả này
                </button>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700 italic">
                "{cleanDescriptionFromQuestionTemplate(aiInitialMessage)}"
              </p>
            </div>
          )}

          {/* Interactive AI Questionnaire: Hiện các câu hỏi cần người dùng trả lời và dưới mỗi câu thì hiện chỗ để điền */}
          {/* AI Visual Inspection Report: Hiển thị báo cáo nhận diện thị giác từ ảnh chụp */}
          {postMode === 'ai' && aiVisualReport && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/50 border border-blue-200/90 text-slate-800 text-xs space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-blue-900 flex items-center gap-1.5 uppercase text-[11px] tracking-wide">
                  <Eye className="w-4 h-4 text-blue-600" />
                  Kết quả AI thẩm định hình ảnh thực tế:
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                  <Check className="w-3 h-3" /> Ảnh chụp hợp lệ
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed italic">
                "{aiVisualReport}"
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-blue-200/50 text-[10px] text-slate-500">
                <span>* Đây là ghi nhận khách quan của AI qua ảnh để đối chiếu thông số và hỗ trợ định giá.</span>
                <button
                  type="button"
                  onClick={() => {
                    if (aiVisualReport && description.includes(aiVisualReport.trim())) {
                      showToast(lang === 'vi' ? 'Nhận xét ảnh đã có trong phần mô tả rồi' : 'Visual review already in description');
                      return;
                    }
                    setDescription(prev => prev.trim() ? `${prev.trim()}\n\n${aiVisualReport}` : aiVisualReport);
                    showToast(lang === 'vi' ? 'Đã chèn nhận xét ảnh vào ô Mô tả' : 'Inserted visual review into description');
                  }}
                  className="text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                >
                  Chèn vào mô tả
                </button>
              </div>
            </div>
          )}

          {postMode === 'ai' && effectiveQuestions.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/30 to-white rounded-3xl p-5 sm:p-6 border-2 border-amber-200/90 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/70 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-[#c34c36] text-white font-black text-xs flex items-center gap-1.5 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      <span>{lang === 'vi' ? 'Khảo Sát Chi Tiết Sản Phẩm Cùng AI' : 'AI Product Questionnaire'}</span>
                    </span>
                    <span className="text-xs font-extrabold text-[#24263e]">
                      {currentCategory?.name || 'Sản phẩm'} • {currentItem?.name || 'Thiết bị'}
                    </span>
                    {brand && (
                      <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                        {brand}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {lang === 'vi'
                      ? 'AI đã quét hình ảnh và phân tích danh mục. Hãy điền câu trả lời bên dưới mỗi câu hỏi để hệ thống định giá chính xác và tự động hoàn thiện mô tả.'
                      : 'AI analyzed your uploaded photos. Please fill in the answers under each question to help AI generate an accurate valuation and description.'}
                  </p>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-2xl border border-amber-200 shadow-2xs self-start sm:self-auto shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiến độ điền</div>
                    <div className="text-xs font-black text-[#c34c36]">
                      {answeredCount}/{effectiveQuestions.length} câu đã trả lời
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center border border-amber-300">
                    {Math.round((answeredCount / (effectiveQuestions.length || 1)) * 100)}%
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-amber-100/70 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-[#c34c36] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.round((answeredCount / (effectiveQuestions.length || 1)) * 100)}%` }}
                />
              </div>

              {/* Notice Message */}
              {applySuccessNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2 animate-fadeIn shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{applySuccessNotice}</span>
                </div>
              )}

              {/* List of Questions with Input Fields Underneath */}
              <div className="grid grid-cols-1 gap-3.5">
                {effectiveQuestions.map((q, idx) => {
                  const parsed = parseQuestionItem(q, idx);
                  const currentVal = questionAnswers[idx] || '';
                  const hasAnswer = currentVal.trim().length > 0;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all ${hasAnswer
                          ? 'bg-white border-emerald-300 shadow-xs'
                          : 'bg-white/85 border-amber-200/90 hover:border-amber-400 shadow-2xs'
                        }`}
                    >
                      {/* Tiêu đề & Số thứ tự */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 mt-0.5 ${hasAnswer ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-[#24263e] text-white'
                              }`}
                          >
                            {hasAnswer ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </span>
                          <div>
                            <h4 className="text-xs font-black text-[#24263e] leading-snug">
                              {parsed.label}
                            </h4>
                            {parsed.hint && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5">
                                {parsed.hint}
                              </p>
                            )}
                          </div>
                        </div>

                        {hasAnswer && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Đã điền
                          </span>
                        )}
                      </div>

                      {/* Các nút bấm Gợi ý nhanh (+ 6 tháng, + 1 năm...) */}
                      {parsed.examples.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-2 sm:pl-8">
                          <span className="text-[10px] text-slate-400 font-bold">Gợi ý nhanh:</span>
                          {parsed.examples.map((ex, exIdx) => (
                            <button
                              key={exIdx}
                              type="button"
                              onClick={() => handleAnswerChange(idx, ex)}
                              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${currentVal === ex
                                  ? 'bg-[#c34c36] text-white border-[#c34c36]'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                                }`}
                              title={`Bấm để điền nhanh "${ex}"`}
                            >
                              + {ex}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Ô Input nhập câu trả lời */}
                      <div className="sm:pl-8">
                        <div className="relative">
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) => handleAnswerChange(idx, e.target.value)}
                            placeholder={
                              parsed.examples.length > 0
                                ? `VD: ${parsed.examples.slice(0, 3).join(', ')}...`
                                : 'Nhập câu trả lời cho câu hỏi này...'
                            }
                            className="w-full px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#c34c36] rounded-xl text-xs font-semibold text-[#24263e] focus:outline-none transition shadow-2xs"
                          />
                          {currentVal && (
                            <button
                              type="button"
                              onClick={() => handleAnswerChange(idx, '')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs cursor-pointer transition"
                              title="Xóa câu trả lời"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action Bar for Questionnaire */}
              <div className="mt-4 pt-3.5 border-t border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-600 flex items-center gap-1.5 self-start sm:self-auto">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {answeredCount > 0
                      ? `Đã điền ${answeredCount}/${effectiveQuestions.length} câu trả lời. Bấm nút để AI viết bài mô tả hoàn chỉnh:`
                      : 'Hãy trả lời các câu hỏi phía trên để AI hỗ trợ viết bài mô tả chuẩn xác nhất.'}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleApplyAnswersToDescription}
                    disabled={answeredCount === 0 || isApplyingAnswers}
                    className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                    title="Chèn nguyên văn câu trả lời vào mô tả"
                  >
                    {isApplyingAnswers ? 'Đang chèn...' : 'Chèn vào mô tả'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSendAnswersToAi}
                    disabled={answeredCount === 0 || isSubmittingAnswersToAi || (credits?.chatCredits ?? 0) < 1}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c34c36] to-[#dc4729] hover:opacity-95 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Gửi câu trả lời để AI tổng hợp bài mô tả hoàn chỉnh (-1 credit chat)"
                  >
                    {isSubmittingAnswersToAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI đang viết mô tả...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-200" />
                        <span>Gửi AI Hoàn Thiện Mô Tả</span>
                        <span className="ml-1 px-1.5 py-0.5 rounded-md bg-black/30 text-[10px] font-bold text-amber-200">
                          -1 credit (còn {credits?.chatCredits ?? 0})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Editing Fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#24263e]">Tiêu đề bài đăng *</label>
                <button
                  type="button"
                  onClick={handleSuggestTitleWithAi}
                  disabled={isSuggestingTitle || (credits?.chatCredits ?? 0) < 1}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/90 hover:bg-amber-200 px-3 py-1 rounded-xl border border-amber-300 flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                  title="Sử dụng AI để đặt tiêu đề hấp dẫn chuẩn sàn TMĐT (-1 credit AI chat)"
                >
                  {isSuggestingTitle ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                      <span>AI đang tạo tiêu đề...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>AI Gợi Ý Tiêu Đề</span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md font-bold">
                        -1 credit ({credits?.chatCredits ?? 0})
                      </span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Nồi Cơm Điện BlueStone 1.8L - Hàng Lướt Like New 99%"
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
                placeholder="Mô tả chi tiết tình trạng máy móc, thời gian sử dụng, phụ kiện kèm theo... (hoặc trả lời 4 câu hỏi bên trên rồi bấm 'Gửi AI Hoàn Thiện Mô Tả' để AI viết bài)"
                className="w-full px-4 py-3 bg-slate-50 border border-gray-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-[#c34c36]"
              />
              {postMode === 'manual' && (
                <p className="text-[11px] text-slate-500 italic mt-1">
                  * Đối với tự mô tả bài đăng, bạn cần mô tả cụ thể và kỹ càng tình trạng, chức năng, phụ kiện đi kèm để tránh khiếu nại sau này.
                </p>
              )}
            </div>

            {/* Phân loại tình trạng thông minh: Tự động suy luận từ bộ câu hỏi */}
            <div className="p-3.5 bg-gradient-to-r from-slate-50 via-amber-50/20 to-slate-50 border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-[#24263e]">Tình trạng phân loại sản phẩm</span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
                      Tự động từ khảo sát
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hệ thống tự động suy luận theo câu trả lời phía trên để hiển thị huy hiệu trên sàn và định giá.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <select
                  value={itemCondition}
                  onChange={(e) => setItemCondition(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36] shadow-2xs cursor-pointer"
                  title="Bấm để điều chỉnh nếu muốn"
                >
                  <option value="NEW">Mới 100% (Nguyên hộp)</option>
                  <option value="LIKE_NEW">Như mới (Grade A+ 99%)</option>
                  <option value="USED_GOOD">Đã qua sử dụng - Tốt (Grade A)</option>
                  <option value="USED_FAIR">Đã qua sử dụng - Xước nhẹ (Grade B)</option>
                  <option value="USED">Cũ bình thường (Grade C)</option>
                </select>
              </div>
            </div>

            {/* Thông tin đóng gói GHN với bộ chọn đơn vị thông minh (kg/g, cm/m) */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/90 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-gray-200/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-[#24263e]">
                    Thông tin kiện hàng giao hàng (Bắt buộc để tính phí GHN)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 italic">
                  * Tự động quy đổi chuẩn BE/GHN: Trọng lượng (gram) • Kích thước (cm)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                {/* Trọng lượng */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Trọng lượng *</label>
                    <div className="flex items-center bg-gray-200/80 rounded-lg p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleWeightUnitSwitch('kg')}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${weightUnit === 'kg' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWeightUnitSwitch('g')}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${weightUnit === 'g' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        g
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step={weightUnit === 'kg' ? '0.1' : '1'}
                    min="0.1"
                    placeholder={weightUnit === 'kg' ? 'VD: 3.5' : 'VD: 3500'}
                    value={rawWeightInput}
                    onChange={(e) => handleWeightChange(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
                  />
                  {shippingWeight ? (
                    <span className="text-[10px] font-bold text-emerald-600 block pl-1">
                      = {Number(shippingWeight).toLocaleString('vi-VN')} gram (chuẩn GHN)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 block pl-1">Nhập cân nặng ({weightUnit})</span>
                  )}
                </div>

                {/* Chiều dài */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Chiều Dài *</label>
                    <div className="flex items-center bg-gray-200/80 rounded-lg p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleDimensionUnitSwitch('cm')}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${dimensionUnit === 'cm' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        cm
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDimensionUnitSwitch('m')}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${dimensionUnit === 'm' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        m
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step={dimensionUnit === 'm' ? '0.05' : '1'}
                    min="1"
                    placeholder={dimensionUnit === 'm' ? 'VD: 0.3' : 'VD: 30'}
                    value={rawLengthInput}
                    onChange={(e) => handleDimensionChange('length', e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
                  />
                  {shippingLength ? (
                    <span className="text-[10px] font-bold text-emerald-600 block pl-1">
                      = {shippingLength} cm
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 block pl-1">Dài ({dimensionUnit})</span>
                  )}
                </div>

                {/* Chiều rộng */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Chiều Rộng *</label>
                    <span className="text-[10px] font-bold text-slate-400">({dimensionUnit})</span>
                  </div>
                  <input
                    type="number"
                    step={dimensionUnit === 'm' ? '0.05' : '1'}
                    min="1"
                    placeholder={dimensionUnit === 'm' ? 'VD: 0.25' : 'VD: 25'}
                    value={rawWidthInput}
                    onChange={(e) => handleDimensionChange('width', e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
                  />
                  {shippingWidth ? (
                    <span className="text-[10px] font-bold text-emerald-600 block pl-1">
                      = {shippingWidth} cm
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 block pl-1">Rộng ({dimensionUnit})</span>
                  )}
                </div>

                {/* Chiều cao */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Chiều Cao *</label>
                    <span className="text-[10px] font-bold text-slate-400">({dimensionUnit})</span>
                  </div>
                  <input
                    type="number"
                    step={dimensionUnit === 'm' ? '0.05' : '1'}
                    min="1"
                    placeholder={dimensionUnit === 'm' ? 'VD: 0.2' : 'VD: 20'}
                    value={rawHeightInput}
                    onChange={(e) => handleDimensionChange('height', e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#24263e] focus:outline-none focus:border-[#c34c36]"
                  />
                  {shippingHeight ? (
                    <span className="text-[10px] font-bold text-emerald-600 block pl-1">
                      = {shippingHeight} cm
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 block pl-1">Cao ({dimensionUnit})</span>
                  )}
                </div>
              </div>
            </div>
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
              onClick={handleGoToStep3}
              disabled={isFinalizingChat}
              className="px-6 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-black shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isFinalizingChat ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tổng hợp mô tả...</span>
                </>
              ) : (
                <>
                  <span>Tiếp tục: Xác nhận mô tả</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
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
              <div className="p-3 bg-white rounded-xl border border-gray-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto subtle-scrollbar">
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

          {/* Manual Pricing Option */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="pricingMethod" 
                  checked={!isManualPricingInStep3} 
                  onChange={() => setIsManualPricingInStep3(false)} 
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-bold text-slate-700">Dùng AI Định Giá (Đề xuất)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="pricingMethod" 
                  checked={isManualPricingInStep3} 
                  onChange={() => setIsManualPricingInStep3(true)} 
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-bold text-slate-700">Tự Định Giá</span>
              </label>
            </div>

            {isManualPricingInStep3 && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">Nhập giá bán mong muốn (VNĐ) <span className="text-red-500">*</span></label>
                <div className="relative max-w-sm">
                  <input
                    type="text"
                    value={finalPriceVnd > 0 ? new Intl.NumberFormat('vi-VN').format(finalPriceVnd) : ''}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/\D/g, '');
                      setFinalPriceVnd(Number(numericValue));
                    }}
                    placeholder="VD: 500.000"
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none font-black text-slate-800 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">đ</span>
                </div>
              </div>
            )}
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
                  <span>Đang lưu và xác nhận...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isManualPricingInStep3 ? 'Lưu, Đặt Giá & Sang Bước Đăng Bài' : 'Xác Nhận Mô Tả & Tiếp Tục Định Giá AI'}</span>
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
                  {credits?.valuationCredits ?? 0} VALUATION
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
                disabled={isEstimatingPrice || (credits?.valuationCredits ?? 0) < 1}
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
                    <span>{valuationResult ? 'Định Giá Lại Bằng AI (-1 Credit)' : 'Định Giá Bằng AI (-1 Credit)'}</span>
                    <span className="text-[10px] opacity-80 font-bold bg-black/20 px-1.5 py-0.5 rounded">
                      Còn: {credits?.valuationCredits ?? 0}
                    </span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-xs">
                  <span className="text-[11px] text-slate-500 font-bold block">Khoảng giá hợp lý:</span>
                  <div className="text-sm font-black text-slate-800 mt-1">
                    {formatVND(valuationResult.fairPriceMin)} - {formatVND(valuationResult.fairPriceMax)}
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-300 shadow-sm ring-2 ring-amber-400/30 flex flex-col justify-center items-center text-center">
                  <span className="text-[11px] text-amber-800 font-bold block uppercase tracking-wider mb-1">Giá đề xuất dễ bán nhất:</span>
                  <div className="text-2xl font-black text-[#c34c36]">
                    {formatVND(valuationResult.suggestedPrice)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setFinalPriceVnd(valuationResult.suggestedPrice)}
                  className="w-full py-3.5 bg-gradient-to-r from-[#c34c36] to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Sử dụng mức giá này để bán nhanh</span>
                </button>
                <div className="flex items-start gap-2 bg-white/50 p-3 rounded-xl border border-emerald-100">
                  <span className="text-lg leading-none mt-0.5">💡</span>
                  <p className="text-[11px] text-emerald-800 italic leading-relaxed">
                    <strong>Lưu ý:</strong> Mức giá trên được AI tính toán độc lập dựa trên tình trạng hao mòn và giá trị thị trường thực tế hiện tại của sản phẩm, không phụ thuộc hoàn toàn vào giá mua gốc mà bạn đã nhập.
                  </p>
                </div>
                {typeof originalPriceVnd === 'number' && originalPriceVnd > 0 && (
                  originalPriceVnd < valuationResult.fairPriceMin * 0.7 || 
                  originalPriceVnd > valuationResult.fairPriceMax * 2.8
                ) && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 animate-fadeIn shadow-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-black text-rose-700 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Giá bạn nhập có vẻ bất hợp lý so với thị trường' : 'Declared price appears unreasonable'}</span>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      {lang === 'vi' ? (
                        <>
                          Mức giá mua gốc bạn khai báo ({formatVND(originalPriceVnd)}) có sự chênh lệch lớn so với giá trị thị trường của sản phẩm này (khoảng <strong>{formatVND(valuationResult.fairPriceMin)} - {formatVND(valuationResult.fairPriceMax)}</strong>).
                        </>
                      ) : (
                        <>
                          Your declared price ({formatVND(originalPriceVnd)}) differs significantly from current market range (around <strong>{formatVND(valuationResult.fairPriceMin)} - {formatVND(valuationResult.fairPriceMax)}</strong>).
                        </>
                      )}
                    </p>
                    <p className="text-[11px] text-rose-700 font-medium italic">
                      {lang === 'vi' 
                        ? `👉 AI đã tự động đối chiếu giá thị trường thực tế và phân tích độ hao mòn qua ảnh để định giá chuẩn xác (${formatVND(valuationResult.suggestedPrice)}) giúp bài đăng dễ bán nhất.`
                        : `👉 AI automatically referenced realistic market benchmarks and visual wear to suggest a fair selling price (${formatVND(valuationResult.suggestedPrice)}).`}
                    </p>
                  </div>
                )}
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
              <input
                type="text"
                value={finalPriceVnd > 0 ? new Intl.NumberFormat('vi-VN').format(finalPriceVnd) : ''}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/\D/g, '');
                  setFinalPriceVnd(Number(numericValue));
                }}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:border-[#c34c36]"
              />
            </div>
            {valuationResult && finalPriceVnd > valuationResult.fairPriceMax * 1.3 && (
              <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1.5 mt-1.5 animate-fadeIn">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  {lang === 'vi'
                    ? `Giá bạn đặt (${formatVND(finalPriceVnd)}) cao hơn mức giá thị trường đề xuất (${formatVND(valuationResult.fairPriceMax)}). Sản phẩm có thể khó bán hoặc mất nhiều thời gian hơn.`
                    : `Your price (${formatVND(finalPriceVnd)}) is higher than recommended market maximum (${formatVND(valuationResult.fairPriceMax)}).`}
                </span>
              </p>
            )}

            {/* High-value threshold notice (> 10,000,000 VND) */}
            {finalPriceVnd >= 10000000 && (
              <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Sản phẩm giá trị cao (từ 10.000.000 VND trở lên):</span>
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

            {/* Thông tin đóng gói GHN */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-600 block mb-3">
                <Truck className="w-4 h-4 inline mr-1 text-blue-600" />
                Thông tin kiện hàng (Sử dụng để tính phí vận chuyển):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-gray-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Trọng lượng</label>
                  <div className="mt-1 text-xs font-bold text-[#24263e]">{shippingWeight ? `${shippingWeight} gram` : '---'}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Chiều Dài</label>
                  <div className="mt-1 text-xs font-bold text-[#24263e]">{shippingLength ? `${shippingLength} cm` : '---'}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Chiều Rộng</label>
                  <div className="mt-1 text-xs font-bold text-[#24263e]">{shippingWidth ? `${shippingWidth} cm` : '---'}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Chiều Cao</label>
                  <div className="mt-1 text-xs font-bold text-[#24263e]">{shippingHeight ? `${shippingHeight} cm` : '---'}</div>
                </div>
              </div>
            </div>

            {/* Địa chỉ kho lấy hàng của người bán */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-600 block mb-2">
                <MapPin className="w-4 h-4 inline mr-1 text-[#c34c36]" />
                {lang === 'vi' ? 'Địa chỉ lấy hàng người bán (Cập nhật theo thông tin người bán):' : 'Seller Pickup Location (Updated with seller profile):'}
              </span>
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#24263e]">
                    {currentUser?.pickupAddress || currentUser?.address || getSavedSellerAddress().address || (lang === 'vi' ? 'Kho hàng SecondLife' : 'SecondLife Warehouse')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {lang === 'vi' ? 'Khu vực hiển thị trên tin đăng: ' : 'Display region on listing: '}
                    <span className="font-semibold text-emerald-700">
                      {sellerLocation || extractWardAndCity(currentUser?.pickupAddress || currentUser?.address || getSavedSellerAddress().address, currentUser?.wardName || getSavedSellerAddress().wardName, currentUser?.provinceName || getSavedSellerAddress().provinceName) || 'Hà Nội'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Submission Result Banner */}
          {submitResult && (
            <div
              className={`p-5 rounded-2xl border space-y-4 animate-fadeIn ${submitResult.status === 'ACTIVE'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : submitResult.status === 'INSUFFICIENT_CREDIT'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : submitResult.status === 'PENDING_INSPECTION'
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-950'
                    : submitResult.status === 'PENDING'
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
            >
              <div className="flex items-start gap-3">
                {submitResult.status === 'ACTIVE' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : submitResult.status === 'INSUFFICIENT_CREDIT' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                ) : submitResult.status === 'PENDING_INSPECTION' ? (
                  <ShieldCheck className="w-6 h-6 text-cyan-600 shrink-0 mt-0.5" />
                ) : submitResult.status === 'PENDING' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h4 className="font-black text-sm uppercase">
                    {submitResult.status === 'ACTIVE'
                      ? 'Đăng bài thành công! (ACTIVE)'
                      : submitResult.status === 'INSUFFICIENT_CREDIT'
                        ? 'Cần nạp thêm Credit để thanh toán phí kiểm định'
                        : submitResult.status === 'PENDING_INSPECTION'
                          ? 'Chờ kiểm định chất lượng trung tâm (PENDING_INSPECTION)'
                          : submitResult.status === 'PENDING'
                            ? 'Nghi ngờ trùng lặp - Chờ STAFF kiểm duyệt (PENDING)'
                            : 'Bài đăng bị từ chối (REJECTED)'}
                  </h4>
                  <p className="text-xs leading-relaxed">
                    {submitResult.message || (
                      submitResult.status === 'ACTIVE'
                        ? 'Bài đăng của bạn đã được xuất bản công khai. Đã trừ 1 lượt LISTING.'
                        : submitResult.status === 'INSUFFICIENT_CREDIT'
                          ? 'Sản phẩm có giá trị > 10.000.000 đ bắt buộc phải qua kiểm định. Bạn chưa có đủ credit để thanh toán phí.'
                          : submitResult.status === 'PENDING_INSPECTION'
                            ? 'Sản phẩm có giá trị > 10 triệu đồng đang chờ Kỹ thuật viên trung tâm kiểm định tiếp nhận.'
                            : submitResult.status === 'PENDING'
                              ? 'Phát hiện hình ảnh hoặc nội dung trùng với bài đăng khác trên sàn. Nhân viên Staff sẽ đối soát thủ công.'
                              : (submitResult.reviewReason || 'Bài đăng không đạt tiêu chuẩn nội dung của sàn. Không trừ credit.')
                    )}
                  </p>
                </div>
              </div>

              {/* Fee Breakdown if Inspection is required */}
              {submitResult.inspectionRequired && (
                <div className="p-3.5 bg-white/90 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Phí kiểm định kỹ thuật:</span>
                    <span className="font-black text-slate-800">
                      {formatVND(Number(submitResult.inspectionFee || 200000))}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Phí vận chuyển trung tâm:</span>
                    <span className="font-black text-slate-800">
                      {formatVND(Number(submitResult.shippingFee || 50000))}
                    </span>
                  </div>
                  {submitResult.creditShortfall != null && Number(submitResult.creditShortfall) > 0 && (
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-rose-600 block text-[11px] font-bold">Số tiền/credit còn thiếu:</span>
                      <span className="font-black text-rose-600 text-sm">
                        {formatVND(Number(submitResult.creditShortfall))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {submitResult.duplicateMatches && submitResult.duplicateMatches.length > 0 && (
                <div className="p-3 bg-white/80 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-slate-700 block">Danh sách bài đối chiếu trùng khớp:</span>
                  <div className="font-mono text-[11px] text-slate-600">
                    {submitResult.duplicateMatches.join(', ')}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {submitResult.status === 'INSUFFICIENT_CREDIT' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => showToast('Vui lòng truy cập trang Ví để nạp Credit.')}
                      className="px-4 py-2 rounded-xl bg-[#c34c36] hover:bg-[#a83c28] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-300" />
                      <span>Nạp thêm Credit ngay</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitPostFinal}
                      disabled={isSubmittingPost}
                      className="px-4 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold transition cursor-pointer"
                    >
                      Thử gửi lại bài đăng
                    </button>
                  </>
                ) : (
                  <>
                    {submitResult.status === 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitResult(null);
                          setCurrentStep(3);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-[#c34c36] hover:bg-[#a83c28] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Sửa lại thông tin</span>
                      </button>
                    )}
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
                  </>
                )}
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
                disabled={isSubmittingPost || (credits?.postCredits ?? 0) < 1}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white font-black text-sm shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPost ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang gửi bài...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                    <span>Gửi bài đăng</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Global Toast for CreateListingView */}
      {toastMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-slate-900/95 text-white text-sm font-bold rounded-full shadow-2xl flex items-center gap-2 animate-fadeIn border border-slate-700/50 backdrop-blur-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* No Credits Modal */}
      {showNoCreditsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleIn">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">
                {lang === 'vi' ? 'Bạn đã hết lượt đăng tin' : 'Out of listing credits'}
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                {lang === 'vi' 
                  ? 'Số lượt đăng bài của bạn đã hết. Vui lòng nạp thêm các gói dịch vụ để tiếp tục sử dụng tính năng này.' 
                  : 'You have run out of listing credits. Please top up your package to continue.'}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowNoCreditsModal(false)}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#c34c36] to-[#dc4729] text-white hover:opacity-95 transition"
                >
                  {lang === 'vi' ? 'Đã hiểu' : 'Understood'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* No Valuation Credits Modal */}
      {/* Modal Xác Nhận Dùng AI Quét Ảnh (-1 Credit) */}
      {showAiScanConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-amber-200 animate-scaleIn">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-[#c34c36] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md text-white">
                <Sparkles className="w-8 h-8 text-amber-200 animate-pulse" />
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black uppercase tracking-wider mb-2 inline-block">
                Chi Phí: 1 Credit AI Chat
              </span>
              <h3 className="text-lg font-black text-slate-900 mb-2">
                {lang === 'vi' ? 'Xác Nhận Quét Hình Ảnh Bằng AI?' : 'Confirm AI Visual Scan?'}
              </h3>

              {/* Bảng rà soát thông tin trước khi quét */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left my-4 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Danh mục & Loại:</span>
                  <span className="font-bold text-[#24263e]">
                    {backendItems.find(i => i.id === selectedItemId)?.name || backendCategories.find(c => c.id === selectedCategoryId)?.name || 'Chưa chọn'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Thương hiệu bạn điền:</span>
                  <span className="font-bold text-[#c34c36]">{brand ? brand.trim() : 'Chưa điền thương hiệu'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Số lượng ảnh gửi quét:</span>
                  <span className="font-bold text-slate-700">{photoPreviews.length} ảnh</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">Số dư credit của bạn:</span>
                  <span className="font-bold text-emerald-700">{credits?.chatCredits ?? 0} credit</span>
                </div>
              </div>

              {/* Hộp Cảnh Báo Tiêu Tốn Tài Nguyên */}
              <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 text-left mb-6 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-950 font-medium leading-relaxed">
                    {lang === 'vi'
                      ? 'Lưu ý: Quá trình quét ảnh tiêu tốn tài nguyên AI thực tế. Nếu thông tin bạn nhập (loại máy hoặc thương hiệu) không khớp với ảnh, 1 credit vẫn sẽ bị trừ. Vui lòng đảm bảo thông tin trên là chính xác!'
                      : 'Note: Visual scanning consumes AI computing power. If your entered info does not match the photos, 1 credit will still be consumed.'}
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAiScanConfirmModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  {lang === 'vi' ? 'Kiểm Tra Lại' : 'Review Again'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAiScanConfirmModal(false);
                    handleInitPost('ai');
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-[#c34c36] to-[#24263e] hover:opacity-95 text-white transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  {lang === 'vi' ? 'Xác Nhận & Quét (-1)' : 'Confirm & Scan (-1)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cảnh báo Hình ảnh không khớp (Loại sản phẩm hoặc Thương hiệu) */}
      {showMismatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-rose-200 animate-scaleIn">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-xs ${
                mismatchType === 'brand' ? 'bg-amber-100 border-amber-300' : 'bg-rose-100 border-rose-300'
              }`}>
                <AlertTriangle className={`w-8 h-8 ${mismatchType === 'brand' ? 'text-amber-600' : 'text-rose-600'}`} />
              </div>
              <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider mb-2 inline-block ${
                mismatchType === 'brand' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {mismatchType === 'brand' ? 'AI Vision Phát Hiện Khác Thương Hiệu' : 'AI Vision Phát Hiện Khác Loại Thiết Bị'}
              </span>
              <h3 className="text-lg font-black text-slate-900 mb-2">
                {mismatchType === 'brand' 
                  ? (lang === 'vi' ? 'Hình ảnh không khớp với Thương hiệu đã nhập!' : 'Image brand mismatch detected!')
                  : (lang === 'vi' ? 'Hình ảnh không khớp với Loại sản phẩm!' : 'Image product type mismatch detected!')}
              </h3>

              {/* Thông tin đối chiếu */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left my-4 space-y-2.5 text-xs">
                {mismatchType === 'brand' ? (
                  <>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">Thương hiệu bạn đã nhập:</span>
                      <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">{brand || 'Chưa nhập'}</span>
                    </div>
                    {detectedBrand && (
                      <div className="flex items-center justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500 font-medium">Thương hiệu AI nhìn thấy trong ảnh:</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{detectedBrand}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Loại sản phẩm bạn đã chọn:</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {backendItems.find(i => i.id === selectedItemId)?.name || 'Chưa xác định'}
                    </span>
                  </div>
                )}
                
                <div className="pt-1.5 flex items-start gap-2 text-slate-700 leading-relaxed">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] font-medium">
                    {imageMismatchReason || (lang === 'vi' 
                      ? 'Hình ảnh bạn tải lên có sự sai lệch với thông tin đã khai báo. Vui lòng kiểm tra lại trước khi tiếp tục.'
                      : 'The uploaded image conflicts with the declared product information.')}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-6">
                {lang === 'vi'
                  ? 'Hệ thống đã hoàn tất lượt quét ảnh và trừ 1 credit AI Chat. Vui lòng điều chỉnh lại thông tin chính xác theo gợi ý bên dưới.'
                  : 'System scanned images and deducted 1 AI credit. Please adjust your information below.'}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {mismatchType === 'brand' && detectedBrand && (
                  <button
                    type="button"
                    onClick={() => {
                      setBrand(detectedBrand);
                      setShowMismatchModal(false);
                      showToast(lang === 'vi' ? `Đã tự động đổi thương hiệu thành ${detectedBrand}` : `Brand updated to ${detectedBrand}`);
                    }}
                    className="w-full py-3 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {lang === 'vi' ? `Đổi thương hiệu thành "${detectedBrand}"` : `Update brand to "${detectedBrand}"`}
                  </button>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  {mismatchType === 'brand' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMismatchModal(false);
                        const brandEl = document.querySelector('input[placeholder*="Philips"]') as HTMLElement;
                        brandEl?.focus();
                      }}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-[#24263e] hover:bg-black text-white transition shadow-sm cursor-pointer"
                    >
                      {lang === 'vi' ? 'Nhập Lại Thương Hiệu' : 'Change Brand'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMismatchModal(false);
                        const itemEl = document.querySelector('select') as HTMLElement;
                        itemEl?.focus();
                      }}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-[#24263e] hover:bg-black text-white transition shadow-sm cursor-pointer"
                    >
                      {lang === 'vi' ? 'Chọn Lại Loại Thiết Bị' : 'Change Product Type'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowMismatchModal(false);
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    {lang === 'vi' ? 'Tải Lại Ảnh Khác' : 'Upload Other Photos'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNoValuationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleIn">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">
                {lang === 'vi' ? 'Bạn đã hết lượt định giá' : 'Out of valuation credits'}
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                {lang === 'vi' 
                  ? 'Số lượt định giá AI của bạn đã hết. Vui lòng nạp thêm gói định giá để tiếp tục.' 
                  : 'You have run out of valuation credits. Please top up your package to continue.'}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowNoValuationModal(false)}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-95 transition"
                >
                  {lang === 'vi' ? 'Đã hiểu' : 'Understood'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
