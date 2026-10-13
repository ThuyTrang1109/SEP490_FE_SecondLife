export function numberToVietnameseWords(num: number): string {
    if (num === 0) return 'Không đồng';
    
    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    
    function readGroup(group: number, isLast: boolean): string {
        const h = Math.floor(group / 100);
        const d = Math.floor((group % 100) / 10);
        const u = group % 10;
        
        let res = '';
        if (h > 0 || !isLast) {
            res += digits[h] + ' trăm ';
        }
        
        if (d === 0) {
            if (u > 0 && res !== '') {
                res += 'lẻ ';
            }
        } else if (d === 1) {
            res += 'mười ';
        } else {
            res += digits[d] + ' mươi ';
        }
        
        if (u === 1 && d > 1) {
            res += 'mốt ';
        } else if (u === 5 && d > 0) {
            res += 'lăm ';
        } else if (u > 0) {
            res += digits[u] + ' ';
        }
        
        return res.trim();
    }
    
    let words = '';
    let currentNum = num;
    let unitIndex = 0;
    let firstGroup = true;
    
    while (currentNum > 0) {
        const group = currentNum % 1000;
        currentNum = Math.floor(currentNum / 1000);
        
        if (group > 0 || unitIndex === 0 && num === 0) {
            const groupText = readGroup(group, firstGroup && currentNum === 0);
            if (groupText !== '') {
                words = groupText + ' ' + units[unitIndex] + ' ' + words;
            }
        }
        firstGroup = false;
        unitIndex++;
    }
    
    words = words.trim().replace(/\s+/g, ' ');
    words = words.charAt(0).toUpperCase() + words.slice(1);
    
    // Replace awkward phrases
    words = words.replace(/^Không trăm lẻ /i, '');
    words = words.replace(/^Không trăm /i, '');
    words = words.replace(/ không trăm$/i, '');
    
    return words + ' đồng';
}

/**
 * Làm sạch và chuyển đổi input tiền VNĐ:
 * - Khắc phục lỗi khi máy đang ở chế độ bàn phím tiếng Việt (Windows Vietnamese Keyboard)
 *   khiến hàng phím số 1-0 bị gõ ra ký tự ă, â, ê, ô, đ hoặc dấu thanh
 * - Tự động ánh xạ về các chữ số tương ứng 0-9
 * - Loại bỏ toàn bộ ký tự không phải chữ số
 */
export function cleanVndInput(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    let str = value.toString();

    // Map các ký tự do bàn phím tiếng Việt gõ ra trên hàng phím số
    str = str
        .replace(/[ăĂ]/g, '1')
        .replace(/[âÂ]/g, '2')
        .replace(/[êÊ]/g, '3')
        .replace(/[ôÔ]/g, '4')
        .replace(/[đĐ]/g, '0');

    // Map các dấu thanh có thể xuất hiện khi gõ phím 5, 6, 7, 8, 9
    str = str
        .replace(/[\u0300`]/g, '5')
        .replace(/[\u0309]/g, '6')
        .replace(/[\u0303~]/g, '7')
        .replace(/[\u0301']/g, '8')
        .replace(/[\u0323]/g, '9');

    // Chỉ giữ lại chữ số
    return str.replace(/\D/g, '');
}

export function formatVndInput(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const raw = cleanVndInput(value);
    if (!raw) return '';
    const num = Number(raw);
    if (isNaN(num)) return '';
    return num.toLocaleString('vi-VN');
}
