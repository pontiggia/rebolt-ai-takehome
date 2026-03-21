import 'server-only';

import type { DatasetLoadResult } from '@/lib/datasets/dataset-types';

const DATASET_CACHE_TTL_MS = 5 * 60 * 1000;

type DatasetCacheEntry = {
  readonly expiresAt: number;
  readonly value: Promise<DatasetLoadResult>;
};

const datasetCache = new Map<string, DatasetCacheEntry>();

export function getCachedDataset(fileId: string): Promise<DatasetLoadResult> | null {
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

export function setCachedDataset(fileId: string, value: Promise<DatasetLoadResult>): Promise<DatasetLoadResult> {
  datasetCache.set(fileId, {
    expiresAt: Date.now() + DATASET_CACHE_TTL_MS,
    value,
  });

  return value;
}
