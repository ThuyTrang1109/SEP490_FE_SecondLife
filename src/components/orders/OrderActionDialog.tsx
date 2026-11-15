import { AlertTriangle, Check, CheckCircle2, Package, Truck } from 'lucide-react';
import type { ConfirmDialogState } from '../../types/orders/orderTypes';

interface Props {
  confirmDialog: ConfirmDialogState;
  orderActionLoading: string | null;
  onClose: () => void;
}

export function OrderActionDialog({ confirmDialog, orderActionLoading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-4 text-[#24263e] animate-scaleUp">
        <div className="flex items-start gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${confirmDialog.variant === 'success'
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            : confirmDialog.variant === 'warning'
              ? 'bg-amber-50 text-amber-600 border border-amber-100'
              : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
            {confirmDialog.iconType === 'truck' ? (
              <Truck className="w-6 h-6 text-blue-600" />
            ) : confirmDialog.iconType === 'package' ? (
              <Package className="w-6 h-6 text-blue-600" />
            ) : confirmDialog.iconType === 'alert' ? (
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-base text-[#24263e]">{confirmDialog.title}</h4>
            <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">{confirmDialog.message}</p>
            {confirmDialog.subMessage && (
              <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 leading-normal">
                {confirmDialog.subMessage}
              </p>
            )}
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
          >
            {confirmDialog.cancelText || 'Hủy'}
          </button>
          <button
            type="button"
            onClick={confirmDialog.onConfirm}
            disabled={!!orderActionLoading}
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${confirmDialog.variant === 'success'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : confirmDialog.variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800'
              }`}
          >
            {orderActionLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{confirmDialog.confirmText || 'Xác Nhận'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
