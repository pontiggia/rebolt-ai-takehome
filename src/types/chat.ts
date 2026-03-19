export interface ArtifactState {
  readonly code: string | null;
  readonly error: string | null;
  readonly retryCount: number;
}

export const MAX_ARTIFACT_RETRIES = 3;
