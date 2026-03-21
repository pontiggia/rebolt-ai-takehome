import 'server-only';

import { getCachedDataset, setCachedDataset } from '@/lib/datasets/dataset-cache';
import { buildDatasetEnvelope } from '@/lib/datasets/dataset-envelope';
import {
  buildDatasetFromOriginalBlob,
  getDatasetBlobPath,
  readStoredDatasetEnvelope,
  uploadDatasetEnvelope,
} from '@/lib/datasets/dataset-storage';
import type { DatasetBackfillFile } from '@/lib/datasets/dataset-types';
import type { DatasetEnvelope, FileDataContext } from '@/types/file';
import { FILE_LIMITS } from '@/types/file';

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
      const existingDataset = await readStoredDatasetEnvelope(getDatasetBlobPath(file.id));
      if (existingDataset) {
        return existingDataset;
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
    const storedDataset = await readStoredDatasetEnvelope(datasetUrl);
    if (!storedDataset) {
      throw new Error('The generated artifact dataset could not be loaded from blob storage.');
    }

    return storedDataset;
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
