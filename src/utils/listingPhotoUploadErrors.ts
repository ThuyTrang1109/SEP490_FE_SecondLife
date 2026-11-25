export interface ListingPhotoUploadIssue {
  previewUrl?: string;
  message: string;
  serviceError?: true;
}

export function getListingPhotoUploadIssues(
  errors: unknown,
  uploadedPreviews: readonly string[],
  status: number,
): ListingPhotoUploadIssue[] {
  if (!Array.isArray(errors)) return [];

  return errors.flatMap<ListingPhotoUploadIssue>((error) => {
    if (typeof error?.field !== 'string') return [];
    const indexedField = /^images\[(\d+)\]$/.exec(error.field);
    if (error.field !== 'images' && !indexedField) return [];

    const message = error.message ?? error.defaultMessage;
    if (typeof message !== 'string' || !message.trim()) return [];

    if (status >= 500) return [{ previewUrl: undefined, message: message.trim(), serviceError: true }];
    const previewUrl = indexedField ? uploadedPreviews[Number(indexedField[1])] : undefined;
    return [{ previewUrl, message: message.trim() }];
  });
}
