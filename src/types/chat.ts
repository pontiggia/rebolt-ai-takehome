import type { AppUIMessage } from '@/types/ai';

export type PersistedChatMessage = AppUIMessage;
export type PersistedChatParts = PersistedChatMessage['parts'];

export const MAX_ARTIFACT_AUTO_RETRIES = 3;
export const ARTIFACT_DATASET_ERROR_MARKER = '[rebolt-dataset]';

export const ARTIFACT_RETRY_SOURCES = [
  'sandpack-runtime',
  'sandpack-notification',
  'sandpack-timeout',
  'artifact-static-validation',
  'tool-output-error',
  'request-error',
] as const;

export type ArtifactRetrySource = (typeof ARTIFACT_RETRY_SOURCES)[number];
export type ArtifactRuntimeStatus = 'idle' | 'validating' | 'retrying' | 'failed' | 'exhausted';

export interface ArtifactRetryPayload {
  readonly assistantMessageId: string;
  readonly artifactToolCallId: string;
  readonly fileId: string | null;
  readonly artifactTitle: string | null;
  readonly artifactDescription: string | null;
  readonly files: Readonly<Record<string, string>> | null;
  readonly error: string;
  readonly source: ArtifactRetrySource;
  readonly attempt: number;
  readonly manual: boolean;
}

export interface ActiveArtifact {
  readonly key: string;
  readonly assistantMessageId: string;
  readonly toolCallId: string;
  readonly fileId: string | null;
  readonly datasetUrl?: string | null;
  readonly usesReboltAI: boolean;
  readonly title: string | null;
  readonly description: string | null;
  readonly files: Readonly<Record<string, string>>;
}

export interface ArtifactRuntimeState {
  readonly status: ArtifactRuntimeStatus;
  readonly retryCount: number;
  readonly lastError: string | null;
  readonly source: ArtifactRetrySource | null;
}

export type ArtifactRuntimeEvent =
  | { readonly type: 'ready' }
  | { readonly type: 'runtime-error'; readonly message: string }
  | { readonly type: 'notification-error'; readonly message: string }
  | { readonly type: 'timeout'; readonly message: string };
