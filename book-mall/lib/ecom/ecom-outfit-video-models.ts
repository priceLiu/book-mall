import type { GatewayProviderKind } from "@prisma/client";

import { BAILIAN_R2V_KNOWN_MODELS } from "@/lib/canvas/providers/bailian-r2v";
import type { EcomStoryboardGatewayModel } from "@/lib/gateway/ecom-storyboard-chat-models";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";

/** 穿搭视频 · 动作迁移主路径（参考片段 + 模特图 · 复刻运镜/场景/光影） */
export const OUTFIT_VIDEO_MOTION_MODEL_KEYS = [
  "kling-3.0/motion-control",
  "kling-2.6/motion-control",
  "wan/2-6-video-to-video",
] as const;

/** 穿搭视频 · 百炼 R2V 备选（参考帧 + 模特/服装图） */
export const OUTFIT_VIDEO_R2V_MODEL_KEYS = [
  "wan2.7-r2v",
  "wan2.6-r2v",
  "wan2.6-r2v-flash",
  "happyhorse-1.1-r2v",
  "happyhorse-1.0-r2v",
] as const;

export const OUTFIT_VIDEO_ALL_MODEL_KEYS = [
  ...OUTFIT_VIDEO_MOTION_MODEL_KEYS,
  ...OUTFIT_VIDEO_R2V_MODEL_KEYS,
] as const;

const OUTFIT_VIDEO_MODEL_SORT_INDEX = new Map<string, number>(
  OUTFIT_VIDEO_ALL_MODEL_KEYS.map((k, i) => [k, i]),
);

export const OUTFIT_VIDEO_KLING_MOTION_META: EcomStoryboardGatewayModel[] = [
  {
    modelKey: "kling-3.0/motion-control",
    displayName: "Kling 3.0 动作控制",
    description:
      "参考片段驱动运镜与动作；单模特参考图。若同时锁定模特+服装两张参考，系统自动改走万相 R2V",
    role: "VIDEO",
    providerKind: "KIE",
    credentialBound: true,
  },
  {
    modelKey: "kling-2.6/motion-control",
    displayName: "Kling 2.6 动作控制",
    description: "参考片段动作迁移，保留背景与镜头语言",
    role: "VIDEO",
    providerKind: "KIE",
    credentialBound: true,
  },
  {
    modelKey: "wan/2-6-video-to-video",
    displayName: "Wan 2.6 视频生视频",
    description: "以参考片段为底，按 Prompt 换模特/服装，保留运镜时序",
    role: "VIDEO",
    providerKind: "KIE",
    credentialBound: true,
  },
];

export function isOutfitVideoKlingMotionControlModel(modelKey: string): boolean {
  const m = modelKey.trim();
  return m === "kling-3.0/motion-control" || m === "kling-2.6/motion-control";
}

export function isOutfitVideoKieModel(modelKey: string): boolean {
  return OUTFIT_VIDEO_MOTION_MODEL_KEYS.includes(
    modelKey.trim() as (typeof OUTFIT_VIDEO_MOTION_MODEL_KEYS)[number],
  );
}

export function resolveOutfitVideoGenerateProvider(
  modelKey: string,
): "kie" | "bailian" {
  if (isOutfitVideoKieModel(modelKey)) return "kie";
  return "bailian";
}

/** 穿搭逐镜生成模型校验（勿走电商分镜 resolveStoryboardVideoModel，Kling 动作控制不在该白名单） */
export function resolveOutfitVideoGenerateModelKey(modelKey?: string): string {
  const raw = modelKey?.trim() ?? "";
  if (!raw) {
    throw new Error("请选择视频模型");
  }
  if ((OUTFIT_VIDEO_ALL_MODEL_KEYS as readonly string[]).includes(raw)) {
    return raw;
  }
  throw new Error(
    `视频模型「${raw}」不支持穿搭逐镜生成；请选用 Kling 动作控制或百炼 R2V（如 wan2.7-r2v）。`,
  );
}

function sortOutfitVideoModels(rows: EcomStoryboardGatewayModel[]): EcomStoryboardGatewayModel[] {
  return [...rows].sort((a, b) => {
    const ai = OUTFIT_VIDEO_MODEL_SORT_INDEX.get(a.modelKey) ?? 999;
    const bi = OUTFIT_VIDEO_MODEL_SORT_INDEX.get(b.modelKey) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.displayName.localeCompare(b.displayName, "zh");
  });
}

/** 注册表未同步时，仍保证动作迁移 / R2V 出现在穿搭视频模型弹层（Kling 始终可见） */
export function mergeOutfitVideoGatewayVideoModels(
  rows: EcomStoryboardGatewayModel[],
  boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  const allowed = new Set<string>(OUTFIT_VIDEO_ALL_MODEL_KEYS);
  const kieBound = isGatewayProviderBound(boundKinds, "KIE");
  const bailianBound = isGatewayProviderBound(boundKinds, "BAILIAN");
  const byKey = new Map<string, EcomStoryboardGatewayModel>();

  for (const row of rows.filter((r) => allowed.has(r.modelKey))) {
    byKey.set(row.modelKey, { ...row });
  }

  for (const meta of OUTFIT_VIDEO_KLING_MOTION_META) {
    const existing = byKey.get(meta.modelKey);
    if (existing) {
      byKey.set(meta.modelKey, {
        ...existing,
        displayName: meta.displayName,
        description: meta.description,
        providerKind: meta.providerKind,
        credentialBound:
          existing.credentialBound ||
          existing.platformOffering ||
          kieBound,
      });
    } else {
      byKey.set(meta.modelKey, {
        ...meta,
        credentialBound: kieBound,
      });
    }
  }

  if (bailianBound) {
    for (const m of BAILIAN_R2V_KNOWN_MODELS) {
      if (!allowed.has(m.modelKey)) continue;
      const existing = byKey.get(m.modelKey);
      if (existing) {
        byKey.set(m.modelKey, {
          ...existing,
          credentialBound: existing.credentialBound || bailianBound,
        });
      } else {
        byKey.set(m.modelKey, {
          modelKey: m.modelKey,
          displayName: m.displayName,
          description: m.description ?? "",
          role: "VIDEO",
          providerKind: "BAILIAN",
          credentialBound: true,
        });
      }
    }
  }

  return sortOutfitVideoModels([...byKey.values()]);
}
