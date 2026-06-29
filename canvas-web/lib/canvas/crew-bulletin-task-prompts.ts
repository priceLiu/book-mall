import { resolveHubRowsForCrewBulletin } from "./crew-bulletin-build";
import type { CrewBulletinTask, CrewTaskKind } from "./crew-bulletin-types";
import {
  buildDefaultFrameRowPrompt,
} from "./story-column-sync";
import type {
  StoryProAudioRow,
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProMoodRow,
  StoryProPropRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
} from "./story-pro-workspace-types";
import { formatCharacterRowThreeViewPrompt } from "./three-view-prompt-rules";

export type CrewBulletinRowsContext = ReturnType<
  typeof resolveHubRowsForCrewBulletin
>;

export function resolveCrewBulletinRowsContext(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
): CrewBulletinRowsContext {
  return resolveHubRowsForCrewBulletin(hubId, hubData);
}

function findIn<T extends { key: string; name?: string }>(
  rows: T[],
  rowKey: string,
  label?: string,
): T | undefined {
  const direct = rows.find((r) => r.key === rowKey);
  if (direct) return direct;

  const nameFromKey = rowKey.includes("::")
    ? rowKey.split("::").pop()?.trim()
    : rowKey.replace(/^(scene|char|character|prop|mood|frame):/i, "").trim();

  if (label?.trim()) {
    const byLabel = rows.find((r) => r.name?.trim() === label.trim());
    if (byLabel) return byLabel;
  }

  if (nameFromKey) {
    const normalized = nameFromKey.toLowerCase();
    return rows.find((r) => {
      const name = r.name?.trim();
      if (!name) return false;
      if (name === nameFromKey) return true;
      if (r.key.endsWith(`::${name}`) || r.key.endsWith(`::${normalized}`)) {
        return true;
      }
      return false;
    });
  }

  return undefined;
}

/** 解析「标签：内容」多行文本（场景生图 prompt 等） */
export function parseCrewTaskLabeledFields(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^：:\s][^：:]*?)[：:]\s*(.+)$/);
    if (!m) continue;
    map.set(m[1]!.trim(), m[2]!.trim());
  }
  return map;
}

function sceneDetailFields(row: StoryProSceneRow): Record<string, string> {
  const labeled = parseCrewTaskLabeledFields(
    [row.prompt, row.description].filter(Boolean).join("\n"),
  );
  const description =
    row.description?.trim() &&
    !row.description.includes("环境：") &&
    !row.description.includes("时间：")
      ? row.description.trim()
      : labeled.get("描述") || labeled.get("画面") || row.description?.trim() || "";

  return {
    名称: row.name?.trim() || "",
    描述: description,
    生图: labeled.get("生图") || labeled.get("场景") || "",
    环境: labeled.get("环境") || "",
    时间: labeled.get("时间") || "",
    气氛: labeled.get("气氛") || labeled.get("氛围") || "",
  };
}

export type CrewBulletinTableColumn = {
  key: string;
  label: string;
  minWidth: string;
  /** 全屏表格列宽权重；越大越占剩余宽度 */
  grow?: number;
};

const CREW_TABLE_COLUMNS: Partial<Record<CrewTaskKind, CrewBulletinTableColumn[]>> = {
  character: [
    { key: "名称", label: "角色", minWidth: "72px", grow: 0.55 },
    { key: "定位", label: "定位", minWidth: "64px", grow: 0.45 },
    { key: "外观", label: "外观", minWidth: "160px", grow: 2.2 },
    { key: "提示词", label: "提示词", minWidth: "200px", grow: 3 },
  ],
  scene: [
    { key: "名称", label: "场景", minWidth: "80px", grow: 0.5 },
    { key: "描述", label: "描述", minWidth: "120px", grow: 1.4 },
    { key: "生图", label: "生图", minWidth: "140px", grow: 2 },
    { key: "环境", label: "环境", minWidth: "120px", grow: 1.2 },
    { key: "时间", label: "时间", minWidth: "56px", grow: 0.35 },
    { key: "气氛", label: "气氛", minWidth: "64px", grow: 0.45 },
  ],
  prop: [
    { key: "名称", label: "道具", minWidth: "80px", grow: 0.6 },
    { key: "描述", label: "描述", minWidth: "160px", grow: 3 },
  ],
  mood: [
    { key: "名称", label: "氛围", minWidth: "80px", grow: 0.6 },
    { key: "描述", label: "描述", minWidth: "160px", grow: 3 },
  ],
  audio: [
    { key: "名称", label: "音效", minWidth: "80px", grow: 0.6 },
    { key: "描述", label: "描述", minWidth: "160px", grow: 3 },
  ],
  frame: [
    { key: "名称", label: "分镜", minWidth: "72px", grow: 0.45 },
    { key: "场景", label: "场景", minWidth: "72px", grow: 0.5 },
    { key: "景别", label: "景别", minWidth: "56px", grow: 0.35 },
    { key: "画面", label: "画面", minWidth: "160px", grow: 2.5 },
    { key: "对白", label: "对白", minWidth: "120px", grow: 1.5 },
  ],
  frameVideo: [
    { key: "名称", label: "分镜", minWidth: "72px", grow: 0.45 },
    { key: "画面", label: "画面", minWidth: "160px", grow: 2.2 },
    { key: "视频", label: "视频", minWidth: "160px", grow: 2.2 },
  ],
};

export function crewBulletinTableColumns(
  taskKind: CrewTaskKind | undefined,
): CrewBulletinTableColumn[] {
  if (!taskKind) {
    return [
      { key: "名称", label: "任务", minWidth: "100px", grow: 0.6 },
      { key: "描述", label: "详情", minWidth: "160px", grow: 3 },
    ];
  }
  return (
    CREW_TABLE_COLUMNS[taskKind] ?? [
      { key: "名称", label: "任务", minWidth: "100px", grow: 0.6 },
      { key: "描述", label: "详情", minWidth: "160px", grow: 3 },
    ]
  );
}

/** 公告条表格 · 按列返回单元格文案 */
export function formatCrewTaskTableCells(
  task: CrewBulletinTask,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  ctx?: CrewBulletinRowsContext,
): Record<string, string> {
  const rowsContext = ctx ?? resolveCrewBulletinRowsContext(hubId, hubData);
  const row = findCrewTaskRow(task, hubId, hubData, rowsContext);
  if (!row) {
    return { 名称: task.label };
  }

  switch (task.kind) {
    case "character": {
      const c = row as StoryProCharacterRow;
      return {
        名称: c.name?.trim() || task.label,
        定位: c.role?.trim() || "",
        外观: c.appearance?.trim() || "",
        提示词: c.prompt?.trim() || "",
      };
    }
    case "scene":
      return sceneDetailFields(row as StoryProSceneRow);
    case "prop":
    case "mood":
    case "audio": {
      const m = row as StoryProPropRow | StoryProMoodRow | StoryProAudioRow;
      return {
        名称: m.name?.trim() || task.label,
        描述: m.description?.trim() || m.prompt?.trim() || "",
      };
    }
    case "frame":
    case "dialogue":
    case "composite": {
      const f = row as StoryProFrameRow;
      const sceneName =
        f.scene?.trim() ||
        (f.sceneRefId
          ? rowsContext.scenes.find((s) => s.key === f.sceneRefId)?.name?.trim()
          : "") ||
        "";
      return {
        名称: task.label,
        场景: sceneName,
        景别: f.shotSize?.trim() || "",
        画面: f.description?.trim() || "",
        对白: f.dialogue?.trim() || "",
      };
    }
    case "frameVideo": {
      const f = row as StoryProFrameRow;
      return {
        名称: task.label,
        画面: f.description?.trim() || "",
        视频: f.videoPrompt?.trim() || "",
      };
    }
    default:
      return { 名称: task.label };
  }
}

export function findCrewTaskRow(
  task: Pick<CrewBulletinTask, "kind" | "rowKey" | "label">,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  ctx?: CrewBulletinRowsContext,
): StoryProCharacterRow | StoryProSceneRow | StoryProPropRow | StoryProMoodRow | StoryProAudioRow | StoryProFrameRow | undefined {
  const rows = ctx ?? resolveCrewBulletinRowsContext(hubId, hubData);
  switch (task.kind) {
    case "character":
      return findIn(rows.characters, task.rowKey, task.label);
    case "scene":
      return findIn(rows.scenes, task.rowKey, task.label);
    case "prop":
      return findIn(rows.props, task.rowKey, task.label);
    case "mood":
      return findIn(rows.moods, task.rowKey, task.label);
    case "audio":
      return findIn(rows.audios, task.rowKey, task.label);
    case "frame":
    case "frameVideo":
    case "dialogue":
    case "composite":
      return findIn(rows.frames, task.rowKey, task.label);
    default:
      return undefined;
  }
}

export function characterCrewTaskDockInput(row: StoryProCharacterRow): string {
  const prompt = row.prompt?.trim();
  if (prompt) return prompt;
  return formatCharacterRowThreeViewPrompt({
    name: row.name?.trim() || "角色",
    role: row.role?.trim() || "",
    appearance: row.appearance?.trim() || "",
  });
}

export function sceneCrewTaskDockInput(row: StoryProSceneRow): string {
  const prompt = row.prompt?.trim();
  if (prompt) return prompt;
  const desc = row.description?.trim();
  if (desc) {
    return row.name?.trim()
      ? `场景：${row.name.trim()}\n画面：${desc}`
      : desc;
  }
  return row.name?.trim() || "";
}

export function frameCrewTaskDockInput(row: StoryProFrameRow): string {
  return (
    row.prompt?.trim() ||
    buildDefaultFrameRowPrompt(row) ||
    row.videoPrompt?.trim() ||
    row.description?.trim() ||
    row.dialogue?.trim() ||
    ""
  );
}

export function mediaCrewTaskDockInput(
  row: { prompt?: string; description?: string; name?: string },
  fallback = "",
): string {
  return row.prompt?.trim() || row.description?.trim() || row.name?.trim() || fallback;
}

/** 领取后在节点 Dock 使用的完整提示词（与批量三视图/场景/分镜一致） */
export function resolveCrewTaskDockInput(
  task: CrewBulletinTask,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  ctx?: CrewBulletinRowsContext,
): string {
  const row = findCrewTaskRow(task, hubId, hubData, ctx);
  if (!row) return task.label;

  switch (task.kind) {
    case "character":
      return characterCrewTaskDockInput(row as StoryProCharacterRow);
    case "scene":
      return sceneCrewTaskDockInput(row as StoryProSceneRow);
    case "frame":
    case "frameVideo":
    case "dialogue":
    case "composite":
      return frameCrewTaskDockInput(row as StoryProFrameRow);
    case "prop":
    case "mood":
    case "audio":
      return mediaCrewTaskDockInput(row as StoryProPropRow, task.label);
    default:
      return task.label;
  }
}

/** 公告条任务列表 · 展示剧本中的完整设定摘要 */
export function formatCrewTaskDetailText(
  task: CrewBulletinTask,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  ctx?: CrewBulletinRowsContext,
): string {
  const row = findCrewTaskRow(task, hubId, hubData, ctx);
  if (!row) return "";

  switch (task.kind) {
    case "character": {
      const c = row as StoryProCharacterRow;
      return [
        c.role?.trim() ? `定位：${c.role.trim()}` : "",
        c.appearance?.trim() ? `外观：${c.appearance.trim()}` : "",
        c.prompt?.trim() ? `提示词：${c.prompt.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "scene": {
      const s = row as StoryProSceneRow;
      const fields = sceneDetailFields(s);
      return [
        fields.描述 ? `描述：${fields.描述}` : "",
        fields.生图 ? `生图：${fields.生图}` : "",
        fields.环境 ? `环境：${fields.环境}` : "",
        fields.时间 ? `时间：${fields.时间}` : "",
        fields.气氛 ? `气氛：${fields.气氛}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "prop":
    case "mood":
    case "audio": {
      const m = row as StoryProPropRow | StoryProMoodRow | StoryProAudioRow;
      return m.description?.trim() ? `描述：${m.description.trim()}` : "";
    }
    case "frame":
    case "frameVideo":
    case "dialogue":
    case "composite": {
      const f = row as StoryProFrameRow;
      return [
        f.scene?.trim() ? `场景：${f.scene.trim()}` : "",
        f.shotSize?.trim() ? `景别：${f.shotSize.trim()}` : "",
        f.description?.trim() ? `画面：${f.description.trim()}` : "",
        f.dialogue?.trim() ? `对白：${f.dialogue.trim()}` : "",
        f.videoPrompt?.trim() ? `视频：${f.videoPrompt.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    default:
      return "";
  }
}
