"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AdminMediaField } from "@/components/admin/template-admin/admin-media-field";
import { AdminMediaPasteProvider } from "@/components/admin/template-admin/admin-media-paste-context";
import { AdminMediaThumb } from "@/components/admin/template-admin/admin-media-thumb";
import {
  confirmDestructiveTwice,
  CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
} from "@/lib/confirm-destructive-twice";
import ECOM_TEMPLATE_CATEGORIES from "@/lib/ecom/ecom-template-categories.json";

type EcomSub = "templates" | "models";

type TemplateRow = {
  id: string;
  category: string;
  mediaKind: "image" | "video";
  title: string;
  hot: boolean;
  ossUrl: string;
  thumbUrl: string;
  coverUrl?: string | null;
  mainImageUrl?: string | null;
  referenceImages?: Array<{ url: string; label?: string }>;
  promptText?: string | null;
  negativePrompt?: string | null;
  defaultModelKey?: string | null;
  posterUrl?: string | null;
  sortOrder?: number;
};

type ModelRow = {
  id: string;
  name: string;
  gender: "female" | "male" | "plus_female";
  age: "adult" | "child";
  ossUrl: string;
  sortOrder?: number;
};

/** 生成物，源头在 e-commerce-toolkit；改分类请见 `pnpm ecom:sync-categories` */
const CATEGORIES: Array<{ id: string; label: string }> = ECOM_TEMPLATE_CATEGORIES;
const DEFAULT_CATEGORY = CATEGORIES[0]?.id ?? "womens";

/** 模板区列表：「没有提示词」筛选（localStorage 持久化） */
const NO_PROMPT_FILTER_STORAGE_KEY = "admin-ecom-templates-filter-no-prompt";

function readNoPromptFilterPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(NO_PROMPT_FILTER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeNoPromptFilterPreference(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(NO_PROMPT_FILTER_STORAGE_KEY, "1");
    else localStorage.removeItem(NO_PROMPT_FILTER_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

function templateHasPromptText(row: TemplateRow): boolean {
  return Boolean((row.promptText ?? "").trim());
}

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

function categoryLabel(id: string): string {
  return CATEGORY_LABEL.get(id) ?? id;
}

const DEFAULT_TEMPLATE_TITLE_IMAGE = "AI商品主图（服装大片）";
const DEFAULT_TEMPLATE_TITLE_VIDEO = "AI商品视频";

function defaultTemplateTitle(mediaKind: "image" | "video"): string {
  return mediaKind === "video" ? DEFAULT_TEMPLATE_TITLE_VIDEO : DEFAULT_TEMPLATE_TITLE_IMAGE;
}

/** 标题为空时填入与 HTML 导入一致的默认文案 */
function withAutoTemplateTitle(form: TemplateRow): TemplateRow {
  if (form.title.trim()) return form;
  return { ...form, title: defaultTemplateTitle(form.mediaKind) };
}

/** 走 multipart：dataURL 会把体积撑大 1/3，模板原图动辄十几 MB */
async function uploadMedia(
  url: string,
  file: File,
  fields: Record<string, string>,
): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const res = await fetch(url, { method: "POST", body });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "上传失败");
  return data.url;
}

type TemplateUploadSlot = "preview" | "cover" | "main" | "ref";

type TemplateUploadResult = {
  url: string;
  thumbUrl?: string;
  coverUrl?: string;
};

async function uploadTemplateMedia(
  file: File,
  args: {
    category: string;
    id: string;
    slot: TemplateUploadSlot;
    refKey?: string;
    autoCover?: boolean;
  },
): Promise<TemplateUploadResult> {
  const body = new FormData();
  body.append("file", file);
  body.append("category", args.category);
  body.append("id", args.id);
  body.append("slot", args.slot);
  if (args.refKey) body.append("refKey", args.refKey);
  if (args.autoCover) body.append("autoCover", "1");
  const res = await fetch("/api/admin/ecom/template-gallery/assets/upload", {
    method: "POST",
    body,
  });
  const data = (await res.json()) as TemplateUploadResult & { error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "上传失败");
  return data;
}

const EMPTY_TPL: TemplateRow = {
  id: "",
  category: DEFAULT_CATEGORY,
  mediaKind: "image",
  title: "",
  hot: false,
  ossUrl: "",
  thumbUrl: "",
  coverUrl: null,
  mainImageUrl: null,
  referenceImages: [],
  promptText: null,
  negativePrompt: null,
  defaultModelKey: null,
  sortOrder: 0,
};

function emptyStrToNull(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

/** 提交前规范化：空字符串转 null，避免 PATCH 把可选字段写成 "" */
function normalizeTemplatePayload(form: TemplateRow): TemplateRow {
  const withTitle = withAutoTemplateTitle(form);
  return {
    ...withTitle,
    id: withTitle.id.trim(),
    title: withTitle.title.trim(),
    ossUrl: withTitle.ossUrl.trim(),
    thumbUrl: (withTitle.thumbUrl ?? "").trim() || withTitle.ossUrl.trim(),
    coverUrl: emptyStrToNull(withTitle.coverUrl),
    mainImageUrl: emptyStrToNull(withTitle.mainImageUrl),
    promptText: emptyStrToNull(withTitle.promptText),
    negativePrompt: emptyStrToNull(withTitle.negativePrompt),
    defaultModelKey: emptyStrToNull(withTitle.defaultModelKey),
    referenceImages: (withTitle.referenceImages ?? []).filter((r) => r.url.trim()),
  };
}

/** 视频行的 ossUrl 是 mp4，塞进 <img> 只会裂图，只认封面 / 缩略图 */
function templateThumbSrc(row: TemplateRow): string {
  return row.coverUrl || row.thumbUrl || (row.mediaKind === "video" ? "" : row.ossUrl);
}

const EMPTY_MODEL: ModelRow = {
  id: "",
  name: "",
  gender: "female",
  age: "adult",
  ossUrl: "",
  sortOrder: 0,
};

export function AdminEcomTemplatesPanel() {
  const router = useRouter();
  const search = useSearchParams();
  const sub: EcomSub = search.get("ecom") === "models" ? "models" : "templates";

  function setSub(next: EcomSub) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", "ecom");
    params.set("ecom", next);
    router.replace(`/admin/templates?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1 text-xs ${sub === "templates" ? "bg-[#1f2328] text-white" : "border border-[#d0d7de]"}`}
          onClick={() => setSub("templates")}
        >
          模板区
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1 text-xs ${sub === "models" ? "bg-[#1f2328] text-white" : "border border-[#d0d7de]"}`}
          onClick={() => setSub("models")}
        >
          模特库
        </button>
      </div>
      {sub === "templates" ? <TemplatesAdmin /> : <ModelsAdmin />}
    </div>
  );
}

function TemplatesAdmin() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [media, setMedia] = useState<"all" | "image" | "video">("all");
  const [noPromptOnly, setNoPromptOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sourceQ, setSourceQ] = useState("");
  const [sourceStem, setSourceStem] = useState<string | null>(null);
  const [sourceRows, setSourceRows] = useState<TemplateRow[] | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateRow | null>(null);
  /** 打开编辑时的原始 id，用于 PATCH 路径（与表单内可改 id 解耦） */
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sourceSearchActive = sourceQ.trim().length > 0;

  useEffect(() => {
    setNoPromptOnly(readNoPromptFilterPreference());
  }, []);

  function toggleNoPromptOnly() {
    setNoPromptOnly((prev) => {
      const next = !prev;
      writeNoPromptFilterPreference(next);
      return next;
    });
  }

  // 只取当前分类：全量清单已数千条，后台没必要整包拉下来再前端过滤
  const load = useCallback(async () => {
    const res = await fetch(
      `/api/admin/ecom/template-gallery/templates?category=${encodeURIComponent(category)}`,
      { cache: "no-store" },
    );
    const text = await res.text();
    if (!text.trim()) throw new Error("接口无响应");
    let data: { templates?: TemplateRow[]; error?: string };
    try {
      data = JSON.parse(text) as { templates?: TemplateRow[]; error?: string };
    } catch {
      throw new Error("接口返回无效 JSON");
    }
    if (!res.ok) throw new Error(data.error ?? "加载失败");
    setRows(Array.isArray(data.templates) ? data.templates : []);
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

  useEffect(() => {
    const raw = sourceQ.trim();
    if (!raw) {
      setSourceStem(null);
      setSourceRows(null);
      setSourceError(null);
      setSourceLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSourceLoading(true);
        setSourceError(null);
        try {
          const res = await fetch(
            `/api/admin/ecom/template-gallery/templates/lookup?q=${encodeURIComponent(raw)}`,
            { cache: "no-store" },
          );
          const data = (await res.json()) as {
            stem?: string;
            templates?: TemplateRow[];
            error?: string;
          };
          if (!res.ok) throw new Error(data.error ?? "查询失败");
          if (cancelled) return;
          setSourceStem(typeof data.stem === "string" ? data.stem : null);
          setSourceRows(Array.isArray(data.templates) ? data.templates : []);
        } catch (e) {
          if (cancelled) return;
          setSourceStem(null);
          setSourceRows([]);
          setSourceError(e instanceof Error ? e.message : "查询失败");
        } finally {
          if (!cancelled) setSourceLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sourceQ]);

  const listRows = sourceSearchActive ? (sourceRows ?? []) : rows;

  const filtered = useMemo(
    () =>
      listRows.filter((r) => {
        if (media !== "all" && r.mediaKind !== media) return false;
        if (noPromptOnly && templateHasPromptText(r)) return false;
        if (q && !`${r.title} ${r.id}`.includes(q)) return false;
        return true;
      }),
    [listRows, media, noPromptOnly, q],
  );

  async function uploadField(file: File, field: "ossUrl" | "coverUrl" | "mainImageUrl" | "ref") {
    if (!form) return;
    setUploading(true);
    try {
      const id = form.id.trim() || `tpl-${Date.now()}`;
      const slot: TemplateUploadSlot =
        field === "ossUrl"
          ? "preview"
          : field === "coverUrl"
            ? "cover"
            : field === "mainImageUrl"
              ? "main"
              : "ref";
      const refKey =
        field === "ref" ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : undefined;
      const shouldAutoCover =
        (field === "ossUrl" || field === "mainImageUrl") &&
        file.type.startsWith("image/") &&
        !(form.coverUrl ?? "").trim();

      const uploaded = await uploadTemplateMedia(file, {
        category: form.category,
        id,
        slot,
        refKey,
        autoCover: shouldAutoCover,
      });

      setForm((prev) => {
        if (!prev) return prev;
        const withId = { ...prev, id: prev.id || id };
        let next: TemplateRow;
        if (field === "ref") {
          next = {
            ...withId,
            referenceImages: [...(withId.referenceImages ?? []), { url: uploaded.url }],
          };
        } else {
          next = { ...withId, [field]: uploaded.url };
          if (field === "ossUrl" && uploaded.thumbUrl) {
            next.thumbUrl = uploaded.thumbUrl;
          } else if (field === "ossUrl" && !prev.thumbUrl) {
            next.thumbUrl = uploaded.url;
          }
          if (uploaded.coverUrl && !(prev.coverUrl ?? "").trim()) {
            next.coverUrl = uploaded.coverUrl;
          }
        }
        return withAutoTemplateTitle(next);
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form) return;
    setFormNotice(null);

    const payload = normalizeTemplatePayload(form);
    if (!payload.id) {
      setFormNotice("请填写 ID");
      return;
    }
    if (!payload.title) {
      setFormNotice("请填写标题");
      return;
    }
    if (!payload.ossUrl) {
      setFormNotice("请上传主图 / 视频（ossUrl 必填）");
      return;
    }

    setSaving(true);
    try {
      const isNew = editingEntryId === null;
      const url = isNew
        ? "/api/admin/ecom/template-gallery/templates"
        : `/api/admin/ecom/template-gallery/templates/${encodeURIComponent(editingEntryId)}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: { error?: string } = {};
      if (text.trim()) {
        try {
          data = JSON.parse(text) as { error?: string };
        } catch {
          throw new Error("接口返回无效 JSON");
        }
      }
      if (!res.ok) throw new Error(data.error ?? `保存失败（HTTP ${res.status}）`);
      setForm(null);
      setEditingEntryId(null);
      setFormNotice(null);
      await load();
      setMessage("已保存");
    } catch (e) {
      setFormNotice(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function openNewForm() {
    setEditingEntryId(null);
    setFormNotice(null);
    setForm(
      withAutoTemplateTitle({ ...EMPTY_TPL, category, id: `${category}-${Date.now()}` }),
    );
  }

  function openEditForm(row: TemplateRow) {
    setEditingEntryId(row.id);
    setFormNotice(null);
    setForm(
      withAutoTemplateTitle({
        ...row,
        coverUrl: row.coverUrl ?? null,
        mainImageUrl: row.mainImageUrl ?? null,
        promptText: row.promptText ?? null,
        negativePrompt: row.negativePrompt ?? null,
        defaultModelKey: row.defaultModelKey ?? null,
        referenceImages: row.referenceImages ?? [],
      }),
    );
  }

  async function remove(row: TemplateRow) {
    if (
      !confirmDestructiveTwice(
        `确定删除模板「${row.title}」？`,
        CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/ecom/template-gallery/templates/${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setMessage(data.error ?? "删除失败");
      return;
    }
    await load();
    setMessage("已删除");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`rounded-full px-2.5 py-0.5 text-[11px] ${category === c.id ? "bg-[#ddf4ff] text-[#0969da]" : "border border-[#d0d7de]"}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "image", "video"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-md px-2 py-0.5 text-[11px] ${media === m ? "bg-[#1f2328] text-white" : "border border-[#d0d7de]"}`}
            onClick={() => setMedia(m)}
          >
            {m === "all" ? "全部" : m === "image" ? "图片" : "视频"}
          </button>
        ))}
        <button
          type="button"
          className={`rounded-md px-2 py-0.5 text-[11px] ${
            noPromptOnly ? "bg-[#8250df] text-white" : "border border-[#d0d7de]"
          }`}
          onClick={toggleNoPromptOnly}
          title="筛选 promptText 为空的条目；状态会记住，直到再次点击取消"
        >
          没有提示词
        </button>
        <input
          className="rounded border border-[#d0d7de] px-2 py-1 text-xs"
          placeholder="搜索标题 / id"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="min-w-[min(100%,28rem)] flex-1 rounded border border-[#0969da]/40 bg-[#f6f8fa] px-2 py-1 text-xs"
          placeholder="源链接 / UUID（yibaiaigc，跨品类反查）"
          value={sourceQ}
          onChange={(e) => setSourceQ(e.target.value)}
        />
        {sourceSearchActive ? (
          <button
            type="button"
            className="rounded border border-[#d0d7de] px-2 py-1 text-xs text-[#656d76]"
            onClick={() => setSourceQ("")}
          >
            清除源链接
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md bg-[#0969da] px-3 py-1 text-xs text-white"
          onClick={openNewForm}
        >
          新建
        </button>
        <span className="text-xs text-muted-foreground">
          {sourceSearchActive
            ? sourceLoading
              ? "源链接查询中…"
              : sourceError
                ? `源链接 · ${sourceError}`
                : sourceStem
                  ? `源 stem ${sourceStem} · ${filtered.length} 条${filtered.length === 0 ? "（未入库）" : ""}`
                  : `${filtered.length} 条`
            : loading
              ? "加载中…"
              : `${filtered.length} 条`}
          {!sourceSearchActive && error ? ` · ${error}` : ""}
          {message ? ` · ${message}` : ""}
        </span>
      </div>
      {sourceSearchActive && !sourceLoading && !sourceError && sourceStem ? (
        <p className="text-[11px] text-[#656d76]">
          按源图文件名前 12 字符 <span className="font-mono">{sourceStem}</span>{" "}
          匹配 catalog id 末尾；结果含全部品类。未入库表示 tmp/HTML 有图但尚未导入，或品类不对。
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-[#d0d7de] bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-[#f6f8fa] text-[#656d76]">
            <tr>
              <th className="px-3 py-2">封面</th>
              {sourceSearchActive ? <th className="px-3 py-2">品类</th> : null}
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">id</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={sourceSearchActive ? 5 : 4}
                  className="px-3 py-6 text-center text-[#656d76]"
                >
                  {sourceSearchActive && !sourceLoading
                    ? "无匹配条目"
                    : loading
                      ? "加载中…"
                      : "暂无数据"}
                </td>
              </tr>
            ) : null}
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-[#d0d7de]">
                <td className="px-3 py-2">
                  <AdminMediaThumb src={templateThumbSrc(row)} title={row.title} />
                </td>
                {sourceSearchActive ? (
                  <td className="px-3 py-2">
                    <span className="whitespace-nowrap">{categoryLabel(row.category)}</span>
                    {row.category !== category ? (
                      <button
                        type="button"
                        className="ml-1 text-[#0969da]"
                        onClick={() => setCategory(row.category)}
                      >
                        切换
                      </button>
                    ) : null}
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  {row.title}
                  {row.hot ? <span className="ml-1 text-[#cf222e]">爆</span> : null}
                </td>
                <td className="px-3 py-2 font-mono">{row.id}</td>
                <td className="space-x-2 px-3 py-2">
                  <button type="button" className="text-[#0969da]" onClick={() => openEditForm(row)}>
                    编辑
                  </button>
                  <button type="button" className="text-[#cf222e]" onClick={() => void remove(row)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form ? (
        <AdminMediaPasteProvider>
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-[#d0d7de] px-5 py-3">
            <h3 className="text-sm font-semibold">
              模板条目
              <span className="ml-2 font-mono text-xs font-normal text-[#656d76]">
                {form.id}
              </span>
            </h3>
            <button
              type="button"
              className="rounded border border-[#d0d7de] px-2 py-1 text-xs"
              onClick={() => {
                setForm(null);
                setEditingEntryId(null);
                setFormNotice(null);
              }}
            >
              关闭
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs">
                ID
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
              </label>
              <label className="text-xs">
                分类
                <select
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                媒体
                <select
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.mediaKind}
                  onChange={(e) => {
                    const mediaKind = e.target.value as "image" | "video";
                    const prevDefault = defaultTemplateTitle(form.mediaKind);
                    const title = form.title.trim();
                    setForm({
                      ...form,
                      mediaKind,
                      title:
                        !title || title === prevDefault
                          ? defaultTemplateTitle(mediaKind)
                          : form.title,
                    });
                  }}
                >
                  <option value="image">图片</option>
                  <option value="video">视频</option>
                </select>
              </label>
              <label className="text-xs">
                标题
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.title}
                  placeholder={defaultTemplateTitle(form.mediaKind)}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <AdminMediaField
                pasteFieldId="tpl-oss"
                label="主图 / 视频"
                url={form.ossUrl}
                accept="media"
                disabled={uploading}
                onUrlChange={(ossUrl) => setForm({ ...form, ossUrl })}
                onFiles={(files) => {
                  const f = files[0];
                  if (f) void uploadField(f, "ossUrl");
                }}
              />
              <AdminMediaField
                pasteFieldId="tpl-cover"
                label="封面"
                url={form.coverUrl ?? ""}
                accept="image"
                disabled={uploading}
                onUrlChange={(coverUrl) => setForm({ ...form, coverUrl })}
                onFiles={(files) => {
                  const f = files[0];
                  if (f) void uploadField(f, "coverUrl");
                }}
              />
              <AdminMediaField
                pasteFieldId="tpl-main"
                label="主图（同款）"
                url={form.mainImageUrl ?? ""}
                accept="image"
                disabled={uploading}
                onUrlChange={(mainImageUrl) => setForm({ ...form, mainImageUrl })}
                onFiles={(files) => {
                  const f = files[0];
                  if (f) void uploadField(f, "mainImageUrl");
                }}
              />
              <div className="sm:col-span-2">
                <AdminMediaField
                  pasteFieldId="tpl-ref"
                  label="参考图"
                  urls={(form.referenceImages ?? []).map((img) => img.url)}
                  accept="image"
                  multiple
                  disabled={uploading}
                  onFiles={(files) => {
                    for (const f of files) void uploadField(f, "ref");
                  }}
                  onRemoveAt={(i) =>
                    setForm({
                      ...form,
                      referenceImages: (form.referenceImages ?? []).filter((_, j) => j !== i),
                    })
                  }
                />
                {(form.referenceImages ?? []).map((img, i) => (
                  <div key={`${img.url}-${i}`} className="mt-1.5 flex items-center gap-2">
                    <span className="w-4 shrink-0 text-center text-[10px] text-[#656d76]">
                      {i + 1}
                    </span>
                    <input
                      className="w-full rounded border border-[#d0d7de] px-2 py-1 text-xs"
                      placeholder="该参考图的说明（选填，会展示给用户）"
                      value={img.label ?? ""}
                      onChange={(e) => {
                        const next = [...(form.referenceImages ?? [])];
                        next[i] = { ...img, label: e.target.value };
                        setForm({ ...form, referenceImages: next });
                      }}
                    />
                  </div>
                ))}
              </div>
              <label className="text-xs sm:col-span-2">
                提示词
                <textarea
                  className="mt-1 w-full rounded border px-2 py-1"
                  rows={5}
                  value={form.promptText ?? ""}
                  onChange={(e) => setForm({ ...form, promptText: e.target.value })}
                />
              </label>
              <label className="text-xs sm:col-span-2">
                负向提示词
                <textarea
                  className="mt-1 w-full rounded border px-2 py-1"
                  rows={5}
                  value={form.negativePrompt ?? ""}
                  onChange={(e) => setForm({ ...form, negativePrompt: e.target.value })}
                />
              </label>
              <label className="text-xs">
                默认模型
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.defaultModelKey ?? ""}
                  onChange={(e) => setForm({ ...form, defaultModelKey: e.target.value })}
                />
              </label>
              <label className="text-xs">
                排序
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.sortOrder ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-1 text-xs">
                <input
                  type="checkbox"
                  checked={form.hot}
                  onChange={(e) => setForm({ ...form, hot: e.target.checked })}
                />
                爆款
              </label>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#d0d7de] px-5 py-3">
            {uploading ? (
              <span className="mr-auto text-xs text-[#656d76]">上传中…</span>
            ) : formNotice ? (
              <span className="mr-auto text-xs text-[#cf222e]">{formNotice}</span>
            ) : null}
            <button
              type="button"
              className="rounded border border-[#d0d7de] px-3 py-1 text-xs"
              onClick={() => {
                setForm(null);
                setEditingEntryId(null);
                setFormNotice(null);
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded bg-[#0969da] px-3 py-1 text-xs text-white disabled:opacity-50"
              disabled={saving || uploading}
              onClick={() => void save()}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
        </AdminMediaPasteProvider>
      ) : null}
    </div>
  );
}

function ModelsAdmin() {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [gender, setGender] = useState<"all" | ModelRow["gender"]>("all");
  const [age, setAge] = useState<"all" | ModelRow["age"]>("all");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ModelRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ecom/model-library/models", { cache: "no-store" });
    const text = await res.text();
    if (!text.trim()) throw new Error("接口无响应");
    let data: { models?: ModelRow[]; error?: string };
    try {
      data = JSON.parse(text) as { models?: ModelRow[]; error?: string };
    } catch {
      throw new Error("接口返回无效 JSON");
    }
    if (!res.ok) throw new Error(data.error ?? "加载失败");
    setRows(Array.isArray(data.models) ? data.models : []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const filtered = rows.filter((r) => {
    if (gender !== "all" && r.gender !== gender) return false;
    if (age !== "all" && r.age !== age) return false;
    return true;
  });

  async function upload(file: File) {
    if (!form) return;
    setUploading(true);
    try {
      const id = form.id.trim() || `model-${Date.now()}`;
      const uploaded = await uploadMedia(
        "/api/admin/ecom/model-library/assets/upload",
        file,
        { id },
      );
      setForm({ ...form, id, ossUrl: uploaded });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const isNew = !rows.some((r) => r.id === form.id);
      const url = isNew
        ? "/api/admin/ecom/model-library/models"
        : `/api/admin/ecom/model-library/models/${encodeURIComponent(form.id)}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setForm(null);
      await load();
      setMessage("已保存");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: ModelRow) {
    if (
      !confirmDestructiveTwice(`确定删除模特「${row.name}」？`, CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH)
    ) {
      return;
    }
    const res = await fetch(`/api/admin/ecom/model-library/models/${encodeURIComponent(row.id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setMessage(data.error ?? "删除失败");
      return;
    }
    await load();
    setMessage("已删除");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded border px-2 py-1 text-xs"
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
        >
          <option value="all">全部性别</option>
          <option value="female">女</option>
          <option value="male">男</option>
          <option value="plus_female">大码女</option>
        </select>
        <select
          className="rounded border px-2 py-1 text-xs"
          value={age}
          onChange={(e) => setAge(e.target.value as typeof age)}
        >
          <option value="all">全部年龄</option>
          <option value="adult">成人</option>
          <option value="child">儿童</option>
        </select>
        <button
          type="button"
          className="rounded-md bg-[#0969da] px-3 py-1 text-xs text-white"
          onClick={() => setForm({ ...EMPTY_MODEL, id: `model-${Date.now()}` })}
        >
          新建
        </button>
        <span className="text-xs text-muted-foreground">
          {loading ? "加载中…" : `${filtered.length} 条`}
          {message ? ` · ${message}` : ""}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#d0d7de] bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-[#f6f8fa]">
            <tr>
              <th className="px-3 py-2">图</th>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">分类</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-[#d0d7de]">
                <td className="px-3 py-2">
                  <AdminMediaThumb src={row.ossUrl} title={row.name} />
                </td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">
                  {row.gender}/{row.age}
                </td>
                <td className="space-x-2 px-3 py-2">
                  <button type="button" className="text-[#0969da]" onClick={() => setForm(row)}>
                    编辑
                  </button>
                  <button type="button" className="text-[#cf222e]" onClick={() => void remove(row)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5">
            <h3 className="text-sm font-semibold">模特</h3>
            <label className="block text-xs">
              ID
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
              />
            </label>
            <label className="block text-xs">
              名称
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded border px-2 py-1 text-xs"
                value={form.gender}
                onChange={(e) =>
                  setForm({ ...form, gender: e.target.value as ModelRow["gender"] })
                }
              >
                <option value="female">女</option>
                <option value="male">男</option>
                <option value="plus_female">大码女</option>
              </select>
              <select
                className="rounded border px-2 py-1 text-xs"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value as ModelRow["age"] })}
              >
                <option value="adult">成人</option>
                <option value="child">儿童</option>
              </select>
            </div>
            <AdminMediaField
              label="图片"
              url={form.ossUrl}
              accept="image"
              disabled={uploading}
              onUrlChange={(ossUrl) => setForm({ ...form, ossUrl })}
              onFiles={(files) => {
                const f = files[0];
                if (f) void upload(f);
              }}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => setForm(null)}>
                取消
              </button>
              <button
                type="button"
                className="rounded bg-[#0969da] px-3 py-1 text-xs text-white"
                disabled={saving}
                onClick={() => void save()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
