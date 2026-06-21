"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Settings2, X } from "lucide-react";

import { QrModal } from "@/components/quick-replica/qr-modal";
import { QR_CATEGORIES, QR_KINDS_BY_CATEGORY, type QrCategory, type QrTemplate } from "@/lib/qr-template-types";
import { extractAdminFormFieldsFromTemplate, isMotionSyncKind } from "@/lib/qr-admin-form";
import { QrAdminPreviewThumb } from "@/components/quick-replica/qr-admin-preview-thumb";
import { resolveQrTemplatePreviewMedia } from "@/lib/qr-template-preview-media";

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
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  mediaUrl: string;
  targetImageUrl: string;
  referenceVideoUrl: string;
  outputUrl: string;
  modelKey: string;
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
  targetImageUrl: "",
  referenceVideoUrl: "",
  outputUrl: "",
  modelKey: "",
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

function inferFormMediaType(form: FormState): "image" | "video" | "audio" {
  if (form.category === "audio") return "audio";
  if (isMotionSyncKind(form.kind, form.toolKey) || form.category === "video") return "video";
  const url = form.mediaUrl || form.outputUrl || form.referenceVideoUrl;
  if (url && /\.(mp4|webm|mov)(\?|$)/i.test(url)) return "video";
  return "image";
}

function resolveAdminFormPreview(form: FormState) {
  const mediaType = inferFormMediaType(form);
  return resolveQrTemplatePreviewMedia({
    thumbnailUrl: form.thumbnailUrl || form.targetImageUrl,
    mediaType,
    outputUrl: form.outputUrl || form.referenceVideoUrl || form.mediaUrl,
    referenceVideoUrl: form.referenceVideoUrl,
    preferVideo: mediaType === "video",
  });
}

type AdminPrimaryTab = QrCategory | "motion-sync";

type Props = {
  bookMallAdminUrl: string | null;
  onTemplatesChanged?: () => void;
  onScopeChange?: (scope: { category: QrCategory; kind: string | null }) => void;
};

export function QrAdminPanel({
  bookMallAdminUrl,
  onTemplatesChanged,
  onScopeChange,
}: Props) {
  const [primaryTab, setPrimaryTab] = useState<AdminPrimaryTab>("video");
  const [kindFilter, setKindFilter] = useState("");
  const [templates, setTemplates] = useState<AdminTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const category: QrCategory = primaryTab === "motion-sync" ? "video" : primaryTab;
  const effectiveKind = primaryTab === "motion-sync" ? "motion-sync" : kindFilter;

  const emitScope = useCallback(
    (tab: AdminPrimaryTab, subKind = "") => {
      const nextCategory: QrCategory = tab === "motion-sync" ? "video" : tab;
      const nextKind = tab === "motion-sync" ? "motion-sync" : subKind || null;
      onScopeChange?.({ category: nextCategory, kind: nextKind });
    },
    [onScopeChange],
  );

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ category });
    if (effectiveKind) qs.set("kind", effectiveKind);
    const res = await fetch(
      `/api/book-mall/api/platform/v1/quick-replica/admin/templates?${qs}`,
      { cache: "no-store" },
    );
    const data = (await res.json()) as { templates?: AdminTemplateRow[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "加载失败");
    setTemplates(Array.isArray(data.templates) ? data.templates : []);
  }, [category, effectiveKind]);

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
    const defaultKind =
      primaryTab === "motion-sync"
        ? "motion-sync"
        : kindFilter || (category === "video" ? "text-to-video" : "create-image");
    setForm({
      ...EMPTY_FORM,
      category,
      kind: defaultKind,
      toolKey: defaultKind === "motion-sync" ? "motion-sync" : undefined,
      modelKey: defaultKind === "motion-sync" ? "kling-2.6/motion-control" : "",
    });
    setFormOpen(true);
    setMessage(null);
  }

  function openEdit(row: AdminTemplateRow) {
    const extracted = extractAdminFormFieldsFromTemplate(row);
    setForm({
      id: row.id,
      dbId: row.dbId,
      catalogBuiltinId: row.catalogBuiltinId,
      source: row.source,
      category: row.category,
      kind: row.kind,
      toolKey: extracted.toolKey,
      title: row.title,
      thumbnailUrl: row.thumbnailUrl,
      mediaUrl: extracted.mediaUrl,
      targetImageUrl: extracted.targetImageUrl,
      referenceVideoUrl: extracted.referenceVideoUrl,
      outputUrl: extracted.outputUrl,
      modelKey: extracted.modelKey,
      promptText: extracted.promptText,
      sortOrder: row.sortOrder,
    });
    setFormOpen(true);
    setMessage(null);
  }

  async function uploadMedia(
    file: File,
    target: "thumbnail" | "media" | "targetImage" | "referenceVideo",
  ) {
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
        thumbnailUrl:
          target === "thumbnail" || (target === "media" && kind === "image")
            ? data.url!
            : prev.thumbnailUrl,
        mediaUrl: target === "media" || kind === "video" ? data.url! : prev.mediaUrl,
        targetImageUrl:
          target === "targetImage" || (target === "media" && kind === "image")
            ? data.url!
            : prev.targetImageUrl,
        referenceVideoUrl:
          target === "referenceVideo" || (target === "media" && kind === "video")
            ? data.url!
            : prev.referenceVideoUrl,
        outputUrl:
          target === "referenceVideo" || (target === "media" && kind === "video")
            ? data.url!
            : prev.outputUrl,
        ...(kind === "video" && target === "media" && !prev.thumbnailUrl
          ? { thumbnailUrl: prev.thumbnailUrl }
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
        toolKey: form.toolKey,
        title: form.title,
        thumbnailUrl: form.thumbnailUrl,
        mediaUrl: form.mediaUrl || form.thumbnailUrl,
        targetImageUrl: form.targetImageUrl,
        referenceVideoUrl: form.referenceVideoUrl,
        outputUrl: form.outputUrl || form.referenceVideoUrl || form.mediaUrl,
        modelKey: form.modelKey,
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

        <div className="flex flex-wrap items-center gap-2">
          {QR_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setPrimaryTab(c.id);
                setKindFilter("");
                emitScope(c.id, "");
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                primaryTab === c.id
                  ? "bg-[var(--qr-brand)] text-white"
                  : "border border-[var(--qr-border)] text-[var(--qr-text-secondary)] hover:border-white/20"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setPrimaryTab("motion-sync");
              setKindFilter("");
              emitScope("motion-sync", "");
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              primaryTab === "motion-sync"
                ? "bg-[var(--qr-brand)] text-white"
                : "border border-[var(--qr-border)] text-[var(--qr-text-secondary)] hover:border-white/20"
            }`}
          >
            运动同步
          </button>
          <button type="button" className="qr-btn-primary ml-auto text-xs" onClick={openCreate}>
            新增模板
          </button>
        </div>

        {primaryTab !== "motion-sync" && QR_KINDS_BY_CATEGORY[category]?.length ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setKindFilter("");
                emitScope(primaryTab, "");
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                !kindFilter
                  ? "bg-white/15 text-[var(--qr-text-primary)]"
                  : "text-[var(--qr-text-muted)] hover:bg-white/5"
              }`}
            >
              全部子类
            </button>
            {QR_KINDS_BY_CATEGORY[category]
              .filter((k) => k.id !== "motion-sync")
              .map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  setKindFilter(k.id);
                  emitScope(primaryTab, k.id);
                }}
                className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                  kindFilter === k.id
                    ? "bg-white/15 text-[var(--qr-text-primary)]"
                    : "text-[var(--qr-text-muted)] hover:bg-white/5"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        ) : null}

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
              共 {filteredCount} 项 · 当前：
              {primaryTab === "motion-sync"
                ? "运动同步"
                : `${QR_CATEGORIES.find((c) => c.id === primaryTab)?.label ?? primaryTab}${
                    kindFilter
                      ? ` · ${QR_KINDS_BY_CATEGORY[category].find((k) => k.id === kindFilter)?.label ?? kindFilter}`
                      : ""
                  }`}
            </div>
          </div>
        )}
      </div>

      <QrModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        variant="preview"
        hideHeader
      >
        <div className="grid min-h-0 flex-1 grid-cols-3">
          <div
            className="relative col-span-2 min-h-0 overflow-hidden"
            style={{ background: "var(--qr-bg-page)" }}
          >
            {(() => {
              const preview = resolveAdminFormPreview(form);
              if (!preview) {
                return (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-xs text-[var(--qr-text-muted)]">暂无预览</p>
                  </div>
                );
              }
              if (preview.kind === "video") {
                return (
                  <video
                    key={preview.url}
                    src={preview.url}
                    controls
                    className="absolute inset-0 h-full w-full object-contain"
                    playsInline
                    poster={preview.poster}
                  />
                );
              }
              return (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={preview.url}
                  src={preview.url}
                  alt={form.title || "预览"}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              );
            })()}
          </div>

          <div
            className="col-span-1 flex min-h-0 flex-col"
            style={{ borderLeft: "1px solid var(--qr-border)" }}
          >
            <div
              className="flex shrink-0 items-start justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--qr-border)" }}
            >
              <h3 className="text-sm font-semibold">
                {form.source === "new" && !form.dbId ? "新增模板" : "编辑模板"}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="关闭">
                <X className="h-4 w-4 text-[var(--qr-text-muted)]" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              {(() => {
                const motionSync = isMotionSyncKind(form.kind, form.toolKey);
                return (
                  <>
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
                      <select
                        className="qr-input w-full font-mono text-xs"
                        value={form.kind}
                        onChange={(e) => {
                          const nextKind = e.target.value;
                          setForm((p) => ({
                            ...p,
                            kind: nextKind,
                            toolKey: nextKind === "motion-sync" ? "motion-sync" : p.toolKey,
                            modelKey:
                              nextKind === "motion-sync"
                                ? p.modelKey || "kling-2.6/motion-control"
                                : p.modelKey,
                          }));
                        }}
                        disabled={form.source === "builtin"}
                      >
                        {(QR_KINDS_BY_CATEGORY[form.category] ?? []).map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label} ({k.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--qr-text-muted)]">提示词</span>
                      <textarea
                        className="qr-input min-h-[120px] w-full resize-y"
                        value={form.promptText}
                        onChange={(e) => setForm((p) => ({ ...p, promptText: e.target.value }))}
                      />
                    </label>
                    {motionSync ? (
                      <>
                        <label className="block space-y-1">
                          <span className="text-xs text-[var(--qr-text-muted)]">目标人物图 URL</span>
                          <input
                            className="qr-input w-full font-mono text-xs"
                            value={form.targetImageUrl}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, targetImageUrl: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs text-[var(--qr-text-muted)]">参考动作视频 URL</span>
                          <input
                            className="qr-input w-full font-mono text-xs"
                            value={form.referenceVideoUrl}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                referenceVideoUrl: e.target.value,
                                outputUrl: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs text-[var(--qr-text-muted)]">模型 modelKey</span>
                          <input
                            className="qr-input w-full font-mono text-xs"
                            value={form.modelKey}
                            onChange={(e) => setForm((p) => ({ ...p, modelKey: e.target.value }))}
                            placeholder="kling-2.6/motion-control"
                          />
                        </label>
                      </>
                    ) : null}
                    <label className="block space-y-1">
                      <span className="text-xs text-[var(--qr-text-muted)]">
                        {motionSync ? "列表封面 URL" : "封面 / 媒体 URL"}
                      </span>
                      <input
                        className="qr-input w-full font-mono text-xs"
                        value={form.thumbnailUrl}
                        onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                      />
                    </label>
                    {!motionSync ? (
                      <label className="block space-y-1">
                        <span className="text-xs text-[var(--qr-text-muted)]">媒体 URL（视频/参考图）</span>
                        <input
                          className="qr-input w-full font-mono text-xs"
                          value={form.mediaUrl}
                          onChange={(e) => setForm((p) => ({ ...p, mediaUrl: e.target.value }))}
                        />
                      </label>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <label className="qr-btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                        {uploading ? "上传中…" : "上传封面"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadMedia(file, "thumbnail");
                          }}
                        />
                      </label>
                      {motionSync ? (
                        <>
                          <label className="qr-btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                            上传目标图
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadMedia(file, "targetImage");
                              }}
                            />
                          </label>
                          <label className="qr-btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                            上传参考视频
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadMedia(file, "referenceVideo");
                              }}
                            />
                          </label>
                        </>
                      ) : (
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
                      )}
                    </div>
                  </>
                );
              })()}
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
      </QrModal>
    </div>
  );
}
