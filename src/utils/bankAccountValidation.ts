export const BANK_ACCOUNT_NUMBER_MIN_LENGTH = 8;
export const BANK_ACCOUNT_NUMBER_MAX_LENGTH = 16;

const BANK_ACCOUNT_NUMBER_REGEX = /^\d{8,16}$/;
const BANK_ACCOUNT_HOLDER_REGEX = /^[A-Z ]+$/;

/**
 * Strips non-digit characters and caps bank account numbers to 16 digits.
 */
export function sanitizeBankAccountNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, BANK_ACCOUNT_NUMBER_MAX_LENGTH);
}

/**
 * Converts text to unaccented ASCII uppercase letters and spaces only.
 */
export function sanitizeBankAccountHolder(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z ]/g, '');
}

export interface ValidateBankAccountInput {
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  lang?: 'vi' | 'en';
}

/**
 * Validates Escrow payout bank account fields when provided.
 */
export function validateBankAccountFields({
  bankName,
  accountNumber,
  accountHolder,
  lang = 'vi',
}: ValidateBankAccountInput): string | null {
  const cleanBank = (bankName || '').trim();
  const cleanNumber = (accountNumber || '').trim();
  const cleanHolder = (accountHolder || '').trim();
  const hasBankOrNumber = cleanBank.length > 0 || cleanNumber.length > 0;

  if (cleanBank.length > 0 && cleanNumber.length === 0) {
    return lang === 'vi'
      ? `Vui lòng nhập số tài khoản ngân hàng (từ ${BANK_ACCOUNT_NUMBER_MIN_LENGTH} đến ${BANK_ACCOUNT_NUMBER_MAX_LENGTH} chữ số).`
      : `Please enter a bank account number (${BANK_ACCOUNT_NUMBER_MIN_LENGTH}–${BANK_ACCOUNT_NUMBER_MAX_LENGTH} digits).`;
  }

  if (cleanNumber.length > 0 && !BANK_ACCOUNT_NUMBER_REGEX.test(cleanNumber)) {
    return lang === 'vi'
      ? `Số tài khoản ngân hàng không hợp lệ (chỉ nhập số, từ ${BANK_ACCOUNT_NUMBER_MIN_LENGTH} đến ${BANK_ACCOUNT_NUMBER_MAX_LENGTH} số).`
      : `Invalid bank account number (digits only, ${BANK_ACCOUNT_NUMBER_MIN_LENGTH}–${BANK_ACCOUNT_NUMBER_MAX_LENGTH} digits).`;
  }

  if (hasBankOrNumber && cleanHolder.length === 0) {
    return lang === 'vi'
      ? 'Vui lòng nhập tên chủ tài khoản ngân hàng (chữ in hoa không dấu).'
      : 'Please enter the account holder name (unaccented uppercase letters).';
  }

  if (cleanHolder.length > 0 && !BANK_ACCOUNT_HOLDER_REGEX.test(cleanHolder)) {
    return lang === 'vi'
      ? 'Tên chủ tài khoản chỉ được nhập chữ in hoa không dấu và khoảng trắng, không chứa số hoặc ký tự đặc biệt.'
      : 'Account holder name must contain unaccented uppercase letters and spaces only.';
  }

  return null;
}
