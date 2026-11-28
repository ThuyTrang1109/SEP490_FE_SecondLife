import React from 'react';
import { CheckCircle2, Copy, Lock, Mail, Phone, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import type { Language, UserRole } from '../../types';
import type { PolicyTabKey } from '../modals/PolicyModal';
import logoImg from '../../assets/logo.png';

interface FooterProps {
  lang?: Language;
  currentRole?: UserRole | string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenProfile?: () => void;
  onOpenPolicy?: (policyKey: PolicyTabKey) => void;
}

const footerContainer = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
const supportEmail = 'noreply.homeappliance@gmail.com';

const features = [
  {
    icon: ShieldCheck,
    style: 'bg-[#c34c36]/20 text-[#fce5da]',
    title: { vi: 'Kiểm định sản phẩm', en: 'Product inspection' },
    description: { vi: 'Tại nhà người bán hoặc tại trung tâm', en: 'At the seller’s home or an inspection center' },
  },
  {
    icon: Lock,
    style: 'bg-emerald-500/15 text-emerald-300',
    title: { vi: 'Thanh toán qua Escrow', en: 'Escrow payments' },
    description: { vi: 'Tạm giữ tiền đơn hàng khi giao nhận và đối soát', en: 'Order payments held during delivery and review' },
  },
  {
    icon: Truck,
    style: 'bg-amber-500/15 text-amber-300',
    title: { vi: 'Giao nhận tận nơi', en: 'Door-to-door delivery' },
    description: { vi: 'Vận chuyển qua Lalamove', en: 'Delivery via Lalamove' },
  },
  {
    icon: Sparkles,
    style: 'bg-purple-500/15 text-purple-300',
    title: { vi: 'AI hỗ trợ định giá', en: 'AI price suggestions' },
    description: { vi: 'Gợi ý mức giá tham khảo khi đăng tin', en: 'Suggested prices when creating a listing' },
  },
];

const policyLinks: { key: PolicyTabKey; label: Record<Language, string> }[] = [
  { key: 'about', label: { vi: 'Giới thiệu về SecondLife', en: 'About SecondLife' } },
  { key: 'lab', label: { vi: 'Kiểm định sản phẩm', en: 'Product inspection' } },
  { key: 'rules', label: { vi: 'Quy chế hoạt động sàn', en: 'Operating rules' } },
  { key: 'terms', label: { vi: 'Điều khoản dịch vụ', en: 'Terms of service' } },
  { key: 'privacy', label: { vi: 'Chính sách bảo mật dữ liệu', en: 'Data privacy policy' } },
];

export const Footer: React.FC<FooterProps> = ({ lang = 'vi', onOpenPolicy }) => {
  const [copiedEmail, setCopiedEmail] = React.useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#24263e] text-white">
      <div className="border-b border-white/10 bg-[#1b1c2d]">
        <div className={footerContainer + ' py-5'}>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {features.map(({ icon: Icon, style, title, description }) => (
              <li key={title.en} className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
                <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + style}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-snug sm:text-sm">{title[lang]}</p>
                  <p className="mt-1 text-xs leading-snug text-white/65">{description[lang]}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={footerContainer + ' py-8 sm:py-10'}>
        <div className="grid items-start gap-7 sm:grid-cols-2 sm:gap-8 lg:grid-cols-[1.2fr_0.9fr_1fr] lg:gap-10">
          <section className="min-w-0 space-y-4 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="logo-badge shrink-0 rounded-xl border border-white/80 bg-white p-1.5">
                <img src={logoImg} alt="" className="h-10 w-auto object-contain" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xl font-black tracking-tight">Second<span className="text-[#f18b77]">Life</span></span>
                <span className="rounded bg-[#c34c36] px-1.5 py-0.5 text-[9px] font-black tracking-wider">
                  VERIFIED
                </span>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/75">
              {lang === 'vi'
                ? 'Sàn mua bán đồ gia dụng đã qua sử dụng, hỗ trợ kiểm định và thanh toán qua Escrow.'
                : 'Marketplace for used home appliances with product inspections and escrow payments.'}
            </p>
          </section>

          <nav aria-labelledby="footer-about-heading">
            <h2 id="footer-about-heading" className="mb-3 text-sm font-bold">
              {lang === 'vi' ? 'Về SecondLife' : 'About SecondLife'}
            </h2>
            <ul className="space-y-2 text-sm text-white/75">
              {policyLinks.map(({ key, label }) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onOpenPolicy?.(key)}
                    className="cursor-pointer rounded-sm text-left transition hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f18b77]"
                  >
                    {label[lang]}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="min-w-0 space-y-5">
            <div>
              <h2 className="mb-3 text-sm font-bold">{lang === 'vi' ? 'Liên hệ' : 'Contact'}</h2>
              <div className="space-y-3 text-sm text-white/75">
                <a
                  href="tel:19008899"
                  className="flex w-fit items-center gap-2 rounded-sm transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f18b77]"
                >
                  <Phone className="h-4 w-4 shrink-0 text-[#f18b77]" aria-hidden="true" />
                  <span className="hover:underline">1900 8899</span>
                </a>
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#f18b77]" aria-hidden="true" />
                  <a
                    href={'mailto:' + supportEmail}
                    className="min-w-0 break-all rounded-sm transition hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f18b77]"
                  >
                    {supportEmail}
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    aria-label={lang === 'vi' ? 'Sao chép email hỗ trợ' : 'Copy support email'}
                    title={lang === 'vi' ? 'Sao chép email' : 'Copy email'}
                    className="-mt-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/15 bg-white/5 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f18b77]"
                  >
                    {copiedEmail
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                      : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                  <span className="sr-only" role="status">
                    {copiedEmail && (lang === 'vi' ? 'Đã sao chép email' : 'Email copied')}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold">{lang === 'vi' ? 'Thanh toán và vận chuyển' : 'Payments and delivery'}</h2>
              <ul className="flex flex-wrap gap-1.5">
                {['VietQR', 'Escrow', 'Lalamove'].map((label) => (
                  <li key={label} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/75">
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#1b1c2d]">
        <p className={footerContainer + ' py-4 text-xs text-white/65'}>© 2026 SecondLife</p>
      </div>
    </footer>
  );
};
