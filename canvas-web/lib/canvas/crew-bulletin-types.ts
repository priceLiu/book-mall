/** 剧组公告条 · 任务种类 */
export type CrewTaskKind =
  | "script"
  | "character"
  | "scene"
  | "prop"
  | "mood"
  | "audio"
  | "frame"
  | "frameVideo"
  | "dialogue"
  | "composite";

/** 任务状态（预留 review / blocked） */
export type CrewTaskStatus =
  | "unclaimed"
  | "claimed"
  | "generating"
  | "done"
  | "review"
  | "blocked";

export type CrewBulletinTask = {
  id: string;
  kind: CrewTaskKind;
  rowKey: string;
  label: string;
  episodeNo?: number;
  frameIndex?: number;
  status: CrewTaskStatus;
  assigneeUserId?: string;
  assigneeDisplayName?: string;
  /** 领取后在画布上生成的工作节点 id */
  canvasNodeId?: string;
  claimedAt?: string;
  completedAt?: string;
};

export type CrewBulletinState = {
  publishedAt: string;
  publishedBy?: string;
  hubNodeId: string;
  scriptTitle: string;
  totalEpisodes: number;
  tasks: CrewBulletinTask[];
};

export const CREW_BULLETIN_KIND_LABELS: Record<CrewTaskKind, string> = {
  script: "剧本",
  character: "角色",
  scene: "场景",
  prop: "道具",
  mood: "氛围",
  audio: "音效",
  frame: "分镜图",
  frameVideo: "分镜视频",
  dialogue: "对白",
  composite: "合成",
};

export const CREW_TASK_STATUS_LABELS: Record<CrewTaskStatus, string> = {
  unclaimed: "未领取",
  claimed: "已领取",
  generating: "生成中",
  done: "完成",
  review: "待审阅",
  blocked: "阻塞",
};

export function crewTaskId(
  kind: CrewTaskKind,
  rowKey: string,
  episodeNo?: number,
  frameIndex?: number,
): string {
  if (kind === "frame" && episodeNo != null && frameIndex != null) {
    return `frame:${episodeNo}:${frameIndex}:${rowKey}`;
  }
  return `${kind}:${rowKey}`;
}
