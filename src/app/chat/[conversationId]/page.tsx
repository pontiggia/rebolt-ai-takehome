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

  return (
    <ChatPanel
      conversationId={conversationId}
      initialMessages={conversationDetail.value.messages}
      initialFiles={conversationDetail.value.files}
    />
  );
}
