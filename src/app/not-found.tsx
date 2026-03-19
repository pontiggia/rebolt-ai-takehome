import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Chat not found</h1>
        <p className="text-sm text-muted-foreground">
          The conversation you requested does not exist or you no longer have access to it.
        </p>
      </div>
      <Link
        href="/chat"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Return to chats
      </Link>
    </div>
  );
}
