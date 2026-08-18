/**
 * 快速复制 · 生成前积分预览（与 qrCreateGenerateJob 分支对齐，不发起 Gateway）。
 * 仅平台代付（单积分池）；BYOK 产品已下线，不走套餐内/超额分支。
 */
import { getAccountCreditBalances } from "@/lib/billing/credit-account-service";
import { previewModelCredits } from "@/lib/billing/model-credits-preview";
import {
  resolveWorldlabsMarbleModelKey,
  WORLDLABS_DEFAULT_MARBLE_MODEL_KEY,
} from "@/lib/gateway/worldlabs-marble-models";
import { getKindDef } from "@/lib/quick-replica/qr-kinds";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

export type QrCreditsPreviewItem = {
  label: string;
  modelKey: string;
  credits: number;
};

export type QrCreditsPreviewResult = {
  billingPersona: "PLATFORM_CREDIT";
  estimatedCredits: number | null;
  items?: QrCreditsPreviewItem[];
  balance?: number;
  reserved?: number;
  sufficient: boolean;
  label: string;
  reason?: string;
};

type PreviewSpec = {
  label: string;
  modelKey: string;
  durationSec?: number | null;
  imageCount?: number | null;
  resolution?: string | null;
};

function isQrTextToImageCharacterKind(kind: string): boolean {
  return kind === "create-character" || kind === "character-image";
}

function isQrTextToAudioKind(draft: QrWorkspaceDraft): boolean {
  return (
    draft.category === "audio" &&
    (draft.kind === "create-voiceover" ||
      draft.kind === "create-music" ||
      draft.kind === "create-sfx" ||
      draft.kind === "voice-clone" ||
      draft.kind === "voice-changer")
  );
}

function resolveVideoDurationSec(draft: QrWorkspaceDraft): number | null {
  if (draft.duration != null && Number.isFinite(draft.duration)) {
    return draft.duration;
  }
  return null;
}

function resolveSfxDurationSec(draft: QrWorkspaceDraft): number | null {
  if (draft.sfxDurationAuto) return 5;
  if (draft.sfxDurationSeconds != null && Number.isFinite(draft.sfxDurationSeconds)) {
    return draft.sfxDurationSeconds;
  }
  return 5;
}

function resolveMusicDurationSec(draft: QrWorkspaceDraft): number | null {
  if (draft.musicDurationAuto) return 180;
  if (draft.musicDurationSeconds != null && Number.isFinite(draft.musicDurationSeconds)) {
    return draft.musicDurationSeconds;
  }
  return 180;
}

function resolvePreviewSpecsFromDraft(draft: QrWorkspaceDraft): PreviewSpec[] {
  const kindDef = getKindDef(draft.kind);
  const defaultLabel = kindDef?.label ?? draft.kind;

  if (draft.kind === "motion-sync" || draft.toolKey === "motion-sync") {
    return [
      {
        label: "运动同步",
        modelKey: draft.modelKey.trim() || "kling-2.6/motion-control",
        durationSec: resolveVideoDurationSec(draft),
        resolution: draft.resolution?.trim() || null,
      },
    ];
  }

  if (draft.kind === "text-to-video") {
    return [
      {
        label: "文生视频",
        modelKey: draft.modelKey.trim(),
        durationSec: resolveVideoDurationSec(draft),
        resolution: draft.resolution?.trim() || null,
      },
    ];
  }

  if (draft.kind === "create-image" || isQrTextToImageCharacterKind(draft.kind)) {
    return [
      {
        label: defaultLabel,
        modelKey: draft.modelKey.trim(),
        imageCount: 1,
        resolution: draft.resolution?.trim() || null,
      },
    ];
  }

  if (isQrTextToAudioKind(draft)) {
    const modelKey = draft.modelKey.trim();
    if (draft.kind === "create-sfx") {
      return [
        {
          label: "音效",
          modelKey,
          durationSec: resolveSfxDurationSec(draft),
        },
      ];
    }
    if (draft.kind === "create-music") {
      return [
        {
          label: "音乐",
          modelKey,
          durationSec: resolveMusicDurationSec(draft),
        },
      ];
    }
    return [
      {
        label: defaultLabel,
        modelKey,
      },
    ];
  }

  if (draft.category === "world" && draft.kind === "create-world") {
    const modelKey = resolveWorldlabsMarbleModelKey(
      draft.modelKey.trim() || WORLDLABS_DEFAULT_MARBLE_MODEL_KEY,
    );
    return [
      {
        label: "世界生成",
        modelKey,
      },
    ];
  }

  const modelKey = draft.modelKey.trim() || "lib-nano-pro";
  const isVideo =
    draft.category === "video" ||
    draft.category === "character" ||
    draft.category === "world" ||
    kindDef?.toolKey?.includes("video") ||
    draft.kind.includes("video");

  if (isVideo && draft.category !== "image") {
    return [
      {
        label: defaultLabel,
        modelKey,
        durationSec: resolveVideoDurationSec(draft),
        resolution: draft.resolution?.trim() || null,
      },
    ];
  }

  return [
    {
      label: defaultLabel,
      modelKey,
      imageCount: 1,
      resolution: draft.resolution?.trim() || null,
    },
  ];
}

export async function previewQrGenerateCredits(
  userId: string,
  draft: QrWorkspaceDraft,
): Promise<QrCreditsPreviewResult> {
  const owner = { ownerType: "USER" as const, ownerId: userId };
  const specs = resolvePreviewSpecsFromDraft(draft);
  const items: QrCreditsPreviewItem[] = [];
  let total = 0;
  let missingModel: string | null = null;

  for (const spec of specs) {
    if (!spec.modelKey.trim()) {
      missingModel = spec.label;
      continue;
    }
    const preview = await previewModelCredits({
      modelKey: spec.modelKey,
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      durationSec: spec.durationSec,
      imageCount: spec.imageCount,
      resolution: spec.resolution,
    });
    if (!preview) {
      missingModel = spec.modelKey;
      continue;
    }
    const credits = Math.max(0, Math.round(preview.estimatedCredits));
    items.push({ label: spec.label, modelKey: spec.modelKey, credits });
    total += credits;
  }

  if (items.length === 0) {
    return {
      billingPersona: "PLATFORM_CREDIT",
      estimatedCredits: null,
      sufficient: false,
      label: "暂无报价",
      reason: missingModel
        ? `模型 ${missingModel} 报价未配置`
        : "缺少 modelKey",
    };
  }

  const snap = await getAccountCreditBalances(owner);
  const available = Math.max(0, snap.balance - snap.reserved);
  const sufficient = available >= total;

  return {
    billingPersona: "PLATFORM_CREDIT",
    estimatedCredits: total,
    items,
    balance: snap.balance,
    reserved: snap.reserved,
    sufficient,
    label: `约 ${total} 积分`,
  };
}
