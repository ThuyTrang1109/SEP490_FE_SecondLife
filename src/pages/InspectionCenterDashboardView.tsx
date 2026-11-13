import { ResizableSidebarControls } from '../components/common/ResizableSidebarControls';
import { usePanelTab, useBrowserLocation, navigatePath } from '../app/router/browser';
import { resolveAppRoute, panelPaths, paths } from '../app/router/paths';
import { saveScopedLocalNotification } from '../utils/notificationStorage';
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
  ChevronLeft,
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
  PackageCheck,
  CalendarCheck,
  CalendarSync,
  CreditCard,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import logoImg from '../assets/logo.png';
import { CenterReviewAppealModal } from '../components/inspection/CenterReviewAppealModal';
import { InspectionCenterProfileTab } from '../components/inspection/InspectionCenterProfileTab';
import { LalamoveProgress } from '../components/common/LalamoveProgress';
import { DigitalInspectionCertificateModal } from '../components/modals/DigitalInspectionCertificateModal';
import { InspectionReturnQuoteModal } from '../components/modals/InspectionReturnQuoteModal';
import { InspectionShift } from '../components/modals/ScheduleAppointmentModal';
import { InspectionCashShipmentStatus } from '../components/inspection/InspectionCashShipmentStatus';
import { CenterInspectionFees, CenterInspectionFeeStatus } from '../components/inspection/CenterInspectionFees';
import { CenterWalletTab } from '../components/inspection/CenterWalletTab';
import { getInspectionTaskStage } from '../utils/inspectionTaskStatus';
import { Language, UserProfile, EscrowOrder, CategoryBackend, ItemBackend, ShipmentBackend, CreateShipmentRequestDto, InspectionComplexityLevel, InspectionChecklistStatus, InspectionCenterProfile, UpdateInspectionCenterProfileRequest } from '../types';
import { formatVND } from '../utils/translations';
import { dialogService } from '../utils/dialogService';
import { translateSystemNotification } from '../utils/systemNotificationTranslator';
import { resolveInspectionCenter } from '../utils/orderUtils';
import { itemService } from '../services/itemService';
import { canBookHubBuyerDelivery, canReadCenterInspectionShipments, getCenterDispatchStage, getCenterTabDataNeeds, getHubBuyerShipmentLabel, getInboundShipmentProgress, getLatestInboundShipment, getLatestInspectionShipment, isPaidHubBuyerDelivery, shouldTrackCenterInspectionShipments, shouldTrackInboundShipment } from '../utils/inspectionCenterData';
import { getHubReturnProgress, getHubReturnState, getReturnReserveMessage, isCenterReturnEligible, isHubReturnCase, shouldSyncHubReturnOnOpen } from '../utils/inspectionCenterData';
import { centerFeeFilters, getCenterFeeCollection, isCenterFeeCollectionClosed, matchesCenterFeeFilter, type CenterFeeFilter } from '../utils/inspectionCenterFees';
import { loadCenterPricing } from '../services/inspectionCenterPricing';
import { ApiError, isUserIdle } from '../services/apiClient';
import { notifyInspectionCashConfirmed } from '../utils/inspectionCashShipping';
import {
  inspectorService,
  categoryService,
  shippingService,
  InspectionOrderDto,
  InspectionStaffDto,
  InspectionChecklistResponse,
  CreateChecklistTemplateRequest,
  InspectionTravelTierDto,
  InspectionFeeProposalResponse,
  InspectionFeeProposalStatus,
  canManageInspectionFee
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

export type CenterTab = 'overview' | 'dispatch' | 'staff' | 'orders' | 'checklists' | 'pricing' | 'appeals' | 'profile' | 'wallet';
type DispatchFilter = 'ALL' | NonNullable<ReturnType<typeof getCenterDispatchStage>>;

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

const APPLIANCE_PRESETS: AppliancePreset[] = [
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

const VALID_CENTER_TABS: CenterTab[] = [
  'overview',
  'dispatch',
  'staff',
  'orders',
  'checklists',
  'pricing',
  'appeals',
  'profile',
  'wallet',
];

const CENTER_TAB_STORAGE_KEY = 'secondlife_center_active_tab';
const INBOUND_SHIPMENT_REFRESH_MS = 30_000;
const INBOUND_SHIPMENT_CONCURRENCY = 3;

function getInitialCenterTab(): CenterTab {
  if (typeof window === 'undefined') return 'overview';
  return (resolveAppRoute(window.location.href, 'inspection_center').section || 'overview') as CenterTab;
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
  const [activeTab, setActiveTab] = usePanelTab<CenterTab>('inspection_center', 'overview');
  const { orders: needsOrders, staff: needsStaff } = getCenterTabDataNeeds(activeTab);
  const showOrderShipments = activeTab === 'orders';
  const ordersRequestRef = useRef(0);
  const loadingOrdersRef = useRef(false);
  const loadingShipmentsRef = useRef(false);

  // --- Sidebar Collapse & Mobile Sidebar State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
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
        } catch { }

        let appointmentScheduledAt = o.appointmentScheduledAt;
        let appointmentNote = o.appointmentNote;
        let appointmentStatus = (o as any).appointmentStatus;
        let counterScheduledAt = (o as any).counterScheduledAt;
        let counterShift = (o as any).counterShift;
        let counterNote = (o as any).counterNote;
        let appointmentRejectionReason = (o as any).appointmentRejectionReason;

        const apptPossibleIds = [o.id, (o as any).linkedOrderId, (o as any).orderId, (o as any).inspectionOrderId].filter(Boolean) as string[];
        for (const pid of apptPossibleIds) {
          try {
            const rawAppt = localStorage.getItem(`order_appointment_${pid}`);
            if (rawAppt) {
              const apptData = JSON.parse(rawAppt);
              appointmentScheduledAt = apptData.scheduledAt || appointmentScheduledAt;
              appointmentNote = apptData.note || appointmentNote;
              appointmentStatus = apptData.status || appointmentStatus;
              counterScheduledAt = apptData.counterScheduledAt || counterScheduledAt;
              counterShift = apptData.counterShift || counterShift;
              counterNote = apptData.counterNote || counterNote;
              break;
            }
          } catch { }
        }

        for (const pid of apptPossibleIds) {
          try {
            const rawRej = localStorage.getItem(`order_appointment_rejection_${pid}`);
            if (rawRej) {
              const rejData = JSON.parse(rawRej);
              if (rejData.reason) {
                appointmentRejectionReason = rejData.reason;
                break;
              }
            }
          } catch { }
        }

        if (counterScheduledAt) {
          appointmentStatus = 'COUNTERED_BY_CENTER';
        }

        const hasValidAssign = Boolean(assignedInspectorId && assignedInspectorName && assignedInspectorName !== 'Chưa phân công');
        if (hasValidAssign && !appointmentStatus) {
          appointmentStatus = 'CONFIRMED';
        } else if (!appointmentStatus && appointmentScheduledAt) {
          appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
        }

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
          sellerName: o.sellerName || o.seller?.fullName || 'Người bán',
          sellerEmail: o.sellerId ? `seller_${String(o.sellerId).slice(0, 6)}@gmail.com` : 'seller@secondlife.vn',
          sellerPhone: o.sellerPhone || o.seller?.phone,
          sellerAddress: o.sellerAddress || o.listing?.sellerAddress || o.listing?.location || o.shippingLegs?.[0]?.origin || o.address,
          inspectorId: hasValidAssign ? assignedInspectorId : undefined,
          inspectorName: hasValidAssign ? assignedInspectorName : undefined,
          orderType: (o.inspectionMethod === 'AT_HOME' || o.orderType === 'AT_HOME') ? 'AT_HOME' : 'AT_CENTER',
          feePayer: o.inspectionFeeSplit === 'SELLER_100' ? 'SELLER_PAYS' : o.inspectionFeeSplit === 'BUYER_100' ? 'BUYER_PAYS' : 'SPLIT_50_50',
          status: resolvedStatus,
          appointmentScheduledAt,
          appointmentNote,
          appointmentStatus,
          counterScheduledAt,
          counterShift,
          counterNote,
          appointmentRejectionReason,
          inspectionFee: o.inspectionFeeVnd || (o.inspectionMethod === 'AT_HOME' ? 200000 : 120000),
          createdAt: o.createdAt || new Date().toISOString(),
        };
      });
  }, [initialOrders]);

  // --- Orders State ---
  const [orders, setOrders] = useState<InspectionOrderDto[]>(fallbackOrders);
  const [centerOrderHistory, setCenterOrderHistory] = useState<{
    centerId: string;
    items: InspectionOrderDto[];
    total: number;
    refreshFailed?: boolean;
  } | null>(null);
  const [feeFilter, setFeeFilter] = useState<CenterFeeFilter | 'all'>('all');
  const [expandedFeeOrderId, setExpandedFeeOrderId] = useState<string | null>(null);
  const [trackedOrders, setTrackedOrders] = useState<InspectionOrderDto[]>([]);
  const [deniedShipmentOrders, setDeniedShipmentOrders] = useState<ReadonlySet<string>>(new Set());
  const [inboundShipments, setInboundShipments] = useState<ReadonlyMap<string, ShipmentBackend>>(new Map());
  const [buyerShipments, setBuyerShipments] = useState<ReadonlyMap<string, ShipmentBackend | null>>(new Map());
  const [bookingBuyerOrderId, setBookingBuyerOrderId] = useState<string | null>(null);
  const bookingBuyerOrderRef = useRef<string | null>(null);
  const buyerBookingVersion = useRef(0);
  const buyerBookingRequestIds = useRef(new Map<string, string>());
  const [hubReturns, setHubReturns] = useState<ReadonlyMap<string, ReturnType<typeof getHubReturnState>>>(new Map());
  const [bookingReturnId, setBookingReturnId] = useState<string | null>(null);
  const [returnQuoteOrder, setReturnQuoteOrder] = useState<InspectionOrderDto | null>(null);
  const returnBookingRef = useRef<string | null>(null);
  const returnBookingVersion = useRef(0);
  const returnRequestIds = useRef(new Map<string, string>());
  const [expandedInboundOrderId, setExpandedInboundOrderId] = useState<string | null>(null);
  const [expandedReturnOrderId, setExpandedReturnOrderId] = useState<string | null>(null);
  const [expandedBuyerOrderId, setExpandedBuyerOrderId] = useState<string | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const visibleOrderHistory = centerOrderHistory?.centerId === currentUser?.id ? centerOrderHistory : null;
  const orderHistoryRows = useMemo(() => (visibleOrderHistory?.items ?? []).map((order) => {
    const returnShipment = hubReturns.get(order.id)?.shipment;
    const isReturning = Boolean(returnShipment && returnShipment.status !== 'CANCELLED');
    const collectionClosed = isCenterFeeCollectionClosed(order.status) || isReturning;
    return { order, fees: getCenterFeeCollection(order), collectionClosed, isReturning };
  }).filter(({ fees, collectionClosed }) => feeFilter === 'all' || matchesCenterFeeFilter(fees, feeFilter, collectionClosed)),
    [visibleOrderHistory, hubReturns, feeFilter]);
  const [dispatchFilter, setDispatchFilter] = useState<DispatchFilter>('ALL');
  const [orderMethodFilter, setOrderMethodFilter] = useState<'ALL' | 'AT_CENTER' | 'AT_HOME'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // --- Staff State ---
  const [staffList, setStaffList] = useState<InspectionStaffDto[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  // --- Review / Negotiate Appointment Modal State ---
  const [reviewApptOrder, setReviewApptOrder] = useState<InspectionOrderDto | null>(null);
  const [reviewMode, setReviewMode] = useState<'VIEW' | 'COUNTER'>('VIEW');
  const [counterDate, setCounterDate] = useState<string>('');
  const [counterShift, setCounterShift] = useState<InspectionShift>('AFTERNOON');
  const [counterTime, setCounterTime] = useState<string>('14:00');
  const [counterNote, setCounterNote] = useState<string>('');
  const [counterError, setCounterError] = useState<string | null>(null);
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);

  // --- Assign Modal State ---
  const [assignModalOrder, setAssignModalOrder] = useState<InspectionOrderDto | null>(null);
  const [rejectApptModalOrder, setRejectApptModalOrder] = useState<InspectionOrderDto | null>(null);
  const [rejectApptReason, setRejectApptReason] = useState<string>('');
  const [rejectApptError, setRejectApptError] = useState<string | null>(null);
  const [isRejectingAppt, setIsRejectingAppt] = useState(false);
  const [certificateOrder, setCertificateOrder] = useState<InspectionOrderDto | null>(null);
  const [loadingCertificateId, setLoadingCertificateId] = useState<string | null>(null);
  const [reviewingAppealOrder, setReviewingAppealOrder] = useState<InspectionOrderDto | null>(null);
  const [appealFilter, setAppealFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'UPHELD' | 'OVERTURNED'>('ALL');
  const [appealSearchTerm, setAppealSearchTerm] = useState('');
  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('');
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

  // Helper: Kiểm tra đơn hàng kiểm định tại Hub đã được tiếp nhận kiện hàng thực tế tại trạm hay chưa
  const isOrderReceivedAtHub = (order: any): boolean => {
    if (!order) return false;
    if (order.orderType === 'AT_HOME') return true; // Đơn tại nhà không cần nhận hàng tại Hub
    const s = String(order.status || order.backendStatus || order.escrowStatus || '').toUpperCase();
    if (['RECEIVED_AT_CENTER', 'AWAITING_INSPECTION', 'INSPECTING', 'INSPECTION_IN_PROGRESS', 'PASSED', 'FAILED', 'COMPLETED', 'DELIVERING_TO_BUYER', 'SHIPPED_TO_BUYER'].includes(s)) {
      return true;
    }
    const shipment = inboundShipments.get(order.id);
    if (shipment && (shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED')) {
      return true;
    }
    if (typeof window !== 'undefined') {
      if (localStorage.getItem(`hub_package_received_${order.id}`) === 'true') {
        return true;
      }
    }
    return false;
  };

  const hasLocalShipmentSignal = (order: InspectionOrderDto | null): boolean => {
    if (!order || typeof window === 'undefined') return false;
    return localStorage.getItem(`seller_shipped_to_hub_${order.id}`) === 'true' ||
      localStorage.getItem(`order_ready_${order.id}`) === 'true';
  };

  // Handler: Xác nhận đã tiếp nhận kiện hàng thực tế tại Hub
  const handleReceivePackageAtHub = (orderId: string, orderTitle?: string) => {
    try {
      localStorage.setItem(`hub_package_received_${orderId}`, 'true');
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: o.inspectorId ? 'DISPATCHED' : 'CONFIRMED_PENDING_DISPATCH',
              backendStatus: 'CONFIRMED_PENDING_DISPATCH',
            };
          }
          return o;
        })
      );
      window.dispatchEvent(new CustomEvent('secondlife_hub_package_received', { detail: { orderId } }));
      showNotice(
        lang === 'vi'
          ? `Đã xác nhận tiếp nhận kiện hàng "${orderTitle || orderId.slice(0, 8)}" tại Hub thành công! Đơn hiện đã sẵn sàng giao task cho KTV.`
          : `Package received at Hub successfully! Ready to dispatch to technician.`
      );
    } catch (e) {
      console.warn('Lỗi khi tiếp nhận hàng tại Hub:', e);
    }
  };

  // --- API Fetch: Orders ---
  const loadOrders = async (background = false) => {
    const centerId = currentUser?.id;
    if (showOrderShipments && !centerId) return;
    if (background && (loadingOrdersRef.current || loadingShipmentsRef.current)) return;
    const requestId = ++ordersRequestRef.current;
    loadingOrdersRef.current = true;
    if (!background) setIsLoadingOrders(true);
    try {
      if (showOrderShipments && centerId) {
        const result = await inspectorService.getCenterOrderHistory(background ? { isBackground: true } : undefined);
        if (requestId !== ordersRequestRef.current) return;
        if (!Array.isArray(result?.items)) throw new Error('Invalid center orders response');
        setCenterOrderHistory({ centerId, items: result.items, total: result.totalElements });
        setOrders(result.items);
        setTrackedOrders(result.items.filter((order) => shouldTrackCenterInspectionShipments(order, centerId, currentUser?.role)));
        return;
      }

      let backendItems: InspectionOrderDto[] = [];
      try {
        const res = await inspectorService.getAllOrders(
          undefined,
          0,
          100,
          background ? { isBackground: true } : undefined,
        );
        const extracted = res?.items || (res as any)?.content || (Array.isArray(res) ? res : []);
        if (extracted && extracted.length > 0) {
          backendItems = extracted;
        }
      } catch (e) {
        if (background) return;
        console.warn('getAllOrders from backend error (falling back to storage/cache):', e);
      }

      if (requestId !== ordersRequestRef.current) return;

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
            } catch { }

            let appointmentScheduledAt = o.appointmentScheduledAt;
            let appointmentNote = o.appointmentNote;
            let appointmentStatus = (o as any).appointmentStatus;
            let counterScheduledAt = (o as any).counterScheduledAt;
            let counterShift = (o as any).counterShift;
            let counterNote = (o as any).counterNote;
            let appointmentRejectionReason = (o as any).appointmentRejectionReason;

            const apptPossibleIds = [o.id, (o as any).linkedOrderId, (o as any).orderId, (o as any).inspectionOrderId].filter(Boolean) as string[];
            for (const pid of apptPossibleIds) {
              try {
                const rawAppt = localStorage.getItem(`order_appointment_${pid}`);
                if (rawAppt) {
                  const apptData = JSON.parse(rawAppt);
                  appointmentScheduledAt = apptData.scheduledAt || appointmentScheduledAt;
                  appointmentNote = apptData.note || appointmentNote;
                  appointmentStatus = apptData.status || appointmentStatus;
                  counterScheduledAt = apptData.counterScheduledAt || counterScheduledAt;
                  counterShift = apptData.counterShift || counterShift;
                  counterNote = apptData.counterNote || counterNote;
                  break;
                }
              } catch { }
            }

            for (const pid of apptPossibleIds) {
              try {
                const rawRej = localStorage.getItem(`order_appointment_rejection_${pid}`);
                if (rawRej) {
                  const rejData = JSON.parse(rawRej);
                  if (rejData.reason) {
                    appointmentRejectionReason = rejData.reason;
                    break;
                  }
                }
              } catch { }
            }

            if (counterScheduledAt) {
              appointmentStatus = 'COUNTERED_BY_CENTER';
            }

            const hasValidAssign = Boolean(assignedInspectorId && assignedInspectorName && assignedInspectorName !== 'Chưa phân công');
            if (hasValidAssign && !appointmentStatus) {
              appointmentStatus = 'CONFIRMED';
            } else if (!appointmentStatus && appointmentScheduledAt) {
              appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
            }

            const savedStatus = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${o.id}`) : null;
            let resolvedStatus = savedStatus || o.status || o.escrowStatus || 'CONFIRMED_PENDING_DISPATCH';
            if (savedStatus === 'PASSED' || o.status === 'PASSED' || o.escrowStatus === 'INSPECTION_PASSED' || (o as any).backendStatus === 'PASSED') {
              resolvedStatus = 'PASSED';
            } else if (savedStatus === 'FAILED' || o.status === 'FAILED' || o.escrowStatus === 'INSPECTION_FAILED') {
              resolvedStatus = 'FAILED';
            } else if (!hasValidAssign && (resolvedStatus === 'AWAITING_INSPECTION' || o.backendStatus === 'CONFIRMED_PENDING_DISPATCH')) {
              resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
            } else if (hasValidAssign && (resolvedStatus === 'CONFIRMED_PENDING_DISPATCH' || resolvedStatus === 'WAITING_INSPECTION' || resolvedStatus === 'AWAITING_INSPECTION')) {
              resolvedStatus = 'DISPATCHED';
            }

            const realImg = (o as any).postImageUrl || (o as any).postImageUrls?.[0];
            const cleanFront = (o.listing?.photos?.front && !o.listing.photos.front.includes('photo-1584269600464') && !o.listing.photos.front.includes('photo-1555041469')) ? o.listing.photos.front : '';
            const fallbackFront = realImg || cleanFront || o.listing?.photos?.front || 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=400';
            const resolvedImageUrls = (o.postImageUrls && o.postImageUrls.length > 0)
              ? o.postImageUrls
              : (realImg ? [realImg] : (
                o.listing?.photos
                  ? [fallbackFront, o.listing.photos.back, o.listing.photos.screenOrDetails].filter(Boolean) as string[]
                  : (o.listing?.photoGallery || [fallbackFront])
              ));

            return {
              id: o.id,
              postId: o.listing?.id || o.listingId || o.id,
              postTitle: o.listing?.title || o.postTitle || 'Thiết bị gia dụng kiểm định',
              postPrice: o.listing?.priceVnd || o.totalPaidVnd || o.itemPriceVnd || o.amountVnd || 0,
              postImageUrls: resolvedImageUrls,
              buyerName: o.buyerName || 'Khách hàng',
              buyerEmail: o.buyerId ? `buyer_${String(o.buyerId).slice(0, 6)}@gmail.com` : 'buyer@secondlife.vn',
              sellerName: o.sellerName || o.seller?.fullName || 'Người bán',
              sellerEmail: o.sellerId ? `seller_${String(o.sellerId).slice(0, 6)}@gmail.com` : 'seller@secondlife.vn',
              sellerPhone: o.sellerPhone || o.seller?.phone,
              sellerAddress: o.sellerAddress || o.listing?.sellerAddress || o.listing?.location || o.shippingLegs?.[0]?.origin || o.address,
              inspectorId: hasValidAssign ? assignedInspectorId : undefined,
              inspectorName: hasValidAssign ? assignedInspectorName : undefined,
              orderType: (o.inspectionMethod === 'AT_HOME' || o.orderType === 'AT_HOME') ? 'AT_HOME' : 'AT_CENTER',
              feePayer: o.inspectionFeeSplit === 'SELLER_100' ? 'SELLER_PAYS' : o.inspectionFeeSplit === 'BUYER_100' ? 'BUYER_PAYS' : 'SPLIT_50_50',
              status: resolvedStatus,
              appointmentScheduledAt,
              appointmentNote,
              appointmentStatus,
              counterScheduledAt,
              counterShift,
              counterNote,
              appointmentRejectionReason,
              inspectionFee: o.inspectionFeeVnd || (o.inspectionMethod === 'AT_HOME' ? 200000 : 120000),
              createdAt: o.createdAt || new Date().toISOString(),
            };
          });
      } catch { }

      // Combine backendItems + localOrders + fallbackOrders
      const combinedMap = new Map<string, InspectionOrderDto>();
      [...fallbackOrders, ...localOrders, ...backendItems].forEach((ord) => {
        if (ord?.id) {
          let assignedInspectorId = ord.inspectorId;
          let assignedInspectorName = ord.inspectorName;
          if (!assignedInspectorId) {
            try {
              const rawAssign = localStorage.getItem(`order_assigned_inspector_${ord.id}`);
              if (rawAssign) {
                const assignData = JSON.parse(rawAssign);
                assignedInspectorId = assignData.inspectorId || assignedInspectorId;
                assignedInspectorName = assignData.inspectorName || assignedInspectorName;
              }
            } catch { }
          }

          const hasValidAssign = Boolean(assignedInspectorId);

          const savedInspectionStatus = typeof window !== 'undefined' ? localStorage.getItem(`inspection_status_${ord.id}`) : null;
          let resolvedStatus = savedInspectionStatus || ord.status;
          if ((ord.finalPaymentPaidAt && ord.linkedOrderId) || isHubReturnCase(ord)) {
            resolvedStatus = ord.status;
          } else if (savedInspectionStatus === 'PASSED' || ord.status === 'PASSED' || (ord as any).backendStatus === 'PASSED' || (ord as any).escrowStatus === 'INSPECTION_PASSED') {
            resolvedStatus = 'PASSED';
          } else if (savedInspectionStatus === 'FAILED' || ord.status === 'FAILED' || (ord as any).backendStatus === 'FAILED' || (ord as any).escrowStatus === 'INSPECTION_FAILED') {
            resolvedStatus = 'FAILED';
          } else if (!hasValidAssign && (resolvedStatus === 'AWAITING_INSPECTION' || (ord as any).backendStatus === 'CONFIRMED_PENDING_DISPATCH')) {
            resolvedStatus = 'CONFIRMED_PENDING_DISPATCH';
          } else if (hasValidAssign && (resolvedStatus === 'CONFIRMED_PENDING_DISPATCH' || resolvedStatus === 'WAITING_INSPECTION')) {
            resolvedStatus = 'DISPATCHED';
          }

          let appointmentScheduledAt = ord.appointmentScheduledAt;
          let appointmentNote = (ord as any).appointmentNote;
          let appointmentStatus = (ord as any).appointmentStatus;
          let counterScheduledAt = (ord as any).counterScheduledAt;
          let counterShift = (ord as any).counterShift;
          let counterNote = (ord as any).counterNote;
          let appointmentRejectionReason = (ord as any).appointmentRejectionReason;

          const apptPossibleIds = [ord.id, (ord as any).linkedOrderId, (ord as any).orderId, (ord as any).inspectionOrderId].filter(Boolean) as string[];
          for (const pid of apptPossibleIds) {
            try {
              const rawAppt = localStorage.getItem(`order_appointment_${pid}`);
              if (rawAppt) {
                const apptData = JSON.parse(rawAppt);
                appointmentScheduledAt = apptData.scheduledAt || appointmentScheduledAt;
                appointmentNote = apptData.note || appointmentNote;
                appointmentStatus = apptData.status || appointmentStatus;
                counterScheduledAt = apptData.counterScheduledAt || counterScheduledAt;
                counterShift = apptData.counterShift || counterShift;
                counterNote = apptData.counterNote || counterNote;
                break;
              }
            } catch { }
          }

          for (const pid of apptPossibleIds) {
            try {
              const rawRej = localStorage.getItem(`order_appointment_rejection_${pid}`);
              if (rawRej) {
                const rejData = JSON.parse(rawRej);
                if (rejData.reason) {
                  appointmentRejectionReason = rejData.reason;
                  break;
                }
              }
            } catch { }
          }

          if (counterScheduledAt) {
            appointmentStatus = 'COUNTERED_BY_CENTER';
          }

          if (hasValidAssign && !appointmentStatus) {
            appointmentStatus = 'CONFIRMED';
          } else if (!appointmentStatus && appointmentScheduledAt) {
            appointmentStatus = 'PENDING_CENTER_CONFIRMATION';
          }

          const existing = combinedMap.get(ord.id);
          const resolvedSellerAddress = ord.sellerAddress || existing?.sellerAddress || (ord as any).listing?.location || (ord as any).listing?.sellerAddress;
          const resolvedSellerPhone = ord.sellerPhone || existing?.sellerPhone;
          const resolvedSellerName = ord.sellerName || existing?.sellerName;

          combinedMap.set(ord.id, {
            ...ord,
            sellerAddress: resolvedSellerAddress,
            sellerPhone: resolvedSellerPhone,
            sellerName: resolvedSellerName,
            inspectorId: hasValidAssign ? assignedInspectorId : undefined,
            inspectorName: hasValidAssign ? assignedInspectorName : undefined,
            appointmentScheduledAt,
            appointmentNote,
            appointmentStatus,
            counterScheduledAt,
            counterShift,
            counterNote,
            appointmentRejectionReason,
            status: resolvedStatus
          });
        }
      });

      const finalOrders = Array.from(combinedMap.values());
      finalOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(finalOrders);
      // Only fetch shipments for actual orders returned by the center API.
      setTrackedOrders(backendItems.filter((order) => shouldTrackCenterInspectionShipments(order, currentUser?.id, currentUser?.role)));
    } catch (err: any) {
      if (requestId !== ordersRequestRef.current) return;
      if (showOrderShipments && centerId) {
        if (!background) setCenterOrderHistory((previous) => previous?.centerId === centerId
          ? { ...previous, refreshFailed: true }
          : { centerId, items: [], total: 0, refreshFailed: true });
        return;
      }
      console.warn('Lỗi tải danh sách đơn kiểm định từ backend, sử dụng dữ liệu trạm:', err);
      if (!background && fallbackOrders.length > 0) setOrders(fallbackOrders);
    } finally {
      if (requestId === ordersRequestRef.current) {
        loadingOrdersRef.current = false;
        if (!background) setIsLoadingOrders(false);
      }
    }
  };

  // --- API Fetch: Staff ---
  const loadStaff = async () => {
    setIsLoadingStaff(true);
    try {
      const data = await inspectorService.getStaff();
      let list = Array.isArray(data) ? [...data] : [];

      // Merge locally registered staff (nếu có đăng ký mới)
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
      } catch { }

      // Nếu Backend chưa có nhân sự nào (hệ thống mới / môi trường demo), dự phòng KTV mặc định
      if (list.length === 0) {
        const seededKtv1: InspectionStaffDto = {
          id: 'a50d1568-1111-4222-9333-7272a95473db',
          email: 'inspector@secondlife.com',
          fullName: 'Kiểm Định Viên 1 (KTV Trưởng)',
          phone: '0901234567',
          accountStatus: 'ACTIVE',
          assignedOrdersCount: 0,
          role: 'INSPECTOR',
        };
        list.push(seededKtv1);
      }

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
                } catch { }
                if (assignedId === st.id || (st.email && assignedId === st.email)) {
                  taskCount++;
                }
              });
            }
          }
        } catch { }
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
    if (needsStaff) loadStaff();
  }, [needsStaff]);

  useEffect(() => {
    if (needsOrders) loadOrders();

    const handleSignal = () => {
      if (needsOrders) loadOrders();
      if (needsStaff) loadStaff();
    };

    window.addEventListener('secondlife_order_placed_signal', handleSignal);
    window.addEventListener('secondlife_inspection_task_created', handleSignal);
    window.addEventListener('secondlife_order_assigned_signal', handleSignal);
    window.addEventListener('secondlife_inspection_completed', handleSignal);
    window.addEventListener('secondlife_hub_package_received', handleSignal);
    window.addEventListener('secondlife_seller_shipped_to_hub', handleSignal);
    window.addEventListener('secondlife_appointment_scheduled', handleSignal);
    window.addEventListener('secondlife_appointment_confirmed', handleSignal);
    window.addEventListener('secondlife_appointment_countered', handleSignal);

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'recent_placed_orders' ||
        e.key === 'center_inspection_orders' ||
        e.key === 'center_registered_staff' ||
        e.key?.startsWith('order_assigned_inspector_') ||
        e.key?.startsWith('order_appointment_') ||
        e.key?.startsWith('inspection_status_') ||
        e.key?.startsWith('hub_package_received_') ||
        e.key?.startsWith('seller_shipped_to_hub_')
      ) {
        handleSignal();
      }
    };
    window.addEventListener('storage', handleStorage);

    const refreshOrderTracking = () => {
      if (!document.hidden && !isUserIdle()) void loadOrders(true);
    };
    const trackingTimer = showOrderShipments
      ? window.setInterval(refreshOrderTracking, INBOUND_SHIPMENT_REFRESH_MS)
      : undefined;
    if (showOrderShipments) document.addEventListener('visibilitychange', refreshOrderTracking);

    return () => {
      window.removeEventListener('secondlife_order_placed_signal', handleSignal);
      window.removeEventListener('secondlife_inspection_task_created', handleSignal);
      window.removeEventListener('secondlife_order_assigned_signal', handleSignal);
      window.removeEventListener('secondlife_inspection_completed', handleSignal);
      window.removeEventListener('secondlife_hub_package_received', handleSignal);
      window.removeEventListener('secondlife_seller_shipped_to_hub', handleSignal);
      window.removeEventListener('secondlife_appointment_scheduled', handleSignal);
      window.removeEventListener('secondlife_appointment_confirmed', handleSignal);
      window.removeEventListener('secondlife_appointment_countered', handleSignal);
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(trackingTimer);
      document.removeEventListener('visibilitychange', refreshOrderTracking);
    };
  }, [needsOrders, needsStaff, showOrderShipments, activeTab === 'dispatch', currentUser?.id]);

  useEffect(() => {
    if (!showOrderShipments) return;

    const trackedIds = new Set(trackedOrders.map((order) => order.id));
    setInboundShipments((previous) => {
      const current = new Map([...previous].filter(([id]) => trackedIds.has(id)));
      return current.size === previous.size ? previous : current;
    });
    setBuyerShipments((previous) => {
      const current = new Map([...previous].filter(([id]) => trackedIds.has(id)));
      return current.size === previous.size ? previous : current;
    });
    setHubReturns((previous) => new Map([...previous].filter(([id]) => trackedIds.has(id))));
    if (trackedOrders.length === 0 || document.hidden || isUserIdle()) return;

    const controller = new AbortController();
    let nextIndex = 0;
    loadingShipmentsRef.current = true;

    const readShipments = async () => {
      while (!controller.signal.aborted && nextIndex < trackedOrders.length) {
        const order = trackedOrders[nextIndex++];
        const orderId = order.id;
        if (deniedShipmentOrders.has(orderId)) continue;
        const bookingVersion = buyerBookingVersion.current;
        const returnVersion = returnBookingVersion.current;
        const modalRequest = shipmentModalRequestRef.current;
        let shipments: ShipmentBackend[];
        try {
          shipments = await shippingService.getInspectionShipments(orderId, {
            signal: controller.signal,
            isBackground: true,
          });
        } catch (error) {
          // Preserve the last known status during transient errors.
          if (!(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) continue;
          if (!controller.signal.aborted) {
            if (error.status === 403) setDeniedShipmentOrders((previous) => new Set(previous).add(orderId));
            setHubReturns((previous) => {
              const current = new Map(previous);
              current.delete(orderId);
              return current;
            });
            setBuyerShipments((previous) => {
              const current = new Map(previous);
              current.delete(orderId);
              return current;
            });
            setInboundShipments((previous) => {
              const current = new Map(previous);
              current.delete(orderId);
              return current;
            });
          }
          continue;
        }
        if (controller.signal.aborted) return;

        if (isHubReturnCase(order) && returnVersion === returnBookingVersion.current) {
          setHubReturns((previous) => new Map(previous).set(orderId, getHubReturnState(shipments)));
          if (returnModalOrderIdRef.current === orderId && modalRequest === shipmentModalRequestRef.current) {
            setInspectionShipments(shipments.filter((shipment) => shipment.leg === 'CENTER_TO_SELLER'));
          }
        }

        const shipment = getLatestInboundShipment(shipments);
        if (isPaidHubBuyerDelivery(order) && bookingVersion === buyerBookingVersion.current) {
          const delivery = getLatestInspectionShipment(shipments, 'CENTER_TO_BUYER');
          setBuyerShipments((previous) => {
            const existing = previous.get(orderId);
            if (previous.has(orderId) && existing?.shipmentId === delivery?.shipmentId &&
              existing?.status === delivery?.status && existing?.providerStatus === delivery?.providerStatus &&
              existing?.orderCode === delivery?.orderCode) return previous;
            return new Map(previous).set(orderId, delivery);
          });
        }
        setInboundShipments((previous) => {
          const existing = previous.get(orderId);
          if (existing?.shipmentId === shipment?.shipmentId &&
            existing?.status === shipment?.status &&
            existing?.providerStatus === shipment?.providerStatus &&
            existing?.cashPayerId === shipment?.cashPayerId &&
            existing?.cashConfirmedAt === shipment?.cashConfirmedAt &&
            existing?.orderCode === shipment?.orderCode) return previous;

          const current = new Map(previous);
          if (shipment) current.set(orderId, shipment);
          else current.delete(orderId);
          return current;
        });
      }
    };

    void Promise.all(Array.from(
      { length: Math.min(INBOUND_SHIPMENT_CONCURRENCY, trackedOrders.length) },
      readShipments,
    )).finally(() => {
      if (!controller.signal.aborted) loadingShipmentsRef.current = false;
    });
    return () => {
      controller.abort();
      loadingShipmentsRef.current = false;
    };
    // A denied ID is skipped on the next polling round without restarting other reads in this one.
  }, [showOrderShipments, trackedOrders]);

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
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedComplexityLevel, setSelectedComplexityLevel] = useState<InspectionComplexityLevel>('L1');
  const [checklistTitle, setChecklistTitle] = useState('');
  const [checklistDesc, setChecklistDesc] = useState('');
  const [checklistItems, setChecklistItems] = useState<{
    id?: string;
    itemTitle: string;
    criteriaDescription: string;
    mandatory: boolean;
  }[]>([
    {
      itemTitle: 'Kiểm tra an toàn điện & tiếp địa',
      criteriaDescription: 'Dây dẫn nguyên vẹn, không hở điện, chống rò rỉ và có tiếp địa đạt chuẩn.',
      mandatory: true,
    },
    {
      itemTitle: 'Kiểm tra vận hành chức năng chính',
      criteriaDescription: 'Chạy thử tải thực tế các chế độ điều khiển và tính ổn định linh kiện công suất.',
      mandatory: true,
    },
    {
      itemTitle: 'Kiểm tra ngoại quan & ốc niêm phong',
      criteriaDescription: 'Soi dấu hiệu cạy mở trái phép, trầy xước vỏ và các chi tiết cơ khí.',
      mandatory: false,
    },
  ]);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // 4-Level Fees (L1-L4) State
  const [currentLevelFees, setCurrentLevelFees] = useState<InspectionFeeProposalResponse[]>([]);
  const [levelFeeProposals, setLevelFeeProposals] = useState<InspectionFeeProposalResponse[]>([]);

  // Helper: Kiểm tra cấp độ L1-L4 đã có đề xuất đang chờ Admin duyệt hay chưa (chặn gửi trùng lặp)
  const getPendingProposalForLevel = (level: InspectionComplexityLevel) => {
    const all = [...levelFeeProposals, ...tierProposals];
    return all.find(
      (p) =>
        p &&
        String(p.complexityLevel || '').toUpperCase() === String(level).toUpperCase() &&
        (String(p.status || '').toUpperCase() === 'PENDING_APPROVAL' ||
          String(p.status || '').toUpperCase() === 'PENDING')
    );
  };

  // Helper: Lấy biểu phí đã được Admin phê duyệt cho cấp độ tương ứng
  const getApprovedFeeForLevel = (level?: InspectionComplexityLevel | string) => {
    if (!level) return null;
    const lvl = String(level).toUpperCase();
    return (
      currentLevelFees.find(
        (f) =>
          String(f.complexityLevel || '').toUpperCase() === lvl &&
          (String(f.status || '').toUpperCase() === 'APPROVED' || !f.status) &&
          f.baseInspectionFee != null &&
          f.baseInspectionFee > 0
      ) || null
    );
  };

  // Helper: Kiểm tra cấp độ L1-L4 đã có biểu phí được Admin duyệt chính thức hay chưa (Phương án 1)
  const isLevelFeeApproved = (level?: InspectionComplexityLevel | string): boolean => {
    return Boolean(getApprovedFeeForLevel(level));
  };
  const [isProposeLevelFeeModalOpen, setIsProposeLevelFeeModalOpen] = useState(false);
  const [proposingLevel, setProposingLevel] = useState<InspectionComplexityLevel>('L1');
  const [proposingLevelFeeAmount, setProposingLevelFeeAmount] = useState<number | ''>(50000);
  const [proposingLevelFeeError, setProposingLevelFeeError] = useState<string | null>(null);
  const [isSubmittingLevelFee, setIsSubmittingLevelFee] = useState(false);

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

  // --- Center Profile State (GET /api/v1/inspector-center/profile) ---
  const [centerProfile, setCenterProfile] = useState<InspectionCenterProfile | null>(null);
  const [isLoadingCenterProfile, setIsLoadingCenterProfile] = useState(false);
  const [centerProfileError, setCenterProfileError] = useState<string | null>(null);

  const loadCenterProfile = async () => {
    setIsLoadingCenterProfile(true);
    setCenterProfileError(null);
    try {
      const res = await inspectorService.getCenterProfile();
      setCenterProfile(res);
      return res;
    } catch (err: any) {
      console.warn('Load center profile error:', err);
      setCenterProfileError(err?.message || 'Không thể tải thông tin hồ sơ trung tâm.');
    } finally {
      setIsLoadingCenterProfile(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'profile' || activeTab === 'overview') loadCenterProfile();
  }, [activeTab]);

  const handleProfileUpdated = (updated: InspectionCenterProfile) => {
    setCenterProfile(updated);
    showNotice('Đã cập nhật hồ sơ và địa chỉ tiếp nhận của trung tâm thành công!');
  };

  // Inspection Shipment Modal State (GET/POST /api/v1/inspection-orders/{inspectionId}/shipments)
  const [shipmentModalOrder, setShipmentModalOrder] = useState<InspectionOrderDto | null>(null);
  const returnModalOrderIdRef = useRef<string | null>(null);
  const shipmentModalRequestRef = useRef(0);
  const shipmentSyncRequests = useRef(new Map<string, Promise<ShipmentBackend>>());
  const [syncingShipments, setSyncingShipments] = useState<ReadonlySet<string>>(new Set());
  const [inspectionShipments, setInspectionShipments] = useState<ShipmentBackend[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [shipmentTab, setShipmentTab] = useState<'tracking' | 'create'>('tracking');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const initialCenter = resolveInspectionCenter();
  const [receiverName, setReceiverName] = useState(initialCenter.name);
  const [receiverPhone, setReceiverPhone] = useState(initialCenter.phone);
  const [receiverAddress, setReceiverAddress] = useState(initialCenter.address);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [shipmentSuccess, setShipmentSuccess] = useState<string | null>(null);
  const canCreateInboundInModal = shipmentModalOrder && canReadCenterInspectionShipments(shipmentModalOrder, currentUser?.id) &&
    shouldTrackInboundShipment(shipmentModalOrder);

  const handleBookReturn = async (order: InspectionOrderDto, maxReturnFee: number): Promise<string | null> => {
    const state = hubReturns.get(order.id);
    if (returnBookingRef.current || !isCenterReturnEligible(order, currentUser?.id, currentUser?.role) ||
      !state?.received || !canBookHubBuyerDelivery(state.shipment)) return 'Đơn hiện chưa sẵn sàng để đặt chuyến trả.';

    returnBookingRef.current = order.id;
    setBookingReturnId(order.id);
    try {
      const key = `hub_return_request_${order.id}_${state.shipment?.shipmentId || 'first'}`;
      let requestId = returnRequestIds.current.get(key);
      if (!requestId) {
        try { requestId = localStorage.getItem(key) || undefined; } catch { }
        requestId ||= crypto.randomUUID();
        returnRequestIds.current.set(key, requestId);
        try { localStorage.setItem(key, requestId); } catch { }
      }

      returnBookingVersion.current++;
      try {
        const shipment = await shippingService.createInspectionShipment(order.id, { requestId, leg: 'CENTER_TO_SELLER', maxReturnFee });
        setHubReturns((previous) => new Map(previous).set(order.id, { received: true, shipment }));
        if (['CANCELLED', 'FAILED'].includes(shipment.status)) {
          return shipment.lastError || getHubReturnProgress(shipment).label;
        }
        setReturnQuoteOrder(null);
        showNotice(getHubReturnProgress(shipment).label);
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không tạo được vận đơn trả người bán.';
        return error instanceof ApiError && error.status === 403
          ? 'Trung tâm không phụ trách đơn hoặc tài khoản thiếu quyền.'
          : error instanceof ApiError && error.status === 409 && /vượt.*dự phòng/i.test(message)
            ? 'Cước chiều về vượt khoản dự phòng đã thu, cần xử lý chênh lệch trước khi đặt chuyến.'
            : message;
      } finally {
        try {
          const shipments = await shippingService.getInspectionShipments(order.id);
          try {
            if (Array.isArray(shipments) && shipments.length > 0) {
              localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(shipments));
              localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(shipments));
            }
          } catch { }
          returnBookingVersion.current++;
          setHubReturns((previous) => new Map(previous).set(order.id, getHubReturnState(shipments)));
        } catch { }
        await loadOrders(true);
      }
    } finally {
      returnBookingRef.current = null;
      setBookingReturnId(null);
    }
  };

  const handleBookBuyerDelivery = async (order: InspectionOrderDto) => {
    const previousShipment = buyerShipments.get(order.id);
    if (bookingBuyerOrderRef.current || !isPaidHubBuyerDelivery(order) || !canBookHubBuyerDelivery(previousShipment)) return;
    bookingBuyerOrderRef.current = order.id;
    setBookingBuyerOrderId(order.id);
    try {
      const confirmed = await dialogService.confirm(
        `Tạo vận đơn Lalamove giao “${order.postTitle || 'sản phẩm'}” từ Hub đến ${order.buyerName || 'người mua'} theo báo giá đã thanh toán?`,
        { title: 'Giao hàng từ Hub đến người mua', confirmText: 'Tạo vận đơn' },
      );
      if (!confirmed) return;

      // Keep the same request ID if a submission needs to be retried.
      const key = `hub_delivery_request_${order.id}_${previousShipment?.shipmentId || 'first'}`;
      let requestId = buyerBookingRequestIds.current.get(key);
      if (!requestId) {
        try { requestId = sessionStorage.getItem(key) || undefined; } catch { }
        requestId ||= crypto.randomUUID();
        buyerBookingRequestIds.current.set(key, requestId);
        try { sessionStorage.setItem(key, requestId); } catch { }
      }

      const shipment = await shippingService.createInspectionShipment(order.id, {
        requestId,
        leg: 'CENTER_TO_BUYER',
      });
      buyerBookingVersion.current++;
      setBuyerShipments((previous) => new Map(previous).set(order.id, shipment));
      try {
        const raw = localStorage.getItem(`sl_order_shipments_${order.id}`) || localStorage.getItem(`order_shipments_${order.id}`);
        const parsed = raw ? JSON.parse(raw) : [];
        const updated = Array.isArray(parsed) ? [shipment, ...parsed.filter((s: any) => s.shipmentId !== shipment.shipmentId)] : [shipment];
        localStorage.setItem(`sl_order_shipments_${order.id}`, JSON.stringify(updated));
        localStorage.setItem(`order_shipments_${order.id}`, JSON.stringify(updated));
      } catch { }
      showNotice(shipment.orderCode
        ? `Đã tạo vận đơn giao người mua #${shipment.orderCode}`
        : getHubBuyerShipmentLabel(shipment));
    } catch (error) {
      void dialogService.error(error instanceof Error ? error.message : 'Không tạo được vận đơn giao người mua.');
    } finally {
      bookingBuyerOrderRef.current = null;
      setBookingBuyerOrderId(null);
    }
  };

  const updateAddressesForLeg = (
    ord: InspectionOrderDto,
    profile = centerProfile
  ) => {
    // Lấy chính xác thông tin vị trí trung tâm kiểm định của đơn hàng hoặc tài khoản quản lý (không hardcode)
    const center = resolveInspectionCenter({
      ...ord,
      inspectionCenterName: (currentUser as any)?.centerName || currentUser?.name || (ord as any).inspectionCenterName,
      inspectionCenterAddress: (currentUser as any)?.address || (ord as any).inspectionCenterAddress,
      inspectionCenterPhone: (currentUser as any)?.phone || (ord as any).inspectionCenterPhone,
    });
    const assignedProfile = profile && (!ord.inspectionCenterId || ord.inspectionCenterId === profile.id)
      ? profile
      : null;
    const hubName = assignedProfile?.name || center.name;
    const hubPhone = assignedProfile?.phone || center.phone;
    const hubAddress = assignedProfile?.address || center.address;

    const sName = ord.sellerName || 'Người bán';
    const sPhone = (ord as any).sellerPhone || (ord as any).phone || '0912345678';
    const sAddress = (ord as any).sellerAddress || (ord as any).address || (ord as any).location || 'Địa chỉ kho người bán';

    setSenderName(sName);
    setSenderPhone(sPhone);
    setSenderAddress(sAddress);
    setReceiverName(hubName);
    setReceiverPhone(hubPhone);
    setReceiverAddress(hubAddress);
  };

  const handleSyncCenterShipment = async (orderId: string, shipment: ShipmentBackend, modalRequest: number) => {
    const shipmentId = shipment.shipmentId;
    if (!shipment.orderCode || !shipmentId) return;
    let pending = shipmentSyncRequests.current.get(shipmentId);
    if (!pending) {
      setSyncingShipments((previous) => new Set(previous).add(shipmentId));
      pending = shippingService.syncShipment(shipmentId).then((synced) => {
        if (synced?.shipmentId !== shipmentId) throw new Error('Máy chủ chưa trả về vận đơn đã đồng bộ.');

        if (shipment.leg === 'CENTER_TO_SELLER') {
          if (!shipment.cashConfirmedAt && synced.cashConfirmedAt) notifyInspectionCashConfirmed();
          returnBookingVersion.current++;
          setHubReturns((previous) => {
            const state = previous.get(orderId);
            return state?.shipment?.shipmentId === shipmentId
              ? new Map(previous).set(orderId, { ...state, shipment: synced }) : previous;
          });
          if (synced.status === 'DELIVERED') void loadOrders(true);
        } else if (shipment.leg === 'CENTER_TO_BUYER') {
          buyerBookingVersion.current++;
          setBuyerShipments((previous) => previous.get(orderId)?.shipmentId === shipmentId
            ? new Map(previous).set(orderId, synced) : previous);
        } else if (shipment.leg === 'SELLER_TO_CENTER') {
          setInboundShipments((previous) => previous.get(orderId)?.shipmentId === shipmentId
            ? new Map(previous).set(orderId, synced) : previous);
        }
        return synced;
      }).finally(() => {
        shipmentSyncRequests.current.delete(shipmentId);
        setSyncingShipments((previous) => {
          const next = new Set(previous);
          next.delete(shipmentId);
          return next;
        });
      });
      shipmentSyncRequests.current.set(shipmentId, pending);
    }

    setShipmentError(null);
    setShipmentSuccess(null);
    try {
      const synced = await pending;
      if (modalRequest !== shipmentModalRequestRef.current) return;
      setInspectionShipments((previous) => previous.map((item) => item.shipmentId === shipmentId ? { ...item, ...synced } : item));
      setShipmentSuccess(shipment.leg === 'CENTER_TO_SELLER'
        ? `Đã đồng bộ Lalamove · ${getHubReturnProgress(synced).label}` : 'Đã đồng bộ trạng thái từ Lalamove.');
    } catch (error) {
      if (modalRequest !== shipmentModalRequestRef.current) return;
      const reason = error instanceof Error ? error.message : '';
      setShipmentError(reason ? `Không đồng bộ được vận đơn Lalamove. ${reason}` : 'Không đồng bộ được vận đơn Lalamove.');
    }
  };

  const closeShipmentModal = () => {
    returnModalOrderIdRef.current = null;
    shipmentModalRequestRef.current++;
    setShipmentModalOrder(null);
  };

  const handleOpenShipmentModal = async (ord: InspectionOrderDto) => {
    const request = ++shipmentModalRequestRef.current;
    const returnDelivery = isHubReturnCase(ord);
    returnModalOrderIdRef.current = null;
    setShipmentModalOrder(ord);
    setInspectionShipments([]);
    setShipmentTab('tracking');
    setShipmentError(null);
    setShipmentSuccess(null);

    if (!canReadCenterInspectionShipments(ord, currentUser?.id)) {
      setShipmentError('Trung tâm chưa có quyền xem vận đơn của đơn kiểm định này.');
      setIsLoadingShipments(false);
      return;
    }

    if (returnDelivery) returnModalOrderIdRef.current = ord.id;
    const buyerDelivery = isPaidHubBuyerDelivery(ord);
    if (!returnDelivery && !buyerDelivery) updateAddressesForLeg(ord);
    setIsLoadingShipments(true);
    try {
      const [list, profile] = await Promise.all([
        shippingService.getInspectionShipments(ord.id),
        returnDelivery || buyerDelivery || centerProfile ? Promise.resolve(centerProfile) : loadCenterProfile(),
      ]);
      if (request !== shipmentModalRequestRef.current) return;
      if (returnDelivery || buyerDelivery) {
        const leg = returnDelivery ? 'CENTER_TO_SELLER' : 'CENTER_TO_BUYER';
        setInspectionShipments(list.filter((shipment) => shipment.leg === leg));
        if (returnDelivery) {
          const returnState = getHubReturnState(list);
          setHubReturns((previous) => new Map(previous).set(ord.id, returnState));
          if (shouldSyncHubReturnOnOpen(returnState.shipment)) {
            void handleSyncCenterShipment(ord.id, returnState.shipment, request);
          }
        }
      } else {
        if (profile) updateAddressesForLeg(ord, profile);
        const inbound = list.filter((shipment) => shipment.leg === 'SELLER_TO_CENTER');
        setInspectionShipments(inbound);
        setShipmentTab(inbound.length === 0 && shouldTrackInboundShipment(ord) ? 'create' : 'tracking');
      }
    } catch (error) {
      if (request === shipmentModalRequestRef.current) setShipmentError(error instanceof Error ? error.message : 'Không tải được vận đơn kiểm định.');
    } finally {
      if (request === shipmentModalRequestRef.current) setIsLoadingShipments(false);
    }
  };

  const handleCreateInspectionShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentModalOrder || !canCreateInboundInModal) return;
    setIsCreatingShipment(true);
    setShipmentError(null);
    setShipmentSuccess(null);

    const cleanPhone = (p: string, def: string) => {
      const d = (p || '').replace(/\D/g, '');
      if (/^(?:0|84)\d{9,10}$/.test(d)) return d.startsWith('84') ? '0' + d.slice(2) : d;
      return def;
    };

    const sName = senderName.trim() || 'Người gửi';
    const sPhone = cleanPhone(senderPhone, '0912345678');
    const rName = receiverName.trim() || 'Người nhận';
    const rPhone = cleanPhone(receiverPhone, '0908123456');

    const assignedProfile = centerProfile &&
      (!shipmentModalOrder.inspectionCenterId || shipmentModalOrder.inspectionCenterId === centerProfile.id)
      ? centerProfile : null;
    const hubCoords = assignedProfile?.latitude != null && assignedProfile?.longitude != null
      ? { latitude: assignedProfile.latitude, longitude: assignedProfile.longitude }
      : { latitude: 10.8415, longitude: 106.8098 };
    const payload: CreateShipmentRequestDto = {
      requestId: crypto.randomUUID(),
      leg: 'SELLER_TO_CENTER',
      fromAddress: { name: sName, phone: sPhone, latitude: 10.7769, longitude: 106.7009 },
      toAddress: { name: rName, phone: rPhone, ...hubCoords },
      reason: 'Điều phối vận đơn Hub: SELLER_TO_CENTER',
    };

    try {
      const created = await shippingService.createInspectionShipment(shipmentModalOrder.id, payload);
      setInspectionShipments((previous) => [created, ...previous.filter((item) => item.shipmentId !== created.shipmentId)]);
      setShipmentTab('tracking');
      if (created.lastError) setShipmentError(created.lastError);
      else if (created.orderCode && created.status !== 'CANCELLED') setShipmentSuccess(`Đã tạo vận đơn #${created.orderCode}`);
      else setShipmentSuccess(getInboundShipmentProgress(created).label);
    } catch (error) {
      setShipmentError(error instanceof Error ? error.message : 'Không thể tạo vận đơn kiểm định.');
    } finally {
      setIsCreatingShipment(false);
    }
  };

  // Pricing & Travel Tiers State
  const [travelTiers, setTravelTiers] = useState<InspectionTravelTierDto[]>([]);
  const [tierProposals, setTierProposals] = useState<InspectionFeeProposalResponse[]>([]);
  const [pricingProposalFilter, setPricingProposalFilter] = useState<'ALL' | InspectionFeeProposalStatus>('ALL');
  const [pricingProposalPage, setPricingProposalPage] = useState<number>(0);
  const [pricingProposalTotalPages, setPricingProposalTotalPages] = useState<number>(1);
  const [pricingProposalTotalElements, setPricingProposalTotalElements] = useState<number>(0);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const pricingRequestRef = useRef(0);
  const [selectedProposalDetail, setSelectedProposalDetail] = useState<InspectionFeeProposalResponse | null>(null);

  // Propose Fee Modal State (2-step wizard)
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [proposeStep, setProposeStep] = useState<'edit' | 'preview'>('edit');
  const [proposeCategoryId, setProposeCategoryId] = useState<string>('');
  const [proposeBaseFee, setProposeBaseFee] = useState<number>(250000);
  const [proposeTiers, setProposeTiers] = useState<InspectionTravelTierDto[]>([]);
  const [proposeValidationError, setProposeValidationError] = useState<string | null>(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

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
    setSelectedItemId('');
    setSelectedComplexityLevel('L1');
    setChecklistTitle('');
    setChecklistDesc('');
    setChecklistItems([
      {
        itemTitle: 'Kiểm tra an toàn điện & tiếp địa',
        criteriaDescription: 'Dây dẫn nguyên vẹn, không hở điện, chống rò rỉ và có tiếp địa đạt chuẩn.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra vận hành chức năng chính',
        criteriaDescription: 'Chạy thử tải thực tế các chế độ điều khiển và tính ổn định linh kiện công suất.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra ngoại quan & ốc niêm phong',
        criteriaDescription: 'Soi dấu hiệu cạy mở trái phép, trầy xước vỏ và các chi tiết cơ khí.',
        mandatory: false,
      },
    ]);
  };

  const handleOpenCreateModal = (presetKey?: string) => {
    resetChecklistForm();
    const firstApproved = (['L1', 'L2', 'L3', 'L4'] as InspectionComplexityLevel[]).find((lvl) =>
      isLevelFeeApproved(lvl)
    );
    if (firstApproved) {
      setSelectedComplexityLevel(firstApproved);
    }
    if (presetKey) {
      const preset = APPLIANCE_PRESETS.find(p => p.key === presetKey);
      if (preset) {
        handleApplyPreset(preset);
      }
    }
    setIsChecklistModalOpen(true);
  };

  // Nhóm các Item đã có checklist được Admin duyệt (approvalStatus === 'APPROVED' và active === true) theo complexityLevel (L1–L4)
  const approvedItemsByLevel = useMemo(() => {
    const map: Record<InspectionComplexityLevel, { itemId: string; itemName: string; checklistTitle?: string }[]> = {
      L1: [],
      L2: [],
      L3: [],
      L4: [],
    };

    const seenItemIds = new Set<string>();

    checklists
      .filter((chk) => {
        const isApproved = String(chk.approvalStatus || '').toUpperCase() === 'APPROVED';
        const isActive = chk.active === true || (chk as any).isActive === true || (chk.active !== false && isApproved);
        return isApproved && isActive && chk.complexityLevel;
      })
      .forEach((chk) => {
        const lvl = chk.complexityLevel as InspectionComplexityLevel;
        if (map[lvl]) {
          const matchedItem = catalogItems.find((it) => it.id === chk.itemId);
          const name = chk.itemName || matchedItem?.name || chk.title;
          const itemId = chk.itemId || matchedItem?.id || chk.id;
          if (itemId && !seenItemIds.has(itemId)) {
            seenItemIds.add(itemId);
            map[lvl].push({
              itemId,
              itemName: name,
              checklistTitle: chk.title,
            });
          }
        }
      });

    return map;
  }, [checklists, catalogItems]);

  // Danh sách Item (loại sản phẩm) chưa được phân cấp L1–L4 (chưa có checklist nào được APPROVED & active)
  const unclassifiedItems = useMemo(() => {
    const approvedItemIds = new Set(
      checklists
        .filter((chk) => {
          const isApproved = String(chk.approvalStatus || '').toUpperCase() === 'APPROVED';
          const isActive = chk.active === true || (chk as any).isActive === true || (chk.active !== false && isApproved);
          return isApproved && isActive && chk.itemId;
        })
        .map((chk) => chk.itemId)
    );

    return catalogItems
      .filter((itm) => itm.selectable !== false)
      .map((itm) => {
        const cat = categories.find((c) => c.id === itm.categoryId);
        const pendingChecklist = checklists.find(
          (c) => c.itemId === itm.id && String(c.approvalStatus || '').toUpperCase() === 'PENDING_APPROVAL'
        );
        return {
          ...itm,
          categoryName: cat?.name || 'Gia dụng',
          isApproved: approvedItemIds.has(itm.id),
          pendingChecklist,
        };
      })
      .filter((itm) => !itm.isApproved);
  }, [catalogItems, checklists, categories]);

  // Mở modal tạo / cấu hình checklist cho Item cụ thể hoặc theo Level
  const handleOpenCreateChecklistForItem = (item?: ItemBackend, level?: InspectionComplexityLevel) => {
    if (categories.length === 0 || catalogItems.length === 0) {
      loadCategoriesAndItems();
    }
    resetChecklistForm();

    // Xác định cấp độ ưu tiên: cấp truyền vào nếu đã duyệt giá, hoặc cấp hợp lệ đầu tiên đã có giá duyệt
    let targetLevel = level;
    if (!targetLevel || !isLevelFeeApproved(targetLevel)) {
      const firstApproved = (['L1', 'L2', 'L3', 'L4'] as InspectionComplexityLevel[]).find((lvl) =>
        isLevelFeeApproved(lvl)
      );
      targetLevel = firstApproved || level || 'L1';
    }

    if (item) {
      setSelectedCategoryId(item.categoryId || '');
      setSelectedItemId(item.id || '');
      setChecklistTitle(`Bộ tiêu chuẩn kiểm định ${item.name}`);
      setChecklistDesc(`Quy chuẩn kiểm tra kỹ thuật an toàn và chức năng cho thiết bị ${item.name}. Đề xuất áp dụng cấp độ ${targetLevel}.`);
    }
    setSelectedComplexityLevel(targetLevel);
    setIsChecklistModalOpen(true);
  };

  const handleOpenEditModal = (chk: InspectionChecklistResponse) => {
    setEditingChecklistId(chk.id);
    setSelectedCategoryId(chk.categoryId || '');
    setSelectedProductId('');
    setSelectedItemId(chk.itemId || '');
    setSelectedComplexityLevel(chk.complexityLevel || 'L1');
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
    setSelectedItemId(chk.itemId || '');
    setSelectedComplexityLevel(chk.complexityLevel || 'L1');
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
    if (!selectedItemId) {
      await dialogService.warning(lang === 'vi' ? 'Vui lòng chọn loại thiết bị cụ thể (Item) cần lập bộ tiêu chuẩn' : 'Please select specific item');
      return;
    }

    // Kiểm tra và chặn đề xuất nếu cấp độ chưa có mức phí kiểm định được Admin duyệt (Phương án 1)
    if (!isLevelFeeApproved(selectedComplexityLevel)) {
      const pendingProp = getPendingProposalForLevel(selectedComplexityLevel);
      await dialogService.warning(
        lang === 'vi'
          ? `Cấp độ ${selectedComplexityLevel} hiện chưa có mức phí kiểm định được Admin phê duyệt ${pendingProp ? '(hiện đang có đề xuất giá chờ Admin xét duyệt)' : '(chưa có đề xuất giá)'
          }. Theo quy định hệ thống, trung tâm chỉ được lập và gửi đề xuất bộ tiêu chuẩn cho các cấp độ đã có biểu phí được Admin duyệt chính thức.`
          : `Complexity level ${selectedComplexityLevel} does not have an approved fee yet. Please wait for fee approval before submitting checklists.`
      );
      return;
    }

    // Chặn gửi trùng lặp nếu thiết bị này đã có đề xuất tiêu chuẩn đang chờ Admin duyệt
    const existingPendingChk = checklists.find(
      c => c.itemId === selectedItemId && (c.approvalStatus === 'PENDING_APPROVAL' || (c as any).status === 'PENDING_APPROVAL') && c.id !== editingChecklistId
    );
    if (existingPendingChk) {
      await dialogService.warning(
        lang === 'vi'
          ? `Thiết bị này hiện đã có bộ tiêu chuẩn "${existingPendingChk.title}" (v${existingPendingChk.revision || 1}) đang ở trạng thái CHỜ DUYỆT. Vui lòng chờ Admin xử trị hoặc rút đề xuất cũ trước khi tạo đề xuất mới.`
          : 'A proposal for this item is already pending approval.'
      );
      return;
    }
    if (!checklistTitle.trim()) {
      await dialogService.warning(lang === 'vi' ? 'Vui lòng nhập tên bộ tiêu chuẩn kiểm định' : 'Please enter checklist title');
      return;
    }
    if (checklistTitle.trim().length > 200) {
      await dialogService.warning(lang === 'vi' ? 'Tên bộ tiêu chuẩn không được vượt quá 200 ký tự' : 'Title cannot exceed 200 chars');
      return;
    }
    if (checklistDesc.trim().length > 10000) {
      await dialogService.warning(lang === 'vi' ? 'Mô tả căn cứ kỹ thuật không được vượt quá 10.000 ký tự' : 'Description cannot exceed 10000 chars');
      return;
    }
    const validItems = checklistItems.filter(i => i.itemTitle.trim());
    if (validItems.length === 0) {
      await dialogService.warning(lang === 'vi' ? 'Vui lòng thêm ít nhất một hạng mục kiểm định (1-100 tiêu chí)' : 'Please add at least one criteria item');
      return;
    }
    if (validItems.length > 100) {
      await dialogService.warning(lang === 'vi' ? 'Số lượng tiêu chí kiểm định không được vượt quá 100 tiêu chí' : 'Max 100 criteria');
      return;
    }
    const hasMandatory = validItems.some(i => i.mandatory);
    if (!hasMandatory) {
      await dialogService.warning(lang === 'vi' ? 'Phải có ít nhất một tiêu chí bắt buộc (Mandatory) trong bộ tiêu chuẩn' : 'At least one mandatory criterion is required');
      return;
    }
    const titles = validItems.map(i => i.itemTitle.trim().toLowerCase());
    const uniqueTitles = new Set(titles);
    if (uniqueTitles.size < titles.length) {
      await dialogService.warning(lang === 'vi' ? 'Tên các tiêu chí kiểm định không được trùng lặp' : 'Criteria titles must be unique');
      return;
    }

    setIsSavingChecklist(true);
    try {
      const selectedCat = categories.find(c => c.id === selectedCategoryId);
      const payload: CreateChecklistTemplateRequest = {
        itemId: selectedItemId,
        complexityLevel: selectedComplexityLevel,
        title: checklistTitle.trim(),
        description: checklistDesc.trim() || undefined,
        categoryId: selectedCategoryId || undefined,
        categoryName: selectedCat ? selectedCat.name : undefined,
        items: validItems.map((it, idx) => ({
          itemTitle: it.itemTitle.trim().slice(0, 255),
          criteriaDescription: (it.criteriaDescription || '').trim().slice(0, 4000) || undefined,
          mandatory: Boolean(it.mandatory),
          orderIndex: idx + 1,
        })),
      };

      if (editingChecklistId) {
        const updated = await inspectorService.updateChecklist(editingChecklistId, payload);
        showNotice(lang === 'vi' ? `Đã tạo phiên bản đề xuất mới cho bộ tiêu chuẩn "${checklistTitle}" (v${updated.revision || 2})!` : `New revision submitted!`);
      } else {
        await inspectorService.createChecklist(payload);
        showNotice(lang === 'vi' ? `Đã gửi đề xuất bộ tiêu chuẩn "${checklistTitle}" thành công! Đang chờ Admin duyệt.` : `Checklist proposal created!`);
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
    if (chk.approvalStatus === 'APPROVED' || chk.approvalStatus === 'LEGACY') {
      await dialogService.warning(lang === 'vi' ? 'Không thể rút hoặc xóa bộ tiêu chuẩn đã được duyệt (APPROVED) hoặc thuộc phiên bản cũ (LEGACY).' : 'Cannot withdraw approved or legacy checklist');
      return;
    }

    const confirmed = await dialogService.confirm(
      lang === 'vi' ? `Bạn có chắc muốn rút đề xuất bộ tiêu chuẩn "${chk.title}"?` : `Withdraw proposal "${chk.title}"?`,
      { title: lang === 'vi' ? 'Xác Nhận Rút Đề Xuất' : 'Confirm Withdrawal', type: 'warning' }
    );
    if (!confirmed) return;

    try {
      await inspectorService.deleteChecklist(chk.id);
      showNotice(lang === 'vi' ? `Đã rút đề xuất bộ tiêu chuẩn "${chk.title}" thành công!` : `Checklist proposal withdrawn!`);
      if (viewingChecklist?.id === chk.id) {
        setViewingChecklist(null);
      }
      await loadChecklists();
    } catch (err: any) {
      console.error('Lỗi rút đề xuất checklist:', err);
      dialogService.error(err?.message || (lang === 'vi' ? 'Không thể rút đề xuất bộ tiêu chuẩn' : 'Failed to withdraw checklist'));
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

  const loadPricing = async (targetPage: number = 0, statusFilter: string = pricingProposalFilter, includeSummary = true) => {
    const requestId = ++pricingRequestRef.current;
    setIsLoadingPricing(true);
    try {
      const { tiers: tiersRes, history: propsRes, fees: currentFeesRes, pending: levelPropsRes } =
        await loadCenterPricing(targetPage, statusFilter, includeSummary);
      if (requestId !== pricingRequestRef.current) return;
      if (tiersRes.status === 'fulfilled' && tiersRes.value !== null) {
        const tiers = Array.isArray(tiersRes.value) ? tiersRes.value : [];
        setTravelTiers(tiers);
      }
      if (propsRes.status === 'fulfilled') {
        const props = propsRes.value as any;
        const list = Array.isArray(props?.items)
          ? props.items
          : Array.isArray(props?.content)
            ? props.content
            : Array.isArray(props)
              ? props
              : [];
        setTierProposals(list);
        setPricingProposalTotalPages(props.totalPages || 1);
        setPricingProposalTotalElements(props.totalElements ?? list.length);
        setPricingProposalPage(props.page || 0);
      }
      if (currentFeesRes.status === 'fulfilled' && currentFeesRes.value !== null) {
        const cFees = currentFeesRes.value;
        setCurrentLevelFees(Array.isArray(cFees) ? cFees : []);
      }
      if (levelPropsRes?.status === 'fulfilled') {
        setLevelFeeProposals(levelPropsRes.value);
      }
    } catch (err) {
      console.warn('Lỗi tải lịch sử đề xuất:', err);
    } finally {
      if (requestId === pricingRequestRef.current) setIsLoadingPricing(false);
    }
  };

  const handleProposeLevelFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProposingLevelFeeError(null);
    if (!proposingLevelFeeAmount || Number(proposingLevelFeeAmount) <= 0) {
      setProposingLevelFeeError('Vui lòng nhập mức phí kiểm định hợp lệ (lớn hơn 0đ)');
      return;
    }

    // Chặn gửi yêu cầu trùng lặp nếu cấp độ này đã có đề xuất đang chờ duyệt
    const existingPending = getPendingProposalForLevel(proposingLevel);
    if (existingPending) {
      setProposingLevelFeeError(`Cấp độ ${proposingLevel} hiện đã có một đề xuất (${formatVND(existingPending.baseInspectionFee || 0)}) đang chờ Admin duyệt. Mỗi cấp độ chỉ được tồn tại 1 yêu cầu chờ duyệt duy nhất.`);
      return;
    }

    setIsSubmittingLevelFee(true);
    try {
      const res = await inspectorService.proposeLevelFee({
        complexityLevel: proposingLevel,
        baseInspectionFee: Number(proposingLevelFeeAmount),
      });

      // Optimistically update levelFeeProposals so the card immediately reflects "Đang chờ Admin duyệt"
      const newProp: InspectionFeeProposalResponse = {
        id: res?.id || `prop-${Date.now()}`,
        complexityLevel: proposingLevel,
        baseInspectionFee: Number(proposingLevelFeeAmount),
        status: 'PENDING_APPROVAL',
        createdAt: res?.createdAt || new Date().toISOString(),
        ...(res || {}),
      };
      setLevelFeeProposals((prev) => [newProp, ...prev.filter((p) => p.id !== newProp.id)]);

      showNotice(`Đã gửi đề xuất biểu phí cho cấp độ ${proposingLevel} (${formatVND(Number(proposingLevelFeeAmount))}) thành công!`);
      setIsProposeLevelFeeModalOpen(false);
      await loadPricing();
    } catch (err: any) {
      console.error('Lỗi đề xuất biểu phí cấp độ:', err);
      setProposingLevelFeeError(err?.message || 'Không thể gửi đề xuất biểu phí');
    } finally {
      setIsSubmittingLevelFee(false);
    }
  };

  const handlePricingFilterChange = (newStatus: 'ALL' | InspectionFeeProposalStatus) => {
    setPricingProposalFilter(newStatus);
    setPricingProposalPage(0);
    loadPricing(0, newStatus, false);
  };

  const handleOpenProposeModal = () => {
    setProposeStep('edit');
    setProposeCategoryId('');
    setProposeBaseFee(250000);
    setProposeValidationError(null);
    if (travelTiers && travelTiers.length > 0) {
      setProposeTiers(JSON.parse(JSON.stringify(travelTiers)));
    } else {
      setProposeTiers([
        { tierNumber: 1, name: 'Bậc 1: Cự ly gần (0 - 5 km)', fromKm: 0, toKm: 5, pricePerKm: 20000, status: 'ACTIVE' },
        { tierNumber: 2, name: 'Bậc 2: Cự ly trung bình (5 - 15 km)', fromKm: 5, toKm: 15, pricePerKm: 30000, status: 'ACTIVE' },
        { tierNumber: 3, name: 'Bậc 3: Ngoại thành gần (15 - 25 km)', fromKm: 15, toKm: 25, pricePerKm: 40000, status: 'ACTIVE' },
        { tierNumber: 4, name: 'Bậc 4: Ngoại thành xa (25 - 40 km)', fromKm: 25, toKm: 40, pricePerKm: 50000, status: 'ACTIVE' },
        { tierNumber: 5, name: 'Bậc 5: Tỉnh lân cận (40 - 60 km)', fromKm: 40, toKm: 60, pricePerKm: 60000, status: 'ACTIVE' },
        { tierNumber: 6, name: 'Bậc 6: Cự ly đặc biệt (> 60 km)', fromKm: 60, toKm: null, pricePerKm: 70000, status: 'ACTIVE' },
      ]);
    }
    if (!categories || categories.length === 0) {
      loadCategoriesAndItems();
    }
    setIsProposeModalOpen(true);
  };

  const handleProposeTierChange = (index: number, field: keyof InspectionTravelTierDto, value: any) => {
    setProposeTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setProposeValidationError(null);
  };

  const validateProposeForm = (): string | null => {
    if (!proposeTiers || proposeTiers.length === 0) {
      return 'Biểu phí cần có ít nhất một bậc cước di chuyển';
    }
    for (let i = 0; i < proposeTiers.length; i++) {
      const t = proposeTiers[i];
      if (!t.name || !t.name.trim()) {
        return `Bậc #${t.tierNumber || i + 1}: Tên bậc không được để trống`;
      }
      const fromKm = Number(t.fromKm);
      if (isNaN(fromKm) || fromKm < 0) {
        return `Bậc #${t.tierNumber || i + 1}: Khoảng cách từ (fromKm) phải là số không âm`;
      }
      if (t.toKm !== null && t.toKm !== undefined && String(t.toKm).trim() !== '') {
        const toKm = Number(t.toKm);
        if (isNaN(toKm) || toKm <= fromKm) {
          return `Bậc #${t.tierNumber || i + 1}: Khoảng cách đến (${toKm} km) phải lớn hơn khoảng cách từ (${fromKm} km)`;
        }
      }
      const price = Number(t.pricePerKm);
      if (isNaN(price) || price < 0) {
        return `Bậc #${t.tierNumber || i + 1}: Đơn giá / km phải là số không âm`;
      }
    }
    return null;
  };

  const handleProceedToPreview = () => {
    const error = validateProposeForm();
    if (error) {
      setProposeValidationError(error);
      return;
    }
    setProposeValidationError(null);
    setProposeStep('preview');
  };

  const handleSubmitProposal = async () => {
    const error = validateProposeForm();
    if (error) {
      setProposeValidationError(error);
      setProposeStep('edit');
      return;
    }
    setIsSubmittingProposal(true);
    try {
      await inspectorService.proposeTravelTiers({
        categoryId: proposeCategoryId ? proposeCategoryId : undefined,
        baseInspectionFee: Number(proposeBaseFee),
        tiers: proposeTiers.map((t) => ({
          tierNumber: t.tierNumber,
          name: t.name,
          fromKm: Number(t.fromKm),
          toKm: t.toKm != null && String(t.toKm).trim() !== '' ? Number(t.toKm) : null,
          pricePerKm: Number(t.pricePerKm),
          status: t.status || 'ACTIVE',
        })),
      });
      showNotice('Đã gửi đề xuất biểu phí lên Admin sàn thành công! Đề xuất đang chờ xét duyệt.');
      setIsProposeModalOpen(false);
      loadPricing(0, pricingProposalFilter, false);
    } catch (err: any) {
      dialogService.error(err?.message || 'Gửi đề xuất giá thất bại');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'checklists') {
      loadChecklists();
      loadCategoriesAndItems();
      loadPricing(0, pricingProposalFilter, true);
    } else if (activeTab === 'pricing') {
      loadPricing();
      loadChecklists();
      loadCategoriesAndItems();
    }
  }, [activeTab]);

  // Refresh all data
  const handleRefreshAll = () => {
    if (showOrderShipments) setDeniedShipmentOrders(new Set());
    if (activeTab === 'profile' || activeTab === 'overview') loadCenterProfile();
    if (needsOrders) loadOrders();
    if (needsStaff) loadStaff();
    if (activeTab === 'checklists') {
      loadChecklists();
      loadCategoriesAndItems();
    }
    if (activeTab === 'pricing') {
      loadPricing();
      loadChecklists();
      loadCategoriesAndItems();
    }
    if (!showOrderShipments) showNotice(lang === 'vi' ? 'Đã làm mới dữ liệu trung tâm kiểm định' : 'Center data refreshed successfully');
  };

  const dispatchOrders = useMemo(() => orders.flatMap((order) => {
    const stage = getCenterDispatchStage(order, isOrderReceivedAtHub(order));
    return stage ? [{ order, stage }] : [];
  }), [orders, inboundShipments]);
  const urgentDispatchOrders = useMemo(() => dispatchOrders
    .filter(({ stage }) => stage === 'READY_TO_ASSIGN' || stage === 'WAITING_CENTER_APPROVAL')
    .map(({ order }) => order), [dispatchOrders]);

  // Staff Workload Map - Chỉ đếm số đơn thực tế đang giao / đang xử lý (không tính đơn hủy hay đã hoàn tất)
  const staffWorkloadMap = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const isCancelled = o.status === 'CANCELLED' || o.status === 'CANCELED';
      const isClosed = o.status === 'PASSED' || o.status === 'FAILED' || o.status === 'COMPLETED';
      if (o.inspectorId && !isCancelled && !isClosed) {
        map[o.inspectorId] = (map[o.inspectorId] || 0) + 1;
      }
    });
    return map;
  }, [orders]);

  // Overall Statistics - Phản ánh chính xác 100% dữ liệu đơn hàng
  const stats = useMemo(() => {
    const total = orders.length;
    const pendingDispatch = urgentDispatchOrders.length;
    const inspecting = orders.filter(
      (o) => o.status === 'INSPECTING' || o.status === 'INSPECTION_IN_PROGRESS' || o.status === 'DISPATCHED' || o.status === 'SCHEDULED'
    ).length;
    const passed = orders.filter((o) => o.status === 'PASSED' || o.status === 'COMPLETED').length;
    const failed = orders.filter((o) => o.status === 'FAILED').length;
    const cancelled = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'CANCELED').length;
    const waitingApproval = orders.filter(
      (o) => o.status === 'WAITING_SELLER_APPROVAL' || o.status === 'WAITING_BUYER_APPROVAL' || o.status === 'WAITING_FEE_PAYMENT'
    ).length;
    const pendingAppeals = orders.filter((o) => o.appealStatus === 'PENDING_REVIEW').length;
    const totalAppeals = orders.filter((o) => o.appealStatus && o.appealStatus !== 'NONE').length;

    const evaluatedCount = passed + failed;
    const passRate = evaluatedCount > 0 ? Math.round((passed / evaluatedCount) * 100) : 0;
    const totalStaff = staffList.length;

    return {
      total,
      pendingDispatch,
      inspecting,
      passed,
      failed,
      cancelled,
      waitingApproval,
      evaluatedCount,
      passRate,
      totalStaff,
      pendingAppeals,
      totalAppeals
    };
  }, [orders, urgentDispatchOrders, staffList]);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return dispatchOrders.filter(({ order, stage }) => {
      if (dispatchFilter !== 'ALL' && stage !== dispatchFilter) return false;
      if (orderMethodFilter !== 'ALL' && order.orderType !== orderMethodFilter) return false;
      return !query || [
        order.id, order.postTitle, order.inspectorName, order.buyerName,
        order.buyerEmail, order.sellerName, order.sellerEmail,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [dispatchOrders, dispatchFilter, orderMethodFilter, searchTerm]);

  const openReadyDispatchQueue = () => {
    setDispatchFilter('READY_TO_ASSIGN');
    setOrderMethodFilter('ALL');
    setSearchTerm('');
    setActiveTab('dispatch');
  };

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

  const handleOpenInspectionCertificate = async (orderId: string) => {
    setLoadingCertificateId(orderId);
    try {
      const result = await inspectorService.getOrder(orderId);
      if (getInspectionTaskStage(result.status) !== 'completed') {
        void dialogService.warning('Đơn này chưa có kết quả kiểm định chính thức.');
        return;
      }
      setCertificateOrder(result);
    } catch (error) {
      void dialogService.error(error instanceof Error ? error.message : 'Không thể tải biên bản kiểm định.');
    } finally {
      setLoadingCertificateId(null);
    }
  };

  // Helper: Open Assign Modal
  // Helper to reliably resolve seller address from multiple potential sources
  const getOrderSellerAddress = (ord: any): string => {
    if (!ord) return '123 Nguyễn Văn Cừ, Phường An Khánh, Quận Ninh Kiều, TP. Cần Thơ';
    if (ord.sellerAddress && ord.sellerAddress !== 'Địa chỉ nhà người bán' && ord.sellerAddress !== 'Địa chỉ kho người bán') return ord.sellerAddress;
    if (ord.address && ord.address !== 'Địa chỉ nhà người bán' && ord.address !== 'Địa chỉ kho người bán') return ord.address;
    if (ord.listing?.sellerAddress) return ord.listing.sellerAddress;
    if (ord.listing?.location && ord.listing.location !== 'Đà Nẵng, Việt Nam') return ord.listing.location;
    if (ord.shippingLegs?.[0]?.origin && ord.shippingLegs[0].origin !== 'Địa chỉ kho người bán') return ord.shippingLegs[0].origin;

    // Check localStorage recent_placed_orders
    try {
      const rawRecent = localStorage.getItem('recent_placed_orders');
      if (rawRecent) {
        const list = JSON.parse(rawRecent);
        const found = list.find((o: any) => o.id === ord.id || o.linkedOrderId === ord.id);
        if (found) {
          const addr = found.sellerAddress || found.listing?.sellerAddress || found.listing?.location || found.pickupAddress || found.shippingLegs?.[0]?.origin;
          if (addr && addr !== 'Địa chỉ nhà người bán' && addr !== 'Địa chỉ kho người bán') return addr;
        }
      }
    } catch {}

    // Check localStorage center_inspection_orders
    try {
      const rawCenter = localStorage.getItem('center_inspection_orders');
      if (rawCenter) {
        const list = JSON.parse(rawCenter);
        const found = list.find((o: any) => o.id === ord.id);
        if (found) {
          const addr = found.sellerAddress || found.listing?.sellerAddress || found.listing?.location || found.shippingLegs?.[0]?.origin;
          if (addr && addr !== 'Địa chỉ nhà người bán' && addr !== 'Địa chỉ kho người bán') return addr;
        }
      }
    } catch {}

    // Check marketplace_listings
    try {
      const rawList = localStorage.getItem('marketplace_listings');
      if (rawList) {
        const listings = JSON.parse(rawList);
        const pId = ord.postId || ord.listingId || ord.listing?.id;
        const foundListing = listings.find((l: any) => l.id === pId);
        if (foundListing) {
          const addr = foundListing.sellerAddress || foundListing.location || foundListing.pickupAddress;
          if (addr && addr !== 'Địa chỉ nhà người bán' && addr !== 'Địa chỉ kho người bán') return addr;
        }
      }
    } catch {}

    if (ord.sellerAddress && ord.sellerAddress !== 'Địa chỉ nhà người bán' && ord.sellerAddress !== 'Địa chỉ kho người bán') {
      return ord.sellerAddress;
    }
    if (ord.listing?.sellerAddress) return ord.listing.sellerAddress;
    if (ord.listing?.location) return ord.listing.location;
    return '123 Nguyễn Văn Cừ, Phường An Khánh, Quận Ninh Kiều, TP. Cần Thơ';
  };

  const getOrderSellerPhone = (ord: any): string => {
    if (!ord) return '0918 234 567';
    if (ord.sellerPhone) return ord.sellerPhone;
    if (ord.seller?.phone) return ord.seller.phone;
    try {
      const rawRecent = localStorage.getItem('recent_placed_orders');
      if (rawRecent) {
        const list = JSON.parse(rawRecent);
        const found = list.find((o: any) => o.id === ord.id);
        if (found?.sellerPhone || found?.seller?.phone) return found.sellerPhone || found.seller.phone;
      }
    } catch {}
    return '0918 234 567';
  };

  const getOrderSellerName = (ord: any): string => {
    if (!ord) return 'Người bán';
    if (ord.sellerName && ord.sellerName !== 'Người bán') return ord.sellerName;
    if (ord.seller?.fullName) return ord.seller.fullName;
    try {
      const rawRecent = localStorage.getItem('recent_placed_orders');
      if (rawRecent) {
        const list = JSON.parse(rawRecent);
        const found = list.find((o: any) => o.id === ord.id);
        if (found?.sellerName || found?.seller?.fullName) return found.sellerName || found.seller.fullName;
      }
    } catch {}
    return ord.sellerName || 'Thị Thùy Trang Nguyễn';
  };

  const handleOpenAssign = (order: InspectionOrderDto) => {
    setAssignError(null);
    const resolvedAddr = getOrderSellerAddress(order);
    const resolvedPhone = getOrderSellerPhone(order);
    const resolvedName = getOrderSellerName(order);
    setAssignModalOrder({
      ...order,
      sellerAddress: resolvedAddr,
      sellerPhone: resolvedPhone,
      sellerName: resolvedName,
    });
    setSelectedInspectorId(order.inspectorId || staffList[0]?.id || '');
    const savedDispatchNote = localStorage.getItem(`order_dispatch_note_${order.id}`) || '';
    setAssignNote(savedDispatchNote);
  };

  // Action: Open Review Appointment Modal (Giai đoạn thương lượng lịch hẹn 2 bên)
  const handleOpenReviewAppointment = (order: InspectionOrderDto) => {
    setReviewApptOrder(order);
    setReviewMode('VIEW');
    setCounterError(null);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    let initialDate = tomorrowStr;
    let initialShift: InspectionShift = 'AFTERNOON';
    let initialTime = '14:00';
    let initialNote = '';

    const possibleIds = [order.id, order.linkedOrderId, (order as any).orderId].filter(Boolean);
    for (const pid of possibleIds) {
      try {
        const raw = localStorage.getItem(`order_appointment_${pid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.counterScheduledAt) {
            const cd = new Date(parsed.counterScheduledAt);
            if (!isNaN(cd.getTime())) {
              initialDate = `${cd.getFullYear()}-${pad(cd.getMonth() + 1)}-${pad(cd.getDate())}`;
              initialTime = `${pad(cd.getHours())}:${pad(cd.getMinutes())}`;
              initialShift = parsed.counterShift || (cd.getHours() >= 13 ? 'AFTERNOON' : 'MORNING');
            }
            if (parsed.counterNote) initialNote = parsed.counterNote;
            setReviewMode('COUNTER');
            break;
          } else if (parsed.scheduledAt) {
            const sd = new Date(parsed.scheduledAt);
            if (!isNaN(sd.getTime())) {
              initialDate = `${sd.getFullYear()}-${pad(sd.getMonth() + 1)}-${pad(sd.getDate())}`;
              initialShift = parsed.shift === 'MORNING' ? 'AFTERNOON' : 'MORNING';
              initialTime = initialShift === 'AFTERNOON' ? '14:00' : '09:00';
            }
          }
        }
      } catch { }
    }

    if (!initialNote && (order as any).counterScheduledAt) {
      const cd = new Date((order as any).counterScheduledAt);
      if (!isNaN(cd.getTime())) {
        initialDate = `${cd.getFullYear()}-${pad(cd.getMonth() + 1)}-${pad(cd.getDate())}`;
        initialTime = `${pad(cd.getHours())}:${pad(cd.getMinutes())}`;
        initialShift = (order as any).counterShift || (cd.getHours() >= 13 ? 'AFTERNOON' : 'MORNING');
      }
      if ((order as any).counterNote) initialNote = (order as any).counterNote;
      setReviewMode('COUNTER');
    }

    // Đảm bảo initialTime luôn đúng định dạng HH:mm và nằm trong khung giờ của Ca làm việc
    const parsedInitialHour = parseInt(initialTime.slice(0, 2), 10);
    if (initialShift === 'MORNING' && (isNaN(parsedInitialHour) || parsedInitialHour < 8 || parsedInitialHour >= 12)) {
      initialTime = '09:00';
    } else if (initialShift === 'AFTERNOON' && (isNaN(parsedInitialHour) || parsedInitialHour < 13 || parsedInitialHour > 17)) {
      initialTime = '14:00';
    }

    setCounterDate(initialDate);
    setCounterShift(initialShift);
    setCounterTime(initialTime.slice(0, 5));
    setCounterNote(initialNote || 'KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.');
  };

  // Action: Accept Seller's Appointment
  const handleConfirmAcceptAppointment = async () => {
    if (!reviewApptOrder) return;
    setIsSubmittingAccept(true);
    try {
      const orderId = reviewApptOrder.id;

      try {
        await inspectorService.confirmAppointment(orderId);
      } catch (e) {
        console.warn('Backend confirm appointment fallback:', e);
      }

      let apptTime = reviewApptOrder.appointmentScheduledAt;
      let apptNote = reviewApptOrder.appointmentNote || '';
      let apptShift: InspectionShift = 'MORNING';

      try {
        const raw = localStorage.getItem(`order_appointment_${orderId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.scheduledAt) apptTime = parsed.scheduledAt;
          if (parsed.note) apptNote = parsed.note;
          if (parsed.shift) apptShift = parsed.shift;
        }
      } catch { }

      const updatedAppointment = {
        scheduledAt: apptTime,
        note: apptNote,
        shift: apptShift,
        status: 'CONFIRMED' as const,
        confirmedAt: new Date().toISOString(),
        confirmedBy: 'CENTER' as const,
      };
      localStorage.setItem(`order_appointment_${orderId}`, JSON.stringify(updatedAppointment));

      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  appointmentStatus: 'CONFIRMED',
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        }
      } catch { }

      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const listCenter = JSON.parse(rawCenter);
          if (Array.isArray(listCenter)) {
            const updatedCenter = listCenter.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  appointmentStatus: 'CONFIRMED',
                };
              }
              return o;
            });
            localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
          }
        }
      } catch { }

      try {
        const sellerId = (reviewApptOrder as any).sellerId || (reviewApptOrder as any).listing?.sellerId;
        const codeDisplay = (reviewApptOrder.id || '').slice(0, 8);
        const formattedAppt = apptTime ? new Date(apptTime).toLocaleString('vi-VN') : 'lịch đã chọn';
        const sellerNotif = {
          id: `notif-seller-accept-appt-${orderId}-${Date.now()}`,
          recipientId: sellerId,
          recipientRole: 'seller',
          title: `Lịch hẹn kiểm định tại nhà #${codeDisplay} đã được chấp nhận`,
          message: `Trung tâm SecondLife đã chấp nhận lịch hẹn vào ${formattedAppt}. Trạm đang điều phối KTV phụ trách đến kiểm tra thiết bị!`,
          type: 'INSPECTION' as const,
          referenceId: orderId,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: paths.orders('seller', orderId) + '?filter=inspecting',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(sellerNotif, sellerId, 'seller');
      } catch { }

      const confirmedOrder: InspectionOrderDto = {
        ...reviewApptOrder,
        appointmentStatus: 'CONFIRMED',
      };

      setOrders((prev) => prev.map((o) => o.id === orderId ? confirmedOrder : o));

      window.dispatchEvent(new CustomEvent('secondlife_appointment_confirmed', {
        detail: { orderId, scheduledAt: apptTime, status: 'CONFIRMED' },
      }));
      window.dispatchEvent(new CustomEvent('secondlife_order_assigned_signal', { detail: { orderId } }));

      showNotice(`Đã chấp nhận lịch hẹn #${(orderId || '').slice(0, 8)} thành công! Bạn có thể giao task cho KTV ngay.`);
      setReviewApptOrder(null);

      // Mở ngay modal Phân công KTV
      setTimeout(() => {
        handleOpenAssign(confirmedOrder);
      }, 300);
    } catch (err: any) {
      showNotice(err?.message || 'Không thể chấp nhận lịch hẹn. Vui lòng thử lại.');
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  // Action: Send Counter-Proposal to Seller
  const handleConfirmSendCounter = async () => {
    if (!reviewApptOrder) return;

    let existingCounter = reviewApptOrder.counterScheduledAt;
    try {
      const checkIds = [reviewApptOrder.id, reviewApptOrder.linkedOrderId, (reviewApptOrder as any).orderId].filter(Boolean);
      for (const tid of checkIds) {
        const raw = localStorage.getItem(`order_appointment_${tid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.counterScheduledAt) {
            existingCounter = parsed.counterScheduledAt;
            break;
          }
        }
      }
    } catch { }

    if (existingCounter || reviewApptOrder.appointmentStatus === 'COUNTERED_BY_CENTER' || reviewApptOrder.status === 'WAITING_SELLER_APPROVAL') {
      setCounterError('Trung tâm đã gửi đề xuất lịch mới trước đó. Đang chờ người bán phản hồi (Đồng ý hoặc Hẹn lại), không thể gửi tiếp đề xuất lần 2.');
      return;
    }

    if (!counterDate) {
      setCounterError('Vui lòng chọn ngày đề xuất mới');
      return;
    }
    if (!counterTime) {
      setCounterError('Vui lòng chọn giờ KTV có mặt');
      return;
    }
    if (!counterNote.trim()) {
      setCounterError('Vui lòng nhập lý do/ghi chú đề xuất lại cho người bán');
      return;
    }

    const timePart = counterTime?.includes(':') ? counterTime.slice(0, 5) : '14:00';
    const scheduledDate = new Date(`${counterDate}T${timePart}:00`);
    if (isNaN(scheduledDate.getTime())) {
      setCounterError('Ngày giờ đề xuất không hợp lệ');
      return;
    }

    setIsSubmittingCounter(true);
    setCounterError(null);
    try {
      const orderId = reviewApptOrder.id;
      const linkedId = reviewApptOrder.linkedOrderId || (reviewApptOrder as any).orderId;
      const targetIds = new Set<string>([orderId]);
      if (linkedId) targetIds.add(linkedId);

      try {
        await inspectorService.counterAppointment(
          orderId,
          scheduledDate.toISOString(),
          counterNote.trim(),
          counterShift
        );
      } catch (e: any) {
        if (e?.status === 409 || e?.message?.includes('không còn ở trạng thái cho phép thao tác')) {
          setCounterError('Lịch hẹn hiện không còn ở trạng thái cho phép gửi đề xuất mới (đang chờ người bán phản hồi).');
        } else {
          console.warn('Backend counter appointment fallback:', e);
        }
      }

      let prevScheduledAt = reviewApptOrder.appointmentScheduledAt;
      let prevNote = reviewApptOrder.appointmentNote;
      try {
        const raw = localStorage.getItem(`order_appointment_${orderId}`) || (linkedId ? localStorage.getItem(`order_appointment_${linkedId}`) : null);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.scheduledAt) prevScheduledAt = parsed.scheduledAt;
          if (parsed.note) prevNote = parsed.note;
        }
      } catch { }

      const counterRecord = {
        scheduledAt: prevScheduledAt,
        note: prevNote,
        status: 'COUNTERED_BY_CENTER' as const,
        counterScheduledAt: scheduledDate.toISOString(),
        counterShift,
        counterNote: counterNote.trim(),
        counteredAt: new Date().toISOString(),
        linkedOrderId: linkedId,
      };

      const rejectionRecord = {
        reason: counterNote.trim(),
        rejectedAt: new Date().toISOString(),
        replacedByCounter: true,
      };

      targetIds.forEach((id) => {
        try {
          localStorage.setItem(`order_appointment_${id}`, JSON.stringify(counterRecord));
          localStorage.setItem(`order_appointment_rejection_${id}`, JSON.stringify(rejectionRecord));
        } catch { }
      });

      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (targetIds.has(o.id) || targetIds.has(o.inspectionOrderId) || targetIds.has(o.linkedOrderId)) {
                return {
                  ...o,
                  appointmentStatus: 'COUNTERED_BY_CENTER',
                  counterScheduledAt: scheduledDate.toISOString(),
                  counterShift,
                  counterNote: counterNote.trim(),
                  appointmentRejectionReason: counterNote.trim(),
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        }
      } catch { }

      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const listCenter = JSON.parse(rawCenter);
          if (Array.isArray(listCenter)) {
            const updatedCenter = listCenter.map((o: any) => {
              if (targetIds.has(o.id) || targetIds.has(o.linkedOrderId) || targetIds.has(o.orderId)) {
                return {
                  ...o,
                  appointmentStatus: 'COUNTERED_BY_CENTER',
                  counterScheduledAt: scheduledDate.toISOString(),
                  counterShift,
                  counterNote: counterNote.trim(),
                  appointmentRejectionReason: counterNote.trim(),
                };
              }
              return o;
            });
            localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
          }
        }
      } catch { }

      try {
        const sellerId = (reviewApptOrder as any).sellerId || (reviewApptOrder as any).listing?.sellerId;
        const codeDisplay = (reviewApptOrder.id || '').slice(0, 8);
        const formattedDate = scheduledDate.toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const shiftLabel = counterShift === 'MORNING' ? 'Ca Sáng (08:00 - 12:00)' : 'Ca Chiều (13:00 - 17:00)';
        const sellerNotif = {
          id: `notif-seller-counter-appt-${orderId}-${Date.now()}`,
          recipientId: sellerId,
          recipientRole: 'seller',
          title: `Trung tâm kiểm định đề xuất lịch hẹn mới: #${codeDisplay}`,
          message: `Trung tâm SecondLife đề xuất dời lịch hẹn sang ${formattedDate} (${shiftLabel}). Lý do: "${counterNote.trim()}". Vui lòng vào trang đơn hàng để xem và xác nhận!`,
          type: 'INSPECTION' as const,
          referenceId: orderId,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: paths.orders('seller', orderId) + '?filter=inspecting',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(sellerNotif, sellerId, 'seller');
      } catch { }

      setOrders((prev) => prev.map((o) => o.id === orderId ? {
        ...o,
        appointmentStatus: 'COUNTERED_BY_CENTER',
        counterScheduledAt: scheduledDate.toISOString(),
        counterShift,
        counterNote: counterNote.trim(),
      } : o));

      window.dispatchEvent(new CustomEvent('secondlife_appointment_countered', {
        detail: {
          orderId,
          linkedOrderId: linkedId,
          counterScheduledAt: scheduledDate.toISOString(),
          counterShift,
          counterNote: counterNote.trim(),
        }
      }));
      window.dispatchEvent(new CustomEvent('secondlife_appointment_rejected', {
        detail: {
          orderId,
          linkedOrderId: linkedId,
          reason: counterNote.trim(),
          replacedByCounter: true,
        }
      }));
      window.dispatchEvent(new CustomEvent('secondlife_order_assigned_signal', { detail: { orderId, linkedOrderId: linkedId } }));

      showNotice(`Đã gửi đề xuất lịch mới cho người bán đơn #${(orderId || '').slice(0, 8)} thành công!`);
      setReviewApptOrder(null);
    } catch (err: any) {
      setCounterError(err?.message || 'Không thể gửi đề xuất lịch hẹn');
    } finally {
      setIsSubmittingCounter(false);
    }
  };

  // Action: Reject Appointment for AT_HOME Order
  const handleRejectAppointment = async () => {
    if (!rejectApptModalOrder) return;
    const reason = rejectApptReason.trim();
    if (!reason) {
      setRejectApptError('Vui lòng nhập lý do từ chối lịch hẹn để người bán nắm rõ thông tin.');
      return;
    }

    setIsRejectingAppt(true);
    setRejectApptError(null);
    try {
      const orderId = rejectApptModalOrder.id;

      // 1. Lưu thông tin từ chối vào localStorage
      const rejectionRecord = {
        orderId,
        rejectedAt: new Date().toISOString(),
        reason,
        previousScheduledAt: rejectApptModalOrder.appointmentScheduledAt,
      };
      localStorage.setItem(`order_appointment_rejection_${orderId}`, JSON.stringify(rejectionRecord));
      localStorage.removeItem(`order_appointment_${orderId}`);
      localStorage.removeItem(`order_assigned_inspector_${orderId}`);

      // 2. Cập nhật recent_placed_orders
      try {
        const raw = localStorage.getItem('recent_placed_orders');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  appointmentScheduledAt: null,
                  appointmentStatus: 'REJECTED',
                  appointmentRejectionReason: reason,
                  inspectorId: null,
                  inspectorName: null,
                };
              }
              return o;
            });
            localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
          }
        }
      } catch { }

      // 3. Cập nhật center_inspection_orders
      try {
        const rawCenter = localStorage.getItem('center_inspection_orders');
        if (rawCenter) {
          const listCenter = JSON.parse(rawCenter);
          if (Array.isArray(listCenter)) {
            const updatedCenter = listCenter.map((o: any) => {
              if (o.id === orderId) {
                return {
                  ...o,
                  appointmentScheduledAt: null,
                  appointmentStatus: 'REJECTED',
                  appointmentRejectionReason: reason,
                  inspectorId: null,
                  inspectorName: null,
                };
              }
              return o;
            });
            localStorage.setItem('center_inspection_orders', JSON.stringify(updatedCenter));
          }
        }
      } catch { }

      // 4. Gửi thông báo cho Seller
      try {
        const sellerId = (rejectApptModalOrder as any).sellerId || (rejectApptModalOrder as any).listing?.sellerId;
        const codeDisplay = (rejectApptModalOrder.id || '').slice(0, 8);
        const sellerNotif = {
          id: `notif-seller-reject-appt-${orderId}-${Date.now()}`,
          recipientId: sellerId,
          recipientRole: 'seller',
          title: `Lịch hẹn kiểm định tại nhà #${codeDisplay} đã bị từ chối`,
          message: `Trung tâm SecondLife đã từ chối lịch hẹn của bạn. Lý do: "${reason}". Vui lòng vào trang Đơn Hàng để đặt lại lịch hẹn phù hợp hơn!`,
          type: 'INSPECTION' as const,
          referenceId: orderId,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: `/orders/seller?search=${encodeURIComponent(orderId)}`,
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(sellerNotif, sellerId, 'seller');
      } catch { }

      // 5. Cập nhật state danh sách đơn trong Hub
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
              ...o,
              appointmentScheduledAt: undefined,
              appointmentStatus: 'REJECTED',
              appointmentRejectionReason: reason,
              inspectorId: undefined,
              inspectorName: undefined,
            }
            : o
        )
      );

      // 6. Phát tín hiệu realtime
      window.dispatchEvent(
        new CustomEvent('secondlife_appointment_rejected', {
          detail: { orderId, reason },
        })
      );
      window.dispatchEvent(
        new CustomEvent('secondlife_order_assigned_signal', {
          detail: { orderId },
        })
      );

      setRejectApptModalOrder(null);
      setRejectApptReason('');
      setAssignModalOrder(null);
    } catch (err: any) {
      setRejectApptError(err?.message || 'Có lỗi xảy ra khi từ chối lịch hẹn.');
    } finally {
      setIsRejectingAppt(false);
    }
  };

  // Action: Submit Assign Inspector
  const handleConfirmAssign = async () => {
    setAssignError(null);
    if (!assignModalOrder) return;

    if (!selectedInspectorId) {
      setAssignError('Vui lòng chọn kỹ thuật viên kiểm định từ danh sách trước khi xác nhận.');
      return;
    }

    const currentOrder = orders.find((order) => order.id === assignModalOrder.id) ?? assignModalOrder;
    const stage = getCenterDispatchStage(currentOrder, isOrderReceivedAtHub(currentOrder));
    if (!stage) {
      setAssignError('Đơn kiểm định hiện không ở giai đoạn điều phối.');
      return;
    }
    if (stage === 'WAITING_FOR_HUB') {
      setAssignError('Hub cần xác nhận đã nhận kiện hàng trước khi giao task cho KTV.');
      return;
    }

    setIsAssigning(true);
    try {
      const assignedOrder = await inspectorService.assignInspector(assignModalOrder.id, selectedInspectorId);

      const inspectorObj = staffList.find((s) => s.id === selectedInspectorId);
      const inspectorName = assignedOrder.inspectorName || inspectorObj?.fullName || 'Kỹ thuật viên';
      const inspectorEmail = inspectorObj?.email;
      const inspectorPhone = inspectorObj?.phone;

      // Extract and package seller details to send with the task assignment for inspector
      const resolvedSellerAddress = getOrderSellerAddress(assignModalOrder);
      const resolvedSellerPhone = getOrderSellerPhone(assignModalOrder);
      const resolvedSellerName = getOrderSellerName(assignModalOrder);

      // Persist assignment mapping and internal dispatch instructions for KTV
      const trimmedDispatchNote = assignNote.trim();
      if (trimmedDispatchNote) {
        localStorage.setItem(`order_dispatch_note_${assignModalOrder.id}`, trimmedDispatchNote);
      } else {
        localStorage.removeItem(`order_dispatch_note_${assignModalOrder.id}`);
      }

      localStorage.setItem(
        `order_assigned_inspector_${assignModalOrder.id}`,
        JSON.stringify({
          inspectorId: selectedInspectorId,
          inspectorName: inspectorName,
          inspectorEmail: inspectorEmail,
          inspectorPhone: inspectorPhone,
          sellerName: resolvedSellerName,
          sellerPhone: resolvedSellerPhone,
          sellerAddress: resolvedSellerAddress,
          dispatchNote: trimmedDispatchNote || undefined,
          appointmentScheduledAt: assignModalOrder.appointmentScheduledAt,
          appointmentNote: assignModalOrder.appointmentNote,
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
                sellerAddress: resolvedSellerAddress,
                sellerPhone: resolvedSellerPhone,
                sellerName: resolvedSellerName,
                status: assignedOrder.status,
                backendStatus: assignedOrder.status,
                inspectionStatus: assignedOrder.customerStatus || assignedOrder.status,
              };
            }
            return o;
          });
          localStorage.setItem('recent_placed_orders', JSON.stringify(updated));
        }
      } catch { }

      // Update center_inspection_orders with the assignment returned by BE.
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
            sellerAddress: resolvedSellerAddress,
            sellerPhone: resolvedSellerPhone,
            sellerName: resolvedSellerName,
            status: assignedOrder.status,
            backendStatus: assignedOrder.status,
          };
        } else {
          listCenter.unshift({
            ...assignModalOrder,
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
            sellerAddress: resolvedSellerAddress,
            sellerPhone: resolvedSellerPhone,
            sellerName: resolvedSellerName,
            status: assignedOrder.status,
            backendStatus: assignedOrder.status,
          });
        }
        localStorage.setItem('center_inspection_orders', JSON.stringify(listCenter));
      } catch { }

      // Send local scoped notification for the Seller and Inspector
      try {
        const isAtHome = assignModalOrder.orderType === 'AT_HOME';
        const sellerId = (assignModalOrder as any).sellerId || (assignModalOrder as any).listing?.sellerId;
        const codeDisplay = (assignModalOrder.id || '').slice(0, 8);

        // Seller notification
        const sellerNotif = {
          id: `notif-seller-assign-${assignModalOrder.id}-${Date.now()}`,
          recipientId: sellerId,
          recipientRole: 'seller',
          title: isAtHome
            ? 'Trung tâm đã xác nhận lịch hẹn và phân công KTV kiểm định tận nơi'
            : 'Hub đã phân công KTV kiểm định đơn hàng',
          message: isAtHome
            ? `Trung tâm SecondLife đã xác nhận lịch hẹn và phân công KTV ${inspectorName} phụ trách kiểm định cho đơn #${codeDisplay}. Vui lòng chuẩn bị máy và đưa mã tiếp nhận cho KTV khi đến!`
            : `Đơn hàng #${codeDisplay} đã được phân công cho KTV ${inspectorName} kiểm định tại trạm Hub.`,
          type: 'INSPECTION' as const,
          referenceId: assignModalOrder.id,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: paths.orders('seller', assignModalOrder.id) + '?filter=inspecting',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(sellerNotif, sellerId, 'seller');

        // Inspector notification with full seller address and contact details
        const formattedAppt = assignModalOrder.appointmentScheduledAt
          ? new Date(assignModalOrder.appointmentScheduledAt).toLocaleString('vi-VN')
          : 'Đã hẹn trước';
        const inspectorNotif = {
          id: `notif-inspector-task-${assignModalOrder.id}-${Date.now()}`,
          recipientId: selectedInspectorId,
          recipientRole: 'inspector',
          title: isAtHome
            ? `Nhiệm vụ mới: Kiểm định tại nhà khách (#${codeDisplay})`
            : `Nhiệm vụ mới: Đo kiểm tại Hub Lab (#${codeDisplay})`,
          message: isAtHome
            ? `Bạn được phân công kiểm định tại nhà cho thiết bị "${assignModalOrder.postTitle || 'Thiết bị'}".\n📍 Địa chỉ đến: ${resolvedSellerAddress}\n👤 Người bán: ${resolvedSellerName} (SĐT: ${resolvedSellerPhone})\n🕒 Lịch hẹn: ${formattedAppt}${trimmedDispatchNote ? `\n📝 Hướng dẫn từ Hub: ${trimmedDispatchNote}` : ''}`
            : `Bạn được phân công đo kiểm thiết bị "${assignModalOrder.postTitle || 'Thiết bị'}" tại trạm Hub.${trimmedDispatchNote ? ` Ghi chú: ${trimmedDispatchNote}` : ''}`,
          type: 'INSPECTION_TASK' as const,
          referenceId: assignModalOrder.id,
          referenceType: 'INSPECTION_ORDER',
          actionUrl: `/inspector/inspections/${encodeURIComponent(assignModalOrder.id)}`,
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        saveScopedLocalNotification(inspectorNotif, selectedInspectorId, 'inspector');
      } catch { }

      // Notify other tabs and inspector workstation
      window.dispatchEvent(
        new CustomEvent('secondlife_order_assigned_signal', {
          detail: {
            orderId: assignModalOrder.id,
            inspectorId: selectedInspectorId,
            inspectorName: inspectorName,
            inspectorEmail: inspectorEmail,
            sellerName: resolvedSellerName,
            sellerPhone: resolvedSellerPhone,
            sellerAddress: resolvedSellerAddress,
            dispatchNote: trimmedDispatchNote || undefined,
          },
        })
      );

      showNotice(`Đã phân công đơn #${(assignModalOrder.id || '').slice(0, 8)} cho KTV ${inspectorName} thành công!`);

      setAssignModalOrder(null);
      setSelectedInspectorId('');
      setAssignNote('');
      setAssignError(null);
    } catch (err: any) {
      console.error('Lỗi khi phân công KTV:', err);
      // Xóa mapping local lưu tạm để tránh hiển thị sai lệch khi BE từ chối
      try {
        localStorage.removeItem(`order_assigned_inspector_${assignModalOrder.id}`);
      } catch { }
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
      await inspectorService.createStaff({
        email: newStaffEmail.trim(),
        password: newStaffPassword,
        fullName: newStaffName.trim(),
      });

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
      } catch { }

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
    const text = `Tài khoản KTV SecondLife Hub:\n- Họ tên: ${createdStaffSuccessData.fullName}\n- Email: ${createdStaffSuccessData.email}\n- Mật khẩu: ${createdStaffSuccessData.password}\n- Link đăng nhập: ${window.location.origin}/login`;
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
  const renderStatusBadge = (statusOrOrder: string | any, optionalOrd?: any) => {
    const ord = typeof statusOrOrder === 'object' ? statusOrOrder : (optionalOrd || null);
    const rawStatus = (typeof statusOrOrder === 'string' ? statusOrOrder : ord?.status) || '';
    const status = String(rawStatus).toUpperCase();

    const isCancelled = status === 'CANCELLED' || status === 'CANCELED' || ord?.status === 'CANCELLED' || ord?.status === 'CANCELED';
    if (isCancelled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap shadow-2xs">
          <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Đã Hủy</span>
        </span>
      );
    }

    if (status === 'PASSED' || status === 'COMPLETED' || status === 'INSPECTION_PASSED' || ord?.status === 'PASSED' || ord?.status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Đạt Nghiệm Thu</span>
        </span>
      );
    }

    if (status === 'FAILED' || status === 'REJECTED' || status === 'INSPECTION_FAILED' || ord?.status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Từ Chối / Fail</span>
        </span>
      );
    }

    if (status === 'WAITING_SELLER_APPROVAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>Chờ Bán Duyệt</span>
        </span>
      );
    }

    if (status === 'WAITING_BUYER_APPROVAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>Chờ Mua Duyệt</span>
        </span>
      );
    }

    if (status === 'WAITING_FEE_PAYMENT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shadow-2xs">
          <CreditCard className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Chờ Đóng Phí KĐ</span>
        </span>
      );
    }

    if (status === 'PAYMENT_EXPIRED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Hết Hạn Nộp Phí</span>
        </span>
      );
    }

    if (status === 'DELIVERING_TO_BUYER') {
      const delivery = buyerShipments.get(ord?.id);
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-300 whitespace-nowrap shadow-2xs">
          <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span>{ord && isPaidHubBuyerDelivery(ord)
            ? canBookHubBuyerDelivery(delivery) ? 'Chờ tạo vận đơn giao người mua'
              : delivery ? getHubBuyerShipmentLabel(delivery) : 'Đã thanh toán · Đang kiểm tra vận đơn'
            : 'Đang Giao Cho Người Mua'}</span>
        </span>
      );
    }

    if (status === 'DISPUTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 whitespace-nowrap shadow-2xs">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
          <span>Đang Khiếu Nại</span>
        </span>
      );
    }

    // --- PHÂN HÓA RÕ ĐƠN KIỂM ĐỊNH TẠI NHÀ VS TẠI HUB ---
    const isAtHome = ord?.orderType === 'AT_HOME';
    const hasInspector = Boolean(ord?.inspectorId);

    if (isAtHome) {
      // 1. Kiểm định tại nhà khách
      let apptTime = ord?.appointmentScheduledAt;
      let apptStatus = (ord as any)?.appointmentStatus;
      let counterTime = (ord as any)?.counterScheduledAt;
      let counterNote = (ord as any)?.counterNote;

      if (typeof window !== 'undefined') {
        const possibleIds = [
          ord?.id,
          (ord as any)?.linkedOrderId,
          (ord as any)?.orderId,
          (ord as any)?.inspectionOrderId,
        ].filter(Boolean) as string[];

        for (const id of possibleIds) {
          try {
            const raw = localStorage.getItem(`order_appointment_${id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.scheduledAt && !apptTime) apptTime = parsed.scheduledAt;
              if (parsed.status) apptStatus = parsed.status;
              if (parsed.counterScheduledAt) counterTime = parsed.counterScheduledAt;
              if (parsed.counterNote) counterNote = parsed.counterNote;
              break;
            }
          } catch {}
        }
      }

      if (
        (counterTime && !hasInspector) ||
        ord?.status === 'WAITING_SELLER_APPROVAL' ||
        (ord as any)?.customerStatus === 'WAITING_SELLER_APPROVAL' ||
        String((ord as any)?.backendStatus || '').toUpperCase() === 'WAITING_SELLER_APPROVAL' ||
        apptStatus === 'COUNTERED_BY_CENTER'
      ) {
        apptStatus = 'COUNTERED_BY_CENTER';
      }

      if (!apptTime || apptStatus === 'REJECTED') {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>Chờ Người Bán Hẹn Lịch</span>
          </span>
        );
      }

      const formattedAppt = new Date(apptTime).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      });

      // 1. Chờ Trung tâm duyệt đề xuất của Người bán
      if (apptStatus === 'PENDING_CENTER_CONFIRMATION' || apptStatus === 'PENDING_CONFIRMATION') {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300 whitespace-nowrap shadow-2xs" title={`Người bán đề xuất: ${formattedAppt} • Chờ Trung tâm xem và duyệt`}>
            <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Đề Xuất {formattedAppt} • Chờ Duyệt</span>
          </span>
        );
      }

      // 2. Trung tâm đã gửi lại đề xuất mới, chờ Seller phản hồi
      if (apptStatus === 'COUNTERED_BY_CENTER' || Boolean(counterTime)) {
        const formattedCounter = counterTime ? new Date(counterTime).toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        }) : formattedAppt;
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-950 border border-sky-300 whitespace-nowrap shadow-2xs" title={`Trung tâm đã gửi đề xuất: ${formattedCounter} • Chờ người bán đồng ý`}>
            <CalendarSync className="w-3.5 h-3.5 text-sky-700 shrink-0" />
            <span>Đã Gửi Lịch {formattedCounter} • Chờ Seller</span>
          </span>
        );
      }

      // 3. Lịch đã chốt (CONFIRMED) nhưng chưa giao KTV
      if (!hasInspector) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-950 border border-orange-300 animate-pulse whitespace-nowrap shadow-2xs" title={`Lịch hẹn đã chốt: ${formattedAppt} • Cần phân công KTV`}>
            <CalendarCheck className="w-3.5 h-3.5 text-orange-700 shrink-0" />
            <span>Đã Chốt {formattedAppt} • Cần Giao KTV</span>
          </span>
        );
      }

      // 4. Đã phân công KTV
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 whitespace-nowrap shadow-2xs" title={`Lịch hẹn đã chốt: ${formattedAppt}`}>
          <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Đã Phân Công KTV ({formattedAppt})</span>
        </span>
      );
    }

    // 2. Kiểm định tại Lab Hub (AT_CENTER)
    const isHubReceived = isOrderReceivedAtHub(ord);
    if (!isHubReceived) {
      const shipment = showOrderShipments ? inboundShipments.get(ord?.id) : undefined;
      const isShipping = status === 'SHIPPING_TO_CENTER' ||
        (!showOrderShipments && hasLocalShipmentSignal(ord));
      if (shipment || isShipping) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300 whitespace-nowrap shadow-2xs">
            <Truck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            <span>{shipment ? getInboundShipmentProgress(shipment).label : 'Đang giao hàng về Hub'}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shadow-2xs">
          <Package className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>{showOrderShipments && ord && shouldTrackInboundShipment(ord) &&
            (!canReadCenterInspectionShipments(ord, currentUser?.id) || deniedShipmentOrders.has(ord.id))
            ? 'Chưa xem được vận đơn' : 'Chờ Người Bán Gửi Hub'}</span>
        </span>
      );
    }

    // Kiện hàng ĐÃ VỀ HUB:
    if (!hasInspector) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300 animate-pulse whitespace-nowrap shadow-2xs">
          <PackageCheck className="w-3.5 h-3.5 text-orange-700 shrink-0" />
          <span>Đã Nhận Hàng • Chờ Giao KTV</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap shadow-2xs">
        <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span>Đang trong quá trình kiểm định</span>
      </span>
    );
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
    {
      id: 'profile' as CenterTab,
      label: 'THÔNG TIN TRUNG TÂM',
      icon: Building2,
      badge: centerProfile && !centerProfile.shippingAddressConfigured ? 'Cần cấu hình' : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'wallet' as CenterTab,
      label: 'VÍ TRUNG TÂM',
      icon: Wallet,
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

          {/* Mobile navigation trigger */}
          <button
            type="button"
            onClick={() => {
              setIsSidebarCollapsed(false);
              setIsMobileSidebarOpen((open) => !open);
            }}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition cursor-pointer md:hidden"
            aria-expanded={isMobileSidebarOpen}
            aria-label={lang === 'vi' ? 'Đóng / Mở menu' : 'Toggle menu'}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>

        </div>

        {/* Right: ISO Hub Badge & Manager Profile Dropdown */}
        <div className="flex items-center gap-3">

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
                      setActiveTab('profile');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center gap-2 text-[#24263e] font-bold cursor-pointer transition"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#c34c36]" />
                    <span>Thông Tin Trung Tâm</span>
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
          style={{ width: isSidebarCollapsed ? 64 : sidebarWidth }}
          className={`bg-[#fce5da] text-[#24263e] border-r border-[#24263e]/15 max-w-[85vw] flex-col shrink-0 select-none z-30 top-13 sm:top-14 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.5rem)] md:sticky md:flex ${isMobileSidebarOpen ? 'fixed left-0 flex shadow-2xl md:shadow-none' : 'hidden'}`}
        >
          {/* User Block with Live Online indicator */}
          <div
            onClick={() => onOpenProfile?.()}
            className={`p-3.5 sm:p-4 border-b border-[#24263e]/15 flex items-center gap-3 cursor-pointer hover:bg-black/5 transition ${isSidebarCollapsed ? '' : 'md:pr-11'}`}
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

          <ResizableSidebarControls
            width={sidebarWidth}
            collapsed={isSidebarCollapsed}
            onResize={setSidebarWidth}
            onToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            lang={lang}
          />

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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition cursor-pointer group ${isActive
                    ? 'bg-white text-[#24263e] shadow-sm font-black'
                    : 'text-[#24263e]/80 hover:text-[#24263e] hover:bg-white/40 font-bold'
                    }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${isActive ? 'text-[#24263e]' : 'text-[#24263e]/75 group-hover:text-[#24263e]'
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
                        className={`w-3.5 h-3.5 transition-transform ${isActive ? 'text-[#24263e] translate-x-0.5' : 'text-[#24263e]/50 group-hover:text-[#24263e]'
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
        <main className="flex-1 overflow-y-auto bg-[#faf8f5] p-3 sm:p-4 lg:p-5 space-y-4 sm:space-y-5 min-w-0">
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
              {activeTab !== 'dispatch' && <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2">
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
              </div>}

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
              {activeTab !== 'dispatch' && <button
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
              </button>}
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
              {/* Center Profile Unconfigured Alert */}
              {centerProfile && !centerProfile.shippingAddressConfigured && (
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-sm text-amber-900">Trung tâm chưa hoàn tất cấu hình địa chỉ tiếp nhận & tọa độ GPS</h4>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Quý trung tâm cần cập nhật đầy đủ số nhà, phường/xã, tỉnh/thành và xác nhận điểm ghim trên bản đồ để hệ thống có thể điều phối vận tải Lalamove và tính cước di chuyển.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition cursor-pointer shadow-xs"
                  >
                    Cấu hình ngay
                  </button>
                </div>
              )}

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
                    onClick={openReadyDispatchQueue}
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
                        const count = (staffWorkloadMap[st.id] || 0) + (st.email ? (staffWorkloadMap[st.email] || 0) : 0);
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
                                className={`h-full transition-all duration-500 rounded-full ${count >= 4
                                  ? 'bg-rose-500'
                                  : count >= 2
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                  }`}
                                style={{ width: `${count === 0 ? 0 : Math.max(8, pct)}%` }}
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
                      {stats.evaluatedCount > 0 ? `Tỷ lệ đạt ${stats.passRate}%` : 'Chưa có nghiệm thu'}
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

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-slate-500" />
                        <span className="font-bold text-slate-700">Đơn đã hủy</span>
                      </div>
                      <strong className="font-mono text-slate-700 text-sm font-black">{stats.cancelled} đơn</strong>
                    </div>

                    {stats.waitingApproval > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-purple-600" />
                          <span className="font-bold text-purple-900">Chờ người bán duyệt / Đóng phí cọc</span>
                        </div>
                        <strong className="font-mono text-purple-700 text-sm font-black">{stats.waitingApproval} đơn</strong>
                      </div>
                    )}
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
                    onClick={openReadyDispatchQueue}
                    className="text-xs font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Vào bảng điều phối</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[960px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-4 w-[32%] min-w-[220px]">Mã Đơn & Sản Phẩm</th>
                        <th className="py-2.5 px-3 w-[14%] min-w-[120px]">Hình Thức</th>
                        <th className="py-2.5 px-3 w-[18%] min-w-[150px]">Người Bán / Mua</th>
                        <th className="py-2.5 px-3 w-[20%] min-w-[160px]">Trạng Thái</th>
                        <th className="py-2.5 px-4 w-[16%] min-w-[130px] text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {urgentDispatchOrders.slice(0, 5).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Tuyệt vời! Hiện tại không có đơn nào đang chờ phân công KTV.
                          </td>
                        </tr>
                      ) : (
                        urgentDispatchOrders
                          .slice(0, 5)
                          .map((order, idx) => {
                            return (
                              <tr key={order.id} className="hover:bg-slate-50/60 transition">
                                <td className="py-3 px-3 font-mono text-slate-400 text-[11px] text-center">{idx + 1}</td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900 truncate" title={order.postTitle}>{order.postTitle}</div>
                                  <div className="text-[10px] font-mono text-slate-400">ID: #{(order.id || '').slice(0, 8)}</div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                                    {order.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-[11px] text-slate-600">
                                  <div>Bán: {order.sellerName || 'Người bán'}</div>
                                  <div>Mua: {order.buyerName || 'Khách mua'}</div>
                                </td>
                                <td className="py-3 px-3">{renderStatusBadge(order)}</td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssign(order)}
                                    className="cursor-pointer rounded-lg bg-[#c34c36] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#a63f2d]"
                                  >
                                    Giao Task Ngay
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: DISPATCH & ASSIGN TASKS                                            */}
          {/* ========================================================================= */}
          {activeTab === 'dispatch' && (
            <section className="@container overflow-hidden rounded-xl border border-slate-200 border-t-4 border-t-[#c34c36] bg-white shadow-xs">
              <header className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#c34c36]/10 text-[#c34c36]">
                  <Briefcase aria-hidden="true" className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h2 className="text-sm font-extrabold text-slate-900 sm:text-base">Hàng đợi điều phối</h2>
                    <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-bold text-slate-700">
                      {dispatchOrders.length} đơn
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">Tiếp nhận kiện hàng tại Hub, giao task và đổi kỹ thuật viên phụ trách.</p>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 @[34rem]:grid-cols-2 @[56rem]:grid-cols-[2fr_1fr_1fr]">
                <div className="relative @[34rem]:col-span-2 @[56rem]:col-span-1">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    aria-label="Tìm đơn điều phối"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã đơn, sản phẩm, người mua hoặc người bán"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 focus-visible:outline-[#c34c36]"
                  />
                </div>
                <select
                  aria-label="Hình thức kiểm định"
                  value={orderMethodFilter}
                  onChange={(e) => setOrderMethodFilter(e.target.value as typeof orderMethodFilter)}
                  className="h-10 w-full min-w-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 focus-visible:outline-[#c34c36]"
                >
                  <option value="ALL">Tất cả hình thức</option>
                  <option value="AT_CENTER">Kiểm định tại Hub</option>
                  <option value="AT_HOME">Kiểm định tại nhà</option>
                </select>
                <select
                  aria-label="Giai đoạn điều phối"
                  value={dispatchFilter}
                  onChange={(e) => setDispatchFilter(e.target.value as DispatchFilter)}
                  className="h-10 w-full min-w-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 focus-visible:outline-[#c34c36]"
                >
                  <option value="ALL">Tất cả giai đoạn</option>
                  <option value="WAITING_CENTER_APPROVAL">Chờ Hub duyệt lịch hẹn (Tại nhà)</option>
                  <option value="WAITING_SELLER_APPROVAL">Chờ Seller phản hồi lịch (Tại nhà)</option>
                  <option value="WAITING_SELLER_APPOINTMENT">Chờ người bán hẹn lịch (Tại nhà)</option>
                  <option value="WAITING_FOR_HUB">Chờ nhận hàng tại Hub</option>
                  <option value="READY_TO_ASSIGN">Sẵn sàng giao KTV (Đã chốt lịch)</option>
                  <option value="ASSIGNED">Đã phân công KTV</option>
                </select>
              </div>

              <table aria-label="Hàng đợi điều phối kiểm định" role="table" className="block w-full text-left text-xs @[56rem]:table @[56rem]:table-fixed">
                <thead role="rowgroup" className="hidden border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600 @[56rem]:table-header-group">
                  <tr role="row">
                    <th scope="col" className="w-[5%] px-2 py-3 text-center">#</th>
                    <th scope="col" className="w-[31%] px-4 py-3">Sản phẩm &amp; mã đơn</th>
                    <th scope="col" className="w-[14%] px-4 py-3">Hình thức &amp; phí</th>
                    <th scope="col" className="w-[17%] px-4 py-3">Kỹ thuật viên</th>
                    <th scope="col" className="w-[19%] px-4 py-3">Trạng thái</th>
                    <th scope="col" className="w-[14%] px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="block divide-y divide-slate-100 @[56rem]:table-row-group">
                  {isLoadingOrders || filteredOrders.length === 0 ? (
                    <tr role="row" className="block @[56rem]:table-row">
                      <td role="cell" colSpan={6} className="block px-4 py-12 text-center text-slate-600 @[56rem]:table-cell">
                        {isLoadingOrders ? (
                          <span role="status">
                            <Loader2 aria-hidden="true" className="mx-auto mb-2 size-6 animate-spin text-[#c34c36]" />
                            Đang tải hàng đợi điều phối…
                          </span>
                        ) : dispatchOrders.length === 0 ? 'Hiện chưa có đơn trong hàng đợi điều phối.' : 'Không có đơn phù hợp với bộ lọc.'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(({ order, stage }, index) => {
                      const thumbnail = order.postImageUrls?.[0] || order.postImageUrl;
                      const assigned = Boolean(order.inspectorId);
                      const inspectorName = order.inspectorName && order.inspectorName !== 'Chưa phân công'
                        ? order.inspectorName : 'Kỹ thuật viên';
                      const waitingForHub = stage === 'WAITING_FOR_HUB';
                      const waitingSellerAppt = stage === 'WAITING_SELLER_APPOINTMENT';
                      const waitingCenterApproval = stage === 'WAITING_CENTER_APPROVAL';
                      const waitingSellerCounter = stage === 'WAITING_SELLER_APPROVAL';
                      const actionLabel = waitingForHub
                        ? 'Nhận tại Hub'
                        : waitingSellerAppt
                          ? 'Chờ hẹn lịch'
                          : waitingCenterApproval
                            ? 'Duyệt lịch hẹn'
                            : waitingSellerCounter
                              ? 'Xem phản hồi'
                              : assigned
                                ? 'Đổi KTV'
                                : 'Giao task';
                      const ActionIcon = waitingForHub
                        ? PackageCheck
                        : waitingSellerAppt
                          ? Clock
                          : waitingCenterApproval
                            ? CalendarCheck
                            : waitingSellerCounter
                              ? CalendarSync
                              : assigned
                                ? UserCheck
                                : UserPlus;
                      return (
                        <tr key={order.id} role="row" className="grid grid-cols-2 items-center gap-3 px-4 py-3 transition hover:bg-slate-50/70 @[56rem]:table-row @[56rem]:p-0">
                          <td role="cell" className="hidden px-2 py-3 text-center font-mono text-slate-500 @[56rem]:table-cell">{index + 1}</td>
                          <td role="cell" className="col-span-2 min-w-0 @[56rem]:px-4 @[56rem]:py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              {thumbnail ? (
                                <img src={thumbnail} alt="" className="size-10 shrink-0 rounded-lg border border-slate-200 object-cover" />
                              ) : (
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                  <Layers aria-hidden="true" className="size-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="line-clamp-2 break-words font-bold text-slate-900" title={order.postTitle}>{order.postTitle || 'Sản phẩm kiểm định'}</div>
                                <div className="mt-0.5 font-mono text-[11px] text-slate-500" title={order.id}>#{order.id.slice(0, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td role="cell" className="min-w-0 @[56rem]:px-4 @[56rem]:py-3">
                            <div className="mb-0.5 text-[10px] font-bold uppercase text-slate-500 @[56rem]:hidden">Hình thức &amp; phí</div>
                            <div className="font-semibold text-slate-800">{order.orderType === 'AT_HOME' ? 'Tại nhà' : 'Tại Hub'}</div>
                            {order.orderType === 'AT_HOME' && order.appointmentScheduledAt && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 w-fit">
                                <Calendar className="size-3 text-amber-700 shrink-0" />
                                <span className="truncate">
                                  {new Date(order.appointmentScheduledAt).toLocaleString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    day: '2-digit',
                                    month: '2-digit',
                                  })}
                                </span>
                              </div>
                            )}
                            <div className="mt-0.5 text-[11px] tabular-nums text-slate-600">
                              {order.inspectionFee == null ? 'Chưa có phí' : formatVND(order.inspectionFee)}
                            </div>
                          </td>
                          <td role="cell" className="min-w-0 @[56rem]:px-4 @[56rem]:py-3">
                            <div className="mb-0.5 text-[10px] font-bold uppercase text-slate-500 @[56rem]:hidden">Kỹ thuật viên</div>
                            {assigned ? (
                              <div className="flex items-center gap-2">
                                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                                  {inspectorName.charAt(0).toUpperCase()}
                                </span>
                                <span className="line-clamp-2 break-words font-semibold text-slate-800" title={inspectorName}>{inspectorName}</span>
                              </div>
                            ) : waitingSellerAppt ? (
                              <span className="font-medium text-amber-700 italic text-[11px]">Chờ người bán hẹn lịch</span>
                            ) : (
                              <span className="font-medium text-slate-600">Chưa phân công</span>
                            )}
                          </td>
                          <td role="cell" className="min-w-0 @[56rem]:px-4 @[56rem]:py-3 [&_span]:whitespace-normal">
                            {renderStatusBadge(order)}
                          </td>
                          <td role="cell" className="min-w-0 text-right @[56rem]:px-4 @[56rem]:py-3 @[56rem]:text-center">
                            <button
                              type="button"
                              disabled={waitingSellerAppt}
                              onClick={() => {
                                if (waitingForHub) {
                                  handleReceivePackageAtHub(order.id, order.postTitle);
                                } else if (waitingCenterApproval || waitingSellerCounter) {
                                  handleOpenReviewAppointment(order);
                                } else {
                                  handleOpenAssign(order);
                                }
                              }}
                              className={`inline-flex min-h-9 w-full max-w-32 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                                waitingSellerAppt
                                  ? 'border-amber-200 bg-amber-50 text-amber-800 cursor-not-allowed opacity-80'
                                  : waitingForHub
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                                    : waitingCenterApproval
                                      ? 'border-amber-500 bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-xs'
                                      : waitingSellerCounter
                                        ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 cursor-pointer shadow-xs'
                                        : assigned
                                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer'
                                          : 'border-[#c34c36] bg-[#c34c36] text-white hover:bg-[#a63f2d] cursor-pointer'
                              }`}
                              title={
                                waitingSellerAppt
                                  ? 'Người bán chưa chọn lịch hẹn tại nhà. Bạn cần đợi người bán đặt lịch trước khi duyệt và phân công KTV.'
                                  : waitingCenterApproval
                                    ? 'Người bán đã đề xuất lịch hẹn. Bấm để duyệt, gửi lại lịch hoặc từ chối.'
                                    : waitingSellerCounter
                                      ? 'Trung tâm đã gửi đề xuất lịch mới. Bấm để xem lại hoặc điều chỉnh.'
                                      : undefined
                              }
                            >
                              <ActionIcon aria-hidden="true" className="size-3.5 shrink-0" />
                              {actionLabel}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs tabular-nums text-slate-600 sm:px-5">
                Hiển thị {filteredOrders.length} / {dispatchOrders.length} đơn trong hàng đợi
              </footer>
            </section>
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
                    Hệ thống phân quyền hiển thị các Kỹ thuật viên do chính Trung tâm của bạn quản lý. Để thêm kỹ thuật viên mới cho trạm, vui lòng bấm nút <strong>"+ Cấp Tài Khoản KTV Mới"</strong> bên trên.
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
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
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
              <div className="px-4 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#24263e] shrink-0" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    TOÀN BỘ LỊCH SỬ ĐƠN KIỂM ĐỊNH CỦA TRUNG TÂM
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                    {orderHistoryRows.length} đơn
                  </span>
                </div>
                <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                  Lọc theo thu phí
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                    value={feeFilter}
                    onChange={(event) => setFeeFilter(event.target.value as CenterFeeFilter | 'all')}
                  >
                    <option value="all">Tất cả</option>
                    {Object.entries(centerFeeFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              {visibleOrderHistory?.refreshFailed && (
                <p role="alert" className="mx-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Tải dữ liệu thu phí thất bại. Bấm Làm mới để thử lại.
                </p>
              )}
              {visibleOrderHistory && visibleOrderHistory.total > visibleOrderHistory.items.length && (
                <p className="mx-4 text-xs text-slate-600">Bộ lọc áp dụng cho {visibleOrderHistory.items.length} đơn gần nhất trong tổng số {visibleOrderHistory.total} đơn.</p>
              )}

              <div className="overflow-x-auto">
                <table role="table" className="block w-full text-left text-xs xl:table">
                  <thead role="rowgroup" className="block xl:table-header-group">
                    <tr role="row" className="grid grid-cols-2 bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-wider md:grid-cols-3 xl:table-row">
                      <th role="columnheader" className="hidden py-2.5 px-3 text-center xl:table-cell">#</th>
                      <th role="columnheader" className="py-2.5 px-4 xl:w-[22%]">Mã Đơn & Sản Phẩm</th>
                      <th role="columnheader" className="hidden py-2.5 px-4 xl:table-cell xl:w-[15%]">Người Bán / Khách Mua</th>
                      <th role="columnheader" className="hidden py-2.5 px-4 xl:table-cell xl:w-[9%]">Hình Thức</th>
                      <th role="columnheader" className="hidden py-2.5 px-4 xl:table-cell xl:w-[11%]">Kỹ Thuật Viên</th>
                      <th role="columnheader" className="py-2.5 px-4 xl:w-[24%]">Trạng thái đơn</th>
                      <th role="columnheader" className="hidden py-2.5 px-4 md:block xl:table-cell xl:w-[16%]">Thanh toán kiểm định</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup" className="block divide-y divide-slate-100 xl:table-row-group">
                    {orderHistoryRows.length === 0 ? (
                      <tr role="row" className="block xl:table-row">
                        <td role="cell" colSpan={7} className="block py-12 text-center text-slate-500 xl:table-cell">
                          {isLoadingOrders || !visibleOrderHistory ? 'Đang tải danh sách đơn kiểm định…'
                            : visibleOrderHistory.refreshFailed && visibleOrderHistory.items.length === 0 ? 'Chưa tải được danh sách đơn.'
                              : feeFilter !== 'all' ? 'Không có đơn phù hợp với bộ lọc thu phí.'
                                : 'Chưa có đơn kiểm định nào trong lịch sử trạm.'}
                        </td>
                      </tr>
                    ) : (
                      orderHistoryRows.map(({ order: ord, fees, collectionClosed, isReturning }, idx) => {
                        const shipment = inboundShipments.get(ord.id);
                        const buyerShipment = buyerShipments.get(ord.id);
                        const isAtCenter = ord.orderType === 'AT_CENTER' || !ord.orderType || (ord as any).inspectionMethod === 'AT_CENTER';
                        const paidHubDelivery = isPaidHubBuyerDelivery(ord);
                        const hasCertificate = getInspectionTaskStage(ord.status) === 'completed';
                        const canViewInbound = isAtCenter && !paidHubDelivery && !isHubReturnCase(ord) &&
                          (shouldTrackInboundShipment(ord) || hasCertificate) &&
                          canReadCenterInspectionShipments(ord, currentUser?.id) && !deniedShipmentOrders.has(ord.id);
                        const returnState = hubReturns.get(ord.id);
                        const returnShipment = returnState?.shipment;
                        const canBookReturn = returnState?.received && canBookHubBuyerDelivery(returnShipment) &&
                          isCenterReturnEligible(ord, currentUser?.id, currentUser?.role);
                        const progress = shipment ? getInboundShipmentProgress(shipment) : null;

                        // Xác định xem kiện hàng từ Seller về Hub đã hoàn thành giao hay chưa
                        const isInboundDelivered = Boolean(
                          isAtCenter && (
                            (shipment && (shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED' || shipment.providerStatus === 'COMPLETED')) ||
                            progress?.step === 3 ||
                            isOrderReceivedAtHub(ord)
                          )
                        );

                        // Tự động ẩn / thu gọn tiến trình Chặng 1 sau 15 phút từ lúc nhận hàng tại Hub
                        const isInboundOver15Min = Boolean(
                          isInboundDelivered && (() => {
                            if (returnShipment || buyerShipment) return true;
                            const rawDelivered = shipment?.deliveredAt || (shipment as any)?.completedAt || (shipment as any)?.updatedAt || ord.updatedAt || ord.createdAt;
                            if (rawDelivered) {
                              const ts = new Date(rawDelivered).getTime();
                              if (!isNaN(ts) && (Date.now() - ts > 15 * 60 * 1000)) return true;
                            }
                            if (typeof window !== 'undefined' && ord.id) {
                              const key = `inbound_delivered_ts_${ord.id}`;
                              const stored = localStorage.getItem(key);
                              if (stored) {
                                const storedTs = Number(stored);
                                if (!isNaN(storedTs) && (Date.now() - storedTs > 15 * 60 * 1000)) return true;
                              } else {
                                if (hasCertificate) {
                                  localStorage.setItem(key, String(Date.now() - 20 * 60 * 1000));
                                  return true;
                                }
                                localStorage.setItem(key, String(Date.now()));
                              }
                            }
                            return false;
                          })()
                        );

                        const isExpandedInbound = expandedInboundOrderId === ord.id;
                        const isExpandedReturn = expandedReturnOrderId === ord.id;
                        const isExpandedBuyer = expandedBuyerOrderId === ord.id;
                        const isExpandedFees = expandedFeeOrderId === ord.id;
                        const hasAnyExpanded = isExpandedFees || isExpandedInbound || isExpandedReturn || isExpandedBuyer;
                        const inboundProgressId = `inbound-progress-${ord.id}`;
                        const returnProgressId = `return-progress-${ord.id}`;
                        const buyerProgressId = `buyer-progress-${ord.id}`;
                        const feeDetailsId = `fee-details-${ord.id}`;
                        const hasInboundInfo = isAtCenter && (shipment || progress || shouldTrackInboundShipment(ord) || canViewInbound || isInboundDelivered);

                        return (
                          <React.Fragment key={ord.id}>
                            <tr
                              role="row"
                              className={`grid grid-cols-2 transition md:grid-cols-3 xl:table-row ${hasAnyExpanded
                                ? 'bg-amber-50/30 border-l-4 border-l-[#c34c36] shadow-xs'
                                : 'hover:bg-slate-50/60'
                                }`}
                            >
                              <td role="cell" className="hidden py-3 px-3 font-mono text-slate-400 text-[11px] text-center xl:table-cell">{idx + 1}</td>
                              <td role="cell" className="min-w-0 py-3 px-4">
                                <div className="break-words font-bold text-slate-900" title={ord.postTitle}>{ord.postTitle}</div>
                                <div className="break-all text-[10px] font-mono text-slate-400">ID: #{ord.id}</div>
                                <div className="text-[11px] font-bold text-[#c34c36] font-mono">
                                  {formatVND(ord.postPrice || 0)}
                                </div>
                                <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 xl:hidden">
                                  <div>Bán: {ord.sellerName || 'Người bán'}</div>
                                  <div>Mua: {ord.buyerName || 'Khách mua'}</div>
                                  <div>{ord.orderType === 'AT_HOME' ? 'Tại nhà' : 'Tại Hub'} · {ord.inspectorName || 'Chưa phân công KTV'}</div>
                                </div>
                              </td>
                              <td role="cell" className="hidden py-3 px-4 text-[11px] text-slate-600 xl:table-cell">
                                <div>Bán: {ord.sellerName || 'Người bán'}</div>
                                <div>Mua: {ord.buyerName || 'Khách mua'}</div>
                              </td>
                              <td role="cell" className="hidden py-3 px-4 text-[11px] xl:table-cell">
                                {ord.orderType === 'AT_HOME' ? 'Tại Nhà Khách' : 'Tại Lab Hub'}
                              </td>
                              <td role="cell" className="hidden py-3 px-4 xl:table-cell">
                                {ord.inspectorName ? (
                                  <span className="font-bold text-slate-800">{ord.inspectorName}</span>
                                ) : (
                                  <span className="text-slate-400 italic">Chưa phân công</span>
                                )}
                              </td>
                              <td role="cell" className="min-w-0 py-3 px-4 [&_span]:whitespace-normal space-y-2">
                                {/* 1. Trạng thái biên bản kiểm định & Nút xem biên bản */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {renderStatusBadge(ord)}
                                  {hasCertificate && (
                                    <button
                                      type="button"
                                      onClick={() => void handleOpenInspectionCertificate(ord.id)}
                                      disabled={loadingCertificateId !== null}
                                      aria-busy={loadingCertificateId === ord.id}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-wait shadow-2xs cursor-pointer"
                                    >
                                      {loadingCertificateId === ord.id
                                        ? <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
                                        : <Eye aria-hidden="true" className="size-3.5 shrink-0" />}
                                      Xem biên bản
                                    </button>
                                  )}
                                </div>

                                {/* 2. CHẶNG 1: VẬN CHUYỂN TỪ NGƯỜI BÁN VỀ HUB (KIỂM ĐỊNH) */}
                                {hasInboundInfo && (
                                  <div className={`rounded-xl border p-2.5 text-[11px] transition-all shadow-2xs ${isInboundOver15Min
                                    ? 'border-blue-200/80 bg-blue-50/40 text-slate-700'
                                    : 'border-blue-200 bg-blue-50/70 text-blue-950'
                                    }`}>
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold">
                                      <span className="flex items-center gap-1.5 text-blue-950">
                                        <Truck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                        Chặng 1: Người bán → Hub
                                      </span>
                                      {isInboundOver15Min ? (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                                          <Check className="h-3 w-3" />
                                          Đã nhận tại Hub (&gt;15 phút)
                                        </span>
                                      ) : (
                                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                                          {progress?.label || (isInboundDelivered ? 'Đã nhận tại Hub' : 'Đang điều phối')}
                                        </span>
                                      )}
                                    </div>

                                    {shipment && <InspectionCashShipmentStatus shipment={shipment} />}
                                    {shipment?.orderCode && (
                                      <div className="mt-1 font-mono text-[10px] text-slate-600">
                                        Lalamove #{shipment.orderCode}
                                      </div>
                                    )}

                                    {shouldTrackInboundShipment(ord) && !shipment &&
                                      (!canReadCenterInspectionShipments(ord, currentUser?.id) || deniedShipmentOrders.has(ord.id)) && (
                                        <div className="mt-1 text-[10px] text-slate-500">
                                          {ord.inspectionCenterId ? 'Trung tâm chưa có quyền xem vận đơn.' : 'Đơn chưa gắn trung tâm tiếp nhận.'}
                                        </div>
                                      )}

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {canViewInbound && (
                                        <button
                                          type="button"
                                          onClick={() => void handleOpenShipmentModal(ord)}
                                          className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline cursor-pointer"
                                        >
                                          <Eye className="h-3 w-3" />
                                          Vận đơn về Hub
                                        </button>
                                      )}
                                      {progress && (
                                        <button
                                          type="button"
                                          aria-expanded={isExpandedInbound}
                                          aria-controls={isExpandedInbound ? inboundProgressId : undefined}
                                          onClick={() => setExpandedInboundOrderId(isExpandedInbound ? null : ord.id)}
                                          className="inline-flex items-center gap-1 font-bold text-blue-800 hover:underline focus-visible:outline-blue-700 cursor-pointer"
                                        >
                                          {isInboundOver15Min ? (
                                            <>
                                              <RotateCcw className="h-3 w-3" />
                                              {isExpandedInbound ? 'Ẩn tiến trình Chặng 1' : 'Mở lại xem tiến trình Chặng 1 (Seller → Hub)'}
                                            </>
                                          ) : (
                                            <>
                                              {isExpandedInbound ? 'Ẩn tiến trình' : 'Xem tiến trình'}
                                            </>
                                          )}
                                          <ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform ${isExpandedInbound ? 'rotate-180' : ''}`} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* 3. CHẶNG HOÀN TRẢ: HUB ➔ NGƯỜI BÁN (KHI ĐƠN KHÔNG ĐẠT / TỪ CHỐI) */}
                                {(canBookReturn || returnShipment) && (
                                  <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-2.5 text-[11px] shadow-2xs">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold text-amber-950">
                                      <span className="flex items-center gap-1.5">
                                        <RotateCcw className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                        Chặng Hoàn Trả: Hub → Người bán
                                      </span>
                                      {returnShipment ? (
                                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                                          {getHubReturnProgress(returnShipment).label}
                                        </span>
                                      ) : (
                                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                          Chờ hoàn trả
                                        </span>
                                      )}
                                    </div>

                                    {canBookReturn && (
                                      <div className="mt-2">
                                        <button
                                          type="button"
                                          disabled={bookingReturnId !== null}
                                          onClick={() => setReturnQuoteOrder(ord)}
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-amber-800 disabled:opacity-60 transition cursor-pointer"
                                        >
                                          <Truck className="h-3.5 w-3.5" />
                                          {bookingReturnId === ord.id ? 'Đang xử lý…' : 'Tạo vận đơn trả Seller'}
                                        </button>
                                      </div>
                                    )}

                                    {returnShipment && (
                                      <div className="mt-1.5 space-y-1.5">
                                        <InspectionCashShipmentStatus shipment={returnShipment} />
                                        {returnShipment.status === 'DELIVERED' && ord.cashShippingSimulation === false && !returnShipment.cashPayerId && (
                                          <p className="text-[11px] text-amber-900">Cước hoàn đối soát từ khoản dự phòng. Phần dư hoàn cho bên đã nộp.</p>
                                        )}
                                        <div className="font-mono text-[10px] text-slate-700">
                                          Mã vận đơn: <span className="font-bold">{returnShipment.orderCode ? `#${returnShipment.orderCode}` : `#${returnShipment.shipmentId}`}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => void handleOpenShipmentModal(ord)}
                                            className="font-bold text-amber-800 hover:underline cursor-pointer"
                                          >
                                            Chi tiết vận đơn
                                          </button>
                                          <button
                                            type="button"
                                            aria-expanded={isExpandedReturn}
                                            aria-controls={isExpandedReturn ? returnProgressId : undefined}
                                            onClick={() => setExpandedReturnOrderId(isExpandedReturn ? null : ord.id)}
                                            className="inline-flex items-center gap-1 font-bold text-amber-800 hover:underline cursor-pointer"
                                          >
                                            {isExpandedReturn ? 'Ẩn tiến trình' : 'Xem tiến trình hoàn trả'}
                                            <ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform ${isExpandedReturn ? 'rotate-180' : ''}`} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 4. CHẶNG GIAO HÀNG: HUB ➔ NGƯỜI MUA (KHI ĐƠN ĐẠT CHUẨN) */}
                                {(paidHubDelivery || buyerShipment) && (
                                  <div className="rounded-xl border border-teal-300 bg-teal-50/70 p-2.5 text-[11px] shadow-2xs">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold text-teal-950">
                                      <span className="flex items-center gap-1.5">
                                        <Truck className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                        Chặng Giao Hàng: Hub → Người mua
                                      </span>
                                      {buyerShipment && (
                                        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-900 border border-teal-300">
                                          {getHubBuyerShipmentLabel(buyerShipment)}
                                        </span>
                                      )}
                                    </div>

                                    {canBookHubBuyerDelivery(buyerShipment) ? (
                                      <div className="mt-2">
                                        <button
                                          type="button"
                                          disabled={bookingBuyerOrderId !== null}
                                          onClick={() => void handleBookBuyerDelivery(ord)}
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-teal-800 disabled:opacity-60 transition cursor-pointer"
                                        >
                                          <Truck className="h-3.5 w-3.5" />
                                          {bookingBuyerOrderId === ord.id ? 'Đang xử lý…' : 'Tạo vận đơn giao người mua'}
                                        </button>
                                      </div>
                                    ) : buyerShipment && (
                                      <div className="mt-1.5 space-y-1.5">
                                        <div className="font-mono text-[10px] text-slate-700">
                                          Mã vận đơn: <span className="font-bold">{buyerShipment.orderCode ? `#${buyerShipment.orderCode}` : `#${buyerShipment.shipmentId}`}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => void handleOpenShipmentModal(ord)}
                                            className="font-bold text-teal-800 hover:underline cursor-pointer"
                                          >
                                            Chi tiết vận đơn
                                          </button>
                                          <button
                                            type="button"
                                            aria-expanded={isExpandedBuyer}
                                            aria-controls={isExpandedBuyer ? buyerProgressId : undefined}
                                            onClick={() => setExpandedBuyerOrderId(isExpandedBuyer ? null : ord.id)}
                                            className="inline-flex items-center gap-1 font-bold text-teal-800 hover:underline cursor-pointer"
                                          >
                                            {isExpandedBuyer ? 'Ẩn tiến trình' : 'Xem tiến trình giao hàng'}
                                            <ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform ${isExpandedBuyer ? 'rotate-180' : ''}`} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td role="cell" className="col-span-2 min-w-0 space-y-1.5 border-t border-slate-100 px-4 py-3 align-top md:col-span-1 md:border-t-0">
                                <div className="font-bold text-slate-600 md:hidden">Thanh toán kiểm định</div>
                                <CenterInspectionFeeStatus fees={fees} collectionClosed={collectionClosed} isReturning={isReturning} hasResult={hasCertificate} />
                                <button
                                  type="button"
                                  aria-expanded={isExpandedFees}
                                  aria-controls={isExpandedFees ? feeDetailsId : undefined}
                                  onClick={() => setExpandedFeeOrderId(isExpandedFees ? null : ord.id)}
                                  className="flex w-fit items-center gap-1 rounded text-[11px] font-bold text-[#a83d2b] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                                >
                                  {isExpandedFees ? 'Ẩn chi tiết thu phí' : 'Chi tiết thu phí'}
                                  <ChevronDown aria-hidden="true" className={`size-3.5 ${isExpandedFees ? 'rotate-180' : ''}`} />
                                </button>
                              </td>
                            </tr>

                            {isExpandedFees && (
                              <tr role="row" id={feeDetailsId} className="block xl:table-row animate-fadeIn">
                                <td role="cell" colSpan={7} className="block bg-amber-50/20 px-4 py-3 xl:table-cell border-l-4 border-l-[#c34c36] border-b-2 border-b-[#c34c36]/20">
                                  <div className="rounded-2xl border-2 border-[#c34c36]/40 bg-white p-4 shadow-sm ring-4 ring-[#c34c36]/10 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#c34c36] animate-pulse" />
                                        <span className="font-extrabold text-[#24263e]">
                                          Chi tiết biểu phí &amp; quyết toán của đơn #{ord.id.slice(0, 8)}:
                                        </span>
                                        <span className="font-bold text-[#c34c36] truncate max-w-[280px] sm:max-w-md">
                                          {ord.postTitle}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedFeeOrderId(null)}
                                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                                      >
                                        ✕ Đóng chi tiết
                                      </button>
                                    </div>
                                    <CenterInspectionFees
                                      order={ord}
                                      fees={fees}
                                      collectionClosed={collectionClosed}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* Dòng mở rộng: Tiến trình Chặng 1 (Người bán → Hub) */}
                            {progress && isExpandedInbound && (
                              <tr role="row" id={inboundProgressId} className="block xl:table-row animate-fadeIn">
                                <td role="cell" colSpan={7} className="block bg-blue-50/30 px-4 py-3 xl:table-cell border-l-4 border-l-blue-600 border-b-2 border-b-blue-200">
                                  <div className="rounded-2xl border-2 border-blue-400/60 bg-white p-4 shadow-sm ring-4 ring-blue-500/10 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-blue-100 text-xs font-bold text-blue-900">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                                        <Truck className="h-4 w-4 text-blue-600" />
                                        <span>Lộ trình Chặng 1 của đơn #{ord.id.slice(0, 8)}: Người Bán ({ord.sellerName || 'Người bán'}) ➔ Hub ({ord.postTitle})</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedInboundOrderId(null)}
                                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition cursor-pointer"
                                      >
                                        ✕ Đóng tiến trình
                                      </button>
                                    </div>
                                    <LalamoveProgress
                                      title="Tiến trình vận chuyển Lalamove (Người bán → Hub)"
                                      routeBadge="Chặng 1: Seller ➔ Hub"
                                      currentStep={progress.step}
                                      completeCurrentStep={progress.step === 3}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* Dòng mở rộng: Tiến trình Chặng Hoàn Trả (Hub → Người bán) */}
                            {returnShipment && isExpandedReturn && (
                              <tr role="row" id={returnProgressId} className="block xl:table-row animate-fadeIn">
                                <td role="cell" colSpan={7} className="block bg-amber-50/30 px-4 py-3 xl:table-cell border-l-4 border-l-amber-600 border-b-2 border-b-amber-200">
                                  <div className="rounded-2xl border-2 border-amber-400/60 bg-white p-4 shadow-sm ring-4 ring-amber-500/10 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-amber-100 text-xs font-bold text-amber-900">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
                                        <RotateCcw className="h-4 w-4 text-amber-600" />
                                        <span>Lộ trình hoàn hàng của đơn #{ord.id.slice(0, 8)}: Hub ➔ Người Bán ({ord.sellerName || 'Người bán'})</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedReturnOrderId(null)}
                                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold transition cursor-pointer"
                                      >
                                        ✕ Đóng tiến trình
                                      </button>
                                    </div>
                                    <LalamoveProgress
                                      title="Tiến trình vận chuyển hoàn trả Lalamove (Hub → Người bán)"
                                      routeBadge="Chặng Hoàn Trả: Hub ➔ Seller"
                                      currentStep={getHubReturnProgress(returnShipment).step}
                                      completeCurrentStep={returnShipment.status === 'DELIVERED'}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* Dòng mở rộng: Tiến trình Chặng Giao Hàng (Hub → Người mua) */}
                            {buyerShipment && isExpandedBuyer && (
                              <tr role="row" id={buyerProgressId} className="block xl:table-row animate-fadeIn">
                                <td role="cell" colSpan={7} className="block bg-teal-50/30 px-4 py-3 xl:table-cell border-l-4 border-l-teal-600 border-b-2 border-b-teal-200">
                                  <div className="rounded-2xl border-2 border-teal-400/60 bg-white p-4 shadow-sm ring-4 ring-teal-500/10 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-teal-100 text-xs font-bold text-teal-900">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse" />
                                        <Truck className="h-4 w-4 text-teal-600" />
                                        <span>Lộ trình giao hàng của đơn #{ord.id.slice(0, 8)}: Hub ➔ Khách Mua ({ord.buyerName || 'Khách mua'})</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedBuyerOrderId(null)}
                                        className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-[11px] font-bold transition cursor-pointer"
                                      >
                                        ✕ Đóng tiến trình
                                      </button>
                                    </div>
                                    <LalamoveProgress
                                      title="Tiến trình vận chuyển giao hàng Lalamove (Hub → Khách mua)"
                                      routeBadge="Chặng Giao Hàng: Hub ➔ Buyer"
                                      currentStep={getInboundShipmentProgress(buyerShipment).step}
                                      completeCurrentStep={buyerShipment.status === 'DELIVERED'}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
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
                        <th className="py-3 px-4">Loại Thiết Bị (Item) & Cấp Độ</th>
                        <th className="py-3 px-4 text-center">Hạng Mục Tiêu Trí</th>
                        <th className="py-3 px-4 text-center">Trạng Thái Phê Duyệt</th>
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
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                    <Boxes className="w-3.5 h-3.5 text-[#c34c36]" />
                                    <span>{chk.itemName || chk.categoryName || 'Tất cả danh mục'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {chk.complexityLevel && (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${chk.complexityLevel === 'L1' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                        chk.complexityLevel === 'L2' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                          chk.complexityLevel === 'L3' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                            'bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}>
                                        Cấp {chk.complexityLevel}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      v{chk.revision || 1}
                                    </span>
                                  </div>
                                </div>
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
                                {chk.approvalStatus === 'APPROVED' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ĐÃ DUYỆT
                                  </span>
                                ) : chk.approvalStatus === 'PENDING_APPROVAL' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                    CHỜ DUYỆT
                                  </span>
                                ) : chk.approvalStatus === 'REJECTED' ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                      TỪ CHỐI
                                    </span>
                                    {chk.rejectReason && (
                                      <span className="text-[10px] text-rose-600 line-clamp-1 max-w-[120px]" title={chk.rejectReason}>
                                        {chk.rejectReason}
                                      </span>
                                    )}
                                  </div>
                                ) : chk.approvalStatus === 'WITHDRAWN' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                    ĐÃ RÚT
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                    {chk.approvalStatus || (chk.active !== false ? 'Đang Áp Dụng' : 'Tạm Dừng')}
                                  </span>
                                )}
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
                                  {chk.approvalStatus !== 'APPROVED' && chk.approvalStatus !== 'LEGACY' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteChecklist(chk)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                      title="Rút đề xuất bộ tiêu chuẩn"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <span
                                      className="p-1.5 text-slate-300 cursor-not-allowed"
                                      title="Không thể rút tiêu chuẩn đã được duyệt"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </span>
                                  )}
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
          {/* TAB 6: BIỂU PHÍ KIỂM ĐỊNH & BẬC CƯỚC DI CHUYỂN                      */}
          {/* =================================================================== */}
          {activeTab === 'pricing' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#c34c36]" />
                    <span>Biểu Phí Kiểm Định & Bậc Cước Di Chuyển KTV</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Biểu phí bậc thang phụ phí di chuyển theo khoảng cách km (gói kiểm định tận nhà AT_HOME) và danh sách đề xuất gửi Admin sàn
                  </p>
                </div>
                {canManageInspectionFee(currentUser) && (
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const availableLevel = (['L1', 'L2', 'L3', 'L4'] as InspectionComplexityLevel[]).find(
                          lvl => !getPendingProposalForLevel(lvl)
                        );
                        if (!availableLevel) {
                          dialogService.warning(
                            lang === 'vi'
                              ? 'Tất cả 4 cấp độ (L1–L4) đều đã có đề xuất biểu phí đang chờ Admin phê duyệt. Không thể gửi thêm để tránh trùng lặp.'
                              : 'All 4 levels already have pending proposals awaiting approval.'
                          );
                          return;
                        }
                        setProposingLevel(availableLevel);
                        const approved = currentLevelFees.find(f => f.complexityLevel === availableLevel);
                        setProposingLevelFeeAmount(approved?.baseInspectionFee || 100000);
                        setProposingLevelFeeError(null);
                        setIsProposeLevelFeeModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Đề Xuất Giá 4 Cấp Độ (L1–L4)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenProposeModal}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5 text-slate-500" />
                      <span>Đề Xuất Bậc Cước Km</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Scope & Policy Alert Box */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-slate-700 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">
                    Quy định biểu phí theo mô hình Item & Cấp độ L1–L4:
                  </p>
                  <p className="text-slate-600">
                    • <strong>Biểu phí 4 cấp độ (L1–L4):</strong> Mỗi trung tâm kiểm định đề xuất bảng giá riêng cho 4 cấp độ (L1, L2, L3, L4). Sau khi Quản trị viên sàn phê duyệt, bảng giá sẽ có hiệu lực chính thức cho trạm.
                  </p>
                  <p className="text-slate-600">
                    • <strong>Xác định giá đơn hàng:</strong> Khi người mua đặt lịch kiểm định cho sản phẩm, hệ thống căn cứ theo loại thiết bị cụ thể (Item) đã được Admin duyệt cấp độ nào (L1–L4) để áp mức phí kiểm định tương ứng của trung tâm được chọn.
                  </p>
                  <p className="text-slate-600">
                    • <strong>Bậc cước di chuyển:</strong> Áp dụng chung cho dịch vụ KTV kiểm định tại nhà theo số km thực tế.
                  </p>
                  <p className="text-slate-600">
                    • <strong>Giao hàng về Trung tâm:</strong> Cước vận chuyển sản phẩm đến Hub bằng Lalamove là khoản giao vận riêng biệt, không tính trong biểu phí kiểm định.
                  </p>
                </div>
              </div>

              {/* 4-Level Fees Studio Cards (L1 - L4) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#24263e] text-white flex items-center justify-center font-black">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                        Bảng Biểu Phí 4 Cấp Độ Kiểm Định (L1 – L4) Đang Áp Dụng
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Giá kiểm định cơ sở của trạm theo độ phức tạp kỹ thuật từng dòng thiết bị gia dụng (sau khi Admin duyệt)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal()}
                      className="px-3.5 py-1.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      title="Gửi đề xuất bộ tiêu chuẩn kiểm định và cấp độ L1-L4 cho loại sản phẩm"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cấu hình Item và cấp độ</span>
                    </button>

                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      level: 'L1' as InspectionComplexityLevel,
                      name: 'Cấp L1 - Cơ Bản',
                      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      borderColor: 'hover:border-emerald-300',
                    },
                    {
                      level: 'L2' as InspectionComplexityLevel,
                      name: 'Cấp L2 - Nâng Cao',
                      badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
                      borderColor: 'hover:border-blue-300',
                    },
                    {
                      level: 'L3' as InspectionComplexityLevel,
                      name: 'Cấp L3 - Chuyên Sâu',
                      badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
                      borderColor: 'hover:border-purple-300',
                    },
                    {
                      level: 'L4' as InspectionComplexityLevel,
                      name: 'Cấp L4 - Phức Tạp',
                      badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
                      borderColor: 'hover:border-rose-300',
                    },
                  ].map((tier) => {
                    const approvedFee = currentLevelFees.find(
                      (f) => String(f.complexityLevel || '').toUpperCase() === String(tier.level).toUpperCase() && (f.status === 'APPROVED' || !f.status)
                    );
                    const pendingProp = getPendingProposalForLevel(tier.level);
                    const levelItems = approvedItemsByLevel[tier.level] || [];

                    return (
                      <div
                        key={tier.level}
                        className={`rounded-2xl p-4 border flex flex-col justify-between transition ${pendingProp
                          ? 'bg-amber-50/30 border-amber-300 ring-2 ring-amber-100 shadow-xs'
                          : `bg-slate-50/60 border-slate-200 ${tier.borderColor} hover:shadow-xs`
                          }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${tier.badgeColor}`}>
                              {tier.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {tier.level}
                            </span>
                          </div>

                          {/* Dynamic Item list from approved active checklists */}
                          <div className="min-h-[46px]">
                            {levelItems.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-h-[76px] overflow-y-auto subtle-scrollbar py-0.5">
                                {levelItems.map((itm) => (
                                  <span
                                    key={itm.itemId}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-slate-200/90 text-slate-700 shadow-2xs"
                                    title={itm.checklistTitle || itm.itemName}
                                  >
                                    {itm.itemName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-[11px] text-slate-400 italic">
                                  Chưa có loại sản phẩm được phân cấp
                                </p>
                                {isLevelFeeApproved(tier.level) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCreateChecklistForItem(undefined, tier.level)}
                                    className="text-[10px] font-bold text-[#c34c36] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Cấu hình Item cho cấp {tier.level}</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/70 inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Chờ duyệt giá cấp {tier.level} trước khi gán Item</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-3.5 mt-3 border-t border-slate-200/70 flex flex-col justify-between flex-1 gap-2.5">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                              Phí kiểm định cơ sở
                            </span>
                            <div className="h-7 flex items-center mt-0.5">
                              {approvedFee && approvedFee.baseInspectionFee ? (
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-lg font-black text-[#24263e]">
                                    {formatVND(approvedFee.baseInspectionFee)}
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Hiệu lực
                                  </span>
                                </div>
                              ) : pendingProp ? (
                                <span className="text-xs font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-lg border border-amber-200 inline-block">
                                  Chờ duyệt lần đầu
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 inline-block">
                                  Chưa có giá được duyệt
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Đề xuất đang chờ duyệt (nếu có) - Có chiều cao đồng đều h-[42px] giữa các thẻ */}
                          <div className="h-[42px] flex items-center">
                            {pendingProp ? (
                              <div className="w-full p-2 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between text-xs shadow-2xs">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider block">
                                      Đang chờ duyệt
                                    </span>
                                    <span className="text-xs font-black text-amber-900 font-mono block leading-tight">
                                      {formatVND(pendingProp.baseInspectionFee || 0)}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-amber-700 font-mono font-bold shrink-0">
                                  #{pendingProp.id ? pendingProp.id.slice(0, 8) : ''}
                                </span>
                              </div>
                            ) : (
                              <div className="w-full h-full rounded-xl bg-slate-50/50 border border-dashed border-slate-200/80 flex items-center justify-center text-[10px] text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  <span>{approvedFee ? 'Đang áp dụng giá chuẩn' : 'Chưa có đề xuất mới'}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Nút hành động: Nếu đang chờ duyệt thì vô hiệu hóa nút để tránh gửi trùng lặp */}
                          <div>
                            {pendingProp ? (
                              <button
                                type="button"
                                disabled
                                className="w-full py-2 px-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 shadow-2xs"
                                title="Cấp độ này đã có đề xuất đang chờ Admin duyệt. Không thể gửi thêm để tránh trùng lặp."
                              >
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Đã gửi đề xuất (Chờ duyệt)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setProposingLevel(tier.level);
                                  setProposingLevelFeeAmount(approvedFee?.baseInspectionFee || 100000);
                                  setProposingLevelFeeError(null);
                                  setIsProposeLevelFeeModalOpen(true);
                                }}
                                className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-[#c34c36] hover:bg-rose-50/50 text-[#c34c36] text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Đề xuất giá cấp {tier.level}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Danh Sách Loại Sản Phẩm (Item) Chưa Được Phân Cấp */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                          Loại Sản Phẩm (Item) Chưa Được Phân Cấp
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${unclassifiedItems.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                          {unclassifiedItems.length} thiết bị
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Danh sách các loại sản phẩm chưa có bộ tiêu chuẩn được Admin phê duyệt cấp độ L1–L4. Trung tâm cần gửi đề xuất checklist để kích hoạt định giá cho dòng sản phẩm này.
                      </p>
                    </div>
                  </div>
                  {unclassifiedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal()}
                      className="px-3.5 py-1.5 rounded-xl bg-[#24263e] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cấu hình Item và cấp độ</span>
                    </button>
                  )}
                </div>

                {isLoadingChecklists || isLoadingCategories ? (
                  <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin mb-1 text-[#24263e]" />
                    <span className="text-xs">Đang kiểm tra danh mục thiết bị chưa phân cấp...</span>
                  </div>
                ) : unclassifiedItems.length === 0 ? (
                  <div className="py-6 text-center text-emerald-700 bg-emerald-50/50 rounded-xl border border-emerald-200 flex flex-col items-center justify-center">
                    <CheckSquare className="w-6 h-6 text-emerald-600 mb-1.5" />
                    <p className="font-bold text-xs">Tất cả các loại sản phẩm (Item) đều đã được phân cấp L1–L4 hợp lệ!</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Mọi thiết bị đều đã sẵn sàng áp dụng mức phí kiểm định khi người mua đặt dịch vụ.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {unclassifiedItems.map((itm) => (
                      <div
                        key={itm.id}
                        className="p-3 rounded-xl border border-slate-200 hover:border-amber-300 bg-slate-50/50 hover:bg-amber-50/20 transition flex items-center justify-between gap-2.5 group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-900 truncate" title={itm.name}>
                            {itm.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5" title={itm.categoryName}>
                            {itm.categoryName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {itm.pendingChecklist ? (
                            <span className="w-24 text-center px-1.5 py-1 rounded-lg text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200 shrink-0 whitespace-nowrap">
                              Chờ duyệt ({itm.pendingChecklist.complexityLevel})
                            </span>
                          ) : (
                            <span className="w-24 text-center px-1.5 py-1 rounded-lg text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 shrink-0 whitespace-nowrap">
                              Chưa cấu hình
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenCreateChecklistForItem(itm)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#c34c36] hover:bg-white text-slate-700 hover:text-[#c34c36] font-bold text-[11px] transition cursor-pointer shrink-0 shadow-2xs whitespace-nowrap"
                            title={`Cấu hình bộ tiêu chuẩn cho ${itm.name}`}
                          >
                            Cấu hình
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Active Travel Tiers Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-slate-500" />
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                      Bảng Bậc Thang Cước Di Chuyển Hiện Hành ({travelTiers.length} bậc)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Áp dụng chung toàn hệ thống</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                        <th className="py-3 px-4 w-16">Bậc</th>
                        <th className="py-3 px-4">Tên Bậc</th>
                        <th className="py-3 px-4">Khoảng Cách Áp Dụng</th>
                        <th className="py-3 px-4">Đơn Giá / km</th>
                        <th className="py-3 px-4 text-center">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingPricing && travelTiers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#24263e] mb-1" />
                            <span>Đang tải bảng bậc thang cước di chuyển...</span>
                          </td>
                        </tr>
                      ) : travelTiers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Chưa có dữ liệu bậc thang cước di chuyển từ hệ thống.
                          </td>
                        </tr>
                      ) : (
                        travelTiers.map((tier, idx) => (
                          <tr key={tier.tierNumber || idx} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-black text-slate-900">
                              #{tier.tierNumber || idx + 1}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {tier.name || `Bậc ${tier.tierNumber || idx + 1}`}
                            </td>
                            <td className="py-3 px-4 text-slate-700 font-mono">
                              {tier.fromKm ?? 0} km - {tier.toKm != null ? `${tier.toKm} km` : 'Không giới hạn (∞)'}
                            </td>
                            <td className="py-3 px-4 font-black text-[#c34c36] font-mono">
                              {formatVND(tier.pricePerKm || 0)} / km
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{tier.status || 'Đang áp dụng'}</span>
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Proposals History Section */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                      Lịch Sử Đề Xuất Biểu Phí 4 Cấp Độ (L1–L4) & Bậc Cước ({pricingProposalTotalElements} đề xuất)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Theo dõi tiến độ xét duyệt biểu phí cơ sở và bậc thang cước từ Quản trị viên sàn
                    </p>
                  </div>
                  <button
                    onClick={() => loadPricing(pricingProposalPage, pricingProposalFilter)}
                    disabled={isLoadingPricing}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-slate-600 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer self-start sm:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPricing ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 mr-1">Lọc trạng thái:</span>
                  {[
                    { key: 'ALL', label: 'Tất cả' },
                    { key: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
                    { key: 'APPROVED', label: 'Đã duyệt' },
                    { key: 'REJECTED', label: 'Đã từ chối' }
                  ].map((st) => (
                    <button
                      key={st.key}
                      onClick={() => handlePricingFilterChange(st.key as any)}
                      disabled={isLoadingPricing}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${pricingProposalFilter === st.key
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Proposals Table */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">Mã Đề Xuất</th>
                        <th className="py-2.5 px-3">Danh Mục Áp Dụng</th>
                        <th className="py-2.5 px-3">Phí Cơ Sở Đề Xuất</th>
                        <th className="py-2.5 px-3">Người Đề Xuất</th>
                        <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                        <th className="py-2.5 px-3">Phản Hồi Admin</th>
                        <th className="py-2.5 px-3">Thời Gian Gửi</th>
                        <th className="py-2.5 px-3 text-right">Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingPricing ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#24263e] mb-1" />
                            <span>Đang tải lịch sử đề xuất...</span>
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const seenIds = new Set<string>();
                          const combined = tierProposals.filter((p) => {
                            if (!p || !p.id) return false;
                            if (seenIds.has(p.id)) return false;
                            seenIds.add(p.id);
                            if (pricingProposalFilter !== 'ALL') {
                              const targetStatus = (pricingProposalFilter as string) === 'PENDING' ? 'PENDING_APPROVAL' : pricingProposalFilter;
                              if (p.status !== targetStatus) return false;
                            }
                            return true;
                          });
                          if (combined.length === 0) {
                            return (
                              <tr>
                                <td colSpan={9} className="py-8 text-center text-slate-400">
                                  Chưa có đề xuất biểu phí nào phù hợp với bộ lọc hiện tại.
                                </td>
                              </tr>
                            );
                          }
                          return combined.map((prop, idx) => (
                            <tr key={prop.id || `prop-${idx}`} className="hover:bg-slate-50/60 transition">
                              <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                                {pricingProposalPage * 10 + idx + 1}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-800">
                                #{prop.id ? prop.id.slice(0, 8) : '---'}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-700">
                                {prop.complexityLevel ? (
                                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${prop.complexityLevel === 'L1' ? 'bg-emerald-100 text-emerald-800' :
                                      prop.complexityLevel === 'L2' ? 'bg-blue-100 text-blue-800' :
                                        prop.complexityLevel === 'L3' ? 'bg-purple-100 text-purple-800' :
                                          'bg-rose-100 text-rose-800'
                                      }`}>
                                      Cấp {prop.complexityLevel}
                                    </span>
                                    {prop.categoryName && <span className="text-slate-500 text-[11px]">({prop.categoryName})</span>}
                                  </span>
                                ) : (
                                  prop.categoryName || 'Tất cả danh mục'
                                )}
                              </td>
                              <td className="py-3 px-3 font-black text-[#c34c36] font-mono">
                                {formatVND(prop.baseInspectionFee || 0)}
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                {prop.proposedByName || prop.proposedByEmail || 'TTKD'}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${prop.status === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : prop.status === 'REJECTED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800 animate-pulse'
                                    }`}
                                >
                                  {prop.status === 'APPROVED'
                                    ? 'Đã Phê Duyệt'
                                    : prop.status === 'REJECTED'
                                      ? 'Bị Từ Chối'
                                      : 'Chờ Admin Duyệt'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-500">
                                {prop.reviewedByName && (
                                  <span className="font-semibold text-slate-700 block">
                                    {prop.reviewedByName}
                                  </span>
                                )}
                                {prop.rejectReason ? (
                                  <span className="text-[11px] text-rose-600 font-medium">
                                    Lý do: {prop.rejectReason}
                                  </span>
                                ) : (
                                  !prop.reviewedByName && <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-400 text-[11px]">
                                {prop.createdAt ? new Date(prop.createdAt).toLocaleString('vi-VN') : '—'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => setSelectedProposalDetail(prop)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3 text-slate-500" />
                                  <span>Bậc phí</span>
                                </button>
                              </td>
                            </tr>
                          ));
                        })()
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pricingProposalTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">
                      Trang <strong>{pricingProposalPage + 1}</strong> / {pricingProposalTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadPricing(pricingProposalPage - 1, pricingProposalFilter, false)}
                        disabled={pricingProposalPage <= 0 || isLoadingPricing}
                        className="px-3 py-1 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Trước</span>
                      </button>
                      <button
                        onClick={() => loadPricing(pricingProposalPage + 1, pricingProposalFilter, false)}
                        disabled={pricingProposalPage >= pricingProposalTotalPages - 1 || isLoadingPricing}
                        className="px-3 py-1 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <span>Sau</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* =================================================================== */}
          {/* TAB 7: QUẢN LÝ KHIẾU NẠI KIỂM ĐỊNH (APPEALS)                        */}
          {/* =================================================================== */}
          {activeTab === 'appeals' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    <span>Quản Lý Khiếu Nại Kiểm Định Của Người Bán</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Xét duyệt các đơn khiếu nại kết quả FAILED trong thời hạn 24h. Bác bỏ (UPHELD) để giữ nguyên phạt hoặc Chấp thuận (OVERTURNED) để miễn trừ phạt.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    {stats.pendingAppeals} Đơn Chờ Xét Duyệt
                  </span>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-bold text-slate-400 uppercase">Tổng Khiếu Nại</div>
                  <div className="text-2xl font-black text-slate-800 mt-1">{stats.totalAppeals}</div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
                  <div className="text-xs font-bold text-amber-700 uppercase">Chờ Xét Duyệt</div>
                  <div className="text-2xl font-black text-amber-600 mt-1">{stats.pendingAppeals}</div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-red-200 bg-red-50/30 shadow-xs">
                  <div className="text-xs font-bold text-red-700 uppercase">Đã Bác Bỏ (UPHELD)</div>
                  <div className="text-2xl font-black text-red-600 mt-1">
                    {orders.filter((o) => o.appealStatus === 'UPHELD').length}
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
                  <div className="text-xs font-bold text-emerald-700 uppercase">Chấp Thuận (OVERTURNED)</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {orders.filter((o) => o.appealStatus === 'OVERTURNED').length}
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {(['ALL', 'PENDING_REVIEW', 'UPHELD', 'OVERTURNED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAppealFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${appealFilter === st
                        ? 'bg-[#24263e] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {st === 'ALL'
                        ? 'Tất Cả'
                        : st === 'PENDING_REVIEW'
                          ? 'Chờ Duyệt'
                          : st === 'UPHELD'
                            ? 'Đã Bác Bỏ'
                            : 'Đã Chấp Thuận'}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={appealSearchTerm}
                    onChange={(e) => setAppealSearchTerm(e.target.value)}
                    placeholder="Tìm theo sản phẩm, mã đơn..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#24263e]"
                  />
                </div>
              </div>

              {/* Appeals Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Đơn Hàng & Sản Phẩm</th>
                        <th className="py-3 px-4">Người Bán</th>
                        <th className="py-3 px-4">KTV & Đánh Giá</th>
                        <th className="py-3 px-4">Lý Do Khiếu Nại</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                        <th className="py-3 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {orders
                        .filter((o) => {
                          const hasAppeal = (o.appealStatus && o.appealStatus !== 'NONE') || o.status === 'FAILED';
                          if (!hasAppeal) return false;
                          if (appealFilter !== 'ALL' && o.appealStatus !== appealFilter) return false;
                          if (appealSearchTerm) {
                            const term = appealSearchTerm.toLowerCase();
                            const matchTitle = (o.postTitle || '').toLowerCase().includes(term);
                            const matchId = (o.id || '').toLowerCase().includes(term);
                            const matchSeller = (o.sellerName || '').toLowerCase().includes(term);
                            return matchTitle || matchId || matchSeller;
                          }
                          return true;
                        })
                        .map((ord) => {
                          const isPending = ord.appealStatus === 'PENDING_REVIEW';
                          return (
                            <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{ord.postTitle || 'Sản phẩm kiểm định'}</div>
                                <div className="text-[11px] text-slate-400 font-mono">#{ord.id.slice(0, 8)}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">{ord.sellerName || 'Người bán'}</div>
                                {ord.sellerPhone && (
                                  <div className="text-[11px] text-slate-400">{ord.sellerPhone}</div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="text-slate-800">{ord.inspectorName || 'KTV trạm'}</div>
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                  Score: {ord.conditionScore ?? 0}/100 ({ord.conditionGrade || 'POOR'})
                                </span>
                              </td>
                              <td className="py-3 px-4 max-w-xs">
                                <p className="line-clamp-2 text-slate-600">
                                  {ord.appealReason || (ord.status === 'FAILED' ? 'Chưa nộp đơn khiếu nại' : '-')}
                                </p>
                              </td>
                              <td className="py-3 px-4">
                                {ord.appealStatus === 'PENDING_REVIEW' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    <Clock className="w-3 h-3 animate-spin" />
                                    Chờ Xét Duyệt
                                  </span>
                                ) : ord.appealStatus === 'UPHELD' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                                    <XCircle className="w-3 h-3" />
                                    Đã Bác Bỏ
                                  </span>
                                ) : ord.appealStatus === 'OVERTURNED' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Đã Chấp Thuận
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                                    {ord.status === 'FAILED' ? 'Chưa Khiếu Nại' : ord.appealStatus || 'Không có'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isPending ? (
                                  <button
                                    type="button"
                                    onClick={() => setReviewingAppealOrder(ord)}
                                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                                  >
                                    Xét Duyệt Phán Quyết
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setReviewingAppealOrder(ord)}
                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                                  >
                                    Xem Chi Tiết
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 8: THÔNG TIN TRUNG TÂM (CENTER PROFILE & SHIPPING ADDRESS)      */}
          {/* =================================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-fadeIn">
              <InspectionCenterProfileTab
                profile={centerProfile}
                isLoading={isLoadingCenterProfile}
                error={centerProfileError}
                onRefresh={loadCenterProfile}
                onProfileUpdated={handleProfileUpdated}
                lang={lang}
              />
            </div>
          )}

          {activeTab === 'wallet' && (
            <CenterWalletTab
              lang={lang}
              onNavigateToOrder={(orderId) => {
                setFeeFilter('all');
                setExpandedFeeOrderId(orderId);
                setActiveTab('orders');
              }}
            />
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
              {/* Item, Category & Complexity Level Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Danh mục thiết bị <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => {
                      const catId = e.target.value;
                      setSelectedCategoryId(catId);
                      setSelectedItemId('');
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:border-[#c34c36]"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Loại thiết bị cụ thể (Item) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedItemId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedItemId(val);
                      if (val) {
                        const itm = catalogItems.find(i => i.id === val);
                        if (itm) {
                          if (itm.categoryId && !selectedCategoryId) setSelectedCategoryId(itm.categoryId);
                          if (!checklistTitle) {
                            setChecklistTitle(`Tiêu chuẩn kiểm định ${itm.name}`);
                          }
                        }
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:outline-none focus:border-[#c34c36]"
                  >
                    <option value="">-- Chọn loại thiết bị --</option>
                    {catalogItems
                      .filter(i => (!selectedCategoryId || i.categoryId === selectedCategoryId) && i.selectable !== false)
                      .map((itm) => {
                        const hasPending = checklists.some(c => c.itemId === itm.id && c.approvalStatus === 'PENDING_APPROVAL' && c.id !== editingChecklistId);
                        return (
                          <option key={itm.id} value={itm.id}>
                            {itm.name}{hasPending ? ' (Đang chờ Admin duyệt)' : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      Cấp độ kiểm định đề xuất <span className="text-rose-500">*</span>
                    </label>
                    {isLevelFeeApproved(selectedComplexityLevel) ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Giá đã duyệt: {formatVND(getApprovedFeeForLevel(selectedComplexityLevel)?.baseInspectionFee || 0)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                        Chưa duyệt giá
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedComplexityLevel}
                    onChange={(e) => setSelectedComplexityLevel(e.target.value as InspectionComplexityLevel)}
                    className={`w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs focus:outline-none ${isLevelFeeApproved(selectedComplexityLevel)
                      ? 'border-slate-200 text-slate-800 focus:border-[#c34c36]'
                      : 'border-amber-300 text-amber-900 bg-amber-50/30 focus:border-amber-500'
                      }`}
                  >
                    {[
                      { level: 'L1' as InspectionComplexityLevel, label: 'L1 - Cơ bản (Quạt, ấm, bàn ủi...)' },
                      { level: 'L2' as InspectionComplexityLevel, label: 'L2 - Nâng cao (Nồi cơm, lò vi sóng, hút bụi...)' },
                      { level: 'L3' as InspectionComplexityLevel, label: 'L3 - Chuyên sâu (Máy giặt, máy sấy, máy rửa chén...)' },
                      { level: 'L4' as InspectionComplexityLevel, label: 'L4 - Phức tạp (Tủ lạnh Side-by-Side, điều hòa...)' },
                    ].map((opt) => {
                      const approved = isLevelFeeApproved(opt.level);
                      const pending = Boolean(getPendingProposalForLevel(opt.level));
                      return (
                        <option
                          key={opt.level}
                          value={opt.level}
                          disabled={!approved}
                          className={!approved ? 'text-slate-400 bg-slate-100' : 'text-slate-900'}
                        >
                          {opt.label} {approved ? '✓ (Giá đã duyệt)' : pending ? '⚠ (Đang chờ Admin duyệt giá)' : '✕ (Chưa có giá duyệt)'}
                        </option>
                      );
                    })}
                  </select>

                  {!isLevelFeeApproved(selectedComplexityLevel) && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 shadow-2xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-[11px]">
                          Cấp độ {selectedComplexityLevel} chưa có mức phí kiểm định được phê duyệt!
                        </p>
                        <p className="text-[10px] text-amber-700 leading-relaxed">
                          Theo quy định, trung tâm cần có biểu phí cấp {selectedComplexityLevel} được Admin duyệt trước khi đề xuất bộ tiêu chuẩn kiểm định. Vui lòng chọn cấp độ khác đã được duyệt giá hoặc gửi đề xuất giá cấp {selectedComplexityLevel} trước.
                        </p>
                      </div>
                    </div>
                  )}
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
                      className={`p-3 rounded-xl border transition space-y-2 ${item.mandatory
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
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer shrink-0 transition select-none ${item.mandatory
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
                  disabled={
                    isSavingChecklist ||
                    !checklistTitle.trim() ||
                    checklistItems.length === 0 ||
                    !isLevelFeeApproved(selectedComplexityLevel)
                  }
                  onClick={handleSaveChecklist}
                  className={`px-5 py-2 rounded-xl font-black shadow-sm transition flex items-center gap-1.5 ${!isLevelFeeApproved(selectedComplexityLevel)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-[#24263e] hover:bg-black text-white cursor-pointer disabled:opacity-50'
                    }`}
                  title={
                    !isLevelFeeApproved(selectedComplexityLevel)
                      ? `Cấp ${selectedComplexityLevel} chưa có biểu phí được Admin duyệt. Không thể gửi đề xuất.`
                      : undefined
                  }
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
                      className={`p-3 rounded-xl border space-y-1 ${item.mandatory !== false
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
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${item.mandatory !== false
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

      {/* ========================================================================= */}
      {/* MODAL: ĐỀ XUẤT ĐIỀU CHỈNH BIỂU PHÍ (2-STEP WIZARD)                       */}
      {/* ========================================================================= */}
      {isProposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Đề Xuất Điều Chỉnh Bậc Cước Di Chuyển
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {proposeStep === 'edit'
                      ? 'Bước 1/2: Cấu hình các bậc cước di chuyển theo khoảng cách'
                      : 'Bước 2/2: Xem lại đề xuất trước khi gửi Admin sàn xét duyệt'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProposeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Validation Error Banner */}
            {proposeValidationError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{proposeValidationError}</span>
              </div>
            )}

            {/* STEP 1: EDIT FORM */}
            {proposeStep === 'edit' && (
              <div className="space-y-4">
                {/* Tiers List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Cấu hình các bậc thang cước di chuyển ({proposeTiers.length} bậc):
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Bậc cuối để trống cự ly đến để biểu thị không giới hạn (∞)
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {proposeTiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-800 text-xs">
                            Bậc #{tier.tierNumber || idx + 1}
                          </span>
                          <input
                            type="text"
                            value={tier.name || ''}
                            placeholder="Tên bậc..."
                            onChange={(e) => handleProposeTierChange(idx, 'name', e.target.value)}
                            className="w-56 p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">Từ (km):</span>
                            <input
                              type="number"
                              min={0}
                              value={tier.fromKm ?? 0}
                              onChange={(e) =>
                                handleProposeTierChange(idx, 'fromKm', Number(e.target.value))
                              }
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs font-mono"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">Đến (km):</span>
                            <input
                              type="number"
                              min={0}
                              placeholder="Không giới hạn"
                              value={tier.toKm ?? ''}
                              onChange={(e) =>
                                handleProposeTierChange(
                                  idx,
                                  'toKm',
                                  e.target.value.trim() !== '' ? Number(e.target.value) : null
                                )
                              }
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs font-mono"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">Đơn giá / km (VND):</span>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={tier.pricePerKm ?? 0}
                              onChange={(e) =>
                                handleProposeTierChange(idx, 'pricePerKm', Number(e.target.value))
                              }
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-black text-[#c34c36] text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsProposeModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    className="px-5 py-2 bg-[#24263e] hover:bg-black text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Tiếp Tục Xem Lại & Xác Nhận</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PREVIEW & CONFIRM */}
            {proposeStep === 'preview' && (
              <div className="space-y-4">
                {/* Mandatory Warning Banner */}
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>LƯU Ý VỀ HIỆU LỰC ĐỀ XUẤT</span>
                  </div>
                  <p>
                    Đề xuất biểu phí chỉ chính thức có hiệu lực sau khi Quản trị viên (Admin) sàn SecondLife phê duyệt.
                    Trung tâm không thể tự kích hoạt hoặc áp dụng biểu phí trước khi được xét duyệt.
                  </p>
                </div>

                {/* Summary Table */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                      Chi tiết {proposeTiers.length} bậc cước di chuyển đề xuất:
                    </span>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 text-[10px] uppercase">
                            <th className="py-2 px-3">Bậc</th>
                            <th className="py-2 px-3">Tên bậc</th>
                            <th className="py-2 px-3">Khoảng cách</th>
                            <th className="py-2 px-3 text-right">Đơn giá / km</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {proposeTiers.map((t, i) => (
                            <tr key={i}>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                #{t.tierNumber || i + 1}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-800">{t.name}</td>
                              <td className="py-2 px-3 text-slate-600 font-mono">
                                {t.fromKm ?? 0} km -{' '}
                                {t.toKm != null ? `${t.toKm} km` : 'Không giới hạn (∞)'}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-[#c34c36] font-mono">
                                {formatVND(t.pricePerKm || 0)} / km
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setProposeStep('edit')}
                    disabled={isSubmittingProposal}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold cursor-pointer"
                  >
                    Quay Lại Sửa
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitProposal}
                    disabled={isSubmittingProposal}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmittingProposal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Xác Nhận Gửi Đề Xuất Lên Admin</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHI TIẾT ĐỀ XUẤT BIỂU PHÍ (PROPOSAL DETAIL MODAL)                 */}
      {/* ========================================================================= */}
      {selectedProposalDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Chi Tiết Đề Xuất #{selectedProposalDetail.id.slice(0, 8)}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Gửi bởi {selectedProposalDetail.proposedByName || selectedProposalDetail.proposedByEmail} •{' '}
                    {selectedProposalDetail.createdAt
                      ? new Date(selectedProposalDetail.createdAt).toLocaleString('vi-VN')
                      : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProposalDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Proposal Key Info */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Danh mục áp dụng:
                </span>
                <span className="font-bold text-slate-800 text-xs">
                  {selectedProposalDetail.categoryName || 'Tất cả danh mục sản phẩm'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Phí kiểm định cơ sở:
                </span>
                <span className="font-black text-[#c34c36] text-xs font-mono">
                  {formatVND(selectedProposalDetail.baseInspectionFee || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Trạng thái:
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mt-0.5 ${selectedProposalDetail.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedProposalDetail.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                    }`}
                >
                  {selectedProposalDetail.status === 'APPROVED'
                    ? 'Đã Phê Duyệt'
                    : selectedProposalDetail.status === 'REJECTED'
                      ? 'Bị Từ Chối'
                      : 'Chờ Admin Duyệt'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Người xét duyệt:
                </span>
                <span className="font-bold text-slate-700 text-xs">
                  {selectedProposalDetail.reviewedByName || 'Chờ xử lý'}
                </span>
              </div>
            </div>

            {selectedProposalDetail.rejectReason && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <strong>Lý do từ chối:</strong> {selectedProposalDetail.rejectReason}
              </div>
            )}

            {/* Tiers Breakdown */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                Bảng bậc thang cước trong đề xuất:
              </span>
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 text-[10px] uppercase">
                      <th className="py-2 px-3">Bậc</th>
                      <th className="py-2 px-3">Tên bậc</th>
                      <th className="py-2 px-3">Cự ly</th>
                      <th className="py-2 px-3 text-right">Đơn giá / km</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedProposalDetail.tiers || []).map((t, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          #{t.tierNumber || idx + 1}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">{t.name}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">
                          {t.fromKm ?? 0} - {t.toKm != null ? `${t.toKm} km` : 'Không giới hạn (∞)'}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-[#c34c36] font-mono">
                          {formatVND(t.pricePerKm || 0)} / km
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedProposalDetail(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {activeTab === 'orders' && returnQuoteOrder && (
        <InspectionReturnQuoteModal key={returnQuoteOrder.id} orderId={returnQuoteOrder.id}
          title={returnQuoteOrder.postTitle} cashShipping={returnQuoteOrder.cashShippingSimulation}
          booking={bookingReturnId === returnQuoteOrder.id} onClose={() => setReturnQuoteOrder(null)}
          onBook={(fee) => handleBookReturn(returnQuoteOrder, fee)} />
      )}

      {certificateOrder && (
        <DigitalInspectionCertificateModal
          key={certificateOrder.id}
          order={{
            id: certificateOrder.id,
            listing: { id: certificateOrder.postId, title: certificateOrder.postTitle },
            buyerName: certificateOrder.buyerName,
            sellerName: certificateOrder.sellerName,
            inspectionCenterId: certificateOrder.inspectionCenterId ?? undefined,
          }}
          initialDto={certificateOrder}
          lang={lang}
          onClose={() => setCertificateOrder(null)}
        />
      )}

      {/* MODAL 1: GIAO TASK CHO KỸ THUẬT VIÊN (ASSIGN TASK MODAL)                 */}
      {/* ========================================================================= */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl sm:max-w-2xl lg:max-w-3xl w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-gray-100 max-h-[92vh] overflow-y-auto subtle-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e0563e] text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#24263e]">Phân Công Kỹ Thuật Viên Kiểm Định</h3>
                  <p className="text-[11px] text-gray-400">
                    {assignModalOrder.orderType === 'AT_HOME'
                      ? 'Giao task kiểm tra và ấn định lịch hẹn khảo sát tại nhà khách'
                      : 'Giao task kiểm tra kỹ thuật tại trạm Lab Hub'}
                  </p>
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

            {/* Info note if order is waiting fee payment */}
            {assignModalOrder.status === 'WAITING_FEE_PAYMENT' && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Người bán đã đồng ý kiểm định</div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Đơn hàng đã được xác nhận kiểm định và sẵn sàng bàn giao. Bạn có thể phân công Kỹ thuật viên tiếp nhận và khảo sát ngay.
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
            {(assignModalOrder.status === 'CANCELLED' || assignModalOrder.status === 'CANCELED') && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-950 flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-rose-800">Đơn kiểm định đã bị hủy</div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Đơn hàng này đã bị hủy, không thể phân công hay giao task cho kỹ thuật viên.
                  </p>
                </div>
              </div>
            )}

            {/* Thông báo điều kiện nhận hàng đối với đơn tại Hub */}
            {assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder) && (
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-950 flex flex-col gap-2.5 animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-900">Kiện hàng chưa được tiếp nhận tại Lab Hub</div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Đơn kiểm định tại trạm Lab Hub cần nhận kiện hàng thực tế trước khi phân công KTV đo kiểm. Nếu bưu tá vừa bàn giao kiện hàng đến quầy, bạn có thể bấm xác nhận nhận hàng ngay bên dưới để mở khóa giao task.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      handleReceivePackageAtHub(assignModalOrder.id, assignModalOrder.postTitle);
                      setAssignModalOrder((prev) => (prev ? { ...prev, status: 'CONFIRMED_PENDING_DISPATCH' } : null));
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Xác Nhận Đã Nhận Hàng Tại Hub Ngay</span>
                  </button>
                </div>
              </div>
            )}

            {/* Chi tiết lịch hẹn đối với đơn kiểm định tại nhà */}
            {assignModalOrder.orderType === 'AT_HOME' && (
              (() => {
                let apptTime = assignModalOrder.appointmentScheduledAt;
                let apptNote = assignModalOrder.appointmentNote;
                if (!apptTime && typeof window !== 'undefined') {
                  try {
                    const raw = localStorage.getItem(`order_appointment_${assignModalOrder.id}`);
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      apptTime = parsed.scheduledAt;
                      apptNote = parsed.note;
                    }
                  } catch { }
                }

                if (!apptTime) {
                  return (
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-amber-900">Người bán chưa đặt lịch hẹn đón KTV</div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Đơn hàng này người bán chưa chọn ngày giờ tiếp đón Kỹ thuật viên. Bạn cần đợi người bán đặt lịch trước để phân công KTV theo ca làm việc (08:00 - 12:00 hoặc 13:00 - 17:00).
                        </p>
                      </div>
                    </div>
                  );
                }

                const d = new Date(apptTime);
                const isMorning = d.getHours() < 12;

                return (
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-300 text-xs text-amber-950 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-black text-amber-900 flex items-center gap-1.5 uppercase text-[11px] tracking-wide">
                        <Calendar className="w-4 h-4 text-amber-700" />
                        Lịch Hẹn Người Bán Yêu Cầu (Đã Xác Nhận):
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                        {isMorning ? 'Ca Sáng (08:00 - 12:00)' : 'Ca Chiều (13:00 - 17:00)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Thời gian KTV có mặt:</span>
                        <span className="font-black text-amber-900 text-sm">
                          🕒 {d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Địa chỉ khảo sát thực tế (Nhà Người Bán):</span>
                        <span className="font-extrabold text-slate-800 text-xs block leading-snug">
                          📍 {getOrderSellerAddress(assignModalOrder)}
                        </span>
                        <div className="text-[11px] text-slate-600 font-medium flex items-center gap-2 pt-0.5">
                          <span>👤 {getOrderSellerName(assignModalOrder)}</span>
                          <span>📞 {getOrderSellerPhone(assignModalOrder)}</span>
                        </div>
                      </div>
                    </div>
                    {apptNote && (
                      <div className="text-[11px] text-amber-900 italic bg-white/80 p-2.5 rounded-lg border border-amber-200">
                        💬 <strong>Ghi chú từ người bán:</strong> {apptNote}
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {/* Assign Fields */}
            <div className="space-y-4">
              {/* Select Inspector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#24263e] flex items-center justify-between">
                  <span>
                    Chọn kỹ thuật viên phụ trách: <strong className="text-rose-500">*</strong>
                  </span>
                  <span className="text-[11px] font-normal text-gray-500">
                    ({staffList.length} nhân sự trạm)
                  </span>
                </label>

                {staffList.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                    Trung tâm chưa có kỹ thuật viên nào. Vui lòng cấp tài khoản ở trang{' '}
                    <button
                      type="button"
                      className="cursor-pointer font-bold underline"
                      onClick={() => {
                        setAssignModalOrder(null);
                        setActiveTab('staff');
                      }}
                    >
                      Đội ngũ kỹ thuật viên
                    </button>.
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
            {(() => {
              const modalApptTime = assignModalOrder.appointmentScheduledAt || (() => {
                if (typeof window !== 'undefined') {
                  try {
                    const raw = localStorage.getItem(`order_appointment_${assignModalOrder.id}`);
                    if (raw) return JSON.parse(raw).scheduledAt;
                  } catch { }
                }
                return null;
              })();
              const isAtHomeMissingAppt = assignModalOrder.orderType === 'AT_HOME' && !modalApptTime;

              return (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
                  <div className="text-[11px] text-gray-500 font-medium">
                    {assignModalOrder.status === 'CANCELLED' || assignModalOrder.status === 'CANCELED' ? (
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        Đơn kiểm định đã bị hủy
                      </span>
                    ) : assignModalOrder.status === 'WAITING_SELLER_APPROVAL' ? (
                      <span className="text-purple-700 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Chờ người bán duyệt
                      </span>
                    ) : isAtHomeMissingAppt ? (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                        Chờ người bán hẹn lịch
                      </span>
                    ) : assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder) ? (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        Chờ nhận hàng tại Hub
                      </span>
                    ) : !selectedInspectorId ? (
                      <span className="text-rose-600 font-semibold">
                        * Vui lòng chọn KTV trước
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {assignModalOrder.orderType === 'AT_HOME' ? 'Lịch hẹn hợp lệ · Sẵn sàng giao task' : 'Sẵn sàng phân công'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    {assignModalOrder.orderType === 'AT_HOME' && (
                      <button
                        type="button"
                        onClick={() => {
                          const orderToReview = assignModalOrder;
                          setAssignModalOrder(null);
                          handleOpenReviewAppointment(orderToReview);
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer flex items-center gap-1.5"
                        title="Đổi lại lịch hẹn hoặc thương lượng lại với người bán"
                      >
                        <CalendarSync className="w-4 h-4 text-amber-600" />
                        <span>Đổi Lịch Hẹn</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setAssignModalOrder(null);
                        setAssignError(null);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                    >
                      Đóng
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmAssign}
                      disabled={
                        isAssigning ||
                        !selectedInspectorId ||
                        assignModalOrder.status === 'CANCELLED' ||
                        assignModalOrder.status === 'CANCELED' ||
                        isAtHomeMissingAppt ||
                        (assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder))
                      }
                      className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-md ${isAssigning ||
                        !selectedInspectorId ||
                        assignModalOrder.status === 'CANCELLED' ||
                        assignModalOrder.status === 'CANCELED' ||
                        isAtHomeMissingAppt ||
                        (assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder))
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                        : 'bg-[#c34c36] hover:bg-[#a63f2d] text-white cursor-pointer'
                        }`}
                      title={
                        assignModalOrder.status === 'CANCELLED' || assignModalOrder.status === 'CANCELED'
                          ? 'Đơn hàng đã bị hủy, không thể giao task'
                          : isAtHomeMissingAppt
                            ? 'Người bán chưa chọn lịch hẹn tại nhà. Bạn cần đợi người bán đặt lịch trước khi phân công KTV.'
                            : assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder)
                              ? 'Hub chưa nhận được hàng thực tế từ người bán, vui lòng bấm "Xác Nhận Đã Nhận Hàng Tại Hub" trước khi giao task'
                              : 'Xác nhận phân công KTV'
                      }
                    >
                      {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>
                        {assignModalOrder.status === 'CANCELLED' || assignModalOrder.status === 'CANCELED'
                          ? 'Đã Hủy - Không Thể Giao'
                          : isAtHomeMissingAppt
                            ? 'Chờ Người Bán Hẹn Lịch'
                            : assignModalOrder.orderType !== 'AT_HOME' && !isOrderReceivedAtHub(assignModalOrder)
                              ? 'Chờ Nhận Hàng Tại Hub Để Giao Task'
                              : assignModalOrder.orderType === 'AT_HOME'
                                ? 'Xác Nhận & Giao Task Cho KTV'
                                : 'Xác nhận phân công'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DUYỆT & THƯƠNG LƯỢNG LỊCH HẸN KIỂM ĐỊNH TẠI NHÀ                     */}
      {/* ========================================================================= */}
      {reviewApptOrder && (
        <div className="fixed inset-0 z-[75] overflow-y-auto bg-black/70 backdrop-blur-sm p-3 sm:p-4 flex min-h-full items-center justify-center animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-amber-100 max-h-[90vh] overflow-y-auto my-auto relative subtle-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Duyệt Lịch Hẹn Kiểm Định Tại Nhà
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Đơn hàng #{reviewApptOrder.id.slice(0, 8)} • Thương lượng thời gian kiểm định với người bán
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewApptOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông tin đơn hàng & Người bán */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center gap-2.5">
                {reviewApptOrder.postImageUrls?.[0] ? (
                  <img
                    src={reviewApptOrder.postImageUrls[0]}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400">
                    <Package className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate" title={reviewApptOrder.postTitle}>
                    {reviewApptOrder.postTitle || 'Sản phẩm kiểm định'}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span className="font-semibold text-rose-600">{formatVND(reviewApptOrder.postPrice || 0)}</span>
                    <span>•</span>
                    <span className="text-slate-600">Phí kiểm định: <strong>{formatVND(reviewApptOrder.inspectionFee || 200000)}</strong></span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700">
                <div className="min-w-0 break-words">
                  👤 <strong>Người bán:</strong> {getOrderSellerName(reviewApptOrder)} ({getOrderSellerPhone(reviewApptOrder)})
                </div>
                <div className="min-w-0 break-words">
                  📍 <strong>Địa chỉ đến:</strong> {getOrderSellerAddress(reviewApptOrder)}
                </div>
              </div>
            </div>

            {/* Thông tin lịch hẹn người bán đề xuất */}
            {(() => {
              let apptTime = reviewApptOrder.appointmentScheduledAt;
              let apptNote = reviewApptOrder.appointmentNote;
              let apptShift = 'MORNING';
              let counterTime = reviewApptOrder.counterScheduledAt;
              let counterReason = reviewApptOrder.counterNote;
              let apptStatus = reviewApptOrder.appointmentStatus;

              const possibleIds = [reviewApptOrder.id, reviewApptOrder.linkedOrderId, (reviewApptOrder as any).orderId].filter(Boolean);
              for (const pid of possibleIds) {
                try {
                  const raw = localStorage.getItem(`order_appointment_${pid}`);
                  if (raw) {
                    const p = JSON.parse(raw);
                    if (p.scheduledAt) apptTime = p.scheduledAt;
                    if (p.note) apptNote = p.note;
                    if (p.shift) apptShift = p.shift;
                    if (p.counterScheduledAt) counterTime = p.counterScheduledAt;
                    if (p.counterNote) counterReason = p.counterNote;
                    if (p.status) apptStatus = p.status;
                    break;
                  }
                } catch { }
              }

              const isWaitingSellerCounter = Boolean(
                counterTime ||
                apptStatus === 'COUNTERED_BY_CENTER' ||
                reviewApptOrder.status === 'WAITING_SELLER_APPROVAL'
              );

              const isMorning = apptShift === 'MORNING' || (apptTime && new Date(apptTime).getHours() < 12);
              const formattedDate = apptTime ? new Date(apptTime).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }) : 'Chưa xác định';

              return (
                <>
                  <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-4 h-4 text-amber-600" />
                        Lịch Hẹn Người Bán Yêu Cầu:
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
                        {isMorning ? 'Ca Sáng (08:00 - 12:00)' : 'Ca Chiều (13:00 - 17:00)'}
                      </span>
                    </div>

                    <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>{formattedDate}</span>
                    </div>

                    {apptNote && (
                      <div className="text-[11px] text-amber-900 bg-white/70 p-2 rounded-lg border border-amber-200/80 italic">
                        💬 <strong>Ghi chú đón KTV:</strong> "{apptNote}"
                      </div>
                    )}

                    {/* Khi chọn Tab Đề Xuất Lịch Mới: Hiển thị cảnh báo tự động từ chối lịch cũ kèm lý do */}
                    {reviewMode === 'COUNTER' && !isWaitingSellerCounter && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1 animate-fadeIn">
                        <div className="flex items-center gap-1.5 font-bold text-rose-800">
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Yêu cầu lịch hẹn cũ này sẽ tự động bị từ chối khi gửi đề xuất mới:</span>
                        </div>
                        <div className="text-rose-700 bg-white/90 p-2 rounded-lg border border-rose-200/80 leading-relaxed italic">
                          💬 <strong>Lý do từ chối gửi cho Người bán:</strong> {counterNote.trim() ? `"${counterNote.trim()}"` : <span className="text-rose-400 not-italic">(Chưa có lý do - vui lòng nhập tại ô "4. Lý do đề xuất lại cho Người bán: *" bên dưới)</span>}
                        </div>
                      </div>
                    )}

                    {counterTime && (
                      <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-300 text-[11px] text-sky-950 space-y-1">
                        <div className="font-bold text-sky-950 flex items-center gap-1.5">
                          <CalendarSync className="w-3.5 h-3.5 text-sky-600" />
                          <span>Trung tâm đã gửi đề xuất mới trước đó:</span>
                        </div>
                        <div className="bg-white/80 p-2 rounded-lg border border-sky-200">
                          <div>📅 <strong>Giờ đề xuất:</strong> {new Date(counterTime).toLocaleString('vi-VN')}</div>
                          {counterReason && (
                            <div className="italic text-sky-800 mt-0.5">
                              💬 <strong>Lý do:</strong> "{counterReason}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chọn hình thức phản hồi */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setReviewMode('VIEW');
                          setCounterError(null);
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          reviewMode === 'VIEW'
                            ? 'bg-white text-emerald-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>1. Chấp Nhận Lịch Hẹn</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewMode('COUNTER');
                          setCounterError(null);
                          if (!counterNote.trim()) {
                            setCounterNote('KTV khu vực đã kín lịch ca sáng, Trung tâm xin phép đề xuất dời sang ca chiều cùng ngày.');
                          }
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          reviewMode === 'COUNTER'
                            ? 'bg-white text-amber-800 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CalendarSync className="w-4 h-4 text-amber-600" />
                        <span>{isWaitingSellerCounter ? '2. Đề Xuất Lịch (Đã Gửi)' : '2. Đề Xuất Lịch Mới'}</span>
                      </button>
                    </div>

                    {/* MODE 1: CHẤP NHẬN LỊCH HẸN */}
                    {reviewMode === 'VIEW' && (
                      isWaitingSellerCounter ? (
                        <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200 text-xs space-y-2">
                          <div className="font-bold text-amber-900 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                            <span>Lịch hẹn gốc đã bị hủy để chờ thương lượng lịch mới</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Trung tâm đã gửi đề xuất dời lịch sang <strong>{new Date(counterTime!).toLocaleString('vi-VN')}</strong>. Lịch hẹn ban đầu của người bán không còn hiệu lực. Vui lòng chờ người bán xác nhận lịch mới hoặc gửi lại yêu cầu khác.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-xs space-y-3">
                          <div className="space-y-1">
                            <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Đồng ý với lịch người bán đã chọn</span>
                            </div>
                            <p className="text-[11px] text-emerald-800">
                              Khi bấm xác nhận, hệ thống sẽ chốt lịch hẹn này, gửi thông báo cho Người bán và chuyển sang bước <strong>Giao task cho Kỹ thuật viên</strong>.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleConfirmAcceptAppointment}
                            disabled={isSubmittingAccept}
                            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isSubmittingAccept ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            )}
                            <span>Xác Nhận Chấp Nhận Lịch Hẹn</span>
                          </button>
                        </div>
                      )
                    )}

                    {/* MODE 2: ĐỀ XUẤT LỊCH MỚI (GỬI LẠI CHO SELLER) */}
                    {reviewMode === 'COUNTER' && (
                      isWaitingSellerCounter ? (
                        <div className="p-4 bg-amber-50/90 rounded-2xl border-2 border-amber-300 text-xs space-y-3 animate-fadeIn">
                          <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                            <Clock className="w-5 h-5 text-amber-700 animate-spin" />
                            <span>Đã Gửi Đề Xuất • Đang Chờ Người Bán Phản Hồi</span>
                          </div>
                          <p className="text-amber-900 leading-relaxed">
                            Trung tâm đã gửi đề xuất dời lịch hẹn sang{' '}
                            <strong className="text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                              {new Date(counterTime!).toLocaleString('vi-VN')}
                            </strong>
                            . Hệ thống đang chờ Người bán phản hồi (Đồng ý hoặc Hẹn lại). <strong>Phần gửi đề xuất đã được khóa tạm thời</strong> để tránh gửi trùng lặp cho đến khi Người bán phản hồi.
                          </p>
                          {counterReason && (
                            <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200 text-[11px] text-amber-900 italic">
                              💬 <strong>Lý do đã gửi cho Người bán:</strong> "{counterReason}"
                            </div>
                          )}
                          <div className="p-2.5 bg-white/70 rounded-xl border border-amber-200/80 text-[11px] text-slate-700 flex items-center justify-between flex-wrap gap-2">
                            <span>📞 Cần thay đổi gấp? Liên hệ người bán:</span>
                            <strong className="text-slate-900 font-bold">{getOrderSellerPhone(reviewApptOrder)}</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs space-y-3">
                          <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 text-[11px] text-amber-950 space-y-1">
                            <div className="font-bold flex items-center gap-1 text-amber-900">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>Quy trình đề xuất lịch hẹn mới:</span>
                            </div>
                            <p className="text-amber-900 leading-relaxed">
                              Khi gửi đề xuất mới, yêu cầu lịch hẹn cũ của người bán sẽ được hệ thống <strong>tự động chuyển thành từ chối</strong> kèm lý do tại mục <strong>4. Lý do đề xuất lại cho Người bán: *</strong> bên dưới. Người bán sẽ nhận được thông báo đề xuất lịch mới để bấm Xác nhận hoặc Hẹn lại.
                            </p>
                          </div>
                          <div className="font-bold text-amber-950 flex items-center gap-1.5">
                            <CalendarSync className="w-4 h-4 text-amber-700" />
                            <span>Đề xuất ngày giờ mới gửi lại cho Người bán:</span>
                          </div>

                          {/* 1. Ngày hẹn mới */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                              <span>1. Ngày hẹn mới đề xuất: *</span>
                              <span className="text-[10px] text-amber-700 font-semibold">≥ 1 ngày</span>
                            </label>
                            <div
                              className="relative flex items-center justify-between p-2.5 bg-white border border-amber-300 rounded-xl cursor-pointer hover:border-amber-500 transition shadow-2xs group"
                            >
                              <div className="flex items-center gap-2 pointer-events-none">
                                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                                <span className="font-bold text-slate-800 text-xs">
                                  {(() => {
                                    if (!counterDate) return 'Chọn ngày hẹn';
                                    const [y, m, d] = counterDate.split('-');
                                    return `${d}/${m}/${y}`;
                                  })()}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium pointer-events-none">Bấm để đổi ngày 📅</span>
                              <input
                                id="reviewCounterDateInput"
                                type="date"
                                min={(() => {
                                  const tom = new Date();
                                  tom.setDate(tom.getDate() + 1);
                                  const pad = (n: number) => String(n).padStart(2, '0');
                                  return `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
                                })()}
                                value={counterDate}
                                onChange={(e) => setCounterDate(e.target.value)}
                                onClick={(e) => {
                                  try {
                                    (e.target as HTMLInputElement).showPicker?.();
                                  } catch {}
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                              />
                            </div>
                          </div>

                          {/* 2. Ca làm việc */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700">2. Ca làm việc: *</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setCounterShift('MORNING');
                                  const h = parseInt(counterTime?.slice(0, 2) || '', 10);
                                  if (isNaN(h) || h < 8 || h >= 12) {
                                    setCounterTime('09:00');
                                  }
                                  setCounterError(null);
                                }}
                                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                  counterShift === 'MORNING'
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <span>Ca Sáng (08:00 - 12:00)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCounterShift('AFTERNOON');
                                  const h = parseInt(counterTime?.slice(0, 2) || '', 10);
                                  if (isNaN(h) || h < 13 || h > 17) {
                                    setCounterTime('14:00');
                                  }
                                  setCounterError(null);
                                }}
                                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                  counterShift === 'AFTERNOON'
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <span>Ca Chiều (13:00 - 17:00)</span>
                              </button>
                            </div>
                          </div>

                          {/* 3. Khung giờ KTV có mặt */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <label className="font-bold text-slate-700">3. Khung giờ KTV có mặt: *</label>
                              <span className="font-mono font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded text-[11px]">
                                Đã chọn: {counterTime?.slice(0, 5) || (counterShift === 'MORNING' ? '09:00' : '14:00')}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(counterShift === 'MORNING'
                                ? ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
                                : ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
                              ).map((slot) => {
                                const isSelected = (counterTime?.slice(0, 5) || '') === slot;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => {
                                      setCounterTime(slot);
                                      setCounterError(null);
                                    }}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border cursor-pointer text-center ${
                                      isSelected
                                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                                    }`}
                                  >
                                    {slot}
                                  </button>
                                );
                              })}
                            </div>
                            {/* Fine-tune custom time picker */}
                            <div className="pt-0.5 flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 font-medium">Hoặc chỉnh giờ chi tiết:</span>
                                <input
                                  type="time"
                                  min={counterShift === 'MORNING' ? '08:00' : '13:00'}
                                  max={counterShift === 'MORNING' ? '12:00' : '17:00'}
                                  value={counterTime?.slice(0, 5) || (counterShift === 'MORNING' ? '09:00' : '14:00')}
                                  onChange={(e) => {
                                    setCounterTime(e.target.value);
                                    setCounterError(null);
                                  }}
                                  className="px-2 py-0.5 rounded-lg border border-amber-300 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-amber-500 outline-hidden bg-white cursor-pointer"
                                />
                              </div>
                              <span className="text-[10px] text-slate-400">
                                ({counterShift === 'MORNING' ? '08:00 - 12:00' : '13:00 - 17:00'})
                              </span>
                            </div>
                          </div>

                          {/* 4. Lý do / Ghi chú gửi người bán */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                              <span>4. Lý do đề xuất lại cho Người bán: *</span>
                              <span className="text-[10px] text-slate-400 font-normal">Hiển thị trực tiếp cho người bán</span>
                            </label>
                            <textarea
                              rows={2}
                              value={counterNote}
                              onChange={(e) => {
                                setCounterNote(e.target.value);
                                setCounterError(null);
                              }}
                              placeholder="Nhập lý do dời lịch (ví dụ: Ca sáng KTV đã kín lịch tại khu vực của bạn...)"
                              className="w-full p-2.5 bg-white rounded-xl border border-amber-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                            />

                            {/* Quick suggestion chips */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gợi ý lý do nhanh:</span>
                              <div className="flex flex-wrap gap-1">
                                {[
                                  'KTV đã kín lịch ca sáng, đề xuất chuyển sang ca chiều cùng ngày.',
                                  'KTV khu vực này chỉ có mặt vào buổi chiều, mong người bán thông cảm.',
                                  'Trùng lịch kiểm tra lưu động, đề xuất chuyển sang ngày tiếp theo.',
                                  'Cần thời gian chuẩn bị thiết bị kiểm định chuyên dụng cho model này.',
                                ].map((hint, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCounterNote(hint)}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-slate-600 border border-slate-200 transition cursor-pointer"
                                  >
                                    {hint}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {counterError && (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>{counterError}</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleConfirmSendCounter}
                            disabled={isSubmittingCounter}
                            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isSubmittingCounter ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CalendarSync className="w-4 h-4" />
                            )}
                            <span>Xác Nhận &amp; Gửi Lại Lịch Cho Người Bán</span>
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </>
              );
            })()}

            {/* Footer: Nút Từ Chối & Nút Đóng */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  const ord = reviewApptOrder;
                  setReviewApptOrder(null);
                  setRejectApptModalOrder(ord);
                  setRejectApptReason('');
                  setRejectApptError(null);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                title="Từ chối lịch hẹn nếu Trung tâm hoàn toàn không thể nhận đơn này"
              >
                <XCircle className="w-4 h-4 text-rose-500" />
                <span>Từ Chối Lịch Hẹn</span>
              </button>

              <button
                type="button"
                onClick={() => setReviewApptOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL TỪ CHỐI LỊCH HẸN KIỂM ĐỊNH TẬN NƠI (REJECT APPOINTMENT MODAL)       */}
      {/* ========================================================================= */}
      {rejectApptModalOrder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-rose-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">Từ Chối Lịch Hẹn Đón KTV</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Đơn hàng #{rejectApptModalOrder.id.slice(0, 8)} • Người bán: {getOrderSellerName(rejectApptModalOrder)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectApptModalOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông tin lịch hẹn người bán đề xuất */}
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Thời gian người bán yêu cầu đón KTV:</span>
              </div>
              <p className="font-extrabold text-slate-800">
                🕒 {rejectApptModalOrder.appointmentScheduledAt ? new Date(rejectApptModalOrder.appointmentScheduledAt).toLocaleString('vi-VN') : 'Chưa rõ'}
              </p>
              <p className="text-[11px] text-slate-600">
                📍 Địa chỉ: {getOrderSellerAddress(rejectApptModalOrder)}
              </p>
            </div>

            {/* Input lý do từ chối */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                <span>Lý do từ chối lịch hẹn: <strong className="text-rose-500">*</strong></span>
                <span className="text-[10px] text-slate-400 font-normal">Gửi trực tiếp đến người bán</span>
              </label>
              <textarea
                rows={3}
                value={rejectApptReason}
                onChange={(e) => {
                  setRejectApptReason(e.target.value);
                  setRejectApptError(null);
                }}
                placeholder="Nhập lý do cụ thể để người bán chọn lại lịch hẹn phù hợp..."
                className="w-full p-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
              />

              {/* Gợi ý nhanh */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gợi ý lý do nhanh:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'KTV đã kín lịch trong khung giờ này, vui lòng chọn ca khác.',
                    'Địa chỉ ngoài phạm vi phục vụ trong khung giờ yêu cầu.',
                    'Trùng lịch bảo trì định kỳ thiết bị đo kiểm lưu động.',
                    'Vui lòng hẹn trước tối thiểu 1 ngày trong giờ hành chính.',
                  ].map((quickReason, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectApptReason(quickReason)}
                      className="text-[10px] font-medium px-2 py-1 rounded-lg bg-gray-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition border border-gray-200 cursor-pointer"
                    >
                      {quickReason}
                    </button>
                  ))}
                </div>
              </div>

              {rejectApptError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{rejectApptError}</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRejectApptModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-gray-100 transition cursor-pointer"
              >
                Quay Lại
              </button>
              <button
                type="button"
                onClick={handleRejectAppointment}
                disabled={isRejectingAppt || !rejectApptReason.trim()}
                className="px-4.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isRejectingAppt ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Xác Nhận Từ Chối</span>
              </button>
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
                onClick={closeShipmentModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Notification messages */}
            {shipmentError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium shrink-0 flex items-center justify-between">
                <span>{shipmentError}</span>
                <button type="button" onClick={() => setShipmentError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">✕</button>
              </div>
            )}
            {shipmentSuccess && (
              <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium shrink-0 flex items-center justify-between">
                <span>{shipmentSuccess}</span>
                <button type="button" onClick={() => setShipmentSuccess(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">✕</button>
              </div>
            )}

            {/* Tab switchers */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setShipmentTab('tracking')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${shipmentTab === 'tracking'
                  ? 'bg-[#24263e] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Lộ Trình Vận Đơn ({inspectionShipments.length})</span>
              </button>
              {canCreateInboundInModal && <button
                type="button"
                onClick={() => setShipmentTab('create')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${shipmentTab === 'create'
                  ? 'bg-[#c34c36] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kích Hoạt Giao Vận Hub</span>
              </button>}
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
                    {canCreateInboundInModal && <button
                      type="button"
                      onClick={() => setShipmentTab('create')}
                      className="mt-2 px-4 py-2 bg-[#c34c36] text-white rounded-xl font-bold cursor-pointer hover:bg-[#a63f2d] transition"
                    >
                      + Kích Hoạt Vận Đơn Ngay
                    </button>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inspectionShipments.map((s, idx) => {
                      const isSellerToCenter = s.leg === 'SELLER_TO_CENTER';
                      const isCenterToBuyer = s.leg === 'CENTER_TO_BUYER';
                      const isCenterToSeller = s.leg === 'CENTER_TO_SELLER';
                      const isSyncing = syncingShipments.has(s.shipmentId);

                      const legBadgeTitle = isSellerToCenter
                        ? 'Chặng 1: Người Bán ➔ Lab Hub'
                        : isCenterToBuyer
                          ? 'Chặng 2: Lab Hub ➔ Người Mua (Đạt chuẩn)'
                          : isCenterToSeller
                            ? 'Chặng 2: Lab Hub ➔ Hoàn Trả Người Bán'
                            : `Chặng: ${s.leg || 'Điều Phối Lab Hub'}`;

                      const legColorClass = isSellerToCenter
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : isCenterToBuyer
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200';

                      return (
                        <div key={s.shipmentId || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                                {s.orderCode ? `#${s.orderCode}` : 'Chưa có mã vận đơn'}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${legColorClass}`}>
                                {legBadgeTitle}
                              </span>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {isCenterToSeller ? getHubReturnProgress(s).label : (s.providerStatus || s.status || 'ĐANG_ĐIỀU_PHỐI')}
                            </span>
                          </div>

                          <InspectionCashShipmentStatus shipment={s} />
                          {isCenterToSeller && (
                            <div className="space-y-2 text-[11px] text-slate-700">
                              <LalamoveProgress currentStep={getHubReturnProgress(s).step} completeCurrentStep={s.status === 'DELIVERED'} />
                              <p>Dự phòng {shipmentModalOrder.returnShippingReserveFee == null ? '—' : formatVND(shipmentModalOrder.returnShippingReserveFee)} · Cước thực tế {s.actualFee == null ? 'Chưa có' : formatVND(s.actualFee)}</p>
                              {s.deliveredAt && <p>Giao hoàn lúc {new Date(s.deliveredAt).toLocaleString('vi-VN')}</p>}
                              <p>{getReturnReserveMessage(shipmentModalOrder.returnShippingReserveFee, s)}</p>
                              {s.shareLink && <a href={s.shareLink} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline">Theo dõi trên Lalamove</a>}
                              {s.status === 'CREATION_UNCERTAIN' && <p>Nhân viên hỗ trợ có thể đối soát với mã chuyến {s.shipmentId}.</p>}
                              {s.lastError && <p className="text-rose-700">{s.lastError}</p>}
                            </div>
                          )}

                          {(() => {
                            const inboundRef = inspectionShipments.find((item) => item.leg === 'SELLER_TO_CENTER') || inboundShipments.get(shipmentModalOrder.id);
                            const resolvedCenter = resolveInspectionCenter({
                              ...shipmentModalOrder,
                              inspectionCenterName: (currentUser as any)?.centerName || currentUser?.name || (shipmentModalOrder as any).inspectionCenterName,
                              inspectionCenterAddress: (currentUser as any)?.address || (shipmentModalOrder as any).inspectionCenterAddress,
                              inspectionCenterPhone: (currentUser as any)?.phone || (shipmentModalOrder as any).inspectionCenterPhone,
                            });
                            const hubName = centerProfile?.name || resolvedCenter.name || 'Trung Tâm Kiểm Định SecondLife';
                            const hubPhone = centerProfile?.phone || resolvedCenter.phone || '1900 8899';
                            const hubAddress = centerProfile?.address || resolvedCenter.address || 'Giảng đường Phượng Vỹ, Đường số 8, Phường Linh Xuân, Thành phố Hồ Chí Minh';

                            const sellerName = shipmentModalOrder.sellerName || inboundRef?.senderName || 'Người bán';
                            const sellerPhone = shipmentModalOrder.sellerPhone || (shipmentModalOrder as any).phone || inboundRef?.senderPhone || '0912345678';
                            const sellerAddress = shipmentModalOrder.sellerAddress || (shipmentModalOrder as any).address || (shipmentModalOrder as any).location || inboundRef?.senderAddress || 'Địa chỉ kho người bán';

                            const buyerName = shipmentModalOrder.buyerName || 'Khách mua';
                            const buyerPhone = (shipmentModalOrder as any).buyerPhone || (shipmentModalOrder as any).phone || '0987654321';
                            const buyerAddress = (shipmentModalOrder as any).buyerAddress || (shipmentModalOrder as any).deliveryAddress || (shipmentModalOrder as any).address || 'Địa chỉ nhận hàng của người mua';

                            const senderTitle = isSellerToCenter
                              ? 'Điểm Lấy Hàng (Nhà Người Bán):'
                              : 'Điểm Gửi Hàng (Phòng Lab Hub):';
                            const displaySenderName = isSellerToCenter
                              ? (s.senderName || sellerName)
                              : (s.senderName || hubName);
                            const displaySenderPhone = isSellerToCenter
                              ? (s.senderPhone || sellerPhone)
                              : (s.senderPhone || hubPhone);
                            const displaySenderAddress = isSellerToCenter
                              ? (s.senderAddress || sellerAddress)
                              : (s.senderAddress || hubAddress);

                            const receiverTitle = isSellerToCenter
                              ? 'Điểm Tiếp Nhận (Phòng Lab Hub):'
                              : isCenterToBuyer
                                ? 'Điểm Giao Hàng (Khách Mua):'
                                : 'Điểm Nhận Trả (Người Bán):';
                            const displayReceiverName = isSellerToCenter
                              ? (s.receiverName || hubName)
                              : isCenterToBuyer
                                ? (s.receiverName || buyerName)
                                : (s.receiverName || sellerName);
                            const displayReceiverPhone = isSellerToCenter
                              ? (s.receiverPhone || hubPhone)
                              : isCenterToBuyer
                                ? (s.receiverPhone || buyerPhone)
                                : (s.receiverPhone || sellerPhone);
                            const displayReceiverAddress = isSellerToCenter
                              ? (s.receiverAddress || hubAddress)
                              : isCenterToBuyer
                                ? (s.receiverAddress || buyerAddress)
                                : (s.receiverAddress || sellerAddress);

                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                <div className="p-3 rounded-xl bg-white border border-slate-100 space-y-1">
                                  <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px]">
                                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                    <span>{senderTitle}</span>
                                  </div>
                                  <div className="font-bold text-slate-800">{displaySenderName}</div>
                                  {displaySenderPhone && <div className="text-slate-500 font-mono text-[10px]">{displaySenderPhone}</div>}
                                  {displaySenderAddress && <div className="text-slate-600 text-[10px]">{displaySenderAddress}</div>}
                                </div>

                                <div className="p-3 rounded-xl bg-white border border-slate-100 space-y-1">
                                  <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px]">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>{receiverTitle}</span>
                                  </div>
                                  <div className="font-bold text-slate-800">{displayReceiverName}</div>
                                  {displayReceiverPhone && <div className="text-slate-500 font-mono text-[10px]">{displayReceiverPhone}</div>}
                                  {displayReceiverAddress && <div className="text-slate-600 text-[10px]">{displayReceiverAddress}</div>}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Driver & Carrier Details */}
                          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>Tài xế Lalamove: <strong>{s.driverName || 'Chưa có thông tin'}</strong>{s.driverPhone && ` (${s.driverPhone})`}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {s.driverPlateNumber && <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200">{s.driverPlateNumber}</span>}
                              <span className="text-[10px] text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded font-semibold">Theo dõi GPS qua Lalamove API</span>
                              <button
                                type="button"
                                disabled={!s.orderCode || !s.shipmentId || isSyncing}
                                aria-busy={isSyncing}
                                onClick={() => void handleSyncCenterShipment(shipmentModalOrder.id, s, shipmentModalRequestRef.current)}
                                className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
                                title="Đồng bộ trạng thái vận đơn Lalamove mới nhất"
                              >
                                <RefreshCw aria-hidden="true" className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span>{isSyncing ? 'Đang đồng bộ…' : 'Đồng bộ'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <form onSubmit={handleCreateInspectionShipment} className="space-y-3.5">
                  {centerProfile && (!shipmentModalOrder.inspectionCenterId || shipmentModalOrder.inspectionCenterId === centerProfile.id) && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                      <div className="font-bold text-slate-800">
                        Điểm đến tiếp nhận: {centerProfile?.name || 'Trung Tâm Tiếp Nhận'}
                      </div>
                      <div className="text-slate-500 font-mono text-[10px]">
                        Hotline: {centerProfile?.phone || 'Chưa thiết lập hotline'}
                      </div>
                      <div className="text-slate-600 text-[10px]">
                        Địa chỉ: {centerProfile?.address || 'Chưa cấu hình địa chỉ tiếp nhận'}
                      </div>
                      {centerProfile && !centerProfile.shippingAddressConfigured && (
                        <div className="p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] flex items-center gap-1.5 mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Trung tâm chưa cấu hình địa chỉ tiếp nhận & GPS. Vui lòng mở mục "Thông tin trung tâm" để cập nhật.</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Sender address section */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 block text-xs">
                      Thông Tin Người Gửi (Nhà Người Bán)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Tên người gửi..."
                        className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                      />
                      <input
                        type="text"
                        required
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        placeholder="Số điện thoại người gửi..."
                        className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      value={senderAddress}
                      onChange={(e) => setSenderAddress(e.target.value)}
                      placeholder="Địa chỉ gửi hàng..."
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                    />
                  </div>

                  {/* Receiver address section */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 block text-xs">
                      Thông Tin Điểm Tiếp Nhận (Phòng Lab Hub)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="Tên người nhận..."
                        className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                      />
                      <input
                        type="text"
                        required
                        value={receiverPhone}
                        onChange={(e) => setReceiverPhone(e.target.value)}
                        placeholder="Số điện thoại nhận..."
                        className="p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      value={receiverAddress}
                      onChange={(e) => setReceiverAddress(e.target.value)}
                      placeholder="Địa chỉ nhận hàng..."
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs focus:border-[#c34c36] outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isCreatingShipment || Boolean(centerProfile && (!shipmentModalOrder.inspectionCenterId || shipmentModalOrder.inspectionCenterId === centerProfile.id) && !centerProfile.shippingAddressConfigured)}
                      className="px-5 py-2.5 rounded-xl bg-[#c34c36] hover:bg-[#a63f2d] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {isCreatingShipment && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>
                        Tạo Vận Đơn Lấy Hàng Về Hub
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={closeShipmentModal}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ĐỀ XUẤT BIỂU PHÍ 4 CẤP ĐỘ (L1 - L4) */}
      {isProposeLevelFeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Đề Xuất Biểu Phí Cấp Độ Kiểm Định (L1 – L4)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Biểu phí áp dụng cho các thiết bị thuộc cấp độ tương ứng sau khi Admin duyệt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProposeLevelFeeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProposeLevelFeeSubmit} className="space-y-4">
              {proposingLevelFeeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{proposingLevelFeeError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chọn cấp độ kiểm định áp dụng <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { level: 'L1' as InspectionComplexityLevel, name: 'Cấp L1 - Cơ Bản', desc: 'Quạt, ấm, bàn ủi...' },
                    { level: 'L2' as InspectionComplexityLevel, name: 'Cấp L2 - Nâng Cao', desc: 'Nồi cơm, lò vi sóng, hút bụi...' },
                    { level: 'L3' as InspectionComplexityLevel, name: 'Cấp L3 - Chuyên Sâu', desc: 'Máy giặt, máy sấy, máy rửa bát...' },
                    { level: 'L4' as InspectionComplexityLevel, name: 'Cấp L4 - Phức Tạp', desc: 'Tủ lạnh Side-by-Side, điều hòa...' },
                  ].map((item) => {
                    const isPending = Boolean(getPendingProposalForLevel(item.level));
                    return (
                      <button
                        key={item.level}
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          if (!isPending) {
                            setProposingLevel(item.level);
                            setProposingLevelFeeError(null);
                          }
                        }}
                        className={`p-3 rounded-xl text-left border transition ${isPending
                          ? 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                          : proposingLevel === item.level
                            ? 'border-[#24263e] bg-slate-50 shadow-xs ring-1 ring-[#24263e] cursor-pointer'
                            : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                          }`}
                        title={isPending ? 'Cấp độ này đã có đề xuất đang chờ Admin duyệt' : undefined}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-900">{item.name}</span>
                          {isPending ? (
                            <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              Chờ duyệt
                            </span>
                          ) : proposingLevel === item.level ? (
                            <Check className="w-4 h-4 text-[#c34c36]" />
                          ) : null}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                          {isPending ? 'Đã gửi yêu cầu, đang chờ Admin duyệt' : item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mức phí kiểm định đề xuất (VND) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  required
                  value={proposingLevelFeeAmount}
                  onChange={(e) => setProposingLevelFeeAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ví dụ: 150000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm focus:border-[#c34c36] outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[50000, 100000, 150000, 200000, 250000, 300000, 400000, 500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setProposingLevelFeeAmount(amt)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                    >
                      {formatVND(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>Lưu ý phê duyệt:</span>
                </p>
                <p>• Đề xuất sau khi gửi sẽ ở trạng thái <strong>CHỜ DUYỆT</strong> bởi Quản trị viên sàn SecondLife.</p>
                <p>• Khi Admin phê duyệt, mức phí mới sẽ tự động áp dụng cho các đơn hàng kiểm định thiết bị thuộc cấp độ này.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProposeLevelFeeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLevelFee}
                  className="px-5 py-2 bg-[#24263e] hover:bg-black text-white font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmittingLevelFee ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <span>Gửi Đề Xuất Giá Cấp {proposingLevel}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
