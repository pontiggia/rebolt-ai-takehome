import type { ChatOnFinishCallback } from 'ai';
import {
  isArtifactStaticValidationError,
  stripArtifactStaticValidationError,
} from '@/lib/tools/artifact-static-validator';
import type { AppUIMessage } from '@/types/ai';
import type {
  ActiveArtifact,
  ArtifactRetryPayload,
  ArtifactRetrySource,
  ArtifactRuntimeEvent,
  ArtifactRuntimeState,
} from '@/types/chat';
import { ARTIFACT_DATASET_ERROR_MARKER } from '@/types/chat';

export const IDLE_RUNTIME_STATE: ArtifactRuntimeState = {
  status: 'idle',
  retryCount: 0,
  lastError: null,
  source: null,
};

export type RetryRequestResult = 'started' | 'blocked' | 'exhausted';
export type ArtifactRetryRequestPayload = Omit<ArtifactRetryPayload, 'attempt' | 'manual'>;
export type ChatFinishEvent = Parameters<ChatOnFinishCallback<AppUIMessage>>[0];

export interface PendingRetry {
  readonly payload: ArtifactRetryPayload;
  readonly baselineArtifactKey: string | null;
}

const UNSUPPORTED_BACKEND_ERROR =
  'Browser-only artifact runtime detected an unsupported backend call. Do not use localhost, private network hosts, invented backend routes, or non-OpenAI provider URLs. If the artifact needs live model output, call POST https://api.openai.com/v1/responses with model "gpt-4.1" and let Rebolt proxy it automatically. Do not send Authorization or API-key headers from artifact code.';

export function normalizeErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (value && typeof value === 'object') {
    const errorLike = value as Partial<Record<'message' | 'title' | 'description', unknown>>;
    for (const key of ['message', 'title', 'description'] as const) {
      const candidate = errorLike[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return fallback;
}

function looksLikeUnsupportedArtifactBackendError(error: string): boolean {
  return /unexpected token '<'|failed to fetch|non-json response|\/predict\b|\/api\/artifacts\/predict\b|\/api\/artifacts\/openai-proxy\b|localhost|127\.0\.0\.1|api\.anthropic\.com|api\.openai\.com|openrouter\.ai/i.test(
    error.toLowerCase(),
  );
}

export function shapeArtifactRetryError(error: string, source: ArtifactRetrySource): string {
  if (source === 'artifact-static-validation' || isArtifactStaticValidationError(error)) {
    return stripArtifactStaticValidationError(error);
  }

  if (looksLikeUnsupportedArtifactBackendError(error)) {
    return UNSUPPORTED_BACKEND_ERROR;
  }

  return error;
}

export function isDatasetAccessError(error: string): boolean {
  return error.startsWith(ARTIFACT_DATASET_ERROR_MARKER);
}

export function stripDatasetAccessError(error: string): string {
  return error.replace(ARTIFACT_DATASET_ERROR_MARKER, '').trim();
}

export function toRuntimeSource(event: Exclude<ArtifactRuntimeEvent, { type: 'ready' }>): ArtifactRetrySource {
  if (event.type === 'timeout') {
    return 'sandpack-timeout';
  }

  if (event.type === 'notification-error') {
    return 'sandpack-notification';
  }

  return 'sandpack-runtime';
}

export function buildRuntimeRetryPayload(
  artifact: ActiveArtifact,
  error: string,
  source: ArtifactRetrySource,
): ArtifactRetryRequestPayload {
  return {
    assistantMessageId: artifact.assistantMessageId,
    artifactToolCallId: artifact.toolCallId,
    fileId: artifact.fileId,
    artifactTitle: artifact.title,
    artifactDescription: artifact.description,
    files: artifact.files,
    error: shapeArtifactRetryError(error, source),
    source,
  };
}

export function buildManualRetryPayload(
  artifact: ActiveArtifact,
  previousRetry: ArtifactRetryRequestPayload | null,
  runtimeState: ArtifactRuntimeState,
): ArtifactRetryRequestPayload {
  if (
    previousRetry &&
    previousRetry.assistantMessageId === artifact.assistantMessageId &&
    previousRetry.artifactToolCallId === artifact.toolCallId
  ) {
    return {
      assistantMessageId: previousRetry.assistantMessageId,
      artifactToolCallId: previousRetry.artifactToolCallId,
      fileId: previousRetry.fileId,
      artifactTitle: previousRetry.artifactTitle,
      artifactDescription: previousRetry.artifactDescription,
      files: previousRetry.files,
      error: previousRetry.error,
      source: previousRetry.source,
    };
  }

  return {
    assistantMessageId: artifact.assistantMessageId,
    artifactToolCallId: artifact.toolCallId,
    fileId: artifact.fileId,
    artifactTitle: artifact.title,
    artifactDescription: artifact.description,
    files: artifact.files,
    error: runtimeState.lastError ?? 'The artifact preview failed.',
    source: runtimeState.source ?? 'sandpack-runtime',
  };
}
