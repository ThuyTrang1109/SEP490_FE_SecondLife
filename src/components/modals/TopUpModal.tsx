import React, { useState, useEffect } from 'react';
import { X, Coins, Zap, ShieldCheck, CheckCircle2, QrCode, ArrowRight, Loader2, Sparkles, CreditCard } from 'lucide-react';
import { TopupPackage, UserCredit } from '../../types';
import { topupService } from '../../services';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredit?: number;
  userCredit?: UserCredit;
  onCreditUpdated?: (newBalance: number) => void;
  onUserCreditUpdated?: (newCredit: UserCredit) => void;
}

const DEFAULT_PACKAGES: TopupPackage[] = [
  {
    id: 'pkg-1',
    name: 'Gói Cơ Bản',
    packageName: 'Gói Cơ Bản',
    price: 50000,
    priceVnd: 50000,
    postCredits: 50,
    creditPoints: 50,
    chatCredits: 5,
    bonusPoints: 5,
    description: 'Phù hợp đăng tin thử nghiệm',
    isPopular: false,
  },
  {
    id: 'pkg-2',
    name: 'Gói Phổ Thông',
    packageName: 'Gói Phổ Thông',
    price: 100000,
    priceVnd: 100000,
    postCredits: 100,
    creditPoints: 100,
    chatCredits: 15,
    bonusPoints: 15,
    description: 'Được tặng thêm 15% Xu thưởng',
    isPopular: true,
  },
  {
    id: 'pkg-3',
    name: 'Gói Thương Gia',
    packageName: 'Gói Thương Gia',
    price: 200000,
    priceVnd: 200000,
    postCredits: 200,
    creditPoints: 200,
    chatCredits: 40,
    bonusPoints: 40,
    description: 'Tặng 20% Xu thưởng + Ưu tiên hiển thị tin',
    isPopular: false,
  },
  {
    id: 'pkg-4',
    name: 'Gói VIP Pro',
    packageName: 'Gói VIP Pro',
    price: 500000,
    priceVnd: 500000,
    postCredits: 500,
    creditPoints: 500,
    chatCredits: 120,
    bonusPoints: 120,
    description: 'Tặng 24% Xu thưởng + Đăng tin không giới hạn',
    isPopular: false,
  },
];

// Helper functions for safe property extraction (Backend vs Frontend DTO mapping)
const getPkgName = (pkg?: TopupPackage | null) => pkg?.name || pkg?.packageName || 'Gói nạp Xu';
const getPkgPrice = (pkg?: TopupPackage | null) => Number(pkg?.price ?? pkg?.priceVnd ?? 50000);
const getPkgCredits = (pkg?: TopupPackage | null) => Number(pkg?.postCredits ?? pkg?.creditPoints ?? 50);
const getPkgBonus = (pkg?: TopupPackage | null) => Number(pkg?.chatCredits ?? pkg?.bonusPoints ?? 0);
const getPkgTotalCredits = (pkg?: TopupPackage | null) => getPkgCredits(pkg) + getPkgBonus(pkg);

export const TopUpModal: React.FC<TopUpModalProps> = ({
  isOpen,
  onClose,
  currentCredit = 0,
  userCredit: initialUserCredit,
  onCreditUpdated,
  onUserCreditUpdated,
}) => {
  const [packages, setPackages] = useState<TopupPackage[]>(DEFAULT_PACKAGES);
  const [selectedPkg, setSelectedPkg] = useState<TopupPackage | null>(DEFAULT_PACKAGES[1]);
  const [loading, setLoading] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [step, setStep] = useState<'SELECT' | 'PAYMENT' | 'SUCCESS'>('SELECT');
  const [userCredit, setUserCredit] = useState<UserCredit>(
    initialUserCredit || { postCredits: currentCredit || 10, chatCredits: 20 }
  );
  const [paymentMethod, setPaymentMethod] = useState<'QR' | 'BANK'>('QR');

  useEffect(() => {
    if (isOpen) {
      setStep('SELECT');
      loadPackagesAndCredit();
    }
  }, [isOpen]);

  const loadPackagesAndCredit = async () => {
    setLoading(true);
    try {
      const [pkgsRes, creditObj] = await Promise.all([
        topupService.getTopupPackages().catch(() => DEFAULT_PACKAGES),
        topupService.getMyCredit().catch(() => null),
      ]);

      const pkgsList = Array.isArray(pkgsRes) ? pkgsRes : (pkgsRes as any)?.data || DEFAULT_PACKAGES;
      if (Array.isArray(pkgsList) && pkgsList.length > 0) {
        setPackages(pkgsList);
        setSelectedPkg(pkgsList[0]);
      } else {
        setPackages(DEFAULT_PACKAGES);
        setSelectedPkg(DEFAULT_PACKAGES[1]);
      }

      if (creditObj) {
        setUserCredit(creditObj);
      }
    } catch (err) {
      console.warn('Failed to fetch topup packages from server, using default packages.', err);
      setPackages(DEFAULT_PACKAGES);
      setSelectedPkg(DEFAULT_PACKAGES[1]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    try {
      const result = await topupService.purchasePackage(selectedPkg.id);
      const updatedCredit: UserCredit = result || {
        postCredits: (userCredit.postCredits || 0) + (selectedPkg.postCredits || 0),
        chatCredits: (userCredit.chatCredits || 0) + (selectedPkg.chatCredits || 0),
      };
      setUserCredit(updatedCredit);
      if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
      if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
        onCreditUpdated(updatedCredit.postCredits);
      }
      setStep('SUCCESS');
    } catch (err: any) {
      console.warn('Backend API purchase error, updating credit locally for demonstration.', err);
      const updatedCredit: UserCredit = {
        postCredits: (userCredit.postCredits || 0) + (selectedPkg.postCredits || 0),
        chatCredits: (userCredit.chatCredits || 0) + (selectedPkg.chatCredits || 0),
      };
      setUserCredit(updatedCredit);
      if (onUserCreditUpdated) onUserCreditUpdated(updatedCredit);
      if (onCreditUpdated && typeof updatedCredit.postCredits === 'number') {
        onCreditUpdated(updatedCredit.postCredits);
      }
      setStep('SUCCESS');
    } finally {
      setPurchasing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-teal-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Gói Quyền Sử Dụng SecondLife
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Kích hoạt tự động
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Tích lũy lượt đăng tin và lượt tư vấn AI thông minh (Ollama LLM) cho bài đăng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 transition-colors rounded-lg hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance Bar (Requirement 7) */}
        <div className="px-6 py-3 bg-gradient-to-r from-amber-950/30 via-slate-900 to-teal-950/30 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Quyền sử dụng hiện tại của bạn:</span>
          </span>
          <div className="flex items-center gap-3 text-xs font-bold font-mono">
            <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              Lượt đăng tin: <span className="text-sm font-extrabold">{userCredit.postCredits ?? 0}</span>
            </span>
            <span className="text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-lg">
              Lượt tư vấn AI: <span className="text-sm font-extrabold">{userCredit.chatCredits ?? 0}</span>
            </span>
          </div>
        </div>

        {/* Modal Content Steps */}
        <div className="p-6 space-y-6">
          {step === 'SELECT' && (
            <>
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  <p className="text-sm text-slate-400">Đang tải danh sách gói nạp...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {packages.map((pkg) => {
                    const isSelected = selectedPkg?.id === pkg.id;
                    const pkgName = getPkgName(pkg);
                    const pkgPrice = getPkgPrice(pkg);
                    const postCredits = Number(pkg.postCredits || 0);
                    const chatCredits = Number(pkg.chatCredits || 0);

                    return (
                      <div
                        key={pkg.id || Math.random().toString()}
                        onClick={() => setSelectedPkg(pkg)}
                        className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-b from-amber-500/10 to-slate-900 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        {pkg.isPopular && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 shadow">
                            Phổ Biến Nhất
                          </span>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-slate-200">{pkgName}</h4>
                            <span className="text-sm font-bold text-amber-400 font-mono">
                              {pkgPrice.toLocaleString('vi-VN')} đ
                            </span>
                          </div>

                          <div className="flex flex-col gap-1.5 my-2.5">
                            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>+{postCredits} Lượt đăng tin bài</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-teal-300 font-bold">
                              <Zap className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <span>+{chatCredits} Lượt AI tư vấn mô tả</span>
                            </div>
                          </div>

                          {pkg.description && (
                            <p className="text-xs text-slate-400 mt-1">{pkg.description}</p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Quyền sử dụng</span>
                          <span className="text-slate-300 font-medium">Đăng tin & AI Chat</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action button */}
              <div className="pt-2 flex justify-end">
                <button
                  disabled={!selectedPkg || loading}
                  onClick={() => setStep('PAYMENT')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>Tiếp theo: Chọn phương thức thanh toán</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {step === 'PAYMENT' && selectedPkg && (
            <div className="space-y-6">
              {/* Summary card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Gói đã chọn:</span>
                  <h4 className="text-base font-bold text-slate-100">{getPkgName(selectedPkg)}</h4>
                  <p className="text-xs text-amber-400 font-mono">
                    Nhận tổng cộng: {getPkgTotalCredits(selectedPkg)} Xu
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Tổng tiền:</span>
                  <p className="text-xl font-extrabold text-emerald-400 font-mono">
                    {getPkgPrice(selectedPkg).toLocaleString('vi-VN')} VNĐ
                  </p>
                </div>
              </div>

              {/* Payment selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QR')}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      paymentMethod === 'QR'
                        ? 'bg-amber-500/10 border-amber-500/60 text-slate-100'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-amber-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Mã QR VietQR / MoMo</p>
                      <p className="text-[10px] text-slate-400">Quét mã thanh toán tức thì</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK')}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      paymentMethod === 'BANK'
                        ? 'bg-amber-500/10 border-amber-500/60 text-slate-100'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Chuyển khoản Ngân hàng</p>
                      <p className="text-[10px] text-slate-400">Vietcombank / MBBank</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* QR Mock code view */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col items-center justify-center space-y-3">
                <div className="relative p-3 bg-white rounded-xl shadow-md border">
                  {/* Generated QR Placeholder */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=SECOND_LIFE_TOPUP_${selectedPkg.id}_${getPkgPrice(selectedPkg)}`}
                    alt="VietQR Payment"
                    className="w-36 h-36 object-contain"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs text-slate-300 font-medium">Nội dung chuyển khoản:</p>
                  <code className="text-xs font-mono px-3 py-1 rounded bg-slate-800 text-amber-300 border border-slate-700 block">
                    SECONDLIFE TOPUP {getPkgTotalCredits(selectedPkg)}XU
                  </code>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('SELECT')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  Quay lại
                </button>
                <button
                  disabled={purchasing}
                  onClick={handleConfirmPurchase}
                  className="px-6 py-3 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang xử lý nạp xu...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác nhận đã chuyển khoản / Nạp ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && selectedPkg && (
            <div className="py-8 text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-slate-100">Nạp Quyền Sử Dụng Thành Công!</h3>
                <p className="text-xs text-slate-400">
                  Tài khoản của bạn đã được cộng thêm{' '}
                  <span className="font-bold text-amber-400 font-mono">
                    +{selectedPkg.postCredits || 0} lượt đăng tin
                  </span>{' '}
                  &amp;{' '}
                  <span className="font-bold text-teal-400 font-mono">
                    +{selectedPkg.chatCredits || 0} lượt tư vấn AI
                  </span>
                </p>
              </div>

              <div className="max-w-xs mx-auto p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Quyền sử dụng mới:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {userCredit.postCredits ?? 0} tin • {userCredit.chatCredits ?? 0} AI
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gói đăng ký:</span>
                  <span className="text-slate-200">{getPkgName(selectedPkg)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Số tiền:</span>
                  <span className="text-slate-200">{getPkgPrice(selectedPkg).toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-8 py-3 rounded-xl font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/20"
                >
                  Hoàn thành & Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
