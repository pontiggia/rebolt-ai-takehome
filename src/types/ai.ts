/** Model routing — each task uses the optimal model for cost/quality. */
export const AI_MODELS = {
  /** Analysis + tool routing: cheap, fast, good at reasoning about data. */
  analysis: 'gpt-4.1-mini',
  /** Artifact code generation: best at producing correct TypeScript/React. */
  codegen: 'gpt-5.3-codex',
  /** Title generation: cheapest model, simple structured output. */
  title: 'gpt-5.4-nano',
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

/** Output shape of the analyzeData tool. */
export interface AnalysisToolOutput {
  readonly summary: string;
  readonly insights: readonly string[];
  readonly suggestedApproach: string;
}

/** Output shape of the generateArtifact tool. */
export interface ArtifactToolOutput {
  readonly title: string;
  readonly code: string;
}

/** Zod input schema for the generateArtifact tool (mirrored as TS type). */
export interface ArtifactToolInput {
  readonly title: string;
  readonly description: string;
}
