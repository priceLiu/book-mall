"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Copy, Plus, Trash2, X, Star, Clapperboard, Send } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  CanvasListCover,
  CANVAS_LIST_GRID_CLASS,
} from "@/components/canvas/canvas-list-cover";
import {
  CanvasProjectOpenLink,
  CanvasProjectOpeningOverlay,
} from "@/components/canvas/canvas-project-open-link";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";
import {
  createCanvasProject,
  deleteCanvasProject,
  duplicateCanvasProject,
  formatCanvasApiError,
  listCanvasTemplates,
  listMyCanvasProjects,
  listPortalFeaturedProjects,
  listPortalCaseProjects,
  patchCanvasProject,
  patchPortalFeaturedProject,
  patchPortalCaseProject,
  submitCanvasPortalReview,
  prefetchCanvasProject,
  type CanvasProjectSummary,
  type CanvasTemplateRecord,
} from "@/lib/canvas-api";
import { markRecentProjectsStale } from "@/lib/canvas/recent-projects-invalidate";
import { canvasListCoverPropsFromProject } from "@/lib/canvas/canvas-list-cover-props";
import {
  BLANK_CANVAS,
  BUILTIN_CANVAS_TEMPLATES,
} from "@/lib/canvas/templates";
import { cloneGraphForNewProject } from "@/lib/canvas/clone";
import { ensureGraphMetaEdition } from "@/lib/canvas/canvas-layout-mode";
import { defaultCanvasProjectName } from "@/lib/canvas/default-project-name";
import {
  canvasEditionBadgeClass,
  canvasEditionFromTemplateCanvas,
  canvasEditionLabel,
  isStoryPro2BuiltinTemplateId,
  isStoryProBuiltinTemplateId,
  isSbv1BuiltinTemplateId,
  STORY_PRO2_BUILTIN_TEMPLATE_ID,
  STORY_PRO2_SCRIPT_BUILTIN_TEMPLATE_ID,
  STORY_PRO2_PRODUCTION_BUILTIN_TEMPLATE_ID,
  STORY_PRO_BUILTIN_TEMPLATE_ID,
  SBV1_BUILTIN_TEMPLATE_ID,
  type CanvasProjectEdition,
} from "@/lib/canvas/project-edition";
import { pro2CreateNeedsScriptPackageStep } from "@/lib/canvas/pro2-create-script-package-step";
import { withPro2ScriptFormatV13Meta } from "@/lib/canvas/pro2-project-format";
import { useCrewCollaborationAccess } from "@/lib/canvas/use-crew-collaboration-access";
import { listPickableScriptPackages } from "@/lib/canvas/list-pickable-script-packages";
import {
  applyScriptPackageToNewPro2Graph,
  type NewProjectScriptPackageAsset,
} from "@/lib/canvas/pro2-new-project-script-package";
import type { CanvasGraph } from "@/lib/canvas/types";
import { ProjectsSubNav } from "@/components/layout/projects-sub-nav";
import { PortalSubmitDialog } from "@/components/home/portal-submit-dialog";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const base = useBookMallBaseUrl();
  const dialogs = useDialogs();
  const collaboration = useCrewCollaborationAccess();
  const isAdmin = useCanvasAdmin();
  const [projects, setProjects] = useState<CanvasProjectSummary[]>([]);
  const [portalFeaturedIds, setPortalFeaturedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [portalCaseIds, setPortalCaseIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [portalFilmCaseIds, setPortalFilmCaseIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [submitTarget, setSubmitTarget] = useState<{
    id: string;
    name: string;
    edition: CanvasProjectEdition;
  } | null>(null);
  const [userTemplates, setUserTemplates] = useState<CanvasTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerEdition, setPickerEdition] = useState<CanvasProjectEdition>("pro2");
  const [pick, setPick] = useState<StarterPick>({ kind: "blank" });
  const [name, setName] = useState("");
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  /** Pro2 · 跳过模板/名称步，直接选剧本或空白画布 */
  const [pro2ScriptPackageOnly, setPro2ScriptPackageOnly] = useState(false);
  const [scriptPackageChoice, setScriptPackageChoice] = useState<
    "skip" | "pick"
  >("skip");
  const [scriptPackagePick, setScriptPackagePick] =
    useState<NewProjectScriptPackageAsset | null>(null);
  const [scriptPackages, setScriptPackages] = useState<
    NewProjectScriptPackageAsset[]
  >([]);
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
  const [scriptPackageLoading, setScriptPackageLoading] = useState(false);

  const load = useCallback(async () => {
    if (!base) {
      setLoading(false);
      setError("未配置主站地址（NEXT_PUBLIC_BOOK_MALL_URL），无法加载画布列表。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listMyCanvasProjects(base);
      setProjects(Array.isArray(list) ? list : []);
      // 禁止列表加载后批量 GET 全量 canvas JSON：会打满远端连接池
      // （日志里单项目 6s+、列表 12s），导致打开画布 / introspect 一起饿死。
      // 仅 hover / pointerdown 预取当前点的项目（prefetchCanvasProject）。
      setLoading(false);
      void listCanvasTemplates(base)
        .then((tpl) => {
          setUserTemplates(
            (Array.isArray(tpl) ? tpl : []).filter((t) => !t.builtin),
          );
        })
        .catch(() => undefined);
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

  /** 路由未跳转成功时，避免「正在打开画布…」遮罩一直盖住列表 */
  useEffect(() => {
    if (!openingProjectId) return;
    const timer = window.setTimeout(() => {
      setOpeningProjectId(null);
    }, 45_000);
    return () => window.clearTimeout(timer);
  }, [openingProjectId]);

  const prefetchProject = useCallback(
    (id: string) => {
      router.prefetch(`/canvas/${id}`);
      if (base) prefetchCanvasProject(base, id);
    },
    [router, base],
  );

  const refreshPortalFeaturedIds = useCallback(async () => {
    if (!base?.trim() || !isAdmin) {
      setPortalFeaturedIds(new Set());
      return;
    }
    try {
      const list = await listPortalFeaturedProjects(base);
      setPortalFeaturedIds(new Set(list.map((p) => p.id)));
    } catch {
      setPortalFeaturedIds(new Set());
    }
  }, [base, isAdmin]);

  useEffect(() => {
    void refreshPortalFeaturedIds();
  }, [refreshPortalFeaturedIds]);

  const refreshPortalCaseIds = useCallback(async () => {
    if (!base?.trim() || !isAdmin) {
      setPortalCaseIds(new Set());
      setPortalFilmCaseIds(new Set());
      return;
    }
    try {
      const [pro2Cases, sbv1Cases] = await Promise.all([
        listPortalCaseProjects(base, "pro2"),
        listPortalCaseProjects(base, "sbv1"),
      ]);
      setPortalCaseIds(new Set(pro2Cases.map((p) => p.id)));
      setPortalFilmCaseIds(new Set(sbv1Cases.map((p) => p.id)));
    } catch {
      setPortalCaseIds(new Set());
      setPortalFilmCaseIds(new Set());
    }
  }, [base, isAdmin]);

  useEffect(() => {
    void refreshPortalCaseIds();
  }, [refreshPortalCaseIds]);

  const onTogglePortalCase = useCallback(
    async (id: string, caseFlag: boolean) => {
      if (!base?.trim()) return;
      try {
        await patchPortalCaseProject(base, id, { case: caseFlag });
        await refreshPortalCaseIds();
      } catch (e) {
        await dialogs.alert({
          title: caseFlag ? "设为案例失败" : "取消案例失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      }
    },
    [base, dialogs, refreshPortalCaseIds],
  );

  const onSubmitPortalReview = useCallback(
    async (kind: import("@/lib/canvas-api").CanvasPortalPublishKind, note: string) => {
      if (!base?.trim() || !submitTarget) return;
      const result = await submitCanvasPortalReview(base, submitTarget.id, {
        requestKind: kind,
        userNote: note || undefined,
      });
      markRecentProjectsStale();
      if (result.appliedImmediately) {
        await dialogs.alert({
          title: "已发布",
          message:
            kind === "CASE" && submitTarget.edition === "sbv1"
              ? "作品已发布到首页「视频作品」。"
              : "作品已按所选类型对外展示。",
          variant: "success",
        });
        if (kind === "FEATURED") await refreshPortalFeaturedIds();
        if (kind === "CASE") await refreshPortalCaseIds();
      } else {
        await dialogs.alert({
          title: "已提交",
          message: "管理员审核通过后将展示在首页相应位置。",
          variant: "success",
        });
      }
    },
    [base, dialogs, submitTarget, refreshPortalFeaturedIds, refreshPortalCaseIds],
  );

  const onTogglePortalFeatured = useCallback(
    async (id: string, featured: boolean) => {
      if (!base?.trim()) return;
      try {
        await patchPortalFeaturedProject(base, id, { featured });
        await refreshPortalFeaturedIds();
      } catch (e) {
        await dialogs.alert({
          title: featured ? "设为首页示例失败" : "取消首页示例失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      }
    },
    [base, dialogs, refreshPortalFeaturedIds],
  );

  const resetCreateWizard = useCallback(() => {
    setCreateStep(1);
    setPro2ScriptPackageOnly(false);
    setScriptPackageChoice("skip");
    setScriptPackagePick(null);
    setScriptPackages([]);
  }, []);

  const openPro2CreateDialog = useCallback(() => {
    setPickerEdition("pro2");
    setPick({ kind: "builtin", id: STORY_PRO2_BUILTIN_TEMPLATE_ID });
    setName("");
    setScriptPackageChoice("skip");
    setScriptPackagePick(null);
    setCreateStep(2);
    setPro2ScriptPackageOnly(true);
    setPickerOpen(true);
    void (async () => {
      setScriptPackageLoading(true);
      try {
        if (base?.trim()) {
          setScriptPackages(await listPickableScriptPackages(base));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载剧本包失败");
      } finally {
        setScriptPackageLoading(false);
      }
    })();
  }, [base]);

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
    resetCreateWizard();
    setPickerOpen(true);
  }, [resetCreateWizard]);

  const pro2Projects = useMemo(
    () =>
      projects.filter((p) => {
        const e = normalizeEdition(p.edition);
        return e === "pro2" || e === "standard";
      }),
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

  const pro2BuiltinOptions = useMemo(() => {
    const items = BUILTIN_CANVAS_TEMPLATES.filter((t) =>
      isStoryPro2BuiltinTemplateId(t.id),
    ).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      highlight: t.id === STORY_PRO2_SCRIPT_BUILTIN_TEMPLATE_ID,
    }));
    return items.sort((a, b) => {
      if (a.id === STORY_PRO2_SCRIPT_BUILTIN_TEMPLATE_ID) return -1;
      if (b.id === STORY_PRO2_SCRIPT_BUILTIN_TEMPLATE_ID) return 1;
      return 0;
    });
  }, []);

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

  const needsScriptPackageStep = useMemo(
    () =>
      pickerEdition === "pro2" &&
      collaboration.canUseCrewBulletin &&
      pro2CreateNeedsScriptPackageStep(pick, userTemplates),
    [pickerEdition, pick, userTemplates, collaboration.canUseCrewBulletin],
  );

  const loadScriptPackages = useCallback(async () => {
    if (!base?.trim()) return;
    setScriptPackageLoading(true);
    try {
      setScriptPackages(await listPickableScriptPackages(base));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载剧本包失败");
    } finally {
      setScriptPackageLoading(false);
    }
  }, [base]);

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
      if (scriptPackagePick) {
        canvas = applyScriptPackageToNewPro2Graph(
          canvas as CanvasGraph,
          scriptPackagePick,
        );
      }
      let graph = canvas as CanvasGraph;
      if (pickerEdition === "pro2" || pickerEdition === "sbv1") {
        graph = {
          ...graph,
          meta: { ...(graph.meta ?? {}), edition: pickerEdition },
        };
      }
      graph = {
        ...graph,
        meta:
          ensureGraphMetaEdition(graph.nodes ?? [], graph.meta ?? null) ??
          graph.meta,
      };
      if (pickerEdition === "pro2") {
        graph = withPro2ScriptFormatV13Meta(graph);
      }
      const finalName = name.trim() || defaultCanvasProjectName();
      const created = await createCanvasProject(base, {
        name: finalName,
        canvas: graph,
      });
      window.location.href = `/canvas/${created.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }, [base, name, pick, pickerEdition, userTemplates, scriptPackagePick]);

  const onPrimaryCreateAction = useCallback(async () => {
    if (
      !pro2ScriptPackageOnly &&
      createStep === 1 &&
      needsScriptPackageStep
    ) {
      setCreateStep(2);
      if (scriptPackageChoice === "pick") {
        await loadScriptPackages();
      }
      return;
    }
    if (
      (pro2ScriptPackageOnly || createStep === 2) &&
      scriptPackageChoice === "pick" &&
      !scriptPackagePick
    ) {
      setError("请选择已发布剧本，或改为「空白画布」。");
      return;
    }
    await onCreate();
  }, [
    pro2ScriptPackageOnly,
    createStep,
    needsScriptPackageStep,
    scriptPackageChoice,
    scriptPackagePick,
    loadScriptPackages,
    onCreate,
  ]);

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
    async (id: string, label: string, collaborationLocked?: boolean) => {
      if (!base) return;
      if (collaborationLocked) {
        await dialogs.alert({
          title: "无法删除协同画布",
          message: `「${label}」已绑定脚本包与制作公告栏，属于协同制作画布，不能删除。`,
          variant: "error",
        });
        return;
      }
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
        : proBuiltinOptions;
  const filteredUserTemplates =
    pickerEdition === "sbv1"
      ? sbv1UserTemplates
      : pickerEdition === "pro2"
        ? pro2UserTemplates
        : proUserTemplates;

  return (
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <ProjectsSubNav align="start" className="min-w-0 max-w-full" />
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={openPro2CreateDialog}
              className="twenty-btn-accent text-sm"
            >
              <Plus className="mr-2 size-4" />
              新建影视专业版 2.0
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
              onClick={() => onOpenPicker("pro")}
              className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-2 text-sm font-medium text-fuchsia-100 hover:bg-fuchsia-500/25"
            >
              <Plus className="mr-2 inline size-4" />
              新建影视专业版
            </button>
          </div>
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
          还没有画布。请使用上方按钮创建影视专业版或分镜视频画布。
        </div>
      ) : (
        <div className="space-y-10">
          <ProjectsSection
            title="分镜视频 1.0"
            edition="sbv1"
            projects={sbv1Projects}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            duplicatingId={duplicatingId}
            onPrefetchProject={prefetchProject}
            onRename={onRename}
            onCreate={() => onOpenPicker("sbv1")}
            isAdmin={isAdmin}
            portalFeaturedIds={portalFeaturedIds}
            portalCaseIds={portalFilmCaseIds}
            onTogglePortalFeatured={onTogglePortalFeatured}
            onTogglePortalCase={onTogglePortalCase}
            onOpenSubmit={(id, name) =>
              setSubmitTarget({ id, name, edition: "sbv1" })
            }
            openingProjectId={openingProjectId}
            onOpeningProject={setOpeningProjectId}
          />
          <ProjectsSection
            title="影视专业版 2.0"
            edition="pro2"
            projects={pro2Projects}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            duplicatingId={duplicatingId}
            onPrefetchProject={prefetchProject}
            onRename={onRename}
            onCreate={openPro2CreateDialog}
            isAdmin={isAdmin}
            portalFeaturedIds={portalFeaturedIds}
            portalCaseIds={portalCaseIds}
            onTogglePortalFeatured={onTogglePortalFeatured}
            onTogglePortalCase={onTogglePortalCase}
            onOpenSubmit={(id, name) =>
              setSubmitTarget({ id, name, edition: "pro2" })
            }
            openingProjectId={openingProjectId}
            onOpeningProject={setOpeningProjectId}
          />
          <ProjectsSection
            title="影视专业版"
            edition="pro"
            projects={proProjects}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            duplicatingId={duplicatingId}
            onPrefetchProject={prefetchProject}
            onRename={onRename}
            onCreate={() => onOpenPicker("pro")}
            isAdmin={isAdmin}
            portalFeaturedIds={portalFeaturedIds}
            portalCaseIds={portalCaseIds}
            onTogglePortalFeatured={onTogglePortalFeatured}
            onTogglePortalCase={onTogglePortalCase}
            onOpenSubmit={(id, name) =>
              setSubmitTarget({ id, name, edition: "pro" })
            }
            openingProjectId={openingProjectId}
            onOpeningProject={setOpeningProjectId}
          />
        </div>
      )}

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface)] text-white shadow-xl">
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <p className="text-sm font-medium">
                新建画布 · {canvasEditionLabel(pickerEdition)}
                {pro2ScriptPackageOnly ||
                (needsScriptPackageStep && createStep === 2)
                  ? " · 选择已发布剧本"
                  : null}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  resetCreateWizard();
                }}
                className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="space-y-4 p-5 text-sm">
              {pro2ScriptPackageOnly || createStep === 2 ? (
                <div className="space-y-3">
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
                  <p className="text-[12px] text-white/70">
                    画布为空白协作空间。可选关联已发布剧本：进入后公告栏自动展开，剧组可在其中参与制作任务；各画布进度独立。
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">
                      <input
                        type="radio"
                        name="script-package-choice"
                        className="mt-0.5"
                        checked={scriptPackageChoice === "skip"}
                        onChange={() => {
                          setScriptPackageChoice("skip");
                          setScriptPackagePick(null);
                        }}
                      />
                      <span>
                        <span className="block text-[13px] text-white">空白画布</span>
                        <span className="text-[11px] text-white/45">
                          先建空白 2.0 画布，进入后可在公告条关联已发布剧本并参与制作任务。
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">
                      <input
                        type="radio"
                        name="script-package-choice"
                        className="mt-0.5"
                        checked={scriptPackageChoice === "pick"}
                        onChange={() => {
                          setScriptPackageChoice("pick");
                          void loadScriptPackages();
                        }}
                      />
                      <span>
                        <span className="block text-[13px] text-white">选择已发布剧本</span>
                        <span className="text-[11px] text-white/45">
                          打开空白画布并关联该剧本；公告栏展开后可参与制作角色、分镜等任务。
                        </span>
                      </span>
                    </label>
                  </div>
                  {scriptPackageChoice === "pick" ? (
                    scriptPackageLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-white/55">
                        <Loader2 className="size-4 animate-spin" />
                        加载已发布剧本…
                      </div>
                    ) : scriptPackages.length === 0 ? (
                      <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-[12px] text-white/50">
                        暂无已发布剧本。请先在任意 2.0 画布的故事脚本生成中发布剧本，或选「空白画布」进入后再关联。
                      </p>
                    ) : (
                      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
                        {scriptPackages.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={`w-full rounded-md px-3 py-2 text-left text-[12px] transition hover:bg-white/5 ${
                                scriptPackagePick?.id === p.id
                                  ? "border border-cyan-400/40 bg-cyan-500/10 text-cyan-50"
                                  : "border border-transparent text-white/85"
                              }`}
                              onClick={() => setScriptPackagePick(p)}
                            >
                              {p.displayName}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </div>
              ) : (
                <>
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
                  {builtinOptions.map((t) => (
                    <PickCard
                      key={t.id}
                      selected={pick.kind === "builtin" && pick.id === t.id}
                      onClick={() => setPick({ kind: "builtin", id: t.id })}
                      title={t.name}
                      description={t.description}
                      badge={
                        "highlight" in t && t.highlight ? "推荐" : "内置"
                      }
                      accent={
                        "highlight" in t && t.highlight
                          ? "cyan"
                          : undefined
                      }
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
                </>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
              <div>
                {!pro2ScriptPackageOnly && createStep === 2 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
                  >
                    上一步
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  resetCreateWizard();
                }}
                className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void onPrimaryCreateAction()}
                disabled={creating}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--canvas-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:opacity-60"
              >
                {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                {!pro2ScriptPackageOnly &&
                createStep === 1 &&
                needsScriptPackageStep
                  ? "下一步"
                  : "创建并进入"}
              </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      <PortalSubmitDialog
        open={submitTarget != null}
        projectName={submitTarget?.name ?? ""}
        edition={submitTarget?.edition}
        isAdmin={isAdmin}
        onClose={() => setSubmitTarget(null)}
        onSubmit={onSubmitPortalReview}
      />

      <CanvasProjectOpeningOverlay visible={Boolean(openingProjectId)} />
    </div>
  );
}

function ProjectsSection({
  title,
  edition,
  projects,
  onDelete,
  onDuplicate,
  duplicatingId,
  onPrefetchProject,
  onRename,
  onCreate,
  isAdmin,
  portalFeaturedIds,
  portalCaseIds,
  onTogglePortalFeatured,
  onTogglePortalCase,
  onOpenSubmit,
  openingProjectId,
  onOpeningProject,
}: {
  title: string;
  edition: CanvasProjectEdition;
  projects: CanvasProjectSummary[];
  onDelete: (id: string, label: string, collaborationLocked?: boolean) => void | Promise<void>;
  onDuplicate: (id: string, label: string) => void | Promise<void>;
  duplicatingId: string | null;
  onPrefetchProject: (id: string) => void;
  onRename: (id: string, nextName: string) => void | Promise<void>;
  onCreate: () => void;
  isAdmin?: boolean;
  portalFeaturedIds?: Set<string>;
  portalCaseIds?: Set<string>;
  onTogglePortalFeatured?: (id: string, featured: boolean) => void | Promise<void>;
  onTogglePortalCase?: (id: string, caseFlag: boolean) => void | Promise<void>;
  onOpenSubmit?: (id: string, name: string) => void;
  openingProjectId: string | null;
  onOpeningProject: (id: string | null) => void;
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
        <ul className={CANVAS_LIST_GRID_CLASS}>
          {projects.map((p) => (
            <li
              key={p.id}
              className="group relative rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-4 transition hover:border-[var(--canvas-accent)]/40"
              onMouseEnter={() => onPrefetchProject(p.id)}
            >
              <CanvasProjectOpenLink
                projectId={p.id}
                openingProjectId={openingProjectId}
                onOpeningProject={onOpeningProject}
                onPrefetchProject={onPrefetchProject}
              >
                <CanvasListCover name={p.name} {...canvasListCoverPropsFromProject(p)} />
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
                  更新于 {formatProjectUpdatedAt(p.updatedAt)}
                </p>
              </CanvasProjectOpenLink>
              <div className="mt-3 flex items-center justify-end gap-2">
                {isAdmin && onTogglePortalCase ? (
                  <button
                    type="button"
                    onClick={() =>
                      void onTogglePortalCase(p.id, !portalCaseIds?.has(p.id))
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                      portalCaseIds?.has(p.id)
                        ? edition === "sbv1"
                          ? "border-cyan-400/40 text-cyan-200 hover:border-cyan-400/60"
                          : "border-violet-400/40 text-violet-200 hover:border-violet-400/60"
                        : edition === "sbv1"
                          ? "border-white/10 text-[var(--canvas-muted)] hover:border-cyan-400/35 hover:text-cyan-200/90"
                          : "border-white/10 text-[var(--canvas-muted)] hover:border-violet-400/35 hover:text-violet-200/90",
                    )}
                    title={
                      portalCaseIds?.has(p.id)
                        ? edition === "sbv1"
                          ? "取消视频作品"
                          : "取消首页案例"
                        : edition === "sbv1"
                          ? "设为视频作品"
                          : "设为首页案例"
                    }
                  >
                    <Clapperboard className="size-3" />
                    {edition === "sbv1" ? "视频作品" : "案例"}
                  </button>
                ) : null}
                {isAdmin && onTogglePortalFeatured ? (
                  <button
                    type="button"
                    onClick={() =>
                      void onTogglePortalFeatured(
                        p.id,
                        !portalFeaturedIds?.has(p.id),
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                      portalFeaturedIds?.has(p.id)
                        ? "border-amber-400/40 text-amber-200 hover:border-amber-400/60"
                        : "border-white/10 text-[var(--canvas-muted)] hover:border-amber-400/35 hover:text-amber-200/90",
                    )}
                    title={
                      portalFeaturedIds?.has(p.id)
                        ? "取消首页示例"
                        : "设为首页精选示例"
                    }
                  >
                    <Star
                      className={cn(
                        "size-3",
                        portalFeaturedIds?.has(p.id) && "fill-current",
                      )}
                    />
                    首页
                  </button>
                ) : null}
                {onOpenSubmit ? (
                  <button
                    type="button"
                    onClick={() => onOpenSubmit(p.id, p.name)}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-sky-400/40 hover:text-sky-200"
                    title="提交作品给管理员审核"
                  >
                    <Send className="size-3" />
                    投稿
                  </button>
                ) : null}
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
                  disabled={p.collaborationLocked}
                  onClick={() =>
                    void onDelete(p.id, p.name, p.collaborationLocked)
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-[var(--canvas-muted)]"
                  title={
                    p.collaborationLocked
                      ? "协同画布已绑定脚本包，不能删除"
                      : "删除画布"
                  }
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

function formatProjectUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("zh-CN");
}

function ProjectNameEditor({
  name,
  onSave,
}: {
  name: string;
  onSave: (name: string) => void;
}) {
  const safeName = name ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(safeName);

  useEffect(() => {
    if (!editing) setDraft(safeName);
  }, [safeName, editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== safeName.trim()) {
      onSave(draft);
    } else {
      setDraft(safeName);
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
            setDraft(safeName);
            setEditing(false);
          }
        }}
        onClick={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        maxLength={80}
        autoFocus
        className="nodrag mt-3 w-full rounded-md border border-[var(--canvas-accent)]/40 bg-black/30 px-2 py-1 text-sm font-medium text-white focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditing(true);
      }}
      className="mt-3 block w-full truncate text-left text-sm font-medium text-white hover:text-[var(--canvas-accent-soft)]"
      title="点击编辑名称"
    >
      {safeName || "未命名画布"}
    </button>
  );
}

function PickCard({
  title,
  description,
  selected,
  onClick,
  badge,
  accent,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  badge: string;
  accent?: "cyan";
}) {
  const accentSelected =
    accent === "cyan"
      ? "border-cyan-400/50 bg-cyan-500/10"
      : "border-[var(--canvas-accent)] bg-[var(--canvas-accent)]/10";
  const accentBadge =
    accent === "cyan" ? "bg-cyan-500/20 text-cyan-100" : "bg-white/10";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group block w-full rounded-xl border p-3 text-left transition ${
          selected
            ? accentSelected
            : accent === "cyan"
              ? "border-cyan-400/20 bg-cyan-950/20 hover:border-cyan-400/35"
              : "border-white/10 bg-white/[0.03] hover:border-white/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-white">{title}</p>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)] ${accentBadge}`}
          >
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
  return <Inner />;
}
