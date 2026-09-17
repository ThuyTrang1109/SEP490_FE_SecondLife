import { Listing, EscrowOrder, InspectionCenter, DisputeCase, ChatMessage, InspectionChecklistItem } from '../types';

export const mockInspectionCenters: InspectionCenter[] = [
  {
    id: 'center-hcm-01',
    name: 'SecondLife Center HCMC - Quận 1 Flagship',
    city: 'Hồ Chí Minh',
    address: 'Số 42 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    phone: '028 3822 9999',
    capacityPerDay: 80,
    currentQueue: 14,
    certifiedCategories: ['Smartphones', 'Laptops & Computers', 'Luxury & Bags', 'Cameras & Lens'],
    activeInspectors: 6,
    passRatePercentage: 94.2,
    slaHours: 12
  },
  {
    id: 'center-hn-01',
    name: 'SecondLife Center Hanoi - Cầu Giấy Tech Hub',
    city: 'Hà Nội',
    address: 'Tòa nhà Discovery Complex, 302 Cầu Giấy, Hà Nội',
    phone: '024 3788 8899',
    capacityPerDay: 60,
    currentQueue: 9,
    certifiedCategories: ['Smartphones', 'Laptops & Computers', 'Watches & Smartwatches'],
    activeInspectors: 4,
    passRatePercentage: 92.8,
    slaHours: 12
  },
  {
    id: 'center-dn-01',
    name: 'SecondLife Center Da Nang - Hải Châu Express',
    city: 'Đà Nẵng',
    address: '155 Nguyễn Văn Linh, Quận Hải Châu, TP. Đà Nẵng',
    phone: '0236 365 7788',
    capacityPerDay: 35,
    currentQueue: 4,
    certifiedCategories: ['Smartphones', 'Cameras & Lens'],
    activeInspectors: 2,
    passRatePercentage: 96.0,
    slaHours: 8
  }
];

export const mockStandardChecklist: Record<string, InspectionChecklistItem[]> = {
  Smartphones: [
    {
      id: 'chk-1',
      category: 'Màn hình & Cảm ứng',
      title: 'Màn hình hiển thị & Cảm ứng đa điểm',
      description: 'Kiểm tra điểm chết, ám ố, lưu ảnh OLED, độ sáng tối đa, phản hồi cảm ứng 120Hz',
      status: 'pass',
      testedValue: 'OLED nguyên bản 100%, không lưu ảnh, TrueTone OK'
    },
    {
      id: 'chk-2',
      category: 'Ngoại quan & Khung sườn',
      title: 'Khung viền Titanium / Nhôm & Kính lưng',
      description: 'Soi kính hiển vi kiểm tra cấn móp méo viền, nứt kính, xước sâu hay đã thay vỏ',
      status: 'pass',
      testedValue: 'Vỏ zin nguyên bản, 1 vết xước dăm 0.8mm ở cạnh cổng sạc'
    },
    {
      id: 'chk-3',
      category: 'Hiệu năng Pin & Sạc',
      title: 'Đo dung lượng Pin thực tế & Số chu kỳ sạc',
      description: 'Đọc telemetry chip nguồn, đo dòng sạc nhanh Type-C/MagSafe',
      status: 'pass',
      testedValue: 'Dung lượng pin 93%, chu kỳ sạc 182 lần, không phồng pin'
    },
    {
      id: 'chk-4',
      category: 'Hệ thống Camera & Cảm biến',
      title: 'Cụm Camera trước/sau, FaceID & LiDAR',
      description: 'Chụp thử lấy nét 5x zoom, macro, chống rung quang học OIS, quét FaceID',
      status: 'pass',
      testedValue: 'Thấu kính trong suốt không bụi, FaceID nhận diện nhạy bén'
    },
    {
      id: 'chk-5',
      category: 'Xác thực bảo mật & Nguồn gốc',
      title: 'Kiểm tra iCloud, Knox, MDM & Khóa mạng',
      description: 'Đối chiếu số IMEI thân máy và mainboard, kiểm tra blacklist toàn cầu',
      status: 'pass',
      testedValue: 'IMEI trùng khớp khay SIM & bo mạch, iCloud Clean, Quốc tế chuẩn'
    }
  ],
  'Luxury & Bags': [
    {
      id: 'chk-lux-1',
      category: 'Chất liệu da & Họa tiết',
      title: 'Canvas Monogram & Da Bò tự nhiên Vachetta',
      description: 'Kiểm tra độ ngả màu, độ mịn vân da, mùi da thuộc tự nhiên, không bong tróc',
      status: 'pass',
      testedValue: 'Canvas chuẩn sắc nét, Vachetta ngả mật ong đều màu tự nhiên'
    },
    {
      id: 'chk-lux-2',
      category: 'Đường may & Kim loại',
      title: 'Đường chỉ khâu tay & Khóa kim loại mạ vàng',
      description: 'Đếm mũi chỉ trên mỗi inch, kiểm tra độ sắc nét của logo dập trên chốt khóa',
      status: 'pass',
      testedValue: 'Chỉ vàng sáp 7 mũi/inch chuẩn xưởng Pháp, khóa bấm mạ sáng bóng'
    },
    {
      id: 'chk-lux-3',
      category: 'Mã vi mạch NFC / Date Code',
      title: 'Quét RFID vi mạch viễn thám & Date code',
      description: 'Dùng thiết bị quét tần số NFC chuyên dụng của hiệp hội hàng hiệu quốc tế',
      status: 'pass',
      testedValue: 'RFID Chip verified authentic - Xưởng sản xuất Asnières 2023'
    }
  ]
};

export const mockListings: Listing[] = [
  {
    id: 'listing-ip15pm',
    title: 'iPhone 15 Pro Max 256GB Titan Tự Nhiên - Fullbox Chính Hãng VN/A',
    category: 'Smartphones',
    brand: 'Apple',
    model: 'iPhone 15 Pro Max 256GB',
    purchaseYear: 2024,
    priceVnd: 24200000,
    originalPriceVnd: 34990000,
    conditionGrade: 'Like New',
    declaredConditionText: 'Máy dùng ốp UAG và dán cường lực KingKong từ ngày bóc hộp. Pin 93%, không một vết cấn.',
    description: 'Chính chủ lên đời cần nhượng lại iPhone 15 Pro Max bản 256GB Titan Tự Nhiên, mã VN/A mua tại Thế Giới Di Động còn hóa đơn điện tử. Máy cam kết nguyên bản 100%, chưa từng mở ốc vít hay qua sửa chữa. Bao test thợ thuyền hoặc kiểm định qua SecondLife Hub thoải mái!',
    location: 'Cầu Giấy, Hà Nội',
    sellerId: 'user-tuan-hn',
    sellerName: 'Nguyễn Minh Tuấn',
    sellerRating: 4.9,
    sellerCompletedOrders: 38,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-02T10:30:00Z',
    isInspectionGuaranteed: true,
    requiresInspection: true,
    photos: {
      front: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1695048065036-0f7236531ea3?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1695048065036-0f7236531ea3?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 23500000,
      maxVnd: 25000000,
      suggestedVnd: 24200000,
      quickSaleVnd: 22800000,
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
    id: 'listing-macbook',
    title: 'MacBook Pro 14 inch M2 Pro 16GB / 512GB Space Gray',
    category: 'Laptops & Computers',
    brand: 'Apple',
    model: 'MacBook Pro 14 M2 Pro',
    purchaseYear: 2023,
    priceVnd: 31500000,
    originalPriceVnd: 52990000,
    conditionGrade: 'Good',
    declaredConditionText: 'Máy coder văn phòng, bàn phím không bóng dầu, pin còn 91%, cấn nhẹ góc trái 1mm.',
    description: 'Bán MacBook Pro 14 inch chip M2 Pro cấu hình 16GB RAM / 512GB SSD. Màn hình Liquid Retina XDR 120Hz siêu đẹp không điểm chết. Kèm củ sạc 67W chính hãng và cáp MagSafe 3 bọc dù. Giao dịch qua kiểm định SecondLife an tâm 100%.',
    location: 'Quận 1, TP. Hồ Chí Minh',
    sellerId: 'user-nam-hcm',
    sellerName: 'Lê Phương Nam',
    sellerRating: 4.8,
    sellerCompletedOrders: 21,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-03T08:15:00Z',
    isInspectionGuaranteed: true,
    requiresInspection: true,
    photos: {
      front: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 30000000,
      maxVnd: 32500000,
      suggestedVnd: 31500000,
      quickSaleVnd: 29500000,
      confidence: 94,
      daysToSell: 7
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 95,
      duplicateFound: false
    }
  },
  {
    id: 'listing-sonya7iv',
    title: 'Body Máy Ảnh Sony Alpha A7 IV (ILCE-7M4) Chụp 6k Shot',
    category: 'Cameras & Lens',
    brand: 'Sony',
    model: 'Sony A7 IV Body',
    purchaseYear: 2024,
    priceVnd: 41800000,
    originalPriceVnd: 59990000,
    conditionGrade: 'Like New',
    declaredConditionText: 'Chỉ chụp dịch vụ sự kiện nhẹ, bảo quản tủ chống ẩm 40% liên tục. Sensor sạch bong.',
    description: 'Cần nâng cấp lên A7R V nên chia lại Body Sony A7 Mark IV hàng Sony Vietnam chính hãng. Cảm biến 33MP BSI-CMOS, quay 4K 60p 10-bit 4:2:2. Đầy đủ pin zin, dây đeo, cáp, hộp trùng serial.',
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
      front: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1500634245200-e5245c7574ef?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 40500000,
      maxVnd: 43000000,
      suggestedVnd: 41800000,
      quickSaleVnd: 39500000,
      confidence: 93,
      daysToSell: 6
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 97,
      duplicateFound: false
    }
  },
  {
    id: 'listing-lv-pochette',
    title: 'Túi Louis Vuitton Pochette Métis Monogram Canvas - Kèm Bill Pháp',
    category: 'Luxury & Bags',
    brand: 'Louis Vuitton',
    model: 'Pochette Métis Monogram',
    purchaseYear: 2023,
    priceVnd: 36500000,
    originalPriceVnd: 68000000,
    conditionGrade: 'Like New',
    declaredConditionText: 'Da Vachetta ngả mật ong nhẹ cực đẹp, khóa xước dăm siêu mảnh, lót nhung sạch tinh.',
    description: 'Pass lại túi kinh điển của LV, mua tại store Paris có hóa đơn kèm hộp cam, túi vải và dây đeo chéo. Bắt buộc kiểm định qua SecondLife Hub với máy quét vi mạch NFC trước khi chuyển giao để đảm bảo sự yên tâm tuyệt đối cho khách mua!',
    location: 'Quận 3, TP. Hồ Chí Minh',
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
      front: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 35000000,
      maxVnd: 38000000,
      suggestedVnd: 36500000,
      quickSaleVnd: 33500000,
      confidence: 97,
      daysToSell: 8
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 99,
      duplicateFound: false
    }
  },
  {
    id: 'listing-applewatch-ultra2',
    title: 'Apple Watch Ultra 2 Titanium 49mm Dây Ocean Cam',
    category: 'Watches & Smartwatches',
    brand: 'Apple',
    model: 'Apple Watch Ultra 2 49mm',
    purchaseYear: 2024,
    priceVnd: 14600000,
    originalPriceVnd: 21990000,
    conditionGrade: 'Like New',
    declaredConditionText: 'Pin 100%, ngoại hình hoàn hảo không vết xước, màn Sapphire sáng quắc.',
    description: 'Bán Apple Watch Ultra 2 bản viền Titanium 49mm cực ngầu. Dây Ocean thể thao màu cam bơi lặn thoải mái, sạc nhanh bọc dù USB-C. Pin trâu dùng 3 ngày thoải mái. Hàng chính hãng VNA.',
    location: 'Đống Đa, Hà Nội',
    sellerId: 'user-thang-hn',
    sellerName: 'Hoàng Đức Thắng',
    sellerRating: 4.7,
    sellerCompletedOrders: 12,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-04T09:00:00Z',
    isInspectionGuaranteed: true,
    requiresInspection: true,
    photos: {
      front: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1510017803434-a899398421b3?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 14000000,
      maxVnd: 15500000,
      suggestedVnd: 14600000,
      quickSaleVnd: 13500000,
      confidence: 95,
      daysToSell: 4
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 98,
      duplicateFound: false
    }
  },
  {
    id: 'listing-sony-wh1000xm5',
    title: 'Tai Nghe Chống Ồn Sony WH-1000XM5 Màu Bạc (Silver)',
    category: 'Audio & Headphones',
    brand: 'Sony',
    model: 'WH-1000XM5',
    purchaseYear: 2024,
    priceVnd: 5400000,
    originalPriceVnd: 8990000,
    conditionGrade: 'Good',
    declaredConditionText: 'Đệm tai còn êm ái, pin hơn 30h chống ồn đỉnh cao, kèm bao đựng zip.',
    description: 'Pass tai nghe chống ồn số 1 thị trường Sony WH-1000XM5 bản màu Bạc Platinum. Khử ồn máy bay và quán cafe siêu tĩnh lặng, âm thanh LDAC Hi-Res Audio.',
    location: 'Bình Thạnh, TP. Hồ Chí Minh',
    sellerId: 'user-linh-hcm',
    sellerName: 'Trần Thùy Linh',
    sellerRating: 4.9,
    sellerCompletedOrders: 19,
    sellerVerified: true,
    status: 'active',
    createdAt: '2026-09-05T11:10:00Z',
    isInspectionGuaranteed: false,
    requiresInspection: false,
    photos: {
      front: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
      back: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1000&q=80',
      screenOrDetails: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80',
      accessoriesOrBox: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
      serialOrReceipt: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1000&q=80'
    },
    photoGallery: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80'
    ],
    aiPriceEstimation: {
      minVnd: 5100000,
      maxVnd: 5800000,
      suggestedVnd: 5400000,
      quickSaleVnd: 4900000,
      confidence: 91,
      daysToSell: 6
    },
    aiFraudCheck: {
      anomaly: false,
      trustScore: 94,
      duplicateFound: false
    }
  }
];

export const mockOrders: EscrowOrder[] = [
  {
    id: 'ORD-2026-8801',
    listingId: 'listing-ip15pm',
    listing: mockListings[0],
    buyerId: 'user-khang-dn',
    buyerName: 'Hoàng Quốc Khang',
    buyerPhone: '0912 345 678',
    buyerAddress: '92 Phan Châu Trinh, Phường Phước Ninh, Quận Hải Châu, Đà Nẵng',
    sellerId: 'user-tuan-hn',
    sellerName: 'Nguyễn Minh Tuấn',
    itemPriceVnd: 24200000,
    inspectionFeeVnd: 250000,
    shippingFeeVnd: 85000,
    platformFeeVnd: 605000,
    totalPaidVnd: 25140000,
    escrowStatus: 'INSPECTION_IN_PROGRESS',
    hasInspectionService: true,
    inspectionReport: {
      id: 'REP-HN-904',
      orderId: 'ORD-2026-8801',
      centerId: 'center-hn-01',
      centerName: 'SecondLife Center Hanoi - Cầu Giấy Tech Hub',
      inspectorName: 'Kỹ sư Vũ Hải Đăng (Chứng chỉ TechCert ID #882)',
      inspectedAt: '2026-09-06T08:30:00Z',
      verdict: 'PASS',
      detectedGrade: 'Like New',
      conditionScore: 96,
      tamperSealId: 'SL-NFC-8829104',
      checklistResults: mockStandardChecklist.Smartphones,
      inspectorPhotos: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1000&q=80'
      ],
      summaryNotes: 'Thiết bị đạt chuẩn Grade A (Like New). Khung sườn Titanium nguyên bản không móp méo, màn hình zin nguyên bản không ám ố. Đã dán tem niêm phong chống tráo SL-NFC-8829104.',
      autoRefundTriggered: false
    },
    shippingLegs: [
      {
        id: 'LEG-1',
        legType: 'SELLER_TO_CENTER',
        carrier: 'GHTK',
        trackingNumber: 'GHTK-HN-8849201',
        status: 'DELIVERED',
        origin: 'Cầu Giấy, Hà Nội',
        destination: 'SecondLife Hub Cầu Giấy',
        estimatedDelivery: '2026-09-05T16:00:00Z',
        timeline: [
          { timestamp: '2026-09-05T09:15:00Z', description: 'Bưu tá GHTK đã nhận hàng từ người bán', location: 'Cầu Giấy, Hà Nội' },
          { timestamp: '2026-09-05T14:40:00Z', description: 'Đã nhập kho Hub SecondLife Cầu Giấy', location: 'Kho kiểm định Tech Hub' }
        ]
      },
      {
        id: 'LEG-2',
        legType: 'CENTER_TO_BUYER',
        carrier: 'GHN',
        trackingNumber: 'GHN-EXP-9920194',
        status: 'IN_TRANSIT',
        origin: 'SecondLife Hub Cầu Giấy',
        destination: 'Hải Châu, Đà Nẵng',
        estimatedDelivery: '2026-09-08T10:00:00Z',
        timeline: [
          { timestamp: '2026-09-06T09:00:00Z', description: 'Đóng gói hộp niêm phong SecondLife kèm tem NFC', location: 'SecondLife Hub' },
          { timestamp: '2026-09-06T10:30:00Z', description: 'Bàn giao chuyển phát nhanh đường bay GHN Express', location: 'Sân bay Nội Bài' }
        ]
      }
    ],
    inspectionWindowEndsAt: '2026-09-10T10:00:00Z',
    createdAt: '2026-09-04T18:00:00Z',
    updatedAt: '2026-09-06T10:30:00Z',
    multiStagePhotos: {
      listingPhotos: [
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1695048065036-0f7236531ea3?auto=format&fit=crop&w=1000&q=80'
      ],
      inspectorPhotos: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1000&q=80'
      ],
      handoverPhotos: [
        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1000&q=80'
      ]
    }
  },
  {
    id: 'ORD-2026-7729',
    listingId: 'listing-lv-pochette',
    listing: mockListings[3],
    buyerId: 'user-bich-hn',
    buyerName: 'Lê Ngọc Bích',
    buyerPhone: '0988 776 554',
    buyerAddress: '18 Hoàng Diệu, Quận Ba Đình, Hà Nội',
    sellerId: 'user-mai-hcm',
    sellerName: 'Vũ Mai Anh',
    itemPriceVnd: 36500000,
    inspectionFeeVnd: 350000,
    shippingFeeVnd: 95000,
    platformFeeVnd: 912500,
    totalPaidVnd: 37857500,
    escrowStatus: 'DELIVERED_INSPECTION_WINDOW',
    hasInspectionService: true,
    inspectionReport: {
      id: 'REP-HCM-1102',
      orderId: 'ORD-2026-7729',
      centerId: 'center-hcm-01',
      centerName: 'SecondLife Center HCMC - Quận 1 Flagship',
      inspectorName: 'Giám định viên cao cấp Celine Trần (Entrupy Certified)',
      inspectedAt: '2026-09-04T11:00:00Z',
      verdict: 'PASS',
      detectedGrade: 'Like New',
      conditionScore: 98,
      tamperSealId: 'SL-LUX-55928',
      checklistResults: mockStandardChecklist['Luxury & Bags'],
      inspectorPhotos: [
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80'
      ],
      summaryNotes: 'Sản phẩm chính hãng 100% Louis Vuitton Paris. Vi mạch RFID phản hồi tín hiệu chuẩn. Da Vachetta sạch đẹp, không tì vết ẩm mốc.',
      autoRefundTriggered: false
    },
    shippingLegs: [
      {
        id: 'LEG-1',
        legType: 'SELLER_TO_CENTER',
        carrier: 'GHTK',
        trackingNumber: 'GHTK-SG-449102',
        status: 'DELIVERED',
        origin: 'Quận 3, TP.HCM',
        destination: 'SecondLife Hub Q1, TP.HCM',
        estimatedDelivery: '2026-09-03T14:00:00Z',
        timeline: [{ timestamp: '2026-09-03T14:00:00Z', description: 'Giao thành công tại Hub', location: 'Hub Q1 TP.HCM' }]
      },
      {
        id: 'LEG-2',
        legType: 'CENTER_TO_BUYER',
        carrier: 'GHN',
        trackingNumber: 'GHN-VIP-881928',
        status: 'DELIVERED',
        origin: 'SecondLife Hub Q1, TP.HCM',
        destination: 'Ba Đình, Hà Nội',
        estimatedDelivery: '2026-09-05T15:30:00Z',
        timeline: [{ timestamp: '2026-09-05T15:30:00Z', description: 'Người mua đã nhận hàng có ký xác nhận', location: 'Ba Đình, Hà Nội' }]
      }
    ],
    inspectionWindowEndsAt: '2026-09-07T15:30:00Z',
    createdAt: '2026-09-02T19:00:00Z',
    updatedAt: '2026-09-05T15:30:00Z',
    multiStagePhotos: {
      listingPhotos: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80'],
      inspectorPhotos: ['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80'],
      handoverPhotos: ['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1000&q=80']
    }
  }
];

export const mockDisputes: DisputeCase[] = [
  {
    id: 'DISP-2026-012',
    orderId: 'ORD-2026-5541',
    buyerId: 'user-lam-dn',
    buyerName: 'Phạm Tùng Lâm',
    sellerId: 'user-duc-hcm',
    sellerName: 'Võ Minh Đức',
    reason: 'NOT_AS_DESCRIBED',
    description: 'Người bán khai báo máy Like New 99% không vết trầy, nhưng khi mình mở hộp kiểm tra thì góc kính có vết xước sâu 4mm rất rõ.',
    buyerEvidencePhotos: [
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1000&q=80'
    ],
    openedAt: '2026-09-05T17:20:00Z',
    status: 'PENDING_ARBITRATION',
    adminDecisionNotes: undefined
  }
];

export const mockChats: ChatMessage[] = [
  {
    id: 'msg-1',
    senderId: 'user-buyer',
    senderName: 'Hoàng Quốc Khang',
    senderRole: 'buyer',
    text: 'Chào anh, iPhone 15 Pro Max bản Titan này anh dùng được bao lâu rồi ạ? Pin còn 93% thật không?',
    timestamp: '14:20'
  },
  {
    id: 'msg-2',
    senderId: 'user-seller',
    senderName: 'Nguyễn Minh Tuấn',
    senderRole: 'seller',
    text: 'Chào bạn! Mình mua đập hộp tháng 1/2024 tại TGDĐ. Pin 93% chuẩn số chu kỳ 182 lần bạn nhé. Có thể kiểm định tại SecondLife Hub trước khi thanh toán.',
    timestamp: '14:22'
  },
  {
    id: 'msg-3',
    senderId: 'user-buyer',
    senderName: 'Hoàng Quốc Khang',
    senderRole: 'buyer',
    text: 'Mình thiện chí lấy ngay hôm nay, anh để lại cho mình 23,200,000 VNĐ nhé!',
    timestamp: '14:25',
    isOffer: true,
    offerAmountVnd: 23200000,
    offerStatus: 'pending'
  }
];
