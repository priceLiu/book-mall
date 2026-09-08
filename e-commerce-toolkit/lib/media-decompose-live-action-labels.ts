/** 与 book-mall ecom-media-decompose-structured LIVE_ACTION_REPLICATION_FIELD_LABELS 保持一致 */
export const LIVE_ACTION_REPLICATION_FIELD_KEYS = [
  "sceneSetup",
  "talentBlocking",
  "compositionFraming",
  "cameraPlacement",
  "lightingSetup",
  "props",
  "cameraParams",
  "postProcessing",
  "shootingChecklist",
] as const;

export type LiveActionReplicationFieldKey =
  (typeof LIVE_ACTION_REPLICATION_FIELD_KEYS)[number];

export const LIVE_ACTION_REPLICATION_FIELD_LABELS: Record<
  LiveActionReplicationFieldKey,
  string
> = {
  sceneSetup: "场景搭建",
  talentBlocking: "人物走位与造型",
  compositionFraming: "构图与取景",
  cameraPlacement: "机位",
  lightingSetup: "灯光布置",
  props: "道具与服装",
  cameraParams: "相机参数",
  postProcessing: "后期调色",
  shootingChecklist: "拍摄步骤清单",
};
