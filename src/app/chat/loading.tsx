export default function Loading() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="mx-auto h-10 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-14 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
