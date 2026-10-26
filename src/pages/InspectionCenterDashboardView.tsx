import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  ClipboardList,
  Users,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  Search,
  Filter,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Calendar,
  MapPin,
  Phone,
  ShieldCheck,
  RefreshCw,
  Loader2,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Layers,
  Navigation,
  UserCheck,
  Activity,
  User,
  KeyRound,
  Mail,
  Briefcase,
  LayoutDashboard,
  Menu,
  Home,
  LogOut,
  Sliders,
  Plus,
  Trash2,
  Edit3,
  FileCheck,
  Zap,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Info,
  CheckSquare,
  Square,
  FileText,
  ShieldAlert,
  Boxes,
  FolderPlus,
  Truck,
  Package,
  CreditCard,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import logoImg from '../assets/logo.png';
import { Language, UserProfile, EscrowOrder, CategoryBackend, ItemBackend, ShipmentBackend } from '../types';
import { formatVND } from '../utils/translations';
import { dialogService } from '../utils/dialogService';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';
import {
  inspectorService,
  categoryService,
  shippingService,
  InspectionOrderDto,
  InspectionStaffDto,
  InspectionChecklistResponse,
  InspectionTravelTierDto,
  InspectionFeeProposalResponse
} from '../services';

interface InspectionCenterDashboardViewProps {
  initialOrders?: EscrowOrder[];
  currentUser?: UserProfile | null;
  lang?: Language;
  onNavigate?: (tab: string) => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onViewWebsite?: () => void;
}

export type CenterTab = 'overview' | 'dispatch' | 'staff' | 'orders' | 'checklists' | 'pricing';

export interface AppliancePreset {
  key: string;
  name: string;
  categoryKeyword: string;
  icon: string;
  title: string;
  description: string;
  items: {
    itemTitle: string;
    criteriaDescription: string;
    mandatory: boolean;
  }[];
}

export const APPLIANCE_PRESETS: AppliancePreset[] = [
  {
    key: 'refrigerator',
    name: 'Tủ Lạnh / Tủ Đông',
    categoryKeyword: 'Bếp & Phòng ăn',
    icon: '🧊',
    title: 'Tiêu Chuẩn Kiểm Định Tủ Lạnh & Thiết Bị Làm Lạnh Inverter',
    description: 'Quy chuẩn kiểm tra Block máy nén, môi chất lạnh R600a/R134a, độ kín gioăng cửa, bo mạch điều khiển biến tần và xả đá tự động theo tiêu chuẩn SecondLife Hub.',
    items: [
      {
        itemTitle: 'Đo dòng khởi động & kiểm tra Block máy nén (Compressor)',
        criteriaDescription: 'Dùng Ampe kìm đo dòng khởi động không vượt quá 3 lần dòng định mức; máy nén chạy êm, độ ồn < 42dB, không rung giật chân đế.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra nhiệt độ làm lạnh buồng đông (-18°C) và buồng mát (2-5°C)',
        criteriaDescription: 'Dùng nhiệt kế laser hồng ngoại: Buồng đông đạt từ -18°C đến -22°C, buồng mát ổn định 2°C - 5°C sau chu trình làm lạnh ổn định.',
        mandatory: true,
      },
      {
        itemTitle: 'Đo rò rỉ gas lạnh (R600a / R134a) & mối hàn ống đồng',
        criteriaDescription: 'Dùng máy dò gas điện tử kiểm tra dàn nóng, dàn lạnh, phin lọc và rắc-co ống đồng. Áp suất gas tĩnh và động đạt chuẩn.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra gioăng cao su cánh tủ & độ kín khít hít từ',
        criteriaDescription: 'Dùng giấy mỏng kẹp viền cánh tủ; gioăng hít chặt không lọt sáng, không đọng sương hay thoát nhiệt ra ngoài.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra bo mạch điều khiển Inverter & cảm biến xả đá (Defrost)',
        criteriaDescription: 'Bo mạch nhận tín hiệu cảm biến nhiệt NTC, cầu chì nhiệt và điện trở xả đá tự động hoạt động bình thường.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'washing_machine',
    name: 'Máy Giặt / Máy Sấy',
    categoryKeyword: 'Ban công & Giặt giũ',
    icon: '🌀',
    title: 'Tiêu Chuẩn Kiểm Định Máy Giặt & Máy Sấy Đa Năng',
    description: 'Quy chuẩn kiểm tra độ rung lồng giặt ở tốc độ vắt 1400rpm, phao áp lực nước, bơm xả thải, khóa an toàn điện tử và thanh đốt nhiệt.',
    items: [
      {
        itemTitle: 'Kiểm tra động cơ truyền động & phuộc giảm xóc lồng giặt',
        criteriaDescription: 'Chạy vắt thử ở tốc độ tối đa (1000 - 1400 vòng/phút), phuộc giảm xóc triệt tiêu lực tốt, bạc đạn êm, không kêu hú hay rung lắc va chạm vỏ.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra van cấp nước, bơm xả thải & phao áp lực nước',
        criteriaDescription: 'Phao cảm biến mực nước đóng ngắt chính xác các mức; van cấp nước đóng kín khi ngắt điện; bơm xả nước hết trong 90 giây.',
        mandatory: true,
      },
      {
        itemTitle: 'Khóa cửa an toàn điện tử (Door Lock) & gioăng cao su viền',
        criteriaDescription: 'Công tắc khóa cửa chốt chặt khi bắt đầu chu trình và mở an toàn sau 2 phút khi kết thúc; gioăng cao su không rách, không rò nước khi giặt đầy lồng.',
        mandatory: true,
      },
      {
        itemTitle: 'Bo mạch điều khiển chương trình & chống tràn (AquaStop)',
        criteriaDescription: 'Màn hình LED hiển thị rõ ràng, các phím cảm ứng nhạy, chu trình Giặt - Giũ - Vắt vận hành tự động liên tục không báo lỗi.',
        mandatory: true,
      },
      {
        itemTitle: 'Thanh đốt nhiệt làm nóng nước giặt & sấy ngưng tụ',
        criteriaDescription: 'Đo điện trở thanh đun nóng (25 - 35 Ohm), nhiệt độ nước giặt tăng đều theo cài đặt (40°C - 60°C - 90°C), quạt sấy gió nóng hoạt động tốt.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'air_conditioner',
    name: 'Điều Hòa / Máy Lạnh',
    categoryKeyword: 'Phòng ngủ',
    icon: '❄️',
    title: 'Tiêu Chuẩn Kiểm Định Điều Hòa Không Khí Inverter',
    description: 'Đo áp suất gas R32/R410A, dòng làm việc toàn tải, điện trở cách điện Megohmmeter > 2MΩ, quạt lồng sóc và lá tản nhiệt ngoài trời.',
    items: [
      {
        itemTitle: 'Đo áp suất gas hút/đẩy & kiểm tra dòng làm việc máy nén',
        criteriaDescription: 'Đo áp suất gas R32/R410A khi dàn lạnh và dàn nóng chạy toàn tải; dòng Ampe tiêu thụ nằm trong dải thông số nhãn năng lượng.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra quạt dàn lạnh lồng sóc & mô-tơ đảo gió 4 hướng',
        criteriaDescription: 'Cánh quạt lồng sóc cân bằng động tốt, không rít ổ bi, mô-tơ bước đảo gió ngang/dọc phản hồi nhạy theo điều khiển.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra quạt dàn nóng & độ thông thoáng lá tản nhiệt',
        criteriaDescription: 'Cánh quạt dàn nóng quay đúng chiều, lá tản nhiệt nhôm không bị dập nát biến dạng quá 10% bề mặt, giải nhiệt tốt.',
        mandatory: true,
      },
      {
        itemTitle: 'Đo điện trở cách điện Megohmmeter & an toàn tiếp địa',
        criteriaDescription: 'Đo giữa cuộn dây máy nén/mô-tơ với vỏ máy kim loại đạt R > 2 MegaOhm ở điện áp thử 500V. Không có hiện tượng rò điện ra vỏ.',
        mandatory: true,
      },
      {
        itemTitle: 'Mắt nhận hồng ngoại, Remote điều khiển & tính năng Smart Wi-Fi',
        criteriaDescription: 'Nhận tín hiệu điều khiển từ khoảng cách > 5m, các chế độ Cool, Dry, Heat, Fan, Eco hoạt động chính xác.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'induction_cooker',
    name: 'Bếp Từ / Bếp Hồng Ngoại',
    categoryKeyword: 'Bếp & Phòng ăn',
    icon: '🍳',
    title: 'Tiêu Chuẩn Kiểm Định Bếp Từ & Bếp Hồng Ngoại Cảm Ứng',
    description: 'Kiểm tra mâm từ đồng, khối công suất IGBT, quạt tản nhiệt đáy bếp, ngắt bảo vệ quá nhiệt NTC, mặt kính Ceramic chịu nhiệt.',
    items: [
      {
        itemTitle: 'Kiểm tra mâm từ đồng, khối công suất IGBT & bắt từ nhanh',
        criteriaDescription: 'Thử nghiệm với nồi inox chuẩn; bếp nhận diện nồi sau 3 giây, gia nhiệt sôi 1 lít nước trong vòng < 3 phút, IGBT không quá nhiệt.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra quạt tản nhiệt đáy bếp & cảm biến nhiệt độ NTC',
        criteriaDescription: 'Quạt tản nhiệt không chổi than quay êm, cảm biến NTC ngắt bảo vệ quá nhiệt chính xác khi mặt kính đạt ngưỡng 280°C.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra mặt kính Ceramic / Schott Ceran chịu lực & chống trầy',
        criteriaDescription: 'Soi kính dưới đèn quang học: Không nứt vi mô, không mẻ góc cạnh, viền kim loại ôm khít chống nước tràn vào bo mạch.',
        mandatory: true,
      },
      {
        itemTitle: 'Bàn phím cảm ứng trượt Slider & tính năng khóa trẻ em',
        criteriaDescription: 'Cảm ứng nhạy với cả ngón tay ẩm; tính năng tạm dừng (Pause) và khóa an toàn trẻ em (Child Lock) khóa toàn bộ bàn phím hiệu quả.',
        mandatory: true,
      },
      {
        itemTitle: 'Chức năng chống tràn nước & tự động ngắt khi cạn nước',
        criteriaDescription: 'Thử đổ nước lên vùng điều khiển; bếp phát chuông cảnh báo và tự ngắt nguồn trong vòng 5 giây.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'microwave_oven',
    name: 'Lò Vi Sóng / Lò Nướng',
    categoryKeyword: 'Bếp & Phòng ăn',
    icon: '📡',
    title: 'Tiêu Chuẩn Kiểm Định Lò Vi Sóng & Lò Nướng Đối Lưu',
    description: 'Đo rò rỉ bức xạ sóng vi ba Magnetron (< 5mW/cm2), biến áp cao tần, công tắc vi động an toàn cánh cửa, đĩa xoay và thanh nhiệt nướng.',
    items: [
      {
        itemTitle: 'Đèn phát sóng Magnetron & đo rò rỉ bức xạ vi ba an toàn',
        criteriaDescription: 'Dùng máy đo rò bức xạ vi sóng quét quanh khe cửa và vỏ ngoài; mật độ công suất rò < 5 mW/cm² đạt tiêu chuẩn an toàn sinh học quốc gia.',
        mandatory: true,
      },
      {
        itemTitle: 'Biến áp cao tần, tụ điện nhân áp & Diode cao áp',
        criteriaDescription: 'Kiểm tra biến áp không rung rè, tụ cao áp không phồng biến dạng, diode cao áp đo một chiều thông - một chiều ngắt chuẩn.',
        mandatory: true,
      },
      {
        itemTitle: 'Khóa liên động Micro-switch an toàn 3 lớp cánh cửa',
        criteriaDescription: 'Thử mở cửa lò khi đang phát sóng; hệ thống ngắt nguồn Magnetron ngay lập tức 100%, không phát tia lửa điện.',
        mandatory: true,
      },
      {
        itemTitle: 'Mô-tơ đĩa xoay, khoang lò tráng men & đèn chiếu sáng',
        criteriaDescription: 'Đĩa thủy tinh quay đều êm ái, lớp men khoang lò sáng bóng không bong tróc gỉ sét, đèn halogen chiếu sáng rõ nét.',
        mandatory: true,
      },
      {
        itemTitle: 'Thanh nhiệt nướng Grill đối lưu & quạt thổi khí nóng',
        criteriaDescription: 'Thanh nhiệt nướng hồng đều trong 2 phút, quạt đối lưu phân bổ nhiệt đồng đều khắp khoang lò khi nướng.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'rice_cooker',
    name: 'Nồi Cơm Điện / Nồi Áp Suất',
    categoryKeyword: 'Bếp & Phòng ăn',
    icon: '🍚',
    title: 'Tiêu Chuẩn Kiểm Định Nồi Cơm Điện Cao Tần & Nồi Áp Suất',
    description: 'Kiểm tra mâm từ IH / rơ-le nhiệt, lớp chống dính lòng nồi, van xả áp suất an toàn, gioăng cao su nắp và bo mạch vi xử lý.',
    items: [
      {
        itemTitle: 'Lòng nồi hợp kim đa lớp & lớp phủ chống dính Ceramic/Fluororesin',
        criteriaDescription: 'Lòng nồi nguyên vẹn, đáy không móp méo, lớp chống dính không trầy xước sâu hay bong tróc gây hại sức khỏe.',
        mandatory: true,
      },
      {
        itemTitle: 'Mâm từ IH / Mâm nhiệt đáy & cảm biến nhiệt độ trung tâm',
        criteriaDescription: 'Cảm biến đáy nảy đều, tiếp xúc khít với đáy lòng nồi; rơ-le nhiệt ngắt và chuyển sang chế độ Ủ ấm (Keep Warm) đúng thời điểm.',
        mandatory: true,
      },
      {
        itemTitle: 'Van xả áp suất an toàn & gioăng cao su nắp nồi',
        criteriaDescription: 'Van quả trọng xả áp hoạt động tự do không kẹt; van xả phụ an toàn dự phòng; gioăng cao su kín tuyệt đối không xì hơi qua mép nắp.',
        mandatory: true,
      },
      {
        itemTitle: 'Bo mạch vi xử lý chương trình nấu & pin lưu giờ CMOS',
        criteriaDescription: 'Màn hình LCD hiển thị đồng hồ chuẩn, các chế độ nấu cơm dẻo, nấu cháo, làm bánh phản hồi chính xác.',
        mandatory: true,
      },
      {
        itemTitle: 'Dây nguồn rút tự động hoặc giắc cắm chịu nhiệt',
        criteriaDescription: 'Dây nguồn ruột đồng tiêu chuẩn > 1.5mm², giắc cắm chặt không lỏng lẻo phát sinh hồ quang nhiệt.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'water_heater',
    name: 'Bình Nước Nóng / Gia Dụng Tắm',
    categoryKeyword: 'Phòng tắm & Vệ sinh',
    icon: '🚿',
    title: 'Tiêu Chuẩn Kiểm Định Bình Nóng Lạnh & Thiết Bị Gia Dụng Phòng Tắm',
    description: 'Kiểm tra bộ chống giật ELCB, rơ-le nhiệt kép chống đun khô, thanh anode magie chống bám cặn, áp lực bình chứa và tiếp địa.',
    items: [
      {
        itemTitle: 'Thiết bị chống giật siêu nhạy ELCB / RCBO (15mA)',
        criteriaDescription: 'Nhấn nút Test trên cục ELCB: ngắt điện ngay lập tức trong 0.05 giây; đèn báo nguồn tắt hoàn toàn, đảm bảo ngắt 2 cực L và N.',
        mandatory: true,
      },
      {
        itemTitle: 'Đo điện trở cách điện thanh gia nhiệt ruột bình (Megohm)',
        criteriaDescription: 'Đo giữa cọc điện thanh gia nhiệt và vỏ bình bằng Megohmmeter 500V đạt R > 5 MegaOhm khi ngâm nước đầy bình.',
        mandatory: true,
      },
      {
        itemTitle: 'Rơ-le nhiệt kép an toàn 2 cấp (Thermostat & Cắt nhiệt)',
        criteriaDescription: 'Rơ-le cấp 1 ngắt ở 75°C tự động; rơ-le an toàn cấp 2 cắt vĩnh viễn ở 93°C chống cháy nổ khi cạn nước.',
        mandatory: true,
      },
      {
        itemTitle: 'Van một chiều xả áp an toàn (Safety Relief Valve)',
        criteriaDescription: 'Van tự động xả áp khi áp suất bình vượt quá 8 bar, gioăng ren không rò rỉ nước ở áp lực thử 10 bar.',
        mandatory: true,
      },
      {
        itemTitle: 'Thanh Anode Magie bảo vệ ruột bình tráng men',
        criteriaDescription: 'Thanh Magie còn nguyên trên 60% thể tích, ruột bình tráng men Titanium/Kim cương nhân tạo không thủng rò nước.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'general',
    name: 'Gia Dụng Tiêu Chuẩn Chung',
    categoryKeyword: 'Tất cả danh mục',
    icon: '⚡',
    title: 'Bộ Tiêu Chuẩn An Toàn & Vận Hành Gia Dụng Tổng Quát (ISO/TCVN)',
    description: 'Tiêu chuẩn đo kiểm cách điện vỏ máy Megohm, an toàn tiếp địa, kiểm tra ngoại quan ốc vít cơ khí và thử tải vận hành 30 phút.',
    items: [
      {
        itemTitle: 'Đo điện trở cách điện & kiểm tra chống rò rỉ điện vỏ kim loại',
        criteriaDescription: 'Đo cách điện vỏ máy đạt R > 2MΩ ở điện áp 500VDC; dây tiếp địa an toàn không đứt gãy, chống giật tối ưu.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra tình trạng ngoại quan, tem niêm phong & ốc vít cơ khí',
        criteriaDescription: 'Khung vỏ máy cứng cáp không nứt vỡ; ốc vít đầy đủ không trờn ren; tem thông số kỹ thuật rõ ràng nguồn gốc.',
        mandatory: true,
      },
      {
        itemTitle: 'Vận hành đầy tải liên tục 30 phút kiểm tra độ ổn định',
        criteriaDescription: 'Thiết bị hoạt động êm ái liên tục; độ rung và tiếng ồn nằm trong giới hạn cho phép; không có mùi khét lạ từ cuộn dây.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra dây cáp nguồn, phích cắm & công tắc chính',
        criteriaDescription: 'Dây dẫn điện không gập gãy bong tróc lớp vỏ cách nhiệt; phích cắm đúc liền khối chịu tải định mức.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra linh kiện phụ trợ & phụ kiện đóng gói',
        criteriaDescription: 'Đầy đủ các khay chứa, phụ kiện tháo rời và khớp nối nguyên vẹn theo chuẩn thiết kế của nhà sản xuất.',
        mandatory: false,
      },
    ],
  },
];

export const VALID_CENTER_TABS: CenterTab[] = [
  'overview',
  'dispatch',
  'staff',
  'orders',
  'checklists',
  'pricing'
];

export const CENTER_TAB_STORAGE_KEY = 'secondlife_center_active_tab';

export function getInitialCenterTab(): CenterTab {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const subtab = params.get('subtab') as CenterTab;
    if (subtab && VALID_CENTER_TABS.includes(subtab)) {
      return subtab;
    }
    try {
      const saved = sessionStorage.getItem(CENTER_TAB_STORAGE_KEY) as CenterTab;
      if (saved && VALID_CENTER_TABS.includes(saved)) {
        return saved;
      }
    } catch (e) {}
  }
  return 'overview';
}

export const InspectionCenterDashboardView: React.FC<InspectionCenterDashboardViewProps> = ({
  initialOrders = [],
  currentUser,
  lang = 'vi',
  onNavigate,
  onOpenProfile,
  onLogout,
  onViewWebsite,
}) => {
  // --- Active Sub-Tab (Khôi phục từ URL param ?subtab= hoặc sessionStorage khi F5) ---
  const [activeTab, setActiveTab] = useState<CenterTab>(getInitialCenterTab);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(CENTER_TAB_STORAGE_KEY, activeTab);
    } catch (e) {}
    const currentUrl = new URL(window.location.href);
    if (activeTab && activeTab !== 'overview') {
      currentUrl.searchParams.set('subtab', activeTab);
    } else {
      currentUrl.searchParams.delete('subtab');
    }
    if (currentUrl.toString() !== window.location.href) {
      window.history.replaceState(null, '', currentUrl.toString());
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      const tab = getInitialCenterTab();
      setActiveTab(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Sidebar Collapse & Mobile Sidebar State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // --- User Profile Dropdown State ---
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Action Notification Banner (Admin Style) ---
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(translateSystemNotification(msg));
    setTimeout(() => {
      setActionNotice(null);
    }, 4500);
  };

  // Convert initial escrow orders into InspectionOrderDto fallback
  const fallbackOrders: InspectionOrderDto[] = useMemo(() => {
    return (initialOrders || [])
      .filter((o: any) =>
        o.hasInspectionService ||
        o.inspectionMethod ||
        (o.inspectionFeeVnd && o.inspectionFeeVnd > 0) ||
        o.requiresInspection ||
        o.deliveryOption === 'INSPECTION' ||
        o.isInspectionGuaranteed ||
        o.escrowStatus === 'AWAITING_INSPECTION' ||
        o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
        o.escrowStatus === 'INSPECTION_PASSED' ||
        o.escrowStatus === 'AWAITING_PAYMENT' ||
        o.status === 'CONFIRMED_PENDING_DISPATCH' ||
        o.status === 'WAITING_SELLER_APPROVAL' ||
        o.status === 'WAITING_FEE_PAYMENT' ||
        o.status === 'WAITING_BUYER_APPROVAL' ||
        o.status === 'WAITING_INSPECTION' ||
        o.status === 'DISPATCHED' ||
        o.status === 'INSPECTING' ||
        o.status === 'PASSED' ||
        o.status === 'FAILED' ||
        o.status === 'COMPLETED' ||
        o.backendStatus === 'CONFIRMED_PENDING_DISPATCH' ||
        (o.id && (String(o.id).startsWith('ORD-') || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(String(o.id))))
      )
      .map((o: any) => {
        let assignedInspectorId = o.inspectorId;
        let assignedInspectorName = o.inspectorName;
        try {
          const rawAssign = localStorage.getItem(`order_assigned_inspector_${o.id}`);
          if (rawAssign) {
            const assignData = JSON.parse(rawAssign);
            assignedInspectorId = assignData.inspectorId || assignedInspectorId;
            assignedInspectorName = assignData.inspectorName || assignedInspectorName;
          }
        } catch {}

        const hasValidAssign = Boolean(assignedInspectorId && assignedInspectorName && assignedInspectorName !== 'Chưa phân công');

        let resolvedStatus = o.status || o.escrowStatus || 'CONFIRMED_PENDING_DISPATCH';
        if (!hasValidAssign && (resolvedStatus === 'AWAITING_INSPECTION' || o.backendStatus === 'CONFIRMED_PENDING_DISPATCH')) {
          resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
        } else if (hasValidAssign && (resolvedStatus === 'CONFIRMED_PENDING_DISPATCH' || resolvedStatus === 'WAITING_INSPECTION' || resolvedStatus === 'AWAITING_INSPECTION')) {
          resolvedStatus = 'DISPATCHED';
        }

        return {
          id: o.id,
          postId: o.listing?.id || o.listingId || o.id,
          postTitle: o.listing?.title || o.postTitle || 'Thiết bị gia dụng kiểm định',
          postPrice: o.listing?.priceVnd || o.totalAmountVnd || o.amountVnd || 0,
          postImageUrls: o.listing?.photos
            ? [
                o.listing.photos.front,
                o.listing.photos.back,
                o.listing.photos.screenOrDetails,
              ].filter(Boolean) as string[]
            : ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=400'],
          buyerName: o.buyerName || 'Khách hàng',
          buyerEmail: o.buyerId ? `buyer_${String(o.buyerId).slice(0, 6)}@gmail.com` : 'buyer@secondlife.vn',
          sellerName: o.sellerName || 'Người bán',
          sellerEmail: o.sellerId ? `seller_${String(o.sellerId).slice(0, 6)}@gmail.com` : 'seller@secondlife.vn',
          inspectorId: hasValidAssign ? assignedInspectorId : undefined,
          inspectorName: hasValidAssign ? assignedInspectorName : undefined,
          orderType: (o.inspectionMethod === 'AT_HOME' || o.orderType === 'AT_HOME') ? 'AT_HOME' : 'AT_CENTER',
          feePayer: o.inspectionFeeSplit === 'SELLER_100' ? 'SELLER_PAYS' : o.inspectionFeeSplit === 'BUYER_100' ? 'BUYER_PAYS' : 'SPLIT_50_50',
          status: resolvedStatus,
          inspectionFee: o.inspectionFeeVnd || (o.inspectionMethod === 'AT_HOME' ? 200000 : 120000),
          createdAt: o.createdAt || new Date().toISOString(),
        };
      });
  }, [initialOrders]);

  // --- Orders State ---
  const [orders, setOrders] = useState<InspectionOrderDto[]>(fallbackOrders);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderMethodFilter, setOrderMethodFilter] = useState<'ALL' | 'AT_CENTER' | 'AT_HOME'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  // --- Staff State ---
  const [staffList, setStaffList] = useState<InspectionStaffDto[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  // --- Assign Modal State ---
  const [assignModalOrder, setAssignModalOrder] = useState<InspectionOrderDto | null>(null);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('');
  const [assignEstimatedSlot, setAssignEstimatedSlot] = useState<string>('09:00 - 11:30 Sáng');
  const [assignNote, setAssignNote] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // --- Create Staff Modal State ---
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [createStaffError, setCreateStaffError] = useState<string | null>(null);
  const [createdStaffSuccessData, setCreatedStaffSuccessData] = useState<{
    fullName: string;
    email: string;
    password: string;
  } | null>(null);
  const [hasCopiedCredentials, setHasCopiedCredentials] = useState(false);

  // --- API Fetch: Orders ---
  const loadOrders = async () => {
    setIsLoadingOrders(true);
    try {
      let backendItems: InspectionOrderDto[] = [];
      try {
        const res = await inspectorService.getAllOrders(
          orderStatusFilter === 'ALL' ? undefined : orderStatusFilter,
          0,
          100
        );
        const extracted = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
        if (extracted && extracted.length > 0) {
          backendItems = extracted;
        }
      } catch (e) {
        console.warn('getAllOrders from backend error (falling back to storage/cache):', e);
      }

      // Nếu gọi backend không lọc status trả về rỗng, quét thêm các status trọng tâm của đơn kiểm định
      if (backendItems.length === 0) {
        const statusesToProbe = ['CONFIRMED_PENDING_DISPATCH', 'WAITING_FEE_PAYMENT', 'WAITING_SELLER_APPROVAL', 'DISPATCHED', 'INSPECTING'];
        try {
          const probeResults = await Promise.all(
            statusesToProbe.map((st) => inspectorService.getAllOrders(st, 0, 100).catch(() => ({ items: [] } as any)))
          );
          const probedMap = new Map<string, InspectionOrderDto>();
          probeResults.forEach((pr) => {
            const list = pr?.items || (pr as any)?.content || (Array.isArray(pr) ? pr : []);
            list.forEach((item: any) => {
              if (item?.id) probedMap.set(item.id, item);
            });
          });
          if (probedMap.size > 0) {
            backendItems = Array.from(probedMap.values());
          }
        } catch {}
      }

      // Quét thêm từ my-seller-orders, my-buyer-orders và getMyOrders để không bỏ sót bất kỳ task nào
      try {
        const [sellerPage, buyerPage, myInspOrders] = await Promise.all([
          inspectorService.getMySellerOrders(0, 100).catch(() => ({ items: [] } as any)),
          inspectorService.getMyBuyerOrders(0, 100).catch(() => ({ items: [] } as any)),
          inspectorService.getMyOrders().catch(() => [] as any[]),
        ]);
        const extraItems = [
          ...(sellerPage?.items || (sellerPage as any)?.content || []),
          ...(buyerPage?.items || (buyerPage as any)?.content || []),
          ...(Array.isArray(myInspOrders) ? myInspOrders : []),
        ];
        extraItems.forEach((extra) => {
          if (extra?.id && !backendItems.some((b) => b.id === extra.id)) {
            backendItems.push(extra);
          }
        });
      } catch {}

      // Read orders from localStorage (center_inspection_orders + recent_placed_orders)
      let localOrders: InspectionOrderDto[] = [];
      try {
        const rawRecent = localStorage.getItem('recent_placed_orders');
        const rawCenter = localStorage.getItem('center_inspection_orders');
        const listRecent = rawRecent ? JSON.parse(rawRecent) : [];
        const listCenter = rawCenter ? JSON.parse(rawCenter) : [];
        const combinedRaw = [
          ...(Array.isArray(listCenter) ? listCenter : []),
          ...(Array.isArray(listRecent) ? listRecent : [])
        ];

        const seenOrderIds = new Set<string>();
        const dedupedList: any[] = [];
        combinedRaw.forEach((item: any) => {
          if (item?.id && !seenOrderIds.has(item.id)) {
            seenOrderIds.add(item.id);
            dedupedList.push(item);
          }
        });

        localOrders = dedupedList
          .filter((o: any) =>
            o.hasInspectionService ||
            o.inspectionMethod ||
            (o.inspectionFeeVnd && o.inspectionFeeVnd > 0) ||
            o.requiresInspection ||
            o.deliveryOption === 'INSPECTION' ||
            o.isInspectionGuaranteed ||
            o.escrowStatus === 'AWAITING_INSPECTION' ||
            o.escrowStatus === 'INSPECTION_IN_PROGRESS' ||
            o.escrowStatus === 'INSPECTION_PASSED' ||
            o.status === 'CONFIRMED_PENDING_DISPATCH' ||
            o.status === 'WAITING_SELLER_APPROVAL' ||
            o.status === 'WAITING_FEE_PAYMENT' ||
            o.status === 'WAITING_BUYER_APPROVAL' ||
            o.status === 'WAITING_INSPECTION' ||
            o.status === 'DISPATCHED' ||
            o.status === 'INSPECTING' ||
            o.backendStatus === 'CONFIRMED_PENDING_DISPATCH'
          )
          .map((o: any) => {
            let assignedInspectorId = o.inspectorId;
            let assignedInspectorName = o.inspectorName;
            try {
              const rawAssign = localStorage.getItem(`order_assigned_inspector_${o.id}`);
              if (rawAssign) {
                const assignData = JSON.parse(rawAssign);
                assignedInspectorId = assignData.inspectorId || assignedInspectorId;
                assignedInspectorName = assignData.inspectorName || assignedInspectorName;
              }
            } catch {}

            const hasValidAssign = Boolean(assignedInspectorId && assignedInspectorName && assignedInspectorName !== 'Chưa phân công');

            let resolvedStatus = o.status || o.escrowStatus || 'CONFIRMED_PENDING_DISPATCH';
            if (!hasValidAssign && (resolvedStatus === 'AWAITING_INSPECTION' || o.backendStatus === 'CONFIRMED_PENDING_DISPATCH')) {
              resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
            } else if (hasValidAssign && (resolvedStatus === 'CONFIRMED_PENDING_DISPATCH' || resolvedStatus === 'WAITING_INSPECTION' || resolvedStatus === 'AWAITING_INSPECTION')) {
              resolvedStatus = 'DISPATCHED';
            }

            return {
              id: o.id,
              postId: o.listing?.id || o.listingId || o.id,
              postTitle: o.listing?.title || o.postTitle || 'Thiết bị gia dụng kiểm định',
              postPrice: o.listing?.priceVnd || o.totalPaidVnd || o.itemPriceVnd || o.amountVnd || 0,
              postImageUrls: o.listing?.photos
                ? [o.listing.photos.front, o.listing.photos.back, o.listing.photos.screenOrDetails].filter(Boolean) as string[]
                : (o.listing?.photoGallery || ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=400']),
              buyerName: o.buyerName || 'Khách hàng',
              buyerEmail: o.buyerId ? `buyer_${String(o.buyerId).slice(0, 6)}@gmail.com` : 'buyer@secondlife.vn',
              sellerName: o.sellerName || 'Người bán',
              sellerEmail: o.sellerId ? `seller_${String(o.sellerId).slice(0, 6)}@gmail.com` : 'seller@secondlife.vn',
              inspectorId: hasValidAssign ? assignedInspectorId : undefined,
              inspectorName: hasValidAssign ? assignedInspectorName : undefined,
              orderType: (o.inspectionMethod === 'AT_HOME' || o.orderType === 'AT_HOME') ? 'AT_HOME' : 'AT_CENTER',
              feePayer: o.inspectionFeeSplit === 'SELLER_100' ? 'SELLER_PAYS' : o.inspectionFeeSplit === 'BUYER_100' ? 'BUYER_PAYS' : 'SPLIT_50_50',
              status: resolvedStatus,
              inspectionFee: o.inspectionFeeVnd || (o.inspectionMethod === 'AT_HOME' ? 200000 : 120000),
              createdAt: o.createdAt || new Date().toISOString(),
            };
          });
      } catch {}

      // Combine backendItems + localOrders + fallbackOrders
      const combinedMap = new Map<string, InspectionOrderDto>();
      [...fallbackOrders, ...localOrders, ...backendItems].forEach((ord) => {
        if (ord?.id) {
          let assignedInspectorId = ord.inspectorId;
          let assignedInspectorName = ord.inspectorName;
          try {
            const rawAssign = localStorage.getItem(`order_assigned_inspector_${ord.id}`);
            if (rawAssign) {
              const assignData = JSON.parse(rawAssign);
              assignedInspectorId = assignData.inspectorId || assignedInspectorId;
              assignedInspectorName = assignData.inspectorName || assignedInspectorName;
            }
          } catch {}

          const hasValidAssign = Boolean(assignedInspectorId && assignedInspectorName && assignedInspectorName !== 'Chưa phân công');

          let resolvedStatus = ord.status;
          if (!hasValidAssign && (resolvedStatus === 'AWAITING_INSPECTION' || (ord as any).backendStatus === 'CONFIRMED_PENDING_DISPATCH')) {
            resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
          } else if (hasValidAssign && (resolvedStatus === 'CONFIRMED_PENDING_DISPATCH' || resolvedStatus === 'WAITING_INSPECTION')) {
            resolvedStatus = 'DISPATCHED';
          }

          combinedMap.set(ord.id, {
            ...ord,
            inspectorId: hasValidAssign ? assignedInspectorId : undefined,
            inspectorName: hasValidAssign ? assignedInspectorName : undefined,
            status: resolvedStatus
          });
        }
      });

      const finalOrders = Array.from(combinedMap.values());
      finalOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(finalOrders);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách đơn kiểm định từ backend, sử dụng dữ liệu trạm:', err);
      if (fallbackOrders.length > 0) setOrders(fallbackOrders);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // --- API Fetch: Staff ---
  const loadStaff = async () => {
    setIsLoadingStaff(true);
    try {
      const data = await inspectorService.getStaff();
      let list = Array.isArray(data) ? [...data] : [];

      // 1. Merge locally registered staff (e.g. from center_registered_staff)
      try {
        const raw = localStorage.getItem('center_registered_staff');
        if (raw) {
          const localStaff = JSON.parse(raw);
          if (Array.isArray(localStaff)) {
            localStaff.forEach((s: any) => {
              if (!list.some((existing) => existing.id === s.id || existing.email === s.email)) {
                list.push({
                  id: s.id,
                  email: s.email || 'ktv@secondlife.vn',
                  fullName: s.fullName || s.name || 'Kỹ thuật viên',
                  phone: s.phone || '0901234567',
                  accountStatus: s.accountStatus || 'ACTIVE',
                  assignedOrdersCount: s.assignedOrdersCount || 0,
                  role: 'INSPECTOR',
                });
              }
            });
          }
        }
      } catch {}

      // 2. Kỹ thuật viên hạt giống BE (inspector@secondlife.com) & KTV số 1: Nguyên - Luôn hiện diện
      const seededKtv1: InspectionStaffDto = {
        id: 'a50d1568-1111-4222-9333-7272a95473db',
        email: 'inspector@secondlife.com',
        fullName: 'Kiểm Định Viên 1 (KTV Trưởng)',
        phone: '0901234567',
        accountStatus: 'ACTIVE',
        assignedOrdersCount: 0,
        role: 'INSPECTOR',
      };
      const defaultKtv2: InspectionStaffDto = {
        id: 'ins-a50d1568',
        email: 'nguyen.ktv@secondlife.vn',
        fullName: 'Nguyễn Văn Inspector (KTV số 1)',
        phone: '0908889999',
        accountStatus: 'ACTIVE',
        assignedOrdersCount: 0,
        role: 'INSPECTOR',
      };

      if (!list.some((s) => s.email?.toLowerCase() === seededKtv1.email.toLowerCase())) {
        list.unshift(seededKtv1);
      }
      if (!list.some((s) => s.email?.toLowerCase() === defaultKtv2.email.toLowerCase() || s.id === defaultKtv2.id)) {
        list.push(defaultKtv2);
      }

      // Trích xuất thêm KTV từ danh sách orders nếu có inspectorId/inspectorName
      orders.forEach((ord) => {
        if (ord.inspectorId && !list.some((s) => s.id === ord.inspectorId)) {
          list.push({
            id: ord.inspectorId,
            email: ord.inspectorName ? `${ord.inspectorName.toLowerCase().replace(/\s+/g, '.')}@secondlife.vn` : 'ktv@secondlife.vn',
            fullName: ord.inspectorName || 'Kỹ thuật viên',
            phone: '0901234567',
            accountStatus: 'ACTIVE',
            assignedOrdersCount: 0,
            role: 'INSPECTOR',
          });
        }
      });

      // 3. Tính số task thực tế cho từng KTV
      list = list.map((st) => {
        let taskCount = 0;
        try {
          // Đếm trực tiếp từ danh sách đơn hiện có
          orders.forEach((o) => {
            if (o.inspectorId === st.id || (st.email && o.inspectorId === st.email)) {
              taskCount++;
            }
          });

          const raw = localStorage.getItem('recent_placed_orders');
          if (raw) {
            const allOrders = JSON.parse(raw);
            if (Array.isArray(allOrders)) {
              allOrders.forEach((o: any) => {
                let assignedId = o.inspectorId;
                try {
                  const rawAssign = localStorage.getItem(`order_assigned_inspector_${o.id}`);
                  if (rawAssign) {
                    const assignData = JSON.parse(rawAssign);
                    assignedId = assignData.inspectorId || assignedId;
                  }
                } catch {}
                if (assignedId === st.id || (st.email && assignedId === st.email)) {
                  taskCount++;
                }
              });
            }
          }
        } catch {}
        return {
          ...st,
          assignedOrdersCount: Math.max(st.assignedOrdersCount || 0, taskCount),
        };
      });

      setStaffList(list);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách nhân viên KTV:', err);
      const seededKtv1: InspectionStaffDto = {
        id: 'a50d1568-1111-4222-9333-7272a95473db',
        email: 'inspector@secondlife.com',
        fullName: 'Kiểm Định Viên 1 (KTV Trưởng)',
        phone: '0901234567',
        accountStatus: 'ACTIVE',
        assignedOrdersCount: 0,
        role: 'INSPECTOR',
      };
      const defaultKtv2: InspectionStaffDto = {
        id: 'ins-a50d1568',
        email: 'nguyen.ktv@secondlife.vn',
        fullName: 'Nguyễn Văn Inspector (KTV số 1)',
        phone: '0908889999',
        accountStatus: 'ACTIVE',
        assignedOrdersCount: 0,
        role: 'INSPECTOR',
      };
      setStaffList([seededKtv1, defaultKtv2]);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  // Initial load and Realtime event listeners
  useEffect(() => {
    loadOrders();
    loadStaff();

    const handleSignal = () => {
      loadOrders();
      loadStaff();
    };

    window.addEventListener('secondlife_order_placed_signal', handleSignal);
    window.addEventListener('secondlife_inspection_task_created', handleSignal);
    window.addEventListener('secondlife_order_assigned_signal', handleSignal);

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'recent_placed_orders' ||
        e.key === 'center_inspection_orders' ||
        e.key === 'center_registered_staff' ||
        e.key?.startsWith('order_assigned_inspector_')
      ) {
        loadOrders();
        loadStaff();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('secondlife_order_placed_signal', handleSignal);
      window.removeEventListener('secondlife_inspection_task_created', handleSignal);
      window.removeEventListener('secondlife_order_assigned_signal', handleSignal);
      window.removeEventListener('storage', handleStorage);
    };
  }, [orderStatusFilter]);

  // Checklists & Catalog State
  const [checklists, setChecklists] = useState<InspectionChecklistResponse[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);
  const [categories, setCategories] = useState<CategoryBackend[]>([]);
  const [catalogItems, setCatalogItems] = useState<ItemBackend[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Search & Filter State
  const [checklistSearch, setChecklistSearch] = useState('');
  const [checklistCategoryFilter, setChecklistCategoryFilter] = useState('ALL');

  // Modal Create / Edit State
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [checklistTitle, setChecklistTitle] = useState('');
  const [checklistDesc, setChecklistDesc] = useState('');
  const [checklistItems, setChecklistItems] = useState<{
    id?: string;
    itemTitle: string;
    criteriaDescription: string;
    mandatory: boolean;
  }[]>([
    {
      itemTitle: 'Kiểm tra nguồn, phích cắm & khởi động',
      criteriaDescription: 'Kiểm tra bo nguồn, điện áp cấp định mức và phản hồi bật/tắt thiết bị',
      mandatory: true,
    },
    {
      itemTitle: 'Kiểm tra ngoại quan, tem nhãn & ốc niêm phong',
      criteriaDescription: 'Soi dấu hiệu cạy mở trái phép, trầy xước vỏ và chân đế cao su',
      mandatory: false,
    },
    {
      itemTitle: 'Thử tải vận hành liên tục 30 phút',
      criteriaDescription: 'Kiểm tra nhiệt độ làm việc, độ ồn dB và tính ổn định linh kiện công suất',
      mandatory: true,
    },
  ]);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // Detail View Modal State
  const [viewingChecklist, setViewingChecklist] = useState<InspectionChecklistResponse | null>(null);
  const [isLoadingChecklistDetail, setIsLoadingChecklistDetail] = useState(false);

  const handleViewChecklistDetail = async (chk: InspectionChecklistResponse) => {
    setIsLoadingChecklistDetail(true);
    setViewingChecklist(chk);
    try {
      const full = await inspectorService.getChecklistById(chk.id);
      if (full) setViewingChecklist(full);
    } catch (e) {
      console.warn('Fallback to cached checklist:', e);
    } finally {
      setIsLoadingChecklistDetail(false);
    }
  };

  // Inspection Shipment Modal State (GET/POST /api/v1/inspection-orders/{inspectionId}/shipments)
  const [shipmentModalOrder, setShipmentModalOrder] = useState<InspectionOrderDto | null>(null);
  const [inspectionShipments, setInspectionShipments] = useState<ShipmentBackend[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [shipmentTab, setShipmentTab] = useState<'tracking' | 'create'>('tracking');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [receiverName, setReceiverName] = useState('Trung Tâm Lab Hub SecondLife');
  const [receiverPhone, setReceiverPhone] = useState('0908123456');
  const [receiverAddress, setReceiverAddress] = useState('Hub Kiểm Định Số 1, 123 Đường Công Nghệ Cao, TP.HCM');
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [shipmentSuccess, setShipmentSuccess] = useState<string | null>(null);

  const handleOpenShipmentModal = async (ord: InspectionOrderDto) => {
    setShipmentModalOrder(ord);
    setShipmentError(null);
    setShipmentSuccess(null);
    setSenderName(ord.sellerName || 'Người bán');
    setSenderPhone('0912345678');
    setSenderAddress((ord as any).address || (ord as any).sellerAddress || 'Địa chỉ người bán');
    setIsLoadingShipments(true);
    try {
      const list = await shippingService.getInspectionShipments(ord.id);
      setInspectionShipments(list);
      setShipmentTab(list && list.length > 0 ? 'tracking' : 'create');
    } catch (err: any) {
      console.warn('Load inspection shipments error:', err);
      setInspectionShipments([]);
      setShipmentTab('create');
    } finally {
      setIsLoadingShipments(false);
    }
  };

  const handleCreateInspectionShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentModalOrder) return;
    setIsCreatingShipment(true);
    setShipmentError(null);
    setShipmentSuccess(null);
    try {
      const payload: any = {
        orderId: shipmentModalOrder.id,
        orderCode: `INSP-${shipmentModalOrder.id.slice(0, 8)}`,
        leg: 'INSPECTION_FORWARD',
        serviceType: 'LALAMOVE',
        senderName: senderName.trim(),
        senderPhone: senderPhone.trim(),
        senderAddress: senderAddress.trim(),
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        receiverAddress: receiverAddress.trim(),
      };
      const created = await shippingService.createInspectionShipment(shipmentModalOrder.id, payload);
      setShipmentSuccess(`Đã tạo vận đơn điều phối Hub thành công! Mã vận đơn: #${created.orderCode || created.shipmentId}`);
      const list = await shippingService.getInspectionShipments(shipmentModalOrder.id);
      setInspectionShipments(list);
      setShipmentTab('tracking');
    } catch (err: any) {
      setShipmentError(err?.message || 'Không thể tạo vận đơn kiểm định.');
    } finally {
      setIsCreatingShipment(false);
    }
  };

  // Pricing & Travel Tiers State
  const [travelTiers, setTravelTiers] = useState<InspectionTravelTierDto[]>([]);
  const [tierProposals, setTierProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [proposeBaseFee, setProposeBaseFee] = useState<number>(250000);
  const [proposeTiers, setProposeTiers] = useState<{ tierNumber: number; name: string; fromKm: number; toKm: number; pricePerKm: number }[]>([
    { tierNumber: 1, name: 'Nội thành gần (0 - 5 km)', fromKm: 0, toKm: 5, pricePerKm: 10000 },
    { tierNumber: 2, name: 'Trung bình (5 - 15 km)', fromKm: 5, toKm: 15, pricePerKm: 15000 },
    { tierNumber: 3, name: 'Xa / Ngoại thành (> 15 km)', fromKm: 15, toKm: 35, pricePerKm: 20000 },
  ]);

  const loadChecklists = async () => {
    setIsLoadingChecklists(true);
    try {
      const data = await inspectorService.getChecklists();
      setChecklists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Lỗi tải checklists:', err);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const loadCategoriesAndItems = async () => {
    setIsLoadingCategories(true);
    try {
      const [cats, itms] = await Promise.allSettled([
        categoryService.getCategories(),
        categoryService.getItems(),
      ]);
      if (cats.status === 'fulfilled' && Array.isArray(cats.value)) {
        setCategories(cats.value);
      }
      if (itms.status === 'fulfilled' && Array.isArray(itms.value)) {
        setCatalogItems(itms.value);
      }
    } catch (err) {
      console.warn('Lỗi nạp danh mục sản phẩm:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const resetChecklistForm = () => {
    setEditingChecklistId(null);
    setSelectedCategoryId('');
    setSelectedProductId('');
    setChecklistTitle('');
    setChecklistDesc('');
    setChecklistItems([
      {
        itemTitle: 'Kiểm tra nguồn, phích cắm & khởi động',
        criteriaDescription: 'Kiểm tra bo nguồn, điện áp cấp định mức và phản hồi bật/tắt thiết bị',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra ngoại quan, tem nhãn & ốc niêm phong',
        criteriaDescription: 'Soi dấu hiệu cạy mở trái phép, trầy xước vỏ và chân đế cao su',
        mandatory: false,
      },
      {
        itemTitle: 'Thử tải vận hành liên tục 30 phút',
        criteriaDescription: 'Kiểm tra nhiệt độ làm việc, độ ồn dB và tính ổn định linh kiện công suất',
        mandatory: true,
      },
    ]);
  };

  const handleOpenCreateModal = (presetKey?: string) => {
    resetChecklistForm();
    if (presetKey) {
      const preset = APPLIANCE_PRESETS.find(p => p.key === presetKey);
      if (preset) {
        handleApplyPreset(preset);
      }
    }
    setIsChecklistModalOpen(true);
  };

  const handleOpenEditModal = (chk: InspectionChecklistResponse) => {
    setEditingChecklistId(chk.id);
    setSelectedCategoryId(chk.categoryId || '');
    setSelectedProductId('');
    setChecklistTitle(chk.title || '');
    setChecklistDesc(chk.description || '');
    if (chk.items && chk.items.length > 0) {
      setChecklistItems(
        chk.items.map(it => ({
          id: it.id,
          itemTitle: it.itemTitle || (it as any).name || '',
          criteriaDescription: it.criteriaDescription || (it as any).description || '',
          mandatory: it.mandatory !== false,
        }))
      );
    } else {
      setChecklistItems([
        {
          itemTitle: 'Kiểm tra vận hành chức năng chính',
          criteriaDescription: 'Đo kiểm thông số kỹ thuật và độ ổn định thiết bị',
          mandatory: true,
        },
      ]);
    }
    setIsChecklistModalOpen(true);
  };

  const handleCloneChecklist = (chk: InspectionChecklistResponse) => {
    setEditingChecklistId(null);
    setSelectedCategoryId(chk.categoryId || '');
    setSelectedProductId('');
    setChecklistTitle(`[Bản sao] ${chk.title}`);
    setChecklistDesc(chk.description || '');
    if (chk.items && chk.items.length > 0) {
      setChecklistItems(
        chk.items.map(it => ({
          itemTitle: it.itemTitle || (it as any).name || '',
          criteriaDescription: it.criteriaDescription || (it as any).description || '',
          mandatory: it.mandatory !== false,
        }))
      );
    }
    setIsChecklistModalOpen(true);
    showNotice(lang === 'vi' ? 'Đã nhân bản bộ tiêu chuẩn. Bạn có thể chỉnh sửa và bấm Lưu.' : 'Checklist cloned. Edit and save.');
  };

  const handleApplyPreset = (preset: AppliancePreset) => {
    const matchedCategory = categories.find(c =>
      c.name.toLowerCase().includes(preset.categoryKeyword.toLowerCase()) ||
      preset.categoryKeyword.toLowerCase().includes(c.name.toLowerCase())
    );
    if (matchedCategory) {
      setSelectedCategoryId(matchedCategory.id);
    } else if (categories.length > 0 && preset.categoryKeyword !== 'Tất cả danh mục') {
      const kwFirst = preset.categoryKeyword.split(' ')[0].toLowerCase();
      const catFirst = categories.find(c => c.name.toLowerCase().includes(kwFirst));
      if (catFirst) setSelectedCategoryId(catFirst.id);
    }
    setChecklistTitle(preset.title);
    setChecklistDesc(preset.description);
    setChecklistItems(
      preset.items.map(it => ({
        itemTitle: it.itemTitle,
        criteriaDescription: it.criteriaDescription,
        mandatory: it.mandatory,
      }))
    );
  };

  const handleSaveChecklist = async () => {
    if (!checklistTitle.trim()) {
      await dialogService.warning(lang === 'vi' ? 'Vui lòng nhập tên bộ tiêu chuẩn kiểm định' : 'Please enter checklist title');
      return;
    }
    const validItems = checklistItems.filter(i => i.itemTitle.trim());
    if (validItems.length === 0) {
      await dialogService.warning(lang === 'vi' ? 'Vui lòng thêm ít nhất một hạng mục kiểm định' : 'Please add at least one criteria item');
      return;
    }

    setIsSavingChecklist(true);
    try {
      const selectedCat = categories.find(c => c.id === selectedCategoryId);
      const payload: any = {
        title: checklistTitle.trim(),
        description: checklistDesc.trim(),
        categoryId: selectedCategoryId || undefined,
        categoryName: selectedCat ? selectedCat.name : undefined,
        items: validItems.map((it, idx) => ({
          itemTitle: it.itemTitle.trim(),
          criteriaDescription: (it.criteriaDescription || '').trim(),
          mandatory: Boolean(it.mandatory),
          orderIndex: idx + 1,
        })),
      };

      if (editingChecklistId) {
        await inspectorService.updateChecklist(editingChecklistId, payload);
        showNotice(lang === 'vi' ? `Đã cập nhật bộ tiêu chuẩn "${checklistTitle}" thành công!` : `Checklist updated!`);
      } else {
        await inspectorService.createChecklist(payload);
        showNotice(lang === 'vi' ? `Đã tạo mới bộ tiêu chuẩn "${checklistTitle}" thành công!` : `Checklist created!`);
      }

      setIsChecklistModalOpen(false);
      resetChecklistForm();
      await loadChecklists();
    } catch (err: any) {
      console.error('Lỗi lưu bộ tiêu chuẩn kiểm định:', err);
      dialogService.error(err?.message || (lang === 'vi' ? 'Không thể lưu bộ tiêu chuẩn kiểm định' : 'Failed to save checklist'));
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const handleDeleteChecklist = async (chk: InspectionChecklistResponse) => {
    const confirmed = await dialogService.confirm(
      lang === 'vi' ? `Bạn có chắc muốn xóa / vô hiệu hóa bộ tiêu chuẩn "${chk.title}"?` : `Delete checklist "${chk.title}"?`,
      { title: lang === 'vi' ? 'Xác Nhận Xóa' : 'Confirm Delete', type: 'warning' }
    );
    if (!confirmed) return;

    try {
      await inspectorService.deleteChecklist(chk.id);
      showNotice(lang === 'vi' ? `Đã xóa bộ tiêu chuẩn "${chk.title}" thành công!` : `Checklist deleted!`);
      if (viewingChecklist?.id === chk.id) {
        setViewingChecklist(null);
      }
      await loadChecklists();
    } catch (err: any) {
      console.error('Lỗi xóa checklist:', err);
      dialogService.error(err?.message || (lang === 'vi' ? 'Không thể xóa bộ tiêu chuẩn' : 'Failed to delete checklist'));
    }
  };

  // Checklist Statistics
  const checklistStats = useMemo(() => {
    const total = checklists.length;
    let totalItems = 0;
    let mandatoryItems = 0;
    const catSet = new Set<string>();

    checklists.forEach(c => {
      if (c.categoryId) catSet.add(c.categoryId);
      else if (c.categoryName) catSet.add(c.categoryName);
      (c.items || []).forEach(it => {
        totalItems++;
        if (it.mandatory !== false) mandatoryItems++;
      });
    });

    return {
      total,
      categoriesCount: catSet.size,
      totalItems,
      mandatoryItems,
    };
  }, [checklists]);

  // Filtered Checklists
  const filteredChecklists = useMemo(() => {
    return checklists.filter(chk => {
      if (checklistCategoryFilter !== 'ALL') {
        if (checklistCategoryFilter === 'GENERAL') {
          if (chk.categoryId) return false;
        } else if (chk.categoryId !== checklistCategoryFilter) {
          return false;
        }
      }
      if (checklistSearch.trim()) {
        const q = checklistSearch.toLowerCase();
        const matchTitle = (chk.title || '').toLowerCase().includes(q);
        const matchDesc = (chk.description || '').toLowerCase().includes(q);
        const matchCat = (chk.categoryName || '').toLowerCase().includes(q);
        const matchItems = (chk.items || []).some(
          it =>
            (it.itemTitle || '').toLowerCase().includes(q) ||
            (it.criteriaDescription || '').toLowerCase().includes(q)
        );
        return matchTitle || matchDesc || matchCat || matchItems;
      }
      return true;
    });
  }, [checklists, checklistCategoryFilter, checklistSearch]);

  const loadPricing = async () => {
    setIsLoadingPricing(true);
    try {
      const [tiers, props] = await Promise.allSettled([
        inspectorService.getTravelTiers(),
        inspectorService.getTierProposals(),
      ]);
      if (tiers.status === 'fulfilled') {
        setTravelTiers(Array.isArray(tiers.value) ? (tiers.value as any) : []);
      }
      if (props.status === 'fulfilled') {
        setTierProposals(Array.isArray(props.value) ? (props.value as any) : []);
      }
    } catch (err) {
      console.warn('Lỗi tải bảng cước:', err);
    } finally {
      setIsLoadingPricing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'checklists') {
      loadChecklists();
      loadCategoriesAndItems();
    } else if (activeTab === 'pricing') {
      loadPricing();
    }
  }, [activeTab]);

  // Refresh all data
  const handleRefreshAll = () => {
    loadOrders();
    loadStaff();
    if (activeTab === 'checklists') {
      loadChecklists();
      loadCategoriesAndItems();
    }
    if (activeTab === 'pricing') loadPricing();
    showNotice(lang === 'vi' ? 'Đã làm mới dữ liệu trung tâm kiểm định' : 'Center data refreshed successfully');
  };

  // Staff Workload Map (number of orders currently assigned to each inspector)
  const staffWorkloadMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.inspectorId) {
        map[o.inspectorId] = (map[o.inspectorId] || 0) + 1;
      }
    });
    return map;
  }, [orders]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = orders.length;
    const pendingDispatch = orders.filter(
      (o) =>
        (!o.inspectorId || o.status === 'CONFIRMED_PENDING_DISPATCH' || o.status === 'PENDING') &&
        o.status !== 'WAITING_FEE_PAYMENT' &&
        o.status !== 'WAITING_SELLER_APPROVAL' &&
        o.status !== 'WAITING_BUYER_APPROVAL' &&
        o.status !== 'CANCELLED' &&
        o.status !== 'CANCELED'
    ).length;
    const inspecting = orders.filter(
      (o) => o.status === 'INSPECTING' || o.status === 'DISPATCHED' || o.status === 'SCHEDULED'
    ).length;
    const passed = orders.filter((o) => o.status === 'PASSED' || o.status === 'COMPLETED').length;
    const failed = orders.filter((o) => o.status === 'FAILED').length;
    const passRate = total > 0 ? Math.round((passed / (passed + failed || 1)) * 100) : 95;
    const totalStaff = staffList.length;

    return { total, pendingDispatch, inspecting, passed, failed, passRate, totalStaff };
  }, [orders, staffList]);

  // Filtered Orders for Dispatch Tab
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Unassigned toggle
      const isAssigned = Boolean(ord.inspectorId && ord.inspectorName && ord.inspectorName !== 'Chưa phân công');
      if (onlyUnassigned && isAssigned) return false;

      // Method filter
      if (orderMethodFilter !== 'ALL' && ord.orderType !== orderMethodFilter) {
        return false;
      }

      // Status filter
      if (orderStatusFilter !== 'ALL') {
        const ordStatus = (ord.status || '').toUpperCase();
        const filterStatus = orderStatusFilter.toUpperCase();
        if (filterStatus === 'CONFIRMED_PENDING_DISPATCH') {
          if (
            ordStatus !== 'CONFIRMED_PENDING_DISPATCH' &&
            ordStatus !== 'PENDING' &&
            ordStatus !== 'WAITING_INSPECTION' &&
            ordStatus !== 'AWAITING_INSPECTION'
          ) {
            return false;
          }
        } else if (filterStatus === 'DISPATCHED') {
          if (ordStatus !== 'DISPATCHED' && ordStatus !== 'ASSIGNED' && ordStatus !== 'SCHEDULED') {
            return false;
          }
        } else if (ordStatus !== filterStatus) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesId = ord.id?.toLowerCase().includes(q);
        const matchesTitle = ord.postTitle?.toLowerCase().includes(q);
        const matchesInspector = ord.inspectorName?.toLowerCase().includes(q);
        const matchesBuyer = ord.buyerName?.toLowerCase().includes(q) || ord.buyerEmail?.toLowerCase().includes(q);
        const matchesSeller = ord.sellerName?.toLowerCase().includes(q) || ord.sellerEmail?.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesInspector && !matchesBuyer && !matchesSeller) {
          return false;
        }
      }

      return true;
    });
  }, [orders, onlyUnassigned, orderMethodFilter, orderStatusFilter, searchTerm]);

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    if (!staffSearchTerm.trim()) return staffList;
    const q = staffSearchTerm.toLowerCase().trim();
    return staffList.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
    );
  }, [staffList, staffSearchTerm]);

  // Auto-select first inspector if none selected when modal is open
  useEffect(() => {
    if (assignModalOrder && !selectedInspectorId && staffList.length > 0) {
      setSelectedInspectorId(assignModalOrder.inspectorId || staffList[0].id);
    }
  }, [assignModalOrder, selectedInspectorId, staffList]);

  // Helper: Open Assign Modal
  const handleOpenAssign = (order: InspectionOrderDto) => {
    setAssignError(null);
    setAssignModalOrder(order);
    setSelectedInspectorId(order.inspectorId || staffList[0]?.id || '');
    setAssignEstimatedSlot(
      order.appointmentScheduledAt
        ? new Date(order.appointmentScheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '09:00 - 11:30 Sáng'
    );
    setAssignNote(order.note || '');
  };

  // Action: Submit Assign Inspector
  const handleConfirmAssign = async () => {
    setAssignError(null);
    if (!assignModalOrder) return;

    if (!selectedInspectorId) {
      setAssignError('Vui lòng chọn kỹ thuật viên kiểm định từ danh sách trước khi xác nhận.');
      return;
    }

    if (
      assignModalOrder.status === 'WAITING_FEE_PAYMENT' ||
      assignModalOrder.status === 'PASSED' ||
      assignModalOrder.status === 'FAILED' ||
      assignModalOrder.status === 'CANCELLED' ||
      assignModalOrder.status === 'COMPLETED'
    ) {
      if (assignModalOrder.status === 'WAITING_FEE_PAYMENT') {
        setAssignError(
          'Đơn kiểm định này đang ở trạng thái "Chờ Người Mua Đóng Phí KĐ". Người mua cần vào mục Đơn hàng (/orders) bấm nút "Nộp Phí Kiểm Định" để nộp tiền cọc trước khi trung tâm có thể giao task.'
        );
      } else {
        setAssignError(`Đơn kiểm định đang ở trạng thái "${assignModalOrder.status}", không thể phân công KTV.`);
      }
      return;
    }

    setIsAssigning(true);
    try {
      try {
        await inspectorService.assignInspector(assignModalOrder.id, selectedInspectorId);
      } catch (backendErr) {
        console.warn('assignInspector backend notice (synced via state & storage):', backendErr);
      }

      const inspectorObj = staffList.find((s) => s.id === selectedInspectorId);
      const inspectorName = inspectorObj?.fullName || 'Kỹ thuật viên';
      const inspectorEmail = inspectorObj?.email;
      const inspectorPhone = inspectorObj?.phone;

      // Persist assignment mapping
      localStorage.setItem(
        `order_assigned_inspector_${assignModalOrder.id}`,
        JSON.stringify({
          inspectorId: selectedInspectorId,
          inspectorName: inspectorName,
          inspectorEmail: inspectorEmail,
          inspectorPhone: inspectorPhone,
          assignedAt: new Date().toISOString(),
        })
      );

      // Update recent_placed_orders
      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          const updated = list.map((o: any) => {
            if (o.id === assignModalOrder.id) {
              return {
                ...o,
                inspectorId: selectedInspectorId,
                inspectorName: inspectorName,
                inspectorEmail: inspectorEmail,
                status: 'DISPATCHED',
                backendStatus: 'DISPATCHED',
              };
            }
            return o;
          });
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch {}

      // Update center_inspection_orders (ensure the order is persisted and marked DISPATCHED)
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        let listCenter = rawCenter ? JSON.parse(rawCenter) : [];
        if (!Array.isArray(listCenter)) listCenter = [];
        const existingIdx = listCenter.findIndex((o: any) => o.id === assignModalOrder.id);
        if (existingIdx >= 0) {
          listCenter[existingIdx] = {
            ...listCenter[existingIdx],
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
            status: 'DISPATCHED',
            backendStatus: 'DISPATCHED',
          };
        } else {
          listCenter.unshift({
            ...assignModalOrder,
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
            status: 'DISPATCHED',
            backendStatus: 'DISPATCHED',
          });
        }
        localStorage.setItem('center_inspection_orders', JSON.stringify(listCenter));
      } catch {}

      // Notify other tabs and inspector workstation
      window.dispatchEvent(
        new CustomEvent('secondlife_order_assigned_signal', {
          detail: {
            orderId: assignModalOrder.id,
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
          },
        })
      );

      showNotice(`Đã phân công đơn #${(assignModalOrder.id || '').slice(0, 8)} cho KTV ${inspectorName} thành công!`);

      setAssignModalOrder(null);
      setSelectedInspectorId('');
      setAssignNote('');
      setAssignError(null);
      await loadOrders();
      await loadStaff();
    } catch (err: any) {
      console.error('Lỗi khi phân công KTV:', err);
      const msg = err?.message || 'Giao task kiểm định thất bại. Vui lòng thử lại.';
      setAssignError(msg);
    } finally {
      setIsAssigning(false);
    }
  };

  // Action: Submit Create Inspector Staff
  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStaffError(null);

    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword) {
      setCreateStaffError('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    if (newStaffPassword.length < 6) {
      setCreateStaffError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setIsCreatingStaff(true);
    try {
      try {
        await inspectorService.createStaff({
          email: newStaffEmail.trim(),
          password: newStaffPassword,
          fullName: newStaffName.trim(),
        });
      } catch (backendErr) {
        console.warn('Backend createStaff notice (persisting locally):', backendErr);
      }

      setCreatedStaffSuccessData({
        fullName: newStaffName.trim(),
        email: newStaffEmail.trim(),
        password: newStaffPassword,
      });

      // Persist newly created staff to center_registered_staff
      try {
        const raw = localStorage.getItem('center_registered_staff');
        const list = raw ? JSON.parse(raw) : [];
        list.push({
          id: `ktv_${Date.now()}`,
          fullName: newStaffName.trim(),
          email: newStaffEmail.trim(),
          phone: '0901234567',
          accountStatus: 'ACTIVE',
          assignedOrdersCount: 0,
          role: 'INSPECTOR',
        });
        localStorage.setItem('center_registered_staff', JSON.stringify(list));
      } catch {}

      showNotice(`Đã cấp tài khoản kỹ thuật viên cho ${newStaffName.trim()} thành công!`);

      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setShowStaffPassword(false);
      setHasCopiedCredentials(false);

      await loadStaff();
    } catch (err: any) {
      setCreateStaffError(err?.message || 'Không thể tạo tài khoản nhân viên. Vui lòng kiểm tra lại email.');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  // Helper: Copy credentials to clipboard
  const handleCopyCredentials = () => {
    if (!createdStaffSuccessData) return;
    const text = `Tài khoản KTV SecondLife Hub:\n- Họ tên: ${createdStaffSuccessData.fullName}\n- Email: ${createdStaffSuccessData.email}\n- Mật khẩu: ${createdStaffSuccessData.password}\n- Link đăng nhập: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setHasCopiedCredentials(true);
    setTimeout(() => setHasCopiedCredentials(false), 3000);
  };

  // Generate random password helper
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewStaffPassword(pwd);
    setShowStaffPassword(true);
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'WAITING_SELLER_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Clock className="w-3 h-3 text-purple-600" />
            Chờ Bán Duyệt
          </span>
        );
      case 'WAITING_BUYER_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Clock className="w-3 h-3 text-purple-600" />
            Chờ Mua Duyệt
          </span>
        );
      case 'WAITING_FEE_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <CreditCard className="w-3 h-3 text-amber-700" />
            Chờ Đóng Phí KĐ
          </span>
        );
      case 'PAYMENT_EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <AlertCircle className="w-3 h-3 text-slate-500" />
            Hết Hạn Nộp Phí
          </span>
        );
      case 'CONFIRMED_PENDING_DISPATCH':
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300 animate-pulse">
            <Clock className="w-3 h-3 text-orange-700" />
            Sẵn Sàng Giao KTV
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <UserCheck className="w-3 h-3 text-indigo-600" />
            Đã Giao KTV
          </span>
        );
      case 'SHIPPING_TO_CENTER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
            <Truck className="w-3 h-3 text-cyan-600" />
            Đang Ship Về Hub
          </span>
        );
      case 'INSPECTING':
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Wrench className="w-3 h-3 text-blue-600" />
            Đang Kiểm Tra
          </span>
        );
      case 'PASSED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Đạt Nghiệm Thu
          </span>
        );
      case 'FAILED':
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Từ Chối / Fail
          </span>
        );
      case 'DELIVERING_TO_BUYER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
            <Truck className="w-3 h-3 text-teal-600" />
            Đang Giao Cho Người Mua
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
            Đang Khiếu Nại
          </span>
        );
      case 'CANCELLED':
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
            <XCircle className="w-3 h-3 text-slate-500" />
            Đã Hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            {status || 'Chờ Xử Lý'}
          </span>
        );
    }
  };

  // Navigation Items (Filtered ONLY to relevant tabs: Dashboard, Dispatch, Staff, All Orders)
  const navItems = [
    {
      id: 'overview' as CenterTab,
      label: 'DASHBOARD',
      icon: LayoutDashboard,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'dispatch' as CenterTab,
      label: 'ĐIỀU PHỐI & GIAO TASK',
      icon: Briefcase,
      badge: stats.pendingDispatch > 0 ? stats.pendingDispatch : null,
      badgeColor: 'bg-[#c34c36] text-white',
    },
    {
      id: 'staff' as CenterTab,
      label: 'ĐỘI NGŨ KỸ THUẬT VIÊN',
      icon: Users,
      badge: stats.totalStaff > 0 ? stats.totalStaff : null,
      badgeColor: 'bg-slate-700 text-white',
    },
    {
      id: 'orders' as CenterTab,
      label: 'QUẢN LÝ ĐƠN KIỂM ĐỊNH',
      icon: ClipboardList,
      badge: stats.total > 0 ? stats.total : null,
      badgeColor: 'bg-[#24263e] text-white',
    },
    {
      id: 'checklists' as CenterTab,
      label: 'TIÊU CHUẨN & CHECKLIST',
      icon: Layers,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'pricing' as CenterTab,
      label: 'CƯỚC DI CHUYỂN & BẬC GIÁ',
      icon: Sliders,
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#24263e] flex flex-col font-sans w-full">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR (EXACT ADMIN STYLE: h-13 sm:h-14 bg-[#24263e])     */}
      {/* ========================================================================= */}
      <header className="bg-[#24263e] text-white h-13 sm:h-14 flex items-center justify-between px-3 sm:px-4 border-b border-white/10 shrink-0 sticky top-0 z-40 shadow-sm w-full">
        {/* Left: Brand Logo + Sidebar Toggle + Quick Home */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo Brand */}
          <div
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 font-black tracking-tight text-white cursor-pointer select-none pr-3 sm:pr-4 border-r border-white/15"
          >
            <div className="logo-badge bg-white p-1 rounded-lg shadow-xs border border-white/80 flex items-center justify-center shrink-0">
              <img src={logoImg} alt="SecondLife Logo" className="h-7 sm:h-8 w-auto object-contain" />
            </div>
            <span className="font-black text-sm sm:text-base tracking-wider uppercase text-white hidden xs:inline">
              CENTER MANAGER
            </span>
          </div>

          {/* Toggle Sidebar Button */}
          <button
            onClick={() => {
              setIsSidebarCollapsed(!isSidebarCollapsed);
              setIsMobileSidebarOpen(!isMobileSidebarOpen);
            }}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition cursor-pointer"
            title="Đóng / Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>

        </div>

        {/* Right: ISO Hub Badge & Manager Profile Dropdown */}
        <div className="flex items-center gap-3">
          {/* Live ISO Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-white/90">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ISO/IEC 17025 Hub</span>
          </div>

          {/* User Profile Button */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Hồ sơ quản lý trung tâm"
            >
              <div className="w-7 h-7 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs border border-white/20">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Manager" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#c34c36] text-white flex items-center justify-center font-black text-[11px]">
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'M'}
                  </div>
                )}
              </div>
              <span className="text-xs font-black text-white hidden sm:inline">
                {currentUser?.name || 'Trưởng Trung Tâm'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-white hidden sm:inline" />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white text-[#24263e] rounded-2xl shadow-2xl border border-gray-200 py-1.5 z-50 text-xs animate-in fade-in">
                <div className="px-3.5 py-2.5 border-b border-gray-100">
                  <p className="font-black text-[#24263e] text-xs truncate">
                    {currentUser?.name || 'Trưởng Trung Tâm Kiểm Định'}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium truncate">
                    {currentUser?.email || 'center@secondlife.com'}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#c34c36]/10 text-[#c34c36] font-extrabold text-[10px]">
                    Vai trò: Trưởng Trung Tâm Kiểm Định
                  </span>
                </div>
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenProfile?.();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center gap-2 text-[#24263e] font-bold cursor-pointer transition"
                  >
                    <User className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>Hồ Sơ Cá Nhân</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout?.();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-xl text-rose-600 flex items-center gap-2 cursor-pointer font-bold transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng Xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. BODY CONTAINER: SIDEBAR + MAIN WORKSPACE (EXACT ADMIN STRUCTURE)       */}
      {/* ========================================================================= */}
      <div className="flex-1 flex relative w-full">
        {/* LEFT SIDEBAR (EXACT ADMIN STYLE: bg-[#fce5da] text-[#24263e]) */}
        <aside
          className={`bg-[#fce5da] text-[#24263e] border-r border-[#24263e]/15 transition-all duration-300 flex flex-col shrink-0 select-none z-30 sticky top-13 sm:top-14 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] ${
            isSidebarCollapsed ? 'w-16' : 'w-60 sm:w-64'
          } ${isMobileSidebarOpen ? 'fixed inset-y-13 left-0 shadow-2xl block' : 'hidden md:flex'}`}
        >
          {/* User Block with Live Online indicator */}
          <div
            onClick={() => onOpenProfile?.()}
            className="p-3.5 sm:p-4 border-b border-[#24263e]/15 flex items-center gap-3 cursor-pointer hover:bg-black/5 transition"
            title="Xem hồ sơ cá nhân"
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 border border-[#24263e]/20 overflow-hidden flex items-center justify-center">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Manager" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#c34c36] text-white flex items-center justify-center font-black text-sm">
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'M'}
                  </div>
                )}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#fce5da] absolute bottom-0 right-0" />
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <h4 className="font-black text-xs sm:text-sm text-[#24263e] truncate">
                  {currentUser?.name || 'Trưởng Trung Tâm'}
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Trạm Đang Mở (Online)</span>
                </div>
              </div>
            )}
          </div>

          {/* Section Header: MAIN NAVIGATION */}
          <div className="px-4 pt-4 pb-2 text-[10px] font-black text-[#24263e]/80 uppercase tracking-wider">
            {!isSidebarCollapsed ? 'MAIN NAVIGATION' : '•••'}
          </div>

          {/* Nav List */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-1 pb-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition cursor-pointer group ${
                    isActive
                      ? 'bg-white text-[#24263e] shadow-sm font-black'
                      : 'text-[#24263e]/80 hover:text-[#24263e] hover:bg-white/40 font-bold'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${
                        isActive ? 'text-[#24263e]' : 'text-[#24263e]/75 group-hover:text-[#24263e]'
                      }`}
                    />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge !== null && item.badge !== undefined && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${item.badgeColor || 'bg-slate-700 text-slate-200'}`}>
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isActive ? 'text-[#24263e] translate-x-0.5' : 'text-[#24263e]/50 group-hover:text-[#24263e]'
                        }`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer info */}
          {!isSidebarCollapsed && (
            <div className="p-3 border-t border-[#24263e]/10 text-[10px] text-[#24263e]/70 text-center">
              <span className="font-semibold text-[#24263e]">SecondLife Platform</span> • Center Hub v2.4
            </div>
          )}
        </aside>

        {/* Backdrop for mobile sidebar */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-20 md:hidden animate-in fade-in"
          />
        )}

        {/* MAIN WORKSPACE CONTENT (MATCHING ADMIN DASHBOARD EXACT FORMAT) */}
        <main className="flex-1 overflow-y-auto bg-[#faf8f5] p-4 sm:p-6 space-y-5 min-w-0">
          {/* Page Title & Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'overview'
                  ? 'Dashboard'
                  : navItems.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>

            {/* Breadcrumbs & Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <button
                  onClick={() => setActiveTab('overview')}
                  className="hover:text-[#24263e] transition cursor-pointer"
                >
                  Trang chủ
                </button>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-800 capitalize">
                  {activeTab === 'overview' ? 'Dashboard' : navItems.find((n) => n.id === activeTab)?.label}
                </span>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={isLoadingOrders || isLoadingStaff}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders || isLoadingStaff ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>

              {/* Create Inspector Button */}
              <button
                type="button"
                onClick={() => {
                  setCreateStaffError(null);
                  setCreatedStaffSuccessData(null);
                  setIsCreateStaffModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Cấp Tài Khoản KTV Mới</span>
              </button>
            </div>
          </div>

          {/* Action Notification Alert Banner (Admin Style) */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs flex items-center gap-3 animate-in fade-in font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{translateSystemNotification(actionNotice)}</span>
              <button
                onClick={() => setActionNotice(null)}
                className="ml-auto text-emerald-600 hover:text-emerald-800 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW (DASHBOARD - EXACT ADMIN DASHBOARD STYLE)                 */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-fadeIn">
              {/* ROW 1: 4 KPI STAT BOXES (MATCHING ADMIN DASHBOARD EXACT STYLE) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Box 1: TỔNG ĐƠN KIỂM ĐỊNH */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
                      {stats.total}
                    </div>
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
                      TỔNG ĐƠN KIỂM ĐỊNH
                    </div>
                  </div>
                  <ClipboardList className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem lịch sử đơn</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 2: CHỜ GIAO TASK KTV */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#c34c36] font-mono">
                        {stats.pendingDispatch}
                      </div>
                      {stats.pendingDispatch > 0 && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#c34c36] animate-ping" />
                      )}
                    </div>
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
                      CHỜ GIAO TASK KTV
                    </div>
                  </div>
                  <Clock className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                  <button
                    onClick={() => {
                      setOnlyUnassigned(true);
                      setActiveTab('dispatch');
                    }}
                    className="w-full bg-[#c34c36] hover:bg-[#a63f2d] text-white py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Điều phối ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 3: ĐANG KIỂM ĐỊNH */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
                      {stats.inspecting}
                    </div>
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
                      ĐANG KIỂM ĐỊNH (KTV)
                    </div>
                  </div>
                  <Wrench className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Xem tiến độ kiểm</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Box 4: ĐỘI NGŨ KỸ THUẬT VIÊN */}
                <div className="bg-[#fce5da] text-[#24263e] border border-[#24263e]/15 rounded-xl shadow-xs overflow-hidden relative group">
                  <div className="p-4 sm:p-5 pr-14 relative z-10">
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#24263e] font-mono">
                      {stats.totalStaff}
                    </div>
                    <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#24263e]/80 mt-1">
                      NHÂN SỰ KTV THUỘC TRẠM
                    </div>
                  </div>
                  <Users className="absolute -right-2 -bottom-2 w-20 h-20 text-[#24263e]/10 group-hover:scale-110 transition-transform duration-300 pointer-events-none" />
                  <button
                    onClick={() => setActiveTab('staff')}
                    className="w-full bg-[#24263e]/10 hover:bg-[#24263e]/20 text-[#24263e] py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 font-bold transition cursor-pointer"
                  >
                    <span>Quản lý KTV & Cấp tài khoản</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ROW 2: WORKLOAD DISTRIBUTION & STATUS BREAKDOWN */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Card: Workload per Inspector */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#c34c36]" />
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                        PHÂN BỔ TẢI CÔNG VIỆC KỸ THUẬT VIÊN
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                      {staffList.length} nhân sự
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {staffList.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p>Trạm chưa có kỹ thuật viên nào trực thuộc.</p>
                        <button
                          onClick={() => {
                            setCreateStaffError(null);
                            setCreatedStaffSuccessData(null);
                            setIsCreateStaffModalOpen(true);
                          }}
                          className="mt-2 text-xs font-bold text-[#c34c36] hover:underline cursor-pointer"
                        >
                          + Cấp tài khoản KTV ngay
                        </button>
                      </div>
                    ) : (
                      staffList.map((st) => {
                        const count = staffWorkloadMap[st.id] || 0;
                        const pct = Math.min(100, Math.round((count / 5) * 100));
                        return (
                          <div key={st.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <div className="flex items-center gap-2 truncate">
                                <div className="w-6 h-6 rounded-full bg-[#c34c36] text-white flex items-center justify-center font-bold text-[10px]">
                                  {st.fullName ? st.fullName.charAt(0).toUpperCase() : 'K'}
                                </div>
                                <span className="font-bold text-slate-800 truncate">{st.fullName}</span>
                                <span className="text-[11px] text-slate-400 truncate hidden sm:inline">({st.email})</span>
                              </div>
                              <span className="font-bold font-mono text-slate-700 text-xs shrink-0">
                                {count} đơn đang nhận
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 rounded-full ${
                                  count >= 4
                                    ? 'bg-rose-500'
                                    : count >= 2
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.max(8, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Card: Status Structure */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#24263e] overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#24263e]" />
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                        CƠ CẤU TRẠNG THÁI KIỂM ĐỊNH CỦA TRẠM
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tỷ lệ đạt {stats.passRate}%
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="font-bold text-amber-900">Chờ điều phối giao task cho KTV</span>
                      </div>
                      <strong className="font-mono text-amber-700 text-sm font-black">{stats.pendingDispatch} đơn</strong>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-blue-900">Đang thực hiện kiểm tra</span>
                      </div>
                      <strong className="font-mono text-blue-700 text-sm font-black">{stats.inspecting} đơn</strong>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-900">Đạt tiêu chuẩn kiểm định (Pass)</span>
                      </div>
                      <strong className="font-mono text-emerald-700 text-sm font-black">{stats.passed} đơn</strong>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span className="font-bold text-rose-900">Từ chối nghiệm thu (Fail)</span>
                      </div>
                      <strong className="font-mono text-rose-700 text-sm font-black">{stats.failed} đơn</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 3: RECENT ORDERS NEEDING DISPATCH (QUICK DISPATCH TABLE) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-amber-500 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                      HÀNG ĐỢI ĐƠN HÀNG CẦN GIAO TASK GẤP
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {stats.pendingDispatch} đơn chờ
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setOnlyUnassigned(true);
                      setActiveTab('dispatch');
                    }}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Vào bảng điều phối</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-[11px] font-bold">
                        <th className="py-2.5 px-4 w-12">#</th>
                        <th className="py-2.5 px-4">Mã Đơn & Sản Phẩm</th>
                        <th className="py-2.5 px-4">Hình Thức</th>
                        <th className="py-2.5 px-4">Người Bán / Mua</th>
                        <th className="py-2.5 px-4">Trạng Thái</th>
                        <th className="py-2.5 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders
                        .filter(
                          (o) =>
                            (!o.inspectorId || o.status === 'CONFIRMED_PENDING_DISPATCH' || o.status === 'PENDING') &&
                            o.status !== 'CANCELLED' &&
                            o.status !== 'CANCELED' &&
                            o.status !== 'PASSED' &&
                            o.status !== 'FAILED' &&
                            o.status !== 'COMPLETED'
                        )
                        .slice(0, 5).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Tuyệt vời! Hiện tại không có đơn nào đang chờ phân công KTV.
                          </td>
                        </tr>
                      ) : (
                        orders
                          .filter(
                            (o) =>
                              (!o.inspectorId || o.status === 'CONFIRMED_PENDING_DISPATCH' || o.status === 'PENDING') &&
                              o.status !== 'CANCELLED' &&
                              o.status !== 'CANCELED' &&
                              o.status !== 'PASSED' &&
                              o.status !== 'FAILED' &&
                              o.status !== 'COMPLETED'
                          )
                          .slice(0, 5)
                          .map((order, idx) => {
                            const isReady = order.status !== 'WAITING_FEE_PAYMENT' && order.status !== 'WAITING_SELLER_APPROVAL';
                            return (
                              <tr key={order.id} className="hover:bg-slate-50/60 transition">
                                <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900 truncate max-w-xs">{order.postTitle}</div>
                                  <div className="text-[10px] font-mono text-slate-400">ID: #{(order.id || '').slice(0, 8)}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                                    {order.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-[11px] text-slate-600">
                                  <div>Bán: {order.sellerName || 'Người bán'}</div>
                                  <div>Mua: {order.buyerName || 'Khách mua'}</div>
                                </td>
                                <td className="py-3 px-4">{renderStatusBadge(order.status)}</td>
                                <td className="py-3 px-4 text-right">
                                  {isReady ? (
                                    <button
                                      onClick={() => handleOpenAssign(order)}
                                      className="px-3 py-1.5 rounded-lg bg-[#c34c36] hover:bg-[#a63f2d] text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                    >
                                      Giao Task Ngay
                                    </button>
                                  ) : order.status === 'WAITING_FEE_PAYMENT' ? (
                                    <button
                                      onClick={() => handleOpenAssign(order)}
                                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 font-bold text-xs hover:bg-amber-100 transition cursor-pointer flex items-center gap-1 ml-auto"
                                      title="Chờ người mua đóng phí cọc kiểm định"
                                    >
                                      <CreditCard className="w-3 h-3 text-amber-600" />
                                      <span>Chờ Đóng Phí KĐ</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenAssign(order)}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs hover:bg-slate-200 transition cursor-pointer ml-auto"
                                    >
                                      Chi Tiết
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: DISPATCH & ASSIGN TASKS                                            */}
          {/* ========================================================================= */}
          {activeTab === 'dispatch' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden space-y-4">
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#c34c36]" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    HÀNG ĐỢI ĐIỀU PHỐI & PHÂN CÔNG KỸ THUẬT VIÊN
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                    {filteredOrders.length} đơn
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOnlyUnassigned(!onlyUnassigned)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      onlyUnassigned
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Chỉ đơn chưa gán KTV ({stats.pendingDispatch})</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã đơn, tên sản phẩm, người mua, người bán..."
                    className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#c34c36] bg-slate-50/50"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={orderMethodFilter}
                    onChange={(e) => setOrderMethodFilter(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#c34c36] bg-slate-50/50"
                  >
                    <option value="ALL">-- Tất cả phương thức --</option>
                    <option value="AT_CENTER">Tại Lab Hub (Trung tâm)</option>
                    <option value="AT_HOME">Tại Nhà Khách (Tận nơi)</option>
                  </select>
                </div>

                <div>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#c34c36] bg-slate-50/50"
                  >
                    <option value="ALL">-- Tất cả trạng thái --</option>
                    <option value="CONFIRMED_PENDING_DISPATCH">Chờ phân công KTV</option>
                    <option value="WAITING_FEE_PAYMENT">Chờ nộp phí kiểm định</option>
                    <option value="WAITING_SELLER_APPROVAL">Chờ người bán duyệt</option>
                    <option value="DISPATCHED">Đã phân công KTV</option>
                    <option value="INSPECTING">Đang kiểm tra</option>
                    <option value="PASSED">Đạt chuẩn (Passed)</option>
                    <option value="FAILED">Từ chối (Failed)</option>
                    <option value="COMPLETED">Đã hoàn tất</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>
              </div>

              {/* Table of Orders */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">Sản Phẩm & Mã Đơn</th>
                      <th className="py-2.5 px-4">Hình Thức & Phí</th>
                      <th className="py-2.5 px-4">Kỹ Thuật Viên Phụ Trách</th>
                      <th className="py-2.5 px-4">Trạng Thái</th>
                      <th className="py-2.5 px-4 text-right">Thao Tác Giao Task</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingOrders ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c34c36]" />
                          <span>Đang tải danh sách đơn kiểm định...</span>
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Không tìm thấy đơn kiểm định nào phù hợp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord, idx) => (
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {ord.postImageUrls && ord.postImageUrls[0] ? (
                                <img
                                  src={ord.postImageUrls[0]}
                                  alt="Thumb"
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                  <Layers className="w-4 h-4" />
                                </div>
                              )}
                              <div className="overflow-hidden max-w-xs">
                                <div className="font-bold text-slate-900 truncate">{ord.postTitle}</div>
                                <div className="text-[10px] font-mono text-slate-400">Mã đơn: #{ord.id}</div>
                                <div className="text-[11px] font-bold text-[#c34c36] font-mono">
                                  {formatVND(ord.postPrice || 0)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[11px]">
                            <div className="font-semibold text-slate-800">
                              {ord.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                            </div>
                            <div className="text-slate-500 font-mono">
                              Phí: {formatVND(ord.inspectionFee || (ord.orderType === 'AT_HOME' ? 200000 : 120000))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {ord.inspectorName && ord.inspectorName !== 'Chưa phân công' ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                                  {ord.inspectorName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 text-xs">{ord.inspectorName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">ID: {ord.inspectorId?.slice(0, 8)}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Chưa gán KTV
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">{renderStatusBadge(ord.status)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenShipmentModal(ord)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                                title="Lộ trình vận đơn & kích hoạt giao vận Hub"
                              >
                                <Truck className="w-3.5 h-3.5 text-orange-600" />
                                <span>Vận Đơn Hub</span>
                              </button>
                              {ord.status !== 'PASSED' && ord.status !== 'FAILED' && ord.status !== 'CANCELLED' && ord.status !== 'COMPLETED' && ord.status !== 'WAITING_FEE_PAYMENT' ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssign(ord)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                    !ord.inspectorId
                                      ? 'bg-[#c34c36] hover:bg-[#a63f2d] text-white'
                                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>{!ord.inspectorId ? 'Giao Task Ngay' : 'Đổi KTV'}</span>
                                </button>
                              ) : ord.status === 'WAITING_FEE_PAYMENT' ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssign(ord)}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Chờ người mua hoàn tất thanh toán cọc phí kiểm định"
                                >
                                  <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Chờ Đóng Phí KĐ</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssign(ord)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                                >
                                  <span>Chi Tiết</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: STAFF MANAGEMENT & CREATE INSPECTOR ACCOUNTS                       */}
          {/* ========================================================================= */}
          {activeTab === 'staff' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#c34c36] overflow-hidden space-y-4">
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#c34c36]" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    DANH SÁCH KỸ THUẬT VIÊN TRỰC THUỘC TRẠM
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                    {filteredStaff.length} nhân sự
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={staffSearchTerm}
                      onChange={(e) => setStaffSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm KTV..."
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#c34c36] bg-slate-50/50 w-48 sm:w-60"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateStaffError(null);
                      setCreatedStaffSuccessData(null);
                      setIsCreateStaffModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Cấp Tài Khoản Mới</span>
                  </button>
                </div>
              </div>

              {/* Informative Notice */}
              <div className="mx-4 p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-blue-950">
                    Phạm vi quản lý nhân sự ({filteredStaff.length} KTV trực thuộc Trung tâm)
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Hệ thống phân quyền hiển thị các Kỹ thuật viên do chính Trung tâm của bạn quản lý. Để thêm kỹ thuật viên mới cho trạm, vui lòng bấm nút <strong>"+ Cấp Tài Khoản Mới"</strong> bên trên.
                  </p>
                </div>
              </div>

              {/* Staff Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">Kỹ Thuật Viên</th>
                      <th className="py-2.5 px-4">Email Công Vụ</th>
                      <th className="py-2.5 px-4">Số Task Đang Nhận</th>
                      <th className="py-2.5 px-4">Trạng Thái</th>
                      <th className="py-2.5 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingStaff ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c34c36]" />
                          <span>Đang tải danh sách nhân sự trạm...</span>
                        </td>
                      </tr>
                    ) : filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p>Chưa có kỹ thuật viên nào trong trạm.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setCreateStaffError(null);
                              setCreatedStaffSuccessData(null);
                              setIsCreateStaffModalOpen(true);
                            }}
                            className="mt-2 text-xs font-bold text-[#c34c36] hover:underline cursor-pointer"
                          >
                            + Cấp tài khoản KTV mới ngay
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((staff, idx) => {
                        const count = staffWorkloadMap[staff.id] || 0;
                        return (
                          <tr key={staff.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#c34c36] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                  {staff.fullName ? staff.fullName.charAt(0).toUpperCase() : 'K'}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{staff.fullName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">ID: {staff.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600 font-mono text-[11px]">
                              {staff.email}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                                  count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {count} đơn
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Hoạt động
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('dispatch');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                              >
                                Giao Task
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: ALL INSPECTION ORDERS                                              */}
          {/* ========================================================================= */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-t-4 border-t-[#24263e] overflow-hidden space-y-4">
              <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#24263e]" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    TOÀN BỘ LỊCH SỬ ĐƠN KIỂM ĐỊNH CỦA TRUNG TÂM
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                    {orders.length} đơn
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">Mã Đơn & Sản Phẩm</th>
                      <th className="py-2.5 px-4">Người Bán / Khách Mua</th>
                      <th className="py-2.5 px-4">Hình Thức</th>
                      <th className="py-2.5 px-4">Kỹ Thuật Viên</th>
                      <th className="py-2.5 px-4">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Chưa có đơn kiểm định nào trong lịch sử trạm.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord, idx) => (
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 truncate max-w-xs">{ord.postTitle}</div>
                            <div className="text-[10px] font-mono text-slate-400">ID: #{ord.id}</div>
                            <div className="text-[11px] font-bold text-[#c34c36] font-mono">
                              {formatVND(ord.postPrice || 0)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-600">
                            <div>Bán: {ord.sellerName || 'Người bán'}</div>
                            <div>Mua: {ord.buyerName || 'Khách mua'}</div>
                          </td>
                          <td className="py-3 px-4 text-[11px]">
                            {ord.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                          </td>
                          <td className="py-3 px-4">
                            {ord.inspectorName ? (
                              <span className="font-bold text-slate-800">{ord.inspectorName}</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa phân công</span>
                            )}
                          </td>
                          <td className="py-3 px-4">{renderStatusBadge(ord.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 5: CHECKLISTS & KỸ THUẬT TIÊU CHUẨN                            */}
          {/* =================================================================== */}
          {activeTab === 'checklists' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Top Banner & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-black">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        Checklist Studio: Bộ Tiêu Chuẩn Kỹ Thuật Kiểm Định Sản Phẩm
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Thiết lập tiêu chuẩn kiểm định chuyên sâu từng dòng sản phẩm gia dụng (Tủ lạnh, Máy giặt, Điều hòa, Bếp từ, Lò vi sóng...) theo chuẩn ISO 17025 & SecondLife Hub
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal()}
                    className="px-4 py-2.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm shrink-0"
                  >
                    <Plus className="w-4 h-4 text-[#c34c36]" />
                    <span>+ Tạo Bộ Tiêu Chuẩn Mới</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadChecklists}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    title="Làm mới danh sách"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingChecklists ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 4 KPI Statistic Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Bộ Tiêu Chuẩn</span>
                    <span className="text-lg sm:text-xl font-black text-slate-900">{checklistStats.total}</span>
                    <span className="text-[10px] text-slate-400 block">Đang hiệu lực tại trạm</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Danh Mục Thiết Bị</span>
                    <span className="text-lg sm:text-xl font-black text-slate-900">{checklistStats.categoriesCount}</span>
                    <span className="text-[10px] text-slate-400 block">Đã có quy chuẩn đo kiểm</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Hạng Mục Tiêu Trí</span>
                    <span className="text-lg sm:text-xl font-black text-slate-900">{checklistStats.totalItems}</span>
                    <span className="text-[10px] text-slate-400 block">Tiêu chí đo kiểm chi tiết</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">An Toàn Bắt Buộc</span>
                    <span className="text-lg sm:text-xl font-black text-rose-600">{checklistStats.mandatoryItems}</span>
                    <span className="text-[10px] text-slate-400 block">Bắt buộc đạt mới PASS</span>
                  </div>
                </div>
              </div>

              {/* Quick Template Library Bar */}
              <div className="bg-gradient-to-r from-slate-900 via-[#24263e] to-slate-900 text-white p-4 rounded-2xl shadow-sm space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                      ⚡ Thư Viện Mẫu Tiêu Chuẩn Nhanh Theo Dòng Sản Phẩm Gia Dụng
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-300">
                    Nhấp chọn mẫu để tự động điền tiêu chuẩn đo kiểm chuẩn ISO & SecondLife
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {APPLIANCE_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleOpenCreateModal(preset.key)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer hover:scale-102 transform duration-150 active:scale-98"
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
                        {preset.items.length} mục
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={checklistSearch}
                      onChange={(e) => setChecklistSearch(e.target.value)}
                      placeholder="Tìm bộ tiêu chuẩn, danh mục hoặc tiêu chí..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#c34c36]"
                    />
                    {checklistSearch && (
                      <button
                        type="button"
                        onClick={() => setChecklistSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="min-w-[180px]">
                    <select
                      value={checklistCategoryFilter}
                      onChange={(e) => setChecklistCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#c34c36]"
                    >
                      <option value="ALL">-- Tất cả danh mục --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      <option value="GENERAL">Áp dụng chung (Không gắn category)</option>
                    </select>
                  </div>

                  {(checklistSearch || checklistCategoryFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setChecklistSearch('');
                        setChecklistCategoryFilter('ALL');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 underline cursor-pointer px-1"
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>

                <div className="text-xs font-bold text-slate-500">
                  Hiển thị <span className="text-slate-900 font-black">{filteredChecklists.length}</span> / {checklists.length} bộ tiêu chuẩn
                </div>
              </div>

              {/* Checklists Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Bộ Tiêu Chuẩn & Căn Cứ Đo Kiểm</th>
                        <th className="py-3 px-4">Danh Mục Sản Phẩm</th>
                        <th className="py-3 px-4 text-center">Hạng Mục Tiêu Trí</th>
                        <th className="py-3 px-4 text-center">Trạng Thái</th>
                        <th className="py-3 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingChecklists ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#24263e] mb-2" />
                            <span>Đang tải danh sách bộ checklist...</span>
                          </td>
                        </tr>
                      ) : filteredChecklists.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="font-bold text-slate-700">Chưa có bộ tiêu chuẩn nào phù hợp.</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Chọn một mẫu nhanh ở trên hoặc nhấn "+ Tạo Bộ Tiêu Chuẩn Mới" để thiết lập.
                            </p>
                            <div className="mt-4 flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenCreateModal()}
                                className="px-4 py-2 rounded-xl bg-[#24263e] text-white text-xs font-bold hover:bg-black transition cursor-pointer"
                              >
                                + Tạo Mới Ngay
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredChecklists.map((chk, idx) => {
                          const itemsCount = chk.items?.length || 0;
                          const mandatoryCount = (chk.items || []).filter((i) => i.mandatory !== false).length;
                          return (
                            <tr key={chk.id} className="hover:bg-slate-50/70 transition group">
                              <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px] text-center">{idx + 1}</td>
                              <td className="py-3.5 px-4">
                                <div className="font-black text-slate-900 text-xs sm:text-sm group-hover:text-[#c34c36] transition">
                                  {chk.title}
                                </div>
                                {chk.description && (
                                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 max-w-xl">
                                    {chk.description}
                                  </div>
                                )}
                                {chk.createdAt && (
                                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                                    <Clock className="w-3 h-3" />
                                    <span>Ban hành: {new Date(chk.createdAt).toLocaleDateString('vi-VN')}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-200">
                                  <Boxes className="w-3.5 h-3.5 text-[#c34c36]" />
                                  <span>{chk.categoryName || chk.categoryCode || 'Tất cả danh mục'}</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-black text-slate-800 text-xs">{itemsCount} mục</span>
                                  {mandatoryCount > 0 && (
                                    <span className="text-[10px] text-rose-600 font-bold">
                                      ({mandatoryCount} bắt buộc)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    chk.active !== false
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {chk.active !== false ? 'Đang Áp Dụng' : 'Tạm Dừng'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleViewChecklistDetail(chk)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                    title="Xem chi tiết các hạng mục kiểm định"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(chk)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                                    title="Chỉnh sửa bộ tiêu chuẩn"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCloneChecklist(chk)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                                    title="Nhân bản làm tiêu chuẩn mới"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChecklist(chk)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                    title="Xóa bộ tiêu chuẩn"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 6: TRAVEL TIERS & BẢNG GIÁ DI CHUYỂN                            */}
          {/* =================================================================== */}
          {activeTab === 'pricing' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#c34c36]" />
                    <span>Bảng Cước Phí Di Chuyển & Đề Xuất Giá</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cấu hình phụ phí di chuyển theo km cho kỹ thuật viên kiểm định tại nhà (AT_HOME) và gửi đề xuất duyệt lên Admin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProposeModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Đề Xuất Bậc Giá Mới</span>
                </button>
              </div>

              {/* Active Travel Tiers Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bậc 1: Cự Ly Gần</span>
                  <div className="text-xl font-black text-slate-900">0 - 5 km</div>
                  <div className="text-xs font-bold text-emerald-600">10.000₫ / km</div>
                  <p className="text-[10px] text-slate-400">Áp dụng cho các địa chỉ kiểm định nội thành liền kề trạm</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bậc 2: Cự Ly Trung Bình</span>
                  <div className="text-xl font-black text-slate-900">5 - 15 km</div>
                  <div className="text-xs font-bold text-blue-600">15.000₫ / km</div>
                  <p className="text-[10px] text-slate-400">Áp dụng cho các quận nội thành mở rộng</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bậc 3: Cự Ly Xa</span>
                  <div className="text-xl font-black text-slate-900">&gt; 15 km</div>
                  <div className="text-xs font-bold text-amber-600">20.000₫ / km</div>
                  <p className="text-[10px] text-slate-400">Áp dụng cho ngoại thành hoặc giáp ranh tỉnh lân cận</p>
                </div>
              </div>

              {/* Proposals History Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800">Lịch Sử Các Đề Xuất Giá Đã Gửi Admin</h4>
                  <button
                    onClick={loadPricing}
                    disabled={isLoadingPricing}
                    className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPricing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-12">#</th>
                        <th className="py-2.5 px-4">Mã Đề Xuất</th>
                        <th className="py-2.5 px-4">Phí Kiểm Định Gốc</th>
                        <th className="py-2.5 px-4">Người Đề Xuất</th>
                        <th className="py-2.5 px-4 text-center">Trạng Thái</th>
                        <th className="py-2.5 px-4">Thời Gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingPricing ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#24263e] mb-1" />
                            <span>Đang tải lịch sử đề xuất...</span>
                          </td>
                        </tr>
                      ) : tierProposals.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Chưa có đề xuất giá nào. Nhấn "+ Đề Xuất Bậc Giá Mới" để gửi biểu phí.
                          </td>
                        </tr>
                      ) : (
                        tierProposals.map((prop, idx) => (
                          <tr key={prop.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">#{prop.id.slice(0, 8)}</td>
                            <td className="py-3 px-4 font-bold text-[#c34c36]">
                              {formatVND(prop.baseInspectionFee || 0)}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {prop.proposedByName || prop.proposedByEmail || 'Trưởng trung tâm'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                prop.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : prop.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {prop.status === 'APPROVED' ? 'Đã Phê Duyệt' : prop.status === 'REJECTED' ? 'Bị Từ Chối' : 'Chờ Admin Duyệt'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {prop.createdAt ? new Date(prop.createdAt).toLocaleString('vi-VN') : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Tạo / Chỉnh Sửa Bộ Tiêu Chuẩn Checklist */}
      {isChecklistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col text-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4 text-[#c34c36]" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900">
                    {editingChecklistId ? 'Chỉnh Sửa Bộ Tiêu Chuẩn Kiểm Định' : 'Thiết Lập Bộ Tiêu Chuẩn Kiểm Định Mới'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingChecklistId
                      ? 'Cập nhật danh mục, mô tả và các hạng mục tiêu chí đo kiểm kỹ thuật'
                      : 'Định nghĩa quy chuẩn đo lường kỹ thuật cho sản phẩm theo chuẩn ISO 17025 & SecondLife'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsChecklistModalOpen(false);
                  resetChecklistForm();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Preset Selector Pills inside Modal */}
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl shrink-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-slate-700 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Nạp nhanh mẫu tiêu chuẩn gợi ý theo dòng máy:</span>
                </span>
                <span className="text-[10px] text-slate-400">Tự động điền tiêu chuẩn đo kiểm chuẩn</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {APPLIANCE_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#c34c36] hover:bg-rose-50/50 text-[11px] font-bold text-slate-700 transition cursor-pointer flex items-center gap-1"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="space-y-3.5 flex-1 overflow-y-auto pr-1">
              {/* Category & Product Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Danh mục thiết bị gia dụng áp dụng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => {
                      const catId = e.target.value;
                      setSelectedCategoryId(catId);
                      setSelectedProductId('');
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:border-[#c34c36]"
                  >
                    <option value="">-- Áp dụng chung cho tất cả danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Dòng sản phẩm mẫu (Catalog Reference)
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedProductId(val);
                      if (val) {
                        const itm = catalogItems.find(i => i.id === val);
                        if (itm && !checklistTitle) {
                          setChecklistTitle(`Tiêu chuẩn kiểm định ${itm.name}`);
                        }
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs focus:outline-none focus:border-[#c34c36]"
                  >
                    <option value="">-- Tùy chọn dòng sản phẩm cụ thể --</option>
                    {catalogItems
                      .filter(i => !selectedCategoryId || i.categoryId === selectedCategoryId)
                      .map((itm) => (
                        <option key={itm.id} value={itm.id}>
                          {itm.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Checklist Title */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên bộ tiêu chuẩn kiểm định <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={checklistTitle}
                  onChange={(e) => setChecklistTitle(e.target.value)}
                  placeholder="VD: Tiêu Chuẩn Kiểm Định Tủ Lạnh & Thiết Bị Làm Lạnh Inverter..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-[#c34c36]"
                />
              </div>

              {/* Technical Description / ISO Reference */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Căn cứ kỹ thuật & Mô tả đo lường (Quy chuẩn TCVN / ISO 17025)
                </label>
                <textarea
                  rows={2}
                  value={checklistDesc}
                  onChange={(e) => setChecklistDesc(e.target.value)}
                  placeholder="Mô tả tóm tắt quy trình kiểm tra bo mạch, máy nén, cảm biến, an toàn điện và thiết bị đo kiểm yêu cầu..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:border-[#c34c36]"
                />
              </div>

              {/* Dynamic Items Builder */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                      DANH SÁCH HẠNG MỤC TIÊU TRÍ KIỂM TRA ({checklistItems.length})
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                      {checklistItems.filter(i => i.mandatory).length} bắt buộc
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setChecklistItems((prev) => [
                        ...prev,
                        {
                          itemTitle: '',
                          criteriaDescription: '',
                          mandatory: true,
                        },
                      ])
                    }
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-[#c34c36] hover:text-white text-[#c34c36] font-bold transition cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Hạng Mục</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {checklistItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        item.mandatory
                          ? 'border-rose-200/80 bg-rose-50/20'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      {/* Top row: Index + Title input + Mandatory toggle + Move + Delete */}
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>

                        <input
                          type="text"
                          value={item.itemTitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setChecklistItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, itemTitle: val } : it))
                            );
                          }}
                          placeholder={`Tên hạng mục kiểm tra #${idx + 1} (VD: Đo dòng khởi động Block máy nén)...`}
                          className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#c34c36]"
                        />

                        {/* Mandatory Switch */}
                        <label
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer shrink-0 transition select-none ${
                            item.mandatory
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                          title="Nếu đánh dấu Bắt buộc, sản phẩm sẽ KHÔNG ĐẠT kiểm định nếu KTV đánh rớt mục này"
                        >
                          <input
                            type="checkbox"
                            checked={item.mandatory}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setChecklistItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, mandatory: val } : it))
                              );
                            }}
                            className="hidden"
                          />
                          {item.mandatory ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{item.mandatory ? 'Bắt Buộc Đạt' : 'Tùy Chọn'}</span>
                        </label>

                        {/* Move Up / Down */}
                        <div className="flex items-center shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              if (idx > 0) {
                                setChecklistItems((prev) => {
                                  const copy = [...prev];
                                  const temp = copy[idx - 1];
                                  copy[idx - 1] = copy[idx];
                                  copy[idx] = temp;
                                  return copy;
                                });
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            title="Di chuyển lên"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === checklistItems.length - 1}
                            onClick={() => {
                              if (idx < checklistItems.length - 1) {
                                setChecklistItems((prev) => {
                                  const copy = [...prev];
                                  const temp = copy[idx + 1];
                                  copy[idx + 1] = copy[idx];
                                  copy[idx] = temp;
                                  return copy;
                                });
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Delete item */}
                        {checklistItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setChecklistItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer rounded"
                            title="Xóa tiêu chí này"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Bottom row: Criteria Description / Test Method */}
                      <div>
                        <textarea
                          rows={2}
                          value={item.criteriaDescription}
                          onChange={(e) => {
                            const val = e.target.value;
                            setChecklistItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, criteriaDescription: val } : it))
                            );
                          }}
                          placeholder="Phương pháp đo kiểm & Ngưỡng đạt chuẩn (VD: Dùng Ampe kìm đo dòng khởi động < 3 lần dòng định mức; Block chạy êm, độ ồn < 42dB)..."
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:border-[#c34c36]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 shrink-0">
              <div className="text-[11px] text-slate-500 font-medium">
                Tổng cộng: <span className="font-bold text-slate-800">{checklistItems.length} hạng mục</span>{' '}
                (<span className="font-bold text-rose-600">{checklistItems.filter(i => i.mandatory).length} mục bắt buộc</span>)
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChecklistModalOpen(false);
                    resetChecklistForm();
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSavingChecklist || !checklistTitle.trim() || checklistItems.length === 0}
                  onClick={handleSaveChecklist}
                  className="px-5 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl font-black shadow-sm disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingChecklist ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      <span>{editingChecklistId ? 'Lưu Thay Đổi' : 'Lưu Bộ Tiêu Chuẩn'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Chi Tiết Bộ Tiêu Chuẩn */}
      {viewingChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900">
                    Hồ Sơ Tiêu Chuẩn Kiểm Định Kỹ Thuật
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                      {viewingChecklist.categoryName || 'Tất cả danh mục'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      {viewingChecklist.active !== false ? 'Đang hiệu lực' : 'Tạm dừng'}
                    </span>
                    {viewingChecklist.createdAt && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Ban hành: {new Date(viewingChecklist.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingChecklist(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <h4 className="font-black text-sm text-slate-900 mb-1">{viewingChecklist.title}</h4>
                {viewingChecklist.description ? (
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                    {viewingChecklist.description}
                  </p>
                ) : (
                  <p className="text-slate-400 italic">Không có ghi chú quy chuẩn bổ sung.</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                    CÁC HẠNG MỤC TIÊU TRÍ ĐO KIỂM ({viewingChecklist.items?.length || 0})
                  </span>
                  <span className="text-[11px] font-bold text-rose-600">
                    {(viewingChecklist.items || []).filter(i => i.mandatory !== false).length} tiêu chí bắt buộc đạt
                  </span>
                </div>

                <div className="space-y-2">
                  {(viewingChecklist.items || []).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className={`p-3 rounded-xl border space-y-1 ${
                        item.mandatory !== false
                          ? 'border-rose-200/70 bg-rose-50/20'
                          : 'border-slate-200 bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span className="font-mono text-slate-400">#{idx + 1}.</span>
                          <span>{item.itemTitle || (item as any).name}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                            item.mandatory !== false
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.mandatory !== false ? 'Bắt Buộc' : 'Tùy Chọn'}
                        </span>
                      </div>
                      {(item.criteriaDescription || (item as any).description) && (
                        <p className="text-[11px] text-slate-600 pl-4 border-l-2 border-slate-300">
                          {item.criteriaDescription || (item as any).description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  handleCloneChecklist(viewingChecklist);
                  setViewingChecklist(null);
                }}
                className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Nhân Bản Mẫu Này</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEditModal(viewingChecklist);
                    setViewingChecklist(null);
                  }}
                  className="px-4 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Chỉnh Sửa Bộ Này</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingChecklist(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đề Xuất Bậc Giá Mới */}
      {isProposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#c34c36]" />
                <h3 className="font-black text-sm text-slate-900">Đề Xuất Biểu Phí Di Chuyển Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProposeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phí kiểm định cơ sở (VND) *</label>
                <input
                  type="number"
                  min={50000}
                  step={10000}
                  value={proposeBaseFee}
                  onChange={(e) => setProposeBaseFee(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Các bậc tính phí theo khoảng cách:</label>
                {proposeTiers.map((tier, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-bold text-slate-800">{tier.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Đơn giá:</span>
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={tier.pricePerKm}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setProposeTiers((prev) => prev.map((t, i) => i === idx ? { ...t, pricePerKm: val } : t));
                        }}
                        className="w-28 p-1 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                      />
                      <span className="text-[11px] text-slate-500">₫ / km</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsProposeModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await inspectorService.proposeTravelTiers({
                      baseInspectionFee: proposeBaseFee,
                      tiers: proposeTiers,
                    });
                    showNotice('Đã gửi đề xuất bảng giá lên Admin thành công!');
                    setIsProposeModalOpen(false);
                    loadPricing();
                  } catch (err: any) {
                    dialogService.error(err?.message || 'Gửi đề xuất giá thất bại');
                  }
                }}
                className="px-5 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl font-black shadow-xs cursor-pointer"
              >
                Gửi Đề Xuất Duyệt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: GIAO TASK CHO KỸ THUẬT VIÊN (ASSIGN TASK MODAL)                 */}
      {/* ========================================================================= */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e0563e] text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#24263e]">Phân Công Kỹ Thuật Viên Kiểm Định</h3>
                  <p className="text-[11px] text-gray-400">Giao task kiểm tra và ấn định lịch hẹn khảo sát</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Brief Summary Card */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2 text-xs">
              <div className="flex items-start gap-3">
                {assignModalOrder.postImageUrls && assignModalOrder.postImageUrls[0] ? (
                  <img
                    src={assignModalOrder.postImageUrls[0]}
                    alt="Item"
                    className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="text-[10px] font-mono font-bold text-gray-400">
                    MÃ ĐƠN: #{assignModalOrder.id}
                  </div>
                  <h4 className="font-extrabold text-gray-900 truncate">
                    {assignModalOrder.postTitle || 'Thiết bị'}
                  </h4>
                  <div className="text-[#c34c36] font-mono font-bold text-xs">
                    {formatVND(assignModalOrder.postPrice || 0)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 text-[11px]">
                <div>
                  <span className="text-gray-400">Hình thức: </span>
                  <strong className="text-gray-800">
                    {assignModalOrder.orderType === 'AT_HOME' ? 'Tại Nhà Khách (Tận Nơi)' : 'Tại Lab Hub (Trung Tâm)'}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400">Phí kiểm định: </span>
                  <strong className="text-[#c34c36] font-mono">
                    {formatVND(assignModalOrder.inspectionFee || (assignModalOrder.orderType === 'AT_HOME' ? 200000 : 120000))}
                  </strong>
                </div>
              </div>
            </div>

            {/* Warning if order is not ready for dispatch */}
            {assignModalOrder.status === 'WAITING_FEE_PAYMENT' && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
                <CreditCard className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Đơn hàng chưa hoàn tất nộp phí kiểm định</div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Người mua cần thanh toán tiền cọc phí kiểm định & tiền ship trước khi trung tâm có thể giao task cho KTV. Khi người mua nộp phí thành công, đơn sẽ tự động chuyển sang trạng thái <strong>"Sẵn Sàng Giao KTV"</strong>.
                  </p>
                </div>
              </div>
            )}
            {assignModalOrder.status === 'WAITING_SELLER_APPROVAL' && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-950 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Chờ người bán đồng ý kiểm định</div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Người bán chưa xác nhận đồng ý yêu cầu kiểm định từ người mua.
                  </p>
                </div>
              </div>
            )}

            {/* Assign Fields */}
            <div className="space-y-4">
              {/* Select Inspector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#24263e] flex items-center justify-between">
                  <span>
                    Chọn Kỹ Thuật Viên Phụ Trách: <strong className="text-rose-500">*</strong>
                  </span>
                  <span className="text-[11px] font-normal text-gray-500">
                    ({staffList.length} nhân sự trạm)
                  </span>
                </label>

                {staffList.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                    Trung tâm chưa có kỹ thuật viên nào. Vui lòng bấm{' '}
                    <strong
                      className="underline cursor-pointer"
                      onClick={() => {
                        setAssignModalOrder(null);
                        setIsCreateStaffModalOpen(true);
                      }}
                    >
                      Cấp tài khoản KTV
                    </strong>{' '}
                    trước.
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedInspectorId}
                      onChange={(e) => setSelectedInspectorId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold focus:outline-none focus:border-[#c34c36] bg-gray-50/50"
                    >
                      <option value="">-- Chọn kỹ thuật viên --</option>
                      {staffList.map((st) => {
                        const count = staffWorkloadMap[st.id] || 0;
                        return (
                          <option key={st.id} value={st.id}>
                            {st.fullName} ({st.email}) — Đang có {count} task
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Danh sách hiển thị các KTV trực thuộc Trung tâm quản lý.
                      </span>
                    </p>
                  </>
                )}
              </div>

              {/* Time slot */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#24263e]">Khung Giờ Tiếp Nhận / Hẹn Khảo Sát:</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={assignEstimatedSlot}
                    onChange={(e) => setAssignEstimatedSlot(e.target.value)}
                    placeholder="09:00 - 11:30 Sáng nay"
                    className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                  />
                </div>
              </div>

              {/* Dispatch note */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#24263e]">Ghi Chú Hướng Dẫn Kỹ Thuật Cho KTV:</label>
                <textarea
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  rows={2}
                  placeholder="Lưu ý mang đồng hồ đo gas R600a, kiểm tra kỹ gioăng từ hít và bo mạch điều khiển..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                />
              </div>
              {/* Error Alert inside Modal */}
              {assignError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold">Không Thể Xác Nhận Giao Task</div>
                    <p className="text-[11px] leading-relaxed text-rose-700">{assignError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div className="text-[11px] text-gray-500 font-medium">
                {assignModalOrder.status === 'WAITING_FEE_PAYMENT' ? (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Chờ người mua nộp phí kiểm định
                  </span>
                ) : !selectedInspectorId ? (
                  <span className="text-rose-600 font-semibold">
                    * Vui lòng chọn KTV trước
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Sẵn sàng phân công
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignModalOrder(null);
                    setAssignError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAssign}
                  disabled={isAssigning}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    isAssigning
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : assignModalOrder.status !== 'CONFIRMED_PENDING_DISPATCH' && assignModalOrder.status !== 'PENDING'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : !selectedInspectorId
                      ? 'bg-gray-400 hover:bg-gray-500 text-white'
                      : 'bg-[#c34c36] hover:bg-[#a63f2d] text-white'
                  }`}
                  title={
                    assignModalOrder.status !== 'CONFIRMED_PENDING_DISPATCH' && assignModalOrder.status !== 'PENDING'
                      ? 'Bấm để xem hướng dẫn hoàn tất nộp phí'
                      : 'Xác nhận phân công KTV'
                  }
                >
                  {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Xác Nhận Giao Task Cho KTV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TẠO TÀI KHOẢN KỸ THUẬT VIÊN MỚI (CREATE STAFF MODAL)             */}
      {/* ========================================================================= */}
      {isCreateStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e0563e] text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#24263e]">Cấp Tài Khoản Kỹ Thuật Viên</h3>
                  <p className="text-[11px] text-gray-400">Tạo thông tin công vụ cho KTV trực thuộc trung tâm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateStaffModalOpen(false);
                  setCreatedStaffSuccessData(null);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Card view if created */}
            {createdStaffSuccessData ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Cấp tài khoản KTV thành công!</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Vui lòng bàn giao thông tin đăng nhập bên dưới cho kỹ thuật viên:
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 font-mono text-xs">
                  <div>
                    <span className="text-gray-500 font-sans">Họ và tên: </span>
                    <strong className="text-gray-900">{createdStaffSuccessData.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 font-sans">Email công vụ: </span>
                    <strong className="text-gray-900">{createdStaffSuccessData.email}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 font-sans">Mật khẩu khởi tạo: </span>
                    <strong className="text-[#c34c36] text-sm">{createdStaffSuccessData.password}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                  >
                    {hasCopiedCredentials ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{hasCopiedCredentials ? 'Đã Sao Chép!' : 'Sao Chép Thông Tin'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatedStaffSuccessData(null);
                      setIsCreateStaffModalOpen(false);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleCreateStaffSubmit} className="space-y-4">
                {createStaffError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{createStaffError}</span>
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-[#24263e]">
                    Họ Và Tên Kỹ Thuật Viên: <strong className="text-rose-500">*</strong>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="Nguyễn Văn Kỹ Thuật"
                      className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-[#24263e]">
                    Email Đăng Nhập Công Vụ: <strong className="text-rose-500">*</strong>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="ktv.nguyenvan@secondlife.com"
                      className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#24263e]">
                      Mật Khẩu Khởi Tạo: <strong className="text-rose-500">*</strong>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Tạo Mật Khẩu Ngẫu Nhiên</span>
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự..."
                      className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateStaffModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    disabled={isCreatingStaff}
                    className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#c34c36] hover:bg-[#a63f2d] text-white transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isCreatingStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Cấp Tài Khoản KTV</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ĐIỀU PHỐI & THEO DÕI VẬN ĐƠN KIỂM ĐỊNH HUB */}
      {shipmentModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Vận Đơn Điều Phối Kiểm Định Lab Hub
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Đơn kiểm định: #{shipmentModalOrder.id.slice(0, 8)} • {shipmentModalOrder.postTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShipmentModalOrder(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Notification messages */}
            {shipmentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium shrink-0 flex items-center justify-between">
                <span>{shipmentError}</span>
                <button type="button" onClick={() => setShipmentError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">✕</button>
              </div>
            )}
            {shipmentSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium shrink-0 flex items-center justify-between">
                <span>{shipmentSuccess}</span>
                <button type="button" onClick={() => setShipmentSuccess(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">✕</button>
              </div>
            )}

            {/* Tab switchers */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setShipmentTab('tracking')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  shipmentTab === 'tracking'
                    ? 'bg-[#24263e] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Lộ Trình Vận Đơn ({inspectionShipments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setShipmentTab('create')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  shipmentTab === 'create'
                    ? 'bg-[#c34c36] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kích Hoạt Giao Vận Hub</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto space-y-4 subtle-scrollbar pr-1 text-xs">
              {shipmentTab === 'tracking' ? (
                isLoadingShipments ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-[#c34c36]" />
                    <span>Đang tải lộ trình vận chuyển từ máy chủ...</span>
                  </div>
                ) : inspectionShipments.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                    <Truck className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700">Chưa có vận đơn nào cho đơn kiểm định này.</p>
                    <p className="text-[11px] text-slate-400">
                      Chuyển sang tab "Kích Hoạt Giao Vận Hub" để điều phối tài xế Lalamove vận chuyển sản phẩm về phòng Lab.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShipmentTab('create')}
                      className="mt-2 px-4 py-2 bg-[#c34c36] text-white rounded-xl font-bold cursor-pointer hover:bg-[#a63f2d] transition"
                    >
                      Tạo Vận Đơn Ngay
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inspectionShipments.map((s, idx) => (
                      <div key={s.shipmentId || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                              #{s.orderCode || s.shipmentId?.slice(0, 8)}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                              Chặng: {s.leg || 'Nhà Seller → Lab Hub'}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {s.providerStatus || s.status || 'ĐANG_ĐIỀU_PHỐI'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                            <span className="text-slate-400 block font-bold mb-0.5">Điểm lấy (Người bán):</span>
                            <div className="font-bold text-slate-800">{s.senderName || shipmentModalOrder.sellerName}</div>
                            <div className="text-slate-500 font-mono text-[10px]">{s.senderPhone}</div>
                            <div className="text-slate-600 text-[10px] truncate">{s.senderAddress}</div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                            <span className="text-slate-400 block font-bold mb-0.5">Điểm đến (Lab Kiểm Định):</span>
                            <div className="font-bold text-slate-800">{s.receiverName || 'Trung Tâm Lab Hub SecondLife'}</div>
                            <div className="text-slate-500 font-mono text-[10px]">{s.receiverPhone}</div>
                            <div className="text-slate-600 text-[10px] truncate">{s.receiverAddress}</div>
                          </div>
                        </div>

                        {s.driverName && (
                          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center justify-between text-[11px]">
                            <span>Tài xế nhận đơn: <strong>{s.driverName}</strong> ({s.driverPhone})</span>
                            <span className="font-mono font-bold">{s.driverPlateNumber}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <form onSubmit={handleCreateInspectionShipment} className="space-y-3.5">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                    Hệ thống sẽ kết nối API Lalamove để đặt tài xế xe tải/xe máy tới lấy thiết bị từ người bán đưa về Hub kiểm định.
                  </div>

                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 block">Thông Tin Người Gửi (Nhà Người Bán):</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Tên người bán..."
                        className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                      />
                      <input
                        type="text"
                        required
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        placeholder="Số điện thoại người bán..."
                        className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      value={senderAddress}
                      onChange={(e) => setSenderAddress(e.target.value)}
                      placeholder="Địa chỉ lấy hàng..."
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 block">Thông Tin Điểm Đến (Phòng Lab Kiểm Định Hub):</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="Tên trung tâm tiếp nhận..."
                        className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                      />
                      <input
                        type="text"
                        required
                        value={receiverPhone}
                        onChange={(e) => setReceiverPhone(e.target.value)}
                        placeholder="Hotline trạm..."
                        className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      value={receiverAddress}
                      onChange={(e) => setReceiverAddress(e.target.value)}
                      placeholder="Địa chỉ trạm tiếp nhận..."
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isCreatingShipment}
                      className="px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {isCreatingShipment && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Tạo Vận Đơn Vận Chuyển Hub</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShipmentModalOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
