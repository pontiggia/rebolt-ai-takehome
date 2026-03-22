import { buildArtifactScaffold } from '@/lib/artifact/artifact-export-scaffold';
import {
  fetchDatasetEnvelope,
  getArchiveFileName,
  getArtifactTitle,
  replaceDatasetUrlInHelper,
  resolveArtifactDatasetUrl,
  slugifyArtifactTitle,
  stripLeadingSlash,
} from '@/lib/artifact/artifact-export-utils';
import { DATASET_HELPER_PATH, REBOLT_OPENAI_PROXY_PATH } from '@/lib/tools/constants';
import { buildReboltOpenAIProxyExportStub } from '@/lib/tools/rebolt-openai-proxy-runtime-helper';
import type { ActiveArtifact } from '@/types/chat';

async function buildExportFiles(artifact: ActiveArtifact): Promise<Record<string, string>> {
  const artifactTitle = getArtifactTitle(artifact.title);
  const artifactTitleSlug = slugifyArtifactTitle(artifact.title);
  const sourceFiles: Record<string, string> = {
    ...artifact.files,
  };

  const helperSource = artifact.files[DATASET_HELPER_PATH];
  const datasetUrl = resolveArtifactDatasetUrl(artifact, helperSource);

  if (datasetUrl) {
    if (!helperSource) {
      throw new Error('This artifact is missing its dataset helper, so the full dataset cannot be exported.');
    }

    sourceFiles[DATASET_HELPER_PATH] = replaceDatasetUrlInHelper(helperSource);
    sourceFiles['/public/rebolt-dataset.json'] = await fetchDatasetEnvelope(datasetUrl);
  }

  if (sourceFiles[REBOLT_OPENAI_PROXY_PATH]) {
    sourceFiles[REBOLT_OPENAI_PROXY_PATH] = buildReboltOpenAIProxyExportStub();
  }

  return {
    ...sourceFiles,
    ...buildArtifactScaffold({
      title: artifactTitle,
      titleSlug: artifactTitleSlug,
      includesDataset: Boolean(datasetUrl),
      includesOpenAIProxy: Boolean(sourceFiles[REBOLT_OPENAI_PROXY_PATH]),
    }),
  };
}

export async function createArtifactArchive(artifact: ActiveArtifact): Promise<{ blob: Blob; fileName: string }> {
  const { default: JSZip } = await import('jszip');
  const exportFiles = await buildExportFiles(artifact);
  const zip = new JSZip();

  for (const [path, content] of Object.entries(exportFiles).sort(([left], [right]) => left.localeCompare(right))) {
    zip.file(stripLeadingSlash(path), content);
  }

  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    fileName: getArchiveFileName(artifact.title),
  };
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 0);
}
