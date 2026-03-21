import 'server-only';

import { get, put } from '@vercel/blob';
import type { FileRecord } from '@/db/schema';
import { parseFileContents } from '@/services/files';
import type {
  DatasetColumnProfile,
  DatasetColumnType,
  DatasetEnvelope,
  DatasetProfile,
  FileDataContext,
} from '@/types/file';
import { FILE_LIMITS } from '@/types/file';

const DATASET_CACHE_TTL_MS = 5 * 60 * 1000;

type DatasetBackfillFile = Pick<
  FileRecord,
  'id' | 'fileName' | 'fileType' | 'blobUrl' | 'columnNames' | 'rowCount' | 'sampleData'
>;

type DatasetCacheEntry = {
  readonly expiresAt: number;
  readonly value: Promise<{ envelope: DatasetEnvelope; datasetUrl: string }>;
};

const datasetCache = new Map<string, DatasetCacheEntry>();

function getDatasetBlobPath(fileId: string): string {
  return `datasets/${fileId}.json`;
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

function buildDatasetEnvelope(
  file: Pick<DatasetBackfillFile, 'id' | 'fileName' | 'columnNames' | 'rowCount'>,
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

function sanitizeDatasetEnvelope(envelope: DatasetEnvelope): DatasetEnvelope {
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

async function readBlobText(urlOrPathname: string): Promise<{ text: string; url: string } | null> {
  const result = await get(urlOrPathname, { access: 'public' });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  return {
    text: await new Response(result.stream).text(),
    url: result.blob.url,
  };
}

async function uploadDatasetEnvelope(envelope: DatasetEnvelope): Promise<string> {
  const result = await put(getDatasetBlobPath(envelope.fileId), JSON.stringify(envelope), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });

  return result.url;
}

async function buildDatasetFromOriginalBlob(file: DatasetBackfillFile): Promise<DatasetEnvelope> {
  const response = await fetch(file.blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to read uploaded file "${file.fileName}" from blob storage.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const parsed = parseFileContents(buffer, file.fileType);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }

  return buildDatasetEnvelope(file, parsed.value.rows);
}

function getCachedDataset(fileId: string): Promise<{ envelope: DatasetEnvelope; datasetUrl: string }> | null {
  const cached = datasetCache.get(fileId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    datasetCache.delete(fileId);
    return null;
  }

  return cached.value;
}

function setCachedDataset(
  fileId: string,
  value: Promise<{ envelope: DatasetEnvelope; datasetUrl: string }>,
): Promise<{ envelope: DatasetEnvelope; datasetUrl: string }> {
  datasetCache.set(fileId, {
    expiresAt: Date.now() + DATASET_CACHE_TTL_MS,
    value,
  });

  return value;
}

export async function storeDatasetForUpload(
  file: Pick<DatasetBackfillFile, 'id' | 'fileName' | 'columnNames' | 'rowCount'>,
  rows: readonly Record<string, unknown>[],
): Promise<string> {
  const envelope = buildDatasetEnvelope(file, rows);
  const datasetUrl = await uploadDatasetEnvelope(envelope);

  setCachedDataset(file.id, Promise.resolve({ envelope, datasetUrl }));
  return datasetUrl;
}

export async function ensureDatasetForFile(
  file: DatasetBackfillFile,
): Promise<{ envelope: DatasetEnvelope; datasetUrl: string }> {
  const cached = getCachedDataset(file.id);
  if (cached) {
    return cached;
  }

  return setCachedDataset(
    file.id,
    (async () => {
      const existingBlob = await readBlobText(getDatasetBlobPath(file.id));
      if (existingBlob) {
        const parsedEnvelope = JSON.parse(existingBlob.text) as DatasetEnvelope;
        const envelope = sanitizeDatasetEnvelope(parsedEnvelope);
        const datasetUrl =
          envelope.rowCount === parsedEnvelope.rowCount ? existingBlob.url : await uploadDatasetEnvelope(envelope);
        return {
          envelope,
          datasetUrl,
        };
      }

      const envelope = await buildDatasetFromOriginalBlob(file);
      const datasetUrl = await uploadDatasetEnvelope(envelope);

      return { envelope, datasetUrl };
    })(),
  );
}

export async function loadDatasetEnvelope(fileId: string, datasetUrl: string): Promise<DatasetEnvelope> {
  const cached = getCachedDataset(fileId);
  if (cached) {
    const { envelope } = await cached;
    return envelope;
  }

  const datasetPromise = (async () => {
    const blob = await readBlobText(datasetUrl);
    if (!blob) {
      throw new Error('The generated artifact dataset could not be loaded from blob storage.');
    }

    const parsedEnvelope = JSON.parse(blob.text) as DatasetEnvelope;
    const envelope = sanitizeDatasetEnvelope(parsedEnvelope);
    const normalizedDatasetUrl =
      envelope.rowCount === parsedEnvelope.rowCount ? blob.url : await uploadDatasetEnvelope(envelope);

    return {
      envelope,
      datasetUrl: normalizedDatasetUrl,
    };
  })();

  const { envelope } = await setCachedDataset(fileId, datasetPromise);
  return envelope;
}

export async function toFileDataContext(file: DatasetBackfillFile): Promise<FileDataContext> {
  const { envelope, datasetUrl } = await ensureDatasetForFile(file);

  return {
    fileId: file.id,
    fileName: file.fileName,
    columnNames: file.columnNames,
    rowCount: envelope.rowCount,
    sampleData: file.sampleData.slice(0, FILE_LIMITS.sampleSize),
    datasetProfile: envelope.profile,
    datasetUrl,
  };
}
