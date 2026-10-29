import { Listing, EscrowOrder, InspectionCenter, DisputeCase, ChatMessage, InspectionChecklistItem, UserProfile, UserRole } from '../types';

export const mockInspectionCenters: InspectionCenter[] = [
  {
    id: 'center-hcm-01',
    name: 'SecondLife Home Hub HCMC - Quận 7 Flagship',
    city: 'Hồ Chí Minh',
    address: 'Số 1059 Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
    phone: '028 3822 9999',
    capacityPerDay: 40,
    currentQueue: 8,
    certifiedCategories: ['Tủ lạnh & Tủ đông', 'Máy giặt & Máy sấy', 'Điều hòa & Máy lọc', 'Robot & Máy hút bụi', 'Lò vi sóng & Lò nướng', 'Nồi cơm & Bếp từ'],
    activeInspectors: 6,
    passRatePercentage: 95.4,
    slaHours: 24
  },
  {
    id: 'center-hn-01',
    name: 'SecondLife Home Hub Hanoi - Cầu Giấy Center',
    city: 'Hà Nội',
    address: 'Số 88 Trần Thái Tông, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội',
    phone: '024 3788 8899',
    capacityPerDay: 35,
    currentQueue: 6,
    certifiedCategories: ['Tủ lạnh & Tủ đông', 'Máy giặt & Máy sấy', 'Điều hòa & Máy lọc', 'Robot & Máy hút bụi'],
    activeInspectors: 5,
    passRatePercentage: 93.8,
    slaHours: 24
  },
  {
    id: 'center-dn-01',
    name: 'SecondLife Home Hub Da Nang - Hải Châu Center',
    city: 'Đà Nẵng',
    address: '155 Nguyễn Văn Linh, Quận Hải Châu, TP. Đà Nẵng',
    phone: '0236 365 7788',
    capacityPerDay: 20,
    currentQueue: 3,
    certifiedCategories: ['Máy giặt & Máy sấy', 'Điều hòa & Máy lọc', 'Robot & Máy hút bụi', 'Nồi cơm & Bếp từ'],
    activeInspectors: 3,
    passRatePercentage: 96.5,
    slaHours: 18
  }
];

export const mockStandardChecklist: Record<string, InspectionChecklistItem[]> = {
  'Máy giặt & Máy sấy': [
    {
      id: 'chk-mg-1',
      category: 'Động cơ & Truyền động',
      title: 'Kiểm tra Động cơ Inverter & Truyền động trực tiếp',
      description: 'Đo điện áp stator, kiểm tra độ êm, thử vắt 1400 vòng/phút không rung lắc dị thường',
      status: 'pass',
      testedValue: 'Inverter DirectDrive 100% êm ái, độ ồn vắt 54dB (chuẩn)'
    },
    {
      id: 'chk-mg-2',
      category: 'Lồng giặt & Hệ thống nước',
      title: 'Kiểm tra Lồng giặt 3D Stainless Steel & Gioăng cao su',
      description: 'Soi lồng giặt không đọng cặn vôi, gioăng cửa cao su mềm mịn không rò rỉ nước',
      status: 'pass',
      testedValue: 'Lồng inox sáng bóng, gioăng cao su nguyên bản không mốc rò'
    },
    {
      id: 'chk-mg-3',
      category: 'Bo mạch & Cảm biến AI',
      title: 'Bo mạch điều khiển & Cảm biến độ đục/tải trọng giặt',
      description: 'Chạy test tự chẩn đoán lỗi phần mềm, kiểm tra cảm biến khối lượng giặt AI',
      status: 'pass',
      testedValue: 'Bo mạch khô ráo nguyên tem niêm phong hãng, AI Wash phản hồi nhạy'
    },
    {
      id: 'chk-mg-4',
      category: 'Bơm xả & Van cấp nước',
      title: 'Van cấp nước điện từ & Bơm xả áp lực cao',
      description: 'Đo lưu lượng nước cấp 15L/phút, bơm xả thoát nước nhanh không đọng đáy',
      status: 'pass',
      testedValue: 'Áp lực bơm xả đạt chuẩn 1.2 bar, van từ đóng ngắt chuẩn xác'
    }
  ],
  'Tủ lạnh & Tủ đông': [
    {
      id: 'chk-tl-1',
      category: 'Máy nén & Môi chất lạnh',
      title: 'Máy nén Compressor Inverter & Áp suất Gas R600a',
      description: 'Đo dòng điện máy nén, kiểm tra nhiệt độ ngăn đông đạt -18°C và ngăn mát 3°C',
      status: 'pass',
      testedValue: 'Máy nén êm ái, gas R600a đủ áp suất, ngăn đông -19.2°C siêu lạnh'
    },
    {
      id: 'chk-tl-2',
      category: 'Hệ thống xả đá & Cảm biến',
      title: 'Cảm biến nhiệt độ & Thanh điện trở xả đá tự động',
      description: 'Kiểm tra chu kỳ xả đá tự động, dàn lạnh không đóng tuyết cục bộ',
      status: 'pass',
      testedValue: 'Dàn lạnh xả đá hoàn hảo, hệ thống quạt gió Dual Fan êm ái'
    },
    {
      id: 'chk-tl-3',
      category: 'Gioăng cửa & Thân vỏ',
      title: 'Độ hít nam tính Gioăng cao su cửa & Mặt kính chịu lực',
      description: 'Kiểm tra độ kín khít cửa tủ chống thất thoát nhiệt, khay kính chịu lực 100kg',
      status: 'pass',
      testedValue: 'Gioăng hít chắc chắn 100%, khay kính lực không vết nứt'
    }
  ],
  'Robot & Máy hút bụi': [
    {
      id: 'chk-rb-1',
      category: 'Pin & Nguồn điện',
      title: 'Kiểm tra pin Lithium & Dung lượng sạc',
      description: 'Đo dung lượng pin, kiểm tra thời gian sạc và thời lượng hoạt động',
      status: 'pass',
      testedValue: 'Pin còn 98% dung lượng, thời gian sạc chuẩn 2.5h'
    },
    {
      id: 'chk-rb-2',
      category: 'Module hút bụi & Lực hút',
      title: 'Lực hút & Cảm biến chướng ngại vật',
      description: 'Kiểm tra lực hút 5000Pa, LiDAR TrueMapping 2.0 quét bản đồ chính xác',
      status: 'pass',
      testedValue: 'Lực hút 4980Pa đạt chuẩn, cảm biến laser quét bản đồ chính xác'
    },
    {
      id: 'chk-rb-3',
      category: 'Trạm sạc & Hệ thống giặt giẻ',
      title: 'Trạm Omni tự giặt & sấy giẻ',
      description: 'Kiểm tra chức năng tự giặt giẻ bằng nước nóng 75°C và sấy khô bằng khí nóng',
      status: 'pass',
      testedValue: 'Trạm Omni hoạt động chuẩn: giặt 75°C, sấy khí nóng 45°C'
    },
    {
      id: 'chk-rb-4',
      category: 'Kết nối & Phần mềm',
      title: 'Wifi & App điều khiển từ xa',
      description: 'Kết nối Wifi 2.4GHz/5GHz, cài đặt ứng dụng và điều khiển từ xa',
      status: 'pass',
      testedValue: 'Kết nối Wifi ổn định, app phản hồi nhanh < 1 giây'
    }
  ],
  'Nồi cơm & Bếp từ': [
    {
      id: 'chk-nc-1',
      category: 'Lòng nồi & Phủ chống dính',
      title: 'Lòng nồi Eco Stainless & Lớp phủ chống dính',
      description: 'Kiểm tra lòng nồi không xước, lớp phủ chống dính nguyên vẹn hoàn toàn',
      status: 'pass',
      testedValue: 'Lòng nồi không vết xước, chống dính hoàn hảo'
    },
    {
      id: 'chk-nc-2',
      category: 'Hệ thống áp suất',
      title: 'Van áp suất 2.0 Bar & Gioăng cao su',
      description: 'Kiểm tra van áp suất an toàn, gioăng nắp kín, nhiệt độ nấu đạt 121°C',
      status: 'pass',
      testedValue: 'Áp suất 2.0 bar ổn định, nhiệt độ nấu 121°C đạt chuẩn'
    },
    {
      id: 'chk-nc-3',
      category: 'Bo mạch & Cảm biến nhiệt',
      title: 'Bo mạch điều khiển & Cảm biến nhiệt độ IH',
      description: 'Kiểm tra cảm biến nhiệt IH, chương trình nấu cơm Fuzzy Logic',
      status: 'pass',
      testedValue: 'Cảm biến nhiệt IH phản hồi chính xác ±0.5°C'
    },
    {
      id: 'chk-nc-4',
      category: 'Nắp & Bộ lọc hơi',
      title: 'Nắp nồi & Bộ lọc hơi nước',
      description: 'Kiểm tra cơ chế khóa nắp tự động, bộ lọc hơi dễ tháo lắp vệ sinh',
      status: 'pass',
      testedValue: 'Khóa nắp cơ học an toàn, bộ lọc hơi sạch nguyên bản'
    }
  ],
  'Điều hòa & Máy lọc': [
    {
      id: 'chk-dh-1',
      category: 'Máy nén Inverter & Gas làm lạnh',
      title: 'Máy nén biến tần Dual Inverter & Áp suất Gas R32 / R410A',
      description: 'Kiểm tra máy nén khởi động êm, không gầm rung; áp suất gas đường hút 130-150 PSI, nhiệt độ cửa gió đạt 12°C - 16°C sau 5 phút',
      status: 'pass',
      testedValue: 'Dòng điện máy nén 3.8A ổn định, áp suất Gas R32 đạt 140 PSI, gió lạnh sâu 13.5°C'
    },
    {
      id: 'chk-dh-2',
      category: 'Dàn tản nhiệt & Quạt gió',
      title: 'Dàn tản nhiệt mạ vàng Golden Fin / BlueFin & Quạt lồng sóc',
      description: 'Kiểm tra dàn đồng tản nhiệt không móp méo gãy cánh, quạt dàn lạnh quay êm không kêu cọ sát',
      status: 'pass',
      testedValue: 'Cánh tản nhiệt sáng bóng không oxy hóa, quạt lồng sóc êm ái dưới 38dB'
    },
    {
      id: 'chk-dh-3',
      category: 'Màng lọc & Diệt khuẩn',
      title: 'Hệ thống lọc bụi mịn PM2.5, màng lọc than hoạt tính & Tạo ion Nanoe',
      description: 'Kiểm tra lưới lọc bụi, màng lọc HEPA/than hoạt tính, chức năng phát ion diệt khuẩn khử mùi',
      status: 'pass',
      testedValue: 'Màng lọc sạch nguyên bản 98%, bộ phát ion âm hoạt động ổn định'
    },
    {
      id: 'chk-dh-4',
      category: 'Bo mạch & Bơm thoát nước',
      title: 'Bo mạch điều khiển, Cảm biến nhiệt & Đường thoát nước ngưng',
      description: 'Mắt thần bắt sóng điều khiển remote nhạy, cảm biến nhiệt độ chuẩn xác, máng nước thoát thông thoáng không rò rỉ',
      status: 'pass',
      testedValue: 'Bo mạch khô ráo nguyên tem niêm phong, nước ngưng thoát nhanh không ứ đọng'
    }
  ],
  'Lò vi sóng & Lò nướng': [
    {
      id: 'chk-lvs-1',
      category: 'Đèn phát sóng Magnetron',
      title: 'Đèn phát sóng Magnetron & Đo rò rỉ bức xạ vi sóng an toàn',
      description: 'Dùng máy đo rò bức xạ vi sóng quanh khe cửa và vỏ ngoài; mật độ rò < 5 mW/cm² đạt tiêu chuẩn an toàn sinh học',
      status: 'pass',
      testedValue: 'Rò rỉ bức xạ 0.4 mW/cm² (chuẩn an toàn tuyệt đối < 5 mW/cm²), đun sôi 200ml nước trong 60s'
    },
    {
      id: 'chk-lvs-2',
      category: 'Khóa cửa liên động an toàn',
      title: 'Khóa liên động Micro-switch an toàn 3 lớp cánh cửa',
      description: 'Thử mở cửa lò khi đang phát sóng; hệ thống ngắt nguồn Magnetron ngay lập tức 100%, không phát tia lửa điện',
      status: 'pass',
      testedValue: 'Cảm biến vi công tắc ngắt nguồn tức thì khi hé cửa 2mm'
    },
    {
      id: 'chk-lvs-3',
      category: 'Thanh nhiệt nướng & Đối lưu',
      title: 'Thanh nhiệt nướng Grill & Quạt đối lưu phân bổ nhiệt',
      description: 'Kiểm tra điện trở thanh nhiệt hồng đều trong 2 phút, quạt đối lưu phân tán khí nóng đồng đều',
      status: 'pass',
      testedValue: 'Thanh nhiệt đạt 220°C ổn định, quạt đối lưu chạy êm'
    },
    {
      id: 'chk-lvs-4',
      category: 'Khoang lò & Đĩa xoay',
      title: 'Khoang lò tráng men Ceramic chống dính & Đĩa thủy tinh chịu nhiệt',
      description: 'Mô-tơ đĩa quay đều êm ái, lớp men khoang lò sáng bóng không bong tróc gỉ sét',
      status: 'pass',
      testedValue: 'Khoang tráng men nguyên bản, đĩa xoay thủy tinh quay đều nhịp nhàng'
    }
  ]
};

export const mockListings: Listing[] = [];

export const mockOrders: EscrowOrder[] = [];

export const mockDisputes: DisputeCase[] = [];

export const mockUsersByRole: Partial<Record<UserRole, UserProfile>> = {};
