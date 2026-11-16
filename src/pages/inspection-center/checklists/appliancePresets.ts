export interface AppliancePreset {
  key: string;
  name: string;
  categoryKeyword: string;
  icon: string;
  title: string;
  description: string;
  items: {
    itemTitle: string;
    criteriaDescription: string;
    mandatory: boolean;
  }[];
}

export const APPLIANCE_PRESETS: AppliancePreset[] = [
  {
    key: 'refrigerator',
    name: 'Tủ Lạnh / Tủ Đông',
    categoryKeyword: 'Bếp & Phòng ăn',
    icon: '🧊',
    title: 'Tiêu Chuẩn Kiểm Định Tủ Lạnh & Thiết Bị Làm Lạnh Inverter',
    description: 'Quy chuẩn kiểm tra Block máy nén, môi chất lạnh R600a/R134a, độ kín gioăng cửa, bo mạch điều khiển biến tần và xả đá tự động theo tiêu chuẩn SecondLife Hub.',
    items: [
      {
        itemTitle: 'Đo dòng khởi động & kiểm tra Block máy nén (Compressor)',
        criteriaDescription: 'Dùng Ampe kìm đo dòng khởi động không vượt quá 3 lần dòng định mức; máy nén chạy êm, độ ồn < 42dB, không rung giật chân đế.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra nhiệt độ làm lạnh buồng đông (-18°C) và buồng mát (2-5°C)',
        criteriaDescription: 'Dùng nhiệt kế laser hồng ngoại: Buồng đông đạt từ -18°C đến -22°C, buồng mát ổn định 2°C - 5°C sau chu trình làm lạnh ổn định.',
        mandatory: true,
      },
      {
        itemTitle: 'Đo rò rỉ gas lạnh (R600a / R134a) & mối hàn ống đồng',
        criteriaDescription: 'Dùng máy dò gas điện tử kiểm tra dàn nóng, dàn lạnh, phin lọc và rắc-co ống đồng. Áp suất gas tĩnh và động đạt chuẩn.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra gioăng cao su cánh tủ & độ kín khít hít từ',
        criteriaDescription: 'Dùng giấy mỏng kẹp viền cánh tủ; gioăng hít chặt không lọt sáng, không đọng sương hay thoát nhiệt ra ngoài.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra bo mạch điều khiển Inverter & cảm biến xả đá (Defrost)',
        criteriaDescription: 'Bo mạch nhận tín hiệu cảm biến nhiệt NTC, cầu chì nhiệt và điện trở xả đá tự động hoạt động bình thường.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'washing_machine',
    name: 'Máy Giặt / Máy Sấy',
    categoryKeyword: 'Ban công & Giặt giũ',
    icon: '🌀',
    title: 'Tiêu Chuẩn Kiểm Định Máy Giặt & Máy Sấy Đa Năng',
    description: 'Quy chuẩn kiểm tra độ rung lồng giặt ở tốc độ vắt 1400rpm, phao áp lực nước, bơm xả thải, khóa an toàn điện tử và thanh đốt nhiệt.',
    items: [
      {
        itemTitle: 'Kiểm tra động cơ truyền động & phuộc giảm xóc lồng giặt',
        criteriaDescription: 'Chạy vắt thử ở tốc độ tối đa (1000 - 1400 vòng/phút), phuộc giảm xóc triệt tiêu lực tốt, bạc đạn êm, không kêu hú hay rung lắc va chạm vỏ.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra van cấp nước, bơm xả thải & phao áp lực nước',
        criteriaDescription: 'Phao cảm biến mực nước đóng ngắt chính xác các mức; van cấp nước đóng kín khi ngắt điện; bơm xả nước hết trong 90 giây.',
        mandatory: true,
      },
      {
        itemTitle: 'Khóa cửa an toàn điện tử (Door Lock) & gioăng cao su viền',
        criteriaDescription: 'Công tắc khóa cửa chốt chặt khi bắt đầu chu trình và mở an toàn sau 2 phút khi kết thúc; gioăng cao su không rách, không rò nước khi giặt đầy lồng.',
        mandatory: true,
      },
      {
        itemTitle: 'Bo mạch điều khiển chương trình & chống tràn (AquaStop)',
        criteriaDescription: 'Màn hình LED hiển thị rõ ràng, các phím cảm ứng nhạy, chu trình Giặt - Giũ - Vắt vận hành tự động liên tục không báo lỗi.',
        mandatory: true,
      },
      {
        itemTitle: 'Thanh đốt nhiệt làm nóng nước giặt & sấy ngưng tụ',
        criteriaDescription: 'Đo điện trở thanh đun nóng (25 - 35 Ohm), nhiệt độ nước giặt tăng đều theo cài đặt (40°C - 60°C - 90°C), quạt sấy gió nóng hoạt động tốt.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'air_conditioner',
    name: 'Điều Hòa / Máy Lạnh',
    categoryKeyword: 'Phòng ngủ',
    icon: '❄️',
    title: 'Tiêu Chuẩn Kiểm Định Điều Hòa Không Khí Inverter',
    description: 'Đo áp suất gas R32/R410A, dòng làm việc toàn tải, điện trở cách điện Megohmmeter > 2MΩ, quạt lồng sóc và lá tản nhiệt ngoài trời.',
    items: [
      {
        itemTitle: 'Đo áp suất gas hút/đẩy & kiểm tra dòng làm việc máy nén',
        criteriaDescription: 'Đo áp suất gas R32/R410A khi dàn lạnh và dàn nóng chạy toàn tải; dòng Ampe tiêu thụ nằm trong dải thông số nhãn năng lượng.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra quạt dàn lạnh lồng sóc & mô-tơ đảo gió 4 hướng',
        criteriaDescription: 'Cánh quạt lồng sóc cân bằng động tốt, không rít ổ bi, mô-tơ bước đảo gió ngang/dọc phản hồi nhạy theo điều khiển.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra quạt dàn nóng & độ thông thoáng lá tản nhiệt',
        criteriaDescription: 'Cánh quạt dàn nóng quay đúng chiều, lá tản nhiệt nhôm không bị dập nát biến dạng quá 10% bề mặt, giải nhiệt tốt.',
        mandatory: true,
      },
      {
        itemTitle: 'Đo điện trở cách điện Megohmmeter & an toàn tiếp địa',
        criteriaDescription: 'Đo giữa cuộn dây máy nén/mô-tơ với vỏ máy kim loại đạt R > 2 MegaOhm ở điện áp thử 500V. Không có hiện tượng rò điện ra vỏ.',
        mandatory: true,
      },
      {
        itemTitle: 'Mắt nhận hồng ngoại, Remote điều khiển & tính năng Smart Wi-Fi',
        criteriaDescription: 'Nhận tín hiệu điều khiển từ khoảng cách > 5m, các chế độ Cool, Dry, Heat, Fan, Eco hoạt động chính xác.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'induction_cooker',
    name: 'Bếp Từ / Bếp Hồng Ngoại',
    categoryKeyword: 'Bếp & Phòng ăn',
    icon: '🍳',
    title: 'Tiêu Chuẩn Kiểm Định Bếp Từ & Bếp Hồng Ngoại Cảm Ứng',
    description: 'Kiểm tra mâm từ đồng, khối công suất IGBT, quạt tản nhiệt đáy bếp, ngắt bảo vệ quá nhiệt NTC, mặt kính Ceramic chịu nhiệt.',
    items: [
      {
        itemTitle: 'Kiểm tra mâm từ đồng, khối công suất IGBT & bắt từ nhanh',
        criteriaDescription: 'Thử nghiệm với nồi inox chuẩn; bếp nhận diện nồi sau 3 giây, gia nhiệt sôi 1 lít nước trong vòng < 3 phút, IGBT không quá nhiệt.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra quạt tản nhiệt đáy bếp & cảm biến nhiệt độ NTC',
        criteriaDescription: 'Quạt tản nhiệt không chổi than quay êm, cảm biến NTC ngắt bảo vệ quá nhiệt chính xác khi mặt kính đạt ngưỡng 280°C.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra mặt kính Ceramic / Schott Ceran chịu lực & chống trầy',
        criteriaDescription: 'Soi kính dưới đèn quang học: Không nứt vi mô, không mẻ góc cạnh, viền kim loại ôm khít chống nước tràn vào bo mạch.',
        mandatory: true,
      },
      {
        itemTitle: 'Bàn phím cảm ứng trượt Slider & tính năng khóa trẻ em',
        criteriaDescription: 'Cảm ứng nhạy với cả ngón tay ẩm; tính năng tạm dừng (Pause) và khóa an toàn trẻ em (Child Lock) khóa toàn bộ bàn phím hiệu quả.',
        mandatory: true,
      },
      {
        itemTitle: 'Chức năng chống tràn nước & tự động ngắt khi cạn nước',
        criteriaDescription: 'Thử đổ nước lên vùng điều khiển; bếp phát chuông cảnh báo và tự ngắt nguồn trong vòng 5 giây.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'microwave_oven',
    name: 'Lò Vi Sóng / Lò Nướng',
    categoryKeyword: 'Bếp & Phòng ăn',
    icon: '📡',
    title: 'Tiêu Chuẩn Kiểm Định Lò Vi Sóng & Lò Nướng Đối Lưu',
    description: 'Đo rò rỉ bức xạ sóng vi ba Magnetron (< 5mW/cm2), biến áp cao tần, công tắc vi động an toàn cánh cửa, đĩa xoay và thanh nhiệt nướng.',
    items: [
      {
        itemTitle: 'Đèn phát sóng Magnetron & đo rò rỉ bức xạ vi ba an toàn',
        criteriaDescription: 'Dùng máy đo rò bức xạ vi sóng quét quanh khe cửa và vỏ ngoài; mật độ công suất rò < 5 mW/cm² đạt tiêu chuẩn an toàn sinh học quốc gia.',
        mandatory: true,
      },
      {
        itemTitle: 'Biến áp cao tần, tụ điện nhân áp & Diode cao áp',
        criteriaDescription: 'Kiểm tra biến áp không rung rè, tụ cao áp không phồng biến dạng, diode cao áp đo một chiều thông - một chiều ngắt chuẩn.',
        mandatory: true,
      },
      {
        itemTitle: 'Khóa liên động Micro-switch an toàn 3 lớp cánh cửa',
        criteriaDescription: 'Thử mở cửa lò khi đang phát sóng; hệ thống ngắt nguồn Magnetron ngay lập tức 100%, không phát tia lửa điện.',
        mandatory: true,
      },
      {
        itemTitle: 'Mô-tơ đĩa xoay, khoang lò tráng men & đèn chiếu sáng',
        criteriaDescription: 'Đĩa thủy tinh quay đều êm ái, lớp men khoang lò sáng bóng không bong tróc gỉ sét, đèn halogen chiếu sáng rõ nét.',
        mandatory: true,
      },
      {
        itemTitle: 'Thanh nhiệt nướng Grill đối lưu & quạt thổi khí nóng',
        criteriaDescription: 'Thanh nhiệt nướng hồng đều trong 2 phút, quạt đối lưu phân bổ nhiệt đồng đều khắp khoang lò khi nướng.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'rice_cooker',
    name: 'Nồi Cơm Điện / Nồi Áp Suất',
    categoryKeyword: 'Bếp & Phòng ăn',
    icon: '🍚',
    title: 'Tiêu Chuẩn Kiểm Định Nồi Cơm Điện Cao Tần & Nồi Áp Suất',
    description: 'Kiểm tra mâm từ IH / rơ-le nhiệt, lớp chống dính lòng nồi, van xả áp suất an toàn, gioăng cao su nắp và bo mạch vi xử lý.',
    items: [
      {
        itemTitle: 'Lòng nồi hợp kim đa lớp & lớp phủ chống dính Ceramic/Fluororesin',
        criteriaDescription: 'Lòng nồi nguyên vẹn, đáy không móp méo, lớp chống dính không trầy xước sâu hay bong tróc gây hại sức khỏe.',
        mandatory: true,
      },
      {
        itemTitle: 'Mâm từ IH / Mâm nhiệt đáy & cảm biến nhiệt độ trung tâm',
        criteriaDescription: 'Cảm biến đáy nảy đều, tiếp xúc khít với đáy lòng nồi; rơ-le nhiệt ngắt và chuyển sang chế độ Ủ ấm (Keep Warm) đúng thời điểm.',
        mandatory: true,
      },
      {
        itemTitle: 'Van xả áp suất an toàn & gioăng cao su nắp nồi',
        criteriaDescription: 'Van quả trọng xả áp hoạt động tự do không kẹt; van xả phụ an toàn dự phòng; gioăng cao su kín tuyệt đối không xì hơi qua mép nắp.',
        mandatory: true,
      },
      {
        itemTitle: 'Bo mạch vi xử lý chương trình nấu & pin lưu giờ CMOS',
        criteriaDescription: 'Màn hình LCD hiển thị đồng hồ chuẩn, các chế độ nấu cơm dẻo, nấu cháo, làm bánh phản hồi chính xác.',
        mandatory: true,
      },
      {
        itemTitle: 'Dây nguồn rút tự động hoặc giắc cắm chịu nhiệt',
        criteriaDescription: 'Dây nguồn ruột đồng tiêu chuẩn > 1.5mm², giắc cắm chặt không lỏng lẻo phát sinh hồ quang nhiệt.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'water_heater',
    name: 'Bình Nước Nóng / Gia Dụng Tắm',
    categoryKeyword: 'Phòng tắm & Vệ sinh',
    icon: '🚿',
    title: 'Tiêu Chuẩn Kiểm Định Bình Nóng Lạnh & Thiết Bị Gia Dụng Phòng Tắm',
    description: 'Kiểm tra bộ chống giật ELCB, rơ-le nhiệt kép chống đun khô, thanh anode magie chống bám cặn, áp lực bình chứa và tiếp địa.',
    items: [
      {
        itemTitle: 'Thiết bị chống giật siêu nhạy ELCB / RCBO (15mA)',
        criteriaDescription: 'Nhấn nút Test trên cục ELCB: ngắt điện ngay lập tức trong 0.05 giây; đèn báo nguồn tắt hoàn toàn, đảm bảo ngắt 2 cực L và N.',
        mandatory: true,
      },
      {
        itemTitle: 'Đo điện trở cách điện thanh gia nhiệt ruột bình (Megohm)',
        criteriaDescription: 'Đo giữa cọc điện thanh gia nhiệt và vỏ bình bằng Megohmmeter 500V đạt R > 5 MegaOhm khi ngâm nước đầy bình.',
        mandatory: true,
      },
      {
        itemTitle: 'Rơ-le nhiệt kép an toàn 2 cấp (Thermostat & Cắt nhiệt)',
        criteriaDescription: 'Rơ-le cấp 1 ngắt ở 75°C tự động; rơ-le an toàn cấp 2 cắt vĩnh viễn ở 93°C chống cháy nổ khi cạn nước.',
        mandatory: true,
      },
      {
        itemTitle: 'Van một chiều xả áp an toàn (Safety Relief Valve)',
        criteriaDescription: 'Van tự động xả áp khi áp suất bình vượt quá 8 bar, gioăng ren không rò rỉ nước ở áp lực thử 10 bar.',
        mandatory: true,
      },
      {
        itemTitle: 'Thanh Anode Magie bảo vệ ruột bình tráng men',
        criteriaDescription: 'Thanh Magie còn nguyên trên 60% thể tích, ruột bình tráng men Titanium/Kim cương nhân tạo không thủng rò nước.',
        mandatory: false,
      },
    ],
  },
  {
    key: 'general',
    name: 'Gia Dụng Tiêu Chuẩn Chung',
    categoryKeyword: 'Tất cả danh mục',
    icon: '⚡',
    title: 'Bộ Tiêu Chuẩn An Toàn & Vận Hành Gia Dụng Tổng Quát (ISO/TCVN)',
    description: 'Tiêu chuẩn đo kiểm cách điện vỏ máy Megohm, an toàn tiếp địa, kiểm tra ngoại quan ốc vít cơ khí và thử tải vận hành 30 phút.',
    items: [
      {
        itemTitle: 'Đo điện trở cách điện & kiểm tra chống rò rỉ điện vỏ kim loại',
        criteriaDescription: 'Đo cách điện vỏ máy đạt R > 2MΩ ở điện áp 500VDC; dây tiếp địa an toàn không đứt gãy, chống giật tối ưu.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra tình trạng ngoại quan, tem niêm phong & ốc vít cơ khí',
        criteriaDescription: 'Khung vỏ máy cứng cáp không nứt vỡ; ốc vít đầy đủ không trờn ren; tem thông số kỹ thuật rõ ràng nguồn gốc.',
        mandatory: true,
      },
      {
        itemTitle: 'Vận hành đầy tải liên tục 30 phút kiểm tra độ ổn định',
        criteriaDescription: 'Thiết bị hoạt động êm ái liên tục; độ rung và tiếng ồn nằm trong giới hạn cho phép; không có mùi khét lạ từ cuộn dây.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra dây cáp nguồn, phích cắm & công tắc chính',
        criteriaDescription: 'Dây dẫn điện không gập gãy bong tróc lớp vỏ cách nhiệt; phích cắm đúc liền khối chịu tải định mức.',
        mandatory: true,
      },
      {
        itemTitle: 'Kiểm tra linh kiện phụ trợ & phụ kiện đóng gói',
        criteriaDescription: 'Đầy đủ các khay chứa, phụ kiện tháo rời và khớp nối nguyên vẹn theo chuẩn thiết kế của nhà sản xuất.',
        mandatory: false,
      },
    ],
  },
];
