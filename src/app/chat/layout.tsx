import { getCurrentUser } from '@/lib/auth';
import { listConversations } from '@/services/conversations';
import { Sidebar } from '@/components/sidebar';
import type { ConversationSummary } from '@/types/api';

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const conversationsResult = await listConversations(user.id);

  const conversations: ConversationSummary[] = conversationsResult.ok
    ? conversationsResult.value.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
      }))
    : [];

  const userName = user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : (user.email ?? 'User');
  const userInitials = user.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : (user.email?.[0]?.toUpperCase() ?? 'U');

  return (
    <div className="flex h-screen">
      <Sidebar conversations={conversations} userName={userName} userInitials={userInitials} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
