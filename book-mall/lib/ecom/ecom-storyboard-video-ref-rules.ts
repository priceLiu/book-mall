/**
 * 分镜成片 · 视频模型参考图调入规则
 *
 * 用户只选模型；系统按模型能力自动决定传哪些图、传几张、以何种角色传入。
 * 规则须与 buildBailianR2vRequestBody / buildCanvasVideoVolcengineInput 等实际上限一致。
 */
import {
  bailianR2vMaxRefs,
  isHappyhorseBailianR2vModel,
  isWan26BailianR2vModel,
  isWan27BailianR2vModel,
} from "@/lib/canvas/bailian-r2v-body";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";
import {
  getStoryboardCharacterRefs,
  getStoryboardProductRef,
  getStoryboardSceneRefs,
} from "@/lib/ecom/ecom-storyboard-refs";
import {
  isStoryboardBailianR2vVideoModel,
  isStoryboardKieVideoModel,
  isStoryboardKling30KieVideoModel,
  isStoryboardVolcengineVideoModel,
  resolveStoryboardVideoProvider,
} from "@/lib/ecom/ecom-storyboard-video-models";

export type StoryboardVideoRefSlotRole =
  | "full_sheet"
  | "panel"
  | "product"
  | "character"
  | "scene";

export type StoryboardVideoRefPackStrategy =
  /** 火山 Seedance：first_frame=故事版，reference_image=产品/角色/场景 */
  | "volcengine_sheet_plus_identity"
  /** KIE Seedance：reference_image_urls 故事版优先，再身份参考，再分镜 */
  | "kie_flat_rich"
  /** 可灵 3.0：首帧故事版 + kling_elements（产品/角色/场景），不走本模块拼 flat 数组 */
  | "kling_first_frame_elements"
  /** 百炼 wan2.7 / HappyHorse：单张多宫格故事板 + 产品/角色/场景，不重复送各镜头分镜 */
  | "bailian_storyboard_grid"
  /** 百炼万相 2.6 multi：仅分镜镜头图（shot_type=multi），不送整版故事版 */
  | "bailian_multi_shot_panels";

export type StoryboardVideoInvokeRules = {
  modelKey: string;
  provider: "volcengine" | "kie" | "bailian";
  strategy: StoryboardVideoRefPackStrategy;
  /** 参考图总上限（含首帧或 flat 数组全部条目） */
  maxTotalImages: number;
  /** 是否支持把「完整故事版 PNG」作为一张图传入 */
  supportsFullSheet: boolean;
  /** 是否有 first_frame / reference_image 角色区分（百炼为 false，全进同一数组） */
  hasFirstFrameRole: boolean;
  /** API 侧成片时长上限（秒），undefined 表示与业务默认一致 */
  apiMaxDurationSec?: number;
  /** 策略说明（日志 / 调试） */
  strategyNote: string;
};

export type StoryboardVideoRefSlot = {
  role: StoryboardVideoRefSlotRole;
  url: string;
  panelIndex?: number;
  /** prompt 用标签 */
  label: string;
};

export type StoryboardVideoRefPlan = {
  rules: StoryboardVideoInvokeRules;
  slots: StoryboardVideoRefSlot[];
  /** 火山 / 部分 KIE：首帧 URL */
  firstFrameUrl: string;
  /** 火山 / KIE Seedance：除首帧外的 reference_image */
  referenceImageUrls: string[];
  /** 百炼 R2V：全部参考图（无 first_frame 区分） */
  bailianAllUrls: string[];
};

function isHttpUrl(url: string | undefined): url is string {
  return Boolean(url?.trim() && /^https?:\/\//.test(url.trim()));
}

function dedupeUrls(urls: string[], exclude?: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = raw.trim();
    if (!isHttpUrl(u) || seen.has(u) || exclude?.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** 各模型参考图调入规则（权威表） */
export function getStoryboardVideoInvokeRules(modelKey: string): StoryboardVideoInvokeRules {
  const key = modelKey.trim();
  const provider = resolveStoryboardVideoProvider(key);

  if (isStoryboardKling30KieVideoModel(key)) {
    return {
      modelKey: key,
      provider: "kie",
      strategy: "kling_first_frame_elements",
      maxTotalImages: 4,
      supportsFullSheet: true,
      hasFirstFrameRole: true,
      strategyNote: "可灵 3.0：首帧=完整故事版；产品/角色/场景走 kling_elements，不拼 flat 分镜数组。",
    };
  }

  if (isStoryboardVolcengineVideoModel(key)) {
    return {
      modelKey: key,
      provider: "volcengine",
      strategy: "volcengine_sheet_plus_identity",
      maxTotalImages: 9,
      supportsFullSheet: true,
      hasFirstFrameRole: true,
      strategyNote:
        "火山 Seedance：first_frame=故事版；reference_image=产品+角色+场景（不重复送各镜头，避免挤占身份参考）。",
    };
  }

  if (isStoryboardKieVideoModel(key)) {
    return {
      modelKey: key,
      provider: "kie",
      strategy: "kie_flat_rich",
      maxTotalImages: 8,
      supportsFullSheet: true,
      hasFirstFrameRole: false,
      strategyNote:
        "KIE Seedance：reference_image_urls 故事版首位，再产品/角色/场景，有余量再补关键分镜。",
    };
  }

  if (isWan26BailianR2vModel(key)) {
    return {
      modelKey: key,
      provider: "bailian",
      strategy: "bailian_multi_shot_panels",
      maxTotalImages: 5,
      supportsFullSheet: false,
      hasFirstFrameRole: false,
      apiMaxDurationSec: 10,
      strategyNote:
        "万相 2.6 R2V（multi）：仅送各镜头分镜图（最多 5 张）；镜头不足时再补产品/角色。不送整版故事版。",
    };
  }

  if (isWan27BailianR2vModel(key)) {
    return {
      modelKey: key,
      provider: "bailian",
      strategy: "bailian_storyboard_grid",
      maxTotalImages: bailianR2vMaxRefs(key),
      supportsFullSheet: true,
      hasFirstFrameRole: false,
      strategyNote:
        "万相 2.7 R2V：media[0]=多宫格故事板，再附产品/角色/场景；不送各镜头单图（官方多宫格脚本范式）。",
    };
  }

  if (isStoryboardBailianR2vVideoModel(key)) {
    return {
      modelKey: key,
      provider: "bailian",
      strategy: "bailian_storyboard_grid",
      maxTotalImages: bailianR2vMaxRefs(key),
      supportsFullSheet: true,
      hasFirstFrameRole: false,
      strategyNote:
        "HappyHorse R2V：产品/角色/场景参考前置（[Image 1] 起），故事板置后仅作构图节奏；不重复送各镜头单图。",
    };
  }

  return {
    modelKey: key,
    provider,
    strategy: "volcengine_sheet_plus_identity",
    maxTotalImages: 9,
    supportsFullSheet: true,
    hasFirstFrameRole: true,
    strategyNote: "默认：故事版作首帧，身份参考图作 reference_image。",
  };
}

function pushSlot(
  slots: StoryboardVideoRefSlot[],
  cap: number,
  slot: StoryboardVideoRefSlot,
): boolean {
  if (slots.length >= cap) return false;
  if (slots.some((s) => s.url === slot.url)) return false;
  slots.push(slot);
  return true;
}

function identitySlots(references: StoryboardReference[]): StoryboardVideoRefSlot[] {
  return identitySlotsPrioritized(references);
}

/**
 * 身份参考优先级：产品 → 场景 → 角色。
 * 万相 2.7 仅 5 张时，场景优先于第二张角色图，避免「场景不对」。
 */
function identitySlotsPrioritized(
  references: StoryboardReference[],
): StoryboardVideoRefSlot[] {
  const out: StoryboardVideoRefSlot[] = [];
  const product = getStoryboardProductRef(references);
  if (product) {
    const name = product.label?.trim();
    out.push({
      role: "product",
      url: product.ossUrl.trim(),
      label: name
        ? `产品图「${name}」（包装外观须一致）`
        : "产品图（包装外观须一致）",
    });
  }
  for (const [i, s] of getStoryboardSceneRefs(references).entries()) {
    const name = s.label?.trim();
    out.push({
      role: "scene",
      url: s.ossUrl.trim(),
      label: name ? `场景参考「${name}」` : `场景参考${i + 1}`,
    });
  }
  for (const [i, c] of getStoryboardCharacterRefs(references).entries()) {
    const name = c.label?.trim();
    out.push({
      role: "character",
      url: c.ossUrl.trim(),
      label: name
        ? `角色「${name}」（五官发型穿搭须一致）`
        : `角色参考${i + 1}（五官发型穿搭须一致）`,
    });
  }
  return out;
}

function panelSlots(
  panels: Array<{ index: number; url: string }>,
): StoryboardVideoRefSlot[] {
  return panels.map((p) => ({
    role: "panel" as const,
    url: p.url.trim(),
    panelIndex: p.index,
    label: `镜头${p.index}分镜`,
  }));
}

/**
 * 按模型规则解析整图成片参考图方案。
 */
export function resolveStoryboardVideoRefPlan(opts: {
  modelKey: string;
  references: StoryboardReference[];
  sheetPngUrl: string;
  panelImages?: Array<{ index: number; url: string }>;
}): StoryboardVideoRefPlan {
  const rules = getStoryboardVideoInvokeRules(opts.modelKey);
  const cap = rules.maxTotalImages;
  const sheetUrl = opts.sheetPngUrl.trim();
  const seenPanel = new Set<string>();
  const panels = (opts.panelImages ?? []).filter((p) => {
    const u = p.url.trim();
    if (!isHttpUrl(u) || u === sheetUrl || seenPanel.has(u)) return false;
    seenPanel.add(u);
    return true;
  });
  const identities = identitySlots(opts.references);
  const slots: StoryboardVideoRefSlot[] = [];

  switch (rules.strategy) {
    case "bailian_multi_shot_panels": {
      for (const p of panelSlots(panels)) {
        if (!pushSlot(slots, cap, p)) break;
      }
      if (slots.length < cap) {
        for (const id of identities) {
          if (!pushSlot(slots, cap, id)) break;
        }
      }
      break;
    }

    case "bailian_storyboard_grid": {
      const identitiesOrdered = identitySlotsPrioritized(opts.references);
      const sheetSlot: StoryboardVideoRefSlot = {
        role: "full_sheet",
        url: sheetUrl,
        label: "分镜画面宫格（各镜头图拼接，仅构图节奏）",
      };
      // HappyHorse：身份参考前置，避免故事板宫格里的产品外观覆盖 [Image 1] 产品参考
      if (isHappyhorseBailianR2vModel(opts.modelKey)) {
        for (const id of identitiesOrdered) {
          if (!pushSlot(slots, cap, id)) break;
        }
        if (rules.supportsFullSheet && sheetUrl) {
          pushSlot(slots, cap, sheetSlot);
        }
      } else {
        if (rules.supportsFullSheet && sheetUrl) {
          pushSlot(slots, cap, sheetSlot);
        }
        for (const id of identitiesOrdered) {
          if (!pushSlot(slots, cap, id)) break;
        }
      }
      break;
    }

    case "kie_flat_rich": {
      if (rules.supportsFullSheet && sheetUrl) {
        pushSlot(slots, cap, {
          role: "full_sheet",
          url: sheetUrl,
          label: "完整故事版（构图与节奏）",
        });
      }
      for (const id of identities) {
        if (!pushSlot(slots, cap, id)) break;
      }
      for (const p of panelSlots(panels)) {
        if (!pushSlot(slots, cap, p)) break;
      }
      break;
    }

    case "volcengine_sheet_plus_identity":
    case "kling_first_frame_elements":
    default: {
      if (sheetUrl) {
        pushSlot(slots, cap, {
          role: "full_sheet",
          url: sheetUrl,
          label: "完整故事版（构图与节奏）",
        });
      }
      for (const id of identities) {
        if (!pushSlot(slots, cap, id)) break;
      }
      break;
    }
  }

  const urls = slots.map((s) => s.url);
  const sheetSlot = slots.find((s) => s.role === "full_sheet");
  const firstFrameUrl = sheetSlot?.url ?? urls[0] ?? sheetUrl;
  const referenceImageUrls = rules.hasFirstFrameRole
    ? urls.filter((u) => u !== firstFrameUrl)
    : rules.provider === "kie"
      ? urls.filter((u) => u !== firstFrameUrl)
      : [];

  const bailianAllUrls = rules.provider === "bailian" ? urls : [];

  return {
    rules,
    slots,
    firstFrameUrl,
    referenceImageUrls,
    bailianAllUrls,
  };
}

/** 单镜头成片：首帧=该镜分镜图，reference=产品/角色/场景（受模型余量限制） */
export function resolveStoryboardPanelVideoRefPlan(opts: {
  modelKey: string;
  references: StoryboardReference[];
  panelImageUrl: string;
}): StoryboardVideoRefPlan {
  const rules = getStoryboardVideoInvokeRules(opts.modelKey);
  const cap = rules.maxTotalImages;
  const panelUrl = opts.panelImageUrl.trim();
  const slots: StoryboardVideoRefSlot[] = [];

  pushSlot(slots, cap, {
    role: "panel",
    url: panelUrl,
    label: "当前镜头分镜（构图）",
  });

  for (const id of identitySlots(opts.references)) {
    if (!pushSlot(slots, cap, id)) break;
  }

  const urls = slots.map((s) => s.url);
  return {
    rules,
    slots,
    firstFrameUrl: panelUrl,
    referenceImageUrls: urls.filter((u) => u !== panelUrl),
    bailianAllUrls: rules.provider === "bailian" ? urls : [],
  };
}
