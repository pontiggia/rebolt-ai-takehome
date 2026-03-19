export default function LoadingConversation() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 p-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-16 w-3/4 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="border-t p-4">
        <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
