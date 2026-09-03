"use client";

import {
  mergePro2ScriptGenerationPrompt,
  resolvePro2ScriptCategoryDocBody,
  shouldIncludePro2CategoryDocInSection,
} from "./pro2-script-category-doc";
import {
  resolvePro2FullPackSystemPrompt,
  resolvePro2OutlinePromptForRun,
} from "./pro2-gu-feng-full-pack-run";
import {
  resolvePro2HubPromptPack,
} from "./pro2-script-category-presets";
import {
  listPro2UpstreamVideoUrls,
  resolvePro2HubFilmPullIntent,
} from "./pro2-film-pull-intent";
import { parseCharacterRows, parseSceneVisualDictionaryRows, parseStoryboardRows, resolveSceneDictionaryMarkdown, extractCharacterSectionFromOutline } from "./parse-md-tables";
import {
  renderProductionScriptCharacterMd,
  renderProductionScriptSceneMd,
  resolveShotPropNames,
} from "./pro2-production-script-render-md";
import { buildCharacterRowsFromHub } from "./story-column-sync";
import { applyProductionScriptPatchToHub, resolveHubProductionScript } from "./pro2-production-script-apply";
import {
  buildShotPromptPolishBundle,
} from "./pro2-shot-prompt-polish";
import type { StoryboardTableRow } from "./parse-md-tables";
import type { Pro2ProductionScriptPatch } from "./data/pro2-production-script-schema";
import { PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION } from "./data/pro2-production-script-schema";
import {
  hubAggregateStatus,
  hubDataForColumnSync,
  hubSectionIsRunning,
  hubShowsGeneratingUi,
  resolveHubStoryboardMd,
  clearHubSectionRuntimesForForceFresh,
  hubSectionPendingPatch,
  resolvePro2HumanGfmFromHubSources,
} from "./story-hub-runtime";
import { syncStoryProColumnRows } from "./story-pro-column-sync";
import { markCanvasNodeGenerationStarted } from "./canvas-credits-notify";
import { hubHasServerInflightLlmTask } from "./task-pick";
import {
  batchRunPro2ThreeViewRows,
  batchRunStoryRows,
  busEnqueueStoryRun,
  busEnqueueStoryRunsSequential,
  runStoryHubSectionsSequential,
} from "./batch-run-nodes";
import { pickDefaultStoryImageEngine } from "./system-providers";
import type { StoryRefImage } from "./story-ref-image";
import { resolvePro2DockUpstreamLinks } from "./pro2-dock-upstream-links";
import { resolveDockRefsForRun } from "./pro2-dock-ref-catalog";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import { resolveHubOutlineMd } from "./story-hub-runtime";
import {
  hasHumanReadableProductionPackSections,
  isUnparsedPro2ProductionJsonBlob,
  stripTrailingPro2ProductionScriptJson,
} from "./pro2-production-script-structured";
import type { StoryProStarterNodeData } from "./story-pro-workspace-types";
import type { StoryLlmSection } from "./story-workspace-types";
import {
  PRO2_HUB_SECTION_ORDER,
  resolvePro2HubScriptGenerationSections,
} from "./pro2-script-generation-sections";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { resolveStarterForHub } from "./story-workspace-resolver";
import {
  findStoryPro2WorkspaceForStarter,
  spawnStoryPro2CharacterColumnFromHub,
  spawnStoryPro2FrameColumnFromHub,
  spawnStoryPro2VideoColumnFromFrame,
} from "./spawn-story-pro2-workspace";
import {
  pickDefaultPro2ThreeViewImageEngine,
  type Pro2ThreeViewBatchImagePick,
} from "./pro2-three-view-batch-image";
import {
  pickDefaultPro2SceneImageEngine,
  type Pro2SceneBatchImagePick,
} from "./pro2-scene-batch-image";
import { pro2ThinNodeIsLinked } from "./pro2-thin-node-display-state";
import { ensurePro2FrameImageGroup } from "./pro2-spawn-frame-image-group";
import { ensurePro2VideoBoardGroup } from "./pro2-spawn-video-board-group";
import { pickDefaultPro2VideoEngine } from "./pro2-video-batch-video";
import { resolveStoryFrameImageUrl } from "./story-frame-gate";
import { ensurePro2CharacterImageGroup } from "./pro2-spawn-character-image-group";
import {
  batchRunPro2SceneImageNodes,
  ensurePro2SceneImageGroup,
  readPro2SceneRowsForHub,
  syncPro2SceneImagesFromRows,
} from "./pro2-spawn-scene-image-group";
import { syncPro2FrameRowsUpstreamRefs } from "./pro2-wire-frame-board-refs";
import {
  applyPro2CharacterMediaPromptsForKeys,
  applyPro2FrameMediaPromptsForIndices,
  applyPro2SceneMediaPromptsForKeys,
} from "./pro2-lazy-media-prompts";
import {
  parseVisualStylePackFromOutline,
  readHubVisualStylePack,
} from "./story-pro-visual-style-pack";
export function pro2HubHasScriptTable(d: StoryProScriptHubNodeData): boolean {
  if ((d.productionScript?.shots?.length ?? 0) > 0) return true;
  const md = resolveHubStoryboardMd(d);
  return parseStoryboardRows(md).length > 0;
}

/** 角色表 Markdown（productionScript 真源优先 · 保证 ①②③ 与 imagePrompt 列） */
export function resolvePro2HubCharacterMd(
  d: StoryProScriptHubNodeData,
): string {
  const script = resolveHubProductionScript(d);
  if (script?.characters?.length) {
    return renderProductionScriptCharacterMd(script);
  }
  const humanGfm = resolvePro2HumanGfmFromHubSources(d);
  if (humanGfm) {
    const fromHuman = extractCharacterSectionFromOutline(humanGfm);
    if (parseCharacterRows(fromHuman).length > 0) return fromHuman;
  }
  const dedicated = (d.characterMd ?? "").trim();
  if (parseCharacterRows(dedicated).length > 0) return dedicated;
  const synced = hubDataForColumnSync(
    d as Parameters<typeof hubDataForColumnSync>[0],
  );
  const fromSync = (synced.characterMd ?? "").trim();
  if (parseCharacterRows(fromSync).length > 0) return fromSync;
  return fromSync;
}

export type Pro2HubCharacterPickerRow = {
  name: string;
  role: string;
  appearance: string;
  personality: string;
  aiImagePrompt: string;
};

/** 三视图选择弹层 · 优先 productionScript.characters，回退 MD 解析 */
export function resolvePro2HubCharacterPickerRows(
  d: StoryProScriptHubNodeData,
): Pro2HubCharacterPickerRow[] {
  const fromJson = buildCharacterRowsFromHub(d);
  if (fromJson.length) {
    return fromJson.map((r) => ({
      name: r.name,
      role: r.role,
      appearance: r.appearance,
      personality: r.personality?.trim() ?? "",
      aiImagePrompt: r.aiImagePrompt?.trim() ?? "",
    }));
  }
  return parseCharacterRows(resolvePro2HubCharacterMd(d));
}

export function pro2HubHasCharacterTable(d: StoryProScriptHubNodeData): boolean {
  if ((d.productionScript?.characters?.length ?? 0) > 0) return true;
  return parseCharacterRows(resolvePro2HubCharacterMd(d)).length > 0;
}

export function pro2HubHasOutlineContent(d: StoryProScriptHubNodeData): boolean {
  if (d.productionScript?.visualStyle?.worldBackground?.trim()) return true;
  const raw = d.outlineMd ?? "";
  if (hasHumanReadableProductionPackSections(stripTrailingPro2ProductionScriptJson(raw))) {
    return true;
  }
  if (isUnparsedPro2ProductionJsonBlob(raw)) return true;
  return Boolean(resolveHubOutlineMd(d).trim());
}

/** @deprecated 别名 · 使用 hubHasDisplayableScriptContent */
export { hubHasDisplayableScriptContent as pro2HubHasDisplayableScriptContent } from "./story-hub-runtime";

export type Pro2HubSceneResolveContext = {
  nodes?: CanvasFlowNode[];
  edges?: CanvasFlowEdge[];
  hubId?: string;
};

function hubDataWithEffectiveOutline(
  d: StoryProScriptHubNodeData,
  ctx?: Pro2HubSceneResolveContext,
): StoryProScriptHubNodeData {
  if (d.outlineMd?.trim() || !ctx?.nodes?.length || !ctx?.edges || !ctx?.hubId) {
    return d;
  }
  const outline = resolvePro2HubEffectiveOutline(
    ctx.nodes,
    ctx.edges,
    ctx.hubId,
    d,
  );
  if (!outline) return d;
  return { ...d, outlineMd: outline };
}

export function resolvePro2HubSceneMd(
  d: StoryProScriptHubNodeData,
  ctx?: Pro2HubSceneResolveContext,
): string {
  const pro2 = d.productionScript;
  if (pro2?.scenes?.length) {
    return renderProductionScriptSceneMd(pro2);
  }
  const synced = hubDataForColumnSync(
    hubDataWithEffectiveOutline(d, ctx) as Parameters<
      typeof hubDataForColumnSync
    >[0],
  );
  return resolveSceneDictionaryMarkdown(
    synced.outlineMd ?? "",
    synced.sceneMd ?? "",
  );
}

export function resolvePro2HubDataForColumnSync(
  hubId: string,
  d: StoryProScriptHubNodeData,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): StoryProScriptHubNodeData {
  return hubDataWithEffectiveOutline(d, { nodes, edges, hubId });
}

/** 与场景列 / 场景图组共用的场景行（含 hub 前缀 key） */
export function resolvePro2HubSceneRows(
  hubId: string,
  d: StoryProScriptHubNodeData,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): import("./story-pro-workspace-types").StoryProSceneRow[] {
  if (!pro2HubHasSceneTable(d, { nodes, edges, hubId })) return [];
  const synced = syncStoryProColumnRows(
    resolvePro2HubDataForColumnSync(hubId, d, nodes, edges),
    {},
    hubId,
  );
  return synced.sceneRows;
}

export function pro2HubHasSceneTable(
  d: StoryProScriptHubNodeData,
  ctx?: Pro2HubSceneResolveContext,
): boolean {
  if ((d.productionScript?.scenes?.length ?? 0) > 0) return true;
  return parseSceneVisualDictionaryRows(resolvePro2HubSceneMd(d, ctx)).length > 0;
}

/** 分镜组选择弹层 · 优先 productionScript.shots */
export function resolvePro2HubStoryboardPickerRows(
  d: StoryProScriptHubNodeData,
): StoryboardTableRow[] {
  const shots = d.productionScript?.shots;
  if (shots?.length) {
    const sceneById = new Map(
      (d.productionScript?.scenes ?? []).map((s) => [s.id, s.name] as const),
    );
    return shots.map((shot) => {
      const video = shot.videoPrompt?.trim() ?? "";
      const frameImage =
        shot.frameImagePrompt?.trim() || shot.imagePrompt?.trim() || "";
      return {
        frameIndex: shot.index,
        scene: shot.sceneId ? sceneById.get(shot.sceneId) ?? "" : "",
        shotSize: shot.shotSize?.trim() ?? "",
        lighting: shot.lighting?.trim() ?? "",
        cameraMove: shot.cameraMove?.trim() ?? "",
        description: shot.sceneDescription?.trim() ?? "",
        dialogue: shot.dialogue?.trim() ?? "",
        duration:
          shot.durationSec != null && shot.durationSec > 0
            ? String(shot.durationSec)
            : "",
        propNames: resolveShotPropNames(shot, d.productionScript!),
        sfxNote: shot.sfxNote?.trim() ?? "",
        frameImagePrompt: frameImage,
        aiImagePrompt: frameImage,
        aiVideoPrompt: video,
        lipSyncNote: shot.audioNote?.trim() ?? "",
        videoPrompt: video,
      };
    });
  }
  return parseStoryboardRows(resolveHubStoryboardMd(d));
}

/** 弹表编辑 · 写回 Hub productionScript 与 scriptStudioFrameRows */
export function persistPro2StoryboardTableEditsToHub(
  hubData: StoryProScriptHubNodeData,
  edits: StoryboardTableRow[],
  hubId?: string,
): Partial<StoryProScriptHubNodeData> {
  const script = hubData.productionScript;
  if (!script?.shots?.length) return {};
  const byIndex = new Map(edits.map((r) => [r.frameIndex, r] as const));
  const shots = script.shots.map((shot) => {
    const edit = byIndex.get(shot.index);
    if (!edit) return shot;
    const durationRaw = parseInt(edit.duration.replace(/\D/g, ""), 10);
    const frameImagePrompt =
      edit.frameImagePrompt?.trim() ||
      edit.aiImagePrompt?.trim() ||
      shot.frameImagePrompt;
    const videoPrompt =
      edit.videoPrompt?.trim() ||
      edit.aiVideoPrompt?.trim() ||
      shot.videoPrompt;
    return {
      ...shot,
      shotSize: edit.shotSize?.trim() || shot.shotSize,
      lighting: edit.lighting?.trim() || shot.lighting,
      cameraMove: edit.cameraMove?.trim() || shot.cameraMove,
      sceneDescription: edit.description?.trim() || shot.sceneDescription,
      dialogue: edit.dialogue?.trim() || shot.dialogue,
      durationSec:
        Number.isFinite(durationRaw) && durationRaw > 0
          ? durationRaw
          : shot.durationSec,
      sfxNote: edit.sfxNote?.trim() || shot.sfxNote,
      audioNote: edit.lipSyncNote?.trim() || shot.audioNote,
      frameImagePrompt,
      videoPrompt,
    };
  });
  const envelope: Pro2ProductionScriptPatch = {
    schemaVersion:
      script.schemaVersion === 1 ? 1 : PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    tier: "pro",
    step: "storyboard",
    patch: { shots },
  };
  return applyProductionScriptPatchToHub(hubData, envelope, hubId);
}

/** Pass 2 · 按镜 enqueue 提示词润色 LLM */
export function enqueuePro2ShotPromptPolish(
  hubId: string,
  shotIndices: number[],
  hubData: StoryProScriptHubNodeData,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  const script = hubData.productionScript;
  if (!script?.shots?.length) return false;
  const sorted = [...new Set(shotIndices.filter((n) => n > 0))].sort(
    (a, b) => a - b,
  );
  if (!sorted.length) return false;
  const queue: Record<string, string> = {
    ...(hubData.shotPromptPolishQueue ?? {}),
  };
  let systemPrompt = hubData.shotPromptPolishSystemPrompt;
  for (const index of sorted) {
    const prev = [...sorted.filter((n) => n < index)].pop();
    const bundle = buildShotPromptPolishBundle(index, script, {
      prevShotIndex: prev,
    });
    if (!bundle) continue;
    queue[String(index)] = bundle.userPrompt;
    systemPrompt = bundle.systemPrompt;
  }
  if (!Object.keys(queue).length) return false;
  updateNodeData(hubId, {
    shotPromptPolishQueue: queue,
    shotPromptPolishSystemPrompt: systemPrompt,
  });
  busEnqueueStoryRunsSequential(
    sorted
      .filter((index) => queue[String(index)]?.trim())
      .map((index) => ({
        nodeId: hubId,
        llmSection: "shot_prompts" as const,
        rowKey: String(index),
        forceFresh: true,
      })),
  );
  return true;
}

export { PRO2_HUB_SECTION_ORDER, resolvePro2HubScriptGenerationSections };

export function resolvePro2HubLinkedStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
): { starterId: string; starter: CanvasFlowNode } | null {
  const starter = resolveStarterForHub(nodes, edges, hubId);
  if (!starter) return null;
  return { starterId: starter.id, starter };
}

/** 大纲真源：hub 字段 → 上游文本节点 generated / uploaded */
export function resolvePro2HubEffectiveOutline(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  d: StoryProScriptHubNodeData,
): string {
  const onHub = d.outlineMd?.trim() || d.uploadedScriptMd?.trim();
  if (onHub) return onHub;
  const linked = resolvePro2HubLinkedStarter(nodes, edges, hubId);
  if (!linked) return "";
  const sd = linked.starter.data as unknown as StoryProStarterNodeData;
  return (
    sd.generatedOutlineMd?.trim() ||
    sd.uploadedScriptMd?.trim() ||
    ""
  );
}

export function resolvePro2HubThemeInput(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  d: StoryProScriptHubNodeData,
): string {
  const dock = d.dockInput?.trim();
  if (dock) return dock;
  const linked = resolvePro2HubLinkedStarter(nodes, edges, hubId);
  if (!linked) return "";
  const sd = linked.starter.data as unknown as StoryProStarterNodeData;
  return sd.themeInput?.trim() || "";
}

export function pro2HubIsLinkedOutline(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  d: StoryProScriptHubNodeData,
): { starterId: string; outlineMd: string } | null {
  const linked = resolvePro2HubLinkedStarter(nodes, edges, hubId);
  if (!linked) return null;
  const outline = resolvePro2HubEffectiveOutline(nodes, edges, hubId, d);
  return { starterId: linked.starterId, outlineMd: outline };
}

/** 脚本 hub 是否已链接可用的大纲/主题真源（含 starter 仅有 themeInput） */
export function pro2ScriptHubHasLinkedOutlineContent(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  d: StoryProScriptHubNodeData,
): boolean {
  if (resolvePro2HubEffectiveOutline(nodes, edges, hubId, d).trim()) return true;
  const linked = resolvePro2HubLinkedStarter(nodes, edges, hubId);
  if (!linked) return false;
  const sd = linked.starter.data as unknown as StoryProStarterNodeData;
  return Boolean(
    sd.generatedOutlineMd?.trim() ||
      sd.uploadedScriptMd?.trim() ||
      (sd.pro2TextPurpose === "story-outline" && sd.themeInput?.trim()),
  );
}

export function pro2HubIsGenerating(
  node: CanvasFlowNode,
  hubTasks?: import("@/lib/canvas-api").CanvasTaskRecord[],
): boolean {
  const d = node.data as unknown as StoryProScriptHubNodeData;
  const serverInflight =
    hubTasks != null && hubTasks.length > 0
      ? hubHasServerInflightLlmTask(node.id, hubTasks)
      : false;
  return hubShowsGeneratingUi(node, d.hubGenerateIntent, serverInflight);
}

export { stripStaleHubGenerateIntent } from "./story-hub-runtime";

export function mergePro2DockIntoPrompt(
  base: string,
  dockInput: string,
  refs: StoryRefImage[],
  categoryDoc?: string,
  scriptCategoryId?: import("./pro2-script-category-presets").Pro2ScriptCategoryId,
  outlineMd?: string,
  themeInput?: string,
  includeCategoryDoc = true,
): string {
  return mergePro2ScriptGenerationPrompt(base, dockInput, refs, {
    categoryDoc,
    includeCategoryDoc,
    scriptCategoryId,
    outlineMd,
    themeInput,
  });
}

/** 按 hub 剧本类别选择 LLM 段 prompt pack（未设类别 → 默认 v5 pack） */
export { resolvePro2HubPromptPack } from "./pro2-script-category-presets";

/** 阶段 A：生成专业版脚本（大纲 → 角色 → 分镜脚本表） */
export function enqueuePro2ScriptGeneration(
  hubId: string,
  dockInput: string,
  dockRefImages: StoryRefImage[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  options?: {
    forceFresh?: boolean;
    nodes?: CanvasFlowNode[];
    edges?: CanvasFlowEdge[];
    hubData?: StoryProScriptHubNodeData;
  },
): void {
  const nodes = options?.nodes ?? [];
  const edges = options?.edges ?? [];
  const hubData = options?.hubData;
  const effectiveOutline =
    hubData && nodes.length
      ? resolvePro2HubEffectiveOutline(nodes, edges, hubId, hubData)
      : hubData?.outlineMd?.trim() ?? "";
  const sections = resolvePro2HubScriptGenerationSections(
    effectiveOutline,
    hubData?.scriptCategoryId,
  );
  const firstSection = sections[0];

  // 登记会话，避免任务轮询 reconcile 在 Gateway 提交前误清乐观 pending（尤其 forceFresh 保留旧 MD）
  markCanvasNodeGenerationStarted(hubId);

  // 先写 intent + pending + dock，让节点/Dock 立刻进入「生成中」；v6 大 prompt 合并放到下一帧。
  // forceFresh 不在此处清空 *Md：保留旧预览作扫光底图，新结果落库时再覆盖，避免空态闪一下。
  const optimisticPatch: Record<string, unknown> = {
    dockInput,
    dockRefImages,
    hubGenerateIntent: true,
    ...(firstSection ? hubSectionPendingPatch(firstSection) : {}),
  };
  if (effectiveOutline && !hubData?.outlineMd?.trim()) {
    optimisticPatch.outlineMd = effectiveOutline;
  }
  if (options?.forceFresh) {
    Object.assign(
      optimisticPatch,
      clearHubSectionRuntimesForForceFresh(PRO2_HUB_SECTION_ORDER),
    );
    if (firstSection) {
      Object.assign(optimisticPatch, hubSectionPendingPatch(firstSection));
    }
  }
  const fullPackSystem = hubData
    ? resolvePro2FullPackSystemPrompt(hubData.scriptCategoryId)
    : undefined;
  if (fullPackSystem) {
    optimisticPatch.outlineSystemPrompt = fullPackSystem;
  }
  updateNodeData(hubId, optimisticPatch);

  const schedulePromptMergeAndRun = () => {
    const upstreamLinks =
      nodes.length > 0
        ? resolvePro2DockUpstreamLinks(
            hubId,
            "story-pro2-script-hub",
            nodes,
            edges,
          )
        : [];
    const resolvedDockRefs = resolveDockRefsForRun(
      dockInput,
      upstreamLinks,
      dockRefImages,
    );
    const themeInput =
      hubData && nodes.length
        ? resolvePro2HubThemeInput(nodes, edges, hubId, hubData)
        : "";

    const promptPack = resolvePro2HubPromptPack(hubData);
    const categoryDoc = resolvePro2ScriptCategoryDocBody(hubData);
    const categoryId = hubData?.scriptCategoryId;
    const filmPullSource =
      resolvePro2HubFilmPullIntent({
        packProfile: hubData?.packProfile,
        dockInput,
        hasUpstreamVideo: listPro2UpstreamVideoUrls(upstreamLinks).length > 0,
        hasOutline: Boolean(effectiveOutline),
      }) === "film_pull"
        ? "film_pull"
        : "creative";
    const mergeCtx = {
      categoryDoc,
      scriptCategoryId: categoryId,
      outlineMd: effectiveOutline,
      themeInput: effectiveOutline ? "" : themeInput,
    };

    const mergeSectionPrompt = (
      base: string,
      section: import("./story-workspace-types").StoryLlmSection,
      includeOutlineInPrompt: boolean,
    ) => {
      const includeDoc =
        shouldIncludePro2CategoryDocInSection(
          section,
          mergeCtx.scriptCategoryId,
        ) && section !== "outline";
      return mergePro2ScriptGenerationPrompt(base, dockInput, resolvedDockRefs, {
        categoryDoc: includeDoc ? mergeCtx.categoryDoc : undefined,
        includeCategoryDoc: includeDoc,
        scriptCategoryId: mergeCtx.scriptCategoryId,
        outlineMd: includeOutlineInPrompt ? mergeCtx.outlineMd : undefined,
        themeInput: includeOutlineInPrompt ? "" : mergeCtx.themeInput,
        llmSection: section,
        packProfile: hubData?.packProfile,
        source: filmPullSource,
      });
    };

    const hubForPrompt = hubData ?? {
      scriptCategoryId: categoryId,
      scriptCategoryDocBody: categoryDoc,
      dockInput,
    };

    updateNodeData(hubId, {
      promptOutline: mergeSectionPrompt(
        resolvePro2OutlinePromptForRun(
          hubForPrompt,
          effectiveOutline,
          promptPack.promptOutline,
        ),
        "outline",
        false,
      ),
      promptCharacter: mergeSectionPrompt(
        promptPack.promptCharacter,
        "character",
        false,
      ),
      promptScene: mergeSectionPrompt(promptPack.promptScene, "scene", false),
      promptStoryboard: mergeSectionPrompt(
        promptPack.promptStoryboard,
        "storyboard",
        true,
      ),
    });

    runStoryHubSectionsSequential(hubId, sections, options);
    // hubGenerateIntent 由 story-run-apply 在任务终态时清除；勿在此处提前清掉以免轮询窗口内扫光消失
  };

  if (typeof window !== "undefined") {
    requestAnimationFrame(schedulePromptMergeAndRun);
  } else {
    schedulePromptMergeAndRun();
  }
}

type FrameKickoffStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type:
      | "story-pro2-frame"
      | "story-pro2-video"
      | "story-pro2-image"
      | "sbv1-video-engine"
      | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: "story-pro2-image" | "story-pro2-three-view" | "sbv1-video-engine",
    groupId: string,
    relativePosition: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  createGroupContaining: (
    childIds: string[],
    opts: { label: string; color: string },
  ) => string | null;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodes: (fn: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
};

export type KickoffPro2FrameBoardOptions = {
  /** 仅生成这些镜号；缺省为全部镜 */
  selectedFrameIndices?: number[];
  /** 分镜图 IMAGE 模型（弹层选择后写入分镜列） */
  batchImage?: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  };
  /** 已有分镜组时追加新组 */
  spawnNewGroup?: boolean;
  /** 重新生成时强制新任务 */
  forceFresh?: boolean;
};

type UpstreamMediaKickoffStore = FrameKickoffStore & {
  addNode: (
    type:
      | "story-pro2-character"
      | "story-pro2-scene"
      | "story-pro2-frame"
      | "story-pro2-image"
      | "story-pro2-three-view"
      | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
};

/** 连接已有（或新建）角色三视图组 / 场景图组，供生成分镜时按镜号关联参考 */
function ensurePro2UpstreamMediaGroupsForFrameBoard(
  getStore: () => UpstreamMediaKickoffStore,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  starterId: string,
  ws: StoryPro2WorkspaceIds,
): {
  characterRows: import("./story-pro-workspace-types").StoryProCharacterRow[];
  sceneRows: import("./story-pro-workspace-types").StoryProSceneRow[];
} {
  let store = getStore();
  let characterColumnId = ws.characterColumnId;
  const legacySceneColumnId = ws.sceneColumnId;

  const charNode = characterColumnId
    ? store.nodes.find((n) => n.id === characterColumnId)
    : undefined;
  const existingSceneRows = readPro2SceneRowsForHub(
    hubId,
    store.nodes,
    legacySceneColumnId,
  );
  const existingCharRows = (charNode?.data as { rows?: unknown[] })?.rows ?? [];

  let columnSync = syncStoryProColumnRows(
    resolvePro2HubDataForColumnSync(hubId, hubData, store.nodes, store.edges),
    {
      characterRows: existingCharRows as never,
      sceneRows: existingSceneRows as never,
    },
    hubId,
  );

  if (pro2HubHasCharacterTable(hubData)) {
    if (
      !characterColumnId ||
      !store.nodes.some((n) => n.id === characterColumnId)
    ) {
      characterColumnId = spawnStoryPro2CharacterColumnFromHub({
        scriptHubId: hubId,
        starterNodeId: starterId,
        nodes: store.nodes,
        edges: store.edges,
        addNode: store.addNode,
        setEdges: store.setEdges,
        updateNodeData: store.updateNodeData,
      });
      store = getStore();
    }
    store.updateNodeData(characterColumnId, {
      rows: columnSync.characterRows,
      hubNodeId: hubId,
    });
    store = getStore();
    // 生成分镜图时仅同步角色行数据供 @ 引用，不自动 spawn 角色三视图媒体组
  }

  if (columnSync.sceneRows.length > 0) {
    store.updateNodeData(hubId, { sceneRows: columnSync.sceneRows });
    store = getStore();
    // 生成分镜图时仅同步场景行，不自动 spawn 场景图媒体组
  }

  return {
    characterRows: columnSync.characterRows,
    sceneRows: columnSync.sceneRows,
  };
}

type EnsurePro2VideoBoardGroupArgs = Parameters<
  typeof ensurePro2VideoBoardGroup
>[0];

/** Pass 3 · spawn 分镜图组 + 分镜视频组（不自动 Gateway batch） */
export function kickoffPro2StoryboardFromHub(
  getStore: () => FrameKickoffStore,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  dockInput: string,
  dockRefImages: StoryRefImage[],
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
  options?: KickoffPro2FrameBoardOptions,
): { frameColumnId: string; videoColumnId: string } | null {
  let store = getStore();
  const starter = resolveStarterForHub(store.nodes, store.edges, hubId);
  if (!starter) return null;

  if (!pro2HubHasScriptTable(hubData)) return null;

  store.updateNodeData(hubId, { dockInput, dockRefImages });
  store = getStore();

  const upstreamLinks = resolvePro2DockUpstreamLinks(
    hubId,
    "story-pro2-script-hub",
    store.nodes,
    store.edges,
  );
  const resolvedDockRefs = resolveDockRefsForRun(
    dockInput,
    upstreamLinks,
    dockRefImages,
  );

  const ws =
    findStoryPro2WorkspaceForStarter(
      store.nodes,
      store.edges,
      starter.id,
      (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
    ) ?? ({ scriptHubId: hubId } as StoryPro2WorkspaceIds);

  let frameColumnId = ws.frameColumnId;
  if (!frameColumnId || !store.nodes.some((n) => n.id === frameColumnId)) {
    frameColumnId = spawnStoryPro2FrameColumnFromHub({
      scriptHubId: hubId,
      starterNodeId: starter.id,
      nodes: store.nodes,
      edges: store.edges,
      addNode: store.addNode,
      setEdges: store.setEdges,
      updateNodeData: store.updateNodeData,
    });
    store = getStore();
  }

  const frameNode = store.nodes.find((n) => n.id === frameColumnId);
  const existing = frameNode?.data as { rows?: unknown[] } | undefined;

  const synced = syncStoryProColumnRows(
    hubData,
    { frameRows: (existing?.rows ?? []) as never },
    hubId,
  );

  const upstream = ensurePro2UpstreamMediaGroupsForFrameBoard(
    getStore as () => UpstreamMediaKickoffStore,
    hubId,
    hubData,
    starter.id,
    ws,
  );
  store = getStore();

  const refUrls = resolvedDockRefs.filter(
    (r) => r.url && /^https?:\/\//.test(r.url),
  );

  const picked = options?.selectedFrameIndices?.filter(
    (n) => Number.isFinite(n) && n > 0,
  );
  const pickedIndices =
    picked?.length && picked.length > 0
      ? picked
      : synced.frameRows.map((r) => r.frameIndex);

  // 剧本 hub dockInput 仅用于 LLM 生成分镜脚本，不得拼进分镜图 prompt
  const frameRowsWithPrompts = applyPro2FrameMediaPromptsForIndices(
    synced.frameRows,
    pickedIndices,
  ).map((row) => ({
    ...row,
    refImages:
      pickedIndices.includes(row.frameIndex) && refUrls.length
        ? [...(row.refImages ?? []), ...refUrls]
        : row.refImages,
  }));

  const frameRows = syncPro2FrameRowsUpstreamRefs(
    frameRowsWithPrompts,
    upstream.characterRows,
    upstream.sceneRows,
  );

  store.updateNodeData(frameColumnId, { rows: frameRows, hubNodeId: hubId });
  store = getStore();

  const batchFromPicker = options?.batchImage;
  if (batchFromPicker?.providerId?.trim() && batchFromPicker.modelKey?.trim()) {
    store.updateNodeData(frameColumnId, {
      batchImage: {
        providerId: batchFromPicker.providerId,
        modelKey: batchFromPicker.modelKey,
        params: batchFromPicker.params ?? {
          aspect_ratio: "16:9",
          resolution: "2K",
          output_format: "png",
        },
      },
    });
  } else {
    const imagePick = pickDefaultStoryImageEngine(providers);
    if (imagePick) {
      const frameNow = store.nodes.find((n) => n.id === frameColumnId);
      const batch = (frameNow?.data as { batchImage?: unknown })?.batchImage as
        | { providerId?: string }
        | undefined;
      if (!batch?.providerId?.trim()) {
        store.updateNodeData(frameColumnId, {
          batchImage: {
            providerId: imagePick.providerId,
            modelKey: imagePick.modelKey,
            params: {
              aspect_ratio: "16:9",
              resolution: "2K",
              output_format: "png",
            },
          },
        });
      }
    }
  }

  let keys = frameRows.map((r) => r.key);
  if (picked?.length) {
    const allowed = new Set(picked);
    keys = frameRows
      .filter((r) => allowed.has(r.frameIndex))
      .map((r) => r.key);
  }
  store = getStore();
  ensurePro2FrameImageGroup({
    frameColumnId: frameColumnId!,
    hubNodeId: hubId,
    rows: frameRows,
    rowKeys: keys.length ? keys : undefined,
    nodes: store.nodes,
    addNode: store.addNode,
    addNodeInGroup: store.addNodeInGroup,
    createGroupContaining: store.createGroupContaining,
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
    spawnNewGroup: options?.spawnNewGroup ?? true,
  });

  if (!(options?.spawnNewGroup ?? true)) {
    store = getStore();
    store.updateNodeData(frameColumnId!, {
      pro2PendingSyncGroupId: undefined,
    });
  }

  // Pass 3 · spawn-only：同次创建分镜视频组（不要求已有分镜图 URL）
  let videoColumnId = ws.videoColumnId;
  if (!videoColumnId || !store.nodes.some((n) => n.id === videoColumnId)) {
    videoColumnId = spawnStoryPro2VideoColumnFromFrame({
      scriptHubId: hubId,
      starterNodeId: starter.id,
      frameColumnId: frameColumnId!,
      nodes: store.nodes,
      edges: store.edges,
      addNode: store.addNode as (
        type: "story-pro2-video",
        position: { x: number; y: number },
        data: Record<string, unknown>,
      ) => string,
      setEdges: store.setEdges,
      updateNodeData: store.updateNodeData,
    });
    store = getStore();
  }

  const videoSynced = syncStoryProColumnRows(
    hubData,
    {
      frameRows,
      videoRows: (
        store.nodes.find((n) => n.id === videoColumnId)?.data as {
          rows?: unknown[];
        }
      )?.rows as never,
    },
    hubId,
  );
  store.updateNodeData(videoColumnId, {
    rows: videoSynced.videoRows,
    hubNodeId: hubId,
    frameColumnId: frameColumnId!,
  });
  store = getStore();

  const spawnFrameRows = keys.length
    ? frameRows.filter((r) => keys.includes(r.key))
    : frameRows;
  const spawnVideoRows = keys.length
    ? videoSynced.videoRows.filter((v) => keys.includes(v.key))
    : videoSynced.videoRows;

  ensurePro2VideoBoardGroup({
    videoColumnId,
    frameColumnId: frameColumnId!,
    hubNodeId: hubId,
    frameRows: spawnFrameRows,
    videoRows: spawnVideoRows,
    nodes: store.nodes,
    addNode: store.addNode as EnsurePro2VideoBoardGroupArgs["addNode"],
    addNodeInGroup: store.addNodeInGroup as EnsurePro2VideoBoardGroupArgs["addNodeInGroup"],
    createGroupContaining: store.createGroupContaining,
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
  });

  return { frameColumnId: frameColumnId!, videoColumnId };
}

/** @deprecated 使用 kickoffPro2StoryboardFromHub */
export const kickoffPro2FrameBoardFromHub = kickoffPro2StoryboardFromHub;

export type KickoffPro2VideoBoardOptions = {
  selectedFrameIndices?: number[];
  batchVideo?: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  };
  frameColumnId: string;
  hubNodeId: string;
};

type VideoKickoffStore = FrameKickoffStore & {
  addNode: (
    type: "story-pro2-video" | "sbv1-video-engine" | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: "sbv1-video-engine",
    groupId: string,
    relativePosition: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
};

/** 从分镜图组 · 选择镜号后 spawn 视频组并批量生成 */
export function kickoffPro2VideoBoardFromFrameGroup(
  getStore: () => VideoKickoffStore,
  options: KickoffPro2VideoBoardOptions,
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
): { videoColumnId: string } | null {
  let store = getStore();
  const { frameColumnId, hubNodeId } = options;
  const starter = resolveStarterForHub(store.nodes, store.edges, hubNodeId);
  if (!starter) return null;

  const frameNode = store.nodes.find((n) => n.id === frameColumnId);
  if (!frameNode) return null;

  const hub = store.nodes.find((n) => n.id === hubNodeId);
  const hubData = (hub?.data ?? {}) as StoryProScriptHubNodeData;

  const synced = syncStoryProColumnRows(
    hubData,
    { frameRows: (frameNode.data as { rows?: unknown[] })?.rows as never },
    hubNodeId,
  );

  let frameRows = synced.frameRows.map((row) => {
    const url = resolveStoryFrameImageUrl(row);
    if (url && !row.frameApprovedAt) {
      return { ...row, frameApprovedAt: new Date().toISOString() };
    }
    return row;
  });

  store.updateNodeData(frameColumnId, { rows: frameRows });
  store = getStore();

  const picked = options.selectedFrameIndices?.filter(
    (n) => Number.isFinite(n) && n > 0,
  );
  let targetFrameRows = frameRows;
  if (picked?.length) {
    const allowed = new Set(picked);
    targetFrameRows = frameRows.filter((r) => allowed.has(r.frameIndex));
  }

  targetFrameRows = targetFrameRows.filter((r) =>
    Boolean(resolveStoryFrameImageUrl(r)),
  );
  if (!targetFrameRows.length) return null;

  const videoColumnId = spawnStoryPro2VideoColumnFromFrame({
    scriptHubId: hubNodeId,
    starterNodeId: starter.id,
    frameColumnId,
    nodes: store.nodes,
    edges: store.edges,
    addNode: store.addNode,
    setEdges: store.setEdges,
    updateNodeData: store.updateNodeData,
  });
  store = getStore();

  const videoSynced = syncStoryProColumnRows(
    hubData,
    {
      frameRows,
      videoRows: (
        store.nodes.find((n) => n.id === videoColumnId)?.data as {
          rows?: unknown[];
        }
      )?.rows as never,
    },
    hubNodeId,
  );

  const videoRows = videoSynced.videoRows.filter((v) =>
    targetFrameRows.some(
      (f) => f.key === v.key || f.frameIndex === v.frameIndex,
    ),
  );

  const batchFromPicker = options.batchVideo;
  if (batchFromPicker?.providerId?.trim() && batchFromPicker.modelKey?.trim()) {
    store.updateNodeData(videoColumnId, {
      batchVideo: {
        providerId: batchFromPicker.providerId,
        modelKey: batchFromPicker.modelKey,
        params: batchFromPicker.params ?? { duration: 5, resolution: "720p" },
      },
      frameColumnId,
      hubNodeId,
    });
  } else {
    const videoPick = pickDefaultPro2VideoEngine(providers);
    if (videoPick) {
      store.updateNodeData(videoColumnId, {
        batchVideo: videoPick,
        frameColumnId,
        hubNodeId,
      });
    }
  }

  store.updateNodeData(videoColumnId, { rows: videoRows });
  store = getStore();

  const keys = videoRows.map((r) => r.key);

  ensurePro2VideoBoardGroup({
    videoColumnId,
    frameColumnId,
    hubNodeId,
    frameRows: targetFrameRows,
    videoRows,
    nodes: store.nodes,
    addNode: store.addNode,
    addNodeInGroup: store.addNodeInGroup,
    createGroupContaining: store.createGroupContaining,
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
  });

  store = getStore();
  store.setEdges((prev) => {
    let next = prev;
    const videos = store.nodes.filter(
      (n) =>
        n.type === "sbv1-video-engine" &&
        (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
          videoColumnId,
    );
    for (const video of videos) {
      const rowKey = (video.data as { pro2RowKey?: string }).pro2RowKey;
      if (!rowKey) continue;
      const frameImg = store.nodes.find(
        (n) =>
          n.type === "story-pro2-image" &&
          (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
            frameColumnId &&
          (n.data as { pro2RowKey?: string }).pro2RowKey === rowKey,
      );
      if (!frameImg) continue;
      if (
        next.some(
          (e) =>
            e.source === frameImg.id &&
            e.target === video.id &&
            e.targetHandle === "in_ref",
        )
      ) {
        continue;
      }
      next = [
        ...next,
        {
          id: `e-${frameImg.id}-${video.id}-ref`,
          source: frameImg.id,
          target: video.id,
          sourceHandle: "out_image",
          targetHandle: "in_ref",
        },
      ];
    }
    return next;
  });

  if (keys.length) {
    window.setTimeout(() => {
      batchRunStoryRows(videoColumnId, keys, "video", { forceFresh: false });
    }, 0);
  }

  return { videoColumnId };
}

type CharacterThreeViewKickoffStore = FrameKickoffStore & {
  addNode: (
    type:
      | "story-pro2-character"
      | "story-pro2-frame"
      | "story-pro2-image"
      | "story-pro2-three-view"
      | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
};

export type KickoffPro2CharacterThreeViewOptions = {
  characterKeys?: string[];
  batchImage?: Pro2ThreeViewBatchImagePick;
  /** 脚本 hub 每次点击默认 true：追加新三视图组 */
  spawnNewGroup?: boolean;
};

/** 阶段 B′：spawn 人物设计列、同步角色行、批量生成三视图 */
export function kickoffPro2CharacterThreeViewFromHub(
  getStore: () => CharacterThreeViewKickoffStore,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
  options?: KickoffPro2CharacterThreeViewOptions,
): { characterColumnId: string } | null {
  if (!pro2HubHasCharacterTable(hubData)) return null;

  let store = getStore();
  const starter = resolveStarterForHub(store.nodes, store.edges, hubId);
  if (!starter) return null;

  const ws =
    findStoryPro2WorkspaceForStarter(
      store.nodes,
      store.edges,
      starter.id,
      (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
    ) ?? ({ scriptHubId: hubId } as StoryPro2WorkspaceIds);

  let characterColumnId = ws.characterColumnId;
  if (
    !characterColumnId ||
    !store.nodes.some((n) => n.id === characterColumnId)
  ) {
    characterColumnId = spawnStoryPro2CharacterColumnFromHub({
      scriptHubId: hubId,
      starterNodeId: starter.id,
      nodes: store.nodes,
      edges: store.edges,
      addNode: store.addNode,
      setEdges: store.setEdges,
      updateNodeData: store.updateNodeData,
    });
    store = getStore();
  }

  const charNode = store.nodes.find((n) => n.id === characterColumnId);
  const existing = charNode?.data as { rows?: unknown[] } | undefined;
  const synced = syncStoryProColumnRows(
    hubData,
    { characterRows: (existing?.rows ?? []) as never },
    hubId,
  );

  const visualPack =
    hubData.visualStylePack ??
    (hubData.outlineMd?.trim()
      ? parseVisualStylePackFromOutline(hubData.outlineMd)
      : null);

  let keys = synced.characterRows.map((r) => r.key);
  const picked = options?.characterKeys?.filter((k) => k.trim());
  if (picked?.length) {
    const allowed = new Set(picked);
    keys = synced.characterRows
      .filter((r) => allowed.has(r.key) || allowed.has(r.name))
      .map((r) => r.key);
  }

  const columnRows = applyPro2CharacterMediaPromptsForKeys(
    synced.characterRows,
    keys,
    visualPack,
  );

  store.updateNodeData(characterColumnId, {
    rows: columnRows,
    hubNodeId: hubId,
  });
  store = getStore();

  const batchFromPicker = options?.batchImage;
  if (batchFromPicker?.providerId?.trim() && batchFromPicker.modelKey?.trim()) {
    store.updateNodeData(characterColumnId, {
      batchImage: {
        providerId: batchFromPicker.providerId,
        modelKey: batchFromPicker.modelKey,
        params: batchFromPicker.params ?? {
          aspect_ratio: "16:9",
          resolution: "2K",
          output_format: "png",
        },
      },
    });
  } else {
    const imagePick = pickDefaultPro2ThreeViewImageEngine(providers);
    if (imagePick) {
      const colNow = store.nodes.find((n) => n.id === characterColumnId);
      const batch = (colNow?.data as { batchImage?: unknown })?.batchImage as
        | { providerId?: string }
        | undefined;
      if (!batch?.providerId?.trim()) {
        store.updateNodeData(characterColumnId, {
          batchImage: {
            providerId: imagePick.providerId,
            modelKey: imagePick.modelKey,
            params: {
              aspect_ratio: "16:9",
              resolution: "2K",
              output_format: "png",
            },
          },
        });
      }
    }
  }

  store = getStore();
  ensurePro2CharacterImageGroup({
    characterColumnId: characterColumnId!,
    hubNodeId: hubId,
    rows: columnRows,
    rowKeys: keys.length ? keys : undefined,
    nodes: store.nodes,
    addNode: store.addNode,
    addNodeInGroup: store.addNodeInGroup,
    createGroupContaining: store.createGroupContaining,
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
    spawnNewGroup: options?.spawnNewGroup ?? true,
  });

  if (keys.length) {
    batchRunPro2ThreeViewRows(characterColumnId!, keys, {
      forceFresh: Boolean(options?.spawnNewGroup ?? true),
    });
  }

  return { characterColumnId };
}

type SceneImageKickoffStore = UpstreamMediaKickoffStore;

export type KickoffPro2SceneImageOptions = {
  sceneKeys?: string[];
  batchImage?: Pro2SceneBatchImagePick;
  /** 脚本 hub 每次点击默认 true：追加新场景图组 */
  spawnNewGroup?: boolean;
};

/** 阶段 B″：同步场景行、spawn 场景图组、批量生成场景图（不再 spawn 场景设计列） */
export function kickoffPro2SceneImageFromHub(
  getStore: () => SceneImageKickoffStore,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
  options?: KickoffPro2SceneImageOptions,
): { hubNodeId: string } | null {
  let store = getStore();
  const sceneCtx = { nodes: store.nodes, edges: store.edges, hubId };
  if (!pro2HubHasSceneTable(hubData, sceneCtx)) return null;

  const starter = resolveStarterForHub(store.nodes, store.edges, hubId);
  if (!starter) return null;

  const ws =
    findStoryPro2WorkspaceForStarter(
      store.nodes,
      store.edges,
      starter.id,
      (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
    ) ?? ({ scriptHubId: hubId } as StoryPro2WorkspaceIds);

  const legacySceneColumnId = ws.sceneColumnId;
  const existingSceneRows = readPro2SceneRowsForHub(
    hubId,
    store.nodes,
    legacySceneColumnId,
  );
  const synced = syncStoryProColumnRows(
    resolvePro2HubDataForColumnSync(hubId, hubData, store.nodes, store.edges),
    { sceneRows: existingSceneRows as never },
    hubId,
  );

  const batchFromPicker = options?.batchImage;
  if (batchFromPicker?.providerId?.trim() && batchFromPicker.modelKey?.trim()) {
    store.updateNodeData(hubId, {
      sceneBatchImage: {
        providerId: batchFromPicker.providerId,
        modelKey: batchFromPicker.modelKey,
        params: batchFromPicker.params ?? {
          aspect_ratio: "16:9",
          resolution: "2K",
          output_format: "png",
        },
      },
    });
  } else {
    const imagePick = pickDefaultPro2SceneImageEngine(providers);
    if (imagePick) {
      const hubNow = store.nodes.find((n) => n.id === hubId);
      const batch = (hubNow?.data as { sceneBatchImage?: unknown })
        ?.sceneBatchImage as { providerId?: string } | undefined;
      if (!batch?.providerId?.trim()) {
        store.updateNodeData(hubId, {
          sceneBatchImage: {
            providerId: imagePick.providerId,
            modelKey: imagePick.modelKey,
            params: {
              aspect_ratio: "16:9",
              resolution: "2K",
              output_format: "png",
            },
          },
        });
      }
    }
  }

  let keys = synced.sceneRows.map((r) => r.key);
  const picked = options?.sceneKeys?.filter((k) => k.trim());
  if (picked?.length) {
    const allowed = new Set(picked);
    keys = synced.sceneRows
      .filter((r) => allowed.has(r.key) || allowed.has(r.name))
      .map((r) => r.key);
  }
  keys = Array.from(new Set(keys.filter(Boolean)));

  const visualPack = readHubVisualStylePack(hubId, store.nodes);
  const sceneRowsForHub = applyPro2SceneMediaPromptsForKeys(
    synced.sceneRows,
    keys,
    visualPack,
  );

  store.updateNodeData(hubId, { sceneRows: sceneRowsForHub });
  store = getStore();
  ensurePro2SceneImageGroup({
    hubNodeId: hubId,
    rows: sceneRowsForHub,
    rowKeys: keys.length ? keys : undefined,
    nodes: store.nodes,
    edges: store.edges,
    starterNodeId: starter.id,
    legacySceneColumnId,
    addNode: store.addNode,
    addNodeInGroup: store.addNodeInGroup,
    createGroupContaining: store.createGroupContaining,
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
    spawnNewGroup: options?.spawnNewGroup ?? true,
  });
  store = getStore();
  syncPro2SceneImagesFromRows(
    store.nodes,
    hubId,
    sceneRowsForHub,
    store.updateNodeData,
  );

  if (keys.length) {
    const runBatch = () => {
      const fresh = getStore();
      batchRunPro2SceneImageNodes(
        fresh.nodes,
        hubId,
        sceneRowsForHub,
        keys,
        { forceFresh: Boolean(options?.spawnNewGroup ?? true) },
      );
    };
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runBatch);
    });
  }

  return { hubNodeId: hubId };
}

export function pro2HubCanSendScriptPhase(
  node: CanvasFlowNode,
  d: StoryProScriptHubNodeData,
  ctx?: {
    nodes?: CanvasFlowNode[];
    edges?: CanvasFlowEdge[];
    hubTasks?: import("@/lib/canvas-api").CanvasTaskRecord[];
  },
): boolean {
  if (pro2HubIsGenerating(node, ctx?.hubTasks)) return false;
  if (pro2HubHasScriptTable(d)) return false;
  if (!d.providerId?.trim() || !d.modelKey?.trim()) return false;
  if (d.dockInput?.trim()) return true;
  if (d.outlineMd?.trim()) return true;
  if (ctx?.nodes && ctx?.edges) {
    if (resolvePro2HubEffectiveOutline(ctx.nodes, ctx.edges, node.id, d)) {
      return true;
    }
    if (resolvePro2HubThemeInput(ctx.nodes, ctx.edges, node.id, d)) return true;
    if (pro2ThinNodeIsLinked(node.id, ctx.edges)) return true;
  }
  return false;
}

export function pro2HubCanSendFramePhase(
  node: CanvasFlowNode,
  d: StoryProScriptHubNodeData,
): boolean {
  if (pro2HubIsGenerating(node)) return false;
  if (!pro2HubHasScriptTable(d)) return false;
  const frameRunning =
    hubSectionIsRunning(node, "character") ||
    hubSectionIsRunning(node, "storyboard");
  if (frameRunning) return false;
  return Boolean(d.providerId?.trim() && d.modelKey?.trim());
}

export function pro2HubScriptPhaseLabel(
  d: StoryProScriptHubNodeData,
  ctx?: { nodeId?: string; nodes?: CanvasFlowNode[]; edges?: CanvasFlowEdge[] },
): string {
  if (pro2HubHasScriptTable(d)) return "frame";
  if (d.outlineMd?.trim()) return "script";
  if (d.dockInput?.trim()) return "script";
  if (ctx?.nodeId && ctx.nodes && ctx.edges) {
    if (resolvePro2HubEffectiveOutline(ctx.nodes, ctx.edges, ctx.nodeId, d)) {
      return "script";
    }
    if (resolvePro2HubThemeInput(ctx.nodes, ctx.edges, ctx.nodeId, d)) {
      return "script";
    }
    if (pro2ThinNodeIsLinked(ctx.nodeId, ctx.edges)) return "script";
  }
  return "empty";
}
