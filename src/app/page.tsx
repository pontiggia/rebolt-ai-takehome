import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center border-b px-6 py-4">
        <Image
          src="/branding/rebolt-wordmark-black.svg"
          alt="Rebolt"
          width={120}
          height={28}
          style={{ width: 120, height: 'auto' }}
          priority
        />
      </header>

      {/* Centered content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Brand icon */}
          <Image src="/branding/rebolt-icon-black-rounded.svg" alt="" width={64} height={64} priority />

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Data to insights, instantly</h1>
            <p className="mx-auto max-w-md text-base text-muted-foreground">
              Upload your spreadsheets and let AI generate mini-apps, artifacts and dashboards.
            </p>
          </div>

          {/* CTA — links to /chat, proxy handles auth redirect */}
          <Link
            href="/chat"
            className="mt-2 inline-flex items-center gap-2.5 rounded-full bg-[#0D0E10] px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0D0E10]/90"
          >
            Get started
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M1.75 7h10.5M8.75 3.5 12.25 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          {/* Disclaimer */}
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Sign in with your Google account to start.
            <br />
            Your data is processed securely and never shared.
          </p>
        </div>
      </div>
    </main>
  );
}
