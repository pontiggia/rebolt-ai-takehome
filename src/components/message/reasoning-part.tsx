'use client';

import type { AppUIMessagePart } from '@/types/ai';

export function ReasoningPart({ part }: { readonly part: Extract<AppUIMessagePart, { type: 'reasoning' }> }) {
  const text = part.text.trim();

  if (!text) {
    return null;
  }

  return (
    <div className="my-2 flex items-start gap-2 text-sm text-muted-foreground">
      <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-foreground/65" />
      <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}
