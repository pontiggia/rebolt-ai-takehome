export type AllowedFileType =
  | 'text/csv'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel';

export interface ParsedFileData {
  readonly rows: readonly Record<string, unknown>[];
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly truncated: boolean;
}

export interface FileDataContext {
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly sampleData: readonly Record<string, unknown>[];
}

export const FILE_LIMITS = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  maxRows: 10_000,
  maxColumns: 50,
  sampleSize: 100,
} as const;

export const ALLOWED_FILE_TYPES: readonly AllowedFileType[] = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;
