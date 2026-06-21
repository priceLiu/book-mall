"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmDestructiveTwice,
  CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
} from "@/lib/confirm-destructive-twice";

type QrCategory = "video" | "image" | "character" | "world" | "audio";

type AdminTemplateRow = {
  id: string;
  dbId: string | null;
  catalogBuiltinId: string | null;
  source: "builtin" | "catalog";
  hasOverride: boolean;
  category: QrCategory;
  kind: string;
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  promptText: string;
  sortOrder: number;
  mediaType: "image" | "video" | "audio";
};

const CATEGORIES: { id: QrCategory; label: string }[] = [
  { id: "video", label: "视频" },
  { id: "image", label: "图像" },
  { id: "character", label: "角色" },
  { id: "world", label: "世界" },
  { id: "audio", label: "音频" },
];

type FormState = {
  id: string | null;
  dbId: string | null;
  catalogBuiltinId: string | null;
  source: "builtin" | "catalog" | "new";
  category: QrCategory;
  kind: string;
  title: string;
  thumbnailUrl: string;
  mediaUrl: string;
  promptText: string;
  sortOrder: number;
};

const EMPTY_FORM: FormState = {
  id: null,
  dbId: null,
  catalogBuiltinId: null,
  source: "new",
  category: "image",
  kind: "create-image",
  title: "",
  thumbnailUrl: "",
  mediaUrl: "",
  promptText: "",
  sortOrder: 0,
};

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export default function AdminQuickReplicaTemplatesPage() {
  const [category, setCategory] = useState<QrCategory>("image");
  const [templates, setTemplates] = useState<AdminTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ category });
    const res = await fetch(`/api/admin/quick-replica/templates?${qs}`, { cache: "no-store" });
    const data = (await res.json()) as { templates?: AdminTemplateRow[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "加载失败");
    setTemplates(Array.isArray(data.templates) ? data.templates : []);
  }, [category]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filteredCount = useMemo(() => templates.length, [templates]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, category, kind: category === "video" ? "text-to-video" : "create-image" });
    setFormOpen(true);
  }

  function openEdit(row: AdminTemplateRow) {
    setForm({
      id: row.id,
      dbId: row.dbId,
      catalogBuiltinId: row.catalogBuiltinId,
      source: row.source,
      category: row.category,
      kind: row.kind,
      title: row.title,
      thumbnailUrl: row.thumbnailUrl,
      mediaUrl:
        row.mediaType === "video"
          ? row.thumbnailUrl
          : row.thumbnailUrl,
      promptText: row.promptText,
      sortOrder: row.sortOrder,
    });
    setFormOpen(true);
  }

  async function uploadMedia(file: File, target: "thumbnail" | "media") {
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const kind = file.type.startsWith("video/") ? "video" : "image";
      const catalogKey = form.id ?? form.dbId ?? `new-${Date.now()}`;
      const res = await fetch("/api/admin/quick-replica/assets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, catalogKey, kind }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "上传失败");
      setForm((prev) => ({
        ...prev,
        thumbnailUrl: target === "thumbnail" || kind === "image" ? data.url! : prev.thumbnailUrl,
        mediaUrl: target === "media" || kind === "video" ? data.url! : prev.mediaUrl,
        ...(kind === "video" && target === "media" ? { thumbnailUrl: prev.thumbnailUrl || data.url! } : {}),
      }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function saveForm() {
    setSaving(true);
    try {
      const payload = {
        dbId: form.dbId,
        catalogBuiltinId: form.source === "builtin" ? form.catalogBuiltinId ?? form.id : null,
        category: form.category,
        kind: form.kind,
        title: form.title,
        thumbnailUrl: form.thumbnailUrl,
        mediaUrl: form.mediaUrl || form.thumbnailUrl,
        promptText: form.promptText,
        sortOrder: form.sortOrder,
        source: form.source,
      };
      const isNew = form.source === "new" && !form.dbId;
      const url = isNew
        ? "/api/admin/quick-replica/templates"
        : `/api/admin/quick-replica/templates/${encodeURIComponent(form.id ?? form.dbId ?? "new")}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setFormOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: AdminTemplateRow) {
    if (!row.dbId) return;
    const isOverride = row.source === "builtin" && row.hasOverride;
    if (
      !confirmDestructiveTwice(
        isOverride
          ? "确定删除该模板的运营覆盖？将恢复为内置 JSON 默认内容。"
          : "确定删除该公开模板？",
        isOverride ? "此操作不可恢复，确认恢复内置默认？" : CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/admin/quick-replica/templates/${encodeURIComponent(row.id)}?dbId=${encodeURIComponent(row.dbId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("删除失败");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">快速复制 · 模板库</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            维护各分类下的公开模板：编辑封面图/视频与提示词，或新增模板。内置模板（JSON）保存时会写入数据库覆盖层，前台即时生效；删除覆盖可恢复内置默认。
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={openCreate}
        >
          新增模板
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              category === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto self-center text-sm text-muted-foreground">{filteredCount} 项</span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      {!loading ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">预览</th>
                <th className="px-3 py-2 font-medium">标题</th>
                <th className="px-3 py-2 font-medium">子类</th>
                <th className="px-3 py-2 font-medium">提示词</th>
                <th className="px-3 py-2 font-medium">来源</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="h-16 w-12 overflow-hidden rounded bg-muted">
                      {row.mediaType === "video" ? (
                        <video src={row.thumbnailUrl} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  </td>
                  <td className="max-w-[10rem] px-3 py-2">
                    <div className="font-medium">{row.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{row.id}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.kind}</td>
                  <td className="max-w-md px-3 py-2">
                    <p className="line-clamp-3 whitespace-pre-wrap text-xs">{row.promptText}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">
                      {row.source === "builtin"
                        ? row.hasOverride
                          ? "内置·已覆盖"
                          : "内置"
                        : "运营新增"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className="text-left text-primary hover:underline"
                        onClick={() => openEdit(row)}
                      >
                        编辑
                      </button>
                      {row.dbId ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          className="text-left text-destructive hover:underline disabled:opacity-50"
                          onClick={() => void removeRow(row)}
                        >
                          {row.source === "builtin" ? "恢复内置" : "删除"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    暂无模板
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-semibold">
              {form.source === "new" ? "新增模板" : "编辑模板"}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">分类</span>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value as QrCategory }))
                  }
                  disabled={form.source === "builtin"}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">子类 kind</span>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={form.kind}
                  onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
                  placeholder="create-image / text-to-video …"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">标题</span>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">提示词</span>
                <textarea
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2"
                  value={form.promptText}
                  onChange={(e) => setForm((p) => ({ ...p, promptText: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">封面 URL</span>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">媒体 URL（视频/参考图，可选）</span>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  value={form.mediaUrl}
                  onChange={(e) => setForm((p) => ({ ...p, mediaUrl: e.target.value }))}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
                  {uploading ? "上传中…" : "上传封面图"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadMedia(f, "thumbnail");
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
                  {uploading ? "上传中…" : "上传视频/媒体"}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadMedia(f, "media");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">排序（越小越靠前）</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))
                  }
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-input px-4 py-2 text-sm"
                onClick={() => setFormOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving || !form.title || !form.thumbnailUrl || !form.promptText}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                onClick={() => void saveForm()}
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
