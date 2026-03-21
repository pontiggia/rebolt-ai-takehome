import 'server-only';

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Result } from '@/types/result';
import type { FileError } from '@/types/errors';
import type { ParsedFileData, AllowedFileType } from '@/types/file';
import { ok, err } from '@/types/result';
import { FILE_LIMITS, ALLOWED_FILE_TYPES } from '@/types/file';

function hasMeaningfulCellValue(value: unknown): boolean {
  if (value == null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

function removeEmptyRows(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter((row) => Object.values(row).some((value) => hasMeaningfulCellValue(value)));
}

export function validateFile(file: File): Result<void, FileError> {
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

export function parseFileContents(buffer: Buffer, fileType: string): Result<ParsedFileData, FileError> {
  try {
    let rows: Record<string, unknown>[];

    if (fileType === 'text/csv') {
      const parsed = Papa.parse(buffer.toString(), { header: true, skipEmptyLines: 'greedy' });
      rows = removeEmptyRows(parsed.data as Record<string, unknown>[]);
    } else {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = removeEmptyRows(XLSX.utils.sheet_to_json(sheet));
    }

    const columnNames = Object.keys(rows[0] ?? {});

    if (columnNames.length > FILE_LIMITS.maxColumns) {
      return err({
        type: 'FILE_ERROR',
        message: `Too many columns: ${columnNames.length}. Max: ${FILE_LIMITS.maxColumns}.`,
        code: 'TOO_MANY_COLUMNS',
      });
    }

    return ok({ rows, columnNames, rowCount: rows.length, truncated: false });
  } catch {
    return err({
      type: 'FILE_ERROR',
      message: 'Failed to parse file. Ensure it is a valid CSV or XLSX.',
      code: 'PARSE_FAILED',
    });
  }
}
