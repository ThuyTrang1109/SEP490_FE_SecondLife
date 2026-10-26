import { translateApiError } from '../services/apiClient';

/**
 * Bảng dịch và chuẩn hóa toàn bộ thông báo, cảnh báo, lỗi và thông điệp hệ thống sang Tiếng Việt.
 */
export function translateSystemNotification(rawMsg: string | null | undefined): string {
  if (!rawMsg) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
  const s = String(rawMsg).trim();
  if (!s) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';

  // 1. Nếu là thông báo lỗi API chuẩn, chạy qua translateApiError trước
  const apiTranslated = translateApiError(s);
  if (apiTranslated !== s) {
    return apiTranslated;
  }

  const lower = s.toLowerCase();

  // 2. Thông báo bài đăng & bản nháp (Listing & Drafts)
  if (lower.includes('draft deleted successfully')) return 'Đã xóa bản nháp thành công!';
  if (lower.includes('please enter draft id')) return 'Vui lòng nhập mã bài đăng nháp!';
  if (lower.includes('draft loaded successfully')) return 'Đã tải lại bản nháp thành công!';
  if (lower.includes('draft not found')) return 'Không tìm thấy bản nháp với mã này.';
  if (lower.includes('generated title suggestion with ai')) return '✨ Đã tạo tiêu đề gợi ý từ AI (-1 credit)!';
  if (lower.includes('insufficient ai chat credits') || lower.includes('out of ai chat credits') || lower.includes('out of ai credits')) {
    return 'Bạn đã hết lượt dùng AI chat. Vui lòng nạp thêm credit để sử dụng tính năng này.';
  }
  if (lower.includes('used template title')) return 'Không thể kết nối AI, đã tạo tiêu đề mẫu từ thông tin sẵn có.';
  if (lower.includes('please answer at least one question before applying')) {
    return 'Vui lòng điền câu trả lời cho ít nhất một câu hỏi trước khi áp dụng.';
  }
  if (lower.includes('please answer at least one question before sending to ai')) {
    return 'Vui lòng điền câu trả lời cho ít nhất một câu hỏi trước khi gửi cho AI.';
  }
  if (lower.includes('no active ai session to regenerate')) return 'Chưa có phiên hội thoại AI để viết lại.';
  if (lower.includes('failed to regenerate with ai')) return 'Không thể viết lại bản nháp bằng AI.';
  if (lower.includes('video must not exceed 100mb')) return 'Video tải lên không được vượt quá 100MB.';
  if (lower.includes('operation video uploaded')) return 'Tải video vận hành thiết bị thành công!';
  if (lower.includes('failed to upload video')) return 'Không thể tải video lên máy chủ.';
  if (lower.includes('price cannot exceed 1 billion')) return 'Giá sản phẩm không được vượt quá 1.000.000.000đ (1 tỷ VNĐ).';
  if (lower.includes('please select a category')) return 'Vui lòng chọn Danh mục sản phẩm.';
  if (lower.includes('please upload at least 1 product image')) return 'Vui lòng tải lên ít nhất 1 ảnh sản phẩm thực tế.';
  if (lower.includes('ai summarized the chat into your description')) return 'AI đã tổng hợp cuộc hội thoại và cập nhật mô tả thành công!';
  if (lower.includes('please enter listing title') || lower.includes('please enter title')) return 'Vui lòng nhập Tiêu đề bài đăng.';
  if (lower.includes('please provide a description') || lower.includes('please enter description')) {
    return 'Vui lòng nhập Mô tả sản phẩm hoặc trò chuyện với AI để hoàn thiện mô tả.';
  }
  if (lower.includes('please enter a valid price') || lower.includes('please enter valid price')) {
    return 'Vui lòng nhập giá bán hợp lệ (tối thiểu 1.000 đ).';
  }
  if (lower.includes('please enter shipping dimensions and weight')) {
    return 'Vui lòng nhập đầy đủ thông tin kích thước và trọng lượng kiện hàng.';
  }
  if (lower.includes('visual review already in description')) return 'Nhận xét ảnh đã có trong phần mô tả rồi.';
  if (lower.includes('inserted visual review into description')) return 'Đã chèn nhận xét ảnh vào ô Mô tả.';
  if (lower.includes('brand updated to')) {
    return s.replace(/brand updated to/i, 'Đã tự động đổi thương hiệu thành');
  }
  if (lower.includes('shipping supports packages up to 50 kg and 200 cm') || lower.includes('up to 50 kg and 200 cm')) {
    return 'Dịch vụ vận chuyển chỉ hỗ trợ kiện hàng tối đa 50 kg và kích thước mỗi chiều không quá 200 cm (2 mét).';
  }
  if (lower.includes('package weight must be') || lower.includes('package weight must be 1–50000')) {
    return 'Trọng lượng kiện hàng phải từ 1 đến 50.000 gram (tối đa 50kg).';
  }
  if (lower.includes('length/width/height must be')) {
    return 'Chiều dài, rộng, cao phải từ 1 đến 200 cm (tối đa 2 mét).';
  }
  if (lower.includes('failed to save shipping package')) {
    const detail = s.replace(/failed to save shipping package:?/i, '').trim();
    return 'Không thể lưu thông tin kiện hàng: ' + (translateApiError(detail) || detail);
  }
  if (lower.includes('an approved seller verification is required before publish')) {
    return 'Tài khoản chưa hoàn tất hồ sơ xác thực người bán (eKYC). Vui lòng xác thực trước khi gửi đăng bài.';
  }
  if (lower.includes('could not publish listing due to insufficient credit')) {
    return 'Chưa thể xuất bản bài đăng do tài khoản không đủ credit.';
  }
  if (lower.includes('listing is pending inspection hub review')) {
    return 'Bài đăng đang chờ Kỹ thuật viên kiểm định chất lượng (PENDING_INSPECTION).';
  }
  if (lower.includes('listing is pending review')) {
    return 'Bài đăng đã được gửi và đang chờ nhân viên kiểm duyệt (PENDING).';
  }
  if (lower.includes('listing was rejected by ai moderation')) {
    return 'Bài đăng đã bị AI từ chối kiểm duyệt. Vui lòng chỉnh sửa lại.';
  }
  if (lower.includes('successfully published')) {
    return 'Đăng bán thành công sản phẩm!';
  }

  // 3. Phân quyền và tài khoản người dùng
  if (lower.includes('admin account only accesses admin portal')) {
    return 'Tài khoản Quản trị viên chỉ có quyền truy cập trang Quản Trị Hệ Thống.';
  }
  if (lower.includes('inspection center account only accesses center management portal')) {
    return 'Tài khoản Trưởng trung tâm kiểm định chỉ truy cập Bàn Điều Phối & Quản Trị.';
  }
  if (lower.includes('inspection account only accesses inspection hub')) {
    return 'Tài khoản Kiểm định viên chỉ truy cập Trung Tâm Kiểm Định.';
  }
  if (lower.includes('please log in to purchase with escrow protection')) {
    return 'Vui lòng đăng nhập để tiến hành mua hàng bảo đảm Escrow và kiểm định Hub.';
  }
  if (lower.includes('you cannot buy your own product')) {
    return 'Bạn không thể tự mua sản phẩm của chính mình.';
  }
  if (lower.includes('please log in to chat with the seller')) {
    return 'Vui lòng đăng nhập để nhắn tin và đàm phán với người bán.';
  }

  // 4. Đơn hàng, thanh toán & Ký quỹ Escrow
  if (lower.includes('order placed successfully')) return 'Đặt hàng thành công! Đang chờ người bán xác nhận.';
  if (lower.includes('order cancelled')) return 'Đơn hàng đã được hủy.';
  if (lower.includes('order confirmed')) return 'Đơn hàng đã được xác nhận thành công.';
  if (lower.includes('payment successful')) return 'Thanh toán thành công! Tiền đã được ký quỹ an toàn vào Escrow.';
  if (lower.includes('payment failed')) return 'Thanh toán thất bại. Vui lòng thử lại.';
  if (lower.includes('funds locked in escrow')) return 'Tiền đã được phong tỏa an toàn trong Quỹ tín thác Escrow.';
  if (lower.includes('funds released from escrow')) return 'Tiền đã được giải ngân thành công cho người bán.';
  if (lower.includes('escrow guarantee') || lower.includes('100% escrow protection')) {
    return 'Bảo lãnh Escrow 100%: Kiểm tra 48h mới giải ngân.';
  }

  // 5. Kiểm định chất lượng & Tem niêm phong
  if (lower.includes('inspection passed')) return 'Sản phẩm đã kiểm định Đạt tiêu chuẩn chất lượng SecondLife.';
  if (lower.includes('inspection failed')) return 'Sản phẩm không đạt chuẩn kiểm định. Đang tiến hành xử lý hoàn trả.';
  if (lower.includes('seal verified')) return 'Tem niêm phong điện tử NFC đã được xác thực thành công.';
  if (lower.includes('seal verification failed')) return 'Xác thực tem niêm phong thất bại. Cảnh báo dấu hiệu tháo dỡ!';

  // 6. Giao vận Lalamove
  if (lower.includes('driver assigned')) return 'Tài xế Lalamove đã nhận đơn và đang di chuyển đến lấy hàng.';
  if (lower.includes('driver picking up')) return 'Tài xế đang nhận hàng từ người gửi.';
  if (lower.includes('out for delivery')) return 'Kiện hàng đang trên đường giao đến bạn.';
  if (lower.includes('delivery completed')) return 'Giao hàng thành công! Vui lòng kiểm tra sản phẩm.';
  if (lower.includes('delivery failed')) return 'Giao hàng thất bại. Đang liên hệ lại với tài xế và khách hàng.';

  // 7. Ví & Rút tiền
  if (lower.includes('deposit successful')) return 'Nạp tiền vào ví thành công!';
  if (lower.includes('withdrawal requested')) return 'Yêu cầu rút tiền đã được gửi. Hệ thống sẽ xử lý trong 24 giờ làm việc.';
  if (lower.includes('withdrawal approved')) return 'Yêu cầu rút tiền đã được phê duyệt thành công.';

  // 8. Khiếu nại (Disputes)
  if (lower.includes('dispute opened') || lower.includes('dispute created')) return 'Đã mở hồ sơ khiếu nại thành công.';
  if (lower.includes('dispute resolved')) return 'Hồ sơ khiếu nại đã được giải quyết.';

  // 9. Lỗi chung & Mã phản hồi
  if (lower.includes('network error') || lower.includes('failed to fetch')) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng.';
  }
  if (lower.includes('internal server error')) {
    return 'Máy chủ gặp sự cố xử lý nội bộ. Vui lòng thử lại sau.';
  }
  if (lower.includes('unauthorized') || lower.includes('session expired')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (lower.includes('access denied') || lower.includes('forbidden')) {
    return 'Bạn không có quyền thực hiện hành động này.';
  }
  if (lower.includes('not found')) {
    return 'Không tìm thấy dữ liệu yêu cầu trên hệ thống.';
  }
  if (lower.includes('bad request')) {
    return 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
  }

  // Nếu chuỗi hoàn toàn là tiếng Anh (không có dấu tiếng Việt) và chưa được dịch ở trên:
  // Thử dịch một số từ vựng phổ biến
  let translated = s;
  const wordPairs: [RegExp, string][] = [
    [/\bError\b/gi, 'Lỗi'],
    [/\bWarning\b/gi, 'Cảnh báo'],
    [/\bNotice\b/gi, 'Thông báo'],
    [/\bSuccess\b/gi, 'Thành công'],
    [/\bFailed\b/gi, 'Thất bại'],
    [/\bSuccessfully\b/gi, 'thành công'],
    [/\bPlease\b/gi, 'Vui lòng'],
    [/\bRequired\b/gi, 'bắt buộc'],
    [/\bInvalid\b/gi, 'không hợp lệ'],
    [/\bNot found\b/gi, 'không tìm thấy'],
    [/\bCannot\b/gi, 'Không thể'],
    [/\bTry again\b/gi, 'thử lại'],
    [/\bLoading\b/gi, 'Đang tải'],
    [/\bConnecting\b/gi, 'Đang kết nối'],
    [/\bConnected\b/gi, 'Đã kết nối'],
    [/\bDisconnected\b/gi, 'Đã ngắt kết nối']
  ];

  for (const [re, rep] of wordPairs) {
    if (re.test(translated)) {
      translated = translated.replace(re, rep);
    }
  }

  return translated;
}
