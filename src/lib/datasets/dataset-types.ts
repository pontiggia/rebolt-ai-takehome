import type { FileRecord } from '@/db/schema';
import type { DatasetEnvelope } from '@/types/file';

export type DatasetBackfillFile = Pick<
  FileRecord,
  'id' | 'fileName' | 'fileType' | 'blobUrl' | 'columnNames' | 'rowCount' | 'sampleData'
>;

export interface DatasetLoadResult {
  readonly envelope: DatasetEnvelope;
  readonly datasetUrl: string;
}
