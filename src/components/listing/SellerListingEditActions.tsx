import { Edit3, Package, Sliders } from 'lucide-react';
import type { Language, SellerListingActions } from '../../types';

interface SellerListingEditActionsProps {
  actions?: SellerListingActions;
  lang: Language;
  onEdit: () => void;
  onUpdateShippingPackage: () => void;
  onReclassify: () => void;
}

const buttonClass = 'flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100';

export function SellerListingEditActions({ actions, lang, onEdit, onUpdateShippingPackage, onReclassify }: SellerListingEditActionsProps) {
  if (!actions) return null;
  const vi = lang === 'vi';
  return (
    <>
      {actions.editContent && (
        <button type="button" onClick={onEdit} className={buttonClass}>
          <Edit3 aria-hidden="true" className="size-3.5" />
          {vi ? 'Sửa tin đăng' : 'Edit listing'}
        </button>
      )}
      {actions.updateShippingPackage && (
        <button type="button" onClick={onUpdateShippingPackage} className={buttonClass}>
          <Package aria-hidden="true" className="size-3.5" />
          {vi ? 'Cập nhật kiện hàng' : 'Update shipping package'}
        </button>
      )}
      {actions.reclassifyItem && (
        <button type="button" onClick={onReclassify} className={buttonClass}>
          <Sliders aria-hidden="true" className="size-3.5" />
          {vi ? 'Chọn lại loại thiết bị' : 'Reclassify item'}
        </button>
      )}
    </>
  );
}
