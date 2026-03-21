import { ARTIFACT_DATASET_ERROR_MARKER } from '@/types/chat';
import type { FileDataContext } from '@/types/file';
import { DATASET_HELPER_PATH } from '@/lib/tools/constants';

function buildDatasetRuntimeHelper(fileData: FileDataContext): string {
  return `import { useEffect, useState } from "react";

export interface DatasetTopValue {
  value: string;
  count: number;
}

export interface DatasetColumnProfile {
  name: string;
  inferredType: "number" | "date" | "boolean" | "string" | "unknown";
  missingCount: number;
  invalidCount: number;
  distinctCount: number;
  sampleValues: string[];
  min: string | number | null;
  max: string | number | null;
  topValues: DatasetTopValue[];
}

export interface DatasetEnvelope {
  fileId: string;
  fileName: string;
  columnNames: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
  profile: {
    columns: DatasetColumnProfile[];
  };
}

const DATASET_URL = ${JSON.stringify(fileData.datasetUrl)};
const ERROR_PREFIX = ${JSON.stringify(ARTIFACT_DATASET_ERROR_MARKER)};

let datasetPromise: Promise<DatasetEnvelope> | null = null;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim().length > 0 ? text : response.statusText;
  } catch {
    return response.statusText || "Unknown dataset fetch error";
  }
}

async function fetchDataset(): Promise<DatasetEnvelope> {
  const response = await fetch(DATASET_URL);
  if (!response.ok) {
    throw new Error(\`\${ERROR_PREFIX} \${await readErrorMessage(response)}\`);
  }

  return response.json() as Promise<DatasetEnvelope>;
}

export function loadDataset(): Promise<DatasetEnvelope> {
  if (!datasetPromise) {
    datasetPromise = fetchDataset();
  }

  return datasetPromise;
}

export function useDataset(): {
  dataset: DatasetEnvelope | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
} {
  const [dataset, setDataset] = useState<DatasetEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    loadDataset()
      .then((nextDataset) => {
        if (cancelled) {
          return;
        }

        setDataset(nextDataset);
        setError(null);
        setIsLoading(false);
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return;
        }

        setDataset(null);
        setError(nextError instanceof Error ? nextError : new Error(\`\${ERROR_PREFIX} Failed to load dataset.\`));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    dataset,
    isLoading,
    error,
    reload: async () => {
      datasetPromise = fetchDataset();
      const nextDataset = await datasetPromise;
      setDataset(nextDataset);
      setError(null);
      setIsLoading(false);
    },
  };
}
`;
}

export function injectDatasetRuntimeHelper(
  files: Record<string, string>,
  fileData: FileDataContext | null,
): Record<string, string> {
  if (!fileData) {
    return files;
  }

  return {
    ...files,
    [DATASET_HELPER_PATH]: buildDatasetRuntimeHelper(fileData),
  };
}
