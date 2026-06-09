"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type ScenarioLabRow = {
  scenarioKey: string;
  scenarioLabel: string;
  model: string;
  usageSeconds: number;
  costYuan: number;
  credits: number;
  revenueYuan: number;
  marginRate: number;
};

type ScenarioLabPayload = {
  meta: {
    seedsCount: number;
  };
  validation: {
    ok: boolean;
    range: { min: number; max: number };
    totalRows: number;
    failedRows: number;
  };
  rows: ScenarioLabRow[];
};

export function ScenarioLabClient() {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<ScenarioLabRow[]>([]);
  const [validation, setValidation] = useState<ScenarioLabPayload["validation"] | null>(null);
  const [seedsCount, setSeedsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runningValidation, setRunningValidation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { validateOnly?: boolean }) => {
      if (!base) return;
      const validateOnly = opts?.validateOnly === true;
      if (validateOnly) {
        setRunningValidation(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const qs = new URLSearchParams();
      if (validateOnly) qs.set("validateOnly", "1");
      const r = await financeApiFetch<ScenarioLabPayload>(base, `/api/finance/admin/scenario-lab?${qs}`);
      if (!r.ok) {
        setError(r.error);
      } else {
        setValidation(r.data.validation);
        setSeedsCount(r.data.meta.seedsCount);
        if (!validateOnly) setRows(r.data.rows);
        setMessage(
          r.data.validation.ok
            ? `校验通过：${r.data.validation.totalRows} 条毛利均在 ${(r.data.validation.range.min * 100).toFixed(1)}%~${(r.data.validation.range.max * 100).toFixed(1)}%`
            : `校验失败：${r.data.validation.failedRows} 条超出毛利阈值`,
        );
      }
      setRunningValidation(false);
      setLoading(false);
    },
    [base],
  );

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, ScenarioLabRow[]>>((acc, row) => {
      (acc[row.scenarioLabel] ||= []).push(row);
      return acc;
    }, {});
  }, [rows]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (loading) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">Scenario Lab</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            财务 2.0 验算：个人高级版（月付）+ 团队高级版（4 席），基于 {seedsCount} 个视频模型种子计算 15s 成本、扣分、收入和毛利。
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ validateOnly: true })}
          disabled={runningValidation}
          className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {runningValidation ? "校验中…" : "运行校验"}
        </button>
      </header>

      {message ? (
        <p className={`rounded px-3 py-2 text-sm ${validation?.ok ? "bg-[#f6ffed] text-[#389e0d]" : "bg-[#fff1f0] text-[#cf1322]"}`}>
          {message}
        </p>
      ) : null}

      {Object.entries(grouped).map(([scenarioLabel, scenarioRows]) => (
        <section key={scenarioLabel} className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
          <h2 className="border-b px-3 py-2 text-sm font-medium">{scenarioLabel}</h2>
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs text-[#8c8c8c]">
              <tr>
                <th className="px-3 py-2">模型</th>
                <th className="px-3 py-2 text-right">15s 用量</th>
                <th className="px-3 py-2 text-right">成本</th>
                <th className="px-3 py-2 text-right">积分</th>
                <th className="px-3 py-2 text-right">收入</th>
                <th className="px-3 py-2 text-right">毛利</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows.map((row) => (
                <tr key={`${row.scenarioKey}:${row.model}`} className="border-t">
                  <td className="px-3 py-2 font-medium">{row.model}</td>
                  <td className="px-3 py-2 text-right">{row.usageSeconds}s</td>
                  <td className="px-3 py-2 text-right">¥{row.costYuan.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right">{row.credits}</td>
                  <td className="px-3 py-2 text-right">¥{row.revenueYuan.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right">{(row.marginRate * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
