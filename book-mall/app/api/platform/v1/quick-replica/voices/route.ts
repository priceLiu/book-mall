import { NextResponse } from "next/server";

import { qrListElevenLabsVoices } from "@/lib/quick-replica/qr-text-to-audio-service";
import {
  getMinimaxVoicePage,
} from "@/lib/quick-replica/minimax-voice-catalog";
import { QR_AUDIO_VOICES } from "@/lib/quick-replica/qr-audio-catalog";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

function elevenLabsCatalogFallback() {
  return QR_AUDIO_VOICES.filter((v) => v.tags?.includes("elevenlabs")).map((v) => ({
    voiceId: v.voiceId,
    label: v.label,
    subtitle: v.subtitle,
    language: v.language,
    previewUrl: v.previewUrl,
    tags: v.tags,
    avatarLetter: v.avatarLetter,
  }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider")?.trim().toLowerCase() ?? "minimax";

  if (provider === "elevenlabs" || provider === "eleven") {
    const auth = await requireQuickReplicaUser(request);
    if (!auth.ok) return auth.response;
    try {
      const items = await qrListElevenLabsVoices(auth.userId);
      return NextResponse.json({
        items,
        total: items.length,
        page: 1,
        pageSize: items.length,
        hasMore: false,
        live: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "elevenlabs_voices_failed";
      const fallback = elevenLabsCatalogFallback();
      if (fallback.length > 0) {
        return NextResponse.json({
          items: fallback,
          total: fallback.length,
          page: 1,
          pageSize: fallback.length,
          hasMore: false,
          live: false,
          warning: message,
        });
      }
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "40", 10);
  const result = getMinimaxVoicePage({ page, pageSize });
  return NextResponse.json({
    items: result.items.map((v) => ({
      voiceId: v.voiceId,
      label: v.label,
      subtitle: v.language,
      language: v.language,
      previewUrl: v.previewUrl,
      tags: v.tags,
      avatarLetter: v.avatarLetter ?? v.label.charAt(0),
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.hasMore,
  });
}
