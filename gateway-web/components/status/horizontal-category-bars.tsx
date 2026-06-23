"use client";

type BarRow = {
  label: string;
  count: number;
};

function maxCount(rows: BarRow[]): number {
  return Math.max(1, ...rows.map((r) => r.count));
}

export function HorizontalCategoryBars({
  title,
  rows,
}: {
  title: string;
  rows: BarRow[];
}) {
  const peak = maxCount(rows);
  const visible = rows.filter((r) => r.count > 0);

  return (
    <div className="rounded-lg border border-[var(--gw-border)] bg-[var(--gw-surface)] p-4">
      <h3 className="text-sm font-medium text-[var(--gw-ink)]">{title}</h3>
      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--gw-muted)]">暂无数据</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex items-center justify-between text-xs text-[var(--gw-muted)]">
                <span>{row.label}</span>
                <span className="tabular-nums text-[var(--gw-ink)]">{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-[var(--gw-btn-primary-bg)]/85 transition-all"
                  style={{ width: `${(row.count / peak) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
