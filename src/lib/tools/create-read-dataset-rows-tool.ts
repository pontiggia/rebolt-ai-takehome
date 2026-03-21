import 'server-only';

import { tool } from 'ai';
import { z } from 'zod/v4';
import { loadDatasetEnvelope } from '@/services/datasets';
import type { FileDataContext } from '@/types/file';
import { computeMaxReadableRows, pickSelectedColumns } from '@/lib/tools/dataset-selection';

export function createReadDatasetRowsTool(fileData: FileDataContext | null) {
  return tool({
    description:
      'Read exact rows from the FULL uploaded dataset. Use this when you need exact row values before generating an artifact, especially for small datasets or targeted slices.',
    inputSchema: z.object({
      offset: z.number().int().min(0).default(0).describe('Zero-based row offset'),
      limit: z.number().int().min(1).max(500).default(50).describe('How many rows to read'),
      columns: z.array(z.string()).optional().describe('Optional subset of columns to return'),
    }),
    execute: async ({ offset, limit, columns }) => {
      if (!fileData) {
        return {
          rows: [],
          totalRows: 0,
          offset: 0,
          count: 0,
          hasMore: false,
          columns: [],
        };
      }

      const envelope = await loadDatasetEnvelope(fileData.fileId, fileData.datasetUrl);
      const selectedColumns = pickSelectedColumns(fileData, columns ?? []);
      const maxReadableRows = computeMaxReadableRows(envelope.rowCount, selectedColumns.length);
      const safeOffset = Math.max(0, offset);
      const safeLimit = Math.max(1, Math.min(limit, maxReadableRows));
      const rows = envelope.rows
        .slice(safeOffset, safeOffset + safeLimit)
        .map((row) => Object.fromEntries(selectedColumns.map((column) => [column, row[column]])));

      return {
        rows,
        totalRows: envelope.rowCount,
        offset: safeOffset,
        count: rows.length,
        hasMore: safeOffset + rows.length < envelope.rowCount,
        columns: selectedColumns,
      };
    },
  });
}
