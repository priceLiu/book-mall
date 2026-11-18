"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Ledger = { type: string; credits: number };

type TaskRow = {
  id: string;
  nodeId: string;
  lane: "text" | "image";
  kind: string;
  status: string;
  model: string;
  textOutput: string | null;
  ossUrl: string | null;
  ephemeralUrl: string | null;
  failMessage: string | null;
  gatewayLogId: string | null;
  gatewayStatus: string | null;
  creditsCharged: number | null;
  gatewayFail: string | null;
  ledger: Ledger[];
};

type Status = {
  ok: boolean;
  error?: string;
  projectId: string;
  projectName: string;
  balance: number | null;
  reserved: number | null;
  total: number;
  terminalCount: number;
  tasks: TaskRow[];
};

type StartResult = {
  ok: boolean;
  error?: string;
  projectId?: string;
  projectName?: string;
  userId?: string;
  balanceBefore?: number;
  textModel?: string;
  imageModel?: string;
};

export function GenLoadTestClient() {
  const [userId, setUserId] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startInfo, setStartInfo] = useState<StartResult | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  const refresh = useCallback(async (projectId: string) => {
    const r = await fetch(
      `/api/dev/canvas/gen-load-test/status?projectId=${encodeURIComponent(projectId)}`,
      { method: "POST" },
    );
    const data = (await r.json()) as Status;
    if (!r.ok || !data.ok) throw new Error(data.error ?? "刷新失败");
    setStatus(data);
    return data;
  }, []);

  useEffect(() => {
    const projectId = startInfo?.projectId;
    if (!projectId || !status) return;
    if (status.total > 0 && status.terminalCount === status.total && status.reserved === 0) return;
    const id = window.setInterval(() => {
      void refresh(projectId).catch((e) => setError(e instanceof Error ? e.message : "刷新失败"));
    }, 3000);
    return () => window.clearInterval(id);
  }, [refresh, startInfo?.projectId, status]);

  async function start() {
    setStarting(true);
    setError(null);
    setStatus(null);
    try {
      const r = await fetch("/api/dev/canvas/gen-load-test/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim() || undefined }),
      });
      const data = (await r.json()) as StartResult;
      if (!r.ok || !data.ok || !data.projectId) throw new Error(data.error ?? "启动失败");
      setStartInfo(data);
      await refresh(data.projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动失败");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/dev" className="text-sm text-zinc-400 hover:text-white">
        ← 开发导航
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">画布生图 / 生文本全链路</h1>
      <p className="mt-2 text-sm text-zinc-400">
        按画布正常路径同时发起 5 条文本（ai-engine → Gateway chat）和 5 条生图（image-engine → 占槽 → 百炼文生图）。会真实扣积分。
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm text-zinc-300">
          用户 ID（可空，自动选已绑 DeepSeek + 百炼的账号）
          <input
            className="mt-1 block w-80 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="留空自动选择"
          />
        </label>
        <button
          type="button"
          disabled={starting}
          onClick={() => void start()}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          {starting ? "10 条正在跑…" : "同时发起 5 文本 + 5 生图"}
        </button>
      </div>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {startInfo?.projectId ? (
        <p className="mt-4 text-sm text-zinc-400">
          项目 {startInfo.projectName} · {startInfo.projectId}
          {startInfo.balanceBefore != null ? ` · 开始余额 ${startInfo.balanceBefore}` : ""}
          {startInfo.textModel ? ` · 文本 ${startInfo.textModel}` : ""}
          {startInfo.imageModel ? ` · 生图 ${startInfo.imageModel}` : ""}
        </p>
      ) : null}
      {status ? (
        <>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded bg-zinc-800 px-2 py-1">
              完成 {status.terminalCount}/{status.total}
            </span>
            <span className="rounded bg-zinc-800 px-2 py-1">余额 {status.balance ?? "—"}</span>
            <span className="rounded bg-zinc-800 px-2 py-1">冻结 {status.reserved ?? "—"}</span>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2">类型</th>
                  <th className="px-3 py-2">任务</th>
                  <th className="px-3 py-2">Gateway</th>
                  <th className="px-3 py-2">积分</th>
                  <th className="px-3 py-2">结果</th>
                </tr>
              </thead>
              <tbody>
                {status.tasks.map((task) => (
                  <tr key={task.id} className="border-t border-zinc-800">
                    <td className="px-3 py-2">{task.lane === "text" ? "文本" : "生图"}</td>
                    <td className="px-3 py-2">
                      <div>{task.status}</div>
                      <div className="font-mono text-xs text-zinc-500">{task.nodeId}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{task.gatewayStatus ?? "—"}</div>
                      <div className="font-mono text-xs text-zinc-500">{task.gatewayLogId ?? "无日志"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{task.creditsCharged ?? "—"}</div>
                      <div className="text-xs text-zinc-500">
                        {task.ledger.map((row) => `${row.type} ${row.credits}`).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-300">
                      {task.textOutput || task.failMessage || task.gatewayFail || task.ossUrl || task.ephemeralUrl || "—"}
                    </td>
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
