"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type S2vGapAuditReport = {
  period: { from: string; to: string };
  gatewayLogCount: number;
  gatewaySecondsTotal: number;
  inferredSecondsTotal: number;
  gapSecondsTotal: number;
  missingDurationCount: number;
  composeTasksWithoutGatewayLog: number;
  composeAudioSecondsTotal: number;
  rows: Array<{
    logId: string;
    submittedAt: string;
    modelKey: string;
    gatewaySeconds: number;
    inferredSeconds: number | null;
    gapSeconds: number;
    clientPage: string | null;
    composeTaskId: string | null;
    audioDurationSec: number | null;
    issue: string;
  }>;
};

export function S2vGapAuditPanel({
  periodFrom,
  periodTo,
}: {
  periodFrom: string;
  periodTo: string;
}) {
  const base = useBookMallBaseUrl();
  const [report, setReport] = useState<S2vGapAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!base || !periodFrom || !periodTo) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ periodFrom, periodTo, take: "30" });
    const r = await financeApiFetch<S2vGapAuditReport>(
      base,
      `/api/finance/admin/reconciliation/s2v-gap-audit?${qs}`,
    );
    if (r.ok) {
      setReport(r.data);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base, periodFrom, periodTo]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded border border-[#e8e8e8] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">S2V 缺口排查 · wan2.2-s2v</h3>
          <p className="mt-0.5 text-xs text-[#8c8c8c]">
            Gateway 计量 vs 音频时长 / 可回填秒数；无 Gateway 日志的合成任务单独统计。
          </p>
        </div>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs hover:bg-[#fafafa]"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "排查中…" : "刷新"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {report && !loading ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4 text-xs">
            <div className="rounded border bg-[#fafafa] p-2">
              <p className="text-[#8c8c8c]">Gateway 计量</p>
              <p className="font-medium">{report.gatewaySecondsTotal}s · {report.gatewayLogCount} 条</p>
            </div>
            <div className="rounded border bg-[#fafafa] p-2">
              <p className="text-[#8c8c8c]">推断/回填后</p>
              <p className="font-medium">{report.inferredSecondsTotal}s</p>
            </div>
            <div className="rounded border bg-[#fff1f0] p-2">
              <p className="text-[#8c8c8c]">缺口</p>
              <p className="font-medium text-[#ff4d4f]">{report.gapSecondsTotal}s</p>
              <p className="text-[10px] text-[#8c8c8c]">缺 duration {report.missingDurationCount} 条</p>
            </div>
            <div className="rounded border bg-[#fafafa] p-2">
              <p className="text-[#8c8c8c]">无 Gateway 的合成</p>
              <p className="font-medium">{report.composeTasksWithoutGatewayLog} 条</p>
              <p className="text-[10px] text-[#8c8c8c]">音频合计 {report.composeAudioSecondsTotal}s</p>
            </div>
          </div>

          {report.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#fafafa]">
                  <tr>
                    <th className="px-2 py-1 text-left">日志</th>
                    <th className="px-2 py-1 text-right">Gateway s</th>
                    <th className="px-2 py-1 text-right">推断 s</th>
                    <th className="px-2 py-1 text-right">音频 s</th>
                    <th className="px-2 py-1 text-left">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.logId} className="border-t">
                      <td className="px-2 py-1 font-mono text-[10px]" title={row.logId}>
                        {row.submittedAt.slice(0, 10)} · {row.logId.slice(0, 8)}…
                      </td>
                      <td className="px-2 py-1 text-right">{row.gatewaySeconds}</td>
                      <td className="px-2 py-1 text-right">{row.inferredSeconds ?? "—"}</td>
                      <td className="px-2 py-1 text-right">{row.audioDurationSec ?? "—"}</td>
                      <td className="px-2 py-1 text-[#595959]">{row.issue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#8c8c8c]">该区间未发现 S2V 计量缺口。</p>
          )}

          <p className="mt-2 text-[10px] text-[#8c8c8c]">
            回填脚本：{" "}
            <code className="rounded bg-[#fafafa] px-1">
              pnpm exec dotenv -e .env.local -- tsx scripts/backfill-s2v-video-duration.ts --apply
            </code>
          </p>
        </>
      ) : null}
    </section>
  );
}
