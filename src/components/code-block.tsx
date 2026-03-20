'use client';

import { useState, useCallback, type ReactNode } from 'react';

interface CodeBlockProps {
  readonly children: ReactNode;
  readonly className?: string;
}

function extractLanguage(className?: string): string | null {
  if (!className) return null;
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : null;
}

function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractTextContent((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function CopyButton({ text }: { readonly text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
      aria-label={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const language = extractLanguage(className);
  const textContent = extractTextContent(children);

  return (
    <div className="relative my-3 overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{language ?? 'code'}</span>
        <CopyButton text={textContent} />
      </div>
      <pre className="m-0 overflow-x-auto p-4 text-[13px] leading-relaxed" style={{ maxHeight: '400px' }}>
        <code className={className} style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { readonly children: ReactNode }) {
  return (
    <code
      className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]"
      style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}
    >
      {children}
    </code>
  );
}
