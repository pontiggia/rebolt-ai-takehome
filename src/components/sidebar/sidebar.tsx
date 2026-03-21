'use client';

import Link from 'next/link';
import Image from 'next/image';
import { startTransition, useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ConversationItem } from '@/components/sidebar/conversation-item';
import { UserCard } from '@/components/sidebar/user-card';
import { removeConversation } from '@/actions/conversations';
import type { ConversationSummary } from '@/types/api';

interface SidebarProps {
  readonly conversations: readonly ConversationSummary[];
  readonly userName: string;
  readonly userInitials: string;
  readonly userAvatarUrl?: string | null;
}

export function Sidebar({ conversations, userName, userInitials, userAvatarUrl }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeId = pathname.startsWith('/chat/') ? pathname.split('/')[2] : null;

  const navigateToNewChat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = '/chat';
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActionError(null);
    setDeletingId(id);

    try {
      await removeConversation(id);

      startTransition(() => {
        if (activeId === id) {
          router.push('/chat');
        }
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete conversation');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside
      className="flex flex-col border-r bg-background transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? 60 : 260 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <Link href="/chat" onClick={navigateToNewChat}>
            <Image
              src="/branding/rebolt-wordmark-black.svg"
              alt="Rebolt"
              width={100}
              height={24}
              style={{ width: 100, height: 'auto' }}
              priority
            />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
            className="transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="m14 9-3 3 3 3" />
          </svg>
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-2">
        <Link
          href="/chat"
          onClick={navigateToNewChat}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          title="New Chat"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          {!collapsed && <span>New Chat</span>}
        </Link>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-hidden px-3">
        {!collapsed && (
          <>
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Conversations
            </p>
            {actionError && <p className="mb-2 px-3 text-xs text-destructive">{actionError}</p>}
            {conversations.length === 0 && <p className="px-3 text-sm text-muted-foreground">No conversations yet</p>}
            <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              {conversations.map((convo) => (
                <ConversationItem
                  key={convo.id}
                  conversation={convo}
                  isActive={activeId === convo.id}
                  isDeleting={deletingId === convo.id}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <UserCard name={userName} initials={userInitials} avatarUrl={userAvatarUrl} collapsed={collapsed} />
    </aside>
  );
}
