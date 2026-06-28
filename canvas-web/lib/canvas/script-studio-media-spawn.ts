/**
 * 剧本创作 · 从 hub 内嵌 rows 一键 spawn LibTV 道具/氛围/音效媒体卡
 */
import type { CanvasFlowNode } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import type {
  StoryProAudioRow,
  StoryProMoodRow,
  StoryProPropRow,
  StoryProScriptHubNodeData,
} from "./story-pro-workspace-types";
import { findScriptStudioHub } from "./script-studio-run-apply";

type MediaKind = "prop" | "mood" | "audio";

const NODE_TYPE: Record<MediaKind, "story-pro2-prop" | "story-pro2-mood" | "story-pro2-audio"> = {
  prop: "story-pro2-prop",
  mood: "story-pro2-mood",
  audio: "story-pro2-audio",
};

type RowUnion = StoryProPropRow | StoryProMoodRow | StoryProAudioRow;

function hubRows(
  hubData: StoryProScriptHubNodeData,
  kind: MediaKind,
): RowUnion[] {
  if (kind === "prop") return hubData.scriptStudioPropRows ?? [];
  if (kind === "mood") return hubData.scriptStudioMoodRows ?? [];
  return hubData.scriptStudioAudioRows ?? [];
}

function existingMediaNodeIds(
  nodes: CanvasFlowNode[],
  kind: MediaKind,
): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    if (n.type !== NODE_TYPE[kind]) continue;
    const key = (n.data as { scriptStudioSourceRowKey?: string })
      .scriptStudioSourceRowKey;
    if (key) out.add(key);
  }
  return out;
}

export type ScriptStudioMediaSpawnResult = {
  spawned: number;
  skipped: number;
};

export function spawnScriptStudioMediaCardsFromWorkspace(args: {
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-prop" | "story-pro2-mood" | "story-pro2-audio",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  kinds?: MediaKind[];
}): ScriptStudioMediaSpawnResult {
  const kinds = args.kinds ?? (["prop", "mood", "audio"] as MediaKind[]);
  const hub = findScriptStudioHub(args.nodes);
  if (!hub) return { spawned: 0, skipped: 0 };

  const hubData = hub.data as StoryProScriptHubNodeData;
  const baseX = (hub.position?.x ?? 400) + 420;
  const baseY = hub.position?.y ?? 120;

  let spawned = 0;
  let skipped = 0;
  let yCursor = 0;

  for (const kind of kinds) {
    const rows = hubRows(hubData, kind);
    const existing = existingMediaNodeIds(args.nodes, kind);
    const nextRows = [...rows];

    for (const row of rows) {
      if (existing.has(row.key) || row.mediaNodeId) {
        skipped += 1;
        continue;
      }

      const size = NODE_DEFAULT_SIZE[NODE_TYPE[kind]];
      const nodeId = args.addNode(
        NODE_TYPE[kind],
        { x: baseX, y: baseY + yCursor },
        {
          label: row.name,
          dockInput: row.prompt?.trim() || row.description?.trim() || "",
          scriptStudioSourceRowKey: row.key,
          scriptStudioMediaKind: kind,
          hubNodeId: hub.id,
        },
      );
      yCursor += size.height + 24;

      const idx = nextRows.findIndex((r) => r.key === row.key);
      if (idx >= 0) {
        nextRows[idx] = { ...nextRows[idx], mediaNodeId: nodeId };
      }
      spawned += 1;
    }

    if (kind === "prop" && nextRows.length) {
      args.updateNodeData(hub.id, { scriptStudioPropRows: nextRows });
    } else if (kind === "mood" && nextRows.length) {
      args.updateNodeData(hub.id, { scriptStudioMoodRows: nextRows });
    } else if (kind === "audio" && nextRows.length) {
      args.updateNodeData(hub.id, { scriptStudioAudioRows: nextRows });
    }
  }

  return { spawned, skipped };
}
