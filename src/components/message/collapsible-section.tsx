'use client';

import { useState } from 'react';

export function CollapsibleSection({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
      >
        {expanded ? '▾' : '▸'} {label}
      </button>
      {expanded && <div className="mt-1 border-l-2 border-muted pl-4 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
