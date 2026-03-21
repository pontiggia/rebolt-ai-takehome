'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '@/types/api';

interface ConversationItemProps {
  readonly conversation: ConversationSummary;
  readonly isActive: boolean;
  readonly isDeleting: boolean;
  readonly onDelete: (id: string, e: React.MouseEvent) => void;
}

export function ConversationItem({ conversation, isActive, isDeleting, onDelete }: ConversationItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted',
        isActive && 'bg-primary/10 text-primary font-medium',
      )}
    >
      <Link href={`/chat/${conversation.id}`} className="min-w-0 flex-1 truncate">
        {conversation.title}
      </Link>
      <button
        onClick={(e) => onDelete(conversation.id, e)}
        disabled={isDeleting}
        className="hidden shrink-0 cursor-pointer text-muted-foreground hover:text-destructive group-hover:block"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
    </div>
  );
}
