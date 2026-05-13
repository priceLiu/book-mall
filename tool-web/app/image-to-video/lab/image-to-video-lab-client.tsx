"use client";

/* 图生 / 参考生 / 文生视频 · 实验室 — DashScope（北京） */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Check,
  ChevronsUpDown,
  Clapperboard,
  Dices,
  Download,
  Eye,
  Film,
  ImagePlus,
  Images,
  Info,
  RefreshCw,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { ToolChargeSubmitButton } from "@/components/ui/tool-charge-submit-button";
import { formatDashScopeI2vFailureForUser } from "@/lib/image-to-video-task-errors";
import {
  DEFAULT_IMAGE_TO_VIDEO_MODEL_ID,
  DEFAULT_TEXT_TO_VIDEO_MODEL_ID,
  getImageToVideoModelById,
  getTextToVideoModelById,
  IMAGE_TO_VIDEO_MODELS,
  TEXT_TO_VIDEO_MODELS,
} from "@/lib/image-to-video-models";
import { cn } from "@/lib/utils";
import ttiStyles from "../../text-to-image/text-to-image-modal.module.css";

const SEED_TOOLTIP = "随机数种子，用于控制模型生成内容的随机性";

function randomSeedString(): string {
  return String(Math.floor(Math.random() * 1_000_000_000));
}

type ExamplePreset = {
  id: string;
  src: string;
  label: string;
  prompt: string;
  /** 参考生视频：角标数字，表示点选后填入的参考图张数（默认 1） */
  refSlotCount?: number;
  /** 参考生视频：多张参考图 URL 路径（与 refSlotCount 一致）；缺省为 [src] */
  refSrcs?: string[];
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 图生视频 · 示例（与参考生隔离） */
const I2V_EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    id: "ex-v1",
    src: "/images/v1.png",
    label: "示例 1",
    prompt: [
      "【镜头一 · 0–4秒】 画面从头盔玻璃面罩内侧的水雾与光斑缓缓对焦——那些光点像是遥远星系的残影，或是某种正在消逝的记忆。红色警报光在她脸上有节律地扫过，将她的皮肤染成深红与暗影交替的律动。她的眼睛紧闭，睫毛轻轻颤动，像是在黑暗中接收某种只有她能听见的频率。镜头以极慢速度贴近面罩玻璃，试图穿透那层透明的屏障。",
      "【镜头二 · 4–8秒】 她缓缓睁开眼睛。但眼神不是向外看的——而是向内，像是在看自己内心某个正在坍塌或重建的宇宙。镜头切入面罩玻璃表面的反射：在那层玻璃的倒影里，出现了一片星空——不是这个舱室，而是某个遥远的、她曾经见过或梦见过的地方。红色光芒突然增强，她的手抬起，指尖触碰面罩——从外侧，像是有另一只手在回应。",
      "【镜头三 · 8–12秒】 快切至极近景：她的眼睛里，星空的倒影在瞳孔中燃烧。镜头缓慢旋转，像一颗卫星在她的轨道上运行。面罩玻璃上的水雾开始在红光中蒸发，露出她脸上细微的表情变化——不是恐惧，是某种比恐惧更深的东西：认命，或者，领悟。",
      "【镜头四 · 12–15秒】 镜头骤然拉远，穿越面罩玻璃向外——她的整个头盔变成画面中一个渺小的球体，背景中红色警报光渐渐熄灭，取而代之的是一片深邃的、无边的蓝黑色静默。她的手慢慢放下。画面在这片静默中切黑——只留下一声极其微弱的、像心跳又像信号的电子脉冲声。 色调：深红预警 × 冷蓝深空 × 琥珀肤光。镜头如呼吸般起伏，克制而充满张力。",
    ].join(" "),
  },
  {
    id: "ex-v2",
    src: "/images/v2.png",
    label: "示例 2",
    prompt:
      "广角镜头，电影级镜头。热气球正在高空飞行。镜头缓慢向猫咪推进。猫咪的毛发被风吹得剧烈飘动，它转头看了一下周围的风景。背景的绿色山丘和云层向后移动，产生强烈的空间纵深感。光影斑驳变化，高帧率，吉卜力画风。",
  },
  {
    id: "ex-v3",
    src: "/images/v3.png",
    label: "示例 3",
    prompt:
      "The camera slowly pushes into the astronaut's reflective gold visor, where a miniature world is revealed — the lunar surface and the distant lunar module reflected in breathtaking clarity, like a universe trapped within glass. The camera then eases back as the astronaut takes a single slow, weighted step forward, lunar dust rising in ultra-slow motion under low gravity, each particle catching sunlight like scattered golden sparks. The camera dives low to capture the deep bootprint pressed into the regolith — a mark of history carved into silence. Finally, the shot pulls back and upward to reveal the astronaut's full silhouette against the infinite black cosmos, with a faint blue glow of Earth hovering in the far distance. The entire sequence carries a cinematic film-grain aesthetic, cold and sacred in tone, with subtle handheld camera tremors evoking the rawness of authentic documentary footage.",
  },
  {
    id: "ex-v4",
    src: "/images/v4.png",
    label: "示例 4",
    prompt:
      "The camera slowly pushes into the astronaut's reflective gold visor, where a miniature world is revealed — the lunar surface and the distant lunar module reflected in breathtaking clarity, like a universe trapped within glass. The camera then eases back as the astronaut takes a single slow, weighted step forward, lunar dust rising in ultra-slow motion under low gravity, each particle catching sunlight like scattered golden sparks. The camera dives low to capture the deep bootprint pressed into the regolith — a mark of history carved into silence. Finally, the shot pulls back and upward to reveal the astronaut's full silhouette against the infinite black cosmos, with a faint blue glow of Earth hovering in the far distance. The entire sequence carries a cinematic film-grain aesthetic, cold and sacred in tone, with subtle handheld camera tremors evoking the rawness of authentic documentary footage.",
  },
  {
    id: "ex-v5",
    src: "/images/v5.jpg",
    label: "示例 5",
    prompt:
      "The cute teddy bear as it briskly walks forward across the train station platform, pulling its brown suitcase behind it with a sense of urgency. The bear's mouth moves in perfect lip-sync as it hurriedly says: 'There's no time left, I'm going to be late!' Its expression should appear anxious and determined. In the background, other passengers and the trains should have subtle, natural movements to reflect a busy station atmosphere. The camera follows the bear with a smooth forward tracking shot, maintaining its soft, fuzzy texture and the realistic cinematic lighting from the original image.",
  },
];

/** 参考生视频 · 多图示例 + 与图生相同的 v1–v5（单张 ref） */
const PRESET_EX_CANKAO_QIPAO: ExamplePreset = {
  id: "ex-cankao-qipao",
  src: "/images/cankao1.jpg",
  label: "示例 · 旗袍",
  refSlotCount: 3,
  refSrcs: [
    "/images/cankao1.jpg",
    "/images/cankao1_2.png",
    "/images/cankao1_3.png",
  ],
  prompt:
    "身着红色旗袍的女性character1，镜头先以侧面中景勾勒旗袍修身剪裁与S型曲线，随即切换至低角度仰拍，捕捉她轻抬玉手展开折扇character2时流苏耳坠character3随头部转动轻盈摆动的细节，最后推近至面部特写，定格在她指尖轻点扇骨、眼波流转间的含蓄风情，多视角全方位展现东方韵味。",
};

const PRESET_EX_CANKAO2_PIXAR: ExamplePreset = {
  id: "ex-cankao2-pixar",
  src: "/images/cankao2_1.png",
  label: "示例 · 皮克斯办公",
  refSlotCount: 4,
  refSrcs: [
    "/images/cankao2_1.png",
    "/images/cankao2_2.png",
    "/images/cankao2_3.png",
    "/images/cankao2_4.png",
  ],
  prompt:
    "生成一段皮克斯视频：镜头围绕办公桌前的女孩环绕运镜，女孩正坐在电脑前若有所思character1，过程中切镜，特写女孩的脸部特写character2，女孩的表情体现出百思不得其解的状态，而突然女孩眼前一亮，脸上立刻舒展浮现出惊喜的笑意character3，体现出女孩想到了一个好主意，而此时镜头继续环绕运镜，女孩思考得到答案后，开心的把脚翘到办公桌上并双手抱在脑后character4，体现出她非常愉悦放松的状态和心情。",
};

const PRESET_EX_CANKAO3_PODCAST: ExamplePreset = {
  id: "ex-cankao3-podcast",
  src: "/images/cankao3_1.png",
  label: "示例 · 播客双宠",
  refSlotCount: 3,
  refSrcs: [
    "/images/cankao3_1.png",
    "/images/cankao3_2.png",
    "/images/cankao3_3.png",
  ],
  prompt: [
    "一张超逼真的4K摄影级画面，场景设定为潮流感满满的播客录音间。背景为蓝灰色几何拼接声学泡沫墙，两侧专业补光灯从侧前方柔和打亮主体，阴影过渡自然无塑料感。构图采用对称式双人中景，视觉重心稳定于深色实木直播桌后方。桌面摆放两只印有宠物爪印图案的陶瓷咖啡杯，整体氛围拟人化、网感十足，毛发纹理根根分明，材质反射符合物理光学规律。画面左侧是一只戴着潮酷黑框墨镜、挂着金色项链的橘白英短猫，端坐在复古做旧皮质主播椅上，面前摆着黑色专业麦克风，前爪自然交叠搭在桌沿，表情拽酷又带点傲娇。画面右侧是一只戴着街头风棒球帽、耳朵上别着银色耳钉的棕色柴犬，同样坐于同款主播椅，正对着麦克风咧嘴笑，露出治愈系犬齿character1。双宠手肘均轻搭桌面，形成稳定的双人主播站位，镜头焦点锐利锁定面部与麦克风区域。",
    "基于此高精度底图进行动态口型驱动与表演设计：身份定位为宠物界“吐槽搭子”，对话主题围绕《铲屎官那些“自我感动”的迷惑行为》展开。角色人设与情绪分配明确：猫（橘白英短）担任毒舌吐槽役，语速稍快，情绪带着不屑与嘲讽character2；狗（柴犬）担任呆萌提问役，语速适中，情绪充满疑惑与好奇。对话片段示例如下——狗：“主人天天给我买新玩具，转头又说我拆家费钱，这啥逻辑啊？”猫：“傻狗，这叫‘既要展示爱心，又要卖惨博同情’，人类的套路罢了～”合：“哈哈哈哈哈哈！”character3。动作与交互细节需严格同步：狗说话时会配合轻微歪头与快速眨眼，猫吐槽时会伴随尾巴轻甩、偶尔翻个白眼；两宠对话期间保持高频眼神交汇与头部微转，肢体节奏高度同步。口型驱动时需确保唇部开合幅度与台词重音精准匹配，结尾大笑段面部肌肉运动自然流畅不穿模，整体呈现高同步率的拟真搭档感。",
  ].join("\n\n"),
};

const PRESET_EX_CANKAO4_SCIFI: ExamplePreset = {
  id: "ex-cankao4-scifi",
  src: "/images/cankao4_1.png",
  label: "示例 · 科幻对白",
  refSlotCount: 3,
  refSrcs: [
    "/images/cankao4_1.png",
    "/images/cankao4_2.png",
    "/images/cankao4_3.png",
  ],
  prompt:
    "电影质感，智能分镜，动作流畅自然，画面无崩坏。分镜1（近景3秒）侧面跟拍character3。两人起身行走，少女character2突然停下脚步翻了个白眼，无情拆台说：“就我们？别人早都跑没了影。”分镜2（中景4秒）平视。少年character1凑近半步，压低声音提议说到：“要不咱直接撂挑子跑路归隐？”分镜3（近景3秒）平视。少女抬手戳了戳他的胳膊，一脸无语回怼说：“跑？哪能这么便宜了他们？”分镜4（中景5秒）正面平视。少年瞬间蔫了，少女绷着脸补刀回应说：“收收你的垮脸，组织监控正对着咱呢。”",
};

const PRESET_EX_CANKAO5_INKWASH: ExamplePreset = {
  id: "ex-cankao5-inkwash",
  src: "/images/cankao5_1.png",
  label: "示例 · 金墨长卷",
  refSlotCount: 3,
  refSrcs: [
    "/images/cankao5_1.png",
    "/images/cankao5_2.png",
    "/images/cankao5_3.png",
  ],
  prompt:
    "0-3s特写：白鹭伫立于梅枝之上，金底水墨风。白鹭突然扇动翅膀，梅花花瓣随风飘散，它眼神灵动地看向画外character1。古琴声悠扬，伴随花瓣飘落的轻柔气流声。3-6s镜头平滑过渡，画面切至池塘，金鱼游动。两条锦鲤在水面打闹嬉戏，尾巴划出金色涟漪，惊扰了枝头落下的花瓣character2。鱼儿破水的“噗通”声，伴随水滴落下的清脆“叮咚”声。6-8s画面色调转暖，切换至荷塘，鸳鸯戏水。鸳鸯在金色的荷塘里惬意划水，其中一只调皮地向另一只喷了一口水花character3。欢快的节奏点，伴随戏水的声效，显得温馨有趣。8-10s三幅画卷拼接成一幅完整的长卷，白鹭飞入画卷，画面化为水墨流光。所有画中角色同时向镜头挥手致意，画面渐隐为“万物生长”。结尾融入清脆的鸟鸣与欢快的定格音。",
};

const REF_EXAMPLE_PRESETS: ExamplePreset[] = [
  PRESET_EX_CANKAO_QIPAO,
  PRESET_EX_CANKAO2_PIXAR,
  PRESET_EX_CANKAO3_PODCAST,
  PRESET_EX_CANKAO4_SCIFI,
  PRESET_EX_CANKAO5_INKWASH,
  ...I2V_EXAMPLE_PRESETS,
];

const EXAMPLE_ROW_SLICE = 5;

type LabModeTab = "i2v" | "t2v" | "ref";
type ResultFilter = "all" | "i2v" | "t2v" | "ref";

/** 参考生视频网格：最多 9 张图（与官方 API 一致）+ 1 个上传格 */
const REF_GRID_MAX_IMAGES = 9;

const REF_RATIO_OPTIONS = [
  "16:9",
  "9:16",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "1:1",
] as const;

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function readFileAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("读取图片失败"));
    r.readAsDataURL(f);
  });
}

function presetRefSources(p: ExamplePreset): string[] {
  const raw = p.refSrcs?.length ? p.refSrcs : [p.src];
  return raw.slice(0, REF_GRID_MAX_IMAGES);
}

function presetRefBadgeCount(p: ExamplePreset): number {
  if (typeof p.refSlotCount === "number") return p.refSlotCount;
  return presetRefSources(p).length;
}

const POLL_MS = 12_000;
const MAX_POLLS = 55;

async function loadImageAsDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error("无法读取首帧图片，请重试或换一张示例图");
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("读取图片失败"));
    r.readAsDataURL(blob);
  });
}

function taskStatusZh(st: string): string {
  switch (st) {
    case "PENDING":
      return "排队中";
    case "RUNNING":
      return "生成中";
    case "SUCCEEDED":
      return "已完成";
    case "FAILED":
      return "失败";
    case "CANCELED":
      return "已取消";
    case "UNKNOWN":
      return "未知";
    default:
      return st || "处理中";
  }
}

type TaskPollOutput = {
  task_id?: string;
  task_status?: string;
  video_url?: string;
  message?: string;
  code?: string;
};

async function readJsonBody<T>(res: Response): Promise<
  { ok: true; data: T } | { ok: false; message: string }
> {
  const text = await res.text();
  if (!text.trim()) {
    return { ok: false, message: `接口返回空内容（HTTP ${res.status}）` };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      message: `响应不是 JSON（HTTP ${res.status}）：${text.slice(0, 160).replace(/\s+/g, " ")}`,
    };
  }
}

function formatYuanForUi(yuan: number): string {
  const cents = Math.round(yuan * 100);
  if (!Number.isFinite(cents)) return "—";
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "");
}

type LabJob = {
  id: string;
  mode: LabModeTab;
  videoUrl: string;
  prompt: string;
  resolution: "720P" | "1080P";
  durationSec: number;
  seed: string;
  doneAtLabel: string;
  settleHint: string | null;
  modelLabel: string;
};

export function ImageToVideoLabClient() {
  const [modeTab, setModeTab] = useState<LabModeTab>("i2v");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [i2vExamplePresets, setI2vExamplePresets] = useState<ExamplePreset[]>(() =>
    I2V_EXAMPLE_PRESETS.slice(0, EXAMPLE_ROW_SLICE),
  );
  const [i2vExampleSelectedId, setI2vExampleSelectedId] = useState<string | null>(null);
  const [refExamplePresets, setRefExamplePresets] = useState<ExamplePreset[]>(() =>
    REF_EXAMPLE_PRESETS.slice(0, EXAMPLE_ROW_SLICE),
  );
  const [refExampleSelectedId, setRefExampleSelectedId] = useState<string>(
    REF_EXAMPLE_PRESETS[0]!.id,
  );
  const [t2vExampleSelectedId, setT2vExampleSelectedId] = useState<string | null>(null);
  const examplePresets =
    modeTab === "ref" ? refExamplePresets : i2vExamplePresets;

  /** 首帧：仅图生；null = 空态（与参考生一致，不默认套用示例图） */
  const [i2vFirstFrameSrc, setI2vFirstFrameSrc] = useState<string | null>(null);

  const [promptI2v, setPromptI2v] = useState("");
  const [promptRef, setPromptRef] = useState("");
  const [promptT2v, setPromptT2v] = useState("");

  const [resolution, setResolution] = useState<"720P" | "1080P">("1080P");
  const [durationSec, setDurationSec] = useState(5);
  const [seed, setSeed] = useState("1234");
  const [jobs, setJobs] = useState<LabJob[]>([]);
  const [generatingRemoteStatus, setGeneratingRemoteStatus] = useState("");
  const [flowError, setFlowError] = useState<string | null>(null);
  const [generatingBusy, setGeneratingBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refGridFileRef = useRef<HTMLInputElement>(null);
  const refGridUploadTargetRef = useRef<"append" | number>("append");
  const [refImages, setRefImages] = useState<string[]>([]);
  const [refPreviewSrc, setRefPreviewSrc] = useState<string | null>(null);
  const [dragOverI2v, setDragOverI2v] = useState(false);
  const [dragOverRefPanel, setDragOverRefPanel] = useState(false);
  const [refRatio, setRefRatio] = useState<string>("16:9");
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_IMAGE_TO_VIDEO_MODEL_ID);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const [generatingModelLabel, setGeneratingModelLabel] = useState("");
  const [billableYuan, setBillableYuan] = useState<number | null>(null);

  const { chargeLine, chargeTitle } = useMemo(() => {
    if (billableYuan != null) {
      const y = formatYuanForUi(billableYuan);
      return {
        chargeLine: `生成 1 个视频，扣费 ${y} 元`,
        chargeTitle: `单次生成按 ${y} 元/次从工具账户扣费（与主站「工具管理」标价一致）。`,
      };
    }
    return {
      chargeLine: "生成 1 个视频，扣费以主站「工具管理」标价为准",
      chargeTitle:
        "单次生成按主站「工具管理」配置的按次单价扣费；标价加载失败时请刷新页面或查看管理后台。",
    };
  }, [billableYuan]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/image-to-video/billable-hint", {
          credentials: "same-origin",
        });
        const j = (await r.json().catch(() => ({}))) as { yuan?: number };
        if (!cancelled && r.ok && typeof j.yuan === "number") {
          setBillableYuan(j.yuan);
        }
      } catch {
        /* 标价仅影响展示，计费以主站结算为准 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedModel = useMemo(() => {
    if (modeTab === "t2v") {
      return getTextToVideoModelById(selectedModelId) ?? TEXT_TO_VIDEO_MODELS[0]!;
    }
    return getImageToVideoModelById(selectedModelId) ?? IMAGE_TO_VIDEO_MODELS[0]!;
  }, [modeTab, selectedModelId]);

  const visibleJobs = useMemo(() => {
    return jobs.filter(
      (j) => resultFilter === "all" || j.mode === resultFilter,
    );
  }, [jobs, resultFilter]);

  useEffect(() => {
    if (!i2vExampleSelectedId) return;
    if (i2vExamplePresets.some((p) => p.id === i2vExampleSelectedId)) return;
    setI2vExampleSelectedId(null);
  }, [i2vExamplePresets, i2vExampleSelectedId]);

  useEffect(() => {
    if (refExamplePresets.some((p) => p.id === refExampleSelectedId)) return;
    setRefExampleSelectedId(refExamplePresets[0]!.id);
  }, [refExamplePresets, refExampleSelectedId]);

  useEffect(() => {
    if (!modelPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (modelPickerRef.current?.contains(e.target as Node)) return;
      setModelPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [modelPickerOpen]);

  const ingestI2vFile = useCallback((f: File) => {
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(f.type)) {
      setFlowError("请上传 JPEG、PNG 或 WebP 图片");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setFlowError("首帧图片需不超过 20MB（见官方文档限制）");
      return;
    }
    void readFileAsDataUrl(f)
      .then((url) => {
        setFlowError(null);
        setI2vFirstFrameSrc(url);
        setI2vExampleSelectedId(null);
      })
      .catch(() => setFlowError("读取图片失败"));
  }, []);

  const ingestRefFilesAppend = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) =>
      /^image\/(jpeg|jpg|png|webp)$/i.test(f.type),
    );
    if (files.length === 0) {
      setFlowError("请使用 JPEG、PNG 或 WebP 图片");
      return;
    }
    const urls: string[] = [];
    for (const f of files) {
      if (f.size > MAX_IMAGE_BYTES) {
        setFlowError("单张图片需不超过 20MB（见官方文档限制）");
        return;
      }
      try {
        urls.push(await readFileAsDataUrl(f));
      } catch {
        setFlowError("读取图片失败");
        return;
      }
    }
    setFlowError(null);
    setRefImages((prev) => {
      const next = [...prev];
      for (const url of urls) {
        if (next.length >= REF_GRID_MAX_IMAGES) break;
        next.push(url);
      }
      return next;
    });
  }, []);

  const refreshExamples = useCallback(() => {
    if (modeTab === "ref") {
      const next = shuffle([...REF_EXAMPLE_PRESETS]).slice(0, EXAMPLE_ROW_SLICE);
      setRefExamplePresets(next);
      const first = next[0]!;
      setRefExampleSelectedId(first.id);
      setRefImages([]);
    } else if (modeTab === "i2v") {
      const next = shuffle([...I2V_EXAMPLE_PRESETS]).slice(0, EXAMPLE_ROW_SLICE);
      setI2vExamplePresets(next);
      setI2vExampleSelectedId(null);
      setI2vFirstFrameSrc(null);
    } else {
      const next = shuffle([...I2V_EXAMPLE_PRESETS]).slice(0, EXAMPLE_ROW_SLICE);
      setI2vExamplePresets(next);
      setT2vExampleSelectedId(null);
    }
  }, [modeTab]);

  const onRefGridFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      e.target.value = "";
      if (!files?.length) return;
      const target = refGridUploadTargetRef.current;
      if (target === "append") {
        await ingestRefFilesAppend(files);
        return;
      }
      const f = files[0]!;
      if (!/^image\/(jpeg|jpg|png|webp)$/i.test(f.type)) {
        setFlowError("请上传 JPEG、PNG 或 WebP 图片");
        return;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        setFlowError("参考图需不超过 20MB（见官方文档限制）");
        return;
      }
      try {
        const url = await readFileAsDataUrl(f);
        setFlowError(null);
        setRefImages((prev) => {
          const n = [...prev];
          n[target] = url;
          return n;
        });
      } catch {
        setFlowError("读取图片失败");
      }
    },
    [ingestRefFilesAppend],
  );

  const onFirstFrameFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      ingestI2vFile(f);
    },
    [ingestI2vFile],
  );

  const openRefAppendPicker = useCallback(() => {
    refGridUploadTargetRef.current = "append";
    refGridFileRef.current?.click();
  }, []);

  const handleGenerate = () => {
    void runGeneration();
  };

  async function runGeneration() {
    if (generatingBusy) return;
    const promptCurrent =
      modeTab === "i2v" ? promptI2v : modeTab === "ref" ? promptRef : promptT2v;
    if (!promptCurrent.trim()) {
      setFlowError("请填写提示词");
      return;
    }

    if (modeTab === "i2v" && !i2vFirstFrameSrc) {
      setFlowError("请上传或从下方示例选择首帧图后再生成");
      return;
    }

    if (modeTab === "ref" && refImages.length === 0) {
      setFlowError("请至少上传或选择示例，保留一张参考图后再生成");
      return;
    }

    setFlowError(null);
    setGeneratingRemoteStatus("");
    setGeneratingBusy(true);

    let snapModelTitle: string;
    if (modeTab === "ref") {
      snapModelTitle = "HappyHorse 参考生视频";
    } else if (modeTab === "t2v") {
      snapModelTitle =
        (getTextToVideoModelById(selectedModelId) ?? TEXT_TO_VIDEO_MODELS[0]!).title;
    } else {
      snapModelTitle =
        (getImageToVideoModelById(selectedModelId) ?? IMAGE_TO_VIDEO_MODELS[0]!).title;
    }
    setGeneratingModelLabel(snapModelTitle);

    let settleHintForJob: string | null = null;
    const snapPrompt = promptCurrent.trim();
    const snapRes = resolution;
    const effectiveDurationSec =
      modeTab === "t2v" ? (durationSec <= 7 ? 5 : 10) : durationSec;
    const snapDur = effectiveDurationSec;
    const snapSeed = seed.trim() || "";
    const snapMode: LabModeTab = modeTab;

    try {
      let startBody: Record<string, unknown>;
      if (modeTab === "t2v") {
        const te =
          getTextToVideoModelById(selectedModelId) ?? TEXT_TO_VIDEO_MODELS[0]!;
        startBody = {
          kind: "t2v",
          prompt: snapPrompt,
          resolution,
          duration: effectiveDurationSec,
          model: te.apiModel,
        };
      } else if (modeTab === "ref") {
        const referenceFrames = await Promise.all(
          refImages.slice(0, 9).map((s) => loadImageAsDataUrl(s)),
        );
        startBody = {
          kind: "ref",
          prompt: snapPrompt,
          referenceImages: referenceFrames,
          resolution,
          duration: durationSec,
          seed: seed.trim() || undefined,
          watermark: false,
          ratio: refRatio,
        };
      } else {
        const ie =
          getImageToVideoModelById(selectedModelId) ?? IMAGE_TO_VIDEO_MODELS[0]!;
        const firstFrame = await loadImageAsDataUrl(i2vFirstFrameSrc!);
        startBody = {
          kind: "i2v",
          prompt: snapPrompt,
          firstFrame,
          resolution,
          duration: durationSec,
          seed: seed.trim() || undefined,
          watermark: false,
          model: ie.apiModel,
        };
      }

      const startR = await fetch("/api/image-to-video/start", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(startBody),
      });
      const startParsed = await readJsonBody<{ taskId?: string; error?: string }>(
        startR,
      );
      if (!startParsed.ok) throw new Error(startParsed.message);
      const startJson = startParsed.data;
      if (!startR.ok) {
        throw new Error(startJson.error ?? `创建任务失败（HTTP ${startR.status}）`);
      }
      const taskId = startJson.taskId?.trim();
      if (!taskId) throw new Error("未返回任务 ID");

      for (let i = 0; i < MAX_POLLS; i++) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        const tr = await fetch(
          `/api/image-to-video/task?id=${encodeURIComponent(taskId)}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        const tjParsed = await readJsonBody<{ output?: TaskPollOutput; error?: string }>(
          tr,
        );
        if (!tjParsed.ok) throw new Error(tjParsed.message);
        const tj = tjParsed.data;
        if (!tr.ok) {
          throw new Error(tj.error ?? `查询任务失败（HTTP ${tr.status}）`);
        }
        const output = tj.output;
        const st = output?.task_status ?? "";
        setGeneratingRemoteStatus(st);

        if (st === "SUCCEEDED") {
          const vu =
            typeof output?.video_url === "string" ? output.video_url.trim() : "";
          if (!vu) throw new Error("任务成功但未返回视频地址");

          const settleR = await fetch("/api/image-to-video/settle", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });
          const settleParsed = await readJsonBody<Record<string, unknown>>(settleR);
          if (!settleParsed.ok) throw new Error(settleParsed.message);
          const settleJson = settleParsed.data;

          if (settleR.status === 402) {
            const req = settleJson.requiredMinor;
            settleHintForJob = `账户余额不足，无法完成本次计费（${
              typeof req === "number" ? `需 ${(req as number) / 100} 元` : "请充值"
            }）。视频仍可播放，链接约 24 小时有效。`;
          } else if (!settleR.ok) {
            settleHintForJob =
              typeof settleJson.error === "string"
                ? settleJson.error
                : `计费请求异常（HTTP ${settleR.status}），请稍后在费用明细核对`;
          } else if (settleJson.duplicate === true) {
            settleHintForJob = "计费记录已存在（幂等），无需重复扣款。";
          } else if (settleJson.recorded === true) {
            settleHintForJob =
              "已按单次生成计费（定价以管理后台「工具管理」为准），可在费用明细查看。";
          }

          const doneAt = new Date().toLocaleString("zh-CN", {
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          setJobs((prev) => [
            {
              id: crypto.randomUUID(),
              mode: snapMode,
              videoUrl: vu,
              prompt: snapPrompt,
              resolution: snapRes,
              durationSec: snapDur,
              seed: snapSeed,
              doneAtLabel: doneAt,
              settleHint: settleHintForJob,
              modelLabel: snapModelTitle,
            },
            ...prev,
          ]);
          setGeneratingRemoteStatus("");
          return;
        }

        if (st === "FAILED" || st === "UNKNOWN" || st === "CANCELED") {
          const detail =
            st === "FAILED"
              ? formatDashScopeI2vFailureForUser(output, st)
              : st;
          throw new Error(`生成失败：${detail}`);
        }
      }

      throw new Error("等待结果超时，请稍后在任务列表或费用明细核对");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成出错";
      setFlowError(msg);
    } finally {
      setGeneratingBusy(false);
      setGeneratingRemoteStatus("");
      setGeneratingModelLabel("");
    }
  }

  const canSubmitGenerate =
    (modeTab === "i2v" && i2vFirstFrameSrc !== null) ||
    modeTab === "t2v" ||
    (modeTab === "ref" && refImages.length > 0);

  const dismissJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const exampleThumbnailsEl = useMemo(
    () => (
      <>
        {examplePresets.map((p) => {
          const expectedRefs = presetRefSources(p);
          const isExampleActive =
            modeTab === "ref"
              ? p.id === refExampleSelectedId &&
                refImages.length === expectedRefs.length &&
                refImages.every((src, i) => src === expectedRefs[i])
              : modeTab === "i2v"
                ? Boolean(
                    i2vExampleSelectedId &&
                      i2vFirstFrameSrc &&
                      p.id === i2vExampleSelectedId &&
                      i2vFirstFrameSrc === p.src,
                  )
                : p.id === t2vExampleSelectedId;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isExampleActive}
              onClick={() => {
                if (modeTab === "ref") {
                  setRefImages(presetRefSources(p));
                  setRefExampleSelectedId(p.id);
                  setPromptRef(p.prompt);
                } else if (modeTab === "i2v") {
                  setI2vFirstFrameSrc(p.src);
                  setI2vExampleSelectedId(p.id);
                  setPromptI2v(p.prompt);
                } else {
                  setT2vExampleSelectedId(p.id);
                  setPromptT2v(p.prompt);
                }
              }}
              title={p.label}
              className={cn(
                "relative aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-md outline-none transition-[box-shadow,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-16 sm:w-16",
                isExampleActive
                  ? "border-2 border-zinc-950 shadow-sm dark:border-zinc-100"
                  : "border-2 border-transparent hover:opacity-90",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" className="h-full w-full object-cover" />
              {modeTab === "ref" ? (
                <span className="pointer-events-none absolute bottom-0.5 right-0.5 flex h-5 min-w-[1.15rem] items-center justify-center rounded-full bg-black/72 px-1 text-[0.65rem] font-semibold tabular-nums text-white shadow-sm">
                  {presetRefBadgeCount(p)}
                </span>
              ) : null}
            </button>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="h-14 w-14 shrink-0 rounded-md border-zinc-300 p-0 sm:h-16 sm:w-16 dark:border-zinc-600"
          onClick={refreshExamples}
          aria-label="换一组示例"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </>
    ),
    [
      modeTab,
      examplePresets,
      refExampleSelectedId,
      refImages,
      i2vExampleSelectedId,
      i2vFirstFrameSrc,
      t2vExampleSelectedId,
      refreshExamples,
    ],
  );

  return (
    <div className="mx-auto max-w-[1400px] px-2 pb-2 pt-0 sm:px-3 lg:px-4">
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <nav
          className="flex max-w-full flex-wrap gap-2"
          role="tablist"
          aria-label="生成模式"
        >
          {(
            [
              ["i2v", "图生视频"],
              ["t2v", "文生视频"],
              ["ref", "参考生视频"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={modeTab === key}
              onClick={() => {
                setModelPickerOpen(false);
                setModeTab(key);
                setResultFilter(key);
                if (key === "t2v") {
                  setSelectedModelId((id) =>
                    TEXT_TO_VIDEO_MODELS.some((m) => m.id === id)
                      ? id
                      : DEFAULT_TEXT_TO_VIDEO_MODEL_ID,
                  );
                } else if (key === "i2v") {
                  setSelectedModelId((id) =>
                    IMAGE_TO_VIDEO_MODELS.some((m) => m.id === id)
                      ? id
                      : DEFAULT_IMAGE_TO_VIDEO_MODEL_ID,
                  );
                }
              }}
              className={chipVariants({
                variant: modeTab === key ? "default" : "outline",
                size: "lg",
              })}
            >
              {label}
            </button>
          ))}
        </nav>
        <nav className="flex max-w-full flex-wrap gap-2" aria-label="结果筛选">
          {(
            [
              ["all", "全部"],
              ["i2v", "图生视频"],
              ["t2v", "文生视频"],
              ["ref", "参考生视频"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setResultFilter(key)}
              className={chipVariants({
                variant: resultFilter === key ? "default" : "outline",
                size: "lg",
              })}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        <aside className="relative flex w-full min-h-0 max-h-[calc(100dvh-5.25rem)] flex-col lg:sticky lg:top-3 lg:max-h-[calc(100dvh-4.75rem)] lg:w-[400px] xl:w-[420px]">
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pr-0.5 pb-36 [scrollbar-gutter:stable]">
            {modeTab === "t2v" ? (
              <>
                <div className="relative" ref={modelPickerRef}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/90 bg-card px-3 py-2 text-left shadow-sm transition hover:bg-muted/50"
                    aria-expanded={modelPickerOpen}
                    aria-haspopup="listbox"
                    onClick={() => setModelPickerOpen((o) => !o)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-lg" aria-hidden>
                        {selectedModel.icon}
                      </span>
                      <span className="truncate text-sm font-medium">{selectedModel.title}</span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                  {modelPickerOpen ? (
                    <div
                      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border/90 bg-background shadow-lg"
                      role="listbox"
                    >
                      {TEXT_TO_VIDEO_MODELS.map((m) => {
                        const isSel = m.id === selectedModel.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            role="option"
                            aria-selected={isSel}
                            className={cn(
                              "flex w-full items-start gap-3 border-b border-border/60 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-muted/80",
                              isSel && "bg-violet-50/80 dark:bg-violet-950/40",
                            )}
                            onClick={() => {
                              setSelectedModelId(m.id);
                              setModelPickerOpen(false);
                            }}
                          >
                            <span className="text-lg leading-none" aria-hidden>
                              {m.icon}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-foreground">
                                {m.title}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {m.description}
                              </span>
                            </span>
                            {isSel ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-border/90 bg-muted/40 p-4 shadow-sm ring-1 ring-violet-500/10">
                  <p className="my-0 text-sm leading-relaxed text-muted-foreground">
                    文生视频仅需提示词与下方参数，无需上传图片。当前 Wan2.5 文生接口多仅支持{" "}
                    <span className="font-medium text-foreground">5 秒</span> 或{" "}
                    <span className="font-medium text-foreground">10 秒</span>{" "}
                    成片；提交时按时长滑块自动取整（≤7 秒按 5 秒，否则按 10 秒）。
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/40 px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">示例</span>
                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-gutter:stable]">
                      {exampleThumbnailsEl}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div
                  ref={modeTab === "i2v" ? modelPickerRef : undefined}
                  className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-sm ring-1 ring-violet-500/10"
                >
                  <div className="relative border-b border-border/80 bg-muted/30">
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="shrink-0 text-lg" aria-hidden>
                          {modeTab === "ref" ? "🎠" : selectedModel.icon}
                        </span>
                        {modeTab === "ref" ? (
                          <span className="truncate text-sm font-semibold tracking-tight">
                            HappyHorse-1.0-R2V
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="min-w-0 truncate text-left text-sm font-semibold"
                            onClick={() => setModelPickerOpen((o) => !o)}
                          >
                            {selectedModel.title}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label={modeTab === "ref" ? "上传参考图" : "选择或切换模型"}
                        onClick={() => {
                          if (modeTab === "ref") {
                            openRefAppendPicker();
                          } else {
                            setModelPickerOpen((o) => !o);
                          }
                        }}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
                    </div>
                    {modelPickerOpen && modeTab === "i2v" ? (
                      <div
                        className="absolute left-0 right-0 top-full z-30 max-h-72 overflow-y-auto border-b border-border/80 bg-background shadow-md"
                        role="listbox"
                      >
                        {IMAGE_TO_VIDEO_MODELS.map((m) => {
                          const isSel = m.id === selectedModel.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              role="option"
                              aria-selected={isSel}
                              className={cn(
                                "flex w-full items-start gap-3 border-b border-border/60 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-muted/80",
                                isSel && "bg-violet-50/80 dark:bg-violet-950/40",
                              )}
                              onClick={() => {
                                setSelectedModelId(m.id);
                                setModelPickerOpen(false);
                              }}
                            >
                              <span className="text-lg leading-none" aria-hidden>
                                {m.icon}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-foreground">
                                  {m.title}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {m.description}
                                </span>
                              </span>
                              {isSel ? (
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="p-3">
                    {modeTab === "i2v" ? (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          className="sr-only"
                          aria-hidden
                          onChange={onFirstFrameFile}
                        />
                        {!i2vFirstFrameSrc ? (
                          <div
                            className={cn(
                              "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-muted/40 px-4 py-8 text-center transition-colors dark:border-zinc-600",
                              dragOverI2v &&
                                "border-violet-500 bg-violet-50/40 dark:border-violet-400 dark:bg-violet-950/25",
                            )}
                            role="button"
                            tabIndex={0}
                            aria-label="点击或拖拽上传首帧图，也可在下方选择示例"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                fileInputRef.current?.click();
                              }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              setDragOverI2v(true);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={(e) => {
                              const rel = e.relatedTarget as Node | null;
                              if (rel && e.currentTarget.contains(rel)) return;
                              setDragOverI2v(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverI2v(false);
                              const f = e.dataTransfer.files[0];
                              if (f) ingestI2vFile(f);
                            }}
                          >
                            <ImagePlus
                              className="h-12 w-12 text-muted-foreground/90"
                              strokeWidth={1.25}
                              aria-hidden
                            />
                            <p className="text-sm font-semibold text-foreground">点击 / 拖拽 上传图片</p>
                            <ul className="max-w-[300px] space-y-1 text-[0.7rem] leading-relaxed text-muted-foreground">
                              <li>图生视频仅使用 1 张首帧图</li>
                              <li>图像格式：JPEG、JPG、PNG、WEBP；单张不超过 20MB</li>
                              <li>分辨率：推荐 720P 以上，图像短边大于 400 像素</li>
                              <li className="text-violet-700/90 dark:text-violet-300/90">
                                点击下方示例可一键套用首帧，与上传相同
                              </li>
                            </ul>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "group relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-muted/50 transition-colors dark:border-zinc-600",
                              dragOverI2v &&
                                "border-violet-500 bg-violet-50/50 dark:border-violet-400 dark:bg-violet-950/20",
                            )}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverI2v(true);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDragLeave={(e) => {
                              const rel = e.relatedTarget as Node | null;
                              if (rel && e.currentTarget.contains(rel)) return;
                              setDragOverI2v(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverI2v(false);
                              const f = e.dataTransfer.files[0];
                              if (f) ingestI2vFile(f);
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={i2vFirstFrameSrc}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-150 group-hover:bg-black/45" />
                            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                              <button
                                type="button"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-md transition hover:bg-white"
                                aria-label="放大预览首帧"
                                title="放大预览"
                                onClick={() => setRefPreviewSrc(i2vFirstFrameSrc)}
                              >
                                <Eye className="h-4 w-4" strokeWidth={2.25} />
                              </button>
                              <button
                                type="button"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-md transition hover:bg-white"
                                aria-label="上传替换首帧图"
                                title="上传替换"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <Upload className="h-4 w-4" strokeWidth={2.25} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <input
                          ref={refGridFileRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          multiple
                          className="sr-only"
                          aria-hidden
                          onChange={onRefGridFile}
                        />
                        {refImages.length === 0 ? (
                          <div
                            className={cn(
                              "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-muted/40 px-4 py-8 text-center transition-colors dark:border-zinc-600",
                              dragOverRefPanel &&
                                "border-violet-500 bg-violet-50/40 dark:border-violet-400 dark:bg-violet-950/25",
                            )}
                            role="button"
                            tabIndex={0}
                            aria-label="点击或拖拽上传参考图，也可在下方选择示例"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openRefAppendPicker();
                              }
                            }}
                            onClick={openRefAppendPicker}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              setDragOverRefPanel(true);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={(e) => {
                              const rel = e.relatedTarget as Node | null;
                              if (rel && e.currentTarget.contains(rel)) return;
                              setDragOverRefPanel(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverRefPanel(false);
                              void ingestRefFilesAppend(e.dataTransfer.files);
                            }}
                          >
                            <ImagePlus
                              className="h-12 w-12 text-muted-foreground/90"
                              strokeWidth={1.25}
                              aria-hidden
                            />
                            <p className="text-sm font-semibold text-foreground">点击 / 拖拽 上传图片</p>
                            <ul className="max-w-[300px] space-y-1 text-[0.7rem] leading-relaxed text-muted-foreground">
                              <li>最多可上传 {REF_GRID_MAX_IMAGES} 张参考图片</li>
                              <li>图像格式：JPEG、JPG、PNG、WEBP；单张不超过 20MB</li>
                              <li>分辨率：推荐 720P 以上，图像短边大于 400 像素</li>
                              <li>宽高比：建议多张图比例一致，与目标视频比例接近</li>
                              <li className="text-violet-700/90 dark:text-violet-300/90">
                                点击下方示例可一键填入参考图，与上传相同
                              </li>
                            </ul>
                          </div>
                        ) : (
                          <div
                            className="rounded-xl border border-border/80 bg-muted/30 p-2"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              void ingestRefFilesAppend(e.dataTransfer.files);
                            }}
                          >
                            <div className="grid grid-cols-3 gap-2">
                              {refImages.map((src, index) => (
                                <div
                                  key={index}
                                  className="group relative aspect-square w-full overflow-hidden rounded-lg border border-border/80 bg-background shadow-sm"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={src} alt="" className="h-full w-full object-cover" />
                                  <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-150 group-hover:bg-black/45" />
                                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                    <button
                                      type="button"
                                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-md transition hover:bg-white"
                                      aria-label="放大预览"
                                      title="放大预览"
                                      onClick={() => setRefPreviewSrc(src)}
                                    >
                                      <Eye className="h-4 w-4" strokeWidth={2.25} />
                                    </button>
                                    <button
                                      type="button"
                                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-md transition hover:bg-white"
                                      aria-label="上传替换此参考图"
                                      title="上传替换"
                                      onClick={() => {
                                        refGridUploadTargetRef.current = index;
                                        refGridFileRef.current?.click();
                                      }}
                                    >
                                      <Upload className="h-4 w-4" strokeWidth={2.25} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {refImages.length < REF_GRID_MAX_IMAGES ? (
                                <button
                                  type="button"
                                  onClick={openRefAppendPicker}
                                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 bg-background/80 text-muted-foreground transition hover:border-violet-400 hover:bg-violet-50/50 hover:text-violet-800 dark:border-zinc-600 dark:hover:border-violet-500 dark:hover:bg-violet-950/30 dark:hover:text-violet-200"
                                  aria-label="上传参考图"
                                  title={`上传参考图（还可添加 ${REF_GRID_MAX_IMAGES - refImages.length} 张）`}
                                >
                                  <Upload className="h-6 w-6 opacity-70" strokeWidth={2} />
                                  <span className="px-1 text-center text-[0.65rem] font-medium leading-tight">
                                    上传
                                  </span>
                                  <span className="text-[0.6rem] tabular-nums opacity-80">
                                    {refImages.length}/{REF_GRID_MAX_IMAGES}
                                  </span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="border-t border-border/80 bg-muted/20 px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">示例</span>
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-gutter:stable]">
                        {exampleThumbnailsEl}
                      </div>
                    </div>
                  </div>
                </div>

                {modeTab === "ref" ? (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-sm font-medium">画幅比例</span>
                    <div className="flex flex-wrap gap-1.5">
                      {REF_RATIO_OPTIONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRefRatio(r)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs font-semibold tabular-nums transition-colors",
                            refRatio === r
                              ? "border-violet-700 bg-violet-600 text-white dark:border-violet-500"
                              : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100",
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="i2v-prompt">
              提示词 <span className="text-destructive">*</span>
            </label>
            <textarea
              id="i2v-prompt"
              value={
                modeTab === "i2v"
                  ? promptI2v
                  : modeTab === "ref"
                    ? promptRef
                    : promptT2v
              }
              onChange={(e) => {
                const v = e.target.value;
                if (modeTab === "i2v") setPromptI2v(v);
                else if (modeTab === "ref") setPromptRef(v);
                else setPromptT2v(v);
              }}
              rows={5}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              placeholder="描述镜头运动、氛围与风格…"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">清晰度</span>
            <div className="flex gap-2">
              {(["720P", "1080P"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResolution(r)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-center text-sm font-semibold transition-colors",
                    resolution === r
                      ? "border-violet-700 bg-violet-600 text-white shadow-sm dark:border-violet-500 dark:bg-violet-600 dark:text-white"
                      : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium" htmlFor="i2v-duration-input">
                视频时长(秒)
              </label>
              <input
                id="i2v-duration-input"
                type="number"
                min={3}
                max={15}
                step={1}
                value={durationSec}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  setDurationSec(Math.min(15, Math.max(3, Math.round(v))));
                }}
                className="h-9 w-14 rounded-lg border border-input bg-background px-2 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              />
            </div>
            <div className="flex items-center gap-2.5 text-xs tabular-nums text-muted-foreground">
              <span className="w-3 shrink-0 text-right">3</span>
              <input
                type="range"
                min={3}
                max={15}
                step={1}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer accent-violet-600 [color-scheme:light]"
                aria-valuemin={3}
                aria-valuemax={15}
                aria-valuenow={durationSec}
                aria-label="视频时长滑块"
              />
              <span className="w-3 shrink-0">15</span>
            </div>
            {modeTab === "t2v" ? (
              <p className="my-0 text-[0.65rem] leading-snug text-muted-foreground">
                Wan2.5 文生：接口仅接受 5 秒或 10 秒，已按滑块自动对齐。
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">随机种子</span>
              <div className="group/tooltip relative inline-flex">
                <button
                  type="button"
                  className="rounded-full p-0.5 text-violet-600 outline-none hover:bg-violet-600/10 focus-visible:ring-2 focus-visible:ring-violet-500/50"
                  aria-label={SEED_TOOLTIP}
                  title={SEED_TOOLTIP}
                >
                  <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-center text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100"
                >
                  {SEED_TOOLTIP}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                placeholder="如 1234"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 border-violet-600/40 px-3 text-violet-700 hover:bg-violet-600/10 dark:text-violet-300"
                onClick={() => setSeed(randomSeedString())}
                aria-label="随机生成种子"
              >
                <Dices className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-[0.65rem] leading-snug text-muted-foreground">
            生成结果链接约 24 小时有效，请及时下载或在「我的视频库」中保存。
          </p>

          <div className="flex flex-wrap gap-2 border-t border-border/80 pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/image-to-video">图生视频首页</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/image-to-video/library">我的视频库</Link>
            </Button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 sm:bottom-4">
          <div className="pointer-events-auto border-t border-border/80 bg-background/95 px-0.5 pb-1 pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.07)] backdrop-blur supports-[backdrop-filter]:bg-background/90 dark:shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
            <ToolChargeSubmitButton
              variant="compact"
              busy={generatingBusy}
              disabled={!canSubmitGenerate}
              onClick={handleGenerate}
              primaryLabel="开始生成"
              busyLabel="生成中"
              chargeLine={chargeLine}
              chargeTitle={chargeTitle}
              idleIcon={<Wand2 className="h-4 w-4" aria-hidden />}
            />
            {flowError ? (
              <p className="mt-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {flowError}
              </p>
            ) : null}
            <p className="mt-1.5 text-center text-[0.65rem] leading-snug text-muted-foreground">
              所有内容均由人工智能模型生成，准确性和完整性无法保证，不代表我们的态度或观点。
            </p>
          </div>
        </div>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 space-y-4 lg:max-h-[calc(100dvh-4.75rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-0.5">
          {jobs.length > 0 && visibleJobs.length === 0 && !generatingBusy ? (
            <p className="rounded-lg border border-dashed border-border/90 bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
              当前筛选下没有记录，可点选「全部」查看。
            </p>
          ) : null}

          {jobs.length === 0 && !generatingBusy ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/90 bg-muted/30 px-6 py-24 text-center">
              <Images className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">尚未生成</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                在左侧选择模式并配置参数（图生需首帧，参考生需参考图，文生仅需提示词），点击「开始生成」；多次生成会依次叠在本页。
              </p>
            </div>
          ) : null}

          {generatingBusy ? (
            <div
              className={cn(
                "min-w-0 overflow-hidden rounded-2xl border border-border/90 shadow-sm",
                ttiStyles.rightPane,
              )}
            >
              <div className={ttiStyles.rightHead}>
                生成中 · {generatingModelLabel || selectedModel.title}
                {generatingRemoteStatus
                  ? ` · ${taskStatusZh(generatingRemoteStatus)}`
                  : " · 已提交任务"}
              </div>
              <div className={ttiStyles.robotRow}>
                <span className={ttiStyles.robotGlyph} aria-hidden>
                  🤖
                </span>
                <p className={ttiStyles.robotText}>
                  模型正在生成视频，通常需要数分钟；首次查询后约每 {POLL_MS / 1000}{" "}
                  秒刷新进度。请勿关闭页面…
                </p>
              </div>
              <div className={ttiStyles.skelVideo} aria-hidden />
            </div>
          ) : null}

          {visibleJobs.map((job) => (
            <div
              key={job.id}
              className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 px-4 py-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Film className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {job.mode === "i2v" ? "图生视频" : job.mode === "t2v" ? "文生视频" : "参考生视频"}{" "}
                      · {job.modelLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job.doneAtLabel} · {job.resolution}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" className="h-9 w-9 p-0" asChild aria-label="下载视频">
                    <a href={job.videoUrl} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 w-9 p-0"
                    aria-label="从列表移除"
                    onClick={() => dismissJob(job.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-3 px-4 py-3">
                {job.settleHint ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                    {job.settleHint}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                    <Clapperboard className="h-3 w-3" />
                    首帧
                  </span>
                  <span className="line-clamp-2 text-sm text-foreground/90">{job.prompt}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {job.durationSec}秒
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{job.resolution}</span>
                  <span
                    className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono"
                    title="随机种子"
                  >
                    seed {job.seed || "—"}
                  </span>
                </div>
              </div>
              <div className="relative aspect-video bg-black/95">
                <video
                  src={job.videoUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  preload="metadata"
                />
              </div>
              <p className="border-t border-border/80 px-4 py-2 text-[0.7rem] text-muted-foreground">
                成片链接约 24 小时有效，请及时下载或转存。
                <a
                  href={job.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-primary underline"
                >
                  新窗口打开
                </a>
              </p>
            </div>
          ))}
        </section>
      </div>

      {refPreviewSrc ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm"
          onClick={() => setRefPreviewSrc(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="关闭预览"
            onClick={() => setRefPreviewSrc(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={refPreviewSrc}
            alt=""
            className="max-h-[min(88dvh,920px)] max-w-[min(96vw,1200px)] object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
