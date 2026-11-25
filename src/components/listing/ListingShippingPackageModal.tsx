import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, Package, X } from 'lucide-react';
import type { Language } from '../../types';
import { ApiError } from '../../services/apiClient';
import { postService } from '../../services/postService';
import { shippingService, type ShippingParcel } from '../../services/shippingService';

interface ListingShippingPackageModalProps {
  postId: string;
  title: string;
  lang: Language;
  onClose: () => void;
  onSaved: (parcel: ShippingParcel) => void;
}

const maxParcelValue = 2_147_483_647;
const fields = [
  { name: 'weight', vi: 'Trọng lượng (g)', en: 'Weight (g)' },
  { name: 'length', vi: 'Chiều dài (cm)', en: 'Length (cm)' },
  { name: 'width', vi: 'Chiều rộng (cm)', en: 'Width (cm)' },
  { name: 'height', vi: 'Chiều cao (cm)', en: 'Height (cm)' },
] as const;

export function ListingShippingPackageModal({ postId, title, lang, onClose, onSaved }: ListingShippingPackageModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Record<keyof ShippingParcel, string> | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const vi = lang === 'vi';
  const heading = vi ? 'Cập nhật kiện hàng' : 'Update shipping package';
  const lockedMessage = vi ? 'Bài đăng đã chuyển trạng thái. Hãy làm mới danh sách để xem thao tác hiện có.'
    : 'The listing status changed. Refresh the list to see the available actions.';

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    postService.getMyPostDetail(postId, controller.signal).then((post) => {
      if (controller.signal.aborted) return;
      if (!post.sellerActions?.updateShippingPackage) {
        setError(lockedMessage);
        return;
      }
      setValues({
        weight: String(post.shippingWeight ?? ''),
        length: String(post.shippingLength ?? ''),
        width: String(post.shippingWidth ?? ''),
        height: String(post.shippingHeight ?? ''),
      });
    }).catch(() => {
      if (!controller.signal.aborted) setError(vi ? 'Không thể tải thông tin kiện hàng.' : 'Could not load the shipping package.');
    });
    return () => controller.abort();
  }, [postId, lockedMessage, vi]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values || saving) return;
    const parcel = {
      weight: Number(values.weight),
      length: Number(values.length),
      width: Number(values.width),
      height: Number(values.height),
    };
    if (Object.values(parcel).some((value) => !Number.isInteger(value) || value < 1 || value > maxParcelValue)) {
      setError(vi ? 'Nhập trọng lượng và kích thước bằng số nguyên dương.' : 'Enter positive whole numbers for the weight and dimensions.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      onSaved(await shippingService.updateShippingPackage(postId, parcel));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setValues(null);
        setError(lockedMessage);
      } else {
        setError(vi ? 'Không thể lưu kiện hàng. Vui lòng thử lại.' : 'Could not save the shipping package. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="listing-package-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      className="m-auto max-h-[90dvh] w-[min(30rem,calc(100%-2rem))] overflow-y-auto rounded-2xl bg-white text-[#24263e] shadow-2xl backdrop:bg-slate-950/60"
    >
      <form onSubmit={handleSubmit}>
        <header className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="rounded-xl bg-orange-50 p-2.5 text-[#c34c36]"><Package aria-hidden="true" className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="listing-package-title" className="text-lg font-bold">{heading}</h2>
            <p className="mt-1 text-sm text-slate-600">{title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label={vi ? 'Đóng' : 'Close'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {!values && !error && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {vi ? 'Đang tải thông tin kiện hàng…' : 'Loading shipping package…'}
            </p>
          )}
          {values && (
            <fieldset disabled={saving} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map(({ name, vi: labelVi, en }) => (
                <label key={name} className="space-y-1 text-sm font-medium">
                  <span>{vi ? labelVi : en}</span>
                  <input
                    type="number"
                    required min={1} max={maxParcelValue} step={1}
                    value={values[name]}
                    onChange={(event) => setValues({ ...values, [name]: event.target.value })}
                    className="block w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-[#c34c36] focus:outline-none"
                  />
                </label>
              ))}
            </fieldset>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 p-5 text-sm font-semibold">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 disabled:opacity-50">
            {vi ? 'Đóng' : 'Close'}
          </button>
          <button type="submit" disabled={saving || !values} className="rounded-xl bg-[#24263e] px-4 py-2 text-white hover:bg-black disabled:opacity-50">
            {saving ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Lưu kiện hàng' : 'Save package')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
