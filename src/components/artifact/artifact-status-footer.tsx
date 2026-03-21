import { cn } from '@/lib/utils';
import type { ArtifactPanelProps } from '@/types/components';
import { MAX_ARTIFACT_AUTO_RETRIES } from '@/types/chat';

type ArtifactStatusFooterProps = Pick<ArtifactPanelProps, 'runtimeState' | 'isRetryDisabled' | 'onManualRetry'>;

function ArtifactRetryingFooter({ runtimeState }: Pick<ArtifactStatusFooterProps, 'runtimeState'>) {
  return (
    <div className="border-t bg-muted/30 px-3 py-2">
      <p className="text-sm font-medium">
        Self-correcting (attempt {runtimeState.retryCount}/{MAX_ARTIFACT_AUTO_RETRIES})...
      </p>
      {runtimeState.lastError && <p className="mt-1 text-xs text-muted-foreground">{runtimeState.lastError}</p>}
    </div>
  );
}

function ArtifactFailedFooter({ runtimeState, isRetryDisabled, onManualRetry }: ArtifactStatusFooterProps) {
  if (!runtimeState.lastError) {
    return null;
  }

  return (
    <div className="border-t p-3">
      <p className="mb-2 text-sm text-destructive">{runtimeState.lastError}</p>
      {runtimeState.status === 'exhausted' && (
        <p className="mb-2 text-xs text-muted-foreground">
          Automatic retries are exhausted. You can try one more manual correction cycle.
        </p>
      )}
      <button
        onClick={onManualRetry}
        disabled={isRetryDisabled}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm transition-colors',
          isRetryDisabled
            ? 'cursor-not-allowed bg-muted text-muted-foreground'
            : 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        )}
      >
        Try again
      </button>
    </div>
  );
}

export function ArtifactStatusFooter(props: ArtifactStatusFooterProps) {
  switch (props.runtimeState.status) {
    case 'idle':
      return null;
    case 'retrying':
      return <ArtifactRetryingFooter runtimeState={props.runtimeState} />;
    default:
      return <ArtifactFailedFooter {...props} />;
  }
}
