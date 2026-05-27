"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

const PLAYGROUND_KEY = "gateway_playground_api_key";

type ApiKeyRow = {
  id: string;
  name: string;
  keyMasked: string;
  createdAt: string;
};

export default function DashboardKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/book-mall/api/gateway/api-keys");
    const data = (await res.json().catch(() => null)) as {
      apiKeys?: ApiKeyRow[];
    } | null;
    if (res.ok) setKeys(data?.apiKeys ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/book-mall/api/gateway/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        apiKey?: { key: string };
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "创建失败");
        return;
      }
      setRawKey(data?.apiKey?.key ?? null);
      if (data?.apiKey?.key) {
        try {
          sessionStorage.setItem(PLAYGROUND_KEY, data.apiKey.key);
        } catch {
          /* ignore */
        }
      }
      setName("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id: string) {
    if (!window.confirm("确定撤销此 API 密钥？")) return;
    if (!window.confirm("撤销后不可恢复，使用该密钥的客户端将立即失效。")) return;
    await fetch(`/api/book-mall/api/gateway/api-keys?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">API 密钥</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          调用 <code className="text-white/80">/api/v1</code> 时使用{" "}
          <code className="text-white/80">Authorization: Bearer sk-gw-…</code>
        </p>
      </div>

      {rawKey ? (
        <div className="rounded-xl border border-[var(--gw-accent)]/40 bg-[var(--gw-accent)]/10 p-4">
          <p className="text-sm font-medium text-[var(--gw-accent)]">
            请立即复制保存，此密钥仅显示一次：
          </p>
          <code className="mt-2 block break-all rounded bg-black/40 p-3 text-sm text-white">
            {rawKey}
          </code>
          <button
            type="button"
            className="gw-btn-ghost mt-3 text-sm"
            onClick={() => setRawKey(null)}
          >
            我已保存
          </button>
          <Link href="/dashboard/playground" className="gw-btn mt-3 ml-2 inline-block text-sm">
            去 API 调试
          </Link>
        </div>
      ) : null}

      <form onSubmit={onCreate} className="gw-card flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-sm text-[var(--gw-muted)]">名称</span>
          <input
            className="gw-input"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit" className="gw-btn" disabled={loading}>
          {loading ? "创建中…" : "创建密钥"}
        </button>
        {error ? <p className="w-full text-sm text-red-400">{error}</p> : null}
      </form>

      <div className="gw-card overflow-x-auto">
        <table className="gw-table min-w-[480px]">
          <thead>
            <tr>
              <th>名称</th>
              <th>密钥</th>
              <th>创建时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="font-mono text-xs">{k.keyMasked}</td>
                <td className="text-xs">
                  {new Date(k.createdAt).toLocaleString("zh-CN")}
                </td>
                <td>
                  <button
                    type="button"
                    className="text-sm text-red-400 hover:underline"
                    onClick={() => void onRevoke(k.id)}
                  >
                    撤销
                  </button>
                </td>
              </tr>
            ))}
            {!keys.length ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[var(--gw-muted)]">
                  暂无密钥
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
