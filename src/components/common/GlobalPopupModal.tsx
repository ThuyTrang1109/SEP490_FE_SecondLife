import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  X
} from 'lucide-react';
import { dialogService, DialogState } from '../../utils/dialogService';

export const GlobalPopupModal: React.FC = () => {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  useEffect(() => {
    const unsubscribe = dialogService.subscribe((state) => {
      setDialogState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!dialogState?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dialogState]);

  if (!dialogState || !dialogState.isOpen) return null;

  const handleConfirm = () => {
    dialogState.resolve?.(true);
    setDialogState(null);
  };

  const handleCancel = () => {
    dialogState.resolve?.(false);
    setDialogState(null);
  };

  const isConfirmDialog = Boolean(dialogState.cancelText);

  const getIconAndStyle = () => {
    switch (dialogState.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-emerald-600" />,
          ringClass: 'bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50',
          confirmBtnClass: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200/50',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-8 h-8 text-rose-600" />,
          ringClass: 'bg-rose-50 text-rose-600 ring-8 ring-rose-50/50',
          confirmBtnClass: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200/50',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-amber-600" />,
          ringClass: 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/50',
          confirmBtnClass: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200/50',
        };
      case 'confirm':
        return {
          icon: <HelpCircle className="w-8 h-8 text-[#c34c36]" />,
          ringClass: 'bg-orange-50 text-[#c34c36] ring-8 ring-orange-50/50',
          confirmBtnClass: 'bg-gradient-to-r from-[#24263e] to-[#c34c36] hover:opacity-95 shadow-orange-200/50',
        };
      default:
        return {
          icon: <Sparkles className="w-8 h-8 text-[#c34c36]" />,
          ringClass: 'bg-[#fce5da] text-[#c34c36] ring-8 ring-[#fce5da]/50',
          confirmBtnClass: 'bg-gradient-to-r from-[#24263e] to-[#c34c36] hover:opacity-95 shadow-md',
        };
    }
  };

  const { icon, ringClass, confirmBtnClass } = getIconAndStyle();

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200">
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col items-center text-center relative text-[#24263e] transform transition-all scale-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Close X Button in top right */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          title="Đóng popup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon with glowing ring */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4.5 ${ringClass} transition-transform`}>
          {icon}
        </div>

        {/* Title */}
        <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2.5 tracking-tight">
          {dialogState.title}
        </h3>

        {/* Message */}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4 font-medium whitespace-pre-line max-h-60 overflow-y-auto px-1">
          {dialogState.message}
        </p>

        {/* Route Details Box (Từ đâu tới đâu) */}
        {dialogState.routeDetails && (
          <div className="w-full mb-6 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2.5 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <div className="w-3.5 h-3.5 rounded-full bg-blue-600 mt-0.5 shrink-0 ring-4 ring-blue-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  {dialogState.routeDetails.originTitle || 'Điểm lấy hàng (Từ Hub)'}
                </span>
                {dialogState.routeDetails.originName && (
                  <span className="font-bold text-slate-900 block text-xs mt-0.5">
                    {dialogState.routeDetails.originName}
                  </span>
                )}
                <span className="text-slate-600 break-words block text-[11px] leading-relaxed mt-0.5">
                  {dialogState.routeDetails.originAddress}
                </span>
              </div>
            </div>

            <div className="ml-1.5 pl-3.5 border-l-2 border-dashed border-slate-300 py-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <span>Bưu tá Lalamove giao tận tay</span>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 mt-0.5 shrink-0 ring-4 ring-emerald-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  {dialogState.routeDetails.destinationTitle || 'Điểm giao hàng (Đến Người mua)'}
                </span>
                {dialogState.routeDetails.destinationName && (
                  <span className="font-bold text-slate-900 block text-xs mt-0.5">
                    {dialogState.routeDetails.destinationName}
                  </span>
                )}
                <span className="text-slate-600 break-words block text-[11px] leading-relaxed mt-0.5">
                  {dialogState.routeDetails.destinationAddress}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isConfirmDialog ? (
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={handleCancel}
              className="py-3 px-4 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 transition cursor-pointer"
            >
              {dialogState.cancelText || 'Hủy Bỏ'}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className={`py-3 px-4 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer ${confirmBtnClass}`}
            >
              {dialogState.confirmText || 'Xác Nhận'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-3 px-6 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer ${confirmBtnClass}`}
          >
            {dialogState.confirmText || 'Đã Hiểu'}
          </button>
        )}
      </div>
    </div>
  );
};
