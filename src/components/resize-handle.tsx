'use client';

interface ResizeHandleProps {
  readonly onResizeStart: (e: React.PointerEvent) => void;
  readonly onResizeMove: (e: React.PointerEvent) => void;
  readonly onResizeEnd: () => void;
}

export function ResizeHandle({ onResizeStart, onResizeMove, onResizeEnd }: ResizeHandleProps) {
  return (
    <div
      onPointerDown={onResizeStart}
      onPointerMove={onResizeMove}
      onPointerUp={onResizeEnd}
      onLostPointerCapture={onResizeEnd}
      className="group absolute bottom-0 left-0 top-0 z-10 w-1.5 cursor-col-resize"
    >
      <div className="absolute inset-y-0 left-[2px] w-[2px] bg-transparent transition-colors group-hover:bg-primary group-active:bg-primary" />
    </div>
  );
}
