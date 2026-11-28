import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Search } from 'lucide-react';
import { withdrawalBanks } from '../../services/withdrawalBanks';

interface BankSearchSelectProps {
  value: string;
  onChange: (bankCode: string) => void;
  manualBankName?: string;
  onManualBankNameChange?: (name: string) => void;
  disabled?: boolean;
}

export const BankSearchSelect: React.FC<BankSearchSelectProps> = ({
  value,
  onChange,
  manualBankName = '',
  onManualBankNameChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedBank = useMemo(
    () => withdrawalBanks.find((b) => b.code === value || b.bin === value),
    [value],
  );

  const filteredBanks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return withdrawalBanks;
    return withdrawalBanks.filter((b) =>
      [b.name, b.code, b.bin].some((field) => field.toLowerCase().includes(q)),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 20);
    const handleOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="w-full px-3 py-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 text-left text-xs font-bold text-slate-900 flex items-center justify-between gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">
            {value === 'MANUAL'
              ? manualBankName
                ? `Ngân hàng khác: ${manualBankName}`
                : 'Ngân hàng khác (chuyển thủ công)'
              : selectedBank
                ? `${selectedBank.name} (${selectedBank.code} · BIN ${selectedBank.bin})`
                : 'Chọn ngân hàng nhận tiền'}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-1.5 z-[180] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (filteredBanks.length > 0) {
                      onChange(filteredBanks[0].code);
                      setOpen(false);
                      setQuery('');
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }
                }}
                placeholder="Tìm tên ngân hàng, mã (VCB, TPB...) hoặc BIN..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#24263e]"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
            {filteredBanks.map((bank) => {
              const isSelected = bank.code === value;
              return (
                <button
                  key={bank.code}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(bank.code);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer ${
                    isSelected ? 'bg-emerald-50/70 font-bold text-emerald-900' : 'text-slate-800'
                  }`}
                >
                  <span className="truncate">
                    <strong>{bank.name}</strong>{' '}
                    <span className="text-slate-500 font-mono text-[11px]">
                      ({bank.code} · {bank.bin})
                    </span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange('MANUAL');
                setOpen(false);
                setQuery('');
              }}
              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer ${
                value === 'MANUAL' ? 'bg-emerald-50/70 font-bold text-emerald-900' : 'text-slate-700'
              }`}
            >
              <span>Ngân hàng khác (nhập tên thủ công)</span>
              {value === 'MANUAL' && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
            </button>
          </div>
        </div>
      )}

      {value === 'MANUAL' && onManualBankNameChange && (
        <input
          type="text"
          required
          maxLength={120}
          disabled={disabled}
          value={manualBankName}
          onChange={(e) => onManualBankNameChange(e.target.value)}
          placeholder="Nhập đầy đủ tên ngân hàng nhận tiền..."
          className="mt-2 w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
        />
      )}
    </div>
  );
};
