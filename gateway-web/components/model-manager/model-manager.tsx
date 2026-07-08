"use client";

import { useCallback, useMemo, useState } from "react";

import { CredentialEditModal } from "./credential-edit-modal";
import { CredentialKeyReveal } from "./credential-key-reveal";
import { ConfirmModal } from "./confirm-modal";
import type { CatalogGroup, CredentialRow, ModelTab } from "./types";
import { formatProviderKindLabel } from "@/lib/gateway-model-display";
import { ProviderApplyLink } from "@/lib/provider-apply-urls";

const TAB_LABELS: Record<ModelTab, string> = {
  text: "Text Models",
  image: "Image Models",
  video: "Video Models",
  function: "Function Models",
};

function tagClass(kind: "provider" | "model" | "cap" | "warn") {
  switch (kind) {
    case "provider":
      return "border-[var(--gw-border)] bg-white/10 text-[var(--gw-ink)]";
    case "model":
      return "border-blue-500/30 bg-blue-500/15 text-blue-200";
    case "cap":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "warn":
      return "border-amber-500/30 bg-[var(--gw-accent-muted)] text-[var(--gw-accent)]";
    default:
      return "border-[var(--gw-border)] bg-white/5 text-[var(--gw-muted)]";
  }
}

export function ModelManager({
  initialGroups,
  initialCredentials,
  tabGroups,
}: {
  initialGroups: CatalogGroup[];
  initialCredentials: CredentialRow[];
  tabGroups: Record<ModelTab, CatalogGroup[]>;
}) {
  const [tab, setTab] = useState<ModelTab>("text");
  const [credentials, setCredentials] = useState(initialCredentials);
  const [editOpen, setEditOpen] = useState(false);
  const [editCredential, setEditCredential] = useState<CredentialRow | null>(null);
  const [createKind, setCreateKind] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CredentialRow | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1>(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const groups = useMemo(() => {
    const base = tabGroups[tab] ?? [];
    const volcFull = initialGroups.find((g) => g.providerKind === "VOLCENGINE");
    if (!volcFull) return base;
    return base.map((g) =>
      g.providerKind === "VOLCENGINE" ? volcFull : g,
    );
  }, [tab, tabGroups, initialGroups]);

  const credsByKind = useMemo(() => {
    const map = new Map<string, CredentialRow[]>();
    for (const c of credentials) {
      const list = map.get(c.providerKind) ?? [];
      list.push(c);
      map.set(c.providerKind, list);
    }
    return map;
  }, [credentials]);

  const reloadCredentials = useCallback(async () => {
    const res = await fetch("/api/book-mall/api/gateway/credentials");
    const data = (await res.json().catch(() => null)) as {
      credentials?: CredentialRow[];
    } | null;
    if (res.ok) setCredentials(data?.credentials ?? []);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const openCreate = (providerKind: string) => {
    setCreateKind(providerKind);
    setEditCredential(null);
    setEditOpen(true);
  };

  const openEdit = (row: CredentialRow) => {
    setCreateKind(null);
    setEditCredential(row);
    setEditOpen(true);
  };

  const onTest = async (row: CredentialRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/book-mall/api/gateway/credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (res.ok && data?.ok) {
        showToast("连接成功");
      } else {
        showToast(data?.message ?? data?.error ?? "连接失败");
      }
      await reloadCredentials();
    } finally {
      setBusyId(null);
    }
  };

  const onToggleActive = async (row: CredentialRow) => {
    setBusyId(row.id);
    try {
      await fetch("/api/book-mall/api/gateway/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, active: !row.active }),
      });
      await reloadCredentials();
    } finally {
      setBusyId(null);
    }
  };

  const onSetDefault = async (row: CredentialRow) => {
    setBusyId(row.id);
    try {
      await fetch("/api/book-mall/api/gateway/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, action: "setDefault" }),
      });
      await reloadCredentials();
      showToast(`已将「${row.alias}」设为默认凭证`);
    } finally {
      setBusyId(null);
    }
  };

  const onClone = async (row: CredentialRow) => {
    const alias = `${row.alias} 副本`;
    setBusyId(row.id);
    try {
      const res = await fetch("/api/book-mall/api/gateway/credentials/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, alias }),
      });
      if (res.ok) {
        showToast("已克隆");
        await reloadCredentials();
      }
    } finally {
      setBusyId(null);
    }
  };

  const onDeleteConfirm = async () => {
    if (!confirmDelete) return;
    if (deleteStep === 0) {
      setDeleteStep(1);
      return;
    }
    const row = confirmDelete;
    setConfirmDelete(null);
    setBusyId(row.id);
    try {
      await fetch(
        `/api/book-mall/api/gateway/credentials?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      await reloadCredentials();
      showToast("已删除");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="rounded-lg border border-[var(--gw-border)] bg-white/5 px-4 py-2 text-sm text-[var(--gw-ink)]">
          {toast}
        </div>
      ) : null}

      <div className="flex gap-1 rounded-lg border border-[var(--gw-border)] bg-black/20 p-1">
        {(Object.keys(TAB_LABELS) as ModelTab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-2 text-sm transition ${
              tab === key
                ? "bg-white/10 text-[var(--gw-ink)]"
                : "text-[var(--gw-muted)] hover:text-[var(--gw-ink)]"
            }`}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--gw-muted)]">
        当前 Tab 按模型类型筛选。Seedance、Veo、海螺、可灵等视频模型在{" "}
        <button
          type="button"
          className="text-[var(--gw-accent)] hover:underline"
          onClick={() => setTab("video")}
        >
          Video Models
        </button>
        ；对话模型在 Text Models。
      </p>

      <div className="space-y-3">
        {groups.map((g) => {
          const creds = credsByKind.get(g.providerKind) ?? [];
          const primary =
            creds.find((c) => c.isDefaultForProvider && c.active) ??
            creds.find((c) => c.active) ??
            creds[0];
          const disabled = !primary?.active;

          return (
            <div key={g.providerKind} className="gw-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2>{g.label}</h2>
                    <span className="text-xs text-[var(--gw-muted)]">
                      {g.models.length} 个模型
                    </span>
                    <ProviderApplyLink
                      providerKind={g.providerKind}
                      className="text-xs text-[var(--gw-accent)] hover:underline"
                    />
                    {disabled || !primary ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${tagClass("warn")}`}
                      >
                        Disabled
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${tagClass("provider")}`}
                    >
                      {formatProviderKindLabel(g.providerKind)}
                    </span>
                    {g.models.map((m) => (
                      <span
                        key={m.modelKey}
                        title={m.modelKey}
                        className={`rounded-full border px-2 py-0.5 text-xs ${tagClass("model")}`}
                      >
                        {m.displayName}
                      </span>
                    ))}
                    {[...new Set(g.models.flatMap((m) => m.capabilities ?? []))].map(
                      (cap) => (
                        <span
                          key={cap}
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            cap === "Reasoning" ? tagClass("warn") : tagClass("cap")
                          }`}
                        >
                          {cap}
                        </span>
                      ),
                    )}
                  </div>
                  {primary ? (
                    <p className="text-xs text-[var(--gw-muted)]">
                      默认凭证：{primary.alias}
                      {primary.channel ? `（${primary.channel}）` : ""} ·{" "}
                      <CredentialKeyReveal credentialId={primary.id} masked={primary.apiKeyMasked} />
                      {primary.lastTestStatus
                        ? ` · 最近测试 ${primary.lastTestStatus}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--gw-muted)]">尚未绑定厂商 API Key</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                  {primary ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === primary.id}
                        className="text-[var(--gw-muted)] hover:text-[var(--gw-ink)] disabled:opacity-50"
                        onClick={() => void onTest(primary)}
                      >
                        Test Connection
                      </button>
                      <button
                        type="button"
                        className="text-[var(--gw-muted)] hover:text-[var(--gw-ink)]"
                        onClick={() => openEdit(primary)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === primary.id}
                        className="text-[var(--gw-muted)] hover:text-[var(--gw-ink)] disabled:opacity-50"
                        onClick={() => void onClone(primary)}
                      >
                        Clone
                      </button>
                      <button
                        type="button"
                        disabled={busyId === primary.id}
                        className="text-amber-400 hover:text-amber-300 disabled:opacity-50"
                        onClick={() => void onToggleActive(primary)}
                      >
                        {primary.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className="text-red-400/90 hover:text-red-300"
                        onClick={() => {
                          setConfirmDelete(primary);
                          setDeleteStep(0);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="gw-btn-secondary"
                      onClick={() => openCreate(g.providerKind)}
                    >
                      添加凭证
                    </button>
                  )}
                </div>
              </div>

              {creds.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-[var(--gw-border)] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--gw-muted)]">
                      同厂商凭证（{creds.length}）· 按渠道区分，生成默认走「默认凭证」
                    </span>
                    <button
                      type="button"
                      className="gw-btn-secondary text-xs"
                      onClick={() => openCreate(g.providerKind)}
                    >
                      + 添加凭证
                    </button>
                  </div>
                  {creds.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--gw-border)] px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[var(--gw-ink)]">{c.alias}</span>
                        {c.channel ? (
                          <span className={`rounded-full border px-2 py-0.5 ${tagClass("provider")}`}>
                            {c.channel}
                          </span>
                        ) : null}
                        {c.isDefaultForProvider ? (
                          <span className={`rounded-full border px-2 py-0.5 ${tagClass("warn")}`}>
                            默认
                          </span>
                        ) : null}
                        {!c.active ? (
                          <span className="rounded-full border border-[var(--gw-border)] px-2 py-0.5 text-[var(--gw-muted)]">
                            停用
                          </span>
                        ) : null}
                        <CredentialKeyReveal credentialId={c.id} masked={c.apiKeyMasked} />
                      </div>
                      <div className="flex items-center gap-3">
                        {!c.isDefaultForProvider && c.active ? (
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            className="text-[var(--gw-accent)] hover:underline disabled:opacity-50"
                            onClick={() => void onSetDefault(c)}
                          >
                            设为默认
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-[var(--gw-muted)] hover:text-[var(--gw-ink)]"
                          onClick={() => openEdit(c)}
                        >
                          编辑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {groups.length === 0 ? (
          <div className="gw-card text-sm text-[var(--gw-muted)]">此分类暂无模型</div>
        ) : null}
      </div>

      <CredentialEditModal
        open={editOpen}
        credential={editCredential}
        defaultProviderKind={createKind ?? editCredential?.providerKind ?? "DEEPSEEK"}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          setEditOpen(false);
          await reloadCredentials();
          showToast("已保存");
        }}
      />

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title={
          deleteStep === 0 ? "删除厂商凭证？" : "再次确认 · 不可恢复"
        }
        message={
          deleteStep === 0
            ? `将删除「${confirmDelete?.alias ?? ""}」。绑定该凭证的 API 密钥可能无法路由。`
            : "删除后无法恢复，是否继续？"
        }
        confirmLabel={deleteStep === 0 ? "继续" : "永久删除"}
        danger={deleteStep === 1}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void onDeleteConfirm()}
      />
    </div>
  );
}
