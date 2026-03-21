'use client';

import { Dialog } from '@base-ui/react/dialog';
import { LoaderCircle, X } from 'lucide-react';
import type { RefObject } from 'react';
import type { FilePreviewResponse } from '@/types/api';
import { cn } from '@/lib/utils';

interface FilePreviewDialogProps {
  readonly open: boolean;
  readonly fileName: string | null;
  readonly preview: FilePreviewResponse | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({
  open,
  fileName,
  preview,
  isLoading,
  error,
  triggerRef,
  onOpenChange,
}: FilePreviewDialogProps) {
  const title = preview?.fileName ?? fileName ?? 'File preview';
  const description =
    preview === null
      ? isLoading
        ? 'Loading preview...'
        : (error ?? null)
      : `${preview.summaryLabel} • ${preview.note}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            'fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] transition-opacity duration-150',
            'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
          )}
        />
        <Dialog.Popup
          finalFocus={triggerRef}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'rounded-[24px] border border-border/80 bg-background shadow-2xl outline-none',
            'data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0',
            'transition-[opacity,transform] duration-150',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[1.75rem] font-semibold tracking-tight text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Close preview"
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors',
                'hover:bg-muted/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              )}
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-2xl border border-border/80 bg-muted/[0.18] p-4">
              {isLoading ? (
                <div className="flex min-h-[360px] items-center justify-center gap-3 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading preview...
                </div>
              ) : error ? (
                <div className="min-h-[360px] rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <pre className="max-h-[55vh] min-h-[360px] overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-foreground">
                  {preview?.previewText.length ? preview.previewText : 'This file has no previewable text.'}
                </pre>
              )}
            </div>

            {preview?.truncated ? (
              <p className="mt-3 text-xs text-muted-foreground">Preview truncated to the first lines of the file.</p>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
