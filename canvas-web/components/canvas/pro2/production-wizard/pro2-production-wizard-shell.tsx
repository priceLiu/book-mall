"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clapperboard, Film, X } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { resumeWizardAssetGenerate } from "@/lib/canvas/pro2-wizard-asset-generate-queue";
import { wizardAssetDraftsShallowEqual } from "@/lib/canvas/pro2-wizard-asset-draft-patch";
import { remountAllWizardAssetDraftsToHub } from "@/lib/canvas/pro2-wizard-asset-mount";
import { recoverWizardAssetDraftsFromTasks } from "@/lib/canvas/pro2-wizard-asset-recover";
import {
  isWizardShotGenerateActive,
  resumeWizardShotGenerate,
} from "@/lib/canvas/pro2-wizard-shot-generate-queue";
import { wizardShotDraftsShallowEqual } from "@/lib/canvas/pro2-wizard-shot-draft-patch";
import { remountAllWizardShotDraftsToHub } from "@/lib/canvas/pro2-wizard-shot-mount";
import { recoverWizardShotDraftsFromTasks } from "@/lib/canvas/pro2-wizard-shot-recover";
import type { WizardShotInflightResumeTarget } from "@/lib/canvas/pro2-wizard-shot-recover";
import { mountProductionScaffoldToCanvasFromStore, syncProductionScaffoldDataToHubFromStore } from "@/lib/canvas/hydrate-production-scaffold";
import { applyProductionScriptDirectToHub } from "@/lib/canvas/pro2-production-script-apply";
import { reconcileProductionScriptEntityLinks } from "@/lib/canvas/pro2-shot-entity-reconcile";
import { isPro2ProductionWizardHub } from "@/lib/canvas/pro2-production-wizard";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  appendWizardAsset,
  parseWizardAssetDraftKey,
  patchProductionScriptShot,
  WIZARD_ASSET_KIND_LABEL,
  wizardAssetDraftKey,
  type Pro2ProductionScriptShot,
  type Pro2WizardAssetKind,
} from "@/lib/canvas/pro2-production-wizard-assets";
import { wizardShotDraftKey } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import { cn } from "@/lib/utils";
import { Pro2ProductionWizardAssetCard } from "./pro2-production-wizard-asset-card";
import { Pro2ProductionWizardAssetProgressPanel } from "./pro2-production-wizard-asset-progress-panel";
import { Pro2ProductionWizardAddAssetCard } from "./pro2-production-wizard-add-asset-card";
import { Pro2ProductionWizardStoryboardTable } from "./pro2-production-wizard-storyboard-table";
import { Pro2ProductionWizardShotStep } from "./pro2-production-wizard-shot-step";

export type Pro2ProductionWizardShellProps = {
  open: boolean;
  onClose: () => void;
  scriptHubId: string;
  hubData: StoryProScriptHubNodeData;
};

type WizardStep = 1 | 2 | 3;

function findProductionWizardHub(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  preferredId?: string,
) {
  if (preferredId) {
    const hit = nodes.find((n) => n.id === preferredId);
    if (hit?.type === "story-pro2-script-hub") return hit;
  }
  return nodes.find((n) => n.type === "story-pro2-script-hub");
}

export function Pro2ProductionWizardShell({
  open,
  onClose,
  scriptHubId,
  hubData: hubDataProp,
}: Pro2ProductionWizardShellProps) {
  const mounted = useClientPortalMounted();
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId) ?? "";
  const { prompt } = useDialogs();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [step, setStep] = useState<WizardStep>(1);

  const hubId = useCanvasStore(
    (s) => findProductionWizardHub(s.nodes, scriptHubId)?.id,
  );
  const script = useCanvasStore((s) => {
    const hub = findProductionWizardHub(s.nodes, scriptHubId);
    const data =
      (hub?.data as StoryProScriptHubNodeData | undefined) ?? hubDataProp;
    return data.productionScript;
  });
  const assetDrafts = useCanvasStore(
    (s) => {
      const hub = findProductionWizardHub(s.nodes, scriptHubId);
      const data =
        (hub?.data as StoryProScriptHubNodeData | undefined) ?? hubDataProp;
      return data.productionWizardAssetDrafts ?? {};
    },
    wizardAssetDraftsShallowEqual,
  );
  const shotDrafts = useCanvasStore(
    (s) => {
      const hub = findProductionWizardHub(s.nodes, scriptHubId);
      const data =
        (hub?.data as StoryProScriptHubNodeData | undefined) ?? hubDataProp;
      return data.productionWizardShotDrafts ?? {};
    },
    wizardShotDraftsShallowEqual,
  );
  const outlineMd = useCanvasStore((s) => {
    const hub = findProductionWizardHub(s.nodes, scriptHubId);
    const data =
      (hub?.data as StoryProScriptHubNodeData | undefined) ?? hubDataProp;
    return data.outlineMd;
  });
  const wizardActive = useCanvasStore((s) => {
    const hub = findProductionWizardHub(s.nodes, scriptHubId);
    const data =
      (hub?.data as StoryProScriptHubNodeData | undefined) ?? hubDataProp;
    return isPro2ProductionWizardHub(data);
  });

  const hubData = useMemo(
    () =>
      ({
        productionScript: script,
        productionWizardAssetDrafts: assetDrafts,
        outlineMd,
      }) as StoryProScriptHubNodeData,
    [assetDrafts, outlineMd, script],
  );
  const resumedTasksRef = useRef(new Set<string>());

  const resumeWizardShotInflightJobs = useCallback(
    (
      inflight: WizardShotInflightResumeTarget[],
      shotDraftsMap: Record<string, import("@/lib/canvas/pro2-production-wizard-shot-drafts").Pro2ProductionWizardShotDraft>,
    ) => {
      if (!base?.trim() || !projectId.trim() || !script) return;
      for (const { mediaKind, shotIndex, taskId } of inflight) {
        if (isWizardShotGenerateActive(mediaKind, shotIndex)) continue;
        const key = wizardShotDraftKey(mediaKind, shotIndex);
        const draft = shotDraftsMap[key];
        const resumeKey = `shot:${key}:${taskId}`;
        if (resumedTasksRef.current.has(resumeKey)) continue;
        resumedTasksRef.current.add(resumeKey);
        const frameDraft = shotDraftsMap[wizardShotDraftKey("frame", shotIndex)];
        resumeWizardShotGenerate({
          scriptHubId,
          mediaKind,
          shotIndex,
          base,
          projectId,
          prompt: draft?.prompt ?? "",
          refImages: draft?.refImages ?? [],
          script,
          dialogue: script.shots?.find((s) => s.index === shotIndex)?.dialogue,
          framePreviewUrl: frameDraft?.previewUrl,
          frameSettings:
            mediaKind === "frame"
              ? {
                  engine: {
                    providerId: draft?.providerId ?? "",
                    modelKey: draft?.modelKey ?? "",
                    params: draft?.params ?? {},
                  },
                  aspectRatio: "16:9",
                  imageQuality: "standard",
                  resolution: "2K",
                  outputCount: 1,
                }
              : undefined,
          videoEngine:
            mediaKind === "video"
              ? {
                  providerId: draft?.providerId ?? "",
                  modelKey: draft?.modelKey ?? "",
                  params: draft?.params ?? {},
                }
              : undefined,
          taskId,
        });
      }
    },
    [base, projectId, script, scriptHubId],
  );

  const recoverAndResumeWizardJobs = useCallback(async () => {
    if (!base?.trim() || !projectId.trim()) return;
    await recoverWizardAssetDraftsFromTasks(scriptHubId, base, projectId);
    const { inflight } = await recoverWizardShotDraftsFromTasks(
      scriptHubId,
      base,
      projectId,
    );
    const hub = useCanvasStore
      .getState()
      .nodes.find((n) => n.id === scriptHubId);
    const data = (hub?.data ?? hubDataProp) as StoryProScriptHubNodeData;
    const assetDrafts = data.productionWizardAssetDrafts ?? {};
    const shotDraftsMap = data.productionWizardShotDrafts ?? {};

    if (script) {
      for (const [key, draft] of Object.entries(assetDrafts)) {
        if (draft.generateStatus !== "running" || !draft.taskId?.trim()) {
          continue;
        }
        const resumeKey = `${key}:${draft.taskId}`;
        if (resumedTasksRef.current.has(resumeKey)) continue;
        resumedTasksRef.current.add(resumeKey);
        const parsed = parseWizardAssetDraftKey(key);
        if (!parsed) continue;
        const { kind, assetId } = parsed;
        const label =
          kind === "character"
            ? script.characters?.find((c) => c.id === assetId)?.name
            : kind === "scene"
              ? script.scenes?.find((s) => s.id === assetId)?.name
              : script.props?.find((p) => p.id === assetId)?.name;
        if (!label?.trim()) continue;
        resumeWizardAssetGenerate({
          label,
          scriptHubId,
          kind,
          assetId,
          base,
          projectId,
          settings: {
            engine: {
              providerId: draft.providerId ?? "",
              modelKey: draft.modelKey ?? "",
              params: draft.params ?? {},
            },
            aspectRatio: "16:9",
            imageQuality: "standard",
            resolution: "2K",
            outputCount: 1,
          },
          prompt: draft.prompt ?? "",
          refImages: draft.refImages ?? [],
          script,
          taskId: draft.taskId,
        });
      }
    }

    resumeWizardShotInflightJobs(inflight, shotDraftsMap);
    remountAllWizardAssetDraftsToHub(scriptHubId);
    remountAllWizardShotDraftsToHub(scriptHubId);
  }, [
    base,
    hubDataProp,
    projectId,
    resumeWizardShotInflightJobs,
    script,
    scriptHubId,
  ]);

  useEffect(() => {
    if (!open) {
      resumedTasksRef.current.clear();
      return;
    }
    void recoverAndResumeWizardJobs();
  }, [open, recoverAndResumeWizardJobs]);

  useEffect(() => {
    if (!open) return;
    const hub = useCanvasStore
      .getState()
      .nodes.find((n) => n.id === scriptHubId);
    const data = (hub?.data ?? hubDataProp) as StoryProScriptHubNodeData;
    const current = data.productionScript;
    if (!current?.shots?.length) return;
    const reconciled = reconcileProductionScriptEntityLinks(current);
    if (reconciled === current) return;
    const hubPatch = applyProductionScriptDirectToHub(
      data,
      reconciled,
      scriptHubId,
    );
    updateNodeData(scriptHubId, hubPatch);
  }, [open, scriptHubId, hubDataProp, updateNodeData, script]);

  /** 向导打开期间定期从 /tasks 同步（与画布 run-queue 轮询同源数据） */
  useEffect(() => {
    if (!open || !base?.trim() || !projectId.trim()) return;
    const sync = () => void recoverAndResumeWizardJobs();
    const timer = window.setInterval(sync, 5000);
    return () => window.clearInterval(timer);
  }, [open, base, projectId, recoverAndResumeWizardJobs]);

  const persistShotUpdate = useCallback(
    (shotIndex: number, patch: Partial<Pro2ProductionScriptShot>) => {
      const hub = useCanvasStore
        .getState()
        .nodes.find((n) => n.id === scriptHubId);
      const data = (hub?.data ?? hubData) as StoryProScriptHubNodeData;
      const current = data.productionScript;
      if (!current?.shots?.length) return;
      const nextScript = patchProductionScriptShot(current, shotIndex, patch);
      const hubPatch = applyProductionScriptDirectToHub(
        data,
        nextScript,
        scriptHubId,
      );
      updateNodeData(scriptHubId, hubPatch);
      syncProductionScaffoldDataToHubFromStore(scriptHubId);
    },
    [hubData, scriptHubId, updateNodeData],
  );

  const addAsset = useCallback(
    async (kind: Pro2WizardAssetKind) => {
      const label = WIZARD_ASSET_KIND_LABEL[kind];
      const name = await prompt({
        title: `新增${label}`,
        label: `${label}名称`,
        defaultValue: `新${label}`,
        placeholder: `输入${label}名称`,
      });
      if (!name?.trim()) return;

      const hub = useCanvasStore
        .getState()
        .nodes.find((n) => n.id === scriptHubId);
      const data = (hub?.data ?? hubData) as StoryProScriptHubNodeData;
      const current = data.productionScript;
      if (!current) return;

      const nextScript = appendWizardAsset(current, kind, name.trim());
      const hubPatch = applyProductionScriptDirectToHub(
        data,
        nextScript,
        scriptHubId,
      );
      updateNodeData(scriptHubId, hubPatch);
    },
    [hubData, prompt, scriptHubId, updateNodeData],
  );

  const onMountToCanvas = useCallback(() => {
    if (hubId) {
      void (async () => {
        await recoverAndResumeWizardJobs();
        syncProductionScaffoldDataToHubFromStore(hubId);
        mountProductionScaffoldToCanvasFromStore(hubId);
        window.dispatchEvent(
          new CustomEvent("canvas:focus-node", {
            detail: { nodeId: hubId },
          }),
        );
        onClose();
      })();
      return;
    }
    onClose();
  }, [hubId, onClose, recoverAndResumeWizardJobs]);

  useModalBodyScrollLock(open && wizardActive);
  useModalEscapeClose(onClose, { active: open && wizardActive });

  if (!mounted || !open || !wizardActive) return null;

  const characters = script?.characters ?? [];
  const scenes = script?.scenes ?? [];
  const props = script?.props ?? [];
  const shots = script?.shots ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[1150] flex flex-col bg-[#0a0a0c] text-zinc-100"
      role="dialog"
      aria-modal="true"
      aria-label="剧本制作"
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <Clapperboard className="size-5 text-violet-400" />
          <div>
            <h1 className="text-base font-semibold">剧本制作</h1>
            <p className="text-xs text-zinc-400">
              Step {step} ·{" "}
              {step === 1
                ? "资产出图"
                : step === 2
                  ? "提示词创作"
                  : "分镜创作"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              step === 1
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:bg-white/5",
            )}
            onClick={() => setStep(1)}
          >
            1 资产
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              step === 2
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:bg-white/5",
            )}
            onClick={() => setStep(2)}
          >
            2 提示词
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              step === 3
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:bg-white/5",
            )}
            onClick={() => setStep(3)}
          >
            3 分镜
          </button>
          <button
            type="button"
            className="ml-4 rounded-lg border border-white/15 px-4 py-1.5 text-sm hover:bg-white/5"
            onClick={onMountToCanvas}
          >
            放入画布
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="关闭向导"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4">
        {!script?.shots?.length ? (
          <div className="mx-auto max-w-lg rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-400">
            <Film className="mx-auto mb-3 size-8 text-zinc-600" />
            <p>请先在脚本 Hub 生成分镜脚本（Pass 1 制作包），再进入资产与分镜向导。</p>
          </div>
        ) : step === 1 ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="mb-4 shrink-0 text-sm text-zinc-400">
              本阶段专注出图：角色 / 场景 / 道具。点「确认生成」后弹窗会关闭，进度在右下角；可继续编辑下一张资产卡。
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-8 pb-2">
            <AssetSection
              title="角色"
              count={characters.length}
              onAdd={() => void addAsset("character")}
            >
              {characters.map((c) => (
                <Pro2ProductionWizardAssetCard
                  key={c.id}
                  kind="character"
                  assetId={c.id}
                  name={c.name}
                  scriptHubId={scriptHubId}
                  subtitle={c.role}
                  script={script}
                  draft={assetDrafts[wizardAssetDraftKey("character", c.id)]}
                />
              ))}
            </AssetSection>
            <AssetSection
              title="场景"
              count={scenes.length}
              onAdd={() => void addAsset("scene")}
            >
              {scenes.map((s) => (
                <Pro2ProductionWizardAssetCard
                  key={s.id}
                  kind="scene"
                  assetId={s.id}
                  name={s.name}
                  scriptHubId={scriptHubId}
                  subtitle={s.environmentTimeMood}
                  script={script}
                  draft={assetDrafts[wizardAssetDraftKey("scene", s.id)]}
                />
              ))}
            </AssetSection>
            <AssetSection
              title="道具"
              count={props.length}
              onAdd={() => void addAsset("prop")}
            >
              {props.map((p) => (
                <Pro2ProductionWizardAssetCard
                  key={p.id}
                  kind="prop"
                  assetId={p.id}
                  name={p.name}
                  scriptHubId={scriptHubId}
                  subtitle={p.description ?? ""}
                  script={script}
                  draft={assetDrafts[wizardAssetDraftKey("prop", p.id)]}
                />
              ))}
            </AssetSection>
              </div>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="mb-3 shrink-0 text-sm text-zinc-400">
              分镜 {shots.length} 镜 · 编辑 Pass2 提示词与 AI 润色。本阶段不生成画布节点。
            </p>
            <Pro2ProductionWizardStoryboardTable
              className="min-h-0 flex-1"
              script={script!}
              scriptHubId={scriptHubId}
              hubData={hubData}
              outlineMd={hubData.outlineMd}
              onShotSave={persistShotUpdate}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="mb-3 shrink-0 text-sm text-zinc-400">
              逐镜生成分镜图与分镜视频。完成后点「放入画布」一次性挂载到画布。
            </p>
            <Pro2ProductionWizardShotStep
              script={script!}
              scriptHubId={scriptHubId}
              shotDrafts={shotDrafts}
            />
          </div>
        )}
      </main>
      <Pro2ProductionWizardAssetProgressPanel mounted={mounted} />
    </div>,
    document.body,
  );
}

function AssetSection({
  title,
  count,
  onAdd,
  children,
}: {
  title: string;
  count: number;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-zinc-300">
        {title}
        <span className="ml-2 text-zinc-500">({count})</span>
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
        {children}
        <Pro2ProductionWizardAddAssetCard onClick={onAdd} />
      </div>
    </section>
  );
}
