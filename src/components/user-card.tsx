'use client';

import Image from 'next/image';

interface UserCardProps {
  readonly name: string;
  readonly initials: string;
  readonly avatarUrl?: string | null;
  readonly collapsed?: boolean;
}

function Avatar({
  name,
  initials,
  avatarUrl,
  size = 32,
}: {
  name: string;
  initials: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
      {initials}
    </div>
  );
}

export function UserCard({ name, initials, avatarUrl, collapsed }: UserCardProps) {
  if (collapsed) {
    return (
      <div className="flex justify-center p-3">
        <Avatar name={name} initials={initials} avatarUrl={avatarUrl} />
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5">
        <Avatar name={name} initials={initials} avatarUrl={avatarUrl} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <button
          type="button"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          title="Sign out"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
