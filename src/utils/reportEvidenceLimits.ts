export const REPORT_EVIDENCE_MAX_FILES = 5;
export const REPORT_EVIDENCE_IMAGE_MAX_MB = 5;
export const REPORT_EVIDENCE_VIDEO_MAX_MB = 10;
export const REPORT_EVIDENCE_VIDEO_MAX_SECONDS = 90;

const BYTES_PER_MB = 1_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES_BY_EXTENSION = new Map([
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
]);
const VIDEO_TYPES = [...VIDEO_TYPES_BY_EXTENSION.values()];
export const REPORT_EVIDENCE_VIDEO_ACCEPT = [...VIDEO_TYPES_BY_EXTENSION.keys(), ...VIDEO_TYPES].join(',');

function normalizeVideoFileType(file: File): File {
  if (file.type && file.type !== 'application/octet-stream') return file;
  const extension = /\.[^.]+$/.exec(file.name.toLowerCase())?.[0];
  const type = VIDEO_TYPES_BY_EXTENSION.get(extension ?? '');
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
}

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const finish = (duration: number | null) => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    // The backend verifies metadata when the browser cannot read the duration.
    const timeout = setTimeout(() => finish(null), 5_000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export async function validateReportEvidenceFiles(files: File[], attachedCount: number, allowVideo: boolean) {
  if (files.length + attachedCount > REPORT_EVIDENCE_MAX_FILES) {
    throw new Error(`Có thể đính kèm tối đa ${REPORT_EVIDENCE_MAX_FILES} tệp bằng chứng.`);
  }
  const acceptedFiles = allowVideo ? files.map(normalizeVideoFileType) : files;
  for (const file of acceptedFiles) {
    const isImage = IMAGE_TYPES.includes(file.type);
    if (!isImage && !(allowVideo && VIDEO_TYPES.includes(file.type))) {
      throw new Error(`Tệp "${file.name}" có định dạng không được hỗ trợ.`);
    }
    const limitMb = isImage ? REPORT_EVIDENCE_IMAGE_MAX_MB : REPORT_EVIDENCE_VIDEO_MAX_MB;
    if (file.size === 0) throw new Error(`Tệp "${file.name}" đang trống.`);
    if (file.size >= limitMb * BYTES_PER_MB) {
      throw new Error(`Tệp "${file.name}" phải có dung lượng dưới ${limitMb} MB.`);
    }
  }
  await Promise.all(acceptedFiles.filter((file) => VIDEO_TYPES.includes(file.type)).map(async (file) => {
    const duration = await readVideoDuration(file);
    if (duration !== null && duration >= REPORT_EVIDENCE_VIDEO_MAX_SECONDS) {
      throw new Error(`Video "${file.name}" phải ngắn hơn ${REPORT_EVIDENCE_VIDEO_MAX_SECONDS} giây.`);
    }
  }));
  return acceptedFiles;
}
