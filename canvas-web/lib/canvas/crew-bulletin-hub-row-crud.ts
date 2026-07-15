import { nanoid } from "nanoid";
import type { CrewBulletinAnchor } from "./crew-bulletin-context";
import { isCrewBulletinGraphMetaAnchor } from "./crew-bulletin-context";
import { refreshCrewBulletinFromHub } from "./crew-bulletin-build";
import { patchCrewBulletinOnAnchor, type CrewBulletinPatchStore } from "./crew-bulletin-patch";
import type { CrewBulletinTask, CrewTaskKind } from "./crew-bulletin-types";
import { findCrewTaskRow } from "./crew-bulletin-task-prompts";
import { refreshGraphAnchorCrewBulletin } from "./crew-bulletin-script-package";
import { persistScriptPackageSnapshotsToAsset } from "./script-package-snapshots";
import { pushStoryRevision } from "./story-revision";
import type {
  StoryProAudioRow,
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProMoodRow,
  StoryProPropRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
  StoryRowFieldRevision,
} from "./story-pro-workspace-types";

const ROW_REVISION_MAX = 5;

/** 公告栏可增改环节（不含「剧本已定」与剧本包） */
export const CREW_BULLETIN_EDITABLE_KINDS = new Set<CrewTaskKind>([
  "character",
  "scene",
  "prop",
  "mood",
  "audio",
  "frame",
  "frameVideo",
  "dialogue",
  "composite",
]);

export function isCrewBulletinKindEditable(kind: CrewTaskKind): boolean {
  return CREW_BULLETIN_EDITABLE_KINDS.has(kind);
}

type HubRow =
  | StoryProCharacterRow
  | StoryProSceneRow
  | StoryProPropRow
  | StoryProMoodRow
  | StoryProAudioRow
  | StoryProFrameRow;

function hubFieldForKind(
  kind: CrewTaskKind,
): keyof StoryProScriptHubNodeData | null {
  switch (kind) {
    case "character":
      return "scriptStudioCharacterRows";
    case "scene":
      return "sceneRows";
    case "prop":
      return "scriptStudioPropRows";
    case "mood":
      return "scriptStudioMoodRows";
    case "audio":
      return "scriptStudioAudioRows";
    case "frame":
    case "frameVideo":
    case "dialogue":
    case "composite":
      return "scriptStudioFrameRows";
    default:
      return null;
  }
}

function readHubRows(
  hubData: StoryProScriptHubNodeData,
  field: keyof StoryProScriptHubNodeData,
): HubRow[] {
  const raw = hubData[field];
  return Array.isArray(raw) ? (raw as HubRow[]) : [];
}

function pushRowFieldRevision(
  row: HubRow,
  next: HubRow,
): HubRow {
  const snapshot: StoryRowFieldRevision = {
    savedAt: new Date().toISOString(),
    name: "name" in row ? row.name : undefined,
    description: "description" in row ? row.description : undefined,
    prompt: "prompt" in row ? row.prompt : undefined,
    appearance: "appearance" in row ? (row as StoryProCharacterRow).appearance : undefined,
    role: "role" in row ? (row as StoryProCharacterRow).role : undefined,
  };
  const prev = row.rowRevisionHistory ?? [];
  const history = [
    snapshot,
    ...prev.filter(
      (h) =>
        h.name !== snapshot.name ||
        h.description !== snapshot.description ||
        h.prompt !== snapshot.prompt,
    ),
  ].slice(0, ROW_REVISION_MAX);
  return { ...next, rowRevisionHistory: history };
}

export function createCrewBulletinHubRow(
  kind: CrewTaskKind,
  hubId: string,
): HubRow | null {
  if (!isCrewBulletinKindEditable(kind)) return null;
  const suffix = nanoid(6);
  const key = `${kind}:${hubId}::${suffix}`;
  switch (kind) {
    case "character":
      return { key, name: "新角色", role: "", appearance: "", prompt: "" };
    case "scene":
      return { key, name: "新场景", description: "", prompt: "" };
    case "prop":
      return { key, name: "新道具", description: "", prompt: "" };
    case "mood":
      return { key, name: "新氛围", description: "", prompt: "" };
    case "audio":
      return { key, name: "新音效", description: "", prompt: "" };
    case "frame":
    case "frameVideo":
    case "dialogue":
    case "composite": {
      const frameIndex =
        (kind === "frame" ? 1 : 0) + Math.floor(Math.random() * 900);
      return {
        key,
        frameIndex,
        scene: "",
        description: "",
        dialogue: "",
        videoPrompt: "",
        prompt: "",
      };
    }
    default:
      return null;
  }
}

export function patchHubRowFromTaskCells(
  hubData: StoryProScriptHubNodeData,
  hubId: string,
  task: CrewBulletinTask,
  cells: Record<string, string>,
): Partial<StoryProScriptHubNodeData> | null {
  const field = hubFieldForKind(task.kind);
  if (!field) return null;
  const rows = [...readHubRows(hubData, field)];
  const idx = rows.findIndex((r) => r.key === task.rowKey);
  const existing =
    idx >= 0
      ? rows[idx]
      : findCrewTaskRow(task, hubId, hubData) ?? null;
  if (!existing) return null;

  let next: HubRow = { ...existing };
  switch (task.kind) {
    case "character": {
      const c = next as StoryProCharacterRow;
      if (cells["名称"] !== undefined) c.name = cells["名称"].trim() || c.name;
      if (cells["定位"] !== undefined) c.role = cells["定位"].trim();
      if (cells["外观"] !== undefined) c.appearance = cells["外观"].trim();
      if (cells["提示词"] !== undefined) {
        c.prompt = cells["提示词"].trim();
        c.promptHistory = pushStoryRevision(c.promptHistory, c.prompt);
      }
      next = c;
      break;
    }
    case "scene": {
      const s = next as StoryProSceneRow;
      if (cells["名称"] !== undefined) s.name = cells["名称"].trim() || s.name;
      if (cells["环境"] !== undefined) s.description = cells["环境"].trim();
      if (cells["时间"] !== undefined) {
        const time = cells["时间"].trim();
        s.prompt = s.prompt?.includes("时间：")
          ? s.prompt.replace(/时间：[^\n]*/, `时间：${time}`)
          : `时间：${time}\n${s.prompt ?? ""}`.trim();
      }
      if (cells["氛围"] !== undefined) {
        const mood = cells["氛围"].trim();
        s.prompt = s.prompt?.includes("氛围：")
          ? s.prompt.replace(/氛围：[^\n]*/, `氛围：${mood}`)
          : `${s.prompt ?? ""}\n氛围：${mood}`.trim();
      }
      if (cells["描述"] !== undefined) s.description = cells["描述"].trim();
      s.promptHistory = pushStoryRevision(s.promptHistory, s.prompt);
      next = s;
      break;
    }
    case "prop":
    case "mood":
    case "audio": {
      const m = next as StoryProPropRow | StoryProMoodRow | StoryProAudioRow;
      if (cells["名称"] !== undefined) m.name = cells["名称"].trim() || m.name;
      if (cells["描述"] !== undefined) m.description = cells["描述"].trim();
      m.promptHistory = pushStoryRevision(m.promptHistory, m.prompt);
      next = m;
      break;
    }
    case "frame":
    case "frameVideo":
    case "dialogue":
    case "composite": {
      const f = next as StoryProFrameRow;
      if (cells["场景"] !== undefined) f.scene = cells["场景"].trim();
      if (cells["景别"] !== undefined) f.shotSize = cells["景别"].trim();
      if (cells["画面"] !== undefined) f.description = cells["画面"].trim();
      if (cells["对白"] !== undefined) f.dialogue = cells["对白"].trim();
      if (cells["视频"] !== undefined) f.videoPrompt = cells["视频"].trim();
      f.promptHistory = pushStoryRevision(f.promptHistory, f.prompt);
      next = f;
      break;
    }
    default:
      return null;
  }

  next = pushRowFieldRevision(existing, next);
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  return { [field]: rows } as Partial<StoryProScriptHubNodeData>;
}

export async function applyCrewBulletinHubRowChange(args: {
  anchor: CrewBulletinAnchor;
  hubId: string;
  hubData: StoryProScriptHubNodeData;
  hubPatch: Partial<StoryProScriptHubNodeData>;
  store: CrewBulletinPatchStore;
  bookMallBase?: string;
  graphMeta?: import("./types").CanvasGraph["meta"] | null;
}): Promise<void> {
  const { anchor, hubId, hubData, hubPatch, store, bookMallBase, graphMeta } =
    args;
  const merged = { ...hubData, ...hubPatch };

  if (isCrewBulletinGraphMetaAnchor(anchor)) {
    const metaAnchor = graphMeta?.crewBulletinAnchor;
    if (metaAnchor) {
      const nextAnchor = refreshGraphAnchorCrewBulletin({
        ...metaAnchor,
        scriptStudioCharacterRows:
          merged.scriptStudioCharacterRows ?? metaAnchor.scriptStudioCharacterRows,
        sceneRows: merged.sceneRows ?? metaAnchor.sceneRows,
        scriptStudioPropRows:
          merged.scriptStudioPropRows ?? metaAnchor.scriptStudioPropRows,
        scriptStudioFrameRows:
          merged.scriptStudioFrameRows ?? metaAnchor.scriptStudioFrameRows,
        scriptStudioMoodRows:
          merged.scriptStudioMoodRows ?? metaAnchor.scriptStudioMoodRows,
        scriptStudioAudioRows:
          merged.scriptStudioAudioRows ?? metaAnchor.scriptStudioAudioRows,
      });
      store.patchGraphMeta?.((meta) => ({
        ...meta,
        crewBulletinAnchor: nextAnchor,
      }));
      merged.crewBulletin = nextAnchor.crewBulletin;
    }
  } else {
    store.updateNodeData(hubId, hubPatch);
  }

  const fresh = refreshCrewBulletinFromHub(hubId, merged);
  patchCrewBulletinOnAnchor(anchor, fresh, store);

  const assetId = graphMeta?.crewBulletinAnchor?.linkedScriptPackageAssetId;
  if (assetId && bookMallBase?.trim()) {
    const { fetchProjectAsset, patchProjectAsset } = await import(
      "@/lib/canvas-api"
    );
    try {
      const asset = await fetchProjectAsset(bookMallBase, assetId);
      await patchProjectAsset(bookMallBase, assetId, {
        payload: {
          ...asset.payload,
          scriptStudioCharacterRows: merged.scriptStudioCharacterRows,
          sceneRows: merged.sceneRows,
          scriptStudioPropRows: merged.scriptStudioPropRows,
          scriptStudioFrameRows: merged.scriptStudioFrameRows,
          scriptStudioMoodRows: merged.scriptStudioMoodRows,
          scriptStudioAudioRows: merged.scriptStudioAudioRows,
          crewBulletin: fresh,
        },
      });
    } catch {
      /* 资产写回失败不阻断 UI */
    }
  }

  const snapshots = merged.scriptPackageSnapshots;
  if (snapshots && assetId && bookMallBase?.trim()) {
    await persistScriptPackageSnapshotsToAsset(
      bookMallBase,
      assetId,
      snapshots,
    );
  }
}

export function addCrewBulletinHubRow(
  hubData: StoryProScriptHubNodeData,
  hubId: string,
  kind: CrewTaskKind,
): Partial<StoryProScriptHubNodeData> | null {
  const field = hubFieldForKind(kind);
  const row = createCrewBulletinHubRow(kind, hubId);
  if (!field || !row) return null;
  const rows = [...readHubRows(hubData, field), row];
  return { [field]: rows } as Partial<StoryProScriptHubNodeData>;
}
