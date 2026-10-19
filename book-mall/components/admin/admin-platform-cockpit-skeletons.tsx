function PulseBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#eaeef2] ${className ?? ""}`} />;
}

function SectionSkeleton({
  titleWidth = "w-32",
  cards = 4,
}: {
  titleWidth?: string;
  cards?: number;
}) {
  return (
    <section className="space-y-4" aria-hidden>
      <PulseBlock className={`h-6 ${titleWidth}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <PulseBlock key={i} className="h-28" />
        ))}
      </div>
    </section>
  );
}

export function AdminCockpitFinanceSkeleton() {
  return (
    <section className="space-y-4" aria-hidden>
      <PulseBlock className="h-6 w-40" />
      <div className="grid gap-4 sm:grid-cols-3">
        <PulseBlock className="h-28" />
        <PulseBlock className="h-28" />
        <PulseBlock className="h-28" />
      </div>
      <PulseBlock className="h-48 w-full rounded-xl" />
    </section>
  );
}

export function AdminCockpitCreditOpsSkeleton() {
  return <PulseBlock className="h-48 w-full rounded-xl" />;
}

export function AdminCockpitDailySkeleton() {
  return (
    <section className="space-y-4" aria-hidden>
      <PulseBlock className="h-10 w-full max-w-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <PulseBlock key={i} className="h-24" />
        ))}
      </div>
      <PulseBlock className="h-10 w-64" />
      <PulseBlock className="h-72 w-full rounded-xl" />
    </section>
  );
}

export function AdminCockpitAssistantSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <PulseBlock className="h-40 w-full rounded-xl" />
      <PulseBlock className="h-32 w-full rounded-xl" />
    </div>
  );
}

export function AdminCockpitMetricsSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <SectionSkeleton titleWidth="w-24" cards={3} />
      <SectionSkeleton titleWidth="w-28" cards={2} />
      <SectionSkeleton titleWidth="w-36" cards={5} />
      <SectionSkeleton titleWidth="w-28" cards={4} />
    </div>
  );
}

export function AdminDashboardLoading() {
  return (
    <div className="space-y-10 pb-12" role="status" aria-live="polite" aria-label="管理后台加载中">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d1d9e0] pb-6">
        <div className="space-y-2">
          <PulseBlock className="h-3 w-24" />
          <PulseBlock className="h-8 w-40" />
          <PulseBlock className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <PulseBlock className="h-9 w-28" />
          <PulseBlock className="h-9 w-24" />
        </div>
      </header>
      <AdminCockpitDailySkeleton />
      <PulseBlock className="h-32 w-full rounded-xl" />
      <AdminCockpitCreditOpsSkeleton />
      <AdminCockpitCreditOpsSkeleton />
      <AdminCockpitFinanceSkeleton />
      <AdminCockpitAssistantSkeleton />
      <AdminCockpitMetricsSkeleton />
      <p className="text-sm text-[#656d76]">正在加载驾驶舱…</p>
    </div>
  );
}
