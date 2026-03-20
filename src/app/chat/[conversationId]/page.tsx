import { notFound } from 'next/navigation';
import { ChatPanel } from '@/components/chat-panel';
import { getCurrentUser } from '@/lib/auth';
import { getConversationDetail } from '@/services/conversations';

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const user = await getCurrentUser();
  const conversationDetail = await getConversationDetail(conversationId, user.id);

  if (!conversationDetail.ok) {
    notFound();
  }

  const userInitials = user.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : (user.email?.[0]?.toUpperCase() ?? 'U');

  return (
    <ChatPanel
      conversationId={conversationId}
      initialMessages={conversationDetail.value.messages}
      initialFiles={conversationDetail.value.files}
      userInitials={userInitials}
      userAvatarUrl={user.profilePictureUrl ?? null}
    />
  );
}
