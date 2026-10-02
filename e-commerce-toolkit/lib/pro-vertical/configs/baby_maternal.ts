import {
  PRO_SHARED_DIMENSION_TAIL,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/pro-vertical/types";

const BABY_SUB = [
  "喂养器具",
  "纸尿裤/拉拉裤",
  "宝宝洗护",
  "婴儿服饰睡袋",
  "床品寝具",
  "安全防护",
  "婴儿出行",
  "早教玩具",
  "孕妈用品",
  "母婴收纳",
] as const;

const BABY_FUNCTIONS = [
  "安全无异味",
  "亲肤柔软",
  "防漏防呛",
  "耐高温可消毒",
  "透气干爽",
  "安抚哄睡",
  "易清洗",
  "便携出行",
  "食品级材质",
] as const;

const BABY_STYLE = [
  "简约安全风",
  "居家温柔风",
  "出行便携风",
  "早教益智风",
  "轻奢精致母婴",
  "高性价比实用款",
] as const;

export const BABY_MATERNAL_CONFIG: ProVerticalConfig = {
  id: "baby_maternal",
  label: "母婴用品专业版",
  projectTitle: "母婴用品专业版",
  schemaVersion: "pro-v1",
  panelFocusLabel: "母婴展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage:
    "我将分步为你制作母婴用品带货短视频，突出安全与材质。请先上传产品图。",
  productRefAdvanceHint: "已检测到产品图。请从下方选择母婴产品子类，开始参数采集。",
  dimensionSteps: [
    { key: "styleCategory", label: "母婴产品子类", options: BABY_SUB },
    { key: "styleAttribute", label: "核心功能属性", options: BABY_FUNCTIONS, ui: "chips" },
    { key: "genderCategory", label: "风格定位", options: BABY_STYLE },
    ...PRO_SHARED_DIMENSION_TAIL.filter((s) => s.key !== "styleAttribute"),
  ],
  mirrorRoles: [
    { index: 1, role: "带娃痛点·场景引入", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "产品全貌·居家展示", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "材质工艺·安全细节", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "核心卖点·实操演示", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "真实带娃·使用场景", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "温暖收尾·定格种草", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·实操演示流量版", summary: "材质功能测试演示" },
    { id: "B", title: "B版·细节均衡全能版", summary: "外观+材质+实操+场景" },
    { id: "C", title: "C版·居家温柔氛围版", summary: "柔和育儿氛围" },
    { id: "D", title: "D版·真实生活化实拍版", summary: "宝妈居家随手拍" },
    { id: "E", title: "E版·安全质感强化版", summary: "材质做工与安全细节" },
  ],
  imagePromptCategory: "baby_maternal",
  characterRefPolicy: "optional",
  keywordDimensionKeys: ["styleCategory", "styleAttribute", "genderCategory", "customScene"],
  llmRoleName: "母婴用品AI短视频专业策划师",
  rulesDocRef: "《母婴用品品类·AI短视频生产规则手册 V1.0》",
  voiceoverTypes: [
    "痛点救场型",
    "安全材质种草型",
    "场景价值塑造型",
    "实用功能体验型",
    "宝宝体验共情型",
    "情绪共情型",
  ],
  sellpointVocabHint:
    "食品级材质、透气防漏、安全无异味、易清洗消毒、护臀安抚、便携省力",
  internalTriggerPrefix: "pro-step",
};
