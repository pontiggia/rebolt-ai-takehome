import type { Metadata } from 'next';
import { Inter, Manrope, Geist } from 'next/font/google';
import { Geist_Mono } from 'next/font/google';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['600', '700'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
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
  const { accessToken, ...initialAuth } = auth;

  return (
    <html lang="en" className={cn("h-full", "antialiased", inter.variable, manrope.variable, geistMono.variable, "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col">
        <AuthKitProvider initialAuth={initialAuth}>{children}</AuthKitProvider>
      </body>
    </html>
  );
}
