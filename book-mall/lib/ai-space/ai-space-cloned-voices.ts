/**
 * AI 空间 · 克隆音色（与快速复制「我的作品」一一对应）
 */

import { listQrVoiceCloneCatalogEntries } from "@/lib/quick-replica/qr-voice-clone-records";

export type AiSpaceClonedVoiceItem = {
  catalogId: string;
  voiceId: string;
  label: string;
  subtitle: string;
  language?: string;
  previewUrl?: string;
  tags: string[];
  avatarLetter: string;
  clonedAt?: string;
  /** 克隆原文 · 调参试听按各音色自己的样音合成 */
  sampleText?: string;
  /** 是否可用作 TTS 音色（已解析到 MiniMax voice_id） */
  selectable: boolean;
};

function formatCloneDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function isSelectableVoiceId(voiceId: string): boolean {
  const id = voiceId.trim();
  if (!id || id.startsWith("unknown-")) return false;
  return true;
}

/** 拉取克隆音色列表（每条「我的作品」一项，带试听 URL） */
export async function listAiSpaceClonedVoices(
  userId: string,
): Promise<AiSpaceClonedVoiceItem[]> {
  try {
    const entries = await listQrVoiceCloneCatalogEntries(userId);
    return entries.map((entry) => {
      const label = entry.label || entry.voiceId;
      const selectable = isSelectableVoiceId(entry.voiceId);
      return {
        catalogId: entry.catalogId,
        voiceId: entry.voiceId,
        label,
        subtitle: selectable
          ? `克隆于 ${formatCloneDate(entry.clonedAt)}`
          : "快速复制 · 缺少 voice_id",
        previewUrl: entry.previewUrl,
        tags: ["cloned"],
        avatarLetter: label.charAt(0) || "我",
        clonedAt: entry.clonedAt,
        sampleText: entry.sampleText,
        selectable,
      };
    });
  } catch (e) {
    console.warn("[ai-space] listAiSpaceClonedVoices failed", e);
    return [];
  }
}
