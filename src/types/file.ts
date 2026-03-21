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

export type DatasetColumnType = 'number' | 'date' | 'boolean' | 'string' | 'unknown';

export interface DatasetTopValue {
  readonly value: string;
  readonly count: number;
}

export interface DatasetColumnProfile {
  readonly name: string;
  readonly inferredType: DatasetColumnType;
  readonly missingCount: number;
  readonly invalidCount: number;
  readonly distinctCount: number;
  readonly sampleValues: readonly string[];
  readonly min: string | number | null;
  readonly max: string | number | null;
  readonly topValues: readonly DatasetTopValue[];
}

export interface DatasetProfile {
  readonly columns: readonly DatasetColumnProfile[];
}

export interface DatasetEnvelope {
  readonly fileId: string;
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly rows: readonly Record<string, unknown>[];
  readonly profile: DatasetProfile;
}

export interface FileDataContext {
  readonly fileId: string;
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly sampleData: readonly Record<string, unknown>[];
  readonly datasetProfile: DatasetProfile;
  readonly datasetUrl: string;
}

export const FILE_LIMITS = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  maxRows: 10_000,
  maxColumns: 150,
  sampleSize: 20,
} as const;

export const ALLOWED_FILE_TYPES: readonly AllowedFileType[] = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;
