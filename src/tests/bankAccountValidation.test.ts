import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeBankAccountHolder,
  sanitizeBankAccountNumber,
  validateBankAccountFields,
} from '../utils/bankAccountValidation.ts';

test('sanitizeBankAccountNumber strips letters and special characters and caps at 16 digits', () => {
  assert.equal(sanitizeBankAccountNumber('12a3-45@67 89b0123456789'), '1234567890123456');
  assert.equal(sanitizeBankAccountNumber('abc!@#'), '');
});

test('sanitizeBankAccountHolder removes accents, uppercases, and strips digits/special chars', () => {
  assert.equal(
    sanitizeBankAccountHolder('Nguyễn Hiếu Tuấn (K18) 123!@#'),
    'NGUYEN HIEU TUAN K '
  );
  assert.equal(sanitizeBankAccountHolder('đặng văn lâm'), 'DANG VAN LAM');
});

test('validateBankAccountFields enforces 8-16 digits for account number', () => {
  assert.ok(
    validateBankAccountFields({
      bankName: 'Vietcombank',
      accountNumber: '1234567',
      accountHolder: 'NGUYEN HIEU TUAN',
    })
  );
  assert.ok(
    validateBankAccountFields({
      bankName: 'Vietcombank',
      accountNumber: '12345678901234567',
      accountHolder: 'NGUYEN HIEU TUAN',
    })
  );
  assert.equal(
    validateBankAccountFields({
      bankName: 'Vietcombank',
      accountNumber: '12345678',
      accountHolder: 'NGUYEN HIEU TUAN',
    }),
    null
  );
  assert.equal(
    validateBankAccountFields({
      bankName: 'Vietcombank',
      accountNumber: '1234567890123456',
      accountHolder: 'NGUYEN HIEU TUAN',
    }),
    null
  );
});

test('validateBankAccountFields rejects accented or special characters in account holder', () => {
  assert.ok(
    validateBankAccountFields({
      bankName: 'ACB',
      accountNumber: '12345678',
      accountHolder: 'NGUYỄN VĂN A',
    })
  );
  assert.ok(
    validateBankAccountFields({
      bankName: 'ACB',
      accountNumber: '12345678',
      accountHolder: 'NGUYEN VAN A@1',
    })
  );
  assert.equal(
    validateBankAccountFields({
      bankName: '',
      accountNumber: '',
      accountHolder: '',
    }),
    null
  );
});
