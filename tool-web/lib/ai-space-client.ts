"use client";

/**
 * 我的 AI 空间 客户端调用（经 tool-web 同域 BFF `/api/ai-space/*`）。
 * 空间只保存指向原作品的 Pin，不复制 OSS 文件。
 */

export type AiSpaceSourceType = "t2i_library" | "i2v_library";

export async function pinToAiSpace(
  sourceType: AiSpaceSourceType,
  sourceId: string,
): Promise<void> {
  const r = await fetch("/api/ai-space/pins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType, sourceId }),
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "展示到 AI 空间失败");
  }
}

/** 平台数字人形象（真源在 book-mall，工具站只引用 id 与 URL） */
export type AiSpaceDigitalHumanRef = {
  id: string;
  name: string;
  avatarImageUrl: string;
  status: string;
};

/** 平台音频素材；`durationSec` 供数字人口播 20 秒门禁判断 */
export type AiSpaceAudioRef = {
  id: string;
  name: string;
  audioUrl: string;
  durationSec: number;
  sourceType: string;
  textScript: string | null;
};

/** 选用器：可用数字人形象 */
export async function listAiSpaceDigitalHumans(): Promise<AiSpaceDigitalHumanRef[]> {
  const r = await fetch("/api/ai-space/digital-humans?activeOnly=1", {
    cache: "no-store",
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "读取数字人库失败");
  }
  const data = (await r.json()) as { items?: AiSpaceDigitalHumanRef[] };
  return data.items ?? [];
}

/** 选用器：音频库；`maxDurationSec` 可按门禁过滤 */
export async function listAiSpaceAudioAssets(
  maxDurationSec?: number,
): Promise<AiSpaceAudioRef[]> {
  const qs =
    maxDurationSec && maxDurationSec > 0 ? `?maxDurationSec=${maxDurationSec}` : "";
  const r = await fetch(`/api/ai-space/audio-assets${qs}`, { cache: "no-store" });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "读取音频库失败");
  }
  const data = (await r.json()) as { assets?: AiSpaceAudioRef[] };
  return data.assets ?? [];
}

/** 删素材前问一次引用面（合成任务数 + 是否已展示在作品墙） */
export async function checkAiSpaceMaterialRefs(
  kind: "digital-human" | "audio" | "video",
  id: string,
): Promise<{ composeTaskCount: number; pinned: boolean }> {
  try {
    const r = await fetch(
      `/api/ai-space/refs/check?kind=${kind}&id=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!r.ok) return { composeTaskCount: 0, pinned: false };
    const data = (await r.json()) as {
      refs?: { composeTaskCount?: number };
      pinned?: boolean;
    };
    return {
      composeTaskCount: Number(data.refs?.composeTaskCount ?? 0),
      pinned: data.pinned === true,
    };
  } catch {
    return { composeTaskCount: 0, pinned: false };
  }
}

/** 删源前查是否已展示。失败按未展示处理，不阻断删除流程。 */
export async function isPinnedInAiSpace(
  sourceType: AiSpaceSourceType,
  sourceId: string,
): Promise<boolean> {
  try {
    const r = await fetch(
      `/api/ai-space/pins/check?sourceType=${sourceType}&sourceId=${encodeURIComponent(sourceId)}`,
      { cache: "no-store" },
    );
    if (!r.ok) return false;
    const data = (await r.json()) as { pinnedCount?: number };
    return Number(data.pinnedCount ?? 0) > 0;
  } catch {
    return false;
  }
}
