# Giảm request trùng trên frontend

Ngày kiểm tra: 05/11/2026.

## Các thay đổi

- `App.tsx` không tải orders/chat cho trung tâm kiểm định; trang trung tâm tự tải đơn của mình. Catalog chỉ được khởi tạo ở các trang cần dữ liệu sản phẩm.
- Tải ví và đơn phụ thuộc vào ID/vai trò thay vì toàn bộ object người dùng. Cập nhật số dư không kích hoạt một lượt tải lại đơn và ví.
- Các lượt tải đơn của App không chạy chồng nhau. Yêu cầu làm mới sau thao tác ghi được giữ lại để thực hiện một lượt sau request đang chạy; phản hồi của tài khoản/vai trò cũ bị bỏ qua.
- `requestGet` gộp các GET giống nhau đang chạy trong cùng phiên, gồm cả lượt effect kiểm tra của StrictMode. Không lưu kết quả đã hoàn tất. Các request có AbortSignal giữ quyền hủy độc lập. Thao tác ghi và đăng xuất vô hiệu hóa các lượt đọc đang được chia sẻ.
- Trang trung tâm chỉ tải orders/staff ở các tab vận hành. Tab Biểu phí và Checklist không tải orders/staff. Đổi trạng thái đơn không tải lại staff; phân công KTV chỉ có một đường làm mới qua sự kiện.
- Bỏ việc gọi thêm 5 API trạng thái khi danh sách đơn trả về rỗng.
- Biểu phí dùng lại lịch sử khi trang đầu trả về toàn bộ dữ liệu. Nếu lịch sử chưa đủ hoặc đang lọc, snapshot đề xuất đang chờ được lấy riêng để giữ đúng trạng thái các thẻ L1–L4.
- Đổi bộ lọc/trang lịch sử chỉ tải lịch sử. Bảng lịch sử dùng đúng trang từ BE, không trộn thêm snapshot pending vào hàng và tổng số bản ghi. Phản hồi lịch sử cũ không ghi đè bộ lọc mới.

## Kiểm tra tự động

```powershell
npm run lint
node --import tsx --test src/tests/*.test.ts
npm run build
git diff --check
```

Kết quả: TypeScript và build thành công; 64 kiểm thử Node đạt, gồm 21 kiểm thử mới về request đồng thời, phân tách phiên đăng nhập, hủy request, đọc lại sau thao tác ghi và tải dữ liệu biểu phí.

## Kiểm tra Chrome với API giả lập

Dùng App thật với React StrictMode, mock API chậm 100 ms, 4 đề xuất và 6 bậc cước. Máy chủ giả lập chạy riêng ở cổng 4174, chặn toàn bộ `/api`, đã dừng sau kiểm tra.

| Thao tác | Request mới quan sát được |
| --- | --- |
| Mở trực tiếp `/inspection-center/pricing` sau tạo phiên thử | `users/me` ×1, `wallets/me` ×1, `travel-tiers` ×1, `level-fees` ×1, lịch sử đề xuất ×1; tổng 5 |
| Lọc lịch sử “Đã duyệt” | Lịch sử đề xuất ×1; thẻ L2 vẫn hiển thị pending và chặn gửi trùng |
| Chuyển sang quản lý đơn, BE trả danh sách rỗng | Orders ×1 và staff ×1; không gọi thêm API dò trạng thái |
| Chuyển sang Checklist | Checklists ×1, categories ×1, items ×1; không tải lại orders/staff |

Đây là xác minh số request và hành vi giao diện. Độ trễ 3–6,5 giây của BE/DB thật cần đo lại bằng tài khoản thực sau khi tải lại FE; số liệu mock không chứng minh thời gian đáp ứng thực tế.
