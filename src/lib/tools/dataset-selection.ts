import type { FileDataContext } from '@/types/file';
import {
  FULL_READ_CELL_BUDGET,
  LARGE_DATASET_ROW_SLICE_LIMIT,
  SMALL_DATASET_FULL_READ_LIMIT,
} from '@/lib/tools/constants';

export function pickSelectedColumns(fileData: FileDataContext, requestedColumns: readonly string[]): readonly string[] {
  const validColumns = requestedColumns.filter((column) => fileData.columnNames.includes(column));
  return validColumns.length > 0 ? validColumns : fileData.columnNames;
}

export function computeMaxReadableRows(totalRows: number, columnCount: number): number {
  if (totalRows <= SMALL_DATASET_FULL_READ_LIMIT && totalRows * Math.max(1, columnCount) <= FULL_READ_CELL_BUDGET) {
    return totalRows;
  }

  return LARGE_DATASET_ROW_SLICE_LIMIT;
}
