export function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="aspect-video bg-white/[0.06]" />
      <div className="p-3">
        <div className="h-3.5 w-3/4 rounded bg-white/[0.08] mb-2" />
        <div className="h-3 w-1/2 rounded bg-white/[0.06] mb-2.5" />
        <div className="h-4 w-1/3 rounded bg-white/[0.08]" />
      </div>
    </div>
  );
}
