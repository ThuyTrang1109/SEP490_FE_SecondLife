export interface ParsedQuestionItem {
  id: number;
  rawText: string;
  label: string;
  hint: string;
  examples: string[];
}

export const parseQuestionItem = (q: string, idx: number): ParsedQuestionItem => {
  const parenMatch = q.match(/\((.*?)\)/);
  const rawHint = parenMatch ? parenMatch[1].trim() : '';

  let label = parenMatch ? q.split('(')[0].replace(/[:?]/g, '').trim() : q.replace(/[:?]/g, '').trim();
  // Strip Markdown bold asterisks if they exist
  label = label.replace(/\*\*/g, '').trim();

  let finalHint = rawHint;
  const examples: string[] = [];

  // TH 1: Hint đã bắt đầu bằng "VD:" hoặc "Ví dụ:"
  if (rawHint && /^(Ví dụ|VD|ví dụ|vd)[:\s]*/i.test(rawHint)) {
    const cleanHint = rawHint.replace(/^(Ví dụ|VD|ví dụ|vd)[:\s]*/i, '').replace(/\.\.\.$/, '');
    const tokens = cleanHint
      .split(/[,;\/]/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0 && t.length < 35);
    examples.push(...tokens.slice(0, 5));
    finalHint = `VD: ${cleanHint}`;
  } 
  // TH 2: Hint chứa các tùy chọn ngăn cách bởi dấu '/' hoặc ',' (ví dụ "Cửa trước/Cửa trên", "Mới/Đã qua sử dụng", "Có/Không")
  else if (rawHint && (rawHint.includes('/') || rawHint.includes(','))) {
    const tokens = rawHint
      .split(/[/,;]/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0 && t.length < 35);
    if (tokens.length > 0) {
      examples.push(...tokens.slice(0, 5));
      finalHint = `VD: ${tokens.join(', ')}`;
    }
  }

  // TH 3: Nếu vẫn chưa có gợi ý hoặc hint chỉ là đơn vị/từ đơn (như "kg", "Hãng?", "Loại máy", "Tình trạng"), tự động suy luận gợi ý thực tế:
  if (examples.length === 0) {
    const combined = (label + ' ' + rawHint + ' ' + q).toLowerCase();

    // 1. Hãng sản xuất / Thương hiệu / Brand
    if (combined.includes('hãng') || combined.includes('thương hiệu') || combined.includes('brand')) {
      examples.push('Panasonic', 'Toshiba', 'LG', 'Samsung', 'Electrolux', 'Aqua');
      finalHint = 'VD: Panasonic, Toshiba, LG, Samsung, Electrolux';
    }
    // 2. Khối lượng giặt / kg
    else if (combined.includes('giặt') && (combined.includes('khối lượng') || combined.includes('kg') || rawHint.toLowerCase() === 'kg')) {
      examples.push('7kg', '8.5kg', '9kg', '10kg', '12kg');
      finalHint = 'VD: 7kg, 8.5kg, 9kg, 10kg';
    }
    // 3. Khối lượng / Trọng lượng nói chung (kg)
    else if (rawHint.toLowerCase() === 'kg' || combined.includes('khối lượng') || combined.includes('trọng lượng')) {
      examples.push('5kg', '8kg', '10kg', '15kg');
      finalHint = 'VD: 5kg, 8kg, 10kg, 15kg';
    }
    // 4. Dung tích (tủ lạnh, máy nước nóng, nồi chiên...)
    else if (combined.includes('dung tích') || rawHint.toLowerCase() === 'lít' || rawHint.toLowerCase() === 'l') {
      examples.push('180L', '250L', '350L', '500L');
      finalHint = 'VD: 180L, 250L, 350L, 500L';
    }
    // 5. Loại máy / Kiểu dáng (cửa trước, cửa trên, cửa ngang...)
    else if (combined.includes('loại máy') || combined.includes('kiểu máy') || combined.includes('cửa trước') || combined.includes('cửa trên')) {
      examples.push('Cửa trước', 'Cửa trên', 'Cửa ngang');
      finalHint = 'VD: Cửa trước, Cửa trên, Cửa ngang';
    }
    // 6. Tình trạng / Độ mới
    else if (combined.includes('tình trạng') || combined.includes('độ mới') || combined.includes('mới bao nhiêu')) {
      examples.push('Mới 99%', 'Đã qua sử dụng', 'Như mới', 'Còn rất tốt');
      finalHint = 'VD: Mới 99%, Đã qua sử dụng, Như mới';
    }
    // 7. Thời gian sử dụng / Bao lâu
    else if (combined.includes('bao lâu') || combined.includes('thời gian') || combined.includes('dùng bao lâu')) {
      examples.push('6 tháng', '1 năm', '2 năm', 'Hơn 3 năm');
      finalHint = 'VD: 6 tháng, 1 năm, 2 năm';
    }
    // 8. Bảo hành chính hãng
    else if (combined.includes('bảo hành')) {
      examples.push('Còn 6 tháng', 'Hết bảo hành', 'Còn bảo hành hãng');
      finalHint = 'VD: Còn 6 tháng, Hết bảo hành';
    }
    // 9. Hóa đơn / Phụ kiện
    else if (combined.includes('hóa đơn') || combined.includes('chứng từ') || combined.includes('phụ kiện')) {
      examples.push('Còn hóa đơn gốc', 'Đầy đủ phụ kiện', 'Không còn');
      finalHint = 'VD: Còn hóa đơn gốc, Không còn';
    }
    // 10. Hoạt động / Sửa chữa / Lỗi
    else if (combined.includes('sửa chữa') || combined.includes('thay thế') || combined.includes('nguyên bản')) {
      examples.push('Nguyên zin chưa sửa', 'Hoạt động tốt êm ái', 'Đã thay linh kiện');
      finalHint = 'VD: Nguyên zin chưa sửa, Hoạt động tốt';
    }
    // 11. Inverter / Tiết kiệm điện
    else if (combined.includes('inverter') || combined.includes('tiết kiệm điện')) {
      examples.push('Có Inverter', 'Không có Inverter');
      finalHint = 'VD: Có Inverter, Không có Inverter';
    }
    // 12. Câu hỏi Có / Không chung
    else if (combined.includes('không') || combined.includes('chưa') || label.endsWith('?')) {
      examples.push('Có', 'Không', 'Bình thường');
      finalHint = 'VD: Có, Không';
    }
    // 13. Fallback: Nếu có rawHint đơn lẻ
    else if (rawHint) {
      finalHint = rawHint.startsWith('VD:') ? rawHint : `VD: ${rawHint}`;
      examples.push(rawHint);
    }
  }

  // Đảm bảo hint hiển thị thống nhất có tiền tố "VD:"
  if (finalHint && !/^vd:/i.test(finalHint) && !/^ví dụ:/i.test(finalHint)) {
    finalHint = `VD: ${finalHint}`;
  }

  return {
    id: idx,
    rawText: q,
    label: label || `Câu hỏi ${idx + 1}`,
    hint: finalHint,
    examples: examples.slice(0, 5),
  };
};

export const splitCompoundQuestion = (q: string): string[] => {
  const qClean = q.trim();
  if (!qClean) return [];

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

  if (lower.includes('inverter') && (lower.includes('compressor') || lower.includes('máy nén') || lower.includes('rung lắc') || lower.includes('chạy có êm')) && (lower.includes('và') || lower.includes(','))) {
    return [
      'Thiết bị có trang bị công nghệ Inverter tiết kiệm điện không (VD: Có Inverter, Không)?',
      'Động cơ/máy nén khi vận hành có bị ồn hoặc rung lắc bất thường không (VD: Chạy êm ru, Ồn nhẹ)?'
    ];
  }

  if ((lower.includes('gas') || lower.includes('môi chất')) && (lower.includes('độ lạnh') || lower.includes('làm lạnh') || lower.includes('làm mát'))) {
    return [
      'Máy sử dụng loại Gas lạnh nào (VD: Gas R32, Gas R410A)?',
      'Khả năng làm mát/làm lạnh có sâu và nhanh không (VD: Lạnh sâu nhanh, Bình thường)?'
    ];
  }

  if ((lower.includes('công suất') || lower.includes('watt')) && (lower.includes('bảng điều khiển') || lower.includes('cảm ứng'))) {
    return [
      'Công suất nấu tối đa của thiết bị là bao nhiêu Watt (VD: 1200W, 2000W, 4000W)?',
      'Bảng điều khiển và các phím bấm/cảm ứng hoạt động có tốt không (VD: Rất nhạy, Hoạt động tốt)?'
    ];
  }

  return [qClean];
};
