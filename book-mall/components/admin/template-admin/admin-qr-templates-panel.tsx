"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminListSentinel } from "@/components/admin/template-admin/admin-list-sentinel";
import { AdminMediaField } from "@/components/admin/template-admin/admin-media-field";
import { AdminMediaThumb } from "@/components/admin/template-admin/admin-media-thumb";
import { AdminVideoHoverThumb } from "@/components/admin/template-admin/admin-video-hover-thumb";
import { ADMIN_TEMPLATE_PAGE_SIZE } from "@/lib/admin/admin-template-page";
import {
  confirmDestructiveTwice,
  CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
} from "@/lib/confirm-destructive-twice";
import {
  ADMIN_SCENE_IMAGE_MAX,
  extractAdminFormFieldsFromTemplate,
  extractAudioFieldsFromReference,
  isCharacterCatalogEdit,
  isMotionSyncKind,
  supportsAdminSceneImages,
} from "@/lib/quick-replica/qr-admin-template-form";
import { QR_KINDS_BY_CATEGORY } from "@/lib/quick-replica/qr-kinds";
import {
  resolveQrTemplatePreviewMedia,
  type QrPreviewMedia,
} from "@/lib/quick-replica/qr-template-preview-media";
import type { QrCategory, QrTemplateJson } from "@/lib/quick-replica/qr-types";
import type { QrAudioPromptTemplateLibrary } from "@/lib/quick-replica/qr-audio-prompt-templates";

/** 图片：悬停 Eye → 全屏自适应预览；视频：悬停自动播放 */
function QrAdminPreviewThumb({
  preview,
  title,
}: {
  preview: QrPreviewMedia | null;
  title?: string;
}) {
  if (preview?.kind === "video" && preview.url) {
    return (
      <AdminVideoHoverThumb
        src={preview.url}
        poster={preview.poster || undefined}
      />
    );
  }
  const imageSrc =
    preview?.kind === "image" ? preview.url : (preview?.poster ?? "");
  return <AdminMediaThumb src={imageSrc} title={title} hoverMode="icon" />;
}

type AdminPrimaryTab = QrCategory | "motion-sync";
type AdminView = "catalog" | "user-works";

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
  reference?: QrTemplateJson["reference"];
  output?: QrTemplateJson["output"];
  sortOrder: number;
  mediaType: "image" | "video" | "audio";
};

type UserWorkRow = {
  id: string;
  category: QrCategory;
  kind: string;
  title: string;
  thumbnailUrl: string;
  createdAt?: string;
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
  sceneImageUrls: string[];
  sortOrder: number;
  voiceId: string;
  audioStyleTag: string;
  voiceSpeed: number;
  voiceStability: number;
  voiceSimilarityBoost: number;
  voiceStyleExaggeration: number;
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
  sceneImageUrls: [],
  sortOrder: 0,
  voiceId: "male-qn-qingse",
  audioStyleTag: "ad-teaser",
  voiceSpeed: 1,
  voiceStability: 0.5,
  voiceSimilarityBoost: 0.75,
  voiceStyleExaggeration: 0,
};

const CATEGORIES: { id: QrCategory; label: string }[] = [
  { id: "video", label: "视频" },
  { id: "image", label: "图像" },
  { id: "character", label: "角色" },
  { id: "world", label: "世界" },
  { id: "audio", label: "音频" },
];

const AUDIO_PROMPT_KINDS: Array<{
  id: keyof QrAudioPromptTemplateLibrary;
  label: string;
}> = [
  { id: "create-voiceover", label: "旁白" },
  { id: "voice-changer", label: "变声" },
  { id: "create-sfx", label: "音效" },
  { id: "create-music", label: "音乐" },
];

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function sourceLabel(row: AdminTemplateRow): string {
  if (row.source === "builtin" && row.hasOverride) return "内置·已覆盖";
  if (row.source === "builtin") return "内置";
  return "运营库";
}

export function AdminQrTemplatesPanel() {
  const [primaryTab, setPrimaryTab] = useState<AdminPrimaryTab | null>(null);
  const [adminView, setAdminView] = useState<AdminView>("catalog");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AdminTemplateRow[]>([]);
  const [userWorks, setUserWorks] = useState<UserWorkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [audioLib, setAudioLib] = useState<QrAudioPromptTemplateLibrary | null>(null);
  const [audioLibKind, setAudioLibKind] =
    useState<keyof QrAudioPromptTemplateLibrary>("create-voiceover");
  const [audioLibSaving, setAudioLibSaving] = useState(false);
  const loadMoreLock = useRef(false);
  const listGen = useRef(0);

  const category: QrCategory | null = primaryTab === "motion-sync" ? "video" : primaryTab;
  const canLoad =
    primaryTab != null && (primaryTab === "motion-sync" || kindFilter !== null);
  const effectiveKind =
    primaryTab === "motion-sync" ? "motion-sync" : kindFilter || null;
  const kinds = category ? (QR_KINDS_BY_CATEGORY[category] ?? []) : [];

  const fetchPage = useCallback(
    async (offset: number, append: boolean, gen?: number) => {
      if (!canLoad || !category) return;
      const token = gen ?? listGen.current;
      const qs = new URLSearchParams({
        category,
        limit: String(ADMIN_TEMPLATE_PAGE_SIZE),
        offset: String(offset),
      });
      if (effectiveKind) qs.set("kind", effectiveKind);
      const path =
        adminView === "user-works"
          ? `/api/admin/quick-replica/user-templates?${qs}`
          : `/api/admin/quick-replica/templates?${qs}`;
      const res = await fetch(path, { cache: "no-store" });
      const data = (await res.json()) as {
        templates?: AdminTemplateRow[] | UserWorkRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      if (token !== listGen.current) return;
      const next = Array.isArray(data.templates) ? data.templates : [];
      const nextTotal = typeof data.total === "number" ? data.total : next.length;
      if (adminView === "user-works") {
        setUserWorks((prev) =>
          append ? [...prev, ...(next as UserWorkRow[])] : (next as UserWorkRow[]),
        );
      } else {
        setTemplates((prev) =>
          append ? [...prev, ...(next as AdminTemplateRow[])] : (next as AdminTemplateRow[]),
        );
      }
      setTotal(nextTotal);
    },
    [adminView, canLoad, category, effectiveKind],
  );

  const reloadList = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    try {
      await fetchPage(0, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [canLoad, fetchPage]);

  useEffect(() => {
    if (!canLoad) {
      listGen.current += 1;
      setTemplates([]);
      setUserWorks([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    const gen = ++listGen.current;
    setLoading(true);
    setError(null);
    setTemplates([]);
    setUserWorks([]);
    setTotal(0);
    void (async () => {
      try {
        await fetchPage(0, false, gen);
      } catch (e) {
        if (!cancelled && gen === listGen.current) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled && gen === listGen.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage, canLoad]);

  const loadMore = useCallback(() => {
    if (!canLoad || loading || loadingMore || loadMoreLock.current) return;
    const loaded = adminView === "user-works" ? userWorks.length : templates.length;
    if (loaded >= total) return;
    loadMoreLock.current = true;
    setLoadingMore(true);
    void fetchPage(loaded, true)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => {
        loadMoreLock.current = false;
        setLoadingMore(false);
      });
  }, [
    adminView,
    canLoad,
    fetchPage,
    loading,
    loadingMore,
    templates.length,
    total,
    userWorks.length,
  ]);

  useEffect(() => {
    if (category !== "audio") return;
    void (async () => {
      const res = await fetch("/api/admin/quick-replica/audio-prompt-templates", {
        cache: "no-store",
      });
      const data = (await res.json()) as { templates?: QrAudioPromptTemplateLibrary };
      if (res.ok && data.templates) setAudioLib(data.templates);
    })();
  }, [category]);

  const rows = useMemo(
    () => (adminView === "user-works" ? userWorks : templates),
    [adminView, templates, userWorks],
  );

  function openCreate() {
    if (!category) return;
    const defaultKind =
      primaryTab === "motion-sync"
        ? "motion-sync"
        : kindFilter ||
          (category === "video"
            ? "text-to-video"
            : category === "character"
              ? "create-character"
              : category === "audio"
                ? "create-voiceover"
                : category === "world"
                  ? "create-world"
                  : "create-image");
    setForm({
      ...EMPTY_FORM,
      category,
      kind: defaultKind,
      toolKey: defaultKind === "motion-sync" ? "motion-sync" : undefined,
      modelKey:
        defaultKind === "motion-sync"
          ? "kling-2.6/motion-control"
          : category === "audio"
            ? "MiniMax/speech-2.8-hd"
            : "",
    });
    setFormOpen(true);
    setMessage(null);
  }

  function openEdit(row: AdminTemplateRow) {
    const extracted = extractAdminFormFieldsFromTemplate(row);
    const audioFields =
      row.category === "audio" ? extractAudioFieldsFromReference(row.reference) : null;
    setForm({
      ...EMPTY_FORM,
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
      modelKey: audioFields?.modelKey ?? extracted.modelKey,
      promptText: extracted.promptText,
      sceneImageUrls: extracted.sceneImageUrls,
      sortOrder: row.sortOrder,
      voiceId: audioFields?.voiceId ?? "male-qn-qingse",
      audioStyleTag: audioFields?.audioStyleTag ?? "ad-teaser",
      voiceSpeed: audioFields?.voiceSpeed ?? 1,
      voiceStability: audioFields?.voiceStability ?? 0.5,
      voiceSimilarityBoost: audioFields?.voiceSimilarityBoost ?? 0.75,
      voiceStyleExaggeration: audioFields?.voiceStyleExaggeration ?? 0,
    });
    setFormOpen(true);
    setMessage(null);
  }

  async function uploadMedia(
    file: File,
    target: "thumbnail" | "media" | "targetImage" | "referenceVideo" | "referenceImage",
  ) {
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const isVideo = file.type.startsWith("video/");
      const res = await fetch("/api/admin/quick-replica/assets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          catalogKey: form.id ?? form.dbId ?? "new",
          kind: isVideo ? "video" : "image",
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "上传失败");
      const url = data.url;
      setForm((prev) => {
        if (target === "referenceImage") {
          return {
            ...prev,
            sceneImageUrls: [...prev.sceneImageUrls, url].slice(0, ADMIN_SCENE_IMAGE_MAX),
          };
        }
        const next = { ...prev };
        if (target === "thumbnail" || (target === "media" && !isVideo)) next.thumbnailUrl = url;
        if (target === "media" || isVideo) next.mediaUrl = url;
        if (target === "targetImage" || (target === "media" && !isVideo)) next.targetImageUrl = url;
        if (target === "referenceVideo" || (target === "media" && isVideo)) {
          next.referenceVideoUrl = url;
          next.outputUrl = url;
        }
        return next;
      });
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
      const characterEdit = isCharacterCatalogEdit(form);
      let thumbnailUrl =
        form.thumbnailUrl.trim() ||
        form.mediaUrl.trim() ||
        form.targetImageUrl.trim() ||
        form.outputUrl.trim();
      if (!thumbnailUrl && form.category === "audio") {
        thumbnailUrl = "https://picsum.photos/seed/qr-audio-cover/480/360";
      }
      if (!thumbnailUrl) {
        throw new Error(characterEdit ? "缺少封面数据" : "请先上传封面或媒体");
      }
      const payload = {
        dbId: form.dbId,
        catalogBuiltinId: form.source === "builtin" ? form.catalogBuiltinId ?? form.id : null,
        category: form.category,
        kind: form.kind,
        toolKey: form.toolKey,
        title: form.title.trim(),
        thumbnailUrl,
        mediaUrl: form.mediaUrl.trim() || thumbnailUrl,
        targetImageUrl: form.targetImageUrl,
        referenceVideoUrl: form.referenceVideoUrl,
        outputUrl: form.outputUrl || form.referenceVideoUrl || form.mediaUrl,
        modelKey: form.modelKey,
        promptText: form.promptText.trim(),
        sceneImageUrls: form.sceneImageUrls,
        sortOrder: form.sortOrder,
        source: form.source,
        voiceId: form.voiceId,
        audioStyleTag: form.audioStyleTag,
        voiceSpeed: form.voiceSpeed,
        voiceStability: form.voiceStability,
        voiceSimilarityBoost: form.voiceSimilarityBoost,
        voiceStyleExaggeration: form.voiceStyleExaggeration,
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
      await reloadList();
      setMessage("已保存");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCatalog(row: AdminTemplateRow) {
    if (!row.dbId) {
      setMessage("内置条目请先覆盖后再删除，或使用恢复内置");
      return;
    }
    if (
      !confirmDestructiveTwice(
        `确定删除模板「${row.title}」？`,
        CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/quick-replica/templates/${encodeURIComponent(row.id)}?dbId=${encodeURIComponent(row.dbId)}`,
      { method: "DELETE" },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(data.error ?? "删除失败");
      return;
    }
    await reloadList();
    setMessage("已删除");
  }

  async function deleteUserWork(row: UserWorkRow) {
    if (
      !confirmDestructiveTwice(
        `确定删除用户作品「${row.title}」？`,
        CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/quick-replica/user-templates?id=${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(data.error ?? "删除失败");
      return;
    }
    await reloadList();
    setMessage("已删除用户作品");
  }

  async function setFeatured(row: AdminTemplateRow) {
    const res = await fetch(
      `/api/admin/quick-replica/kinds/${encodeURIComponent(row.kind)}/featured`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: row.id,
          templateSource: row.source === "builtin" ? "builtin" : "user",
        }),
      },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(data.error ?? "设置失败");
      return;
    }
    setMessage(`已将「${row.title}」设为 ${row.kind} 分类示例`);
  }

  async function clearFeatured(kind: string) {
    const res = await fetch(`/api/admin/quick-replica/kinds/${encodeURIComponent(kind)}/featured`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setMessage(data.error ?? "清除失败");
      return;
    }
    setMessage("已清除分类示例");
  }

  async function saveAudioLib() {
    if (!audioLib) return;
    setAudioLibSaving(true);
    try {
      const res = await fetch("/api/admin/quick-replica/audio-prompt-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: audioLib }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setMessage("音频提示词库已保存");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setAudioLibSaving(false);
    }
  }

  const characterEdit = isCharacterCatalogEdit(form);
  const sceneEnabled = supportsAdminSceneImages(form);
  const motion = isMotionSyncKind(form.kind, form.toolKey);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1 text-xs ${adminView === "catalog" ? "bg-[#0969da] text-white" : "border border-[#d0d7de]"}`}
          onClick={() => setAdminView("catalog")}
        >
          运营模板
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1 text-xs ${adminView === "user-works" ? "bg-[#0969da] text-white" : "border border-[#d0d7de]"}`}
          onClick={() => setAdminView("user-works")}
        >
          用户作品
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`rounded-md px-3 py-1 text-xs ${primaryTab === c.id ? "bg-[#1f2328] text-white" : "border border-[#d0d7de]"}`}
            onClick={() => {
              setPrimaryTab(c.id);
              setKindFilter(null);
            }}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className={`rounded-md px-3 py-1 text-xs ${primaryTab === "motion-sync" ? "bg-[#1f2328] text-white" : "border border-[#d0d7de]"}`}
          onClick={() => {
            setPrimaryTab("motion-sync");
            setKindFilter("motion-sync");
          }}
        >
          运动同步
        </button>
      </div>

      {primaryTab && primaryTab !== "motion-sync" ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`rounded-full px-2.5 py-0.5 text-[11px] ${kindFilter === "" ? "bg-[#ddf4ff] text-[#0969da]" : "border border-[#d0d7de]"}`}
            onClick={() => setKindFilter("")}
          >
            全部子类
          </button>
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`rounded-full px-2.5 py-0.5 text-[11px] ${kindFilter === k.id ? "bg-[#ddf4ff] text-[#0969da]" : "border border-[#d0d7de]"}`}
              onClick={() => setKindFilter(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {!primaryTab
            ? "请选择分类"
            : !canLoad
              ? "请选择子类"
              : loading
                ? "加载中…"
                : `已加载 ${rows.length} / 共 ${total} 条`}
          {error ? ` · ${error}` : ""}
          {message ? ` · ${message}` : ""}
        </p>
        {adminView === "catalog" ? (
          <button
            type="button"
            className="rounded-md bg-[#0969da] px-3 py-1.5 text-xs text-white disabled:opacity-50"
            disabled={!category}
            onClick={openCreate}
          >
            新建模板
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#d0d7de] bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-[#f6f8fa] text-[#656d76]">
            <tr>
              <th className="px-3 py-2">预览</th>
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">kind</th>
              {adminView === "catalog" ? <th className="px-3 py-2">来源</th> : null}
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={adminView === "catalog" ? 5 : 4}
                  className="px-3 py-6 text-center text-[#656d76]"
                >
                  {!primaryTab
                    ? "请选择分类"
                    : !canLoad
                      ? "请选择子类"
                      : loading
                        ? "加载中…"
                        : "暂无数据"}
                </td>
              </tr>
            ) : null}
            {adminView === "user-works"
              ? userWorks.map((row) => (
                  <tr key={row.id} className="border-t border-[#d0d7de]">
                    <td className="px-3 py-2">
                      {/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(row.thumbnailUrl) ? (
                        <AdminVideoHoverThumb src={row.thumbnailUrl} />
                      ) : (
                        <AdminMediaThumb
                          src={row.thumbnailUrl}
                          title={row.title}
                          hoverMode="icon"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">{row.title}</td>
                    <td className="px-3 py-2 font-mono">{row.kind}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-[#cf222e]"
                        onClick={() => void deleteUserWork(row)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              : templates.map((row) => {
                  const preview = resolveQrTemplatePreviewMedia({
                    thumbnailUrl: row.thumbnailUrl,
                    mediaType: row.mediaType,
                    outputUrl: row.output?.url,
                    referenceVideoUrl: row.reference?.slots?.referenceVideo?.url,
                  });
                  return (
                    <tr key={row.id} className="border-t border-[#d0d7de]">
                      <td className="px-3 py-2">
                        <QrAdminPreviewThumb preview={preview} title={row.title} />
                      </td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2 font-mono">{row.kind}</td>
                      <td className="px-3 py-2">{sourceLabel(row)}</td>
                      <td className="space-x-2 px-3 py-2">
                        <button type="button" className="text-[#0969da]" onClick={() => openEdit(row)}>
                          编辑
                        </button>
                        <button type="button" className="text-[#0969da]" onClick={() => void setFeatured(row)}>
                          设为分类示例
                        </button>
                        <button
                          type="button"
                          className="text-[#656d76]"
                          onClick={() => void clearFeatured(row.kind)}
                        >
                          清除示例
                        </button>
                        {row.dbId ? (
                          <button
                            type="button"
                            className="text-[#cf222e]"
                            onClick={() => void deleteCatalog(row)}
                          >
                            删除
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      <AdminListSentinel
        hasMore={canLoad && rows.length < total}
        loading={loading || loadingMore}
        onVisible={loadMore}
      />

      {category === "audio" && audioLib ? (
        <div className="space-y-3 rounded-lg border border-[#d0d7de] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">音频提示词库</h3>
            <button
              type="button"
              className="rounded-md bg-[#0969da] px-3 py-1 text-xs text-white disabled:opacity-50"
              disabled={audioLibSaving}
              onClick={() => void saveAudioLib()}
            >
              {audioLibSaving ? "保存中…" : "保存词库"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AUDIO_PROMPT_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`rounded-full px-2.5 py-0.5 text-[11px] ${audioLibKind === k.id ? "bg-[#ddf4ff] text-[#0969da]" : "border border-[#d0d7de]"}`}
                onClick={() => setAudioLibKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <ul className="space-y-2">
            {audioLib[audioLibKind].map((item, index) => (
              <li key={item.id} className="grid gap-2 sm:grid-cols-3">
                <input
                  className="rounded border border-[#d0d7de] px-2 py-1 text-xs"
                  value={item.name}
                  onChange={(e) => {
                    const next = { ...audioLib, [audioLibKind]: [...audioLib[audioLibKind]] };
                    next[audioLibKind][index] = { ...item, name: e.target.value };
                    setAudioLib(next);
                  }}
                />
                <textarea
                  className="sm:col-span-2 rounded border border-[#d0d7de] px-2 py-1 text-xs"
                  rows={2}
                  value={item.content}
                  onChange={(e) => {
                    const next = { ...audioLib, [audioLibKind]: [...audioLib[audioLibKind]] };
                    next[audioLibKind][index] = { ...item, content: e.target.value };
                    setAudioLib(next);
                  }}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-xs text-[#0969da]"
            onClick={() => {
              const id = `apt-${Date.now()}`;
              setAudioLib({
                ...audioLib,
                [audioLibKind]: [
                  ...audioLib[audioLibKind],
                  { id, name: "新模板", content: "" },
                ],
              });
            }}
          >
            新增一条
          </button>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="w-full max-w-2xl space-y-3 rounded-xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {form.source === "new" ? "新建模板" : "编辑模板"}
              </h3>
              <button type="button" className="text-xs text-[#656d76]" onClick={() => setFormOpen(false)}>
                关闭
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                分类
                <select
                  className="mt-1 w-full rounded border border-[#d0d7de] px-2 py-1.5"
                  value={form.category}
                  disabled={form.source === "builtin"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value as QrCategory }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                子类
                <select
                  className="mt-1 w-full rounded border border-[#d0d7de] px-2 py-1.5"
                  value={form.kind}
                  disabled={form.source === "builtin"}
                  onChange={(e) => {
                    const kind = e.target.value;
                    const def = kinds.find((k) => k.id === kind);
                    setForm((p) => ({
                      ...p,
                      kind,
                      toolKey: def?.toolKey ?? (kind === "motion-sync" ? "motion-sync" : p.toolKey),
                    }));
                  }}
                >
                  {(QR_KINDS_BY_CATEGORY[form.category] ?? []).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs sm:col-span-2">
                标题
                <input
                  className="mt-1 w-full rounded border border-[#d0d7de] px-2 py-1.5"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                提示词
                <textarea
                  className="mt-1 w-full rounded border border-[#d0d7de] px-2 py-1.5"
                  rows={4}
                  value={form.promptText}
                  onChange={(e) => setForm((p) => ({ ...p, promptText: e.target.value }))}
                />
              </label>
              {!characterEdit ? (
                <>
                  <AdminMediaField
                    hoverChrome="canvas"
                    label="封面"
                    url={form.thumbnailUrl}
                    accept="image"
                    disabled={uploading}
                    onUrlChange={(thumbnailUrl) => setForm((p) => ({ ...p, thumbnailUrl }))}
                    onFiles={(files) => {
                      const f = files[0];
                      if (f) void uploadMedia(f, "thumbnail");
                    }}
                  />
                  <AdminMediaField
                    hoverChrome="canvas"
                    label="主媒体"
                    url={form.mediaUrl}
                    accept="media"
                    disabled={uploading}
                    onUrlChange={(mediaUrl) => setForm((p) => ({ ...p, mediaUrl }))}
                    onFiles={(files) => {
                      const f = files[0];
                      if (f) void uploadMedia(f, "media");
                    }}
                  />
                </>
              ) : null}
              {motion ? (
                <>
                  <AdminMediaField
                    hoverChrome="canvas"
                    label="目标人物图"
                    url={form.targetImageUrl}
                    accept="image"
                    disabled={uploading}
                    onUrlChange={(targetImageUrl) => setForm((p) => ({ ...p, targetImageUrl }))}
                    onFiles={(files) => {
                      const f = files[0];
                      if (f) void uploadMedia(f, "targetImage");
                    }}
                  />
                  <AdminMediaField
                    hoverChrome="canvas"
                    label="参考视频"
                    url={form.referenceVideoUrl}
                    accept="video"
                    disabled={uploading}
                    onUrlChange={(referenceVideoUrl) =>
                      setForm((p) => ({ ...p, referenceVideoUrl }))
                    }
                    onFiles={(files) => {
                      const f = files[0];
                      if (f) void uploadMedia(f, "referenceVideo");
                    }}
                  />
                </>
              ) : null}
              {sceneEnabled ? (
                <AdminMediaField
                  hoverChrome="canvas"
                  label={`参考图 ${form.sceneImageUrls.length}/${ADMIN_SCENE_IMAGE_MAX}`}
                  urls={form.sceneImageUrls}
                  accept="image"
                  multiple
                  disabled={uploading || form.sceneImageUrls.length >= ADMIN_SCENE_IMAGE_MAX}
                  onFiles={(files) => {
                    for (const f of files) void uploadMedia(f, "referenceImage");
                  }}
                  onRemoveAt={(index) =>
                    setForm((p) => ({
                      ...p,
                      sceneImageUrls: p.sceneImageUrls.filter((_, i) => i !== index),
                    }))
                  }
                />
              ) : null}
              <label className="block text-xs">
                模型 key
                <input
                  className="mt-1 w-full rounded border border-[#d0d7de] px-2 py-1.5"
                  value={form.modelKey}
                  onChange={(e) => setForm((p) => ({ ...p, modelKey: e.target.value }))}
                />
              </label>
              <label className="block text-xs">
                排序
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-[#d0d7de] px-2 py-1.5"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))
                  }
                />
              </label>
              {form.category === "audio" ? (
                <>
                  <label className="block text-xs">
                    voiceId
                    <input
                      className="mt-1 w-full rounded border border-[#d0d7de] px-2 py-1.5"
                      value={form.voiceId}
                      onChange={(e) => setForm((p) => ({ ...p, voiceId: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs">
                    风格标签
                    <input
                      className="mt-1 w-full rounded border border-[#d0d7de] px-2 py-1.5"
                      value={form.audioStyleTag}
                      onChange={(e) => setForm((p) => ({ ...p, audioStyleTag: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs">
                    语速 {form.voiceSpeed}
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={form.voiceSpeed}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, voiceSpeed: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <label className="block text-xs">
                    稳定度 {form.voiceStability}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={form.voiceStability}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, voiceStability: Number(e.target.value) }))
                      }
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-[#d0d7de] px-3 py-1.5 text-xs"
                onClick={() => setFormOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-[#0969da] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                disabled={saving || uploading}
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
