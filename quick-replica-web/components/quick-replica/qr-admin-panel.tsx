"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Settings2 } from "lucide-react";

import { QR_CATEGORIES, type QrCategory, type QrTemplate } from "@/lib/qr-template-types";
import { QrAdminPreviewThumb } from "@/components/quick-replica/qr-admin-preview-thumb";

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
  reference?: QrTemplate["reference"];
  output?: QrTemplate["output"];
  sortOrder: number;
  mediaType: "image" | "video" | "audio";
};

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

type Props = {
  bookMallAdminUrl: string | null;
  onTemplatesChanged?: () => void;
};

export function QrAdminPanel({ bookMallAdminUrl, onTemplatesChanged }: Props) {
  const [category, setCategory] = useState<QrCategory>("video");
  const [templates, setTemplates] = useState<AdminTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ category });
    const res = await fetch(
      `/api/book-mall/api/platform/v1/quick-replica/admin/templates?${qs}`,
      { cache: "no-store" },
    );
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
    setForm({
      ...EMPTY_FORM,
      category,
      kind: category === "video" ? "text-to-video" : "create-image",
    });
    setFormOpen(true);
    setMessage(null);
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
      mediaUrl: row.thumbnailUrl,
      promptText: row.promptText,
      sortOrder: row.sortOrder,
    });
    setFormOpen(true);
    setMessage(null);
  }

  async function uploadMedia(file: File, target: "thumbnail" | "media") {
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const kind = file.type.startsWith("video/") ? "video" : "image";
      const res = await fetch("/api/book-mall/api/platform/v1/quick-replica/assets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, kind }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "上传失败");
      setForm((prev) => ({
        ...prev,
        thumbnailUrl: target === "thumbnail" || kind === "image" ? data.url! : prev.thumbnailUrl,
        mediaUrl: target === "media" || kind === "video" ? data.url! : prev.mediaUrl,
        ...(kind === "video" && target === "media" && !prev.thumbnailUrl
          ? { thumbnailUrl: data.url! }
          : {}),
      }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function saveForm() {
    setSaving(true);
    setMessage(null);
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
        ? "/api/book-mall/api/platform/v1/quick-replica/admin/templates"
        : `/api/book-mall/api/platform/v1/quick-replica/admin/templates/${encodeURIComponent(form.id ?? form.dbId ?? "new")}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setFormOpen(false);
      await load();
      onTemplatesChanged?.();
      setMessage("已保存，前台模板库与分类示例将同步更新");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="qr-panel-header shrink-0">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[var(--qr-brand)]" />
          <span>管理后台</span>
        </div>
        {bookMallAdminUrl ? (
          <a
            href={bookMallAdminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--qr-text-muted)] hover:text-[var(--qr-brand)]"
          >
            Book 完整后台
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <div className="qr-scroll-panel min-h-0 flex-1 space-y-4 p-4">
        <p className="text-sm text-[var(--qr-text-secondary)]">
          维护推荐模板与提示词：编辑后即时作用于右侧模板库；在模板预览中可将条目设为
          <strong className="font-medium text-[var(--qr-text-primary)]"> 中栏分类示例图</strong>
          （各子类卡片封面）。
        </p>

        <div className="flex flex-wrap gap-2">
          {QR_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                category === c.id
                  ? "bg-[var(--qr-brand)] text-white"
                  : "border border-[var(--qr-border)] text-[var(--qr-text-secondary)] hover:border-white/20"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button type="button" className="qr-btn-primary ml-auto text-xs" onClick={openCreate}>
            新增模板
          </button>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
            {message}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--qr-text-muted)]">加载中…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--qr-border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-[var(--qr-text-muted)]">
                <tr className="border-b border-[var(--qr-border)]">
                  <th className="px-3 py-2 font-medium">预览</th>
                  <th className="px-3 py-2 font-medium">标题 / 子类</th>
                  <th className="px-3 py-2 font-medium">提示词</th>
                  <th className="px-3 py-2 font-medium">来源</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--qr-border)] align-top">
                    <td className="px-3 py-2">
                      <QrAdminPreviewThumb
                        thumbnailUrl={row.thumbnailUrl}
                        mediaType={row.mediaType}
                        reference={row.reference}
                        output={row.output}
                      />
                    </td>
                    <td className="max-w-[10rem] px-3 py-2">
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-[var(--qr-text-muted)]">{row.kind}</div>
                    </td>
                    <td className="max-w-md px-3 py-2">
                      <p className="line-clamp-3 whitespace-pre-wrap text-xs text-[var(--qr-text-secondary)]">
                        {row.promptText}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
                        {row.source === "builtin"
                          ? row.hasOverride
                            ? "内置·已覆盖"
                            : "内置"
                          : "运营库"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="qr-btn-secondary px-2 py-1 text-xs"
                        onClick={() => openEdit(row)}
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[var(--qr-border)] px-3 py-2 text-xs text-[var(--qr-text-muted)]">
              共 {filteredCount} 项 · 当前分类：{QR_CATEGORIES.find((c) => c.id === category)?.label}
            </div>
          </div>
        )}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/65"
            aria-label="关闭"
            onClick={() => setFormOpen(false)}
          />
          <div
            className="qr-modal-shell relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="flex shrink-0 items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--qr-border)" }}
            >
              <h3 className="text-sm font-semibold">
                {form.source === "new" && !form.dbId ? "新增模板" : "编辑模板"}
              </h3>
              <button type="button" className="text-xs text-[var(--qr-text-muted)]" onClick={() => setFormOpen(false)}>
                关闭
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <label className="block space-y-1">
                <span className="text-xs text-[var(--qr-text-muted)]">标题</span>
                <input
                  className="qr-input w-full"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--qr-text-muted)]">子类 kind</span>
                <input
                  className="qr-input w-full font-mono text-xs"
                  value={form.kind}
                  onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--qr-text-muted)]">提示词</span>
                <textarea
                  className="qr-input min-h-[120px] w-full resize-y"
                  value={form.promptText}
                  onChange={(e) => setForm((p) => ({ ...p, promptText: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--qr-text-muted)]">封面 / 视频 URL</span>
                <input
                  className="qr-input w-full font-mono text-xs"
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <label className="qr-btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                  {uploading ? "上传中…" : "上传封面"}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadMedia(file, "thumbnail");
                    }}
                  />
                </label>
                <label className="qr-btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                  上传媒体
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadMedia(file, "media");
                    }}
                  />
                </label>
              </div>
            </div>
            <div
              className="flex shrink-0 justify-end gap-2 p-4"
              style={{ borderTop: "1px solid var(--qr-border)" }}
            >
              <button type="button" className="qr-btn-secondary" onClick={() => setFormOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className="qr-btn-primary"
                disabled={saving || !form.title.trim() || !form.promptText.trim()}
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
