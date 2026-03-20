'use client';

import type { ReactNode } from 'react';

interface ChatInputToolbarProps {
  readonly left?: ReactNode;
  readonly right?: ReactNode;
}

export function ChatInputToolbar({ left, right }: ChatInputToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 pt-3">
      <div className="flex items-center gap-1">{left}</div>
      <div className="flex items-center gap-1">{right}</div>
    </div>
  );
}
