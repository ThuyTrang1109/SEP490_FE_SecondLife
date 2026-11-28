import { Language } from '../types';

export const translations = {
  vi: {
    brandName: 'SecondLife',
    tagline: 'Sàn đồ cũ tích hợp AI định giá & Dịch vụ kiểm định xác thực',
    knowFairPrice: 'Biết giá chuẩn - Kiểm định trước khi thanh toán - Giao dịch an tâm tuyệt đối',

    // Roles
    roleBuyer: 'Người Mua (Buyer)',
    roleSeller: 'Người Bán (Seller)',
    roleInspector: 'Trung tâm giám định (Inspector)',
    roleAdmin: 'Quản trị viên (Admin)',
    switchRole: 'Chuyển vai trò thử nghiệm',

    // Nav
    navMarketplace: 'Sàn đồ cũ',
    navCreateListing: 'Đăng bán & định giá AI',
    navMyOrders: 'Đơn hàng & Escrow',
    navInspectionHub: 'Trung tâm kiểm định',
    navAdminDashboard: 'Admin Control Center',
    navChat: 'Đàm phán & tin nhắn',

    // Marketplace & Filters
    searchPlaceholder: 'Tìm iPhone 15 Pro, MacBook M2, máy ảnh Sony, túi hiệu...',
    filterCategory: 'Danh mục',
    filterGrade: 'Phân loại tình trạng',
    filterPrice: 'Mức giá',
    filterLocation: 'Khu vực',
    verifiedOnly: 'Chỉ xem hàng có kiểm định xác thực',
    gradeLikeNew: 'Như mới (99%)',
    gradeGood: 'Tốt (95%)',
    gradeFair: 'Khá (90%)',
    fairPriceAi: 'AI định giá chuẩn',
    inspectionGuaranteed: 'Kiểm định đối tác',
    escrowProtected: 'Bảo vệ Escrow',
    sellerReputation: 'Uy tín người bán',
    daysToSell: 'Thời gian bán ước tính',
    quickBuy: 'Mua bảo đảm Escrow',
    makeOffer: 'Trả giá & Đàm phán',
    contactSeller: 'Nhắn tin',

    // Listing Creation
    createListingTitle: 'Đăng bán có AI trợ lực',
    createListingSubtitle: 'Hệ thống AI tự động phân tích ảnh, ước tính giá thị trường chuẩn và kiểm tra gian lận',
    stepInfo: '1. Thông tin cơ bản',
    stepPhotos: '2. Bộ ảnh chuẩn 5 góc',
    stepValuation: '3. AI Định giá & Niêm yết',
    itemTitle: 'Tiêu đề sản phẩm',
    itemBrand: 'Thương hiệu',
    itemModel: 'Model / Dòng máy',
    purchaseYear: 'Năm mua / Sản xuất',
    originalPrice: 'Giá mua mới ban đầu (VNĐ)',
    declaredCondition: 'Tình trạng bạn tự đánh giá',
    accessories: 'Phụ kiện kèm theo',
    description: 'Mô tả chi tiết',
    runAiEstimation: 'Chạy AI định giá thị trường',
    analyzingMarket: 'AI đang phân tích 1,400+ dữ liệu giao dịch thực tế...',
    aiValuationResult: 'Kết quả định giá bằng AI',
    fairRange: 'Biên độ giá hợp lý',
    suggestedPrice: 'Giá đề xuất niêm yết',
    quickSalePrice: 'Giá bán nhanh (trong 3 ngày)',
    confidenceScore: 'Độ tin cậy mô hình',
    finalListingPrice: 'Giá bạn quyết định niêm yết (VNĐ)',
    disclaimer: 'Lưu ý: Mức giá của AI mang tính tư vấn tham khảo. Bạn luôn là người quyết định giá niêm yết cuối cùng.',
    publishListing: 'Đăng bán lên sàn SecondLife',

    // Multi-version photos
    photoChecklistTitle: 'Bộ ảnh chuẩn hóa bắt buộc (5 góc)',
    photoFront: 'Mặt trước (Màn hình sáng)',
    photoBack: 'Mặt sau & Khung sườn',
    photoScreenOrDetails: 'Cận cảnh vết xước / chi tiết',
    photoAccessories: 'Phụ kiện & Hộp máy',
    photoSerialOrReceipt: 'Serial / IMEI / Hóa đơn',

    // Escrow & Inspection
    escrowStatusTitle: 'Trạng thái Escrow & Vận chuyển 2 chặng',
    orderSummary: 'Chi tiết đơn hàng Escrow',
    itemAmount: 'Tiền hàng (Giữ trong Escrow)',
    inspectionFee: 'Phí kiểm định chứng nhận',
    shippingFee: 'Phí vận chuyển giao nhận',
    platformFee: '',
    totalEscrow: 'Tổng tiền',
    verifyThenShip: 'Quy trình "Kiểm định trước khi thanh toán"',
    whyInspection: 'Hàng gửi tới Trung tâm giám định SecondLife để chuyên gia mở máy, test linh kiện, dán tem niêm phong trước khi giao cho bạn (quá trình kiểm định tháo máy sẽ làm mất trạng thái zin nguyên bản).',
    inspectionZinLossWarning: 'Thông báo kiểm định: Quá trình kiểm định sẽ tháo sản phẩm để kiểm tra linh kiện và bo mạch, do đó sẽ làm mất trạng thái zin nguyên bản của sản phẩm.',
    inspectionZinLossAgree: 'Tôi hiểu và đồng ý rằng sản phẩm sẽ được tháo máy để kiểm định và sẽ mất trạng thái zin của sản phẩm.',
    leg1: 'Chặng 1: Người bán gửi tới Trung tâm',
    leg2: 'Chặng 2: Trung tâm giao Người mua',
    tamperSeal: 'Mã tem niêm phong NFC',
    inspectionVerdict: 'Kết luận giám định',
    inspectionPass: 'ĐẠT CHUẨN XÁC THỰC',
    inspectionFail: 'KHÔNG ĐẠT - CHỜ XỬ LÝ HOÀN TRẢ',
    confirmReceipt: 'Xác nhận nhận hàng',
    openDispute: 'Khiếu nại / Trả hàng',
    inspectionWindowNotice: 'Bạn có 48 giờ để dùng thử trước khi tiền tự động giải ngân cho người bán.',

    // Multi-stage photo history
    multiStageTitle: 'Lịch sử ảnh 2 giai đoạn đối chiếu',
    multiStageTitle2Stage: 'Lịch sử ảnh đối chiếu',
    stageListing: '1. Ảnh người bán đăng',
    stageInspection: '2. Ảnh trung tâm kiểm định',
    stageHandover: '3. Ảnh lúc đóng gói & bàn giao',

    // Inspector
    inspectorTitle: 'Cổng thao tác kiểm định viên (Inspector Portal)',
    inspectorQueue: 'Hàng đợi kiểm định cần xử lý',
    scanQrItem: 'Quét mã QR / Nhập mã đơn',
    executeChecklist: 'Thực thi checklist tiêu chuẩn',
    attachInspectorPhotos: 'Tải ảnh soi kính & tem niêm phong',
    issueReport: 'Ký số & xuất báo cáo giám định',

    // Admin
    adminDashboardTitle: 'Trung tâm điều hành & giám sát rủi ro',
    totalGmv: 'Tổng GMV Giao Dịch',
    heldInEscrow: 'Tiền đang giữ trong Escrow',
    inspectionPassRate: 'Tỷ lệ kiểm định đạt chuẩn',
    disputeRate: 'Tỷ lệ tranh chấp',
    disputeWorkbench: 'Bàn trọng tài tranh chấp (Arbitration)',
    fraudAlerts: 'Cảnh báo chống gian lận & Ảnh trùng lặp',
    modelPerformance: 'Hiệu năng mô hình AI định giá',
    exportReport: 'Xuất báo cáo thống kê (CSV/PDF)'
  },
  en: {
    brandName: 'SecondLife',
    tagline: 'AI-Powered Second-Hand Marketplace with Price Estimation & Authentication',
    knowFairPrice: 'Know the fair price - Verify before you pay - Trade with absolute confidence',

    // Roles
    roleBuyer: 'Buyer View',
    roleSeller: 'Seller View',
    roleInspector: 'Inspection Center View',
    roleAdmin: 'Platform Admin View',
    switchRole: 'Switch Demonstration Role',

    // Nav
    navMarketplace: 'Marketplace',
    navCreateListing: 'Sell & AI Valuation',
    navMyOrders: 'Orders & Escrow',
    navInspectionHub: 'Inspection Center',
    navAdminDashboard: 'Admin Control Center',
    navChat: 'Chat & Negotiation',

    // Marketplace & Filters
    searchPlaceholder: 'Search iPhone 15 Pro, MacBook M2, Sony Alpha, Luxury bags...',
    filterCategory: 'Category',
    filterGrade: 'Condition Grade',
    filterPrice: 'Price Range',
    filterLocation: 'Location',
    verifiedOnly: 'Verified & Inspected items only',
    gradeLikeNew: 'Like New (99%)',
    gradeGood: 'Good (95%)',
    gradeFair: 'Fair (90%)',
    fairPriceAi: 'AI Fair Price',
    inspectionGuaranteed: 'Inspection Verified',
    escrowProtected: 'Escrow Protected',
    sellerReputation: 'Seller Reputation',
    daysToSell: 'Est. Days to Sell',
    quickBuy: 'Buy with Escrow',
    makeOffer: 'Make Offer & Negotiate',
    contactSeller: 'Chat',

    // Listing Creation
    createListingTitle: 'List an Item with AI Assistance',
    createListingSubtitle: 'AI analyzes photos, estimates fair market price, and prevents fraudulent listings',
    stepInfo: '1. Basic Information',
    stepPhotos: '2. Standard 5-Photo Checklist',
    stepValuation: '3. AI Price Estimation & Publish',
    itemTitle: 'Listing Title',
    itemBrand: 'Brand',
    itemModel: 'Model / Variant',
    purchaseYear: 'Year of Purchase / Release',
    originalPrice: 'Original Retail Price (VND)',
    declaredCondition: 'Declared Condition',
    accessories: 'Included Accessories',
    description: 'Detailed Description',
    runAiEstimation: 'Run AI Price Estimation',
    analyzingMarket: 'AI analyzing 1,400+ real Vietnamese market transactions...',
    aiValuationResult: 'AI Valuation Results',
    fairRange: 'Fair Market Price Range',
    suggestedPrice: 'Recommended Listing Price',
    quickSalePrice: 'Quick Sale Price (within 3 days)',
    confidenceScore: 'Model Confidence',
    finalListingPrice: 'Your Final Listing Price (VND)',
    disclaimer: 'Notice: AI estimates are advisory. As the seller, you always set the final listing price.',
    publishListing: 'Publish to SecondLife',

    // Multi-version photos
    photoChecklistTitle: 'Standardized Required Photos (5 Angles)',
    photoFront: 'Front View (Screen active)',
    photoBack: 'Back & Frame',
    photoScreenOrDetails: 'Close-up of Scratches / Details',
    photoAccessories: 'Accessories & Original Box',
    photoSerialOrReceipt: 'Serial / IMEI / Purchase Proof',

    // Escrow & Inspection
    escrowStatusTitle: 'Escrow Status & 2-Leg Delivery Tracking',
    orderSummary: 'Escrow Order Breakdown',
    itemAmount: 'Item Price (Held in Escrow)',
    inspectionFee: 'Certification & Inspection Fee',
    shippingFee: 'Logistics & Insurance Fee',
    platformFee: 'Platform Service Fee',
    totalEscrow: 'Total Escrow Held Amount',
    verifyThenShip: '"Verify Then Ship" Workflow',
    whyInspection: 'Items are routed to a certified SecondLife Inspection Hub for physical diagnostics, seal application, and authentication prior to final delivery (disassembly inspection voids original factory "zin" condition).',
    inspectionZinLossWarning: 'Inspection Notice: Technicians will disassemble the product for internal hardware inspection, which voids the original "zin" condition.',
    inspectionZinLossAgree: 'I understand and agree that the product will be disassembled for inspection and will lose its original "zin" condition.',
    leg1: 'Leg 1: Seller to Inspection Hub',
    leg2: 'Leg 2: Inspection Hub to Buyer',
    tamperSeal: 'Tamper-Proof NFC Seal ID',
    inspectionVerdict: 'Inspection Verdict',
    inspectionPass: 'AUTHENTIC & VERIFIED PASS',
    inspectionFail: 'FAILED INSPECTION - RETURN PENDING',
    confirmReceipt: 'Confirm Receipt',
    openDispute: 'Open Dispute / Request Return',
    inspectionWindowNotice: 'You have a 48-hour inspection window before funds automatically release to seller.',

    // Multi-stage photo history
    multiStageTitle: '2-Stage Multi-Version Photo Audit (Anti-Swapping)',
    multiStageTitle2Stage: 'Photo Audit (Anti-Swapping)',
    stageListing: '1. Seller Listing Photos',
    stageInspection: '2. Inspection Center Photos',
    stageHandover: '3. Packaging & Courier Handover',

    // Inspector
    inspectorTitle: 'Inspection Center Portal (Certified Technician)',
    inspectorQueue: 'Assigned Verification Queue',
    scanQrItem: 'Scan QR / Enter Order ID',
    executeChecklist: 'Execute Category Standard Checklist',
    attachInspectorPhotos: 'Upload Microscope & Seal Photos',
    issueReport: 'Sign & Issue Certified Inspection Report',

    // Admin
    adminDashboardTitle: 'Trust & Safety Admin Control Center',
    totalGmv: 'Gross Merchandise Value (GMV)',
    heldInEscrow: 'Funds Held in Escrow',
    inspectionPassRate: 'Inspection Pass Rate',
    disputeRate: 'Dispute Rate',
    disputeWorkbench: 'Dispute Arbitration Workbench',
    fraudAlerts: 'Fraud & Duplicate Photo Alerts',
    modelPerformance: 'AI Valuation Model Performance',
    exportReport: 'Export Analytics Report (CSV/PDF)'
  }
};

export function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function formatConditionGrade(
  grade?: string | null,
  lang: Language = 'vi'
): string {
  if (!grade) return '';
  const trimmed = String(grade).trim();
  if (!trimmed) return '';

  const clean = trimmed.toUpperCase().replace(/[-_]/g, ' ').trim();

  if (lang === 'en') {
    if (clean === 'LIKE NEW' || clean === 'LIKENEW' || clean === 'NHƯ MỚI') return 'Like New';
    if (clean === 'GOOD' || clean === 'USED GOOD' || clean === 'TỐT') return 'Good';
    if (clean === 'FAIR' || clean === 'USED FAIR' || clean === 'KHÁ') return 'Fair';
    if (clean === 'NEW' || clean === 'BRAND NEW' || clean === 'MỚI 100%' || clean === 'MỚI') return 'New';
    if (clean === 'POOR' || clean === 'CŨ' || clean === 'KÉM') return 'Poor';
    if (clean === 'USED' || clean === 'ĐÃ QUA SỬ DỤNG') return 'Used';
    return trimmed;
  }

  // lang === 'vi'
  if (clean === 'FAIR' || clean === 'USED FAIR') return 'Khá';
  if (clean === 'GOOD' || clean === 'USED GOOD') return 'Tốt';
  if (clean === 'LIKE NEW' || clean === 'LIKENEW') return 'Như mới';
  if (clean === 'NEW' || clean === 'BRAND NEW') return 'Mới 100%';
  if (clean === 'POOR') return 'Trung bình / Cũ';
  if (clean === 'USED') return 'Đã qua sử dụng';

  // Handle strings with percentages or extra info like "Fair (90%)", "Good (95%)", "Like New (99%)"
  if (/^FAIR\b/i.test(trimmed)) return trimmed.replace(/^fair/i, 'Khá');
  if (/^GOOD\b/i.test(trimmed)) return trimmed.replace(/^good/i, 'Tốt');
  if (/^LIKE\s*NEW\b/i.test(trimmed)) return trimmed.replace(/^like\s*new/i, 'Như mới');
  if (/^NEW\b/i.test(trimmed)) return trimmed.replace(/^new/i, 'Mới 100%');
  if (/^POOR\b/i.test(trimmed)) return trimmed.replace(/^poor/i, 'Trung bình');

  return trimmed;
}
