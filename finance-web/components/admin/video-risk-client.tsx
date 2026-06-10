"use client";

import { useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiPost } from "@/lib/finance-viewer";

type AbnormalUser = {
  userId: string;
  tier: string;
  signals: string[];
  videoCount24h: number;
  dailyCap: number;
};

export function VideoRiskClient() {
  const base = useBookMallBaseUrl();
  const [users, setUsers] = useState<AbnormalUser[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function scan() {
    if (!base) return;
    setLoading(true);
    const r = await financeApiPost<{ ok: boolean; users: AbnormalUser[] }>(
      base,
      "/api/finance/admin/video-risk/scan",
      {},
    );
    setLoading(false);
    if (r.ok && r.data.ok) {
      setUsers(r.data.users);
      setMsg(`扫描完成：${r.data.users.length} 条异常`);
    } else setMsg(r.ok ? "扫描失败" : r.error);
  }

  return (
    <FinancePageShell>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">视频风控</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">扫描近 24h 视频结算异常用户。</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={scan}
          className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          立即扫描
        </button>
      </header>
      {msg ? <p className="text-sm text-[#1890ff]">{msg}</p> : null}
      <table className="w-full text-sm">
        <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
          <tr>
            <th className="px-2 py-1 text-left">用户</th>
            <th className="px-2 py-1 text-left">档位</th>
            <th className="px-2 py-1 text-right">24h 视频</th>
            <th className="px-2 py-1 text-right">日上限</th>
            <th className="px-2 py-1 text-left">信号</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.userId} className="border-t">
              <td className="px-2 py-1 font-mono text-xs">{u.userId.slice(0, 12)}…</td>
              <td className="px-2 py-1">{u.tier}</td>
              <td className="px-2 py-1 text-right">{u.videoCount24h}</td>
              <td className="px-2 py-1 text-right">{u.dailyCap}</td>
              <td className="px-2 py-1">{u.signals.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </FinancePageShell>
  );
}
