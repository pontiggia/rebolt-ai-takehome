'use client';

import type { FileUploadBadgeProps } from '@/types/components';

export function FileUploadBadge({ fileName }: FileUploadBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground"
      >
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
      <span className="text-sm">{fileName}</span>
    </div>
  );
}
