import {
  ARTIFACT_EXPORT_DEV_DEPENDENCIES,
  ARTIFACT_RUNTIME_DEPENDENCIES,
  ARTIFACT_TAILWIND_CDN_URL,
} from '@/lib/artifact-runtime';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getProjectName(titleSlug: string): string {
  return (titleSlug === 'rebolt-artifact' ? titleSlug : `rebolt-artifact-${titleSlug}`).slice(0, 80);
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

function buildPackageJson(titleSlug: string): string {
  return `${JSON.stringify(
    {
      name: getProjectName(titleSlug),
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

function buildReadme(
  title: string,
  includesDataset: boolean,
  includesOpenAIProxy: boolean,
): string {
  const datasetLine = includesDataset
    ? 'This export includes the full normalized dataset at `public/rebolt-dataset.json`.\n\n'
    : '';
  const openAIProxyLine = includesOpenAIProxy
    ? 'This export includes a stubbed `src/rebolt-openai-proxy.ts` runtime shim. OpenAI auth is only injected inside the Rebolt app, so replace that shim with your own backend or key-management layer if you want live Responses API calls outside Rebolt.\n\n'
    : '';

  return `# ${title}

Exported from the Rebolt artifact panel.

${datasetLine}${openAIProxyLine}## Run locally

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`;
}

interface BuildArtifactScaffoldOptions {
  readonly title: string;
  readonly titleSlug: string;
  readonly includesDataset: boolean;
  readonly includesOpenAIProxy: boolean;
}

export function buildArtifactScaffold({
  title,
  titleSlug,
  includesDataset,
  includesOpenAIProxy,
}: BuildArtifactScaffoldOptions): Record<string, string> {
  return {
    '/src/main.tsx': buildMainFile(),
    '/index.html': buildIndexHtml(title),
    '/package.json': buildPackageJson(titleSlug),
    '/tsconfig.json': buildTsConfig(),
    '/vite.config.ts': buildViteConfig(),
    '/README.md': buildReadme(title, includesDataset, includesOpenAIProxy),
  };
}
