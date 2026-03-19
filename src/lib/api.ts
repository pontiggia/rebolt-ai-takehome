import { withAuth } from '@workos-inc/authkit-nextjs';
import type { UserInfo } from '@workos-inc/authkit-nextjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';

export interface AuthContext {
  readonly user: UserInfo['user'];
}

type AuthenticatedHandler = (req: Request, ctx: AuthContext) => Promise<Response>;

export function withAuthHandler(handler: AuthenticatedHandler) {
  return async (req: Request): Promise<Response> => {
    const { user } = await withAuth({ ensureSignedIn: true });

    await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        name: user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : null,
        avatarUrl: user.profilePictureUrl ?? null,
      })
      .onConflictDoNothing({ target: users.id });

    return handler(req, { user });
  };
}
