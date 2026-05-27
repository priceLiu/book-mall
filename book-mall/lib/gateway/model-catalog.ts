/**
 * Gateway 全站接入模型目录（Canvas / Story / 工具站经 Gateway 路由的模型清单）
 */

import type { GatewayProviderKind } from "@prisma/client";

import { BAILIAN_R2V_KNOWN_MODELS } from "@/lib/canvas/providers/bailian-r2v";
import { DEEPSEEK_KNOWN_MODELS } from "@/lib/canvas/providers/deepseek-system";
import { listHunyuanKnownModels } from "@/lib/canvas/providers/hunyuan-3d";
import { KIE_KNOWN_MODELS } from "@/lib/canvas/providers/kie";
import type { CanvasGatewayListedModel } from "@/lib/canvas/providers/types";
import { WANX_TEXT2IMAGE_PLUS_MODEL } from "@/lib/gateway/dashscope-client";
import { routeGatewayModel } from "@/lib/gateway/model-router";

export type GatewayCatalogRequestKind =
  | "CHAT"
  | "IMAGE"
  | "VIDEO"
  | "TTS"
  | "TRYON"
  | "OTHER";

export type GatewayCatalogModel = {
  modelKey: string;
  displayName: string;
  requestKind: GatewayCatalogRequestKind;
  role: CanvasGatewayListedModel["role"] | "TTS" | "TRYON";
  description: string | null;
  products: string[];
};

export type GatewayCatalogGroup = {
  providerKind: GatewayProviderKind;
  label: string;
  credentialBound: boolean;
  models: GatewayCatalogModel[];
};

export type GatewayModelCatalog = {
  groups: GatewayCatalogGroup[];
  totalCount: number;
  boundKinds: GatewayProviderKind[];
};

const PROVIDER_LABEL: Record<GatewayProviderKind, string> = {
  KIE: "KIE",
  BAILIAN: "百炼 / DashScope 兼容",
  DEEPSEEK: "DeepSeek",
  DASHSCOPE: "DashScope 原生",
  HUNYUAN: "混元 3D",
};

/** 与 tool-web/config/lab-video-models.json 保持同步 */
const DASHSCOPE_LAB_VIDEO: Array<{
  modelKey: string;
  displayName: string;
  description: string;
  requestKind: "VIDEO";
  products: string[];
}> = [
  {
    modelKey: "happyhorse-1.0-i2v",
    displayName: "HappyHorse-1.0-I2V",
    description: "图生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.7-i2v-2026-04-25",
    displayName: "万相 2.7 图生视频 (2026-04-25)",
    description: "图生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.7-i2v",
    displayName: "万相 2.7 图生视频",
    description: "图生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.6-i2v-flash",
    displayName: "万相 2.6 I2V Flash",
    description: "图生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.6-i2v",
    displayName: "Wan 2.6 I2V",
    description: "图生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.5-i2v-preview",
    displayName: "Wan 2.5 I2V Preview",
    description: "图生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "pixverse-c1-it2v",
    displayName: "PixVerse C1 I2V",
    description: "图生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "happyhorse-1.0-t2v",
    displayName: "HappyHorse-1.0-T2V",
    description: "文生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.7-t2v-2026-04-25",
    displayName: "万相 2.7 文生视频 (2026-04-25)",
    description: "文生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.7-t2v",
    displayName: "万相 2.7 文生视频",
    description: "文生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.6-t2v",
    displayName: "Wan 2.6 T2V",
    description: "文生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.5-t2v-preview",
    displayName: "Wan 2.5 T2V Preview",
    description: "文生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "pixverse-c1-t2v",
    displayName: "PixVerse C1 T2V",
    description: "文生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "pixverse-v6-t2v",
    displayName: "PixVerse V6 T2V",
    description: "文生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "happyhorse-1.0-r2v",
    displayName: "HappyHorse-1.0-R2V (DashScope)",
    description: "参考生视频 · 工具站视频实验室（Canvas 百炼 R2V 亦可用）",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.7-r2v",
    displayName: "万相 2.7 R2V (DashScope)",
    description: "参考生视频 · 工具站（Canvas 百炼 R2V 亦可用）",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.6-r2v",
    displayName: "Wan 2.6 R2V (DashScope)",
    description: "参考生视频 · 工具站（Canvas 百炼 R2V 亦可用）",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
  {
    modelKey: "wan2.6-r2v-flash",
    displayName: "Wan 2.6 R2V Flash",
    description: "参考生视频 · 工具站视频实验室",
    requestKind: "VIDEO",
    products: ["工具站"],
  },
];

const DASHSCOPE_TOOL_OTHER: GatewayCatalogModel[] = [
  {
    modelKey: WANX_TEXT2IMAGE_PLUS_MODEL,
    displayName: "万相 2.1 文生图 Plus",
    requestKind: "IMAGE",
    role: "IMAGE",
    description: "工具站文生图",
    products: ["工具站"],
  },
  {
    modelKey: "aitryon",
    displayName: "AI 试衣 · 基础版",
    requestKind: "TRYON",
    role: "TRYON",
    description: "工具站试衣间",
    products: ["工具站"],
  },
  {
    modelKey: "aitryon-plus",
    displayName: "AI 试衣 · Plus",
    requestKind: "TRYON",
    role: "TRYON",
    description: "工具站试衣间",
    products: ["工具站"],
  },
  {
    modelKey: "aitryon-parsing-v1",
    displayName: "AI 试衣 · 解析",
    requestKind: "TRYON",
    role: "TRYON",
    description: "试衣预处理",
    products: ["工具站"],
  },
  {
    modelKey: "aitryon-refiner",
    displayName: "AI 试衣 · Refiner",
    requestKind: "TRYON",
    role: "TRYON",
    description: "试衣精修（阶梯计费）",
    products: ["工具站"],
  },
  {
    modelKey: "qwen3-tts",
    displayName: "Qwen3 TTS",
    requestKind: "TTS",
    role: "TTS",
    description: "Story / Canvas 语音合成",
    products: ["Canvas", "Story"],
  },
];

function roleToRequestKind(
  role: CanvasGatewayListedModel["role"] | "TTS" | "TRYON",
): GatewayCatalogRequestKind {
  if (role === "LLM") return "CHAT";
  if (role === "IMAGE") return "IMAGE";
  if (role === "VIDEO") return "VIDEO";
  if (role === "TTS") return "TTS";
  if (role === "TRYON") return "TRYON";
  return "OTHER";
}

function fromListed(
  m: CanvasGatewayListedModel,
  providerKind: GatewayProviderKind,
  products: string[],
): GatewayCatalogModel {
  const routed = routeGatewayModel(m.modelKey);
  return {
    modelKey: m.modelKey,
    displayName: m.displayName,
    requestKind:
      routed.providerKind === providerKind
        ? (routed.requestKind as GatewayCatalogRequestKind)
        : roleToRequestKind(m.role),
    role: m.role,
    description: m.description ?? null,
    products,
  };
}

function sortModels(models: GatewayCatalogModel[]): GatewayCatalogModel[] {
  return [...models].sort((a, b) => {
    const rk = a.requestKind.localeCompare(b.requestKind);
    if (rk !== 0) return rk;
    return a.modelKey.localeCompare(b.modelKey);
  });
}

function dedupeByKey(models: GatewayCatalogModel[]): GatewayCatalogModel[] {
  const seen = new Map<string, GatewayCatalogModel>();
  for (const m of models) {
    const key = `${m.modelKey}::${m.requestKind}`;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, m);
      continue;
    }
    const products = [...new Set([...prev.products, ...m.products])];
    seen.set(key, { ...prev, products });
  }
  return [...seen.values()];
}

/** 平台全量模型目录；boundKinds 来自当前用户已绑定的厂商凭证 */
export function buildGatewayModelCatalog(
  boundKinds: GatewayProviderKind[],
): GatewayModelCatalog {
  const bound = new Set(boundKinds);

  const kieModels = sortModels(
    KIE_KNOWN_MODELS.map((m) =>
      fromListed(m, "KIE", ["Canvas", "Story"]),
    ),
  );

  const deepseekModels = sortModels(
    DEEPSEEK_KNOWN_MODELS.map((m) =>
      fromListed(m, "DEEPSEEK", ["Canvas", "Story", "工具站"]),
    ),
  );

  const bailianModels = sortModels(
    BAILIAN_R2V_KNOWN_MODELS.map((m) =>
      fromListed(m, "BAILIAN", ["Canvas"]),
    ),
  );

  const hunyuanModels = sortModels(
    listHunyuanKnownModels().map((m) =>
      fromListed(m, "HUNYUAN", ["Canvas"]),
    ),
  );

  const dashscopeModels = sortModels(
    dedupeByKey([
      ...DASHSCOPE_TOOL_OTHER,
      ...DASHSCOPE_LAB_VIDEO.map((m) => ({
        modelKey: m.modelKey,
        displayName: m.displayName,
        requestKind: m.requestKind,
        role: "VIDEO" as const,
        description: m.description,
        products: m.products,
      })),
    ]),
  );

  const groups: GatewayCatalogGroup[] = (
    [
      ["KIE", kieModels],
      ["DEEPSEEK", deepseekModels],
      ["BAILIAN", bailianModels],
      ["DASHSCOPE", dashscopeModels],
      ["HUNYUAN", hunyuanModels],
    ] as const
  ).map(([providerKind, models]) => ({
    providerKind,
    label: PROVIDER_LABEL[providerKind],
    credentialBound: bound.has(providerKind),
    models,
  }));

  const totalCount = groups.reduce((n, g) => n + g.models.length, 0);

  return { groups, totalCount, boundKinds };
}
