import 'server-only';

import { tool } from 'ai';
import { z } from 'zod/v4';
import { getActivityReporter, getToolInternalActivityId } from '@/lib/agent-activity';
import { loadDatasetEnvelope } from '@/services/datasets';
import type { ReadDatasetRowsToolInput } from '@/types/ai';
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
    execute: async ({ offset, limit, columns }: ReadDatasetRowsToolInput, { toolCallId, experimental_context }) => {
      const reportActivity = getActivityReporter(experimental_context);
      const internalActivityId = getToolInternalActivityId(toolCallId);

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

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Loading dataset',
          detail: `Rows ${offset + 1}-${offset + limit}`,
          toolName: 'readDatasetRows',
          toolCallId,
        },
      });

      const envelope = await loadDatasetEnvelope(fileData.fileId, fileData.datasetUrl);
      const selectedColumns = pickSelectedColumns(fileData, columns ?? []);
      const maxReadableRows = computeMaxReadableRows(envelope.rowCount, selectedColumns.length);
      const safeOffset = Math.max(0, offset);
      const safeLimit = Math.max(1, Math.min(limit, maxReadableRows));

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Reading rows',
          detail: selectedColumns.join(', '),
          toolName: 'readDatasetRows',
          toolCallId,
        },
      });

      const rows = envelope.rows
        .slice(safeOffset, safeOffset + safeLimit)
        .map((row) => Object.fromEntries(selectedColumns.map((column) => [column, row[column]])));

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'completed',
          label: 'Rows loaded',
          detail: `${rows.length} row${rows.length === 1 ? '' : 's'}`,
          toolName: 'readDatasetRows',
          toolCallId,
        },
      });

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
