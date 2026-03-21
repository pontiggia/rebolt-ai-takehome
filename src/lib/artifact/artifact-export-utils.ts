import type { ActiveArtifact } from '@/types/chat';

const LOCAL_DATASET_PUBLIC_PATH = '/rebolt-dataset.json';
const DATASET_URL_PATTERN = /const DATASET_URL = ("(?:[^"\\]|\\.)*");/;

export function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

export function getArtifactTitle(title: string | null | undefined): string {
  const normalizedTitle = title?.trim();
  return normalizedTitle && normalizedTitle.length > 0 ? normalizedTitle : 'Rebolt Artifact';
}

export function slugifyArtifactTitle(title: string | null | undefined): string {
  const base = getArtifactTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return base.length > 0 ? base : 'rebolt-artifact';
}

export function getArchiveFileName(title: string | null | undefined): string {
  return `${slugifyArtifactTitle(title)}-source.zip`;
}

export function resolveArtifactDatasetUrl(artifact: ActiveArtifact, helperSource: string | undefined): string | null {
  if (artifact.datasetUrl && artifact.datasetUrl.trim().length > 0) {
    return artifact.datasetUrl;
  }

  return extractDatasetUrlFromHelper(helperSource);
}

function extractDatasetUrlFromHelper(helperSource: string | undefined): string | null {
  if (!helperSource) {
    return null;
  }

  const match = helperSource.match(DATASET_URL_PATTERN);
  if (!match) {
    return null;
  }

  try {
    const datasetUrl = JSON.parse(match[1]) as unknown;
    return typeof datasetUrl === 'string' && datasetUrl.trim().length > 0 ? datasetUrl : null;
  } catch {
    return null;
  }
}

export function replaceDatasetUrlInHelper(helperSource: string): string {
  if (!DATASET_URL_PATTERN.test(helperSource)) {
    throw new Error('The artifact dataset helper is missing its dataset URL.');
  }

  return helperSource.replace(DATASET_URL_PATTERN, `const DATASET_URL = ${JSON.stringify(LOCAL_DATASET_PUBLIC_PATH)};`);
}

export async function fetchDatasetEnvelope(datasetUrl: string): Promise<string> {
  const response = await fetch(datasetUrl);
  if (!response.ok) {
    throw new Error(`Failed to download the artifact dataset (${response.status} ${response.statusText}).`);
  }

  const text = await response.text();

  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    throw new Error('The downloaded artifact dataset was not valid JSON.');
  }
}
