import { ProductReview, SellerTrustProfile } from '../types';

export const mockProductReviews: ProductReview[] = [
  // Reviews for listing-tulanh-hitachi (seller: user-tuan-hcm)
  {
    id: 'rev-hitachi-01',
    listingId: 'listing-tulanh-hitachi',
    productName: 'Tủ Lạnh Hitachi Inverter 540L 4 Cửa',
    sellerId: 'user-tuan-hcm',
    sellerName: 'Nguyễn Minh Tuấn',
    buyerId: 'user-buyer-101',
    buyerName: 'Trần Văn Mạnh',
    buyerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    comment: 'Tủ lạnh còn rất mới, chạy siêu êm! Anh Tuấn đóng gói bọc xốp cẩn thận. Kiểm định Hub đo gas và nhiệt độ ngăn đông -19 độ C chuẩn xác. Rất an tâm khi mua qua SecondLife Escrow!',
    tags: ['Đúng mô tả', 'Máy chạy êm ái', 'Kiểm định Hub chuẩn xác', 'Đóng gói cẩn thận'],
    createdAt: '2026-08-25T14:20:00Z',
    isVerifiedPurchase: true,
    conditionGrade: 'Like New',
    sellerResponse: {
      comment: 'Cảm ơn anh Mạnh đã ủng hộ! Chúc anh và gia đình sử dụng tủ lạnh bền bỉ nhé.',
      respondedAt: '2026-08-25T16:00:00Z'
    }
  },
  {
    id: 'rev-hitachi-02',
    listingId: 'listing-tulanh-hitachi',
    productName: 'Tủ Lạnh Hitachi Inverter 540L 4 Cửa',
    sellerId: 'user-tuan-hcm',
    sellerName: 'Nguyễn Minh Tuấn',
    buyerId: 'user-buyer-102',
    buyerName: 'Lê Thị Thu Hằng',
    buyerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    comment: 'Mặt kính đen tràn viền sang chảnh không một vết xước. Tính năng lấy nước ngoài và làm đá tự động hoạt động hoàn hảo. Người bán tư vấn nhiệt tình, ship đúng hẹn.',
    tags: ['Đúng mô tả', 'Người bán hỗ trợ nhiệt tình', 'Giao hàng siêu tốc'],
    createdAt: '2026-08-18T09:45:00Z',
    isVerifiedPurchase: true,
    conditionGrade: 'Like New'
  },
  {
    id: 'rev-hitachi-03',
    listingId: 'listing-tulanh-hitachi',
    productName: 'Tủ Lạnh Hitachi Inverter 540L 4 Cửa',
    sellerId: 'user-tuan-hcm',
    sellerName: 'Nguyễn Minh Tuấn',
    buyerId: 'user-buyer-103',
    buyerName: 'Phạm Đăng Khoa',
    buyerAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
    rating: 4,
    comment: 'Máy đẹp 98%, tem niêm phong Hub còn nguyên vẹn. Giao hàng xe tải nâng hạ chuyên nghiệp, chỉ mất chút thời gian khi Hub test chu kỳ xả đá nhưng chất lượng rất xứng đáng.',
    tags: ['Kiểm định Hub chuẩn xác', 'Đóng gói cẩn thận'],
    createdAt: '2026-08-10T11:15:00Z',
    isVerifiedPurchase: true,
    conditionGrade: 'Like New'
  },

  // Reviews for listing-maygiat-lg (seller: user-nam-hn)
  {
    id: 'rev-lg-01',
    listingId: 'listing-maygiat-lg',
    productName: 'Máy Giặt Sấy LG Inverter AI DD 10.5kg/7kg',
    sellerId: 'user-nam-hn',
    sellerName: 'Lê Phương Nam',
    buyerId: 'user-buyer-104',
    buyerName: 'Đặng Ngọc Ánh',
    buyerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    comment: 'Máy giặt cực êm, sấy khô thơm tho mặc được luôn! Tem kiểm định NFC Hub chuẩn chỉ. Bạn Nam hỗ trợ hướng dẫn kết nối wifi LG ThinQ rất nhiệt tình.',
    tags: ['Đúng mô tả', 'Máy chạy êm ái', 'Người bán hỗ trợ nhiệt tình'],
    createdAt: '2026-08-28T16:30:00Z',
    isVerifiedPurchase: true,
    conditionGrade: 'Like New',
    sellerResponse: {
      comment: 'Cảm ơn bạn Ánh! Dòng AI DD này chăm sóc sợi vải rất thông minh, cần hỗ trợ thêm cứ nhắn mình nhé.',
      respondedAt: '2026-08-28T18:10:00Z'
    }
  },
  {
    id: 'rev-lg-02',
    listingId: 'listing-maygiat-lg',
    productName: 'Máy Giặt Sấy LG Inverter AI DD 10.5kg/7kg',
    sellerId: 'user-nam-hn',
    sellerName: 'Lê Phương Nam',
    buyerId: 'user-buyer-105',
    buyerName: 'Vũ Đình Trọng',
    buyerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    comment: 'Đã test vắt 1400 vòng không rung lắc, đúng như báo cáo kiểm định 48 bước của Hub. Tiền giữ Escrow 48h làm mình yên tâm hẳn, không sợ bị tráo linh kiện như mua trôi nổi.',
    tags: ['Kiểm định Hub chuẩn xác', 'Đúng mô tả', 'Đóng gói cẩn thận'],
    createdAt: '2026-08-15T13:20:00Z',
    isVerifiedPurchase: true,
    conditionGrade: 'Like New'
  },

  // Reviews for listing-dieuhoa-daikin (seller: user-tuan-hcm)
  {
    id: 'rev-daikin-01',
    listingId: 'listing-dieuhoa-daikin',
    productName: 'Điều Hòa Daikin Inverter 1.5 HP FTKZ35VVMV',
    sellerId: 'user-tuan-hcm',
    sellerName: 'Nguyễn Minh Tuấn',
    buyerId: 'user-buyer-106',
    buyerName: 'Bùi Gia Huy',
    buyerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    comment: 'Dàn nóng dàn lạnh zin 100%, lá tản nhiệt còn xanh mướt không móp méo. Làm lạnh nhanh và lọc bụi mịn PM2.5 rất tốt. Anh Tuấn uy tín 10 điểm!',
    tags: ['Đúng mô tả', 'Giao hàng siêu tốc', 'Người bán hỗ trợ nhiệt tình'],
    createdAt: '2026-08-22T10:10:00Z',
    isVerifiedPurchase: true,
    conditionGrade: 'Like New'
  },

  // Reviews for listing-robot-ecovacs (seller: user-mai-hcm)
  {
    id: 'rev-ecovacs-01',
    listingId: 'listing-robot-ecovacs',
    productName: 'Robot Hút Bụi Lau Nhà Ecovacs Deebot X1 Omni',
    sellerId: 'user-mai-hcm',
    sellerName: 'Vũ Mai Anh',
    buyerId: 'user-buyer-107',
    buyerName: 'Nguyễn Thúy Vy',
    buyerAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    comment: 'Trạm Omni tự giặt sấy giẻ bằng khí nóng rất sạch. Chị Mai Anh gửi đủ phụ kiện giẻ lau và túi bụi dự phòng. Báo cáo Hub pin còn 98% rất chính xác.',
    tags: ['Đúng mô tả', 'Đóng gói cẩn thận', 'Kiểm định Hub chuẩn xác'],
    createdAt: '2026-08-29T15:40:00Z',
    isVerifiedPurchase: true,
    conditionGrade: 'Like New'
  },

  // Reviews for listing-noicom-cuckoo (seller: user-thang-hn)
  {
    id: 'rev-cuckoo-01',
    listingId: 'listing-noicom-cuckoo',
    productName: 'Nồi Cơm Cao Tần Cuckoo 1.8L CRP-JHR1060FD',
    sellerId: 'user-thang-hn',
    sellerName: 'Hoàng Đức Thắng',
    buyerId: 'user-khang-dn',
    buyerName: 'Hoàng Quốc Khang',
    buyerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    comment: 'Nồi áp suất cao tần nấu cơm dẻo ngon như mới! Lòng nồi chống dính không vết xước. Đóng gói 3 lớp xốp khí chống va đập, ship vào Đà Nẵng chỉ 2 ngày.',
    tags: ['Đúng mô tả', 'Đóng gói cẩn thận', 'Giao hàng siêu tốc'],
    createdAt: '2026-09-02T16:00:00Z',
    isVerifiedPurchase: true,
    conditionGrade: 'Good'
  }
];

export const mockSellerTrustProfiles: Record<string, SellerTrustProfile> = {
  'user-tuan-hcm': {
    sellerId: 'user-tuan-hcm',
    sellerName: 'Nguyễn Minh Tuấn',
    trustScore: 98,
    tier: 'Kim Cương',
    rating: 4.9,
    reviewCount: 48,
    successfulOrders: 32,
    completionRate: 99.4,
    responseRate: 100,
    responseTime: '< 10 phút',
    hubPassRate: 97.5,
    cancellationRate: 0,
    badges: [
      'Đã xác thực eKYC CCCD gắn chip',
      'Top Nhà Bán Uy Tín 2026',
      '100% Giao dịch bảo lãnh Escrow',
      'Đạt chuẩn kiểm định Hub 97.5%'
    ]
  },
  'user-nam-hn': {
    sellerId: 'user-nam-hn',
    sellerName: 'Lê Phương Nam',
    trustScore: 97,
    tier: 'Kim Cương',
    rating: 4.9,
    reviewCount: 36,
    successfulOrders: 28,
    completionRate: 98.8,
    responseRate: 98,
    responseTime: '< 15 phút',
    hubPassRate: 96.8,
    cancellationRate: 0,
    badges: [
      'Đã xác thực eKYC CCCD gắn chip',
      'Chuyên gia thiết bị điện lạnh',
      '100% Bảo lãnh thanh toán Escrow',
      'Đạt chuẩn kiểm định Hub 96.8%'
    ]
  },
  'user-mai-hcm': {
    sellerId: 'user-mai-hcm',
    sellerName: 'Vũ Mai Anh',
    trustScore: 99,
    tier: 'Kim Cương',
    rating: 5.0,
    reviewCount: 42,
    successfulOrders: 35,
    completionRate: 100,
    responseRate: 100,
    responseTime: '< 5 phút',
    hubPassRate: 99.1,
    cancellationRate: 0,
    badges: [
      'Đã xác thực eKYC CCCD gắn chip',
      'Top 1 Seller Thiết Bị Thông Minh',
      'Đánh giá 5.0 tuyệt đối',
      '100% Bảo lãnh an toàn Escrow'
    ]
  },
  'user-thang-hn': {
    sellerId: 'user-thang-hn',
    sellerName: 'Hoàng Đức Thắng',
    trustScore: 95,
    tier: 'Bạch Kim',
    rating: 4.7,
    reviewCount: 18,
    successfulOrders: 14,
    completionRate: 97.2,
    responseRate: 95,
    responseTime: '< 20 phút',
    hubPassRate: 95.0,
    cancellationRate: 1.2,
    badges: [
      'Đã xác thực eKYC CCCD gắn chip',
      'Nhà bán đồ gia dụng nhiệt tình',
      '100% Giao dịch qua Escrow'
    ]
  }
};

const REVIEWS_STORAGE_KEY = 'secondlife_customer_reviews';

export const reviewService = {
  getAllReviews(): ProductReview[] {
    try {
      const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with mock
          const existingIds = new Set(parsed.map((r: ProductReview) => r.id));
          const base = mockProductReviews.filter(r => !existingIds.has(r.id));
          return [...parsed, ...base];
        }
      }
    } catch {
      // Fallback
    }
    return mockProductReviews;
  },

  getReviewsByListing(listingId: string): ProductReview[] {
    const all = this.getAllReviews();
    return all.filter(r => r.listingId === listingId);
  },

  getReviewsBySeller(sellerId: string): ProductReview[] {
    const all = this.getAllReviews();
    return all.filter(r => r.sellerId === sellerId);
  },

  getSellerTrustProfile(sellerId: string, sellerName?: string): SellerTrustProfile {
    if (mockSellerTrustProfiles[sellerId]) {
      return mockSellerTrustProfiles[sellerId];
    }
    // Generate fallback profile
    return {
      sellerId,
      sellerName: sellerName || 'Người bán SecondLife',
      trustScore: 96,
      tier: 'Bạch Kim',
      rating: 4.8,
      reviewCount: 15,
      successfulOrders: 12,
      completionRate: 98.5,
      responseRate: 96,
      responseTime: '< 15 phút',
      hubPassRate: 95.5,
      cancellationRate: 0,
      badges: [
        'Đã xác thực eKYC CCCD gắn chip',
        'Người bán uy tín SecondLife',
        '100% Giao dịch qua Escrow'
      ]
    };
  },

  addReview(newReview: Omit<ProductReview, 'id' | 'createdAt'>): ProductReview {
    const review: ProductReview = {
      ...newReview,
      id: `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString()
    };

    const current = this.getAllReviews();
    const updated = [review, ...current];
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    return review;
  }
};
