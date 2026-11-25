import { ApiError } from '../services/apiClient';
import { getInspectionRemoteMediaUrl, isInspectionProofImage } from './inspectionDecisionData';

export const INSPECTION_PHOTO_LIMIT = 10;
export const INSPECTION_PHOTO_MAX_BYTES = 5_000_000;
export const INSPECTION_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

const imageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export function getInspectionPhotoSelectionErrors(
  files: ReadonlyArray<Pick<File, 'name' | 'size' | 'type'>>,
  attachedCount: number,
): string[] {
  if (files.length + attachedCount > INSPECTION_PHOTO_LIMIT) {
    return [`Tối đa ${INSPECTION_PHOTO_LIMIT} ảnh bằng chứng. Hiện có ${attachedCount} ảnh, bạn vừa chọn thêm ${files.length} ảnh.`];
  }

  const errors: string[] = [];
  for (const file of files) {
    const type = file.type.toLowerCase();
    if (!/\.(?:jpe?g|png|webp)$/i.test(file.name)
      || (type && type !== 'application/octet-stream' && !imageTypes.has(type))) {
      errors.push(`"${file.name}" phải là ảnh JPG, PNG hoặc WebP.`);
    } else if (file.size === 0) {
      errors.push(`"${file.name}" là tệp rỗng. Vui lòng chọn ảnh khác.`);
    } else if (file.size >= INSPECTION_PHOTO_MAX_BYTES) {
      errors.push(`"${file.name}" phải có dung lượng dưới 5 MB.`);
    }
  }
  return errors;
}

function getUploadFieldMessage(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  for (const detail of error.errors ?? []) {
    if (detail?.field !== field) continue;
    const message = detail.message ?? detail.defaultMessage;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
}

export function getInspectionPhotoUploadError(error: unknown): string {
  return getUploadFieldMessage(error, 'file') ?? getUploadFieldMessage(error, 'files')
    ?? (error instanceof Error && error.message ? error.message : 'Tải ảnh thất bại. Vui lòng thử lại.');
}

export function getInspectionBatchPhotoError(error: unknown, index: number): string | undefined {
  if (!(error instanceof ApiError) || ![400, 413, 422].includes(error.status)) return undefined;
  return getUploadFieldMessage(error, `files[${index}]`);
}

export function getUploadedInspectionPhotoUrl(value?: string | null): string {
  const url = getInspectionRemoteMediaUrl(value);
  return url && isInspectionProofImage(url) ? url : '';
}

export function getInspectionEvidenceStepError(uploadedCount: number, uploading: boolean): string | null {
  if (uploading) return 'Ảnh đang tải lên. Vui lòng đợi tải xong trước khi tiếp tục.';
  if (uploadedCount === 0) return 'Cần ít nhất 1 ảnh bằng chứng đã tải lên thành công để tiếp tục.';
  if (uploadedCount > INSPECTION_PHOTO_LIMIT) return `Chỉ được nộp tối đa ${INSPECTION_PHOTO_LIMIT} ảnh bằng chứng.`;
  return null;
}
