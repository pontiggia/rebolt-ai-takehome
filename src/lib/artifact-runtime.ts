export const ARTIFACT_RUNTIME_DEPENDENCIES = {
  react: '19.2.4',
  'react-dom': '19.2.4',
  recharts: '3.8.0',
  'lucide-react': '0.577.0',
  'react-is': '17.0.2',
} as const;

export const ARTIFACT_CODEGEN_PACKAGES = ['react', 'react-dom', 'recharts', 'lucide-react'] as const;

export const ARTIFACT_RUNTIME_VERSION_SUMMARY = [
  `react@${ARTIFACT_RUNTIME_DEPENDENCIES.react}`,
  `react-dom@${ARTIFACT_RUNTIME_DEPENDENCIES['react-dom']}`,
  `recharts@${ARTIFACT_RUNTIME_DEPENDENCIES.recharts}`,
  `lucide-react@${ARTIFACT_RUNTIME_DEPENDENCIES['lucide-react']}`,
].join(', ');

export const ARTIFACT_SANDBOX_SETUP = {
  dependencies: ARTIFACT_RUNTIME_DEPENDENCIES,
} as const;
