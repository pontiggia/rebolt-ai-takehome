import type { FileError } from '@/types/errors';
import type { Result } from '@/types/result';
import { err, ok } from '@/types/result';
import { ALLOWED_FILE_TYPES, FILE_LIMITS, type AllowedFileType } from '@/types/file';

export function validateUploadableFile(file: Pick<File, 'type' | 'size'>): Result<void, FileError> {
  if (!ALLOWED_FILE_TYPES.includes(file.type as AllowedFileType)) {
    return err({
      type: 'FILE_ERROR',
      message: `Invalid file type: ${file.type}. Allowed: CSV, XLSX.`,
      code: 'INVALID_TYPE',
    });
  }

  if (file.size > FILE_LIMITS.maxSizeBytes) {
    return err({
      type: 'FILE_ERROR',
      message: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB.`,
      code: 'TOO_LARGE',
    });
  }

  return ok(undefined);
}
