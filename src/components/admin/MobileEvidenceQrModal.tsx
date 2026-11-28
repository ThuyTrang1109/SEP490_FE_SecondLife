import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Smartphone,
  X,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Wifi,
  Globe,
  Link2,
} from 'lucide-react';
import { ScannableQRCode } from '../common/ScannableQRCode';
import {
  walletService,
  WalletWithdrawalResponseDto,
  WithdrawalMobileUploadSessionDto,
  MobileUploadNetworkInfoDto,
} from '../../services/walletService';
import { formatVND } from '../../utils/translations';

type ConnectionMode = 'ngrok' | 'lan' | 'current' | 'custom';
type RouteTarget = 'backend' | 'frontend';

interface SavedConnectionConfig {
  mode: ConnectionMode;
  ngrokUrl: string;
  ngrokTarget: RouteTarget;
  lanIp: string;
  lanTarget: RouteTarget;
  lanFrontendPort: string;
  lanBackendPort: string;
  customUrl: string;
  customTarget: RouteTarget;
}

const STORAGE_KEY = 'sl_staff_mobile_upload_conn_v1';
const DEFAULT_NGROK_URL = 'https://clinking-slicing-visibly.ngrok-free.dev';

function loadSavedConfig(): SavedConnectionConfig {
  const isCurrentPublic =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  const fallback: SavedConnectionConfig = {
    mode: isCurrentPublic ? 'current' : 'ngrok',
    ngrokUrl: DEFAULT_NGROK_URL,
    ngrokTarget: 'backend',
    lanIp: '',
    lanTarget: 'frontend',
    lanFrontendPort: typeof window !== 'undefined' && window.location.port ? window.location.port : '3000',
    lanBackendPort: '8080',
    customUrl: '',
    customTarget: 'frontend',
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function cleanOrigin(raw: string, defaultScheme: 'https' | 'http' = 'https'): string {
  let s = (raw || '').trim();
  if (!s) return '';
  while (s.endsWith('/')) s = s.slice(0, -1);
  if (!/^https?:\/\//i.test(s)) {
    s = `${defaultScheme}://${s}`;
  }
  return s;
}

export interface MobileEvidenceQrModalProps {
  withdrawal: WalletWithdrawalResponseDto;
  mode?: 'staff' | 'user';
  purpose?: 'STAFF_RECEIPT' | 'USER_DISPUTE' | 'USER_EXCEPTION';
  maxFiles?: number;
  onClose: () => void;
  onUploaded: (evidenceUrl?: string | null, evidenceUrls?: string[]) => void;
  onImagesSync?: (newUrls: string[]) => void;
}

export const MobileEvidenceQrModal: React.FC<MobileEvidenceQrModalProps> = ({
  withdrawal,
  mode = 'staff',
  purpose,
  maxFiles,
  onClose,
  onUploaded,
  onImagesSync,
}) => {
  const effectivePurpose: 'STAFF_RECEIPT' | 'USER_DISPUTE' | 'USER_EXCEPTION' =
    purpose || (mode === 'user' ? 'USER_DISPUTE' : 'STAFF_RECEIPT');
  const effectiveMaxFiles =
    mode === 'user' ? Math.max(1, Math.min(3, maxFiles ?? 3)) : 1;

  const [config, setConfig] = useState<SavedConnectionConfig>(() => loadSavedConfig());
  const [networkInfo, setNetworkInfo] = useState<MobileUploadNetworkInfoDto | null>(null);
  const [session, setSession] = useState<WithdrawalMobileUploadSessionDto | null>(null);
  const [creating, setCreating] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [receivedSuccess, setReceivedSuccess] = useState<boolean>(false);
  const [receivedUrls, setReceivedUrls] = useState<string[]>([]);

  const seenUrlsRef = useRef<Set<string>>(new Set());
  const uploadedHandledRef = useRef<boolean>(false);
  const autoCloseTimerRef = useRef<number | null>(null);
  const onImagesSyncRef = useRef(onImagesSync);
  onImagesSyncRef.current = onImagesSync;
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current !== null) {
        window.clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  const updateConfig = (patch: Partial<SavedConnectionConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const createNewSession = useCallback(async () => {
    setCreating(true);
    setError(null);
    setReceivedSuccess(false);
    setReceivedUrls([]);
    seenUrlsRef.current = new Set();
    uploadedHandledRef.current = false;
    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    try {
      const created =
        mode === 'user'
          ? await walletService.createUserMobileUploadSession(
              withdrawal.id,
              effectivePurpose === 'USER_EXCEPTION' ? 'USER_EXCEPTION' : 'USER_DISPUTE',
              effectiveMaxFiles,
            )
          : await walletService.createMobileUploadSession(withdrawal.id);
      setSession(created);
      setNowMs(Date.now());
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo mã QR tải ảnh từ điện thoại.');
    } finally {
      setCreating(false);
    }
  }, [withdrawal.id, mode, effectivePurpose, effectiveMaxFiles]);

  useEffect(() => {
    void createNewSession();
    const fetchNetworkInfo =
      mode === 'user'
        ? walletService.getUserMobileUploadNetworkInfo()
        : walletService.getMobileUploadNetworkInfo();
    fetchNetworkInfo
      .then((info) => {
        setNetworkInfo(info);
        if (info?.lanIps?.length) {
          setConfig((prev) => {
            if (prev.lanIp) return prev;
            const next: SavedConnectionConfig = {
              ...prev,
              lanIp: info.lanIps[0],
              lanBackendPort: String(info.backendPort || 8080),
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      })
      .catch(() => {});
  }, [createNewSession, mode]);

  // Countdown tick
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Poll session status every 2 seconds
  useEffect(() => {
    if (!session?.sessionId || session.status !== 'PENDING' || receivedSuccess) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status =
          mode === 'user'
            ? await walletService.getUserMobileUploadSessionStatus(
                withdrawal.id,
                session.sessionId,
              )
            : await walletService.getMobileUploadSessionStatus(
                withdrawal.id,
                session.sessionId,
              );
        if (cancelled) return;

        const urls = Array.isArray(status.evidenceUrls)
          ? status.evidenceUrls
          : status.evidenceUrl
            ? [status.evidenceUrl]
            : [];
        const newlyAdded = urls.filter((u) => u && !seenUrlsRef.current.has(u));
        if (newlyAdded.length > 0) {
          newlyAdded.forEach((u) => seenUrlsRef.current.add(u));
          setReceivedUrls(Array.from(seenUrlsRef.current));
          onImagesSyncRef.current?.(newlyAdded);
        }

        if (status.status === 'UPLOADED') {
          if (!uploadedHandledRef.current) {
            uploadedHandledRef.current = true;
            setReceivedSuccess(true);
            setSession((prev) => (prev ? { ...prev, ...status, token: prev.token } : status));
            const finalEvidenceUrl = status.evidenceUrl || urls[urls.length - 1] || null;
            autoCloseTimerRef.current = window.setTimeout(() => {
              autoCloseTimerRef.current = null;
              onUploadedRef.current(finalEvidenceUrl, urls);
            }, 500);
          }
        } else if (status.status === 'EXPIRED') {
          setSession((prev) => (prev ? { ...prev, status: 'EXPIRED' } : status));
        }
      } catch {
        // Ignore transient polling failures
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session?.sessionId, session?.status, receivedSuccess, withdrawal.id, mode]);

  const remainingSeconds = useMemo(() => {
    if (!session?.expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - nowMs) / 1000));
  }, [session?.expiresAt, nowMs]);

  const isExpired =
    session?.status === 'EXPIRED' || (Boolean(session) && remainingSeconds <= 0 && !receivedSuccess);

  const qrUrl = useMemo(() => {
    const rawToken = session?.token;
    if (!rawToken) return '';
    const encodedToken = encodeURIComponent(rawToken);
    const buildPath = (target: RouteTarget) =>
      target === 'backend'
        ? `/api/v1/wallets/withdrawals/mobile-upload/${encodedToken}/page`
        : `/mobile-upload/withdrawal-evidence?token=${encodedToken}`;

    if (config.mode === 'ngrok') {
      const origin = cleanOrigin(config.ngrokUrl, 'https');
      if (!origin) return '';
      return `${origin}${buildPath(config.ngrokTarget)}`;
    }
    if (config.mode === 'lan') {
      const ip = config.lanIp.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      if (!ip) return '';
      const hasPort = /:\d+$/.test(ip);
      const port = config.lanTarget === 'backend' ? config.lanBackendPort : config.lanFrontendPort;
      const hostWithPort = hasPort ? ip : `${ip}:${port || (config.lanTarget === 'backend' ? '8080' : '3000')}`;
      return `http://${hostWithPort}${buildPath(config.lanTarget)}`;
    }
    if (config.mode === 'custom') {
      const origin = cleanOrigin(config.customUrl, 'https');
      if (!origin) return '';
      return `${origin}${buildPath(config.customTarget)}`;
    }
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    return currentOrigin ? `${currentOrigin}${buildPath('frontend')}` : '';
  }, [session?.token, config]);

  const isLocalhostWarning =
    config.mode === 'current' &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCopyLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {}
  };

  const headerTitle =
    effectivePurpose === 'USER_DISPUTE'
      ? 'Tải ảnh lịch sử giao dịch từ điện thoại (Quét QR)'
      : effectivePurpose === 'USER_EXCEPTION'
        ? 'Tải ảnh minh chứng ngoại lệ từ điện thoại (Quét QR)'
        : 'Tải ảnh biên lai từ điện thoại (Quét QR)';

  const instructionText =
    mode === 'user'
      ? `Mở camera trên điện thoại để quét mã QR, chọn tối đa ${effectiveMaxFiles} ảnh chụp màn hình lịch sử giao dịch ngân hàng và bấm gửi. Ảnh sẽ tự động thêm ngay vào biểu mẫu trên máy tính.`
      : 'Mở camera trên điện thoại để quét mã QR, chọn ảnh chụp màn hình biên lai chuyển khoản và bấm gửi. Ảnh sẽ tự động xuất hiện ngay trên máy tính.';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[180] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#24263e] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-[#fce5da]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base truncate">
                {headerTitle}
              </h3>
              <p className="text-[11px] text-white/75 truncate">
                Lệnh #{withdrawal.requestCode || withdrawal.id.slice(0, 8)} · {formatVND(withdrawal.amount)}
                {mode === 'user' ? ` · Tối đa ${effectiveMaxFiles} ảnh` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/15 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {receivedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                {mode === 'user'
                  ? `Đã nhận đủ ${receivedUrls.length} ảnh minh chứng từ điện thoại. Đang cập nhật vào biểu mẫu...`
                  : 'Đã nhận ảnh biên lai từ điện thoại. Đang tự động cập nhật vào ô minh chứng...'}
              </span>
            </div>
          )}

          {mode === 'user' && receivedUrls.length > 0 && !receivedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center justify-between gap-2 font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Đã nhận {receivedUrls.length}/{effectiveMaxFiles} ảnh từ điện thoại (đã tự động thêm vào biểu mẫu)
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {receivedUrls.map((url, idx) => (
                  <img
                    key={`${url}-${idx}`}
                    src={url}
                    alt={`Ảnh đã nhận ${idx + 1}`}
                    className="w-12 h-12 rounded-lg object-cover border border-emerald-300 bg-white"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Connection Option Selector */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="font-extrabold text-slate-900">
              Chọn cách kết nối điện thoại tới máy chủ:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'ngrok', label: 'Ngrok (4G/Wi-Fi)', icon: Globe },
                  { id: 'lan', label: 'IP Mạng LAN', icon: Wifi },
                  { id: 'current', label: 'Domain hiện tại', icon: Link2 },
                  { id: 'custom', label: 'URL tùy chỉnh', icon: Link2 },
                ] as { id: ConnectionMode; label: string; icon: React.ComponentType<{ className?: string }> }[]
              ).map((opt) => {
                const Icon = opt.icon;
                const active = config.mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateConfig({ mode: opt.id })}
                    className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      active
                        ? 'bg-[#24263e] text-white border-[#24263e] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {config.mode === 'ngrok' && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Địa chỉ Ngrok HTTPS:
                  </label>
                  <input
                    type="text"
                    value={config.ngrokUrl}
                    onChange={(e) => updateConfig({ ngrokUrl: e.target.value })}
                    placeholder="https://xxxx.ngrok-free.dev"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#24263e]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="font-bold text-slate-600">Ngrok đang trỏ về:</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="ngrokTarget"
                      checked={config.ngrokTarget === 'backend'}
                      onChange={() => updateConfig({ ngrokTarget: 'backend' })}
                    />
                    <span>Backend (:8080 - giống Mobile App)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="ngrokTarget"
                      checked={config.ngrokTarget === 'frontend'}
                      onChange={() => updateConfig({ ngrokTarget: 'frontend' })}
                    />
                    <span>Web FE (:3000)</span>
                  </label>
                </div>
              </div>
            )}

            {config.mode === 'lan' && (
              <div className="space-y-2.5 pt-1">
                {networkInfo && networkInfo.lanIps.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">IP phát hiện:</span>
                    {networkInfo.lanIps.map((ip) => (
                      <button
                        key={ip}
                        type="button"
                        onClick={() => updateConfig({ lanIp: ip })}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold border cursor-pointer ${
                          config.lanIp === ip
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {ip}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      IP mạng LAN của laptop (điện thoại dùng chung Wi-Fi):
                    </label>
                    <input
                      type="text"
                      value={config.lanIp}
                      onChange={(e) => updateConfig({ lanIp: e.target.value })}
                      placeholder="VD: 192.168.1.15"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#24263e]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Cổng:</label>
                    <input
                      type="text"
                      value={
                        config.lanTarget === 'backend'
                          ? config.lanBackendPort
                          : config.lanFrontendPort
                      }
                      onChange={(e) =>
                        updateConfig(
                          config.lanTarget === 'backend'
                            ? { lanBackendPort: e.target.value }
                            : { lanFrontendPort: e.target.value },
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#24263e]"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="font-bold text-slate-600">Kết nối qua:</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="lanTarget"
                      checked={config.lanTarget === 'frontend'}
                      onChange={() => updateConfig({ lanTarget: 'frontend' })}
                    />
                    <span>Web FE (:{config.lanFrontendPort || '3000'})</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="lanTarget"
                      checked={config.lanTarget === 'backend'}
                      onChange={() => updateConfig({ lanTarget: 'backend' })}
                    />
                    <span>Backend trực tiếp (:{config.lanBackendPort || '8080'})</span>
                  </label>
                </div>
              </div>
            )}

            {config.mode === 'custom' && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    URL máy chủ tùy chỉnh:
                  </label>
                  <input
                    type="text"
                    value={config.customUrl}
                    onChange={(e) => updateConfig({ customUrl: e.target.value })}
                    placeholder="https://ten-mien-cua-ban.vn hoặc http://192.168.x.x:8080"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#24263e]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="font-bold text-slate-600">URL này là:</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="customTarget"
                      checked={config.customTarget === 'frontend'}
                      onChange={() => updateConfig({ customTarget: 'frontend' })}
                    />
                    <span>Web FE</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="customTarget"
                      checked={config.customTarget === 'backend'}
                      onChange={() => updateConfig({ customTarget: 'backend' })}
                    />
                    <span>Backend API</span>
                  </label>
                </div>
              </div>
            )}

            {isLocalhostWarning && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                Trang hiện tại đang mở bằng localhost nên điện thoại không truy cập được. Hãy chọn tab <strong>Ngrok</strong> hoặc <strong>IP Mạng LAN</strong> ở trên.
              </div>
            )}
          </div>

          {/* QR Display */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col items-center text-center space-y-3">
            {creating ? (
              <div className="py-10 flex flex-col items-center gap-2 text-slate-500">
                <Loader2 className="w-7 h-7 animate-spin text-[#c34c36]" />
                <span className="font-semibold">Đang tạo phiên tải ảnh bảo mật...</span>
              </div>
            ) : isExpired ? (
              <div className="py-6 space-y-3">
                <div className="text-rose-700 font-bold">
                  Mã QR tải ảnh đã hết hạn (quá 10 phút).
                </div>
                <button
                  type="button"
                  onClick={() => void createNewSession()}
                  className="px-4 py-2 rounded-xl bg-[#24263e] hover:bg-[#c34c36] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tạo mã QR mới</span>
                </button>
              </div>
            ) : qrUrl ? (
              <>
                <div className="p-2.5 rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <ScannableQRCode
                    value={qrUrl}
                    size={210}
                    title="Quét bằng camera điện thoại để tải ảnh minh chứng"
                  />
                </div>

                <div className="flex items-center gap-2 text-[11.5px] font-bold text-slate-700">
                  {!receivedSuccess && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c34c36]" />
                  )}
                  <span>
                    {receivedSuccess
                      ? 'Đã nhận ảnh minh chứng từ điện thoại'
                      : `Đang chờ tải ảnh từ điện thoại... (Hết hạn sau ${formatCountdown(remainingSeconds)})`}
                  </span>
                </div>

                <div className="w-full flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <span className="font-mono text-[10.5px] text-slate-600 truncate flex-1 text-left">
                    {qrUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[10.5px] font-bold text-slate-700 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedLink ? 'Đã chép' : 'Chép link'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 max-w-md leading-relaxed">
                  {instructionText}
                </p>
              </>
            ) : (
              <div className="py-6 text-amber-700 font-semibold">
                Vui lòng nhập địa chỉ Ngrok / IP mạng LAN hợp lệ ở phía trên để tạo mã QR.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={creating}
            onClick={() => void createNewSession()}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${creating ? 'animate-spin' : ''}`} />
            <span>Tạo mã QR mới</span>
          </button>
          <div className="flex items-center gap-2">
            {mode === 'user' && receivedUrls.length > 0 && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                Xong ({receivedUrls.length} ảnh)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#24263e] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
