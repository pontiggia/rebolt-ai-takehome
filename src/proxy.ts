import type { NextRequest } from 'next/server';
import { authkit, handleAuthkitHeaders } from '@workos-inc/authkit-nextjs';

export default async function proxy(request: NextRequest) {
  const { session, headers, authorizationUrl } = await authkit(request);
  const { pathname } = request.nextUrl;

  if (pathname === '/' && session.user) {
    return handleAuthkitHeaders(request, headers, { redirect: '/chat' });
  }

  if (pathname.startsWith('/chat') && !session.user && authorizationUrl) {
    return handleAuthkitHeaders(request, headers, { redirect: authorizationUrl });
  }

  return handleAuthkitHeaders(request, headers);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
