import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { Language } from '../../types';

interface VietQrBank {
  id: number;
  name: string;
  shortName: string;
  code: string;
  logo: string;
}

interface VietQrBankPickerProps {
  value: string;
  onChange: (name: string) => void;
  lang: Language;
}

const normalizeBankName = (name: string) => name
  .toLowerCase()
  .normalize('NFD')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]/g, '');

export function VietQrBankPicker({ value, onChange, lang }: VietQrBankPickerProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [banks, setBanks] = useState<VietQrBank[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadBanks() {
      try {
        const response = await fetch('https://api.vietqr.io/v2/banks', {
          signal: controller.signal,
          credentials: 'omit',
        });
        if (!response.ok) throw new Error('VietQR request failed');

        const { code, data } = await response.json();
        if (code !== '00' || !Array.isArray(data)) {
          throw new Error('Invalid VietQR bank list');
        }
        const bankList = data.filter((bank): bank is VietQrBank =>
          typeof bank?.id === 'number' && typeof bank.name === 'string' && Boolean(bank.name.trim()) &&
          typeof bank.shortName === 'string' && typeof bank.code === 'string' && typeof bank.logo === 'string'
        );
        if (!bankList.length) throw new Error('Empty VietQR bank list');

        if (controller.signal.aborted) return;
        setBanks(bankList);
        setLoadState('ready');
      } catch {
        if (!controller.signal.aborted) setLoadState('error');
      }
    }

    void loadBanks();
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (isOpen && loadState !== 'loading') searchRef.current?.focus();
  }, [isOpen, loadState]);

  const normalizedValue = normalizeBankName(value);
  const selectedBank = banks.find((bank) =>
    [bank.name, bank.shortName, bank.code].some((name) => normalizeBankName(name) === normalizedValue)
  );
  const normalizedQuery = normalizeBankName(query);
  const visibleBanks = isOpen && loadState === 'ready' ? banks.filter((bank) =>
    [bank.name, bank.shortName, bank.code].some((name) => normalizeBankName(name).includes(normalizedQuery))
  ) : [];

  const chooseBank = (name: string) => {
    onChange(name);
    triggerRef.current?.focus();
    setIsOpen(false);
  };

  return (
    <div onKeyDown={(event) => {
      if (event.key === 'Escape' && isOpen) {
        event.stopPropagation();
        triggerRef.current?.focus();
        setIsOpen(false);
      }
    }}>
      <label id={`${id}-label`} htmlFor={`${id}-trigger`} className="mb-1 block text-[10px] font-bold text-slate-600">
        {lang === 'vi' ? 'Ngân hàng' : 'Bank'}
      </label>
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={isOpen}
        aria-controls={`${id}-banks`}
        onClick={() => {
          setIsOpen(!isOpen);
          setQuery('');
        }}
        className="flex min-h-9 w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-xs text-slate-800 focus-visible:border-[#c34c36] focus-visible:outline-none cursor-pointer"
      >
        {selectedBank?.logo && (
          <img key={selectedBank.id} src={selectedBank.logo} alt="" referrerPolicy="no-referrer" className="h-5 w-12 shrink-0 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} />
        )}
        <span id={`${id}-value`} className="min-w-0 flex-1 break-words">
          {selectedBank?.name || value || (lang === 'vi' ? 'Chọn ngân hàng' : 'Select a bank')}
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
      </button>

      <div id={`${id}-banks`} hidden={!isOpen} className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loadState === 'loading' && (
          <p role="status" className="p-3 text-xs text-slate-600">
            {lang === 'vi' ? 'Đang tải danh sách ngân hàng…' : 'Loading banks…'}
          </p>
        )}
        {loadState === 'error' && (
          <div className="space-y-2 p-3">
            <p role="status" className="text-xs text-slate-600">
              {lang === 'vi' ? 'Không tải được danh sách VietQR. Bạn có thể nhập tên ngân hàng hoặc thử lại.' : 'Could not load the VietQR list. Enter a bank name or retry.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={searchRef}
                type="text"
                aria-label={lang === 'vi' ? 'Nhập tên ngân hàng' : 'Enter bank name'}
                placeholder={lang === 'vi' ? 'Nhập tên ngân hàng' : 'Enter bank name'}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#c34c36]"
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  triggerRef.current?.focus();
                  setLoadState('loading');
                  setAttempt((previous) => previous + 1);
                }}
                className="rounded-lg px-2 py-1 text-xs font-bold text-[#a93826] hover:bg-rose-50 cursor-pointer"
              >
                {lang === 'vi' ? 'Thử lại' : 'Retry'}
              </button>
            </div>
          </div>
        )}
        {loadState === 'ready' && isOpen && (
          <>
            <div className="m-2 flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 focus-within:border-[#c34c36]">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                ref={searchRef}
                type="search"
                aria-label={lang === 'vi' ? 'Tìm ngân hàng' : 'Search banks'}
                placeholder={lang === 'vi' ? 'Tìm theo tên hoặc mã ngân hàng' : 'Search by bank name or code'}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  if (visibleBanks.length === 1) chooseBank(visibleBanks[0].name);
                }}
                className="min-w-0 flex-1 py-2 text-xs outline-none"
              />
              {value && (
                <button type="button" onClick={() => chooseBank('')} className="text-xs font-bold text-slate-600 hover:text-[#a93826] cursor-pointer">
                  {lang === 'vi' ? 'Bỏ chọn' : 'Clear selection'}
                </button>
              )}
            </div>
            {visibleBanks.length === 0 ? (
              <p role="status" className="px-3 pb-3 text-xs text-slate-600">
                {lang === 'vi' ? 'Không tìm thấy ngân hàng phù hợp.' : 'No matching banks.'}
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto overscroll-contain border-t border-slate-100">
                {visibleBanks.map((bank) => (
                  <li key={bank.id}>
                    <button
                      type="button"
                      aria-current={bank.id === selectedBank?.id ? 'true' : undefined}
                      onClick={() => chooseBank(bank.name)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none aria-[current=true]:bg-rose-50 cursor-pointer"
                    >
                      {bank.logo && (
                        <img src={bank.logo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-6 w-12 shrink-0 object-contain" onError={(event) => { event.currentTarget.hidden = true; }} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-800">{bank.shortName}</span>
                        <span className="block text-[11px] text-slate-600">{bank.name}</span>
                      </span>
                      {bank.id === selectedBank?.id && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#a93826]" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
