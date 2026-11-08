# Role-based routing của SecondLife

## Kiến trúc và phạm vi

Ứng dụng tiếp tục dùng một frontend, một domain và Browser History API hiện có. Dự án chưa có React Router; thay đổi này không cài thêm thư viện. URL là nguồn xác định màn hình thay cho `activeTab` chỉ lưu trong bộ nhớ/sessionStorage.

- `src/app/router/paths.ts`: danh sách route theo nhóm, đường dẫn tập trung, dynamic parameters, chuyển đổi URL cũ và kiểm tra quyền.
- `src/app/router/browser.ts`: điều hướng bằng push/replaceState, đăng ký Back/Forward bằng useSyncExternalStore và hook cho sidebar/tab con.
- `src/app/router/RouteStatusPage.tsx`: giao diện 403/404.
- `src/App.tsx`: nối route với auth và các page/modal hiện có; chỉ mount feature được phép sau khi khôi phục phiên.

Main layout, Navbar/Footer và các dashboard có sidebar riêng tiếp tục được tái sử dụng. Buyer/seller vẫn dùng chung InboxView, EscrowOrdersView và ProfileDialog. Không tạo màn hình quản trị settings/reports hoặc màn chi tiết staff report vì chưa có các feature tương ứng.

## Bảng ánh xạ chính

| URL/tab trước | Role | URL mới | Component hiện có | Tương thích cũ |
| --- | --- | --- | --- | --- |
| `/`, `home` | Public | `/` | HomePageView | Có |
| `marketplace`, `/marketplace` | Public | `/products` | MarketplaceView | Redirect |
| Modal sản phẩm, `/posts/:id`, `/listing/:id` | Public | `/products/:productId` | ListingDetailModal | Redirect theo ID |
| Modal đăng nhập/đăng ký | Public | `/login`, `/register`, `/forgot-password` | AuthModal | Giữ modal hiện có |
| Trang chủ sau đăng nhập buyer | Buyer | `/buyer/dashboard` | HomePageView | Màn hiện có |
| `seller-dashboard`, `/seller/posts` | Seller | `/seller/dashboard`, `/seller/products` | SellerDashboardView | Redirect |
| `create-listing` | Seller; staff được đăng bài như trước | `/seller/products/create`, `/staff/products/create` | CreateListingView | Redirect |
| Sửa bản nháp, `/seller/posts/:id/edit` | Seller | `/seller/products/:productId/edit` | CreateListingView + getDraft | Redirect theo ID |
| Chi tiết bài cá nhân | Seller | `/seller/products/:productId` | ListingDetailModal + getMyPostDetail | Dùng API chủ bài khi tải lại |
| `/orders`, `orders` | Buyer/Seller | `/buyer/orders`, `/seller/orders` | EscrowOrdersView | Chọn theo role xác thực |
| `/orders?orderId=:id` | Buyer/Seller | `/{buyer,seller}/orders/:orderId` | Modal chi tiết trong EscrowOrdersView | Giữ ID và query filter |
| `/chat`, `/negotiations` | Buyer/Seller | `/{buyer,seller}/chat` | InboxView | Chọn theo role xác thực |
| `/chat?roomId=:id` | Buyer/Seller | `/{buyer,seller}/chat/:conversationId` | DedicatedChatRoom | Giữ ID |
| `/buyer-inspection-decision?orderId=:id` | Buyer/Seller tham gia đơn | `/{buyer,seller}/inspections/:inspectionId/decision` | BuyerInspectionDecisionView | Redirect theo ID |
| Modal hồ sơ | Role đã đăng nhập | `/{role}/profile` | ProfileDialog | Giữ giao diện modal |
| `/notifications`, `/disputes` | Role phù hợp | `/{role}/notifications`, `/{buyer,seller}/disputes` | Các page hiện có | Redirect |
| `staff-workspace` | Staff | `/staff/dashboard` và các section dưới đây | StaffWorkspaceView | Redirect |
| `inspection-hub`, `/inspector` | Inspector | `/inspector/dashboard` | InspectorPortalView | Redirect |
| Chọn đơn trong bàn kiểm định | Inspector | `/inspector/inspections/:inspectionId` | ProductInspectionStationView | Giữ ID; không tự chọn đơn khác nếu ID không tìm thấy |
| `inspection-center`, `/inspector-center` | Inspection center | `/inspection-center/dashboard` | InspectionCenterDashboardView | Redirect |
| `admin-dashboard` | Admin | `/admin/dashboard` | AdminDashboardView | Redirect |
| Modal chi tiết user | Admin | `/admin/users/:userId` | Modal user của AdminDashboardView | Có thể tải trực tiếp theo ID |
| Modal bài đăng trong quản trị | Admin | `/admin/products/:productId` | ListingDetailModal trong AdminDashboardView | Giữ dashboard quản trị phía sau modal |

Các đường dẫn `/{role}/profile` và `/{role}/notifications` dùng prefix `inspection-center` cho role nội bộ `inspection_center`.

## Section của các dashboard

| Nhóm | Các URL và chức năng đã có |
| --- | --- |
| Admin | `/admin/dashboard`, `/admin/users`, `/admin/orders`, `/admin/products`, `/admin/catalog-ai`, `/admin/withdrawals`, `/admin/hubs`, `/admin/seller-kyc`, `/admin/permissions`, `/admin/credit-pricing`, `/admin/system-wallet`, `/admin/commission-rules`, `/admin/inspection-governance` |
| Staff | `/staff/dashboard`, `/staff/products`, `/staff/proof-possession`, `/staff/reports`, `/staff/disputes`, `/staff/refunds`, `/staff/payouts`, `/staff/transactions`, `/staff/restrictions` |
| Inspector | `/inspector/dashboard` (bàn làm việc), `/inspector/inspections` (hàng đợi), `/inspector/inspections/:inspectionId`, `/inspector/certificates`, `/inspector/standards` |
| Trưởng trung tâm | `/inspection-center/dashboard`, `/inspection-center/dispatch`, `/inspection-center/staff`, `/inspection-center/orders`, `/inspection-center/checklists`, `/inspection-center/pricing`, `/inspection-center/appeals` |

Các section tiếp tục dùng logic/API hiện có của dashboard. URL mới không hoàn thiện thêm các chức năng nghiệp vụ còn dở như modal appeal.

## Auth và RoleGuard

1. Dùng token, refresh interceptor, getStoredUser, AuthModal và `/users/me` hiện có.
2. Trước khi mount protected page, chờ bước khôi phục phiên hoàn tất; hiển thị loading thay vì redirect từ role chưa xác minh.
3. `getRouteAccess` kiểm tra role thực từ danh sách `roles` của response đăng nhập hoặc `/me`. `UserProfile.role` chỉ là role đang sử dụng; chọn role mới phải thuộc danh sách được cấp, hoặc được xác minh lại qua `/me` sau onboarding.
4. Chưa đăng nhập: chuyển `/login?redirect=...`. URL cũ mơ hồ như `/orders` được giữ trong redirect, rồi mới xác định buyer/seller sau khi đăng nhập.
5. Sai role: chuyển `/unauthorized`; component nghiệp vụ không được mount trước khi chuyển hướng.
6. Danh sách nhiều role được giữ lại. Seller vẫn có khả năng mua hàng/chat với vai trò buyer như nghiệp vụ cũ; không cấp quyền nội bộ từ tên URL.
7. Đường dẫn quay lại sau đăng nhập chỉ chấp nhận URL nội bộ, loại bỏ redirect sang domain ngoài hoặc vòng lặp về trang auth.
8. Backend tiếp tục kiểm tra quyền và quyền sở hữu tài nguyên. Route guard FE không thay thế phân quyền API.

## Điều hướng, refresh và query

- Sidebar, Navbar, Footer và các callback page chuyển qua router chung; các section dashboard có URL riêng.
- Chọn/đóng phòng chat, đơn hàng và modal chi tiết user cập nhật URL. Back/Forward đọc lại URL thay vì tab lưu từ phiên trước.
- Mở chat từ sản phẩm dùng `?postId=...` để tìm/tạo phòng theo nghiệp vụ cũ, sau đó thay bằng `/chat/:conversationId`. Quay lại `/chat` không tự mở lại phòng chỉ vì còn listing trong state.
- Mở/sửa sản phẩm trực tiếp theo ID tải lại dữ liệu bằng API hiện có. Danh sách chat, đơn hàng và đơn KTV tiếp tục lấy dữ liệu theo quyền qua các API hiện có.
- Filter đơn hàng lưu bằng `?filter=...`. Query cũ `order_tab`/`tab` còn được đọc, các query khác được giữ khi redirect.
- Đường dẫn cũ `?tab=...`, `?tap=...`, hash tab, `?subtab=...`, `/orders`, `/chat`, `/posts/:id` vẫn được chuyển đổi. Canonicalization phải idempotent.
- Thông báo FE mới phát ra URL có prefix role của người nhận. Thông báo BE/lịch sử với URL cũ đi qua cùng resolver.
- Express/Vite đã có SPA fallback; không sửa port, domain, cấu hình Vite hay backend.

## Kiểm tra

```powershell
npm run lint
node --import tsx --test src/tests/routing.test.ts src/tests/walletTransactions.test.ts src/tests/chatRoleLogic.test.ts
npm run build
```

Suite routing kiểm tra mọi route đã đăng ký, public/guest, hydration, quyền từng role, nhiều role, không tự cấp admin từ URL, dynamic parameters, query, legacy redirects, tính idempotent, return URL an toàn và push/replace/Back/Forward.

Kiểm tra trình duyệt gồm mở protected URL khi chưa đăng nhập và giữ đường dẫn quay về, mở trực tiếp đăng ký, đổi tab auth, marketplace, trang 403, link orders cũ, refresh và Back/Forward. Không tự đăng nhập hoặc tạo tài khoản test trên dữ liệu thật.

Cần thử thủ công bằng tài khoản thật từng role: đăng nhập và quay về tài nguyên được phép; mở đơn/phòng chat thực; sửa bản nháp; chi tiết user; sidebar các dashboard; đăng xuất. Các kiểm thử phân quyền tự động dùng dữ liệu user giả lập và không chứng minh quyền API thực của các tài khoản này.

Giới hạn giữ từ feature hiện có: chi tiết đơn hàng trong EscrowOrdersView được tìm từ danh sách đơn đã tải của người dùng, và bàn KTV chỉ mở đơn có trong danh sách được phân công. Không thêm endpoint/backend hoặc thay đổi phân trang để truy xuất tài nguyên ngoài dữ liệu feature đang tải.

Chi tiết sản phẩm quản trị khi refresh dùng API danh sách quản trị hiện có để tìm ID; chỉ hỗ trợ bản ghi nằm trong tập dữ liệu API này trả về, vì service hiện chưa có endpoint đọc riêng một bài cho admin.

## Kết quả xác minh ngày 04/11/2026

- `npm run lint`: đạt (TypeScript `tsc --noEmit`).
- Lệnh test trên: 33 test của Node đạt, gồm 25 test routing, 7 test ví và suite chat cũ chứa 12 ca tự kiểm tra.
- `npm run build`: đạt cả Vite client và esbuild server.
- Chrome: protected URL chuyển sang login và giữ ID/query trong redirect; `/register` mở đúng form; đổi tab đăng nhập cập nhật `/login`; `/products` và `/unauthorized` mở đúng; link orders cũ được xử lý; Back/Forward và reload giữ đúng trang.
- Phiên browser kiểm tra không có đăng nhập. Các flow với tài khoản thật từng role, dữ liệu thật và quyền sở hữu tài nguyên cần được kiểm tra theo danh sách ở trên.

Các thay đổi chức năng tập trung ở router và App, các hook URL cho Admin/Staff/Center/Inspector, chi tiết order/chat, auth/profile/product modal, và đường dẫn thông báo. Các chỉnh sửa nghiệp vụ đang có sẵn trong EscrowOrdersView, InspectorPortalView và ProductInspectionStationView không được hoàn tác.
