"use client";

import type { EcomCopyImageArtifact } from "@private/ecom-copy-overlay";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomCopyLayoutStudioDialog } from "@/components/copy-layout/ecom-copy-layout-studio-dialog";
import { PosterStepSection } from "@/components/poster/poster-step-section";
import { PosterTemplatePicker } from "@/components/poster/poster-template-picker";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useBackgroundGenerationOptional } from "@/components/generation";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { composeEcomCopyOverlay } from "@/lib/ecom-detail-page-suite-hit-api";
import {
  createPosterProject,
  downloadPosterProjectZip,
  fetchPosterFestivals,
  getPosterProject,
  listPosterProjects,
  patchPosterProject,
  posterAutoPlan,
  posterBatchGenerate,
  posterCompose,
  posterGenerate,
  uploadPosterRef,
} from "@/lib/ecom-poster-api";
import {
  clearEcomLastProjectId,
  readEcomLastProjectId,
  writeEcomLastProjectId,
} from "@/lib/ecom-last-project";
import {
  posterDockTaskId,
  runPosterWithBackgroundTask,
} from "@/lib/poster/poster-background-task";
import {
  POSTER_ASPECT_OPTIONS,
  POSTER_ECOM_STYLE_OPTIONS,
} from "@/lib/ecom-poster-presets";
import type {
  PosterEasyPath,
  PosterFestivalPack,
  PosterProject,
  PosterRefRole,
} from "@/lib/ecom-poster-types";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import { fetchStoryboardModels } from "@/lib/ecom-storyboard-api";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

const EASY_CARDS: Array<{ path: PosterEasyPath; title: string; desc: string }> = [
  { path: "A", title: "模特+服装+场景", desc: "上传三张参考 + 节日，一键策划出图" },
  { path: "B", title: "只有服装", desc: "仅服装图，系统自动匹配模特与场景" },
  { path: "C", title: "一句话文生", desc: "填活动需求，快速出营销海报" },
  { path: "D", title: "节日+VI创意", desc: "选节日并导入品牌/VI 参考" },
];

const REF_SLOTS: Array<{ role: PosterRefRole; label: string }> = [
  { role: "model", label: "模特" },
  { role: "garment", label: "服装" },
  { role: "scene", label: "场景" },
  { role: "style", label: "风格/构图" },
  { role: "brand", label: "品牌/VI" },
];

function aspectClass(ratio: string): string {
  if (ratio === "9:16") return "aspect-[9/16]";
  if (ratio === "16:9") return "aspect-video";
  if (ratio === "1:1") return "aspect-square";
  return "aspect-[3/4]";
}

const POSTER_PROJECT_STORAGE_KEY = "ecom-poster-active-project";

function readOneLineBriefFromProject(project: PosterProject): string {
  const fromBrief =
    project.brief && typeof project.brief.oneLineBrief === "string"
      ? project.brief.oneLineBrief
      : "";
  if (fromBrief.trim()) return fromBrief.trim();
  if (project.plan.easyPath === "C" && project.plan.autoPlan?.slotCopy?.trim()) {
    return project.plan.autoPlan.slotCopy.trim();
  }
  return "";
}

async function resolveInitialPosterProject(initialProjectId?: string): Promise<PosterProject> {
  if (initialProjectId?.trim()) {
    return getPosterProject(initialProjectId.trim());
  }
  const savedId = readEcomLastProjectId(POSTER_PROJECT_STORAGE_KEY);
  if (savedId) {
    try {
      return await getPosterProject(savedId);
    } catch {
      clearEcomLastProjectId(POSTER_PROJECT_STORAGE_KEY);
    }
  }
  const items = await listPosterProjects();
  if (items[0]) return items[0];
  return createPosterProject({ title: "营销海报" });
}

export function PosterStudio({ initialProjectId }: { initialProjectId?: string }) {
  const { alert, toast } = useDialogs();
  const backgroundGen = useBackgroundGenerationOptional();
  const [project, setProject] = useState<PosterProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [festivals, setFestivals] = useState<PosterFestivalPack[]>([]);
  const [tab, setTab] = useState<"easy" | "pro">("easy");
  const [easyPath, setEasyPath] = useState<PosterEasyPath>("C");
  const [oneLineBrief, setOneLineBrief] = useState("");
  const [batchLines, setBatchLines] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<PosterRefRole>("brand");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutArtifactIndex, setLayoutArtifactIndex] = useState(0);
  const [proImagePrompt, setProImagePrompt] = useState("");
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModelKey, setImageModelKey] = useState("doubao-seedream-5-0-lite");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const hydrateUiFromProject = useCallback((p: PosterProject) => {
    setTab(p.plan.tier === "pro" ? "pro" : "easy");
    setEasyPath(p.plan.easyPath ?? "C");
    setOneLineBrief(readOneLineBriefFromProject(p));
    setProImagePrompt(p.plan.autoPlan?.imagePrompt ?? "");
    const mk =
      p.plan.modelKey?.trim() ||
      p.settings.imageModelKey?.trim() ||
      "doubao-seedream-5-0-lite";
    setImageModelKey(mk);
  }, []);

  const applyProject = useCallback(
    (p: PosterProject) => {
      setProject(p);
      writeEcomLastProjectId(POSTER_PROJECT_STORAGE_KEY, p.id);
      hydrateUiFromProject(p);
    },
    [hydrateUiFromProject],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, f] = await Promise.all([
          resolveInitialPosterProject(initialProjectId),
          fetchPosterFestivals(),
        ]);
        if (cancelled) return;
        applyProject(p);
        setFestivals(f);
      } catch (e) {
        if (!cancelled) {
          if (!isEcomUnauthorizedError(e)) {
            await alert({
              title: "加载失败",
              message: e instanceof Error ? e.message : "请稍后重试",
              variant: "error",
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialProjectId, applyProject, alert]);

  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    const p = projectRef.current;
    if (!p || loading) return;
    const prev =
      p.brief && typeof p.brief.oneLineBrief === "string" ? p.brief.oneLineBrief : "";
    if (prev === oneLineBrief) return;
    const timer = window.setTimeout(() => {
      const current = projectRef.current;
      if (!current) return;
      void patchPosterProject(current.id, {
        brief: { ...(current.brief ?? {}), oneLineBrief },
      }).then((updated) => {
        setProject(updated);
        writeEcomLastProjectId(POSTER_PROJECT_STORAGE_KEY, updated.id);
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [oneLineBrief, project?.id, loading]);

  const loadImageModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsLoadError(null);
    try {
      const payload = await fetchStoryboardModels();
      const models = payload.imageModels ?? [];
      setImageModels(models);
      setImageModelKey((prev) => pickBoundStoryboardModelKey(models, prev));
    } catch (e) {
      setModelsLoadError(e instanceof Error ? e.message : "模型列表加载失败");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImageModels();
  }, [loadImageModels]);

  const activeArtifact = useMemo((): EcomCopyImageArtifact | null => {
    if (!project?.plan.artifacts.length) return null;
    const idx = project.plan.activeArtifactIndex ?? project.plan.artifacts.length - 1;
    return project.plan.artifacts[idx] ?? null;
  }, [project]);

  const patchPlan = useCallback(
    async (partial: Partial<PosterProject["plan"]>) => {
      if (!project) return;
      const plan = { ...project.plan, ...partial };
      const updated = await patchPosterProject(project.id, { plan });
      applyProject(updated);
      return updated;
    },
    [project, applyProject],
  );

  const runEasyFlow = async () => {
    if (!project) return;
    setBusy(true);
    const count = project.settings.imageCount ?? 2;
    try {
      await runPosterWithBackgroundTask(
        backgroundGen,
        {
          taskId: posterDockTaskId(project.id, "generate"),
          label: "营销海报 · 傻瓜出图",
          expectedDurationMs: count * 120_000,
        },
        async () => {
          let p = await posterAutoPlan(project.id, {
            easyPath,
            festivalId: project.plan.festivalId,
            oneLineBrief: oneLineBrief.trim() || undefined,
          });
          applyProject(p);
          const gen = await posterGenerate(p.id, count);
          applyProject(gen.project);
        },
      );
      toast({ variant: "success", title: "海报底图已生成", message: "可点「排版与出图」合成文案" });
    } catch (e) {
      await alert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const runProGenerate = async () => {
    if (!project) return;
    const proMode = project.plan.proMode ?? "text";
    if (proMode === "template" && !project.plan.templateCatalogId?.trim()) {
      await alert({
        title: "请选择模板",
        message: "模板重构需从下方模板库点选一条",
        variant: "error",
      });
      return;
    }
    if (proMode === "image-ref") {
      const hasStyle = project.references.some((r) =>
        ["style", "scene", "brand"].includes(r.role),
      );
      if (!hasStyle) {
        await alert({
          title: "缺少参考图",
          message: "图生模式请上传场景或风格/构图参考",
          variant: "error",
        });
        return;
      }
    }
    setBusy(true);
    const count = project.settings.imageCount ?? 2;
    try {
      await runPosterWithBackgroundTask(
        backgroundGen,
        {
          taskId: posterDockTaskId(project.id, "generate"),
          label: "营销海报 · 专业创作",
          expectedDurationMs: count * 120_000,
          hint: imageModelKey,
        },
        async () => {
          const autoPlan = {
            summary: project.plan.autoPlan?.summary ?? "专业模式",
            slotCopy: project.plan.autoPlan?.slotCopy ?? "限时特惠",
            slotCopyAi: project.plan.autoPlan?.slotCopyAi,
            imagePrompt: proImagePrompt.trim() || project.plan.autoPlan?.imagePrompt || "",
            festivalId: project.plan.festivalId,
          };
          await patchPosterProject(project.id, {
            plan: {
              ...project.plan,
              tier: "pro",
              proMode,
              modelKey: imageModelKey,
              autoPlan,
            },
            settings: { ...project.settings, imageModelKey, imageCount: count },
          });
          const gen = await posterGenerate(project.id, count);
          applyProject(gen.project);
        },
      );
      toast({ variant: "success", title: "已生成候选海报" });
    } catch (e) {
      await alert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const runBatch = async () => {
    if (!project) return;
    const lines = batchLines.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      await alert({ title: "请填写批量文案", message: "每行一组标题/卖点", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const result = await runPosterWithBackgroundTask(
        backgroundGen,
        {
          taskId: posterDockTaskId(project.id, "batch"),
          label: `营销海报 · 批量 ${lines.length} 张`,
          expectedDurationMs: lines.length * 120_000,
        },
        () => posterBatchGenerate(project.id, lines),
      );
      applyProject(result.project);
      toast({ variant: "success", title: `批量完成 ${result.count} 张底图` });
    } catch (e) {
      await alert({
        title: "批量失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const openLayout = (index: number) => {
    setLayoutArtifactIndex(index);
    setLayoutOpen(true);
  };

  if (loading || !project) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#6e6e73]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        加载海报项目…
      </div>
    );
  }

  const layoutArtifact = project.plan.artifacts[layoutArtifactIndex] ?? activeArtifact;
  const showRefSlots =
    tab === "pro" ||
    easyPath === "A" ||
    easyPath === "B" ||
    easyPath === "D" ||
    project.references.length > 0;

  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="ecom-scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <header className="mb-6 w-full max-w-none">
        <h1 className="text-xl font-semibold text-[#1d1d1f]">海报制作</h1>
        <p className="mt-1 text-sm text-[#6e6e73]">
          四步出图：选路径 → 活动与尺寸 → 生成无字底图 → 排版加字
        </p>
        <div className="mt-4 inline-flex rounded-xl border border-[#e8e8ed] bg-[#f5f5f7] p-1">
          <button
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === "easy" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73]",
            )}
            onClick={() => void patchPlan({ tier: "easy" }).then(() => setTab("easy"))}
          >
            傻瓜出图
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === "pro" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73]",
            )}
            onClick={() => void patchPlan({ tier: "pro" }).then(() => setTab("pro"))}
          >
            专业创作
          </button>
        </div>
      </header>

      <div className="grid w-full max-w-none gap-6 pb-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
        <PosterStepSection
          step={1}
          title={tab === "easy" ? "选择傻瓜路径" : "选择专业引擎"}
          description={
            tab === "easy"
              ? "A/B 需上传参考；C 只需一句话；D 偏品牌节日创意。"
              : "文生 / 图生 / 模板重构，可自选 Gateway 生图模型。"
          }
        >
          {tab === "easy" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {EASY_CARDS.map((c) => (
                <button
                  key={c.path}
                  type="button"
                  className={cn(
                    "rounded-xl border p-3 text-left text-sm transition",
                    easyPath === c.path
                      ? "border-[#0071e3] bg-[#f0f6ff] ring-1 ring-[#0071e3]/30"
                      : "border-[#e8e8ed] hover:border-[#d2d2d7]",
                  )}
                  onClick={() => {
                    setEasyPath(c.path);
                    void patchPlan({ easyPath: c.path });
                  }}
                >
                  <p className="font-medium text-[#1d1d1f]">
                    {c.path} · {c.title}
                  </p>
                  <p className="mt-1 text-xs text-[#6e6e73]">{c.desc}</p>
                </button>
              ))}
            </div>
          ) : (
            <>
              <label className="block text-sm">
                专业模式
                <select
                  className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
                  value={project.plan.proMode ?? "text"}
                  onChange={(e) =>
                    void patchPlan({
                      proMode: e.target.value as "text" | "image-ref" | "template",
                    })
                  }
                >
                  <option value="text">文生营销海报</option>
                  <option value="image-ref">图生海报</option>
                  <option value="template">模板重构</option>
                </select>
              </label>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#e8e8ed] px-3 py-2 text-sm">
                <span className="text-[#6e6e73]">生图模型</span>
                <EcomButtonSecondary
                  type="button"
                  size="sm"
                  disabled={modelsLoading || busy}
                  onClick={() => setModelPickerOpen(true)}
                >
                  {modelsLoading ? "加载…" : imageModelKey}
                </EcomButtonSecondary>
              </div>
              {modelsLoadError ? (
                <p className="text-xs text-red-600">{modelsLoadError}</p>
              ) : null}
              <label className="block text-sm">
                画面描述 / 无字摄影 prompt
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
                  value={proImagePrompt}
                  onChange={(e) => setProImagePrompt(e.target.value)}
                  placeholder="专业文生/图生：描述营销海报摄影画面（不含文字）"
                />
              </label>
              {project.plan.proMode === "template" ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-[#1d1d1f]">选择电商模板（catalog）</p>
                  <PosterTemplatePicker
                    selectedId={project.plan.templateCatalogId}
                    onSelect={(entry) =>
                      void patchPlan({ templateCatalogId: entry.id }).then(() => {
                        if (entry.promptText?.trim()) {
                          setProImagePrompt(entry.promptText.trim());
                        }
                      })
                    }
                  />
                </div>
              ) : null}
            </>
          )}
        </PosterStepSection>

        <PosterStepSection
          step={2}
          title="节日、尺寸与文案策略"
          description="默认无字底图 + 程序排版；需要时可勾选字图同出。"
        >
          <div className="space-y-4">
            <label className="block text-sm font-medium text-[#1d1d1f]">
              节日 / 活动
              <select
                className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
                value={project.plan.festivalId ?? ""}
                onChange={(e) => void patchPlan({ festivalId: e.target.value || undefined })}
              >
                <option value="">默认上新</option>
                {festivals.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
              <label className="flex items-center gap-2 text-sm text-[#1d1d1f]">
                <input
                  type="checkbox"
                  checked={project.plan.useBrandRefs}
                  onChange={(e) => void patchPlan({ useBrandRefs: e.target.checked })}
                />
                使用品牌参考
              </label>
              <label className="flex items-center gap-2 text-sm text-[#1d1d1f]">
                <input
                  type="checkbox"
                  checked={project.plan.burnCopyInImage}
                  onChange={(e) => void patchPlan({ burnCopyInImage: e.target.checked })}
                />
                字图一起生成
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                风格
                <select
                  className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-2 py-2 text-sm"
                  value={project.plan.posterStyleId}
                  onChange={(e) => void patchPlan({ posterStyleId: e.target.value })}
                >
                  {POSTER_ECOM_STYLE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                尺寸
                <select
                  className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-2 py-2 text-sm"
                  value={project.plan.aspectRatio}
                  onChange={(e) => void patchPlan({ aspectRatio: e.target.value })}
                >
                  {POSTER_ASPECT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {tab === "easy" && easyPath === "C" ? (
              <label className="block text-sm">
                活动一句话
                <input
                  className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
                  value={oneLineBrief}
                  onChange={(e) => setOneLineBrief(e.target.value)}
                  placeholder="例：冬款羽绒服限时 5 折"
                />
              </label>
            ) : null}
          </div>
        </PosterStepSection>

        {showRefSlots ? (
          <PosterStepSection
            step={3}
            title="参考素材"
            description={
              easyPath === "C" && tab === "easy"
                ? "路径 C 可不传图；若槽位有旧图，生成时不会当作垫图。"
                : "按路径上传模特 / 服装 / 场景或从资产库导入。"
            }
          >
            <div className="space-y-3">
              {REF_SLOTS.map(({ role, label }) => {
                const refs = project.references.filter((r) => r.role === role);
                const required =
                  (easyPath === "A" && (role === "garment" || role === "model")) ||
                  (easyPath === "B" && role === "garment") ||
                  (easyPath === "D" && role === "brand" && project.plan.useBrandRefs);
                return (
                  <div
                    key={role}
                    className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-[#1d1d1f]">
                        {label}
                        {required ? (
                          <span className="ml-1 text-[#0071e3]">建议上传</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className="text-[#0071e3]"
                        onClick={() => {
                          setPickerRole(role);
                          setPickerOpen(true);
                        }}
                      >
                        资产库
                      </button>
                    </div>
                    <EcomRefUploadCard
                      title={label}
                      items={refs.map((r) => ({
                        id: r.id,
                        ossUrl: r.ossUrl,
                        label: r.label ?? label,
                      }))}
                      hideTitle
                      multiple={false}
                      onUploadFiles={async (files) => {
                        const file = files[0];
                        if (!file) return;
                      const { project: p } = await uploadPosterRef(project.id, file, role);
                      applyProject(p);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </PosterStepSection>
        ) : null}

        <PosterStepSection
          step={showRefSlots ? 4 : 3}
          title="生成无字底图"
          description={
            tab === "easy"
              ? "系统先策划 prompt 与卖点，再调用 Seedream 等模型出图。"
              : "使用上方专业 prompt 与模型直接出图。"
          }
        >
          <div className="space-y-3">
            {tab === "easy" ? (
              <EcomButtonPrimary
                type="button"
                disabled={busy}
                className="w-full py-3 text-base"
                onClick={() => void runEasyFlow()}
              >
                {busy ? "生成中…" : "一键策划并出图"}
              </EcomButtonPrimary>
            ) : (
              <EcomButtonPrimary
                type="button"
                disabled={busy}
                className="w-full py-3 text-base"
                onClick={() => void runProGenerate()}
              >
                {busy ? "生成中…" : "专业模式出图"}
              </EcomButtonPrimary>
            )}
            {tab === "easy" ? (
              <p className="text-center text-[11px] text-[#86868b]">
                默认模型 Seedream 5 Lite（火山方舟）
              </p>
            ) : null}
            {project.plan.autoPlan?.summary ? (
              <p className="rounded-lg bg-[#f5f5f7] px-3 py-2 text-xs text-[#6e6e73]">
                策划摘要：{project.plan.autoPlan.summary}
              </p>
            ) : null}
            <details className="rounded-lg border border-[#e8e8ed] px-3 py-2 text-sm">
              <summary className="cursor-pointer text-[#6e6e73]">批量出图（高级）</summary>
              <div className="mt-3 space-y-2">
                <textarea
                  className="min-h-[80px] w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
                  value={batchLines}
                  onChange={(e) => setBatchLines(e.target.value)}
                  placeholder="每行一条文案"
                />
                <EcomButtonSecondary type="button" disabled={busy} onClick={() => void runBatch()}>
                  批量出无字底图
                </EcomButtonSecondary>
              </div>
            </details>
          </div>
        </PosterStepSection>
        </div>

        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <PosterStepSection
            step={showRefSlots ? 5 : 4}
            title="生成预览 · 排版与成图"
            description="左侧点出图后，在此看生成进度与候选底图；再点「排版与出图」加字。"
            className="relative max-w-none min-h-[min(70vh,28rem)] overflow-hidden"
          >
            {busy ? (
              <EcomMediaGeneratingBusy
                className="absolute inset-0 z-10 rounded-2xl"
                background="light"
                label="海报生成中…"
              />
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {project.plan.artifacts.length > 0 ? (
                <EcomButtonSecondary
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void downloadPosterProjectZip(project.id).catch((e) =>
                      alert({
                        title: "打包下载失败",
                        message: e instanceof Error ? e.message : "请稍后重试",
                        variant: "error",
                      }),
                    )
                  }
                >
                  打包下载 ZIP
                </EcomButtonSecondary>
              ) : null}
            </div>
            {project.plan.artifacts.length === 0 && !busy ? (
              <div
                className={cn(
                  "mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d2d2d7] bg-[#fafafa] px-4 py-10 text-center",
                  aspectClass(project.plan.aspectRatio),
                  "max-h-[min(60vh,24rem)] w-full max-w-md",
                )}
              >
                <p className="text-sm text-[#6e6e73]">
                  在左侧点「一键策划并出图」后，无字底图与进度会显示在本区域。
                </p>
              </div>
            ) : project.plan.artifacts.length === 0 && busy ? (
              <div
                className={cn(
                  "mt-4 w-full max-w-md rounded-xl bg-[#f5f5f7]",
                  aspectClass(project.plan.aspectRatio),
                  "max-h-[min(60vh,24rem)]",
                )}
                aria-hidden
              />
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {project.plan.artifacts.map((art, i) => {
                  const preview = art.image.finalImageUrl ?? art.image.baseImageUrl;
                  return (
                    <div
                      key={`${i}-${art.image.baseImageUrl ?? i}`}
                      className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-[#fafafa] shadow-sm"
                    >
                      {preview ? (
                        <img
                          src={preview}
                          alt=""
                          className={cn("w-full object-cover", aspectClass(project.plan.aspectRatio))}
                        />
                      ) : (
                        <div className={cn("bg-[#f5f5f7]", aspectClass(project.plan.aspectRatio))} />
                      )}
                      <div className="flex flex-wrap gap-2 border-t border-[#e8e8ed] bg-white p-3">
                        <EcomButtonPrimary type="button" size="sm" onClick={() => openLayout(i)}>
                          排版与出图
                        </EcomButtonPrimary>
                        {art.image.finalImageUrl ? (
                          <EcomButtonSecondary
                            type="button"
                            size="sm"
                            onClick={() =>
                              void downloadMediaUrl(
                                art.image.finalImageUrl!,
                                mediaDownloadFilename("poster", "png"),
                              )
                            }
                          >
                            下载
                          </EcomButtonSecondary>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PosterStepSection>
        </div>
      </div>

      <EcomAssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        maxSelect={3}
        defaultModule={pickerRole === "brand" ? "vi" : "main-image"}
        onConfirm={async (assets) => {
          const references = [
            ...project.references,
            ...assets.map((a) => ({
              id: a.id,
              role: pickerRole,
              ossUrl: a.ossUrl,
              assetId: a.id,
              label: a.title,
            })),
          ];
          const updated = await patchPosterProject(project.id, { references });
          applyProject(updated);
        }}
      />

      {layoutArtifact ? (
        <EcomCopyLayoutStudioDialog
          open={layoutOpen}
          onOpenChange={setLayoutOpen}
          title="营销海报"
          baseImageUrl={layoutArtifact.image.baseImageUrl ?? null}
          imagePrompt={layoutArtifact.image.imagePrompt}
          slotCopy={layoutArtifact.copy.slotCopy}
          slotCopyAi={layoutArtifact.copy.slotCopyAi}
          copyOverlay={layoutArtifact.layout}
          exportWidthPx={layoutArtifact.render.exportWidthPx}
          aspectClassName={aspectClass(project.plan.aspectRatio)}
          composing={busy}
          onSave={async (prompt, extras) => {
            const artifacts = [...project.plan.artifacts];
            const cur = artifacts[layoutArtifactIndex];
            if (!cur) return;
            artifacts[layoutArtifactIndex] = {
              ...cur,
              copy: { ...cur.copy, slotCopy: extras.slotCopy ?? cur.copy.slotCopy },
              image: { ...cur.image, imagePrompt: prompt },
              layout: extras.copyOverlay ?? cur.layout,
            };
            const updated = await patchPosterProject(project.id, {
              plan: { ...project.plan, artifacts },
            });
            applyProject(updated);
            setLayoutOpen(false);
            toast({ variant: "success", title: "已保存文案与排版" });
          }}
          onPreview={async (prompt, extras) => {
            try {
              const baseUrl = layoutArtifact.image.baseImageUrl?.trim();
              if (!baseUrl || !extras.copyOverlay) {
                await alert({
                  title: "无法预览",
                  message: "请先出无字底图并填写文案",
                  variant: "error",
                });
                return;
              }
              const multiBlock =
                (extras.copyOverlay.layers.length ?? 0) > 1 ||
                extras.copyOverlay.layers.some((l) => l.id !== "main" && l.text.trim());
              const { url } = await composeEcomCopyOverlay({
                baseImageUrl: baseUrl,
                overlay: extras.copyOverlay,
                exportWidthPx: layoutArtifact.render.exportWidthPx,
                ...(multiBlock ? {} : { syncText: extras.slotCopy }),
              });
              return { previewUrl: url };
            } catch (e) {
              await alert({
                title: "预览失败",
                message: e instanceof Error ? e.message : "请稍后重试",
                variant: "error",
              });
            }
          }}
          onConfirmCompose={async (prompt, extras) => {
            setBusy(true);
            try {
              await runPosterWithBackgroundTask(
                backgroundGen,
                {
                  taskId: posterDockTaskId(project.id, "compose"),
                  label: "营销海报 · 排版合成",
                  expectedDurationMs: 90_000,
                },
                async () => {
                  const artifacts = [...project.plan.artifacts];
                  const cur = artifacts[layoutArtifactIndex];
                  if (!cur) return;
                  const draft = {
                    ...cur,
                    copy: { ...cur.copy, slotCopy: extras.slotCopy ?? cur.copy.slotCopy },
                    image: { ...cur.image, imagePrompt: prompt },
                    layout: extras.copyOverlay ?? cur.layout,
                  };
                  const multiBlock =
                    (extras.copyOverlay?.layers.length ?? 0) > 1 ||
                    extras.copyOverlay?.layers.some(
                      (l) => l.id !== "main" && l.text.trim(),
                    );
                  const result = await posterCompose(project.id, {
                    artifactIndex: layoutArtifactIndex,
                    artifact: draft,
                    ...(multiBlock ? {} : { slotCopy: extras.slotCopy }),
                  });
                  applyProject(result.project);
                  setLayoutOpen(false);
                },
              );
              toast({ variant: "success", title: "已合成并保存" });
            } catch (e) {
              await alert({
                title: "保存失败",
                message: e instanceof Error ? e.message : "请稍后重试",
                variant: "error",
              });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      <StoryboardModelPickerDialog
        open={modelPickerOpen}
        onOpenChange={setModelPickerOpen}
        mode="image"
        selectionOnly
        dialogTitle="选择海报生图模型"
        dialogDescription="列表来自 Gateway 登记；参数可调项以卡片脚注为准。"
        models={imageModels}
        modelsLoading={modelsLoading}
        modelsEmptyHint={modelsLoadError ?? undefined}
        onRetryLoadModels={() => void loadImageModels()}
        value={imageModelKey}
        onChange={setImageModelKey}
        onConfirm={(modelKey) => {
          setImageModelKey(modelKey);
          setModelPickerOpen(false);
        }}
      />

      <p className="mt-6 text-xs text-[#86868b]">
        图片处理里的「AI海报生成器」已
        <Link href="/brand/poster" className="text-[#0071e3]">
          收敛至本页
        </Link>
        。
      </p>
      </div>
    </EcomWorkspaceLayout>
  );
}
