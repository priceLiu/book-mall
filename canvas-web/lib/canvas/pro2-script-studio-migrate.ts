/**
 * 旧 Pro2 剧本创作画布迁移：starter 上的 scriptStudioMode / 批次数据 → script-hub 锚点。
 * hydrate / migrateGraphV1ToV2 时 in-memory 执行，下次 autosave 落库。
 */
import { nanoid } from "nanoid";
import { buildCrewBulletinFromHub } from "./crew-bulletin-build";
import { crewBulletinFromScriptPackagePayload } from "./crew-bulletin-script-package";
import { findScriptStudioHub } from "./script-studio-run-apply";
import {
  STORY_PRO_HUB_LLM_SYSTEM,
  STORY_PRO_LLM_PARAMS_DEFAULT,
} from "./story-pro-prompts";
import {
  STORY_PRO2_CHARACTER_PROMPT,
  STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
  STORY_PRO2_SCENE_PROMPT,
  STORY_PRO2_STORYBOARD_PROMPT,
} from "./story-pro2-theme-outline-prompt";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasGraph } from "./types";
import {
  PRO2_SCRIPT_NODE_HEIGHT,
  PRO2_SCRIPT_NODE_WIDTH,
} from "./story-pro2-node-chrome";

const SCRIPT_STUDIO_STARTER_KEYS = [
  "scriptStudioInputMode",
  "scriptStudioThemeInput",
  "scriptStudioSystem",
  "scriptStudioTotalEpisodes",
  "scriptStudioBatchIndex",
  "scriptStudioFrozenBiblesMd",
  "scriptStudioFrozenBiblesOssUrl",
  "scriptStudioCompletedBatchesMd",
  "scriptStudioCompletedBatchesOssUrl",
  "uploadedScriptMd",
  "uploadedScriptOssUrl",
  "uploadedScriptMeta",
  "scriptStudioCharacterRows",
  "sceneRows",
  "scriptStudioPropRows",
  "scriptStudioFrameRows",
  "scriptStudioMoodRows",
  "scriptStudioAudioRows",
  "crewBulletin",
  "scriptPublished",
  "scriptFinalized",
  "themeOutlineRuntime",
] as const;

function starterHasScriptStudioWork(d: StoryProStarterNodeData): boolean {
  if (d.workspaceIds?.linkedScriptPackageAssetId) return false;
  return (
    d.scriptStudioMode === true ||
    Boolean(d.scriptStudioCompletedBatchesMd?.trim()) ||
    (d.scriptStudioBatchIndex ?? 0) > 0 ||
    Boolean(d.scriptStudioFrozenBiblesMd?.trim()) ||
    Boolean(d.scriptStudioThemeInput?.trim()) ||
    Boolean(d.uploadedScriptMd?.trim())
  );
}

function pickLegacyScriptStudioStarter(
  nodes: CanvasFlowNode[],
): CanvasFlowNode | undefined {
  const starters = nodes.filter((n) => n.type === "story-pro2-starter");
  return (
    starters.find((n) => {
      const d = n.data as StoryProStarterNodeData;
      return d.scriptStudioMode === true || starterHasScriptStudioWork(d);
    }) ?? starters[0]
  );
}

function hubDataFromStarter(
  starter: CanvasFlowNode,
  hubId: string,
  existing?: StoryProScriptHubNodeData,
): StoryProScriptHubNodeData {
  const s = starter.data as StoryProStarterNodeData;
  const base: StoryProScriptHubNodeData = {
    outlineMd: "",
    characterMd: "",
    storyboardMd: "",
    providerId: s.providerId ?? "",
    modelKey: s.modelKey ?? "",
    promptOutline: "",
    promptCharacter: "",
    promptStoryboard: "",
    ...(existing ?? {}),
  };

  base.outlineMd =
    existing?.outlineMd?.trim() ||
    s.scriptStudioCompletedBatchesMd?.trim() ||
    s.generatedOutlineMd?.trim() ||
    base.outlineMd ||
    "";
  base.providerId = existing?.providerId || s.providerId || "";
  base.modelKey = existing?.modelKey || s.modelKey || "";
  base.params = {
    ...STORY_PRO_LLM_PARAMS_DEFAULT,
    ...(s.params ?? {}),
    ...(existing?.params ?? {}),
  };
  base.outlineSystemPrompt =
    existing?.outlineSystemPrompt ?? STORY_PRO_HUB_LLM_SYSTEM;
  base.promptOutline =
    existing?.promptOutline ?? STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT;
  base.promptCharacter =
    existing?.promptCharacter ?? STORY_PRO2_CHARACTER_PROMPT;
  base.promptScene = existing?.promptScene ?? STORY_PRO2_SCENE_PROMPT;
  base.promptStoryboard =
    existing?.promptStoryboard ?? STORY_PRO2_STORYBOARD_PROMPT;
  base.scriptStudioMode = true;

  for (const key of SCRIPT_STUDIO_STARTER_KEYS) {
    const val = s[key as keyof StoryProStarterNodeData];
    if (val != null && val !== "" && (existing as Record<string, unknown>)?.[key] == null) {
      (base as Record<string, unknown>)[key] = val;
    }
  }

  if (base.scriptPublished && !base.crewBulletin?.tasks?.length) {
    base.crewBulletin = buildCrewBulletinFromHub(hubId, base);
  }

  return base;
}

function clearStarterScriptStudio(starter: CanvasFlowNode): CanvasFlowNode {
  const d = { ...(starter.data as StoryProStarterNodeData) };
  delete d.scriptStudioMode;
  delete d.scriptStudioSystem;
  delete d.scriptStudioTotalEpisodes;
  delete d.scriptStudioBatchIndex;
  delete d.scriptStudioFrozenBiblesMd;
  delete d.scriptStudioFrozenBiblesOssUrl;
  delete d.scriptStudioCompletedBatchesMd;
  delete d.scriptStudioCompletedBatchesOssUrl;
  delete d.scriptStudioCharacterRows;
  delete d.sceneRows;
  delete d.scriptStudioPropRows;
  delete d.scriptStudioFrameRows;
  delete d.scriptStudioMoodRows;
  delete d.scriptStudioAudioRows;
  delete d.crewBulletin;
  delete d.scriptPublished;
  if (d.pro2TextPurpose === "story-outline") {
    d.pro2TextPurpose = "general";
  }
  return { ...starter, data: d };
}

function ensureProductionStarterBulletin(
  nodes: CanvasFlowNode[],
  meta?: CanvasGraph["meta"],
): CanvasFlowNode[] {
  if (!meta?.productionCanvas) return nodes;

  return nodes.map((n) => {
    if (n.type !== "story-pro2-starter") return n;
    const d = n.data as StoryProStarterNodeData;
    const assetId = d.workspaceIds?.linkedScriptPackageAssetId;
    if (!assetId || d.crewBulletin?.tasks?.length) return n;

    const hasRows =
      (d.scriptStudioFrameRows?.length ?? 0) > 0 ||
      (d.scriptStudioCharacterRows?.length ?? 0) > 0 ||
      Boolean(d.scriptStudioCompletedBatchesMd?.trim());
    if (!hasRows && !d.linkedScriptPackageTitle) return n;

    const { bulletin, hubFields } = crewBulletinFromScriptPackagePayload(
      assetId,
      d.linkedScriptPackageTitle ?? "剧本包",
      {
        markdown:
          d.linkedScriptPackageMarkdown ??
          d.scriptStudioCompletedBatchesMd ??
          d.generatedOutlineMd ??
          "",
        totalEpisodes: d.scriptStudioTotalEpisodes,
        scriptStudioCharacterRows: d.scriptStudioCharacterRows,
        sceneRows: d.sceneRows,
        scriptStudioPropRows: d.scriptStudioPropRows,
        scriptStudioFrameRows: d.scriptStudioFrameRows,
        scriptStudioMoodRows: d.scriptStudioMoodRows,
        scriptStudioAudioRows: d.scriptStudioAudioRows,
      },
    );

    return {
      ...n,
      data: {
        ...d,
        ...hubFields,
        crewBulletin: bulletin,
        scriptStudioMode: undefined,
      },
    };
  });
}

/** 将 starter 上的工业化剧本数据迁到 script-hub（无 hub 则新建） */
export function migrateLegacyPro2ScriptStudioGraph(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  meta?: CanvasGraph["meta"],
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  let nextNodes = ensureProductionStarterBulletin(nodes, meta);
  if (findScriptStudioHub(nextNodes)) {
    return { nodes: nextNodes, edges };
  }
  if (meta?.productionCanvas) {
    return { nodes: nextNodes, edges };
  }

  const starter = pickLegacyScriptStudioStarter(nextNodes);
  if (!starter) return { nodes: nextNodes, edges };

  const sd = starter.data as StoryProStarterNodeData;
  if (!starterHasScriptStudioWork(sd)) {
    return { nodes: nextNodes, edges };
  }

  const wsHubId = sd.workspaceIds?.scriptHubId;
  const linkedHub = wsHubId
    ? nextNodes.find((n) => n.id === wsHubId && n.type === "story-pro2-script-hub")
    : undefined;

  if (linkedHub) {
    const hubData = hubDataFromStarter(
      starter,
      linkedHub.id,
      linkedHub.data as StoryProScriptHubNodeData,
    );
    nextNodes = nextNodes.map((n) => {
      if (n.id === linkedHub.id) {
        return { ...n, data: hubData };
      }
      if (n.id === starter.id) {
        const cleared = clearStarterScriptStudio(n);
        const ws = { ...(sd.workspaceIds ?? {}), scriptHubId: linkedHub.id };
        return {
          ...cleared,
          data: { ...(cleared.data as StoryProStarterNodeData), workspaceIds: ws },
        };
      }
      return n;
    });
    return { nodes: nextNodes, edges };
  }

  const hubId = `n_${nanoid(8)}`;
  const hubData = hubDataFromStarter(starter, hubId);
  const hubNode: CanvasFlowNode = {
    id: hubId,
    type: "story-pro2-script-hub",
    position: { ...starter.position },
    width: PRO2_SCRIPT_NODE_WIDTH,
    height: PRO2_SCRIPT_NODE_HEIGHT,
    style: {
      width: PRO2_SCRIPT_NODE_WIDTH,
      height: PRO2_SCRIPT_NODE_HEIGHT,
    },
    data: hubData,
  };

  nextNodes = nextNodes.map((n) => {
    if (n.id !== starter.id) return n;
    const cleared = clearStarterScriptStudio(n);
    return {
      ...cleared,
      data: {
        ...(cleared.data as StoryProStarterNodeData),
        workspaceIds: {
          ...(sd.workspaceIds ?? {}),
          scriptHubId: hubId,
        },
      },
    };
  });
  nextNodes = [...nextNodes, hubNode];

  return { nodes: nextNodes, edges };
}
