import 'server-only';

import type { FileDataContext } from '@/types/file';
import { createAnalyzeDataTool } from '@/lib/tools/create-analyze-data-tool';
import { createGenerateArtifactTool } from '@/lib/tools/create-generate-artifact-tool';
import { createReadDatasetRowsTool } from '@/lib/tools/create-read-dataset-rows-tool';

export function createChatTools(fileData: FileDataContext | null) {
  return {
    analyzeData: createAnalyzeDataTool(fileData),
    readDatasetRows: createReadDatasetRowsTool(fileData),
    generateArtifact: createGenerateArtifactTool(fileData),
  };
}
