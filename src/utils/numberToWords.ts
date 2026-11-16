import type React from 'react';

export function numberToVietnameseWords(num: number): string {
    if (num === null || num === undefined || isNaN(num) || num < 0) return '';
    if (num === 0) return 'Không đồng';
    if (!isFinite(num) || num > 999_999_999_999_999 || num > Number.MAX_SAFE_INTEGER) {
        return 'Số tiền vượt quá giới hạn hiển thị';
    }
    
    const units = [
        '',
        'nghìn',
        'triệu',
        'tỷ',
        'nghìn tỷ',
        'triệu tỷ',
        'tỷ tỷ',
        'nghìn tỷ tỷ',
        'triệu tỷ tỷ',
        'tỷ tỷ tỷ'
    ];
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

    function getUnit(index: number): string {
        if (index < units.length && units[index] !== undefined && units[index] !== null) {
            return units[index];
        }
        const tyCount = Math.floor(index / 3);
        const remainder = index % 3;
        const tyStr = Array(Math.max(1, tyCount)).fill('tỷ').join(' ');
        if (remainder === 0) return tyStr;
        if (remainder === 1) return `nghìn ${tyStr}`;
        return `triệu ${tyStr}`;
    }
    
    function readGroup(group: number, isLast: boolean): string {
        if (isNaN(group) || group < 0) return '';
        const h = Math.floor(group / 100);
        const d = Math.floor((group % 100) / 10);
        const u = group % 10;

        const hWord = (h >= 0 && h <= 9 && digits[h]) ? digits[h] : '';
        const dWord = (d >= 0 && d <= 9 && digits[d]) ? digits[d] : '';
        const uWord = (u >= 0 && u <= 9 && digits[u]) ? digits[u] : '';
        
        let res = '';
        if (h > 0 || !isLast) {
            res += (hWord || 'không') + ' trăm ';
        }
        
        if (d === 0) {
            if (u > 0 && res !== '') {
                res += 'lẻ ';
            }
        } else if (d === 1) {
            res += 'mười ';
        } else {
            res += (dWord || '') + ' mươi ';
        }
        
        if (u === 1 && d > 1) {
            res += 'mốt ';
        } else if (u === 5 && d > 0) {
            res += 'lăm ';
        } else if (u > 0) {
            res += (uWord || '') + ' ';
        }
        
        return res.trim();
    }
    
    let words = '';
    let currentNum = Math.floor(num);
    let unitIndex = 0;
    let firstGroup = true;
    
    while (currentNum > 0 && unitIndex < 20) {
        const group = currentNum % 1000;
        currentNum = Math.floor(currentNum / 1000);
        
        if (group > 0 || (unitIndex === 0 && num === 0)) {
            const groupText = readGroup(group, firstGroup && currentNum === 0);
            if (groupText !== '') {
                const u = getUnit(unitIndex) || '';
                words = groupText + (u ? ' ' + u : '') + ' ' + words;
            }
        }
        firstGroup = false;
        unitIndex++;
    }
    
    words = words.trim().replace(/\s+/g, ' ');
    if (!words) return '';
    
    // An toàn tuyệt đối: Không bao giờ để rò rỉ từ 'undefined'
    words = words.replace(/\bundefined\b/gi, '').replace(/\s+/g, ' ').trim();
    if (!words) return '';

    words = words.charAt(0).toUpperCase() + words.slice(1);
    
    // Replace awkward phrases
    words = words.replace(/^Không trăm lẻ /i, '');
    words = words.replace(/^Không trăm /i, '');
    words = words.replace(/ không trăm$/i, '');
    
    return words + ' đồng';
}

/**
 * Chuẩn hóa chuỗi số tiền VNĐ:
 * - Giữ lại duy nhất các chữ số 0-9
 * - Không ánh xạ các ký tự chữ hoặc dấu thanh (tránh lỗi nhảy số khi gõ bằng bộ gõ tiếng Việt)
 * - Giới hạn số lượng chữ số tối đa (mặc định 12 chữ số)
 */
export function cleanVndInput(value: string | number | null | undefined, maxDigits = 12): string {
    if (value === null || value === undefined) return '';
    const str = value.toString();
    const digits = str.replace(/\D/g, '');
    return maxDigits > 0 ? digits.slice(0, maxDigits) : digits;
}

export function formatVndInput(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const raw = cleanVndInput(value);
    if (!raw) return '';
    const num = Number(raw);
    if (isNaN(num)) return '';
    return num.toLocaleString('vi-VN');
}

/**
 * Xử lý sự kiện onChange trên ô input tiền tệ:
 * - Tự động định dạng dấu phân cách nghìn (.)
 * - Giữ đúng vị trí con trỏ chuột (cursor) không bị nhảy lung tung hoặc nhảy về cuối input
 */
export function handleVndInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
    onValueChange: (numVal: number, rawDigits: string) => void,
    maxDigits = 12
) {
    const input = e.target;
    const value = input.value;
    const selectionStart = input.selectionStart ?? value.length;

    // Đếm số lượng chữ số đứng trước vị trí con trỏ hiện tại
    const digitsBeforeCursor = value.slice(0, selectionStart).replace(/\D/g, '').length;

    // Lọc chỉ lấy chữ số
    const raw = value.replace(/\D/g, '');
    const cleanDigits = maxDigits > 0 ? raw.slice(0, maxDigits) : raw;
    const numVal = cleanDigits ? Number(cleanDigits) : 0;

    onValueChange(numVal, cleanDigits);

    const formatted = numVal > 0 ? numVal.toLocaleString('vi-VN') : '';

    const restoreCursor = () => {
        if (!input) return;
        if (digitsBeforeCursor === 0) {
            input.setSelectionRange(0, 0);
            return;
        }
        let count = 0;
        let newCursor = formatted.length;
        for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
                count++;
            }
            if (count === digitsBeforeCursor) {
                newCursor = i + 1;
                break;
            }
        }
        input.setSelectionRange(newCursor, newCursor);
    };

    requestAnimationFrame(restoreCursor);
    setTimeout(restoreCursor, 0);
}

/**
 * Xử lý sự kiện onKeyDown khi nhấn phím Backspace ngay trước dấu chấm (.) phân cách hàng nghìn.
 * Xóa số trước dấu chấm thay vì chỉ nuốt dấu chấm rồi bị định dạng lại gây đơ/nhảy con trỏ.
 */
export function handleVndInputKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    onValueChange: (numVal: number, rawDigits: string) => void
) {
    if (e.key === 'Backspace') {
        const input = e.currentTarget;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        if (start !== null && start === end && start > 0) {
            // Nếu ký tự ngay trước con trỏ là dấu chấm phân cách '.'
            if (input.value[start - 1] === '.') {
                e.preventDefault();
                const val = input.value;
                const before = val.slice(0, start - 2);
                const after = val.slice(start);
                const raw = (before + after).replace(/\D/g, '');
                const numVal = raw ? Number(raw) : 0;

                onValueChange(numVal, raw);

                const digitsBefore = before.replace(/\D/g, '').length;
                const formatted = numVal > 0 ? numVal.toLocaleString('vi-VN') : '';

                const restoreCursor = () => {
                    if (!input) return;
                    if (digitsBefore === 0) {
                        input.setSelectionRange(0, 0);
                        return;
                    }
                    let count = 0;
                    let newCursor = 0;
                    for (let i = 0; i < formatted.length; i++) {
                        if (/\d/.test(formatted[i])) count++;
                        if (count === digitsBefore) {
                            newCursor = i + 1;
                            break;
                        }
                    }
                    input.setSelectionRange(newCursor, newCursor);
                };

                requestAnimationFrame(restoreCursor);
                setTimeout(restoreCursor, 0);
            }
        }
    }
}
