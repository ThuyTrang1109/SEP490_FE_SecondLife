import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  User,
  KeyRound,
  Mail,
} from 'lucide-react';
import type { useCenterStaff } from './useCenterStaff';

interface Props {
  staff: Pick<ReturnType<typeof useCenterStaff>,
    | 'createdStaffSuccessData'
    | 'createStaffError'
    | 'handleCopyCredentials'
    | 'handleCreateStaffSubmit'
    | 'handleGeneratePassword'
    | 'hasCopiedCredentials'
    | 'isCreatingStaff'
    | 'newStaffEmail'
    | 'newStaffName'
    | 'newStaffPassword'
    | 'setCreatedStaffSuccessData'
    | 'setIsCreateStaffModalOpen'
    | 'setNewStaffEmail'
    | 'setNewStaffName'
    | 'setNewStaffPassword'
    | 'setShowStaffPassword'
    | 'showStaffPassword'
  >;
}

export function CreateInspectorModal({ staff }: Props) {
  const {
    createdStaffSuccessData,
    createStaffError,
    handleCopyCredentials,
    handleCreateStaffSubmit,
    handleGeneratePassword,
    hasCopiedCredentials,
    isCreatingStaff,
    newStaffEmail,
    newStaffName,
    newStaffPassword,
    setCreatedStaffSuccessData,
    setIsCreateStaffModalOpen,
    setNewStaffEmail,
    setNewStaffName,
    setNewStaffPassword,
    setShowStaffPassword,
    showStaffPassword,
  } = staff;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#c34c36] to-[#e0563e] text-white">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#24263e]">Cấp Tài Khoản Kỹ Thuật Viên</h3>
              <p className="text-[11px] text-gray-400">Tạo thông tin công vụ cho KTV trực thuộc trung tâm</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCreateStaffModalOpen(false);
              setCreatedStaffSuccessData(null);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Card view if created */}
        {createdStaffSuccessData ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Cấp tài khoản KTV thành công!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Vui lòng bàn giao thông tin đăng nhập bên dưới cho kỹ thuật viên:
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 font-mono text-xs">
              <div>
                <span className="text-gray-500 font-sans">Họ và tên: </span>
                <strong className="text-gray-900">{createdStaffSuccessData.fullName}</strong>
              </div>
              <div>
                <span className="text-gray-500 font-sans">Email công vụ: </span>
                <strong className="text-gray-900">{createdStaffSuccessData.email}</strong>
              </div>
              <div>
                <span className="text-gray-500 font-sans">Mật khẩu khởi tạo: </span>
                <strong className="text-[#c34c36] text-sm">{createdStaffSuccessData.password}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                {hasCopiedCredentials ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{hasCopiedCredentials ? 'Đã Sao Chép!' : 'Sao Chép Thông Tin'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedStaffSuccessData(null);
                  setIsCreateStaffModalOpen(false);
                }}
                className="py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleCreateStaffSubmit} className="space-y-4">
            {createStaffError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{createStaffError}</span>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-black text-[#24263e]">
                Họ Và Tên Kỹ Thuật Viên: <strong className="text-rose-500">*</strong>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="Nguyễn Văn Kỹ Thuật"
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-black text-[#24263e]">
                Email Đăng Nhập Công Vụ: <strong className="text-rose-500">*</strong>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="ktv.nguyenvan@secondlife.com"
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#24263e]">
                  Mật Khẩu Khởi Tạo: <strong className="text-rose-500">*</strong>
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] font-bold text-[#c34c36] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Tạo Mật Khẩu Ngẫu Nhiên</span>
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showStaffPassword ? 'text' : 'password'}
                  required
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự..."
                  className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-[#c34c36]"
                />
                <button
                  type="button"
                  onClick={() => setShowStaffPassword(!showStaffPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCreateStaffModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="submit"
                disabled={isCreatingStaff}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#c34c36] hover:bg-[#a63f2d] text-white transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isCreatingStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Cấp Tài Khoản KTV</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
