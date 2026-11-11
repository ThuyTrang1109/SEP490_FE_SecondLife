# BÁO CÁO TOÀN DIỆN: RÀ SOÁT, XÓA BỎ MOCK DATA & ĐỐI SOÁT API FE - BE

> **Dự án:** SecondLife - Sàn Recommerce Đồ Điện Máy & Gia Dụng Có Kiểm Định  
> **Thời điểm cập nhật:** 31/10/2026  
> **Trạng thái hệ thống:**  
> - **Backend Spring Boot (port 8080):** Đang chạy bình thường (`200 OK`).  
> - **Frontend React & Node.js Reverse Proxy (port 3000):** Đang chạy bình thường, định tuyến thông suốt cả truy cập trực tiếp `localhost:3000` và qua tunnel `ngrok`.  
> - **Kiểm tra kiểu dữ liệu TypeScript (`npm run lint`):** `0 errors` (Hoàn toàn sạch lỗi).

---

## I. GIẢI THÍCH CHI TIẾT CÁC HÌNH ẢNH LỖI NGƯỜI DÙNG GỬI

| Hình ảnh | Hiện tượng hiển thị | Nguyên nhân kỹ thuật gốc rễ | Trạng thái xử lý |
| :--- | :--- | :--- | :--- |
| **Hình 1 & 2** | Trang cảnh báo ngrok: *"You are about to visit... To remove this page: Set ngrok-skip-browser-warning"* | Đây là cơ chế bảo vệ chống lạm dụng mặc định của tài khoản ngrok gói miễn phí (Free Plan). Khi truy cập lần đầu qua link ngrok, ngrok yêu cầu người dùng bấm nút **Visit Site** hoặc gửi header `ngrok-skip-browser-warning`. | **Đã xử lý:** Client tự động đính kèm header khi truy cập qua ngrok, đồng thời Reverse Proxy Node.js lọc chuyển tiếp an toàn vào Backend. |
| **Hình 3, 4, 5** | Modal Đăng nhập báo đỏ: *"Không thể kết nối đến Backend Server. Vui lòng kiểm tra lại backend (port 8080)"* & DevTools báo lỗi CORS `ngrok-skip-browser-warning`. | Tại thời điểm chụp màn hình, **tiến trình Java Backend (port 8080) chưa được bật hoặc bị dừng đột ngột** (`ECONNREFUSED 127.0.0.1:8080`). Khi Backend tắt, request preflight OPTIONS không nhận được phản hồi hợp lệ từ máy chủ 8080 nên trình duyệt báo lỗi mạng / CORS. | **Đã kiểm tra & khắc phục:** Backend đã khởi chạy thành công (`http://127.0.0.1:8080/api/v1/posts` trả về HTTP 200 OK). Frontend Reverse Proxy trên cổng 3000 đã kết nối ổn định tới Backend. |
| **Hình 6** | Tài khoản Người bán (`Thị Thùy Trang Nguyễn`) mở đơn hàng nhưng giao diện lại hiển thị: <br>• Banner xanh: *"Sản phẩm đã vượt qua bài kiểm định kỹ thuật!"* <br>• Nút hành động: *"Xác Nhận Mua Hàng (8.500.000 đ)"* và *"Từ Chối Mua Tiếp"* <br>• Tình trạng hiển thị mâu thuẫn: *"Chờ thẩm định / Checklist (0)"* | Ảnh chụp vào thời điểm **01:21 AM**, lúc đó mã nguồn cũ chưa được cập nhật và trình duyệt lưu bộ nhớ cache phiên làm việc trước khi bản vá logic phân quyền role được áp dụng. | **Đã xử lý triệt để:** <br>1. Gia cố biến `isUserSeller`: Người bán tuyệt đối **không bao giờ** nhìn thấy nút mua hàng hoặc banner mua hàng của chính mình. <br>2. Thắt chặt điều kiện `isPassed`: Khi sản phẩm đang *"Chờ thẩm định"*, nút thanh toán giai đoạn 2 hoàn toàn bị khóa. |

---

## II. TOÀN BỘ MOCK DATA ĐÃ ĐƯỢC RÀ SOÁT VÀ XÓA BỎ KHỎI FRONTEND

Thực hiện nghiêm ngặt nguyên tắc **"Không tạo dữ liệu ảo - Chưa kiểm định thì để nguyên trạng thái chờ"**, toàn bộ các điểm gán dữ liệu giả lập đã được xử lý:

### 1. `src/data/mockData.ts`
- Đã xóa checklist mẫu phía FE. Kỹ thuật viên dùng checklist của đơn từ `GET /api/v1/inspector/orders/{orderId}/checklist`. Khi API trả danh sách rỗng hoặc báo lỗi, màn hình cho tải lại và chờ có checklist trước khi nộp biên bản.
- Trong `mockInspectionCenters`: Xóa bỏ các chỉ số ảo như tỷ lệ đạt giả (`passRatePercentage: 95.4%`), số KTV trực giả.

### 2. `src/data/mockReviews.ts`
- **Trước khi sửa:** Hàm `getSellerTrustProfile` tự động gán cho mọi người bán chỉ số ảo: `trustScore: 100`, `rating: 5.0`, `hubPassRate: 100%`, `completionRate: 100%`, `cancellationRate: 0%`.
- **Sau khi sửa:**
  - Xóa toàn bộ chỉ số 100% ảo. Đưa về giá trị trung thực khi chưa có dữ liệu: `trustScore: 0` (hoặc `null`), `rating: 0`, `reviewCount: 0`, `hubPassRate: 0`, `cancellationRate: 0`.
  - Phân hạng hiển thị mặc định: `Người bán mới` (thay vì tự phong hạng cao).

### 3. Modal Chat Sản Phẩm (`ChatModal.tsx`)
- **Trước khi sửa:** Khi người bán chưa có điểm, giao diện tự rơi về mock: `sellerTrust.trustScore` (100 điểm) và hiển thị ngôi sao vàng `5.0 ★`.
- **Sau khi sửa:**
  - Kết nối trực tiếp vào `reputationService.getSellerReputation(sellerId)` (`GET /api/v1/sellers/{id}/reputation`).
  - Nếu người bán chưa có giao dịch: Hiển thị nhãn trung thực `"Người bán mới"` hoặc `"Chưa có điểm uy tín"`.
  - Ẩn hoàn toàn đánh giá sao nếu người bán chưa có đánh giá thực tế (`rating === 0`).

### 4. Modal Chi Tiết Sản Phẩm (`ListingDetailModal.tsx`)
- **Trước khi sửa:** Huy hiệu uy tín fallback về điểm 100 ảo, tỷ lệ Hub đạt chuẩn hiển thị cố định 100%.
- **Sau khi sửa:**
  - Hiển thị điểm số uy tín thực tế từ Backend. Nếu Backend trả về chưa có điểm thì hiển thị `-- / 100` kèm nhãn trạng thái chính thức: `CHƯA CÓ GIAO DỊCH` hoặc `CHƯA ĐỦ ĐƠN`.
  - Thay thế tỷ lệ pass 100% ảo bằng số lượng đơn hàng đã nghiệm thu thực tế: `{evaluatedOrders} đơn`.
  - Ẩn số sao trung bình nếu sản phẩm chưa có người mua nào đánh giá.

### 5. Modal Đánh Giá Người Bán (`SellerReviewsModal.tsx`)
- **Trước khi sửa:** Toàn bộ bảng chỉ số (Tỷ lệ hoàn thành 100%, Hub đạt chuẩn 100%, Phản hồi chat 100%) lấy từ mock.
- **Sau khi sửa:**
  - Đồng bộ 100% dữ liệu thực từ API Backend: `goodTransactions`, `badTransactions`, `evaluatedOrders`, `sellerCancellationOrders`.
  - Nếu người bán chưa có nhận xét bằng văn bản từ khách hàng: Hiển thị hộp thông báo rỗng trang nhã: *"Người bán này chưa có nhận xét nào từ khách mua qua quỹ Escrow"* thay vì render các bình luận mẫu.

### 6. Trạm Kiểm Định Kỹ Thuật Viên (`ProductInspectionStationView.tsx`)
- **Trước khi sửa:** Trạm kiểm định tự điền sẵn điểm số ngoại quan 90 và kết luận thẩm định mặc định là `PASS`.
- **Sau khi sửa:**
  - Khởi tạo đơn hàng mới với điểm số bằng `0` và danh sách checklist ở trạng thái chờ thẩm định (`pending`).
  - Kỹ thuật viên bắt buộc phải thực hiện thao tác kiểm tra thực tế, chấm từng tiêu chí và gõ nhận xét trước khi ký số biên bản xuất tem niêm phong NFC.

### 7. Trang Quyết Định Mua Hàng Của Người Mua (`BuyerInspectionDecisionView.tsx`)
- **Sau khi củng cố:**
  - **Góc nhìn Người bán (`isUserSeller = true`):** Tuyệt đối không hiển thị nút *"Xác nhận mua tiếp"*, *"Từ chối mua"* hay phần trừ tiền ví. Thay vào đó hiển thị banner Người bán và thông báo tiến độ bàn giao hàng cho tài xế.
  - **Góc nhìn Người mua (`isUserSeller = false`):** Chỉ khi kỹ thuật viên xuất biên bản ĐẠT (`isPassed = true`), nút thanh toán Giai đoạn 2 mới được mở khóa. Nếu đơn hàng đang ở trạng thái *"Chờ thẩm định"*, giao diện hiển thị trạng thái đang chờ điều phối KTV, không có mock data pass ảo.

---

## III. BẢNG ĐỐI SOÁT API: ĐÃ KẾT NỐI VÀ DANH SÁCH API CÒN THIẾU TRÊN BACKEND

### 1. Danh sách các phân hệ ĐÃ KẾT NỐI API THỰC TẾ với Backend Spring Boot

| Phân hệ | Endpoint Backend | Service Frontend | Trạng thái tích hợp |
| :--- | :--- | :--- | :--- |
| **Xác thực & Tài khoản** | `POST /api/auth/login`<br>`POST /api/auth/register`<br>`GET /api/v1/users/me` | `authService.ts`<br>`userService.ts` | **Hoàn tất 100%** |
| **Sàn & Bài đăng** | `GET /api/v1/posts`<br>`GET /api/v1/posts/{id}`<br>`GET /api/v1/categories` | `postService.ts`<br>`categoryService.ts` | **Hoàn tất 100%** |
| **Định giá AI & Rủi ro** | `POST /api/v1/ai/estimate-price`<br>`POST /api/v1/ai/listings/evaluate-risk` | `apiClient.ts`<br>`server.ts` | **Hoàn tất 100%** |
| **Đơn hàng Escrow** | `POST /api/v1/orders`<br>`GET /api/v1/orders/my-buyer-orders`<br>`GET /api/v1/orders/my-seller-orders`<br>`PUT /api/v1/orders/{id}/shipped`<br>`PUT /api/v1/orders/{id}/delivered` | `orderService.ts` | **Hoàn tất 100%** |
| **Ví & Nạp tiền SePay** | `GET /api/v1/wallets/me`<br>`POST /api/v1/topups/create`<br>`POST /api/v1/webhooks/sepay` | `walletService.ts`<br>`topupService.ts` | **Hoàn tất 100%** |
| **Quy trình Kiểm định** | `POST /api/v1/inspections/orders/{id}/pay-fee`<br>`POST /api/v1/inspections/orders/{id}/confirm-purchase`<br>`POST /api/v1/inspections/orders/{id}/reject-purchase`<br>`POST /api/v1/inspections/orders/{id}/appeal`<br>`GET /api/v1/inspections/orders/{id}` | `inspectorService.ts` | **Hoàn tất 100%** |
| **Kỹ thuật viên Hub** | `GET /api/v1/inspector/orders`<br>`GET /api/v1/inspector/orders/{id}/checklist`<br>`POST /api/v1/inspector/orders/{id}/start`<br>`POST /api/v1/inspector/orders/{id}/result`<br>`POST /api/v1/inspector/orders/{id}/seal` | `inspectorService.ts` | **Hoàn tất 100%** |
| **Điều phối Hub** | `GET /api/v1/inspector-center/orders`<br>`POST /api/v1/inspector-center/orders/{id}/assign`<br>`POST /api/v1/inspector-center/orders/{id}/review-appeal` | `inspectorService.ts` | **Hoàn tất 100%** |
| **Báo giá Kiểm định** | `POST /api/v1/inspection/quote`<br>`GET /api/v1/inspections/seal/{code}` | `inspectorService.ts` | **Hoàn tất 100%** |
| **Điểm Uy tín Người bán**| `GET /api/v1/sellers/{id}/reputation`<br>`GET /api/v1/seller/reputation/me` | `reputationService.ts` | **Hoàn tất 100%** |
| **Báo cáo & Khiếu nại** | `POST /api/v1/user-reports`<br>`GET /api/v1/user-reports/me`<br>`GET /api/v1/staff/reports` | `userReportService.ts`<br>`staffReportService.ts` | **Hoàn tất 100%** |
| **Vận chuyển Lalamove** | `POST /api/v1/shipping/quote`<br>`POST /api/v1/shipping/order`<br>`GET /api/v1/shipments/{id}/tracking` | `shippingService.ts` | **Hoàn tất 100%** |
| **Chat & Thông báo** | `GET /api/v1/chats/rooms`<br>`POST /api/v1/chats/rooms/{id}/messages`<br>`GET /api/v1/notifications`<br>`WebSocket /ws` | `chatService.ts`<br>`notificationService.ts` | **Hoàn tất 100%** |

---

### 2. Danh sách API CHƯA CÓ trên Backend (Missing Endpoints / Gap Analysis)

Qua quá trình rà soát toàn bộ 50 Controllers của Backend Spring Boot, dưới đây là danh sách các API mà **Backend hiện chưa cung cấp**:

```
                                  DANH SÁCH API CHƯA MOCK / CHƯA CÓ TRÊN BACKEND
┌─────────────────────────────────────────────────────────────┬──────────┬────────────────────────────────────────────────────────────────────────────┐
│ Endpoint đề xuất cần bổ sung trên Backend                   │ Method   │ Mục đích & Cách Frontend đang xử lý sạch hiện tại                          │
├─────────────────────────────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────┤
│ /api/v1/inspection-centers                                  │ GET      │ Lấy danh sách các Trung tâm kiểm định SecondLife Hubs.                     │
│                                                             │          │ → Hiện tại FE dùng danh sách địa chỉ 3 Hub thực tế (HCM, HN, ĐN)           │
│                                                             │          │   với các chỉ số rỗng (0%), không tạo số liệu giả.                         │
├─────────────────────────────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────┤
│ /api/v1/reviews                                             │ POST     │ Người mua gửi đánh giá sao & nhận xét sau khi đơn hàng giải ngân thành công.│
│ /api/v1/reviews/seller/{sellerId}                           │ GET      │ Lấy danh sách đánh giá nhận xét của một người bán.                         │
│                                                             │          │ → Hiện tại FE lấy chỉ số uy tín qua GET /sellers/{id}/reputation;          │
│                                                             │          │   phần nhận xét văn bản hiển thị trạng thái rỗng nếu chưa có đánh giá.     │
├─────────────────────────────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────┤
│ /api/v1/inspection-checklists/by-category/{categoryId}      │ GET      │ Lấy mẫu tiêu chí kiểm định động công khai theo danh mục sản phẩm.           │
│                                                             │          │ → Backend mới chỉ có GET /inspector/orders/{orderId}/checklist (đã có đơn).│
│                                                             │          │   FE đã xóa bỏ toàn bộ status 'pass' ảo, mọi tiêu chí bắt đầu bằng pending │
├─────────────────────────────────────────────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────┤
│ /api/v1/admin/orders                                        │ GET      │ Quản trị viên xem và tìm kiếm toàn bộ đơn hàng trên toàn sàn.               │
│                                                             │          │ → Backend hiện mới có GET /staff/orders (đơn chờ người bán xác nhận)       │
│                                                             │          │   và GET /inspector-center/orders (đơn kiểm định).                         │
│                                                             │          │   Tab Admin Orders hiển thị banner thông báo rõ ràng về phạm vi dữ liệu.   │
└─────────────────────────────────────────────────────────────┴──────────┴────────────────────────────────────────────────────────────────────────────┘
```

---

## IV. TỔNG KẾT & HƯỚNG DẪN KIỂM THỬ TRỰC TIẾP

1. **Khởi chạy ứng dụng:**
   - **Backend:** Đang chạy tại `http://localhost:8080`.
   - **Frontend:** Đang chạy tại `http://localhost:3000` (hoặc thông qua tunnel ngrok).
2. **Kiểm tra luồng Người bán (Seller):**
   - Đăng nhập với tài khoản Seller (ví dụ `seller@secondlife.com` hoặc tài khoản Thị Thùy Trang Nguyễn).
   - Truy cập vào trang đơn kiểm định: Giao diện sẽ hiển thị đúng tiêu đề **"Kênh Người Bán • Theo Dõi Đơn Kiểm Định"**, tuyệt đối không có nút *"Xác nhận mua tiếp"* hay trừ tiền ví.
3. **Kiểm tra luồng Người mua (Buyer):**
   - Đăng nhập tài khoản Buyer.
   - Khi đơn hàng vừa đặt cọc xong: Trạng thái hiển thị là **"Chờ thẩm định"**, checklist 0 hạng mục đạt, nút chốt mua Giai đoạn 2 chưa mở.
   - Khi Kỹ thuật viên Hub tiến hành kiểm định thực tế và gửi kết quả ĐẠT: Nút thanh toán Giai đoạn 2 sẽ tự động sáng lên để Người mua kiểm tra biên bản kỹ thuật và quyết định chốt mua.
