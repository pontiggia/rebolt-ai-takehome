import type { DataUIPart, UIMessage } from 'ai';

export const AI_MODELS = {
  analysis: 'gpt-4.1',
  codegen: 'gpt-5.4-mini',
  title: 'gpt-5.4-nano',
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

export interface AnalyzeDataToolInput {
  readonly task: string;
  readonly columns: readonly string[];
}

export interface AnalysisToolOutput {
  readonly summary: string;
  readonly insights: readonly string[];
  readonly suggestedApproach: string;
  readonly sampleValues: readonly Record<string, unknown>[];
}

export interface ReadDatasetRowsToolInput {
  readonly offset: number;
  readonly limit: number;
  readonly columns?: readonly string[];
}

export interface ReadDatasetRowsToolOutput {
  readonly rows: readonly Record<string, unknown>[];
  readonly totalRows: number;
  readonly offset: number;
  readonly count: number;
  readonly hasMore: boolean;
  readonly columns: readonly string[];
}

export interface ArtifactToolInput {
  readonly title: string;
  readonly description: string;
}

export interface ArtifactToolOutput {
  readonly title: string;
  readonly fileId: string | null;
  readonly files: Readonly<Record<string, string>>;
}

export type AppToolName = 'analyzeData' | 'readDatasetRows' | 'generateArtifact';
export type AgentActivityKind = 'step' | 'tool' | 'tool-internal';
export type AgentActivityStatus = 'running' | 'completed' | 'error';

export interface AgentActivityData {
  readonly kind: AgentActivityKind;
  readonly status: AgentActivityStatus;
  readonly label: string;
  readonly detail?: string;
  readonly stepNumber?: number;
  readonly toolName?: AppToolName;
  readonly toolCallId?: string;
}

export type AppUIDataParts = Record<'agent-activity', AgentActivityData>;

export type AppUITools = {
  analyzeData: {
    readonly input: AnalyzeDataToolInput;
    readonly output: AnalysisToolOutput;
  };
  readDatasetRows: {
    readonly input: ReadDatasetRowsToolInput;
    readonly output: ReadDatasetRowsToolOutput;
  };
  generateArtifact: {
    readonly input: ArtifactToolInput;
    readonly output: ArtifactToolOutput;
  };
};

export type AppUIMessage = UIMessage<unknown, AppUIDataParts, AppUITools>;
export type AppUIMessagePart = AppUIMessage['parts'][number];
export type AgentActivityDataPart = Extract<AppUIMessagePart, { type: 'data-agent-activity' }>;
export type AnalyzeDataToolInvocation = Extract<AppUIMessagePart, { type: 'tool-analyzeData' }>;
export type ReadDatasetRowsToolInvocation = Extract<AppUIMessagePart, { type: 'tool-readDatasetRows' }>;
export type GenerateArtifactToolInvocation = Extract<AppUIMessagePart, { type: 'tool-generateArtifact' }>;
export type AppToolInvocation =
  | AnalyzeDataToolInvocation
  | ReadDatasetRowsToolInvocation
  | GenerateArtifactToolInvocation;

export interface AgentActivityReportEvent {
  readonly id: string;
  readonly activity: AgentActivityData;
  readonly transient?: boolean;
}

export type AgentActivityReporter = (event: AgentActivityReportEvent) => void;

export interface AppAIExecutionContext {
  readonly reportActivity?: AgentActivityReporter;
}

export type AgentActivityDataChunk = DataUIPart<AppUIDataParts> & {
  readonly transient?: boolean;
};
