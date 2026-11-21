export interface ListingPhotoUploadIssue {
  previewUrl?: string;
  message: string;
}

export function getListingPhotoUploadIssues(
  errors: unknown,
  uploadedPreviews: readonly string[],
  status: number,
): ListingPhotoUploadIssue[] {
  if (!Array.isArray(errors)) return [];

  return errors.flatMap((error) => {
    if (typeof error?.field !== 'string') return [];
    const indexedField = /^images\[(\d+)\]$/.exec(error.field);
    if (error.field !== 'images' && !indexedField) return [];

    const message = error.message ?? error.defaultMessage;
    if (typeof message !== 'string' || !message.trim()) return [];

    // A server-side processing failure does not mean the photo is invalid.
    const previewUrl = indexedField && status < 500 ? uploadedPreviews[Number(indexedField[1])] : undefined;
    return [{ previewUrl, message: message.trim() }];
  });
}
