export interface ParsedQuestionItem {
  id: number;
  rawText: string;
  label: string;
  hint: string;
  examples: string[];
}

/**
 * Phân tích một dòng câu hỏi thành cấu trúc chi tiết:
 * - label: Tên câu hỏi sạch (bỏ Markdown, bullet, ngoặc vuông)
 * - hint: Gợi ý dạng "VD: ..."
 * - examples: Mảng các lựa chọn để làm Quick-reply Chips cho người dùng bấm chọn nhanh
 */
export const parseQuestionItem = (q: string, idx: number): ParsedQuestionItem => {
  const rawClean = (q || '').trim();

  // 1. Tìm phần nằm trong dấu ngoặc đơn (...) cuối dòng hoặc trong câu
  const parenRegex = /\(([^)]+)\)\s*$/;
  const parenMatch = rawClean.match(parenRegex);

  let rawHint = '';
  let labelPart = rawClean;

  if (parenMatch && parenMatch.index !== undefined) {
    rawHint = parenMatch[1].trim();
    labelPart = rawClean.slice(0, parenMatch.index).trim();
  } else {
    // Nếu ngoặc đơn nằm ở giữa dòng và chứa từ khóa ví dụ/gợi ý
    const midParenMatch = rawClean.match(/\(((?:ví\s*dụ|vd|gợi\s*ý)[^)]+)\)/i);
    if (midParenMatch) {
      rawHint = midParenMatch[1].trim();
      labelPart = rawClean.replace(/\(((?:ví\s*dụ|vd|gợi\s*ý)[^)]+)\)/i, '').trim();
    }
  }

  // 2. Làm sạch label:
  // - Bỏ bullet đầu dòng: "-", "*", "•", hoặc số thứ tự "1.", "1)"
  let cleanLabel = labelPart
    .replace(/^[-*•\d\.\)\s]+/, '')
    .trim();

  // - Bỏ tất cả các dấu sao Markdown: *, **
  cleanLabel = cleanLabel.replace(/\*/g, '').trim();

  // - Bỏ ngoặc vuông [ ] nếu Backend trả về format **[Tên câu hỏi]**
  cleanLabel = cleanLabel.replace(/^\[(.*?)\](\??)$/, '$1$2').replace(/^\[([^\]]+)\]\s*/, '$1 ').trim();

  // - Bỏ dấu hai chấm ở cuối nếu có
  cleanLabel = cleanLabel.replace(/[:：]+$/, '').trim();

  // 3. Trích xuất examples & hint:
  const examples: string[] = [];
  let finalHint = '';

  if (rawHint) {
    const hintBody = rawHint
      .replace(/^(?:ví\s*dụ|vd|gợi\s*ý|example)\s*[:：-]?\s*/i, '')
      .replace(/\.{2,}$/, '')
      .trim();

    const tokens = hintBody
      .split(/[,;]/)
      .map(t => t.trim().replace(/^['"]+|['"]+$/g, ''))
      .filter(t => t.length > 0 && t.length < 65);

    if (tokens.length > 0) {
      examples.push(...tokens.slice(0, 6));
      finalHint = `VD: ${tokens.join(', ')}`;
    } else if (hintBody.length > 0) {
      finalHint = `VD: ${hintBody}`;
      examples.push(hintBody);
    }
  }

  // 4. Fallback suy luận gợi ý nếu câu hỏi chưa có ví dụ (hỗ trợ câu hỏi tự do hoặc Admin nhập nhanh)
  if (examples.length === 0) {
    const combined = (cleanLabel + ' ' + rawClean).toLowerCase();

    // Tivi: Kích thước màn hình (inch)
    if (combined.includes('inch') || (combined.includes('tivi') && combined.includes('kích thước')) || combined.includes('màn hình bao nhiêu')) {
      examples.push('32 inch', '43 inch', '50 inch', '55 inch', '65 inch', 'Trên 75 inch');
      finalHint = 'VD: 32 inch, 43 inch, 50 inch, 55 inch, 65 inch';
    }
    // Tivi: Độ phân giải / Smart TV / Tấm nền
    else if (combined.includes('độ phân giải') || combined.includes('smart tv') || combined.includes('4k') || combined.includes('qled') || combined.includes('oled')) {
      examples.push('Full HD thường', 'Smart TV 4K UHD', 'QLED 4K giọng nói', 'OLED cao cấp');
      finalHint = 'VD: Full HD thường, Smart TV 4K UHD, QLED 4K, OLED';
    }
    // Điều hòa / Máy lạnh: Công suất HP / BTU
    else if (combined.includes('hp') || combined.includes('btu') || combined.includes('bao nhiêu ngựa') || combined.includes('công suất làm lạnh')) {
      examples.push('1 HP - 9000 BTU', '1.5 HP - 12000 BTU', '2 HP - 18000 BTU', '2.5 HP - 24000 BTU');
      finalHint = 'VD: 1 HP - 9000 BTU, 1.5 HP - 12000 BTU, 2 HP - 18000 BTU';
    }
    // Điều hòa 1 chiều / 2 chiều
    else if (combined.includes('1 chiều') || combined.includes('2 chiều')) {
      examples.push('1 chiều Inverter tiết kiệm điện', '2 chiều Inverter sưởi ấm', '1 chiều Mono tiêu chuẩn');
      finalHint = 'VD: 1 chiều Inverter, 2 chiều Inverter, 1 chiều Mono';
    }
    // Thời gian mua / tuổi đời
    else if (combined.includes('thời gian') || combined.includes('bao lâu') || combined.includes('mua khi nào') || combined.includes('tuổi đời') || combined.includes('mua sản phẩm')) {
      examples.push('Dưới 1 tháng', '3-6 tháng', 'Khoảng 1 năm', 'Trên 2 năm');
      finalHint = 'VD: Dưới 1 tháng, 3-6 tháng, Khoảng 1 năm, Trên 2 năm';
    }
    // Tần suất sử dụng
    else if (combined.includes('tần suất') || combined.includes('mấy lần') || combined.includes('sử dụng thực tế') || combined.includes('cường độ') || combined.includes('dùng nhiều không')) {
      examples.push('Mới dùng vài lần cất kho', 'Dùng ít 2-3 lần/tuần', 'Dùng hằng ngày ổn định');
      finalHint = 'VD: Mới dùng vài lần cất kho, Dùng ít 2-3 lần/tuần, Dùng hằng ngày';
    }
    // Ngoại quan / Phụ kiện
    else if (combined.includes('ngoại quan') || combined.includes('phụ kiện') || combined.includes('hộp') || combined.includes('trầy xước') || combined.includes('độ mới')) {
      examples.push('Đẹp như mới 98-99% fullbox', 'Trầy xước nhẹ đủ phụ kiện', 'Thiếu hộp đủ phụ kiện chính');
      finalHint = 'VD: Đẹp như mới 98-99% fullbox, Trầy xước nhẹ đủ phụ kiện';
    }
    // Hoạt động / Bảo hành
    else if (combined.includes('hoạt động') || combined.includes('bảo hành') || combined.includes('sửa chữa') || combined.includes('vận hành') || combined.includes('kỹ thuật')) {
      examples.push('Nguyên zin chạy êm còn bảo hành', 'Hoạt động tốt hết bảo hành', 'Đã từng bảo dưỡng/sửa nhẹ');
      finalHint = 'VD: Nguyên zin chạy êm còn bảo hành, Hoạt động tốt hết bảo hành';
    }
    // Khối lượng giặt (kg)
    else if ((combined.includes('giặt') || combined.includes('sấy')) && (combined.includes('khối lượng') || combined.includes('kg'))) {
      examples.push('Dưới 8 kg', '8.5 - 9.5 kg', '10 - 11 kg', 'Trên 12 kg');
      finalHint = 'VD: Dưới 8 kg, 8.5 - 9.5 kg, 10 - 11 kg, Trên 12 kg';
    }
    // Dung tích (lít)
    else if (combined.includes('dung tích') || combined.includes('lít')) {
      examples.push('Dưới 100 lít', '150 - 250 lít', '260 - 400 lít', 'Trên 400 lít');
      finalHint = 'VD: Dưới 100 lít, 150 - 250 lít, 260 - 400 lít, Trên 400 lít';
    }
    // Công suất điện (W)
    else if (combined.includes('công suất') || combined.includes('watt')) {
      examples.push('Dưới 1000W', '1500W - 2000W', 'Trên 2000W', 'Bếp đôi 4000W');
      finalHint = 'VD: Dưới 1000W, 1500W - 2000W, Trên 2000W';
    }
    // Kích thước nội thất
    else if (combined.includes('kích thước') || combined.includes('dài x rộng')) {
      examples.push('1m6 x 2m', '1m8 x 2m', 'Dài 1m2 x Rộng 60cm', 'Cỡ lớn gia đình');
      finalHint = 'VD: 1m6 x 2m, 1m8 x 2m, Dài 1m2 x Rộng 60cm';
    }
    // Chất liệu
    else if (combined.includes('chất liệu')) {
      examples.push('Gỗ tự nhiên', 'Gỗ công nghiệp MDF chống ẩm', 'Bọc da / vải nỉ', 'Khung sắt sơn tĩnh điện');
      finalHint = 'VD: Gỗ tự nhiên, Gỗ MDF chống ẩm, Bọc da / vải nỉ';
    }
    // Loại máy / Kiểu dáng lồng giặt
    else if (combined.includes('loại máy') || combined.includes('kiểu máy') || combined.includes('cửa trước') || combined.includes('cửa trên') || combined.includes('lồng giặt')) {
      examples.push('Cửa trước lồng ngang Inverter', 'Cửa trên lồng đứng Inverter', 'Truyền động trực tiếp');
      finalHint = 'VD: Cửa trước Inverter, Cửa trên Inverter, Truyền động trực tiếp';
    }
    // Hãng / Thương hiệu
    else if (combined.includes('hãng') || combined.includes('thương hiệu') || combined.includes('brand')) {
      examples.push('Panasonic', 'Toshiba', 'LG', 'Samsung', 'Electrolux', 'Sony');
      finalHint = 'VD: Panasonic, Toshiba, LG, Samsung, Electrolux, Sony';
    }
    // Câu hỏi Có / Không
    else if (combined.includes('không') || combined.includes('chưa') || cleanLabel.endsWith('?')) {
      examples.push('Có', 'Không', 'Bình thường');
      finalHint = 'VD: Có, Không';
    }
  }

  if (finalHint && !/^vd:/i.test(finalHint) && !/^ví dụ:/i.test(finalHint)) {
    finalHint = `VD: ${finalHint}`;
  }

  return {
    id: idx,
    rawText: rawClean,
    label: cleanLabel || `Câu hỏi ${idx + 1}`,
    hint: finalHint,
    examples: examples.slice(0, 6),
  };
};

/**
 * Tách các câu hỏi ghép (chứa nhiều câu hỏi con) nếu cần.
 * Không tách nếu câu hỏi đã theo chuẩn template của Backend AI (chứa Markdown ** hoặc có ngoặc ví dụ).
 */
export const splitCompoundQuestion = (q: string): string[] => {
  const qClean = (q || '').trim();
  if (!qClean) return [];

  const exampleMatches = qClean.match(/\((?:ví\s*dụ|vd|gợi\s*ý)/gi);
  if (exampleMatches && exampleMatches.length > 1) {
    const normalized = qClean.replace(/\)\s+(?=[A-ZÀ-Ỹ0-9\*\#])/g, ')\n');
    const splitted = normalized.split('\n').map((s: string) => s.trim()).filter(Boolean);
    if (splitted.length > 1) {
      return splitted;
    }
  }

  if (qClean.includes('**') || /\((?:ví\s*dụ|vd|gợi\s*ý)/i.test(qClean)) {
    return [qClean];
  }

  const qMarkMatches = qClean.match(/\?/g);
  if (qMarkMatches && qMarkMatches.length > 1) {
    const parts = qClean
      .split('?')
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 5);
    if (parts.length > 1) {
      return parts.map((p: string) => (p.endsWith('?') ? p : `${p}?`));
    }
  }

  const lower = qClean.toLowerCase();

  if ((lower.includes('bao lâu') || lower.includes('thời gian')) && (lower.includes('độ mới') || lower.includes('%'))) {
    return [
      'Sản phẩm đã qua sử dụng trong bao lâu (VD: 6 tháng, 1 năm, 2 năm)?',
      'Độ mới thực tế của sản phẩm khoảng bao nhiêu % (VD: 99%, 95%, 90%)?'
    ];
  }

  if (lower.includes('bảo hành') && (lower.includes('hóa đơn') || lower.includes('chứng từ')) && (lower.includes('và') || lower.includes(','))) {
    return [
      'Sản phẩm còn bảo hành chính hãng không (VD: Còn 6 tháng, Hết bảo hành)?',
      'Bạn có còn giữ hóa đơn mua hàng hoặc phiếu bảo hành không (VD: Còn hóa đơn gốc, Không còn)?'
    ];
  }

  if ((lower.includes('hoạt động') || lower.includes('chức năng') || lower.includes('êm')) && (lower.includes('sửa chữa') || lower.includes('thay thế')) && (lower.includes('và') || lower.includes(','))) {
    return [
      'Máy hoạt động có êm không, có bị lỗi chức năng nào không (VD: Hoạt động tốt êm ái, Có lỗi nhẹ)?',
      'Máy đã từng qua sửa chữa hay thay thế linh kiện chưa (VD: Nguyên zin chưa sửa, Đã thay linh kiện)?'
    ];
  }

  if ((lower.includes('khối lượng') || lower.includes('kg')) && (lower.includes('cửa ngang') || lower.includes('cửa trên') || lower.includes('cửa trước')) && (lower.includes('và') || lower.includes(','))) {
    return [
      'Khối lượng giặt của máy là bao nhiêu kg (VD: 8.5kg, 9kg, 10kg)?',
      'Kiểu máy giặt là cửa ngang (cửa trước) hay cửa trên (cửa đứng)?'
    ];
  }

  if (lower.includes('inverter') && (lower.includes('máy nén') || lower.includes('rung lắc') || lower.includes('chạy có êm')) && (lower.includes('và') || lower.includes(','))) {
    return [
      'Thiết bị có trang bị công nghệ Inverter tiết kiệm điện không (VD: Có Inverter, Không)?',
      'Động cơ/máy nén khi vận hành có bị ồn hoặc rung lắc bất thường không (VD: Chạy êm ru, Ồn nhẹ)?'
    ];
  }

  return [qClean];
};

/**
 * Bộ 5-6 câu hỏi chuẩn theo mẫu Backend SecondLife khi chưa có aiInitialMessage hoặc mở bản nháp:
 * - Giữ nguyên đầy đủ chi tiết 3 câu hỏi cốt lõi (tần suất sử dụng, ngoại quan & phụ kiện đặc thù, vận hành & bảo hành)
 * - Bổ sung 2-3 câu hỏi thông số kỹ thuật chuyên biệt theo từng mặt hàng (TV inch/4K, Điều hòa HP, Tủ lạnh lít, Máy giặt kg, Nội thất kích thước/chất liệu...)
 */
export const getStandardProductQuestions = (
  categoryName?: string,
  itemName?: string,
  _brand?: string
): string[] => {
  const combined = `${categoryName || ''} ${itemName || ''}`.toLowerCase();
  const targetLabel = itemName || categoryName || 'sản phẩm';

  const isTv = /tivi|\btv\b|màn hình/i.test(combined);
  const isAc = /máy lạnh|điều hòa/i.test(combined);
  const isFridge = /tủ lạnh|tủ đông|tủ mát/i.test(combined);
  const isWasher = /máy giặt|máy sấy|giặt sấy/i.test(combined);
  const isStove = /bếp từ|bếp điện|bếp hồng ngoại/i.test(combined);
  const isKitchen = /nồi cơm|nồi chiên|lò vi sóng|lò nướng|nồi áp suất|máy rửa bát|máy lọc nước/i.test(combined);
  const isWaterHeater = /bình nóng lạnh|máy nước nóng/i.test(combined);
  const isMattress = /nệm|đệm/i.test(combined);
  const isFurniture = /phòng ngủ|giường|sofa|ghế|bàn|tủ quần áo|kệ|gỗ|nội thất/i.test(combined);

  // PHẦN 1: 3 CÂU HỎI CỐT LÕI VỀ HIỆN TRẠNG & KHẤU HAO
  const q1 =
    '**Tần suất và mức độ sử dụng thực tế của bạn?** (Ví dụ: Mới dùng lướt vài lần cất kho, Dùng gia đình ít 2-3 lần/tuần, Dùng thường xuyên hằng ngày, Chưa từng sử dụng)';

  let q2 =
    `+**Hiện trạng ngoại quan của ${targetLabel} và phụ kiện đi kèm?** (Ví dụ: Đẹp như mới 98-99% fullbox đủ phụ kiện, Ngoại hình đẹp đủ phụ kiện chính, Trầy xước nhẹ không nứt vỡ, Thiếu hộp nhưng đủ phụ kiện)`.slice(1);
  if (isTv) {
    q2 = '**Tình trạng ngoại quan Tivi và phụ kiện đi kèm?** (Ví dụ: Đẹp 98-99% đủ remote giọng nói + chân đế, Kèm giá treo tường + dây nguồn zin, Viền xước nhẹ đủ điều khiển, Fullbox đủ phụ kiện)';
  } else if (isAc) {
    q2 = '**Hiện trạng dàn lạnh, dàn nóng và điều khiển đi kèm?** (Ví dụ: Dàn lạnh trắng đẹp đủ remote zin, Dàn nóng + dàn lạnh sạch đẹp 98%, Vỏ xước nhẹ đủ điều khiển, Full phụ kiện giá đỡ)';
  } else if (isFridge) {
    q2 = '**Hiện trạng vỏ tủ, gioăng cao su và khay kệ bên trong?** (Ví dụ: Đẹp 98% đủ toàn bộ khay kính + hộp đá, Vỏ ngoài xước nhẹ không móp méo, Gioăng kín khít đủ khay kệ, Nguyên bản sạch sẽ)';
  } else if (isWasher) {
    q2 = '**Hiện trạng vỏ máy, lồng giặt và dây cấp/ống xả đi kèm?** (Ví dụ: Vỏ đẹp không rỉ sét đủ dây cấp + ống xả, Lồng inox sáng sạch đẹp 98%, Trầy nhẹ bên hông đủ phụ kiện, Như mới full phụ kiện)';
  } else if (isMattress) {
    q2 = '**Hiện trạng bề mặt nệm và áo bọc đi kèm?** (Ví dụ: Đẹp như mới không vết ố, Áo nệm nguyên vẹn sạch thơm, Có vết ố nhẹ đã vệ sinh sạch, Viền nệm thẳng chắc chắn)';
  } else if (isFurniture) {
    q2 = `**Hiện trạng bề mặt của ${targetLabel} và phụ kiện đi kèm?** (Ví dụ: Bề mặt đẹp 95-99% không trầy rách, Đầy đủ đệm lót/gối tựa/ốc vít, Có vết xước nhẹ không ảnh hưởng thẩm mỹ, Còn rất mới sạch sẽ)`;
  }

  let q3 =
    '**Tình trạng vận hành kỹ thuật, lịch sử sửa chữa và bảo hành?** (Ví dụ: Nguyên zin 100% chạy êm chưa sửa chữa, Hoạt động hoàn hảo còn bảo hành hãng, Vận hành ổn định hết bảo hành, Đã bảo dưỡng định kỳ)';
  if (isMattress) {
    q3 = '**Độ đàn hồi thực tế, tình trạng xẹp lún và bảo hành?** (Ví dụ: Đàn hồi cực tốt không xẹp lún, Êm ái không tiếng kêu còn bảo hành hãng, Nguyên bản sử dụng tốt hết bảo hành, Lún nhẹ không đáng kể)';
  } else if (isFurniture) {
    q3 = '**Độ chắc chắn kết cấu, tình trạng mối mọt và bản lề/khớp nối?** (Ví dụ: Kết cấu nguyên bản vững chắc không mối mọt, Không lung lay bản lề/ray trượt êm, Nguyên zin chưa qua sửa chữa, Đã gia cố nhẹ chắc chắn)';
  }

  // PHẦN 2: 2-3 CÂU HỎI CHUYÊN BIỆT VỀ THÔNG SỐ KỸ THUẬT THEO MẶT HÀNG
  if (isTv) {
    return [
      q1,
      q2,
      q3,
      '**Kích thước màn hình Tivi là bao nhiêu inch?** (Ví dụ: 32 inch, 43 inch, 50 inch, 55 inch, 65 inch, Trên 75 inch)',
      '**Độ phân giải màn hình và hệ điều hành Smart TV?** (Ví dụ: Full HD thường, Smart TV 4K UHD, QLED / MiniLED 4K, OLED cao cấp tìm kiếm giọng nói)',
      '**Chất lượng tấm nền hiển thị và loa âm thanh hiện tại?** (Ví dụ: Màn sáng đẹp không điểm chết, Không kẻ sọc không ám màu, Loa to rõ không rè, Có đốm sáng nhẹ ở góc)'
    ];
  }

  if (isAc) {
    return [
      q1,
      q2,
      q3,
      '**Công suất làm lạnh của máy là bao nhiêu HP (Ngựa / BTU)?** (Ví dụ: 1 HP - 9000 BTU, 1.5 HP - 12000 BTU, 2 HP - 18000 BTU, 2.5 HP - 24000 BTU)',
      '**Loại điều hòa 1 chiều hay 2 chiều và công nghệ tiết kiệm điện?** (Ví dụ: 1 chiều Inverter tiết kiệm điện, 2 chiều Inverter sưởi ấm, 1 chiều Mono tiêu chuẩn, Dòng cao cấp lọc khí khử mùi)'
    ];
  }

  if (isFridge) {
    return [
      q1,
      q2,
      q3,
      '**Dung tích sử dụng của tủ khoảng bao nhiêu lít?** (Ví dụ: Mini dưới 100 lít, 150 - 250 lít, 260 - 400 lít, Trên 400 lít cỡ lớn)',
      '**Kiểu thiết kế cánh tủ và công nghệ Inverter?** (Ví dụ: 2 cánh ngăn đá trên Inverter, 2 cánh ngăn đá dưới Inverter, Side by Side / 4 cánh, Tủ tiêu chuẩn không Inverter)'
    ];
  }

  if (isWasher) {
    return [
      q1,
      q2,
      q3,
      '**Khối lượng giặt / sấy tối đa là bao nhiêu kg?** (Ví dụ: Dưới 8 kg, 8.5 - 9.5 kg, 10 - 11 kg, Trên 12 kg hoặc giặt sấy kết hợp)',
      '**Thiết kế cửa lồng giặt và công nghệ truyền động?** (Ví dụ: Cửa trước lồng ngang Inverter, Cửa trên lồng đứng Inverter, Truyền động trực tiếp êm ái, Cửa trên thông thường)'
    ];
  }

  if (isStove) {
    return [
      q1,
      q2,
      q3,
      '**Số vùng nấu và tổng công suất của bếp là bao nhiêu?** (Ví dụ: Bếp đơn 2000W, Bếp đôi 4000W lắp âm/dương, Bếp từ kết hợp hồng ngoại, Bếp 3 vùng nấu)',
      '**Chất liệu mặt kính và bảng điều khiển cảm ứng?** (Ví dụ: Kính Ceramic/Schott Ceran nguyên vẹn, Cảm ứng trượt nhạy có khóa trẻ em, Phím bấm cảm ứng độc lập, Có hẹn giờ & Inverter)'
    ];
  }

  if (isKitchen) {
    return [
      q1,
      q2,
      q3,
      `**Dung tích và công suất của ${targetLabel} là bao nhiêu?** (Ví dụ: 1.8 lít tiêu chuẩn, 5 - 6 lít gia đình, 8 - 12 lít cỡ lớn, 20 - 30 lít công suất cao)`,
      '**Công nghệ gia nhiệt và bảng điều khiển của máy?** (Ví dụ: Điện tử cảm ứng màn hình LED, Cao tần IH đa chế độ, Núm vặn cơ bền bỉ dễ dùng, Có nướng đối lưu / kính quan sát)'
    ];
  }

  if (isWaterHeater) {
    return [
      q1,
      q2,
      q3,
      '**Loại máy trực tiếp hay gián tiếp và dung tích bình chứa?** (Ví dụ: Gián tiếp 15 lít, Gián tiếp 20 - 30 lít, Trực tiếp có bơm trợ lực, Trực tiếp không bơm)',
      '**Trang bị chống giật ELCB và khả năng giữ nhiệt?** (Ví dụ: Chống giật ELCB an toàn hoạt động tốt, Nước nóng nhanh giữ nhiệt lâu, Bình tráng men không rò rỉ, Đầy đủ vòi sen đi kèm)'
    ];
  }

  if (isMattress) {
    return [
      q1,
      q2,
      q3,
      '**Kích thước khổ nệm (Rộng x Dài) và độ dày bao nhiêu cm?** (Ví dụ: 1m6 x 2m dày 10cm, 1m8 x 2m dày 15cm, 1m2 x 2m dày 9cm, 2m x 2m2 dày 20cm)',
      '**Chất liệu ruột nệm và thiết kế gấp hay nguyên tấm?** (Ví dụ: Cao su thiên nhiên nguyên tấm, Lò xo túi độc lập êm ái, Bông ép gấp 3 gọn nhẹ, Foam hoạt tính thoáng khí)'
    ];
  }

  if (isFurniture) {
    return [
      q1,
      q2,
      q3,
      `**Kích thước thực tế (Dài x Rộng x Cao) của ${targetLabel} là bao nhiêu?** (Ví dụ: 1m6 x 2m, 1m8 x 2m, Dài 1m2 x Rộng 60cm, Sofa văng 2m / góc chữ L 2m4)`,
      `**Chất liệu chính và kết cấu khung của ${targetLabel}?** (Ví dụ: Gỗ tự nhiên sồi/xoan đào, Gỗ công nghiệp MDF lõi xanh chống ẩm, Bọc da công nghiệp / vải nỉ cao cấp, Khung sắt sơn tĩnh điện)`
    ];
  }

  return [
    q1,
    q2,
    q3,
    `**Thông số kích thước, dung tích hoặc công suất chính của ${targetLabel}?** (Ví dụ: Cỡ nhỏ mini tiết kiệm diện tích, Cỡ vừa tiêu chuẩn gia đình, Dung tích/công suất lớn, Phiên bản cao cấp)`,
    `**Phiên bản công nghệ hoặc tính năng nổi bật của ${targetLabel}?** (Ví dụ: Có Inverter tiết kiệm điện, Điều khiển điện tử thông minh, Cơ bản dễ sử dụng bền bỉ, Đầy đủ chế độ an toàn)`
  ];
};
