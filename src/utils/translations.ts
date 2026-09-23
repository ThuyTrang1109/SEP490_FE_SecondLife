import { Language } from '../types';

export const translations = {
  vi: {
    brandName: 'SecondLife',
    tagline: 'Sàn đồ cũ tích hợp AI định giá & Dịch vụ kiểm định xác thực',
    knowFairPrice: 'Biết giá chuẩn - Kiểm định trước khi thanh toán - Giao dịch an tâm tuyệt đối',
    
    // Roles
    roleBuyer: 'Người Mua (Buyer)',
    roleSeller: 'Người Bán (Seller)',
    roleInspector: 'Trung Tâm Giám Định (Inspector)',
    roleAdmin: 'Quản Trị Viên (Admin)',
    switchRole: 'Chuyển vai trò thử nghiệm',

    // Nav
    navMarketplace: 'Sàn Đồ Cũ',
    navCreateListing: 'Đăng Bán & Định Giá AI',
    navMyOrders: 'Đơn Hàng & Escrow',
    navInspectionHub: 'Trung Tâm Kiểm Định',
    navAdminDashboard: 'Admin Control Center',
    navChat: 'Đàm Phán & Tin Nhắn',
    
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
    createListingTitle: 'Đăng Bán Có AI Trợ Lực',
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
    platformFee: 'Phí dịch vụ nền tảng (2.5%)',
    totalEscrow: 'Tổng tiền phong tỏa Escrow',
    verifyThenShip: 'Quy trình "Kiểm định trước khi thanh toán"',
    whyInspection: 'Hàng gửi tới Trung tâm giám định SecondLife để chuyên gia mở máy, test linh kiện, dán tem niêm phong trước khi giao cho bạn.',
    leg1: 'Chặng 1: Người bán gửi tới Trung tâm',
    leg2: 'Chặng 2: Trung tâm giao Người mua',
    tamperSeal: 'Mã tem niêm phong NFC',
    inspectionVerdict: 'Kết luận giám định',
    inspectionPass: 'ĐẠT CHUẨN XÁC THỰC',
    inspectionFail: 'KHÔNG ĐẠT - TỰ ĐỘNG HOÀN TIỀN',
    confirmReceipt: 'Xác nhận nhận hàng & Giải ngân cho Người bán',
    openDispute: 'Khiếu nại / Trả hàng nếu có sai khác',
    inspectionWindowNotice: 'Bạn có 48 giờ để dùng thử trước khi tiền tự động giải ngân cho người bán.',
    
    // Multi-stage photo history
    multiStageTitle: 'Lịch sử ảnh 3 giai đoạn đối chiếu (Chống tráo hàng)',
    stageListing: '1. Ảnh người bán đăng',
    stageInspection: '2. Ảnh trung tâm kiểm định',
    stageHandover: '3. Ảnh lúc đóng gói & bàn giao',

    // Inspector
    inspectorTitle: 'Cổng Thao Tác Kiểm Định Viên (Inspector Portal)',
    inspectorQueue: 'Hàng đợi kiểm định cần xử lý',
    scanQrItem: 'Quét mã QR / Nhập mã đơn',
    executeChecklist: 'Thực thi checklist tiêu chuẩn',
    attachInspectorPhotos: 'Tải ảnh soi kính & tem niêm phong',
    issueReport: 'Ký số & Xuất Báo Cáo Giám Định',

    // Admin
    adminDashboardTitle: 'Trung Tâm Điều Hành & Giám Sát Rủi Ro',
    totalGmv: 'Tổng GMV Giao Dịch',
    heldInEscrow: 'Tiền đang giữ trong Escrow',
    inspectionPassRate: 'Tỷ lệ kiểm định đạt chuẩn',
    disputeRate: 'Tỷ lệ tranh chấp',
    disputeWorkbench: 'Bàn Trọng Tài Tranh Chấp (Arbitration)',
    fraudAlerts: 'Cảnh báo chống gian lận & Ảnh trùng lặp',
    modelPerformance: 'Hiệu năng mô hình AI Định Giá',
    exportReport: 'Xuất Báo Cáo Thống Kê (CSV/PDF)'
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
    platformFee: 'Platform Service Fee (2.5%)',
    totalEscrow: 'Total Escrow Held Amount',
    verifyThenShip: '"Verify Then Ship" Workflow',
    whyInspection: 'Items are routed to a certified SecondLife Inspection Hub for physical diagnostics, seal application, and authentication prior to final delivery.',
    leg1: 'Leg 1: Seller to Inspection Hub',
    leg2: 'Leg 2: Inspection Hub to Buyer',
    tamperSeal: 'Tamper-Proof NFC Seal ID',
    inspectionVerdict: 'Inspection Verdict',
    inspectionPass: 'AUTHENTIC & VERIFIED PASS',
    inspectionFail: 'FAILED INSPECTION - AUTO REFUND',
    confirmReceipt: 'Confirm Receipt & Release Funds to Seller',
    openDispute: 'Open Dispute / Request Return',
    inspectionWindowNotice: 'You have a 48-hour inspection window before funds automatically release to seller.',

    // Multi-stage photo history
    multiStageTitle: '3-Stage Multi-Version Photo Audit (Anti-Swapping)',
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
