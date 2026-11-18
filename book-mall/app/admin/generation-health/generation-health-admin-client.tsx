"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { GenerationHealthPayload } from "@/lib/generation/generation-health-projection";
import { GENERATION_USER_FACING_BUCKET_LABEL } from "@private/generation-user-facing-error";

const HOUR_OPTIONS = [1, 3, 6, 12, 24] as const;

type BucketKey = keyof typeof GENERATION_USER_FACING_BUCKET_LABEL;

function sumFailed(cell: GenerationHealthPayload["totals"]): number {
  return (
    cell.USER_CREDITS +
    cell.PLATFORM_BILLING +
    cell.VENDOR_INPUT +
    cell.VENDOR_QUEUE
  );
}

export function GenerationHealthAdminClient() {
  const [hours, setHours] = useState<number>(24);
  const [data, setData] = useState<GenerationHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/generation-health?hours=${hours}`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        generationHealth?: GenerationHealthPayload;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "加载失败");
      setData(json.generationHealth ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals;
  const failedTotal = totals ? sumFailed(totals) : 0;
  const attemptTotal = totals ? totals.success + failedTotal : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">统计窗口</span>
        {HOUR_OPTIONS.map((h) => (
          <button
            key={h}
            type="button"
            className={`rounded-full border px-3 py-1 text-sm ${
              hours === h ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
            onClick={() => setHours(h)}
          >
            近 {h} 小时
          </button>
        ))}
        <button
          type="button"
          className="ml-auto text-sm text-primary hover:underline"
          onClick={() => void load()}
        >
          刷新
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载生成健康…
        </div>
      ) : null}

      {data && totals ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard label="成功" value={totals.success} accent="text-emerald-600" />
            {(Object.keys(GENERATION_USER_FACING_BUCKET_LABEL) as BucketKey[]).map(
              (key) => (
                <KpiCard
                  key={key}
                  label={GENERATION_USER_FACING_BUCKET_LABEL[key]}
                  value={totals[key]}
                  accent={
                    key === "USER_CREDITS"
                      ? "text-amber-600"
                      : key === "PLATFORM_BILLING"
                        ? "text-red-600"
                        : key === "VENDOR_INPUT"
                          ? "text-blue-600"
                          : "text-muted-foreground"
                  }
                />
              ),
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            窗口内共 {attemptTotal} 次终态（成功 {totals.success} · 失败 {failedTotal}）。失败明细仍以
            GatewayRequestLog 原文为准，见{" "}
            <Link href="/admin/errors" className="text-primary hover:underline">
              平台错误日志
            </Link>
            与 Gateway 状态页。
          </p>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium">模态</th>
                  <th className="px-3 py-2 font-medium">成功</th>
                  <th className="px-3 py-2 font-medium">积分不足</th>
                  <th className="px-3 py-2 font-medium">不能抵扣</th>
                  <th className="px-3 py-2 font-medium">模型/参数</th>
                  <th className="px-3 py-2 font-medium">排队/其他</th>
                </tr>
              </thead>
              <tbody>
                {data.modalities.map((row) => (
                  <tr key={row.modality} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2 tabular-nums">{row.counts.success}</td>
                    <td className="px-3 py-2 tabular-nums">{row.counts.USER_CREDITS}</td>
                    <td className="px-3 py-2 tabular-nums">{row.counts.PLATFORM_BILLING}</td>
                    <td className="px-3 py-2 tabular-nums">{row.counts.VENDOR_INPUT}</td>
                    <td className="px-3 py-2 tabular-nums">{row.counts.VENDOR_QUEUE}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className={`text-2xl font-semibold tabular-nums ${accent}`}>
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}