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

  return (
    <div className="flex h-screen">
      <Sidebar conversations={conversations} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
