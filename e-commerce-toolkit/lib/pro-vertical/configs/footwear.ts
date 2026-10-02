import {
  PRO_SHARED_DIMENSION_TAIL,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/pro-vertical/types";

const SHOE_TYPES = [
  "运动鞋",
  "休闲鞋",
  "板鞋",
  "靴",
  "凉鞋",
  "拖鞋",
  "童鞋",
  "功能/劳保鞋",
] as const;

export const FOOTWEAR_CONFIG: ProVerticalConfig = {
  id: "footwear",
  label: "鞋子专业版",
  projectTitle: "鞋子专业版",
  schemaVersion: "pro-v1",
  panelFocusLabel: "鞋类展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage: "我将分步为你制作鞋类带货短视频，强调上脚与走步演示。请先上传产品图。",
  productRefAdvanceHint: "已检测到产品图。请从下方选择鞋类品类，开始参数采集。",
  dimensionSteps: [
    { key: "styleCategory", label: "鞋类品类", options: SHOE_TYPES },
    ...PRO_SHARED_DIMENSION_TAIL,
  ],
  mirrorRoles: [
    { index: 1, role: "穿鞋痛点·场景引入", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "整体全貌·鞋型轮廓", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "材质鞋底·工艺特写", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "上脚走步·弯折演示", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "穿搭场景·日常出街", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "收尾定格·种草闭环", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·上脚动感版", summary: "走步转身展示" },
    { id: "B", title: "B版·细节均衡版", summary: "全貌+上脚+特写" },
    { id: "C", title: "C版·街头场景版", summary: "街景/通勤场景" },
    { id: "D", title: "D版·日常实拍版", summary: "真实穿搭随手拍" },
    { id: "E", title: "E版·鞋底工艺版", summary: "鞋底缓震结构特写" },
  ],
  imagePromptCategory: "footwear",
  characterRefPolicy: "required",
  keywordDimensionKeys: ["styleCategory", "styleAttribute", "platform", "customScene"],
  llmRoleName: "鞋类AI短视频专业策划师",
  rulesDocRef: "《鞋子品类·AI短视频生产规则手册 V1.0》",
  voiceoverTypes: [
    "痛点救场型",
    "缓震舒适型",
    "场景百搭型",
    "质感做工型",
    "功能防护型",
    "情绪自信型",
  ],
  sellpointVocabHint: "缓震、透气、防滑、跟脚、鞋底材质、轻便、耐磨、增高显腿长",
  internalTriggerPrefix: "pro-step",
};
