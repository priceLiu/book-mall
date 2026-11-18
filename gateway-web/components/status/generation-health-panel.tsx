"use client";

import Link from "next/link";

export type GenerationHealthCell = {
  success: number;
  USER_CREDITS: number;
  PLATFORM_BILLING: number;
  VENDOR_INPUT: number;
  VENDOR_QUEUE: number;
};

export type GenerationHealthApiPayload = {
  totals: GenerationHealthCell;
  modalities: {
    modality: string;
    label: string;
    counts: GenerationHealthCell;
  }[];
};

type Props = {
  data: GenerationHealthApiPayload | null;
  loading?: boolean;
  bookAdminOrigin?: string | null;
};

const BUCKET_LABEL: Record<string, string> = {
  USER_CREDITS: "积分不足",
  PLATFORM_BILLING: "不能抵扣",
  VENDOR_INPUT: "模型/参数",
  VENDOR_QUEUE: "排队/其他",
};

export function GenerationHealthPanel({ data, loading, bookAdminOrigin }: Props) {
  const adminHref = bookAdminOrigin
    ? `${bookAdminOrigin.replace(/\/$/, "")}/admin/generation-health`
    : "/admin/generation-health";

  return (
    <section className="rounded-lg border border-[var(--gw-border)] bg-[var(--gw-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--gw-fg)]">生成健康 · 用户错误分类</h2>
        <Link
          href={adminHref}
          className="ml-auto text-xs text-[var(--gw-accent)] hover:underline"
        >
          查看详情
        </Link>
      </div>

      {loading && !data ? (
        <p className="text-xs text-[var(--gw-muted)]">正在加载…</p>
      ) : null}

      {data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <MiniStat label="成功" value={data.totals.success} tone="ok" />
            <MiniStat label={BUCKET_LABEL.USER_CREDITS} value={data.totals.USER_CREDITS} />
            <MiniStat
              label={BUCKET_LABEL.PLATFORM_BILLING}
              value={data.totals.PLATFORM_BILLING}
            />
            <MiniStat label={BUCKET_LABEL.VENDOR_INPUT} value={data.totals.VENDOR_INPUT} />
            <MiniStat label={BUCKET_LABEL.VENDOR_QUEUE} value={data.totals.VENDOR_QUEUE} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--gw-border)] text-[var(--gw-muted)]">
                  <th className="py-1.5 pr-2 font-medium">模态</th>
                  <th className="py-1.5 pr-2 font-medium">成功</th>
                  <th className="py-1.5 pr-2 font-medium">a</th>
                  <th className="py-1.5 pr-2 font-medium">b</th>
                  <th className="py-1.5 pr-2 font-medium">c</th>
                  <th className="py-1.5 font-medium">d</th>
                </tr>
              </thead>
              <tbody>
                {data.modalities.map((row) => (
                  <tr key={row.modality} className="border-b border-[var(--gw-border)]/60">
                    <td className="py-1.5 pr-2 text-[var(--gw-fg)]">{row.label}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-emerald-400">
                      {row.counts.success}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">{row.counts.USER_CREDITS}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{row.counts.PLATFORM_BILLING}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{row.counts.VENDOR_INPUT}</td>
                    <td className="py-1.5 tabular-nums">{row.counts.VENDOR_QUEUE}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok";
}) {
  return (
    <div className="rounded-md border border-[var(--gw-border)] bg-[var(--gw-bg)] px-2 py-1.5">
      <div
        className={`text-lg font-semibold tabular-nums ${
          tone === "ok" ? "text-emerald-400" : "text-[var(--gw-fg)]"
        }`}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-[var(--gw-muted)]">{label}</div>
    </div>
  );
}