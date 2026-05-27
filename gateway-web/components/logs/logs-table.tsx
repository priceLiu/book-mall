"use client";

import { useMemo, useState } from "react";
import { LogParamsCell } from "./log-params-cell";
import { LogResultCell } from "./log-result-cell";
import { LogStatusBadge } from "./log-status-badge";
import {
  formatCreditsDisplay,
  formatDurationSeconds,
  formatLogTimestamp,
  resolveLogDurationMs,
} from "@/lib/gateway-log-params";
import {
  formatLogPageLabel,
  formatLogSourceTooltip,
} from "@/lib/gateway-log-display";

export type GatewayLogRow = {
  id: string;
  model: string;
  endpoint: string;
  status: string;
  requestKind: string;
  providerKind: string | null;
  clientSource: string;
  clientPage: string | null;
  externalTaskId: string | null;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number | null;
  estimatedVendorCostYuan: string | null;
  failCode: string | null;
  failMessage: string | null;
  inputSummary: unknown;
  resultSummary: unknown;
  submittedAt: string;
  completedAt: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "Select Status" },
  { value: "RUNNING", label: "running" },
  { value: "PENDING", label: "pending" },
  { value: "SUCCEEDED", label: "success" },
  { value: "FAILED", label: "failed" },
  { value: "CANCELLED", label: "cancelled" },
];

export function LogsTable({ logs }: { logs: GatewayLogRow[] }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!statusFilter) return logs;
    return logs.filter((l) => l.status === statusFilter);
  }, [logs, statusFilter]);

  const allSelected =
    filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((l) => l.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-w-[160px] rounded-lg border border-white/10 bg-[#141419] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-white/20"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0f0f14]">
        <table className="gw-logs-table min-w-[1780px]">
          <thead>
            <tr>
              <th className="w-11">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-sky-500"
                  aria-label="全选"
                />
              </th>
              <th className="w-[88px]">Source</th>
              <th className="min-w-[168px]">Model</th>
              <th className="min-w-[480px]">Params</th>
              <th className="w-[120px]">Status</th>
              <th className="w-[88px]">Duration</th>
              <th className="min-w-[168px]">Submitted</th>
              <th className="min-w-[168px]">Completed</th>
              <th className="w-[120px]" title="有定价时为预估成本（元），否则为 Token 用量">
                Credits Consumed
              </th>
              <th className="min-w-[240px]">Task ID</th>
              <th className="w-[150px]">Results</th>
              <th className="w-[120px]">Retry Callback</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const durationMs = resolveLogDurationMs(
                l.durationMs,
                l.submittedAt,
                l.completedAt,
              );
              const duration = formatDurationSeconds(durationMs);
              const credits = formatCreditsDisplay(
                l.estimatedVendorCostYuan,
                l.totalTokens,
                l.promptTokens,
                l.completionTokens,
              );
              const taskId = l.externalTaskId ?? l.id;
              const isInProgress =
                l.status === "RUNNING" || l.status === "PENDING";
              const sourceLabel = formatLogPageLabel(l.clientSource, l.clientPage);
              const sourceTitle = formatLogSourceTooltip(
                l.clientSource,
                l.providerKind,
                l.clientPage,
              );

              return (
                <tr key={l.id} className="gw-logs-row">
                  <td className="align-middle">
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggleOne(l.id)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-sky-500"
                      aria-label={`选择 ${l.id}`}
                    />
                  </td>
                  <td className="align-middle">
                    <span
                      className="text-sm text-zinc-300"
                      title={sourceTitle}
                    >
                      {sourceLabel}
                    </span>
                  </td>
                  <td className="align-top">
                    <span className="inline-flex rounded-md bg-sky-600 px-2 py-0.5 font-mono text-[11px] font-medium text-white">
                      {l.model}
                    </span>
                  </td>
                  <td className="align-top">
                    <LogParamsCell inputSummary={l.inputSummary} />
                  </td>
                  <td className="align-middle">
                    <LogStatusBadge
                      status={l.status}
                      failCode={l.failCode}
                      failMessage={l.failMessage}
                    />
                  </td>
                  <td
                    className="align-middle font-mono text-sm text-zinc-300"
                    title={
                      durationMs != null
                        ? `${durationMs} ms`
                        : isInProgress
                          ? "任务进行中"
                          : undefined
                    }
                  >
                    {duration}
                  </td>
                  <td className="align-middle">
                    <span
                      className="block whitespace-nowrap font-mono text-[11px] leading-snug text-zinc-400"
                      title={l.submittedAt}
                    >
                      {formatLogTimestamp(l.submittedAt)}
                    </span>
                  </td>
                  <td className="align-middle">
                    {l.completedAt ? (
                      <span
                        className="block whitespace-nowrap font-mono text-[11px] leading-snug text-zinc-400"
                        title={l.completedAt}
                      >
                        {formatLogTimestamp(l.completedAt)}
                      </span>
                    ) : (
                      <span
                        className="text-sm text-zinc-600"
                        title={isInProgress ? "任务进行中" : undefined}
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td
                    className="align-middle font-mono text-sm text-zinc-300"
                    title={credits.title}
                  >
                    {credits.value}
                  </td>
                  <td className="align-middle">
                    <span
                      className="block break-all font-mono text-[11px] leading-snug text-zinc-400"
                      title={taskId}
                    >
                      {taskId}
                    </span>
                  </td>
                  <td className="align-middle">
                    <LogResultCell
                      status={l.status}
                      resultSummary={l.resultSummary}
                    />
                  </td>
                  <td className="align-middle text-center text-zinc-600">
                    —
                  </td>
                </tr>
              );
            })}
            {!filtered.length ? (
              <tr>
                <td
                  colSpan={12}
                  className="py-16 text-center text-sm text-zinc-500"
                >
                  暂无日志
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
