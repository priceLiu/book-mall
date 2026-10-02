import {
  PRO_SHARED_DIMENSION_TAIL,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/pro-vertical/types";

const LOUNGE_TYPES = [
  "睡衣套装",
  "家居套装",
  "浴袍",
  "睡裙",
  "居家开衫",
  "软家居裤",
] as const;

export const LOUNGEWEAR_CONFIG: ProVerticalConfig = {
  id: "loungewear",
  label: "家居服专业版",
  projectTitle: "家居服专业版",
  schemaVersion: "pro-v1",
  panelFocusLabel: "家居服展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage: "我将分步为你制作家居服带货短视频，强调居家亲肤与上身治愈感。请先上传产品图。",
  productRefAdvanceHint: "已检测到产品图。请从下方选择家居服品类，开始参数采集。",
  dimensionSteps: [
    { key: "styleCategory", label: "家居服品类", options: LOUNGE_TYPES },
    ...PRO_SHARED_DIMENSION_TAIL,
  ],
  mirrorRoles: [
    { index: 1, role: "居家痛点·场景引入", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "整体全貌·平铺挂拍", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "面料走线·细节特写", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "上身居家·伸展走动", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "卧室客厅·治愈场景", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "收尾定格·完整种草", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·上身治愈版", summary: "居家上身放松状态" },
    { id: "B", title: "B版·细节均衡版", summary: "全貌+面料+上身" },
    { id: "C", title: "C版·暖光氛围版", summary: "暖调卧室氛围" },
    { id: "D", title: "D版·居家实拍版", summary: "真实居家随手拍" },
    { id: "E", title: "E版·面料特写版", summary: "亲肤面料微距" },
  ],
  imagePromptCategory: "loungewear",
  characterRefPolicy: "required",
  keywordDimensionKeys: ["styleCategory", "styleAttribute", "platform", "customScene"],
  llmRoleName: "家居服AI短视频专业策划师",
  rulesDocRef: "《家居服品类·AI短视频生产规则手册 V1.0》",
  voiceoverTypes: [
    "痛点救场型",
    "亲肤舒适型",
    "场景居家型",
    "质感种草型",
    "百搭外穿型",
    "情绪放松型",
  ],
  sellpointVocabHint: "亲肤透气、软感面料、不起球、版型宽松、四季适用、治愈配色",
  internalTriggerPrefix: "pro-step",
};
