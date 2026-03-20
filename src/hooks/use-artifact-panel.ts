'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { ActiveArtifact } from '@/types/chat';

const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_RATIO = 0.7;

export function useArtifactPanel(latestArtifact: ActiveArtifact | null) {
  const [isOpen, setIsOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 600,
  );

  const lastSeenArtifactKeyRef = useRef<string | null>(latestArtifact?.key ?? null);
  useEffect(() => {
    if (!latestArtifact || lastSeenArtifactKeyRef.current === latestArtifact.key) {
      return;
    }

    let cancelled = false;
    lastSeenArtifactKeyRef.current = latestArtifact.key;

    queueMicrotask(() => {
      if (!cancelled) {
        setIsOpen(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [latestArtifact]);

  const containerRef = useRef<HTMLDivElement>(null);
  const panelWidthRef = useRef(panelWidth);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const delta = startXRef.current - e.clientX;
    const maxWidth = window.innerWidth * MAX_PANEL_RATIO;
    const newWidth = Math.round(Math.max(MIN_PANEL_WIDTH, Math.min(startWidthRef.current + delta, maxWidth)));
    panelWidthRef.current = newWidth;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.width = `${panelWidthRef.current}px`;
        }
        rafRef.current = null;
      });
    }
  }, []);

  const handleResizeEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPanelWidth(panelWidthRef.current);
  }, []);

  return {
    isOpen,
    setIsOpen,
    panelWidth,
    containerRef,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  } as const;
}
