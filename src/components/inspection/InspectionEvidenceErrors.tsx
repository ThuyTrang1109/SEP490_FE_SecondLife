import { AlertCircle } from 'lucide-react';

interface PhotoUploadState {
  id: string;
  file?: Pick<File, 'name'>;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

interface Props {
  photos: readonly PhotoUploadState[];
  selectionErrors: readonly string[];
  stepError: string | null;
}

export function InspectionEvidenceErrors({ photos, selectionErrors, stepError }: Props) {
  if (!stepError && !selectionErrors.length && !photos.some((photo) => photo.status === 'error')) return null;

  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
      <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
      <ul className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
        {selectionErrors.map((message, index) => <li key={index}>{message}</li>)}
        {stepError && <li>{stepError}</li>}
        {photos.map((photo, index) => photo.status === 'error' && (
          <li key={photo.id}>
            <strong className="block">Ảnh #{index + 1}{photo.file?.name ? ` · ${photo.file.name}` : ''}</strong>
            <span>{photo.errorMessage || 'Tải ảnh thất bại. Vui lòng thử lại.'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
