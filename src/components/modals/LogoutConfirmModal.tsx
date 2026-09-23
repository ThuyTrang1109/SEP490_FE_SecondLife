import React from 'react';
import { LogOut, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Language } from '../../types';
import { soundFx } from '../../utils/soundEffects';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lang?: Language;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  lang = 'vi'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    soundFx.playChime();
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    soundFx.playCancel();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn select-none font-sans"
      onClick={handleCancel}
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all text-[#0E121B]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Warning Strip */}
        <div className="h-2 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-[#EC1577]" />

        {/* Close Button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          title={lang === 'vi' ? 'Đóng' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 text-center space-y-4">
          {/* Animated Icon Circle */}
          <div className="relative inline-block mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-600 shadow-md shadow-rose-500/10">
              <LogOut className="w-7 h-7" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-full shadow-xs">
              <AlertTriangle className="w-3 h-3" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-[#0E121B] tracking-tight">
              {lang === 'vi' ? 'Xác Nhận Đăng Xuất' : 'Confirm Logout'}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              {lang === 'vi'
                ? 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không? Phiên làm việc hiện tại sẽ kết thúc.'
                : 'Are you sure you want to log out of your account on this device? Your current session will end.'}
            </p>
          </div>

          {/* Device safety notice */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-gray-200/80 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {lang === 'vi'
                ? 'Dữ liệu giỏ hàng và tin nhắn sẽ được bảo lưu an toàn.'
                : 'Your cart and chat history remain securely stored.'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              {lang === 'vi' ? 'Ở Lại' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black shadow-md shadow-rose-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đăng Xuất' : 'Log Out'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
