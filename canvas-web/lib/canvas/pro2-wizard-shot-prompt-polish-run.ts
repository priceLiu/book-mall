"use client";

import {
  listCanvasProjectTasks,
  runCanvasNode,
  type CanvasTaskRecord,
} from "@/lib/canvas-api";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import {
  buildShotPromptPolishBundle,
  extractShotPromptPolishFromText,
  shotPromptPolishQueueKey,
  type ShotPromptPolishMode,
} from "@/lib/canvas/pro2-shot-prompt-polish";
import {
  patchProductionScriptShot,
  type Pro2ProductionScriptShot,
} from "@/lib/canvas/pro2-production-wizard-assets";
import {
  applyProductionScriptDirectToHub,
} from "@/lib/canvas/pro2-production-script-apply";
import {
  isPro2ProductionScriptV2,
} from "@/lib/canvas/data/pro2-production-script-schema";
import { syncProductionScaffoldDataToHubFromStore } from "@/lib/canvas/hydrate-production-scaffold";
import {
  hydrateShotEntityMentionsForEdit,
  hydrateWizardPromptTextForShot,
  reconcileShotEntityLinks,
} from "@/lib/canvas/pro2-shot-entity-reconcile";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";

const TERMINAL = new Set<CanvasTaskRecord["status"]>([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

/** 同项目 + Hub + 镜号 + 模式 · 进程内防连点双提交 */
const WIZARD_SHOT_POLISH_INFLIGHT = new Set<string>();

function wizardShotPolishInflightKey(
  projectId: string,
  scriptHubId: string,
  shotIndex: number,
  mode: ShotPromptPolishMode,
): string {
  return `${projectId}:${scriptHubId}:${shotIndex}:${mode}`;
}

export type RunPro2WizardShotPromptPolishArgs = {
  base: string;
  projectId: string;
  scriptHubId: string;
  hubData: StoryProScriptHubNodeData;
  script: Pro2ProductionScript;
  shotIndex: number;
  draftShot: Pro2ProductionScriptShot;
  mode: ShotPromptPolishMode;
  outlineMd?: string;
  propDisplayText?: string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

export type RunPro2WizardShotPromptPolishResult =
  | { ok: true; frameImagePrompt?: string; videoPrompt?: string }
  | { ok: false; error: string };

/** 润色成功 · 写回 Hub productionScript + scriptStudioFrameRows（重开弹层 / 放入画布可读） */
export function persistWizardShotPromptsToHub(args: {
  scriptHubId: string;
  hubData: StoryProScriptHubNodeData;
  script: Pro2ProductionScript;
  shotIndex: number;
  frameImagePrompt?: string;
  videoPrompt?: string;
  propDisplayText?: string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): void {
  const hubNode = useCanvasStore.getState().nodes.find((n) => n.id === args.scriptHubId);
  const data = (hubNode?.data ?? args.hubData) as StoryProScriptHubNodeData;
  const current = data.productionScript ?? args.script;
  const existing = current.shots?.find((s) => s.index === args.shotIndex);
  if (!existing) return;

  const draft: Pro2ProductionScriptShot = {
    ...existing,
    ...(args.frameImagePrompt
      ? { frameImagePrompt: args.frameImagePrompt }
      : {}),
    ...(args.videoPrompt ? { videoPrompt: args.videoPrompt } : {}),
  };
  const { shot: hydrated } = hydrateShotEntityMentionsForEdit(draft, current, {
    propDisplayText: args.propDisplayText,
  });
  const patch: Partial<Pro2ProductionScriptShot> = {
    videoPrompt: hydrated.videoPrompt,
    characterIds: hydrated.characterIds,
    propIds: hydrated.propIds,
    sceneId: hydrated.sceneId,
  };
  if (isPro2ProductionScriptV2(current.schemaVersion)) {
    patch.frameImagePrompt = hydrated.frameImagePrompt;
  } else {
    patch.imagePrompt = hydrated.imagePrompt ?? hydrated.frameImagePrompt;
  }
  const nextScript = patchProductionScriptShot(current, args.shotIndex, patch);
  const hubPatch = applyProductionScriptDirectToHub(
    data,
    nextScript,
    args.scriptHubId,
  );
  args.updateNodeData(args.scriptHubId, hubPatch);
  syncProductionScaffoldDataToHubFromStore(args.scriptHubId);
}

async function pollTaskUntilDone(
  base: string,
  projectId: string,
  taskId: string,
  nodeId: string,
  timeoutMs = 180_000,
): Promise<CanvasTaskRecord> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tasks = await listCanvasProjectTasks(base, projectId, [nodeId]);
    const task = tasks?.find((t) => t.id === taskId);
    if (task && TERMINAL.has(task.status)) return task;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("润色超时，请稍后重试");
}

function mergeDraftIntoScript(
  script: Pro2ProductionScript,
  shotIndex: number,
  draftShot: Pro2ProductionScriptShot,
  propDisplayText?: string,
): Pro2ProductionScript {
  const reconciled = reconcileShotEntityLinks(draftShot, script, {
    propDisplayText,
  });
  return patchProductionScriptShot(script, shotIndex, reconciled);
}

function prevShotIndexFor(
  script: Pro2ProductionScript,
  shotIndex: number,
): number | undefined {
  const indices = (script.shots ?? [])
    .map((s) => s.index)
    .filter((n) => n > 0 && n < shotIndex)
    .sort((a, b) => a - b);
  return indices.length ? indices[indices.length - 1] : undefined;
}

/** 向导分镜编辑 · 单镜 AI 润色（走 Hub Pass2 LLM） */
export async function runPro2WizardShotPromptPolish(
  args: RunPro2WizardShotPromptPolishArgs,
): Promise<RunPro2WizardShotPromptPolishResult> {
  const {
    base,
    projectId,
    scriptHubId,
    hubData,
    script,
    shotIndex,
    draftShot,
    mode,
    outlineMd,
    propDisplayText,
    updateNodeData,
  } = args;

  if (!base?.trim() || !projectId?.trim()) {
    return { ok: false, error: "未连接主站，无法润色" };
  }

  const inflightKey = wizardShotPolishInflightKey(
    projectId,
    scriptHubId,
    shotIndex,
    mode,
  );
  if (WIZARD_SHOT_POLISH_INFLIGHT.has(inflightKey)) {
    return { ok: false, error: "本镜正在润色中，请稍候" };
  }
  WIZARD_SHOT_POLISH_INFLIGHT.add(inflightKey);

  try {
    const scriptForBundle = mergeDraftIntoScript(
      script,
      shotIndex,
      draftShot,
      propDisplayText,
    );
    const prev = prevShotIndexFor(scriptForBundle, shotIndex);
    const bundle = buildShotPromptPolishBundle(shotIndex, scriptForBundle, {
      prevShotIndex: prev,
      mode,
      outlineMd,
    });
    if (!bundle) {
      return { ok: false, error: "找不到该分镜" };
    }

    const hubNode = useCanvasStore.getState().nodes.find((n) => n.id === scriptHubId);
    if (!hubNode) {
      return { ok: false, error: "脚本 Hub 节点不存在" };
    }

    const rowKey = String(shotIndex);
    const queueKey = shotPromptPolishQueueKey(rowKey, mode);
    const queueBase = { ...(hubData.shotPromptPolishQueue ?? {}) };
    const nextQueue = { ...queueBase, [queueKey]: bundle.userPrompt };
    const runNodeData: Record<string, unknown> = {
      ...(hubNode.data as Record<string, unknown>),
      shotPromptPolishQueue: nextQueue,
      shotPromptPolishSystemPrompt: bundle.systemPrompt,
      outlineSystemPrompt: bundle.systemPrompt,
    };

    updateNodeData(scriptHubId, {
      shotPromptPolishQueue: nextQueue,
      shotPromptPolishSystemPrompt: bundle.systemPrompt,
    });

    const r = await runCanvasNode(base, projectId, scriptHubId, {
      node: {
        type: hubNode.type ?? "story-pro2-script-hub",
        data: runNodeData,
        imageInputs: [],
        textInputs: [],
      },
      forceFresh: true,
      llmSection: "shot_prompts",
      rowKey,
      polishMode: mode,
    });

    let task = TERMINAL.has(r.task.status)
      ? r.task
      : await pollTaskUntilDone(base, projectId, r.task.id, scriptHubId);

    const parsed = extractShotPromptPolishFromText(
      task.textOutput,
      shotIndex,
      mode,
    );

    if (task.status === "FAILED") {
      return {
        ok: false,
        error: formatCanvasTaskError(task.failCode, task.failMessage),
      };
    }
    if (task.status === "CANCELLED") {
      return { ok: false, error: "润色已取消" };
    }
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }

    const hydrateOpts = { propDisplayText };
    const shotForHydrate: Pro2ProductionScriptShot = {
      ...reconcileShotEntityLinks(draftShot, script, hydrateOpts),
      ...(parsed.frameImagePrompt
        ? { frameImagePrompt: parsed.frameImagePrompt }
        : {}),
      ...(parsed.videoPrompt ? { videoPrompt: parsed.videoPrompt } : {}),
    };

    const frameImagePrompt = parsed.frameImagePrompt
      ? hydrateWizardPromptTextForShot(
          parsed.frameImagePrompt,
          shotForHydrate,
          script,
          hydrateOpts,
        )
      : undefined;
    const videoPrompt = parsed.videoPrompt
      ? hydrateWizardPromptTextForShot(
          parsed.videoPrompt,
          shotForHydrate,
          script,
          hydrateOpts,
        )
      : undefined;

    if (frameImagePrompt || videoPrompt) {
      persistWizardShotPromptsToHub({
        scriptHubId,
        hubData,
        script,
        shotIndex,
        frameImagePrompt,
        videoPrompt,
        propDisplayText,
        updateNodeData,
      });
    }

    return {
      ok: true,
      frameImagePrompt,
      videoPrompt,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("409") || msg.includes("TASK_ALREADY_INFLIGHT")) {
      return { ok: false, error: "本镜正在生成中，请稍候再试" };
    }
    return { ok: false, error: msg || "润色失败" };
  } finally {
    WIZARD_SHOT_POLISH_INFLIGHT.delete(inflightKey);
  }
}
