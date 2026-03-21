export function ToolLoadingIndicator({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
      <span className="animate-pulse">●</span> {label}
    </div>
  );
}
