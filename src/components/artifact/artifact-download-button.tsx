'use client';

import { Download, Loader2 } from 'lucide-react';
import { useArtifactDownload } from '@/hooks/use-artifact-download';
import { cn } from '@/lib/utils';
import type { ActiveArtifact } from '@/types/chat';

interface ArtifactDownloadButtonProps {
  readonly artifact: ActiveArtifact;
}

export function ArtifactDownloadButton({ artifact }: ArtifactDownloadButtonProps) {
  const { error, isPreparing, handleDownload } = useArtifactDownload(artifact);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPreparing}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors',
          isPreparing
            ? 'cursor-not-allowed text-muted-foreground'
            : 'text-foreground hover:bg-muted hover:text-foreground',
        )}
        aria-label="Download the full artifact source code as a zip"
      >
        {isPreparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        <span>{isPreparing ? 'Preparing...' : 'Download ZIP'}</span>
      </button>
      {error ? <p className="max-w-60 text-right text-[11px] leading-4 text-destructive">{error}</p> : null}
    </div>
  );
}
