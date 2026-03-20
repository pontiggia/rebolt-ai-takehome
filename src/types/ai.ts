export const AI_MODELS = {
  analysis: 'gpt-4.1-mini',
  codegen: 'gpt-5.3-codex',
  title: 'gpt-5.4-nano',
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

export interface AnalysisToolOutput {
  readonly summary: string;
  readonly insights: readonly string[];
  readonly suggestedApproach: string;
}

export interface ArtifactToolOutput {
  readonly title: string;
  readonly files: Readonly<Record<string, string>>;
}

export interface ArtifactToolInput {
  readonly title: string;
  readonly description: string;
}
