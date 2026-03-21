import { useEffect, useRef } from 'react';
import type { AppUIMessage } from '@/types/ai';

export function useAutoScroll(messages: readonly AppUIMessage[], scrollSignal: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);
  const prevScrollSignal = useRef(scrollSignal);

  useEffect(() => {
    if (messages.length > prevMessageCount.current || scrollSignal > prevScrollSignal.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = messages.length;
    prevScrollSignal.current = scrollSignal;
  }, [messages.length, scrollSignal]);

  return { containerRef, endRef };
}
