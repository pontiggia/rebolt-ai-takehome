import 'server-only';

import { get, put } from '@vercel/blob';
import { buildDatasetEnvelope, sanitizeDatasetEnvelope } from '@/lib/datasets/dataset-envelope';
import type { DatasetBackfillFile, DatasetLoadResult } from '@/lib/datasets/dataset-types';
import { parseFileContents } from '@/services/files';
import type { DatasetEnvelope } from '@/types/file';

export function getDatasetBlobPath(fileId: string): string {
  return `datasets/${fileId}.json`;
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

export async function uploadDatasetEnvelope(envelope: DatasetEnvelope): Promise<string> {
  const result = await put(getDatasetBlobPath(envelope.fileId), JSON.stringify(envelope), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });

  return result.url;
}

export async function readStoredDatasetEnvelope(urlOrPathname: string): Promise<DatasetLoadResult | null> {
  const blob = await readBlobText(urlOrPathname);
  if (!blob) {
    return null;
  }

  const parsedEnvelope = JSON.parse(blob.text) as DatasetEnvelope;
  const envelope = sanitizeDatasetEnvelope(parsedEnvelope);
  const datasetUrl = envelope.rowCount === parsedEnvelope.rowCount ? blob.url : await uploadDatasetEnvelope(envelope);

  return {
    envelope,
    datasetUrl,
  };
}

export async function buildDatasetFromOriginalBlob(file: DatasetBackfillFile): Promise<DatasetEnvelope> {
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
