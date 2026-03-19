import type { Metadata } from 'next';
import { withAuth, type NoUserInfo, type UserInfo } from '@workos-inc/authkit-nextjs';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
import { Inter, Manrope } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: 'Rebolt AI',
  description: 'Chat with your CSV/Excel data and generate interactive artifacts',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await withAuth();
  const initialAuth: Omit<UserInfo | NoUserInfo, 'accessToken'> = auth.user
    ? {
        user: auth.user,
        sessionId: auth.sessionId,
        organizationId: auth.organizationId,
        role: auth.role,
        roles: auth.roles,
        permissions: auth.permissions,
        entitlements: auth.entitlements,
        featureFlags: auth.featureFlags,
        impersonator: auth.impersonator,
      }
    : { user: null };

  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${GeistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        <AuthKitProvider initialAuth={initialAuth}>{children}</AuthKitProvider>
      </body>
    </html>
  );
}
