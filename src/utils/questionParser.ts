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
  // Ví dụ: "**Thời gian bạn mua sản phẩm?** (Ví dụ: dưới 1 tháng, 3-6 tháng, khoảng 1 năm, trên 2 năm)"
  const parenRegex = /\(([^)]+)\)\s*$/;
  const parenMatch = rawClean.match(parenRegex);

  let rawHint = '';
  let labelPart = rawClean;

  if (parenMatch && parenMatch.index !== undefined) {
    rawHint = parenMatch[1].trim();
    labelPart = rawClean.slice(0, parenMatch.index).trim();
  } else {
    // Nếu ngoặc đơn nằm ở giữa dòng
    const midParenMatch = rawClean.match(/\(([^)]+)\)/);
    if (midParenMatch) {
      rawHint = midParenMatch[1].trim();
      labelPart = rawClean.replace(/\(([^)]+)\)/, '').trim();
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
  cleanLabel = cleanLabel.replace(/^\[(.*?)\]$/, '$1').trim();

  // - Bỏ dấu hai chấm ở cuối nếu có
  cleanLabel = cleanLabel.replace(/[:：]+$/, '').trim();

  // 3. Trích xuất examples & hint:
  const examples: string[] = [];
  let finalHint = '';

  if (rawHint) {
    // Bỏ tiền tố như: "Ví dụ:", "VD:", "Gợi ý:", "vd:", "ví dụ :"
    const hintBody = rawHint
      .replace(/^(?:ví\s*dụ|vd|gợi\s*ý|example)\s*[:：-]?\s*/i, '')
      .replace(/\.{2,}$/, '')
      .trim();

    // Tách các gợi ý bằng dấu phẩy, dấu chấm phẩy hoặc dấu gạch chéo
    const tokens = hintBody
      .split(/[,;]/)
      .map(t => t.trim().replace(/^['"]+|['"]+$/g, ''))
      .filter(t => t.length > 0 && t.length < 50);

    if (tokens.length > 0) {
      examples.push(...tokens.slice(0, 6));
      finalHint = `VD: ${tokens.join(', ')}`;
    } else if (hintBody.length > 0) {
      finalHint = `VD: ${hintBody}`;
      examples.push(hintBody);
    }
  }

  // 4. Fallback suy luận gợi ý nếu câu hỏi chưa có ví dụ (hỗ trợ câu hỏi tự do hoặc mô hình AI cũ)
  if (examples.length === 0) {
    const combined = (cleanLabel + ' ' + rawClean).toLowerCase();

    // Thời gian mua / tuổi đời
    if (combined.includes('thời gian') || combined.includes('bao lâu') || combined.includes('mua khi nào') || combined.includes('tuổi đời') || combined.includes('mua sản phẩm')) {
      examples.push('Dưới 1 tháng', '3-6 tháng', 'Khoảng 1 năm', 'Trên 2 năm');
      finalHint = 'VD: Dưới 1 tháng, 3-6 tháng, Khoảng 1 năm, Trên 2 năm';
    }
    // Tần suất sử dụng
    else if (combined.includes('tần suất') || combined.includes('mấy lần') || combined.includes('sử dụng thực tế') || combined.includes('dùng nhiều không')) {
      examples.push('Mới dùng 1-2 lần cất hộp', 'Thỉnh thoảng dùng', 'Dùng hằng ngày');
      finalHint = 'VD: Mới dùng 1-2 lần cất hộp, Thỉnh thoảng dùng, Dùng hằng ngày';
    }
    // Ngoại quan / Phụ kiện
    else if (combined.includes('ngoại quan') || combined.includes('phụ kiện') || combined.includes('hộp') || combined.includes('trầy xước') || combined.includes('độ mới')) {
      examples.push('Đẹp như mới fullbox', 'Trầy xước nhẹ đủ phụ kiện', 'Có cấn móp, thiếu phụ kiện');
      finalHint = 'VD: Đẹp như mới fullbox, Trầy xước nhẹ đủ phụ kiện, Có cấn móp';
    }
    // Hoạt động / Bảo hành
    else if (combined.includes('hoạt động') || combined.includes('bảo hành') || combined.includes('sửa chữa') || combined.includes('vận hành') || combined.includes('kỹ thuật')) {
      examples.push('Chạy êm còn bảo hành hãng', 'Hoạt động tốt hết bảo hành', 'Đã từng sửa chữa');
      finalHint = 'VD: Chạy êm còn bảo hành hãng, Hoạt động tốt hết bảo hành, Đã từng sửa chữa';
    }
    // Hãng / Thương hiệu
    else if (combined.includes('hãng') || combined.includes('thương hiệu') || combined.includes('brand')) {
      examples.push('Panasonic', 'Toshiba', 'LG', 'Samsung', 'Electrolux', 'Aqua');
      finalHint = 'VD: Panasonic, Toshiba, LG, Samsung, Electrolux';
    }
    // Khối lượng giặt (kg)
    else if (combined.includes('giặt') && (combined.includes('khối lượng') || combined.includes('kg'))) {
      examples.push('7kg', '8.5kg', '9kg', '10kg', '12kg');
      finalHint = 'VD: 7kg, 8.5kg, 9kg, 10kg';
    }
    // Dung tích (lít)
    else if (combined.includes('dung tích') || combined.includes('lít')) {
      examples.push('180L', '250L', '350L', '500L');
      finalHint = 'VD: 180L, 250L, 350L, 500L';
    }
    // Loại máy / Kiểu dáng
    else if (combined.includes('loại máy') || combined.includes('kiểu máy') || combined.includes('cửa trước') || combined.includes('cửa trên')) {
      examples.push('Cửa trước', 'Cửa trên', 'Cửa ngang');
      finalHint = 'VD: Cửa trước, Cửa trên, Cửa ngang';
    }
    // Câu hỏi Có / Không
    else if (combined.includes('không') || combined.includes('chưa') || cleanLabel.endsWith('?')) {
      examples.push('Có', 'Không', 'Bình thường');
      finalHint = 'VD: Có, Không';
    }
  }

  // Đảm bảo finalHint hiển thị thống nhất có tiền tố "VD:"
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

  // Nếu chuỗi chứa nhiều hơn 1 cặp ngoặc ví dụ: câu hỏi đang bị gộp nhiều câu trên 1 dòng
  const exampleMatches = qClean.match(/\((?:ví\s*dụ|vd|gợi\s*ý)/gi);
  if (exampleMatches && exampleMatches.length > 1) {
    // Tách theo ranh giới đóng ngoặc ) theo sau là chữ cái viết hoa hoặc số
    const normalized = qClean.replace(/\)\s+(?=[A-ZÀ-Ỹ0-9\*\#])/g, ')\n');
    const splitted = normalized.split('\n').map((s: string) => s.trim()).filter(Boolean);
    if (splitted.length > 1) {
      return splitted;
    }
  }

  // Nếu câu hỏi đã theo format template Backend chuẩn (chứa ** hoặc chỉ có đúng 1 ngoặc đơn ví dụ), giữ nguyên
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
 * Bộ 4 câu hỏi chuẩn theo mẫu Backend SecondLife khi chưa có aiInitialMessage hoặc mở bản nháp
 */
export const getStandardProductQuestions = (
  categoryName?: string,
  itemName?: string,
  brand?: string
): string[] => {
  const cat = (categoryName || '').toLowerCase();
  const itm = (itemName || '').toLowerCase();
  const isBedOrFurniture = /phòng ngủ|nệm|đệm|giường|sofa|ghế|bàn|tủ|kệ|gỗ/i.test(`${cat} ${itm}`);
  const isMattress = /nệm|đệm/i.test(`${cat} ${itm}`);
  const isWasher = /giặt|sấy/i.test(`${cat} ${itm}`);
  const isFridge = /tủ lạnh|tủ đông|tủ mát/i.test(`${cat} ${itm}`);
  const isCooker = /nồi cơm|nồi chiên|lò vi sóng|lò nướng|bếp/i.test(`${cat} ${itm}`);

  // Câu 1: Tần suất & mức độ sử dụng
  const q1 = '**Tần suất và mức độ sử dụng thực tế của bạn?** (Ví dụ: Mới dùng vài lần cất hộp, Dùng thỉnh thoảng cuối tuần, Dùng thường xuyên hằng ngày, Ít khi sử dụng)';

  // Câu 2: Hiện trạng ngoại quan & phụ kiện
  let q2 = '**Hiện trạng ngoại quan và phụ kiện đi kèm?** (Ví dụ: Đẹp như mới fullbox đủ phụ kiện, Trầy xước nhẹ đủ phụ kiện, Có cấn móp nhẹ, Thiếu phụ kiện)';
  if (isMattress) {
    q2 = '**Hiện trạng ngoại quan và áo bọc nệm đi kèm?** (Ví dụ: Đẹp như mới không vết ố, Áo nệm nguyên vẹn sạch sẽ, Có vết ố nhẹ có thể giặt, Khung viền chắc chắn)';
  } else if (isBedOrFurniture) {
    q2 = '**Hiện trạng bề mặt và kết cấu chịu lực?** (Ví dụ: Bề mặt đẹp không trầy xước, Kết cấu vững chắc không mối mọt, Có trầy xước nhẹ, Tháo lắp dễ dàng)';
  }

  // Câu 3: Kỹ thuật / hoạt động / bảo hành
  let q3 = '**Tình trạng hoạt động kỹ thuật và bảo hành hãng?** (Ví dụ: Vận hành nguyên bản chạy êm, Còn bảo hành chính hãng, Hoạt động tốt hết bảo hành, Chưa từng sửa chữa)';
  if (isMattress) {
    q3 = '**Tình trạng độ đàn hồi và nguồn gốc chất liệu?** (Ví dụ: Đàn hồi cực tốt không xẹp lún, Cao su thiên nhiên 100%, Lò xo túi êm ái không kêu, Còn bảo hành hãng)';
  } else if (isBedOrFurniture) {
    q3 = '**Chất liệu chính và độ bền kết cấu?** (Ví dụ: Gỗ tự nhiên nguyên khối, Khung sắt sơn tĩnh điện, Gỗ MDF chống ẩm, Chắc chắn không lung lay)';
  }

  // Câu 4: Thông số kỹ thuật / kích thước đặc thù
  let q4 = `**Thông số kỹ thuật, kích thước hoặc phiên bản của ${itemName || categoryName || 'sản phẩm'}?** (Ví dụ: Bản tiêu chuẩn chính hãng, Kích thước chuẩn gia đình, Công suất tiết kiệm điện, Đầy đủ tính năng)`;
  if (isMattress) {
    q4 = '**Kích thước, độ dày và loại nệm cụ thể?** (Ví dụ: 1m6 x 2m dày 10cm, 1m8 x 2m dày 15cm lò xo túi, 1m2 x 2m cao su, 1m4 x 2m gấp 3)';
  } else if (isWasher) {
    q4 = '**Khối lượng giặt và kiểu máy giặt?** (Ví dụ: 8.5kg cửa trước Inverter, 9kg cửa ngang, 7.5kg cửa trên lồng đứng, 10kg giặt sấy)';
  } else if (isFridge) {
    q4 = '**Dung tích và kiểu dáng tủ lạnh?** (Ví dụ: 180L - 250L 2 cánh Inverter, Mini 90L, Trên 400L Side-by-side không đóng tuyết, Ngăn đá dưới)';
  } else if (isCooker) {
    q4 = '**Dung tích, công suất hoặc loại bảng điều khiển?** (Ví dụ: 1.8 lít điện tử cao tần, 5.5 lít cơ núm vặn, Bếp đôi âm 4000W, Mặt kính chống trầy)';
  }

  return [q1, q2, q3, q4];
};
