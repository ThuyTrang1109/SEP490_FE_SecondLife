import type { ReactNode } from 'react';

interface Props {
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  actions: ReactNode;
}

export function OrderDetailModal({ onClose, header, children, actions }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl bg-[#FFFFFF] border border-gray-200 shadow-2xl text-[#24263e] flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-5 space-y-5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {children}
        </div>
        {actions}
      </div>
    </div>
  );
}
