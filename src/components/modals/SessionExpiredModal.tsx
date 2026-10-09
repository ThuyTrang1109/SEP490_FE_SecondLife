import React from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { Language } from '../../types';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLoginAgain: () => void;
  lang?: Language;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onLoginAgain,
  lang = 'vi'
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn select-none font-sans"
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all text-[#24263e]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Warning Strip */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-[#c34c36]" />

        <div className="p-6 text-center space-y-4 mt-2">
          {/* Animated Icon Circle */}
          <div className="relative inline-block mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-600 shadow-md shadow-amber-500/10">
              <AlertCircle className="w-8 h-8" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-black text-[#24263e] tracking-tight">
              {lang === 'vi' ? 'Phiên Đăng Nhập Hết Hạn' : 'Session Expired'}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-[260px] mx-auto">
              {lang === 'vi'
                ? 'Phiên làm việc của bạn đã kết thúc. Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống an toàn.'
                : 'Your session has ended. Please log in again to continue using the system securely.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-4">
            <button
              type="button"
              onClick={onLoginAgain}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#c34c36] to-orange-600 hover:from-[#a83c28] hover:to-orange-700 text-white text-sm font-black shadow-md shadow-orange-500/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Đăng Nhập Lại' : 'Log In Again'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
