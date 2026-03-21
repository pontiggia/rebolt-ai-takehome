import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';

export function useAutoScroll(messages: readonly UIMessage[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  return { containerRef, endRef };
}
