export const AI_MODELS = {
  analysis: 'gpt-4.1',
  codegen: 'gpt-5.4-mini',
  title: 'gpt-5.4-nano',
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

export interface AnalysisToolOutput {
  readonly summary: string;
  readonly insights: readonly string[];
  readonly suggestedApproach: string;
  readonly sampleValues: readonly Record<string, unknown>[];
}

export interface ArtifactToolOutput {
  readonly title: string;
  readonly fileId: string | null;
  readonly files: Readonly<Record<string, string>>;
}

export interface ArtifactToolInput {
  readonly title: string;
  readonly description: string;
}
