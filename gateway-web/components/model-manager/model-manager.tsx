"use client";

import { useCallback, useMemo, useState } from "react";

import { CredentialEditModal } from "./credential-edit-modal";
import { ConfirmModal } from "./confirm-modal";
import type { CatalogGroup, CredentialRow, ModelTab } from "./types";
import { formatProviderKindLabel } from "@/lib/gateway-model-display";
import { ProviderApplyLink } from "@/lib/provider-apply-urls";

const TAB_LABELS: Record<ModelTab, string> = {
  text: "Text Models",
  image: "Image Models",
  function: "Function Models",
};

function tagClass(kind: "provider" | "model" | "cap" | "warn") {
  switch (kind) {
    case "provider":
      return "border-white/15 bg-white/10 text-zinc-300";
    case "model":
      return "border-blue-500/30 bg-blue-500/15 text-blue-200";
    case "cap":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "warn":
      return "border-amber-500/30 bg-amber-500/15 text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-zinc-400";
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
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">
          {toast}
        </div>
      ) : null}

      <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
        {(Object.keys(TAB_LABELS) as ModelTab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-2 text-sm transition ${
              tab === key
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const creds = credsByKind.get(g.providerKind) ?? [];
          const primary = creds.find((c) => c.active) ?? creds[0];
          const disabled = !primary?.active;

          return (
            <div key={g.providerKind} className="gw-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{g.label}</h2>
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
                    {g.models.slice(0, 6).map((m) => (
                      <span
                        key={m.modelKey}
                        className={`rounded-full border px-2 py-0.5 text-xs ${tagClass("model")}`}
                      >
                        {m.displayName}
                      </span>
                    ))}
                    {g.models.length > 6 ? (
                      <span className="text-xs text-zinc-500">
                        +{g.models.length - 6} 更多
                      </span>
                    ) : null}
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
                    <p className="text-xs text-zinc-500">
                      凭证：{primary.alias} · {primary.apiKeyMasked}
                      {primary.lastTestStatus
                        ? ` · 最近测试 ${primary.lastTestStatus}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500">尚未绑定厂商 API Key</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                  {primary ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === primary.id}
                        className="text-zinc-400 hover:text-white disabled:opacity-50"
                        onClick={() => void onTest(primary)}
                      >
                        Test Connection
                      </button>
                      <button
                        type="button"
                        className="text-zinc-400 hover:text-white"
                        onClick={() => openEdit(primary)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === primary.id}
                        className="text-zinc-400 hover:text-white disabled:opacity-50"
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

              {creds.length > 1 ? (
                <div className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
                  另有 {creds.length - 1} 条同厂商凭证（
                  {creds
                    .filter((c) => c.id !== primary?.id)
                    .map((c) => c.alias)
                    .join("、")}
                  ）
                </div>
              ) : null}
            </div>
          );
        })}

        {groups.length === 0 ? (
          <div className="gw-card text-sm text-zinc-500">此分类暂无模型</div>
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
