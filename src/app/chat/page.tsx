import { getCurrentUser } from '@/lib/auth';
import { ChatEmptyState } from '@/components/chat-empty-state';

export default async function ChatPage() {
  const user = await getCurrentUser();

  const userInitials = user.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : (user.email?.[0]?.toUpperCase() ?? 'U');

  return <ChatEmptyState userInitials={userInitials} userAvatarUrl={user.profilePictureUrl ?? null} />;
}
