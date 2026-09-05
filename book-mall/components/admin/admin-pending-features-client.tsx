"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FileText,
  FolderInput,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminDocPreviewModal } from "@/components/admin/admin-doc-preview-modal";
import { formatAdminDocFileTime } from "@/lib/admin/format-doc-file-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ADMIN_PENDING_FEATURE_ROADMAP_TITLES,
  resolveAdminPendingFeatureListKind,
  type AdminPendingFeatureListKind,
} from "@/lib/admin/pending-feature-roadmap";

export type PendingFeatureItem = {
  id: string;
  title: string;
  description: string;
  docPath: string;
  listKind?: AdminPendingFeatureListKind | null;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  docFileCreatedAt?: string | null;
  docFileUpdatedAt?: string | null;
};

type FilterTab = "all" | "features" | "pending" | "done";

type FlashNotice = {
  text: string;
  tone: "info" | "success" | "error";
};

function AdminFlashToast({ notice }: { notice: FlashNotice | null }) {
  if (!notice) return null;

  const toneClass =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : notice.tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-[#d0d7de] bg-white text-[#1f2328] shadow-lg";

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[300] flex max-w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      {notice.tone === "info" ? <Loader2 className="size-4 shrink-0 animate-spin" /> : null}
      <span>{notice.text}</span>
    </div>
  );
}

function ListKindSelector({
  value,
  onChange,
}: {
  value: AdminPendingFeatureListKind;
  onChange: (v: AdminPendingFeatureListKind) => void;
}) {
  return (
    <div>
      <Label className="text-xs">分类</Label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {(
          [
            ["FEATURE", "待做功能"],
            ["PENDING", "待处理"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            onClick={() => onChange(kind)}
            className={
              value === kind
                ? "rounded-full bg-[#0969da] px-3 py-1 text-xs font-medium text-white"
                : "rounded-full border border-[#d0d7de] bg-white px-3 py-1 text-xs text-[#656d76] hover:border-[#0969da]/40"
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeatureEditFields({
  title,
  description,
  docPath,
  listKind,
  showListKind,
  onTitle,
  onDescription,
  onDocPath,
  onListKind,
}: {
  title: string;
  description: string;
  docPath: string;
  listKind?: AdminPendingFeatureListKind;
  showListKind?: boolean;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  onDocPath: (v: string) => void;
  onListKind?: (v: AdminPendingFeatureListKind) => void;
}) {
  return (
    <div className="mt-2 grid gap-2">
      {showListKind && listKind && onListKind ? (
        <ListKindSelector value={listKind} onChange={onListKind} />
      ) : null}
      <div>
        <Label className="text-xs">功能名称</Label>
        <Input value={title} onChange={(e) => onTitle(e.target.value)} className="mt-1 h-8" />
      </div>
      <div>
        <Label className="text-xs">功能描述</Label>
        <Textarea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          rows={2}
          className="mt-1 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">关联文档</Label>
        <Input
          value={docPath}
          onChange={(e) => onDocPath(e.target.value)}
          className="mt-1 h-8 font-mono text-xs"
          placeholder="docs/示例.md"
        />
      </div>
    </div>
  );
}

export function AdminPendingFeaturesClient() {
  const [items, setItems] = useState<PendingFeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashNotice | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tab, setTab] = useState<FilterTab>("features");
  const [actingId, setActingId] = useState<string | null>(null);
  const [docPreviewPath, setDocPreviewPath] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDocPath, setFormDocPath] = useState("");
  const [formListKind, setFormListKind] = useState<AdminPendingFeatureListKind>("FEATURE");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDocPath, setEditDocPath] = useState("");
  const [editListKind, setEditListKind] = useState<AdminPendingFeatureListKind>("PENDING");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pending-features");
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { items: PendingFeatureItem[] };
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showFlash = useCallback((text: string, tone: FlashNotice["tone"], autoHideMs?: number) => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setFlash({ text, tone });
    if (typeof autoHideMs === "number" && autoHideMs > 0) {
      flashTimerRef.current = setTimeout(() => {
        setFlash(null);
        flashTimerRef.current = null;
      }, autoHideMs);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const itemListKind = (item: PendingFeatureItem) =>
    resolveAdminPendingFeatureListKind(item);

  const featuresCount = useMemo(
    () => items.filter((i) => !i.completed && itemListKind(i) === "FEATURE").length,
    [items],
  );
  const pendingCount = useMemo(
    () => items.filter((i) => !i.completed && itemListKind(i) === "PENDING").length,
    [items],
  );
  const doneCount = items.filter((i) => i.completed).length;

  const filtered = useMemo(() => {
    if (tab === "features") {
      const list = items.filter(
        (i) => !i.completed && itemListKind(i) === "FEATURE",
      );
      const order = new Map<string, number>(
        ADMIN_PENDING_FEATURE_ROADMAP_TITLES.map((t, i) => [t, i]),
      );
      return list.sort(
        (a, b) =>
          (order.get(a.title.trim()) ?? 999) - (order.get(b.title.trim()) ?? 999),
      );
    }
    if (tab === "pending") {
      return items.filter(
        (i) => !i.completed && itemListKind(i) === "PENDING",
      );
    }
    if (tab === "done") return items.filter((i) => i.completed);
    return items;
  }, [items, tab]);

  const toggleCompleted = async (item: PendingFeatureItem) => {
    setActingId(item.id);
    try {
      const res = await fetch(`/api/admin/pending-features/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !item.completed }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "更新失败");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setActingId(null);
    }
  };

  const startEdit = (item: PendingFeatureItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditDocPath(item.docPath);
    setEditListKind(itemListKind(item));
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const title = editTitle.trim();
    if (!title) {
      setError("功能名称不能为空");
      return;
    }
    setActingId(id);
    setError(null);
    showFlash("保存中…", "info");
    try {
      const res = await fetch(`/api/admin/pending-features/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: editDescription.trim(),
          docPath: editDocPath.trim(),
          listKind: editListKind,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "保存失败");
      }
      setEditingId(null);
      setError(null);
      await load();
      showFlash("修改成功", "success", 2500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setError(msg);
      showFlash(msg, "error", 3500);
    } finally {
      setActingId(null);
    }
  };

  const submitNew = async () => {
    const title = formTitle.trim();
    if (!title) {
      setError("请填写功能名称");
      return;
    }
    setSaving(true);
    setError(null);
    showFlash("保存中…", "info");
    try {
      const res = await fetch("/api/admin/pending-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: formDescription.trim(),
          docPath: formDocPath.trim(),
          listKind: formListKind,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "创建失败");
      }
      setFormTitle("");
      setFormDescription("");
      setFormDocPath("");
      setFormListKind("FEATURE");
      setShowForm(false);
      setTab(formListKind === "FEATURE" ? "features" : "pending");
      await load();
      showFlash("新增成功", "success", 2500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "创建失败";
      setError(msg);
      showFlash(msg, "error", 3500);
    } finally {
      setSaving(false);
    }
  };

  const importFromDocs = async () => {
    setImporting(true);
    setError(null);
    showFlash("导入中…", "info");
    try {
      const res = await fetch("/api/admin/pending-features/import-docs", {
        method: "POST",
      });
      const j = (await res.json()) as {
        created?: number;
        skipped?: number;
        totalInDocs?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "导入失败");
      await load();
      setTab("pending");
      showFlash(
        `导入完成：新增 ${j.created ?? 0} 条，跳过 ${j.skipped ?? 0} 条`,
        "success",
        3500,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "导入失败";
      setError(msg);
      showFlash(msg, "error", 3500);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `全部（${items.length}）`],
              ["features", `待做功能（${featuresCount}）`],
              ["pending", `待处理（${pendingCount}）`],
              ["done", `已完成（${doneCount}）`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                tab === key
                  ? "rounded-full bg-[#0969da] px-4 py-1.5 text-sm text-white"
                  : "rounded-full border border-[#d0d7de] bg-white px-4 py-1.5 text-sm text-[#656d76] hover:border-[#0969da]/40"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => void importFromDocs()}
          >
            {importing ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <FolderInput className="mr-1 size-3.5" />
            )}
            从 docs 导入
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RotateCcw className="mr-1 size-3.5" />
            刷新
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setFormListKind(tab === "pending" ? "PENDING" : "FEATURE");
              setShowForm((v) => !v);
            }}
          >
            <Plus className="mr-1 size-3.5" />
            新增
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-[#d0d7de] bg-[#f6f8fa] p-4">
          <h2 className="text-sm font-semibold text-[#1f2328]">新增条目</h2>
          <FeatureEditFields
            title={formTitle}
            description={formDescription}
            docPath={formDocPath}
            listKind={formListKind}
            showListKind
            onTitle={setFormTitle}
            onDescription={setFormDescription}
            onDocPath={setFormDocPath}
            onListKind={setFormListKind}
          />
          <p className="text-xs text-[#656d76]">
            关联文档路径相对仓库根目录，须以 docs/ 或 book-mall/doc/ 开头。
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void submitNew()}>
              {saving ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  保存中…
                </>
              ) : (
                "保存"
              )}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 py-12 text-sm text-[#656d76]">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d0d7de] py-12 text-center text-sm text-[#656d76]">
          {tab === "features"
            ? "待做功能清单为空。可在「新增」添加，或由 seed / docs 导入初始化。"
            : tab === "pending"
            ? "暂无待处理项。可点击「从 docs 导入」批量导入 docs/ 下全部 .md"
            : "当前筛选下无记录"}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const busy = actingId === item.id;
            const editing = editingId === item.id;
            return (
              <li
                key={item.id}
                className={`rounded-xl border px-4 py-3 ${
                  item.completed
                    ? "border-[#d0d7de] bg-[#f6f8fa] opacity-90"
                    : "border-[#d0d7de] bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <button
                    type="button"
                    disabled={busy || editing}
                    onClick={() => void toggleCompleted(item)}
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition ${
                      item.completed
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-[#d0d7de] bg-white text-transparent hover:border-[#0969da]"
                    }`}
                    title={item.completed ? "标记为未完成" : "标记为已完成"}
                  >
                    <Check className="size-4" strokeWidth={2.5} />
                  </button>

                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <>
                        <FeatureEditFields
                          title={editTitle}
                          description={editDescription}
                          docPath={editDocPath}
                          listKind={editListKind}
                          showListKind
                          onTitle={setEditTitle}
                          onDescription={setEditDescription}
                          onDocPath={setEditDocPath}
                          onListKind={setEditListKind}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void saveEdit(item.id)}
                          >
                            {busy ? (
                              <>
                                <Loader2 className="mr-1 size-3.5 animate-spin" />
                                保存中…
                              </>
                            ) : (
                              "保存"
                            )}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                            取消
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-medium ${
                              item.completed
                                ? "text-[#656d76] line-through"
                                : "text-[#1f2328]"
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.completed ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                              已完成
                            </span>
                          ) : itemListKind(item) === "FEATURE" ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-900">
                              待做功能
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                              待处理
                            </span>
                          )}
                        </div>
                        {item.description ? (
                          <p className="mt-1 text-sm text-[#656d76]">{item.description}</p>
                        ) : null}
                        {item.docPath ? (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <code className="rounded bg-[#eef1f4] px-1.5 py-0.5 font-mono text-[11px] text-[#656d76]">
                              {item.docPath}
                            </code>
                            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#656d76]">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[#0969da] hover:underline"
                                onClick={() => setDocPreviewPath(item.docPath)}
                              >
                                <FileText className="size-3" />
                                预览文档
                              </button>
                              {item.docFileCreatedAt ? (
                                <span title={item.docFileCreatedAt}>
                                  创建 {formatAdminDocFileTime(item.docFileCreatedAt)}
                                </span>
                              ) : null}
                              {item.docFileUpdatedAt ? (
                                <span title={item.docFileUpdatedAt}>
                                  修改 {formatAdminDocFileTime(item.docFileUpdatedAt)}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  {!editing ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        disabled={busy}
                        onClick={() => startEdit(item)}
                        title="编辑"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {docPreviewPath ? (
        <AdminDocPreviewModal path={docPreviewPath} onClose={() => setDocPreviewPath(null)} />
      ) : null}

      <AdminFlashToast notice={flash} />
    </div>
  );
}
