'use client';

import Link from 'next/link';
import { startTransition, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '@/types/api';

interface SidebarProps {
  readonly conversations: readonly ConversationSummary[];
}

export function Sidebar({ conversations }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeId = pathname.startsWith('/chat/') ? pathname.split('/')[2] : null;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActionError(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? 'Failed to delete conversation');
      }

      startTransition(() => {
        if (activeId === id) {
          router.push('/chat');
        }
        router.refresh();
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete conversation');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside className="flex w-[280px] flex-col border-r bg-background">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="font-display text-base font-semibold">Rebolt</span>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/chat"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          New Chat
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Conversations</p>
        {actionError && <p className="mb-2 px-3 text-sm text-destructive">{actionError}</p>}
        {conversations.length === 0 && <p className="px-3 text-sm text-muted-foreground">No conversations yet</p>}
        <div className="space-y-0.5">
          {conversations.map((convo) => (
            <div
              key={convo.id}
              className={cn(
                'group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
                activeId === convo.id && 'bg-primary/10 text-primary font-medium',
              )}
            >
              <Link href={`/chat/${convo.id}`} className="min-w-0 flex-1 truncate">
                {convo.title}
              </Link>
              <button
                onClick={(e) => handleDelete(convo.id, e)}
                disabled={deletingId === convo.id}
                className="hidden text-muted-foreground hover:text-destructive group-hover:block"
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
