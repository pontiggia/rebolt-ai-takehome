import type { DatasetColumnProfile, DatasetColumnType, DatasetEnvelope, DatasetProfile } from '@/types/file';

interface DatasetEnvelopeSource {
  readonly id: string;
  readonly fileName: string;
  readonly columnNames: readonly string[];
}

function isMissingValue(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim().length === 0);
}

function normalizeCellValue(value: unknown): unknown {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function stringifyValue(value: unknown): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalized = trimmed.replaceAll(',', '');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', 'false', 'yes', 'no', 'y', 'n', '1', '0'].includes(normalized)) {
    return ['true', 'yes', 'y', '1'].includes(normalized);
  }

  return null;
}

function parseDateValue(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function pickColumnType(
  nonMissingCount: number,
  numberCount: number,
  dateCount: number,
  booleanCount: number,
): DatasetColumnType {
  if (nonMissingCount === 0) {
    return 'unknown';
  }

  if (numberCount / nonMissingCount >= 0.8) {
    return 'number';
  }

  if (dateCount / nonMissingCount >= 0.8) {
    return 'date';
  }

  if (booleanCount / nonMissingCount >= 0.8) {
    return 'boolean';
  }

  return 'string';
}

function buildColumnProfile(name: string, rows: readonly Record<string, unknown>[]): DatasetColumnProfile {
  let missingCount = 0;
  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;
  let numericMin = Number.POSITIVE_INFINITY;
  let numericMax = Number.NEGATIVE_INFINITY;
  let dateMin = Number.POSITIVE_INFINITY;
  let dateMax = Number.NEGATIVE_INFINITY;

  const distinctValues = new Set<string>();
  const sampleValues: string[] = [];
  const topValueCounts = new Map<string, number>();

  for (const row of rows) {
    const rawValue = row[name];
    if (isMissingValue(rawValue)) {
      missingCount += 1;
      continue;
    }

    const stringValue = stringifyValue(rawValue);
    distinctValues.add(stringValue);
    topValueCounts.set(stringValue, (topValueCounts.get(stringValue) ?? 0) + 1);
    if (sampleValues.length < 5 && !sampleValues.includes(stringValue)) {
      sampleValues.push(stringValue);
    }

    const numberValue = parseNumberValue(rawValue);
    if (numberValue !== null) {
      numberCount += 1;
      numericMin = Math.min(numericMin, numberValue);
      numericMax = Math.max(numericMax, numberValue);
    }

    const dateValue = parseDateValue(rawValue);
    if (dateValue !== null) {
      dateCount += 1;
      dateMin = Math.min(dateMin, dateValue);
      dateMax = Math.max(dateMax, dateValue);
    }

    if (parseBooleanValue(rawValue) !== null) {
      booleanCount += 1;
    }
  }

  const nonMissingCount = rows.length - missingCount;
  const inferredType = pickColumnType(nonMissingCount, numberCount, dateCount, booleanCount);

  let invalidCount = 0;
  let min: string | number | null = null;
  let max: string | number | null = null;

  if (inferredType === 'number') {
    invalidCount = nonMissingCount - numberCount;
    min = Number.isFinite(numericMin) ? numericMin : null;
    max = Number.isFinite(numericMax) ? numericMax : null;
  } else if (inferredType === 'date') {
    invalidCount = nonMissingCount - dateCount;
    min = Number.isFinite(dateMin) ? new Date(dateMin).toISOString() : null;
    max = Number.isFinite(dateMax) ? new Date(dateMax).toISOString() : null;
  } else if (inferredType === 'boolean') {
    invalidCount = nonMissingCount - booleanCount;
  }

  const topValues = [...topValueCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([value, count]) => ({ value, count }));

  return {
    name,
    inferredType,
    missingCount,
    invalidCount,
    distinctCount: distinctValues.size,
    sampleValues,
    min,
    max,
    topValues,
  };
}

function buildDatasetProfile(columnNames: readonly string[], rows: readonly Record<string, unknown>[]): DatasetProfile {
  return {
    columns: columnNames.map((columnName) => buildColumnProfile(columnName, rows)),
  };
}

function normalizeRows(
  columnNames: readonly string[],
  rows: readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] {
  return rows.map(
    (row) =>
      Object.fromEntries(columnNames.map((columnName) => [columnName, normalizeCellValue(row[columnName])])) as Record<
        string,
        unknown
      >,
  );
}

function removeEmptyRows(rows: readonly Record<string, unknown>[]): readonly Record<string, unknown>[] {
  return rows.filter((row) => Object.values(row).some((value) => !isMissingValue(value)));
}

export function buildDatasetEnvelope(
  file: DatasetEnvelopeSource,
  rows: readonly Record<string, unknown>[],
): DatasetEnvelope {
  const normalizedRows = removeEmptyRows(normalizeRows(file.columnNames, rows));

  return {
    fileId: file.id,
    fileName: file.fileName,
    columnNames: file.columnNames,
    rowCount: normalizedRows.length,
    rows: normalizedRows,
    profile: buildDatasetProfile(file.columnNames, normalizedRows),
  };
}

export function sanitizeDatasetEnvelope(envelope: DatasetEnvelope): DatasetEnvelope {
  const sanitizedRows = removeEmptyRows(envelope.rows);
  if (sanitizedRows.length === envelope.rows.length) {
    return envelope;
  }

  return {
    ...envelope,
    rowCount: sanitizedRows.length,
    rows: sanitizedRows,
    profile: buildDatasetProfile(envelope.columnNames, sanitizedRows),
  };
}
