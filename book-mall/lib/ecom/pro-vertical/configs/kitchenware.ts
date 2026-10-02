import {
  PRO_SHARED_DIMENSION_TAIL,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/ecom/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/ecom/pro-vertical/types";

const KITCHEN_SUB = [
  "锅具/炒锅",
  "刀具/菜板",
  "餐具碗盘",
  "保鲜/密封",
  "厨房收纳",
  "调料器皿",
  "厨房小家电",
  "清洁工具",
  "厨具配件",
] as const;

const KITCHEN_STYLE = [
  "实用刚需",
  "极简收纳",
  "智能便捷",
  "防粘耐用",
  "安全健康",
  "轻奢质感",
  "居家精致",
] as const;

export const KITCHENWARE_CONFIG: ProVerticalConfig = {
  id: "kitchenware",
  label: "厨房用品专业版",
  projectTitle: "厨房用品专业版",
  schemaVersion: "pro-v1",
  panelFocusLabel: "厨具展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage:
    "我将分步为你制作厨房用品带货短视频全案，适配居家做饭与收纳场景。请先上传产品图。",
  productRefAdvanceHint: "已检测到产品图。请从下方选择厨房产品子类，开始参数采集。",
  dimensionSteps: [
    { key: "styleCategory", label: "厨房产品子类", options: KITCHEN_SUB },
    { key: "styleAttribute", label: "产品功能风格", options: KITCHEN_STYLE },
    ...PRO_SHARED_DIMENSION_TAIL,
  ],
  mirrorRoles: [
    { index: 1, role: "厨房痛点·场景引入", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "整体全貌·台面展示", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "细节工艺·材质特写", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "核心功能·实操演示", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "真实使用·做饭收纳", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "治愈收尾·整洁厨房", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·实操功能主导版", summary: "使用动作与功能演示，流量向" },
    { id: "B", title: "B版·细节功能均衡版", summary: "外观+细节+实操均衡" },
    { id: "C", title: "C版·居家氛围极致版", summary: "暖调治愈厨房氛围" },
    { id: "D", title: "D版·真实生活实拍版", summary: "居家随手拍接地气" },
    { id: "E", title: "E版·质感工艺强化版", summary: "材质耐用与做工特写" },
  ],
  imagePromptCategory: "kitchenware",
  characterRefPolicy: "optional",
  keywordDimensionKeys: ["styleCategory", "styleAttribute", "customScene", "platform"],
  llmRoleName: "厨房用品AI短视频专业策划师",
  rulesDocRef: "《厨房用品品类·AI短视频生产规则手册 V1.0》",
  voiceoverTypes: [
    "痛点救场型",
    "质感耐用型",
    "居家价值型",
    "实用功能种草型",
    "场景百搭型",
    "情绪体验型",
  ],
  sellpointVocabHint:
    "不粘/耐用/安全材质、易清洗、收纳省空间、便捷省力、适配灶具、尺寸容量",
  internalTriggerPrefix: "pro-step",
};
