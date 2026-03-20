'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { ReactNode, ComponentPropsWithoutRef } from 'react';
import { sanitizeSchema, remarkGfmOptions } from '@/lib/markdown/config';
import { CodeBlock, InlineCode } from '@/components/code-block';

interface MarkdownRendererProps {
  readonly content: string;
}

const components = {
  code: ({ className, children }: ComponentPropsWithoutRef<'code'>) => {
    if (className?.includes('language-')) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return <InlineCode>{children}</InlineCode>;
  },

  pre: ({ children }: ComponentPropsWithoutRef<'pre'>) => <>{children}</>,

  a: ({ href, children }: ComponentPropsWithoutRef<'a'>) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      {children}
    </a>
  ),

  h1: ({ children }: ComponentPropsWithoutRef<'h1'>) => (
    <p className="mb-2 mt-4 text-[16px] font-semibold text-foreground first:mt-0">{children}</p>
  ),
  h2: ({ children }: ComponentPropsWithoutRef<'h2'>) => (
    <p className="mb-2 mt-3 text-[15px] font-semibold text-foreground first:mt-0">{children}</p>
  ),
  h3: ({ children }: ComponentPropsWithoutRef<'h3'>) => (
    <p className="mb-2 mt-3 text-[14px] font-medium text-foreground first:mt-0">{children}</p>
  ),
  h4: ({ children }: ComponentPropsWithoutRef<'h4'>) => (
    <p className="mb-1 mt-2 text-[14px] font-medium text-foreground first:mt-0">{children}</p>
  ),
  h5: ({ children }: ComponentPropsWithoutRef<'h5'>) => (
    <p className="mb-1 mt-2 text-[14px] font-medium text-foreground first:mt-0">{children}</p>
  ),
  h6: ({ children }: ComponentPropsWithoutRef<'h6'>) => (
    <p className="mb-1 mt-2 text-[14px] font-medium text-foreground first:mt-0">{children}</p>
  ),

  p: ({ children }: ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-3 text-[15px] leading-relaxed text-foreground last:mb-0">{children}</p>
  ),

  ul: ({ children }: ComponentPropsWithoutRef<'ul'>) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-foreground">{children}</ul>
  ),
  ol: ({ children }: ComponentPropsWithoutRef<'ol'>) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-foreground">{children}</ol>
  ),
  li: ({ children }: ComponentPropsWithoutRef<'li'>) => <li className="text-[15px] leading-relaxed">{children}</li>,

  blockquote: ({ children }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="my-3 rounded-r border-l-[3px] border-muted-foreground/30 bg-muted/50 py-2 pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),

  table: ({ children }: ComponentPropsWithoutRef<'table'>) => (
    <div className="my-3 overflow-x-auto" style={{ maxHeight: '300px' }}>
      <table className="w-full border-collapse border text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: ComponentPropsWithoutRef<'thead'>) => <thead className="bg-muted">{children}</thead>,
  tr: ({ children }: ComponentPropsWithoutRef<'tr'>) => <tr className="border-b">{children}</tr>,
  th: ({ children }: ComponentPropsWithoutRef<'th'>) => (
    <th className="border-r px-3 py-2 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }: ComponentPropsWithoutRef<'td'>) => (
    <td className="border-r px-3 py-2 text-foreground">{children}</td>
  ),

  hr: () => <hr className="my-4 border-t" />,

  strong: ({ children }: ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: ComponentPropsWithoutRef<'em'>) => <em className="italic">{children}</em>,
  del: ({ children }: ComponentPropsWithoutRef<'del'>) => <del className="line-through">{children}</del>,
};

export function MarkdownRenderer({ content }: MarkdownRendererProps): ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[[remarkGfm, remarkGfmOptions]]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
