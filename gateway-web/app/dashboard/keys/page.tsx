"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { ConfirmModal } from "@/components/model-manager/confirm-modal";
import { copyTextToClipboard } from "@/lib/clipboard";

const PLAYGROUND_KEY = "gateway_playground_api_key";

type ApiKeyScope = "PLATFORM" | "PERSONAL";
type BookRole = "ADMIN" | "USER";

type ApiKeyRow = {
  id: string;
  name: string;
  scope: ApiKeyScope;
  keyMasked: string;
  createdAt: string;
};

const SCOPE_LABEL: Record<ApiKeyScope, string> = {
  PLATFORM: "Platform Admin",
  PERSONAL: "Personal",
};

export default function DashboardKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [bookRole, setBookRole] = useState<BookRole>("USER");
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiKeyScope>("PERSONAL");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revokeStep, setRevokeStep] = useState<0 | 1>(0);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [rawKeyCopied, setRawKeyCopied] = useState(false);

  async function copyKeyText(text: string, keyId?: string) {
    const ok = await copyTextToClipboard(text);
    if (!ok) return;
    if (keyId) {
      setCopiedKeyId(keyId);
      window.setTimeout(() => setCopiedKeyId(null), 2000);
    } else {
      setRawKeyCopied(true);
      window.setTimeout(() => setRawKeyCopied(false), 2000);
    }
  }

  const hasPlatformKey = keys.some((k) => k.scope === "PLATFORM");

  const load = useCallback(async () => {
    const res = await fetch("/api/book-mall/api/gateway/api-keys");
    const data = (await res.json().catch(() => null)) as {
      apiKeys?: ApiKeyRow[];
      bookRole?: BookRole;
    } | null;
    if (res.ok) {
      setKeys(data?.apiKeys ?? []);
      setBookRole(data?.bookRole === "ADMIN" ? "ADMIN" : "USER");
    }
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
        body: JSON.stringify({
          name: name.trim() || undefined,
          scope,
        }),
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
      setScope("PERSONAL");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function onRevokeConfirm() {
    if (!revokeTarget) return;
    if (revokeStep === 0) {
      setRevokeStep(1);
      return;
    }
    const id = revokeTarget.id;
    setRevokeTarget(null);
    setRevokeStep(0);
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

      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
        <p>
          <strong className="font-medium text-white">Personal</strong>
          ：个人密钥，在 Book 个人中心关联后供 Canvas / Story / 工具站使用。
        </p>
        {bookRole === "ADMIN" ? (
          <p className="mt-2">
            <strong className="font-medium text-white">Platform Admin</strong>
            ：全站管理员密钥（原「Canvas Pilot」已统一为此名称），用于平台级调试与外部直连；Book
            子站代理仍应关联 Personal Key。
          </p>
        ) : (
          <p className="mt-2 text-zinc-500">
            Platform Admin 密钥仅 Book 管理员可创建。
          </p>
        )}
      </div>

      {rawKey ? (
        <div className="rounded-xl border border-[var(--gw-accent)]/40 bg-[var(--gw-accent)]/10 p-4">
          <p className="text-sm font-medium text-[var(--gw-accent)]">
            请立即复制保存，此密钥仅显示一次：
          </p>
          <div className="mt-2 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-black/40 p-3 text-sm text-white">
              {rawKey}
            </code>
            <button
              type="button"
              className="gw-btn shrink-0 text-sm"
              onClick={() => void copyKeyText(rawKey)}
            >
              {rawKeyCopied ? "已复制" : "复制"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="gw-btn text-sm"
              onClick={async () => {
                await copyKeyText(rawKey);
                setRawKey(null);
              }}
            >
              复制并关闭
            </button>
            <button
              type="button"
              className="gw-btn-ghost text-sm"
              onClick={() => setRawKey(null)}
            >
              我已保存
            </button>
            <Link href="/dashboard/playground" className="gw-btn-ghost inline-block text-sm">
              去 API 调试
            </Link>
          </div>
        </div>
      ) : null}

      <form onSubmit={onCreate} className="gw-card space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">类型</span>
            <select
              className="gw-input"
              value={scope}
              onChange={(e) => setScope(e.target.value as ApiKeyScope)}
            >
              <option value="PERSONAL">Personal（个人）</option>
              {bookRole === "ADMIN" && !hasPlatformKey ? (
                <option value="PLATFORM">Platform Admin（全站管理员）</option>
              ) : null}
            </select>
          </label>
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">名称（可选）</span>
            <input
              className="gw-input"
              maxLength={60}
              placeholder={
                scope === "PLATFORM" ? "Platform Admin" : "Personal Key"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button type="submit" className="gw-btn" disabled={loading}>
            {loading ? "创建中…" : "创建密钥"}
          </button>
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </form>

      <div className="gw-card overflow-x-auto">
        <table className="gw-table min-w-[560px]">
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>密钥</th>
              <th>创建时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      k.scope === "PLATFORM"
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {SCOPE_LABEL[k.scope]}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{k.keyMasked}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-[var(--gw-accent)] hover:underline"
                      title="复制密钥前缀（完整密钥仅在创建时显示一次）"
                      onClick={() => void copyKeyText(k.keyMasked, k.id)}
                    >
                      {copiedKeyId === k.id ? "已复制" : "复制"}
                    </button>
                  </div>
                </td>
                <td className="text-xs">
                  {new Date(k.createdAt).toLocaleString("zh-CN")}
                </td>
                <td>
                  <button
                    type="button"
                    className="text-sm text-red-400 hover:underline"
                    onClick={() => {
                      setRevokeTarget(k);
                      setRevokeStep(0);
                    }}
                  >
                    撤销
                  </button>
                </td>
              </tr>
            ))}
            {!keys.length ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[var(--gw-muted)]">
                  暂无密钥
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={Boolean(revokeTarget)}
        title={revokeStep === 0 ? "撤销 API 密钥？" : "再次确认 · 不可恢复"}
        message={
          revokeStep === 0
            ? `将撤销「${revokeTarget?.name ?? ""}」（${revokeTarget ? SCOPE_LABEL[revokeTarget.scope] : ""}）。使用该密钥的客户端将立即失效。`
            : "撤销后不可恢复，是否继续？"
        }
        confirmLabel={revokeStep === 0 ? "继续" : "永久撤销"}
        danger={revokeStep === 1}
        onCancel={() => {
          setRevokeTarget(null);
          setRevokeStep(0);
        }}
        onConfirm={() => void onRevokeConfirm()}
      />
    </div>
  );
}
