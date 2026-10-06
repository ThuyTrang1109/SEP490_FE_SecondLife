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

export function formatVndInput(value: string): string {
    const raw = value.replace(/\D/g, '');
    if (!raw) return '';
    return Number(raw).toLocaleString('vi-VN');
}
