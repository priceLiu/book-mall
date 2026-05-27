"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

const PROVIDERS = ["KIE", "BAILIAN", "DEEPSEEK", "DASHSCOPE", "HUNYUAN"] as const;

type CredentialRow = {
  id: string;
  alias: string;
  providerKind: string;
  apiKeyMasked: string;
  baseUrl: string | null;
  createdAt: string;
};

export default function DashboardCredentialsPage() {
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [alias, setAlias] = useState("");
  const [providerKind, setProviderKind] =
    useState<(typeof PROVIDERS)[number]>("KIE");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/book-mall/api/gateway/credentials");
    const data = (await res.json().catch(() => null)) as {
      credentials?: CredentialRow[];
    } | null;
    if (res.ok) setRows(data?.credentials ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/book-mall/api/gateway/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias,
          providerKind,
          apiKey,
          baseUrl: baseUrl.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "添加失败");
        return;
      }
      setAlias("");
      setApiKey("");
      setBaseUrl("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string, aliasName: string) {
    if (!window.confirm(`确定删除厂商凭证「${aliasName}」？`)) return;
    if (!window.confirm("删除后不可恢复，绑定该凭证的 API 密钥可能无法路由。")) return;
    await fetch(
      `/api/book-mall/api/gateway/credentials?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">厂商凭证</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          BYOK：添加 KIE / 百炼 / DeepSeek / DashScope / 混元 3D 等厂商 API Key，由 Gateway 代转发。
        </p>
      </div>

      <form onSubmit={onCreate} className="gw-card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">别名</span>
            <input
              className="gw-input"
              required
              maxLength={60}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">厂商</span>
            <select
              className="gw-input"
              value={providerKind}
              onChange={(e) =>
                setProviderKind(e.target.value as (typeof PROVIDERS)[number])
              }
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">API Key</span>
            <input
              className="gw-input font-mono"
              required
              minLength={8}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">
              Base URL（可选）
            </span>
            <input
              className="gw-input font-mono text-xs"
              placeholder="https://…"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button type="submit" className="gw-btn" disabled={loading}>
          {loading ? "保存中…" : "添加凭证"}
        </button>
      </form>

      <div className="gw-card overflow-x-auto">
        <table className="gw-table min-w-[560px]">
          <thead>
            <tr>
              <th>别名</th>
              <th>厂商</th>
              <th>Key</th>
              <th>Base URL</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.alias}</td>
                <td>{r.providerKind}</td>
                <td className="font-mono text-xs">{r.apiKeyMasked}</td>
                <td className="max-w-[200px] truncate font-mono text-xs">
                  {r.baseUrl ?? "—"}
                </td>
                <td>
                  <button
                    type="button"
                    className="text-sm text-red-400 hover:underline"
                    onClick={() => void onDelete(r.id, r.alias)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[var(--gw-muted)]">
                  暂无凭证
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
