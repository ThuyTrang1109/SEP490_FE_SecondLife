import { Listing, EscrowOrder, InspectionCenter, DisputeCase, ChatMessage, InspectionChecklistItem } from '../types';

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
  ]
};

export const mockListings: Listing[] = [
  {
    id: 'listing-tulanh-hitachi',
    title: 'Tủ Lạnh Hitachi Inverter 540L 4 Cửa Mặt Kính Đen R-FW690PGV7X (GBK)',
    category: 'Tủ lạnh & Tủ đông',
    brand: 'Hitachi',
    model: 'R-FW690PGV7X (GBK)',
    purchaseYear: 2024,
    priceVnd: 18500000,
    originalPriceVnd: 29990000,
    conditionGrade: 'Like New',
    declaredConditionText: 'Gia đình chuyển nhà cần nhượng lại tủ lạnh Hitachi 540L 4 cửa mặt kính sang trọng. Máy nguyên bản 100%, làm đá tự động cực nhanh, lấy nước ngoài tiện lợi.',
    description: 'Bán tủ lạnh Hitachi Inverter 540L chính hãng mua tại Điện Máy Xanh còn bảo hành máy nén 8 năm. Tủ trang bị quạt đôi Dual Fan Cooling, cảm biến nhiệt Eco tiết kiệm điện vượt trội. Mặt kính tràn viền không xước, nội thất khay kính chịu lực và ngăn rau quả làm ẩm Aero-Care.',
    location: 'Quận 7, TP. Hồ Chí Minh',
    sellerId: 'user-tuan-hcm',
    sellerName: 'Nguyễn Minh Tuấn',
    sellerRating: 4.9,
    sellerCompletedOrders: 32,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-02T10:30:00Z',
    isInspectionGuaranteed: true,
    requiresInspection: true,
    photos: {
      front: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 17800000,
      maxVnd: 19200000,
      suggestedVnd: 18500000,
      quickSaleVnd: 16900000,
      confidence: 96,
      daysToSell: 5
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 98,
      duplicateFound: false
    }
  },
  {
    id: 'listing-maygiat-lg',
    title: 'Máy Giặt Sấy LG Inverter AI DD 10.5kg Giặt / 7kg Sấy FV1410D4P Màu Xám',
    category: 'Máy giặt & Máy sấy',
    brand: 'LG',
    model: 'FV1410D4P',
    purchaseYear: 2024,
    priceVnd: 9800000,
    originalPriceVnd: 17490000,
    conditionGrade: 'Like New',
    declaredConditionText: 'Máy giặt sấy cao cấp LG AI DD truyền động trực tiếp siêu êm. Mới dùng 8 tháng, bảo hành động cơ 10 năm.',
    description: 'Pass máy giặt sấy kết hợp LG AI DD 10.5kg/7kg mã FV1410D4P. Công nghệ giặt hơi nước Steam diệt khuẩn 99.9%, tự động phân bổ nước giặt xả ezDispense, lồng giặt 100% bằng thép không gỉ. Đã kiểm định động cơ & bo mạch qua SecondLife Home Hub.',
    location: 'Cầu Giấy, Hà Nội',
    sellerId: 'user-nam-hn',
    sellerName: 'Lê Phương Nam',
    sellerRating: 4.8,
    sellerCompletedOrders: 21,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-03T08:15:00Z',
    isInspectionGuaranteed: true,
    requiresInspection: true,
    photos: {
      front: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 9300000,
      maxVnd: 10200000,
      suggestedVnd: 9800000,
      quickSaleVnd: 8900000,
      confidence: 94,
      daysToSell: 6
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 95,
      duplicateFound: false
    }
  },
  {
    id: 'listing-dieuhoa-daikin',
    title: 'Điều Hòa Daikin Inverter 12.000 BTU 1 Chiều FTKB35WAVMV',
    category: 'Điều hòa & Máy lọc',
    brand: 'Daikin',
    model: 'FTKB35WAVMV',
    purchaseYear: 2024,
    priceVnd: 6200000,
    originalPriceVnd: 11890000,
    conditionGrade: 'Good',
    declaredConditionText: 'Dàn nóng + dàn lạnh nguyên bản 100%, áp suất gas chuẩn R32, làm lạnh cực nhanh êm ái.',
    description: 'Thanh lý điều hòa Daikin Inverter 1.5 HP phòng 15-20m2. Màng lọc Enzyme Blue chuẩn Nhật Bản khử mùi lọc bụi mịn PM2.5. Máy đã được thợ kỹ thuật thu hồi gas chuẩn xác, kèm điều khiển zin và giá đỡ dàn nóng.',
    location: 'Hải Châu, Đà Nẵng',
    sellerId: 'user-huy-dn',
    sellerName: 'Trần Quang Huy',
    sellerRating: 5.0,
    sellerCompletedOrders: 15,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-04T14:20:00Z',
    isInspectionGuaranteed: true,
    requiresInspection: true,
    photos: {
      front: 'https://images.unsplash.com/photo-1631545806604-510065a7825b?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1631545806604-510065a7825b?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1631545806604-510065a7825b?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1631545806604-510065a7825b?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 5900000,
      maxVnd: 6500000,
      suggestedVnd: 6200000,
      quickSaleVnd: 5600000,
      confidence: 93,
      daysToSell: 4
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 97,
      duplicateFound: false
    }
  },
  {
    id: 'listing-robot-ecovacs',
    title: 'Robot Hút Bụi Lau Nhà Ecovacs Deebot X1 Omni Tự Động Rửa Giẻ Sấy Khí Nóng',
    category: 'Robot & Máy hút bụi',
    brand: 'Ecovacs',
    model: 'Deebot X1 Omni',
    purchaseYear: 2023,
    priceVnd: 11500000,
    originalPriceVnd: 24900000,
    conditionGrade: 'Like New',
    declaredConditionText: 'Robot flagship full option: tự hút rác, tự giặt giẻ sấy nóng, lau xoay 180 vòng/phút. Pin 100%.',
    description: 'Pass siêu phẩm robot lau nhà Ecovacs Deebot X1 Omni bản quốc tế chính hãng. Lực hút 5000Pa siêu mạnh, điều hướng Laser TrueMapping 2.0 quét bản đồ 3D cực nhanh. Trạm sạc tự động làm sạch giẻ và sấy khô tránh nấm mốc.',
    location: 'Quận 2, TP. Hồ Chí Minh',
    sellerId: 'user-mai-hcm',
    sellerName: 'Vũ Mai Anh',
    sellerRating: 4.9,
    sellerCompletedOrders: 42,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-01T16:40:00Z',
    isInspectionGuaranteed: true,
    requiresInspection: true,
    photos: {
      front: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 11000000,
      maxVnd: 12200000,
      suggestedVnd: 11500000,
      quickSaleVnd: 10500000,
      confidence: 97,
      daysToSell: 5
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 99,
      duplicateFound: false
    }
  },
  {
    id: 'listing-noicom-cuckoo',
    title: 'Nồi Cơm Điện Cao Tần Áp Suất Cuckoo 1.8L CRP-JHR1060FD Nhập Khẩu Hàn Quốc',
    category: 'Nồi cơm & Bếp từ',
    brand: 'Cuckoo',
    model: 'CRP-JHR1060FD',
    purchaseYear: 2024,
    priceVnd: 4900000,
    originalPriceVnd: 9800000,
    conditionGrade: 'Good',
    declaredConditionText: 'Lòng nồi phủ men Eco Stainless chống dính hoàn hảo, cơm dẻo quánh chuẩn vị cơm niêu.',
    description: 'Pass nồi cơm cao tần Cuckoo 1.8L nội địa Hàn Quốc sử dụng điện 220V trực tiếp. Công nghệ áp suất 2.0 bar nhiệt độ 121°C giúp giữ trọn dưỡng chất hạt gạo. Đã kiểm định áp suất an toàn.',
    location: 'Đống Đa, Hà Nội',
    sellerId: 'user-thang-hn',
    sellerName: 'Hoàng Đức Thắng',
    sellerRating: 4.7,
    sellerCompletedOrders: 12,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-04T09:00:00Z',
    isInspectionGuaranteed: false,
    requiresInspection: false,
    photos: {
      front: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 4600000,
      maxVnd: 5200000,
      suggestedVnd: 4900000,
      quickSaleVnd: 4400000,
      confidence: 95,
      daysToSell: 3
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 98,
      duplicateFound: false
    }
  }
];

export const mockOrders: EscrowOrder[] = [
  {
    id: 'ORD-2026-8801',
    listingId: 'listing-tulanh-hitachi',
    listing: mockListings[0],
    buyerId: 'user-khang-dn',
    buyerName: 'Hoàng Quốc Khang',
    buyerPhone: '0912 345 678',
    buyerAddress: '92 Phan Châu Trinh, Phường Phước Ninh, Quận Hải Châu, Đà Nẵng',
    sellerId: 'user-tuan-hcm',
    sellerName: 'Nguyễn Minh Tuấn',
    itemPriceVnd: 18500000,
    inspectionFeeVnd: 350000,
    shippingFeeVnd: 250000,
    platformFeeVnd: 462500,
    totalPaidVnd: 19562500,
    escrowStatus: 'INSPECTION_IN_PROGRESS',
    hasInspectionService: true,
    inspectionReport: {
      id: 'REP-HOME-904',
      orderId: 'ORD-2026-8801',
      centerId: 'center-hcm-01',
      centerName: 'SecondLife Home Hub HCMC - Quận 7 Flagship',
      inspectorName: 'Kỹ sư Vũ Hải Đăng (Chứng chỉ HomeCert ID #882)',
      inspectedAt: '2026-09-06T08:30:00Z',
      verdict: 'PASS',
      detectedGrade: 'Like New',
      conditionScore: 96,
      tamperSealId: 'SL-HOME-8829104',
      checklistResults: mockStandardChecklist['Tủ lạnh & Tủ đông'],
      inspectorPhotos: [
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80'
      ],
      summaryNotes: 'Tủ lạnh Hitachi Inverter đạt chuẩn Grade A (Like New). Máy nén áp suất gas R600a siêu êm, độ lạnh -19.2°C chuẩn xác, gioăng cửa hít nam tính nguyên bản. Đã dán tem niêm phong niêm phong SL-HOME-8829104.',
      autoRefundTriggered: false
    },
    shippingLegs: [
      {
        id: 'LEG-1',
        legType: 'SELLER_TO_CENTER',
        carrier: 'GHTK',
        trackingNumber: 'GHTK-HOME-8849201',
        status: 'DELIVERED',
        origin: 'Quận 7, TP. Hồ Chí Minh',
        destination: 'SecondLife Home Hub Q7',
        estimatedDelivery: '2026-09-05T16:00:00Z',
        timeline: [
          { timestamp: '2026-09-05T09:15:00Z', description: 'Bưu tá xe tải GHTK đã lấy tủ lạnh tại nhà người bán', location: 'Quận 7, TP.HCM' },
          { timestamp: '2026-09-05T14:30:00Z', description: 'Đã nhập kho kiểm định SecondLife Home Hub Q7', location: 'Quận 7, TP.HCM' }
        ]
      }
    ],
    inspectionWindowEndsAt: '2026-09-09T18:00:00Z',
    createdAt: '2026-09-05T08:00:00Z',
    updatedAt: '2026-09-06T08:30:00Z',
    multiStagePhotos: {
      listingPhotos: [
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80'
      ],
      inspectorPhotos: [
        'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80'
      ]
    }
  }
];

export const mockDisputes: DisputeCase[] = [
  {
    id: 'DISP-2026-019',
    orderId: 'ORD-2026-7712',
    buyerId: 'user-lan-hn',
    buyerName: 'Nguyễn Phương Lan',
    sellerId: 'user-hung-hn',
    sellerName: 'Đặng Quốc Hùng',
    reason: 'NOT_AS_DESCRIBED',
    description: 'Người bán khai báo máy giặt 99% không vết trầy, nhưng nhận hàng thân vỏ bên hông bị móp cấn nặng 5cm.',
    buyerEvidencePhotos: [
      'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1000&q=80'
    ],
    openedAt: '2026-09-06T11:20:00Z',
    status: 'PENDING_ARBITRATION'
  }
];
