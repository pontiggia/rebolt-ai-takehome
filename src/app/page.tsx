import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { user } = await withAuth();

  if (user) {
    redirect('/chat');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-3 text-center">
          <p className="font-display text-lg font-semibold text-foreground">Rebolt</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sign in to continue</h1>
          <p className="text-sm text-muted-foreground">
            Continue with Google to access your chats, uploads, and generated artifacts.
          </p>
        </div>

        <div className="mt-8">
          <a
            href="/auth/login"
            className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-5.9s2.7-5.9 5.9-5.9c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.6 14.7 2.6 12 2.6A9.4 9.4 0 0 0 2.6 12 9.4 9.4 0 0 0 12 21.4c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12Z" />
            </svg>
            Continue with Google
          </a>
        </div>
      </div>
    </main>
  );
}
