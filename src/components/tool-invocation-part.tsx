'use client';

import { useState } from 'react';
import type { AnalysisToolOutput, ArtifactToolOutput } from '@/types/ai';

export function ToolInvocationPart({
  toolName,
  part,
  onArtifactClick,
}: {
  toolName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part: any;
  onArtifactClick?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (toolName === 'analyzeData') {
    if (part.state === 'input-streaming' || part.state === 'input-available') {
      return (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <span className="animate-pulse">●</span> Analyzing data...
        </div>
      );
    }
    if (part.state === 'output-available') {
      const result = part.output as AnalysisToolOutput;
      return (
        <div className="my-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
          >
            {expanded ? '▾' : '▸'} Analysis
          </button>
          {expanded && (
            <div className="mt-1 border-l-2 border-muted pl-4 text-sm text-muted-foreground">
              <p>{result.summary}</p>
              {result.insights.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {result.insights.map((insight, j) => (
                    <li key={j}>{insight}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      );
    }
  }

  if (toolName === 'generateArtifact') {
    if (part.state === 'input-streaming' || part.state === 'input-available') {
      return (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <span className="animate-pulse">●</span> Generating visualization...
        </div>
      );
    }
    if (part.state === 'output-available') {
      const result = part.output as ArtifactToolOutput;
      return (
        <div
          onClick={onArtifactClick}
          className="my-3 flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground"
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 13h4" />
              <path d="M10 17h4" />
              <path d="M10 9h1" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{result.title}</p>
            <p className="text-xs text-muted-foreground">Interactive artifact</p>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      );
    }
  }

  return null;
}
