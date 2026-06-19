"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Copy, Plus, Trash2, X } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { ProjectCoverMedia } from "@/components/canvas/project-cover-media";
import {
  createCanvasProject,
  deleteCanvasProject,
  duplicateCanvasProject,
  formatCanvasApiError,
  listCanvasTemplates,
  listMyCanvasProjects,
  patchCanvasProject,
  type CanvasProjectSummary,
  type CanvasTemplateRecord,
} from "@/lib/canvas-api";
import {
  BLANK_CANVAS,
  BUILTIN_CANVAS_TEMPLATES,
} from "@/lib/canvas/templates";
import { cloneGraphForNewProject } from "@/lib/canvas/clone";
import { defaultCanvasProjectName } from "@/lib/canvas/default-project-name";
import {
  canvasEditionBadgeClass,
  canvasEditionFromTemplateCanvas,
  canvasEditionLabel,
  isStoryPro2BuiltinTemplateId,
  isStoryProBuiltinTemplateId,
  isSbv1BuiltinTemplateId,
  STORY_PRO2_BUILTIN_TEMPLATE_ID,
  STORY_PRO_BUILTIN_TEMPLATE_ID,
  SBV1_BUILTIN_TEMPLATE_ID,
  type CanvasProjectEdition,
} from "@/lib/canvas/project-edition";

type StarterPick =
  | { kind: "blank" }
  | { kind: "builtin"; id: string }
  | { kind: "user"; id: string };

function normalizeEdition(
  edition: CanvasProjectSummary["edition"] | undefined,
): CanvasProjectEdition {
  if (edition === "sbv1") return "sbv1";
  if (edition === "pro2") return "pro2";
  if (edition === "pro") return "pro";
  return "standard";
}

function Inner() {
  const base = useBookMallBaseUrl();
  const dialogs = useDialogs();
  const [projects, setProjects] = useState<CanvasProjectSummary[]>([]);
  const [userTemplates, setUserTemplates] = useState<CanvasTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerEdition, setPickerEdition] = useState<CanvasProjectEdition>("standard");
  const [pick, setPick] = useState<StarterPick>({ kind: "blank" });
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    if (!base) {
      setLoading(false);
      setError("未配置主站地址（NEXT_PUBLIC_BOOK_MALL_URL），无法加载画布列表。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, tpl] = await Promise.all([
        listMyCanvasProjects(base),
        listCanvasTemplates(base).catch(() => []),
      ]);
      setProjects(list);
      setUserTemplates(tpl.filter((t) => !t.builtin));
      setError(null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "加载失败";
      setError(formatCanvasApiError(raw));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const onOpenPicker = useCallback((edition: CanvasProjectEdition) => {
    setPickerEdition(edition);
    if (edition === "pro2") {
      setPick({ kind: "builtin", id: STORY_PRO2_BUILTIN_TEMPLATE_ID });
    } else if (edition === "sbv1") {
      setPick({ kind: "builtin", id: SBV1_BUILTIN_TEMPLATE_ID });
    } else if (edition === "pro") {
      setPick({ kind: "builtin", id: STORY_PRO_BUILTIN_TEMPLATE_ID });
    } else {
      setPick({ kind: "blank" });
    }
    setName("");
    setPickerOpen(true);
  }, []);

  const pro2Projects = useMemo(
    () => projects.filter((p) => normalizeEdition(p.edition) === "pro2"),
    [projects],
  );
  const sbv1Projects = useMemo(
    () => projects.filter((p) => normalizeEdition(p.edition) === "sbv1"),
    [projects],
  );
  const proProjects = useMemo(
    () => projects.filter((p) => normalizeEdition(p.edition) === "pro"),
    [projects],
  );
  const standardProjects = useMemo(
    () => projects.filter((p) => normalizeEdition(p.edition) === "standard"),
    [projects],
  );

  const standardBuiltinOptions = useMemo(
    () =>
      BUILTIN_CANVAS_TEMPLATES.filter(
        (t) =>
          !isStoryProBuiltinTemplateId(t.id) &&
          !isStoryPro2BuiltinTemplateId(t.id) &&
          !isSbv1BuiltinTemplateId(t.id),
      ).map(
        (t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        }),
      ),
    [],
  );

  const proBuiltinOptions = useMemo(
    () =>
      BUILTIN_CANVAS_TEMPLATES.filter((t) => isStoryProBuiltinTemplateId(t.id)).map(
        (t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        }),
      ),
    [],
  );

  const pro2BuiltinOptions = useMemo(
    () =>
      BUILTIN_CANVAS_TEMPLATES.filter((t) => isStoryPro2BuiltinTemplateId(t.id)).map(
        (t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        }),
      ),
    [],
  );

  const sbv1BuiltinOptions = useMemo(
    () =>
      BUILTIN_CANVAS_TEMPLATES.filter((t) => isSbv1BuiltinTemplateId(t.id)).map(
        (t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        }),
      ),
    [],
  );

  const standardUserTemplates = useMemo(
    () =>
      userTemplates.filter(
        (t) => canvasEditionFromTemplateCanvas(t.canvas) === "standard",
      ),
    [userTemplates],
  );

  const proUserTemplates = useMemo(
    () =>
      userTemplates.filter(
        (t) => canvasEditionFromTemplateCanvas(t.canvas) === "pro",
      ),
    [userTemplates],
  );

  const pro2UserTemplates = useMemo(
    () =>
      userTemplates.filter(
        (t) => canvasEditionFromTemplateCanvas(t.canvas) === "pro2",
      ),
    [userTemplates],
  );

  const sbv1UserTemplates = useMemo(
    () =>
      userTemplates.filter(
        (t) => canvasEditionFromTemplateCanvas(t.canvas) === "sbv1",
      ),
    [userTemplates],
  );

  const onCreate = useCallback(async () => {
    if (!base) return;
    setCreating(true);
    try {
      let canvas: unknown = BLANK_CANVAS;
      if (pick.kind === "builtin") {
        const t = BUILTIN_CANVAS_TEMPLATES.find((x) => x.id === pick.id);
        if (t) canvas = cloneGraphForNewProject(t.canvas);
      } else if (pick.kind === "user") {
        const t = userTemplates.find((x) => x.id === pick.id);
        if (t) {
          canvas = cloneGraphForNewProject(
            t.canvas as Parameters<typeof cloneGraphForNewProject>[0],
          );
        }
      }
      const finalName = name.trim() || defaultCanvasProjectName();
      const created = await createCanvasProject(base, {
        name: finalName,
        canvas,
      });
      window.location.href = `/canvas/${created.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }, [base, name, pick, userTemplates]);

  const onDuplicate = useCallback(
    async (id: string, label: string) => {
      if (!base) return;
      setDuplicatingId(id);
      try {
        const created = await duplicateCanvasProject(base, id);
        await load();
        window.location.href = `/canvas/${created.id}`;
      } catch (e) {
        setError(
          e instanceof Error
            ? `复制「${label}」失败：${e.message}`
            : `复制「${label}」失败`,
        );
      } finally {
        setDuplicatingId(null);
      }
    },
    [base, load],
  );

  const onDelete = useCallback(
    async (id: string, label: string) => {
      if (!base) return;
      const ok = await dialogs.doubleConfirm({
        first: {
          title: `从我的画布删除「${label}」？`,
          message: "画布将从你的列表中移除。",
          confirmLabel: "继续",
          danger: true,
        },
        second: {
          title: "再次确认 · 不可恢复",
          message: `将永久删除画布「${label}」；所有节点与已生成的画作（云端存储 OSS）会被清理，无法恢复。`,
          confirmLabel: "永久删除",
          danger: true,
        },
      });
      if (!ok) return;
      try {
        await deleteCanvasProject(base, id);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "删除失败");
      }
    },
    [base, load, dialogs],
  );

  const onRename = useCallback(
    async (id: string, nextName: string) => {
      if (!base) return;
      const trimmed = nextName.trim() || defaultCanvasProjectName();
      try {
        await patchCanvasProject(base, id, { name: trimmed });
        setProjects((list) =>
          list.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
        );
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "重命名失败");
      }
    },
    [base],
  );

  const builtinOptions =
    pickerEdition === "sbv1"
      ? sbv1BuiltinOptions
      : pickerEdition === "pro2"
        ? pro2BuiltinOptions
        : pickerEdition === "pro"
          ? proBuiltinOptions
          : standardBuiltinOptions;
  const filteredUserTemplates =
    pickerEdition === "sbv1"
      ? sbv1UserTemplates
      : pickerEdition === "pro2"
        ? pro2UserTemplates
        : pickerEdition === "pro"
          ? proUserTemplates
          : standardUserTemplates;

  return (
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="twenty-eyebrow">canvas-web · projects</p>
          <h1 className="canvas-serif mt-2 text-3xl text-white">我的画布</h1>
          <p className="mt-2 text-sm text-[var(--canvas-muted)]">
            普通版、影视专业版 1.0/2.0、分镜视频 1.0 分开管理；节点类型互斥，请从对应分区新建或打开画布。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenPicker("standard")}
            className="twenty-btn-ghost text-sm"
          >
            <Plus className="mr-2 size-4" />
            新建普通版
          </button>
          <button
            type="button"
            onClick={() => onOpenPicker("pro")}
            className="twenty-btn-accent text-sm"
          >
            <Plus className="mr-2 size-4" />
            新建影视专业版
          </button>
          <button
            type="button"
            onClick={() => onOpenPicker("sbv1")}
            className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/25"
          >
            <Plus className="mr-2 inline size-4" />
            新建分镜视频 1.0
          </button>
          <button
            type="button"
            onClick={() => onOpenPicker("pro2")}
            className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-2 text-sm font-medium text-fuchsia-100 hover:bg-fuchsia-500/25"
          >
            <Plus className="mr-2 inline size-4" />
            新建影视专业版 2.0
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <button
            type="button"
            className="rounded-lg border border-red-400/40 px-3 py-1 text-xs text-red-100 hover:bg-red-500/15"
            onClick={() => void load()}
          >
            重试
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-12 text-center text-sm text-[var(--canvas-muted)]">
          还没有画布。请使用上方按钮分别创建普通版或影视专业版画布。
        </div>
      ) : (
        <div className="space-y-10">
          <ProjectsSection
            title="分镜视频 1.0"
            subtitle="图片 + 视频 · 即梦 Seedance 三种参考模式"
            edition="sbv1"
            projects={sbv1Projects}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            duplicatingId={duplicatingId}
            onRename={onRename}
            onCreate={() => onOpenPicker("sbv1")}
          />
          <ProjectsSection
            title="影视专业版 2.0"
            subtitle="LibTV 架构：薄卡片 + 检视面板；新复杂需求入口"
            edition="pro2"
            projects={pro2Projects}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            duplicatingId={duplicatingId}
            onRename={onRename}
            onCreate={() => onOpenPicker("pro2")}
          />
          <ProjectsSection
            title="影视专业版"
            subtitle="五阶段 SOP：故事 → 风格 → 设计 → 分镜 → 视频"
            edition="pro"
            projects={proProjects}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            duplicatingId={duplicatingId}
            onRename={onRename}
            onCreate={() => onOpenPicker("pro")}
          />
          <ProjectsSection
            title="普通版"
            subtitle="空白画布、海报/三视图模板、快手漫剧全链路等"
            edition="standard"
            projects={standardProjects}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            duplicatingId={duplicatingId}
            onRename={onRename}
            onCreate={() => onOpenPicker("standard")}
          />
        </div>
      )}

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface)] text-white shadow-xl">
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <p className="text-sm font-medium">
                新建画布 · {canvasEditionLabel(pickerEdition)}
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="space-y-4 p-5 text-sm">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                  画布名称
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={defaultCanvasProjectName()}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] focus:border-[var(--canvas-accent)]/60 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-white/40">
                  留空将自动生成唯一时间戳名称
                </p>
              </label>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                  起步模板 · {canvasEditionLabel(pickerEdition)}
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {pickerEdition === "standard" ? (
                    <PickCard
                      selected={pick.kind === "blank"}
                      onClick={() => setPick({ kind: "blank" })}
                      title="空白画布"
                      description="从零开始，自由拖入节点。"
                      badge="blank"
                    />
                  ) : null}
                  {builtinOptions.map((t) => (
                    <PickCard
                      key={t.id}
                      selected={pick.kind === "builtin" && pick.id === t.id}
                      onClick={() => setPick({ kind: "builtin", id: t.id })}
                      title={t.name}
                      description={t.description}
                      badge="内置"
                    />
                  ))}
                </ul>
              </div>

              {filteredUserTemplates.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    我保存的模板 · {canvasEditionLabel(pickerEdition)}
                  </p>
                  <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {filteredUserTemplates.map((t) => (
                      <PickCard
                        key={t.id}
                        selected={pick.kind === "user" && pick.id === t.id}
                        onClick={() => setPick({ kind: "user", id: t.id })}
                        title={t.name}
                        description={t.category}
                        badge="个人"
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void onCreate()}
                disabled={creating}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--canvas-accent)] px-3 py-1.5 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft)] hover:text-white disabled:opacity-60"
              >
                {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                创建并进入
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectsSection({
  title,
  subtitle,
  edition,
  projects,
  onDelete,
  onDuplicate,
  duplicatingId,
  onRename,
  onCreate,
}: {
  title: string;
  subtitle: string;
  edition: CanvasProjectEdition;
  projects: CanvasProjectSummary[];
  onDelete: (id: string, label: string) => void | Promise<void>;
  onDuplicate: (id: string, label: string) => void | Promise<void>;
  duplicatingId: string | null;
  onRename: (id: string, nextName: string) => void | Promise<void>;
  onCreate: () => void;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-medium text-white">{title}</h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] ${canvasEditionBadgeClass(edition)}`}
            >
              {canvasEditionLabel(edition)}
            </span>
            <span className="text-xs text-[var(--canvas-muted)]">{projects.length} 张</span>
          </div>
          <p className="mt-1 text-sm text-[var(--canvas-muted)]">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white hover:border-white/30"
        >
          <Plus className="mr-1 inline size-3" />
          新建
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] bg-[var(--canvas-surface)]/60 px-6 py-10 text-center text-sm text-[var(--canvas-muted)]">
          此分区暂无画布。
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {projects.map((p) => (
            <li
              key={p.id}
              className="group rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-4 transition hover:border-[var(--canvas-accent)]/40"
            >
              <Link href={`/canvas/${p.id}`} className="block">
                <div className="aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-[var(--canvas-accent)]/15 to-[var(--canvas-surface-2)]">
                  <ProjectCoverMedia
                    url={p.thumbnailUrl}
                    alt={p.name}
                    placeholderLetter={p.name}
                  />
                </div>
                <ProjectNameEditor
                  name={p.name}
                  onSave={(next) => void onRename(p.id, next)}
                />
                {p.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--canvas-muted)]">
                    {p.description}
                  </p>
                ) : null}
                <p className="mt-3 text-[11px] text-[var(--canvas-muted)]/80">
                  更新于 {new Date(p.updatedAt).toLocaleString("zh-CN")}
                </p>
              </Link>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={duplicatingId === p.id}
                  onClick={() => void onDuplicate(p.id, p.name)}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-50"
                  title="复制画布"
                >
                  {duplicatingId === p.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  复制
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(p.id, p.name)}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-red-400/40 hover:text-red-300"
                >
                  <Trash2 className="size-3" />
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectNameEditor({
  name,
  onSave,
}: {
  name: string;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== name.trim()) {
      onSave(draft);
    } else {
      setDraft(name);
    }
  };

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        onClick={(e) => e.preventDefault()}
        maxLength={80}
        autoFocus
        className="nodrag mt-3 w-full rounded-md border border-[var(--canvas-accent)]/40 bg-black/30 px-2 py-1 text-sm font-medium text-white focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        setEditing(true);
      }}
      className="mt-3 block w-full truncate text-left text-sm font-medium text-white hover:text-[var(--canvas-accent-soft)]"
      title="点击编辑名称"
    >
      {name}
    </button>
  );
}

function PickCard({
  title,
  description,
  selected,
  onClick,
  badge,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  badge: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group block w-full rounded-xl border p-3 text-left transition ${
          selected
            ? "border-[var(--canvas-accent)] bg-[var(--canvas-accent)]/10"
            : "border-white/10 bg-white/[0.03] hover:border-white/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-white">{title}</p>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
            {badge}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--canvas-muted)]">
          {description}
        </p>
      </button>
    </li>
  );
}

export function ProjectsClient() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
