import 'server-only';

import { cache } from 'react';
import { withAuth } from '@workos-inc/authkit-nextjs';
import type { UserInfo } from '@workos-inc/authkit-nextjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';

export type CurrentUser = UserInfo['user'];

async function ensureUserRecord(user: CurrentUser) {
  await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email,
      name: user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : null,
      avatarUrl: user.profilePictureUrl ?? null,
    })
    .onConflictDoNothing({ target: users.id });
}

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const { user } = await withAuth({ ensureSignedIn: true });
  await ensureUserRecord(user);
  return user;
});
