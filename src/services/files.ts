import 'server-only';

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { FileRecord } from '@/db/schema';
import type { FilePreviewResponse } from '@/types/api';
import type { Result } from '@/types/result';
import type { FileError } from '@/types/errors';
import type { ParsedFileData, AllowedFileType } from '@/types/file';
import { ok, err } from '@/types/result';
import { FILE_LIMITS, ALLOWED_FILE_TYPES } from '@/types/file';

const FILE_PREVIEW_MAX_LINES = 160;
const FILE_PREVIEW_MAX_BYTES = 24 * 1024;
const CSV_PREVIEW_NOTE = 'Formatting may be inconsistent from source.';
const SPREADSHEET_PREVIEW_NOTE = 'Preview generated from the first worksheet; formatting may differ from source.';

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function splitIntoLineSegments(text: string): string[] {
  if (!text.length) {
    return [];
  }

  const segments: string[] = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '\r') {
      const end = text[index + 1] === '\n' ? index + 2 : index + 1;
      segments.push(text.slice(start, end));
      start = end;

      if (end === index + 2) {
        index += 1;
      }
      continue;
    }

    if (char === '\n') {
      const end = index + 1;
      segments.push(text.slice(start, end));
      start = end;
    }
  }

  if (start < text.length) {
    segments.push(text.slice(start));
  }

  return segments;
}

function sliceUtf8(text: string, maxBytes: number): string {
  return Buffer.from(text).subarray(0, maxBytes).toString('utf8');
}

function buildPreviewExcerpt(text: string): {
  previewText: string;
  truncated: boolean;
  lineCount: number;
} {
  if (!text.length) {
    return {
      previewText: '',
      truncated: false,
      lineCount: 0,
    };
  }

  const lineSegments = splitIntoLineSegments(text);
  const lineCount = lineSegments.length || 1;
  let previewText = '';
  let visibleLines = 0;
  let visibleBytes = 0;

  for (const segment of lineSegments) {
    if (visibleLines >= FILE_PREVIEW_MAX_LINES) {
      return {
        previewText,
        truncated: true,
        lineCount,
      };
    }

    const segmentBytes = Buffer.byteLength(segment, 'utf8');
    if (visibleBytes + segmentBytes > FILE_PREVIEW_MAX_BYTES) {
      return {
        previewText: previewText.length > 0 ? previewText : sliceUtf8(segment, FILE_PREVIEW_MAX_BYTES),
        truncated: true,
        lineCount,
      };
    }

    previewText += segment;
    visibleBytes += segmentBytes;
    visibleLines += 1;
  }

  return {
    previewText,
    truncated: false,
    lineCount,
  };
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

async function fetchUploadedFile(file: Pick<FileRecord, 'blobUrl' | 'fileName'>): Promise<Response> {
  const response = await fetch(file.blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to load "${file.fileName}" for preview.`);
  }

  return response;
}

function getSpreadsheetPreviewText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;

  if (!sheet) {
    return '';
  }

  return XLSX.utils.sheet_to_csv(sheet);
}

export async function buildFilePreview(
  file: Pick<FileRecord, 'id' | 'fileName' | 'fileType' | 'fileSize' | 'blobUrl' | 'rowCount'>,
): Promise<FilePreviewResponse> {
  const uploadedFile = await fetchUploadedFile(file);

  if (file.fileType === 'text/csv') {
    const rawText = await uploadedFile.text();
    const excerpt = buildPreviewExcerpt(rawText);

    return {
      fileId: file.id,
      fileName: file.fileName,
      summaryLabel: `${formatFileSize(file.fileSize)} • ${formatCount(excerpt.lineCount, 'line', 'lines')}`,
      note: CSV_PREVIEW_NOTE,
      previewText: excerpt.previewText,
      truncated: excerpt.truncated,
    };
  }

  const buffer = Buffer.from(await uploadedFile.arrayBuffer());
  const previewText = getSpreadsheetPreviewText(buffer);
  const excerpt = buildPreviewExcerpt(previewText);

  return {
    fileId: file.id,
    fileName: file.fileName,
    summaryLabel: `${formatFileSize(file.fileSize)} • ${formatCount(file.rowCount, 'row', 'rows')}`,
    note: SPREADSHEET_PREVIEW_NOTE,
    previewText: excerpt.previewText,
    truncated: excerpt.truncated,
  };
}
