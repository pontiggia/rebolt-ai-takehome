import {
  ARTIFACT_EXPORT_DEV_DEPENDENCIES,
  ARTIFACT_RUNTIME_DEPENDENCIES,
  ARTIFACT_TAILWIND_CDN_URL,
} from '@/lib/artifact-runtime';
import { DATASET_HELPER_PATH } from '@/lib/tools/constants';
import type { ActiveArtifact } from '@/types/chat';

const LOCAL_DATASET_PUBLIC_PATH = '/rebolt-dataset.json';
const DATASET_URL_PATTERN = /const DATASET_URL = ("(?:[^"\\]|\\.)*");/;

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

function getArtifactTitle(title: string | null | undefined): string {
  const normalizedTitle = title?.trim();
  return normalizedTitle && normalizedTitle.length > 0 ? normalizedTitle : 'Rebolt Artifact';
}

function slugifyArtifactTitle(title: string | null | undefined): string {
  const base = getArtifactTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return base.length > 0 ? base : 'rebolt-artifact';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getProjectName(title: string | null | undefined): string {
  const slug = slugifyArtifactTitle(title);
  return (slug === 'rebolt-artifact' ? slug : `rebolt-artifact-${slug}`).slice(0, 80);
}

function getArchiveFileName(title: string | null | undefined): string {
  return `${slugifyArtifactTitle(title)}-source.zip`;
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

function replaceDatasetUrlInHelper(helperSource: string): string {
  if (!DATASET_URL_PATTERN.test(helperSource)) {
    throw new Error('The artifact dataset helper is missing its dataset URL.');
  }

  return helperSource.replace(DATASET_URL_PATTERN, `const DATASET_URL = ${JSON.stringify(LOCAL_DATASET_PUBLIC_PATH)};`);
}

async function fetchDatasetEnvelope(datasetUrl: string): Promise<string> {
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

function buildMainFile(): string {
  return `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found.');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
}

function buildIndexHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <script src="${ARTIFACT_TAILWIND_CDN_URL}"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function buildPackageJson(title: string | null | undefined): string {
  return `${JSON.stringify(
    {
      name: getProjectName(title),
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc --noEmit && vite build',
        preview: 'vite preview',
      },
      dependencies: ARTIFACT_RUNTIME_DEPENDENCIES,
      devDependencies: ARTIFACT_EXPORT_DEV_DEPENDENCIES,
    },
    null,
    2,
  )}\n`;
}

function buildTsConfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src"]
}
`;
}

function buildViteConfig(): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
}

function buildReadme(title: string, includesDataset: boolean): string {
  const datasetLine = includesDataset
    ? 'This export includes the full normalized dataset at `public/rebolt-dataset.json`.\n\n'
    : '';

  return `# ${title}

Exported from the Rebolt artifact panel.

${datasetLine}## Run locally

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`;
}

async function buildExportFiles(artifact: ActiveArtifact): Promise<Record<string, string>> {
  const sourceFiles: Record<string, string> = {
    ...artifact.files,
    '/src/main.tsx': buildMainFile(),
  };

  const helperSource = artifact.files[DATASET_HELPER_PATH];
  const datasetUrl =
    artifact.datasetUrl && artifact.datasetUrl.trim().length > 0
      ? artifact.datasetUrl
      : extractDatasetUrlFromHelper(helperSource);

  if (datasetUrl) {
    if (!helperSource) {
      throw new Error('This artifact is missing its dataset helper, so the full dataset cannot be exported.');
    }

    sourceFiles[DATASET_HELPER_PATH] = replaceDatasetUrlInHelper(helperSource);
    sourceFiles['/public/rebolt-dataset.json'] = await fetchDatasetEnvelope(datasetUrl);
  }

  return {
    ...sourceFiles,
    '/index.html': buildIndexHtml(getArtifactTitle(artifact.title)),
    '/package.json': buildPackageJson(artifact.title),
    '/tsconfig.json': buildTsConfig(),
    '/vite.config.ts': buildViteConfig(),
    '/README.md': buildReadme(getArtifactTitle(artifact.title), Boolean(datasetUrl)),
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
