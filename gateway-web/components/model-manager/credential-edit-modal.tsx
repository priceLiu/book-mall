"use client";

import { FormEvent, useEffect, useState } from "react";

import type { CredentialRow } from "./types";
import { formatProviderKindLabel } from "@/lib/gateway-model-display";
import { ProviderApplyLink } from "@/lib/provider-apply-urls";

const PROVIDERS = [
  "KIE",
  "BAILIAN",
  "DEEPSEEK",
  "DASHSCOPE",
  "HUNYUAN",
  "VOLCENGINE",
] as const;

export function CredentialEditModal({
  open,
  credential,
  defaultProviderKind,
  onClose,
  onSaved,
}: {
  open: boolean;
  credential: CredentialRow | null;
  defaultProviderKind: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = Boolean(credential);
  const [alias, setAlias] = useState("");
  const [providerKind, setProviderKind] =
    useState<(typeof PROVIDERS)[number]>("DEEPSEEK");
  const [apiKey, setApiKey] = useState("");
  const [volcengineAccessKeyId, setVolcengineAccessKeyId] = useState("");
  const [volcengineSecretAccessKey, setVolcengineSecretAccessKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [active, setActive] = useState(true);
  const [channel, setChannel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAlias(credential?.alias ?? formatProviderKindLabel(defaultProviderKind));
    setProviderKind(
      (PROVIDERS.includes(defaultProviderKind as (typeof PROVIDERS)[number])
        ? defaultProviderKind
        : "DEEPSEEK") as (typeof PROVIDERS)[number],
    );
    setApiKey("");
    setVolcengineAccessKeyId("");
    setVolcengineSecretAccessKey("");
    setBaseUrl(credential?.baseUrl ?? "");
    setActive(credential?.active ?? true);
    setChannel(credential?.channel ?? "");
    setIsDefault(credential?.isDefaultForProvider ?? false);
    setError("");
  }, [open, credential, defaultProviderKind]);

  if (!open) return null;

  const isVolcengine =
    (isEdit ? credential?.providerKind : providerKind) === "VOLCENGINE";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isEdit && credential) {
        const res = await fetch("/api/book-mall/api/gateway/credentials", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: credential.id,
            alias,
            baseUrl: baseUrl.trim() || null,
            active,
            channel: channel.trim() || null,
            isDefaultForProvider: isDefault,
            ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            ...(isVolcengine && volcengineAccessKeyId.trim()
              ? { volcengineAccessKeyId: volcengineAccessKeyId.trim() }
              : {}),
            ...(isVolcengine && volcengineSecretAccessKey.trim()
              ? { volcengineSecretAccessKey: volcengineSecretAccessKey.trim() }
              : {}),
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setError(data?.error ?? "保存失败");
          return;
        }
      } else {
        if (!apiKey.trim()) {
          setError("请填写 API Key");
          return;
        }
        const res = await fetch("/api/book-mall/api/gateway/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alias,
            providerKind,
            apiKey: apiKey.trim(),
            baseUrl: baseUrl.trim() || null,
            channel: channel.trim() || null,
            isDefaultForProvider: isDefault,
            ...(isVolcengine && volcengineAccessKeyId.trim()
              ? { volcengineAccessKeyId: volcengineAccessKeyId.trim() }
              : {}),
            ...(isVolcengine && volcengineSecretAccessKey.trim()
              ? { volcengineSecretAccessKey: volcengineSecretAccessKey.trim() }
              : {}),
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setError(data?.error ?? "添加失败");
          return;
        }
      }
      await onSaved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        className="gw-card max-h-[90vh] w-full max-w-lg overflow-y-auto gw-scrollbar-thin shadow-2xl"
        onSubmit={(e) => void onSubmit(e)}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "编辑凭证" : "添加凭证"}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-[var(--gw-ink)]">
            {isEdit ? "Edit" : "添加凭证"}
          </h3>
          <button type="button" className="text-[var(--gw-muted)] hover:text-[var(--gw-ink)]" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">Display Name</span>
            <input
              className="gw-input"
              required
              maxLength={60}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">
              渠道（可选）— 区分同厂商不同来源的 Key，如「官方自有」「某代理」
            </span>
            <input
              className="gw-input"
              maxLength={60}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="官方自有 / 渠道折扣 / 代理…"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--gw-ink)]">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Enable Status
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--gw-ink)]">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            设为该厂商默认凭证（生成默认走此 Key）
          </label>

          {!isEdit ? (
            <div>
              <span className="mb-2 block text-sm text-[var(--gw-muted)]">Provider</span>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProviderKind(p)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      providerKind === p
                        ? "border-white bg-white/15 text-[var(--gw-ink)]"
                        : "border-[var(--gw-border)] text-[var(--gw-muted)] hover:border-white/30"
                    }`}
                  >
                    {formatProviderKindLabel(p)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--gw-muted)]">
                尚无厂商 Key？{" "}
                <ProviderApplyLink providerKind={providerKind} />
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--gw-muted)]">
              Provider：{formatProviderKindLabel(credential!.providerKind)}
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">
              {isVolcengine ? "ARK API Key（Seedance 2.0 / 推理 · ark-…）" : "API Key"}
            </span>
            <input
              className="gw-input font-mono"
              type="password"
              minLength={isEdit ? 0 : 8}
              required={!isEdit}
              placeholder={isEdit ? "留空则不修改" : isVolcengine ? "ark-…" : ""}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>

          {isVolcengine ? (
            <>
              <p className="text-xs leading-relaxed text-[var(--gw-muted)]">
                仅生视频可只填 ARK API Key。私域人像入库 / 活体认证还须 IAM Access Key（与 ark Key 不同，在火山控制台「访问控制」创建）。
              </p>
              <label className="block">
                <span className="mb-1 block text-sm text-[var(--gw-muted)]">
                  Access Key ID（可选 · 私域人像 / 活体）
                </span>
                <input
                  className="gw-input font-mono text-xs"
                  type="password"
                  placeholder={isEdit ? "留空则不修改" : "AK…"}
                  value={volcengineAccessKeyId}
                  onChange={(e) => setVolcengineAccessKeyId(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-[var(--gw-muted)]">
                  Secret Access Key（可选 · 与 Access Key 成对填写）
                </span>
                <input
                  className="gw-input font-mono text-xs"
                  type="password"
                  placeholder={isEdit ? "留空则不修改" : ""}
                  value={volcengineSecretAccessKey}
                  onChange={(e) => setVolcengineSecretAccessKey(e.target.value)}
                />
              </label>
            </>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">API URL（可选）</span>
            <input
              className="gw-input font-mono text-xs"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="留空使用默认端点"
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="gw-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="gw-btn" disabled={loading}>
            {loading ? "保存中…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
