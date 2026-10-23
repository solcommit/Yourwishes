export default function Loading() {
  return (
    <div aria-label="Loading wishlist" className="page-enter space-y-7" role="status">
      <span className="sr-only">Loading page</span>
      <div className="h-9 w-36 animate-pulse rounded-lg bg-[var(--surface-subtle)]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="aspect-[1.1] animate-pulse rounded-xl bg-[var(--surface-subtle)]"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
