import { NextResponse } from "next/server";

import { resolveAiSpaceIdentity } from "@/lib/ai-space/ai-space-auth";
import { getMinimaxVoicePage } from "@/lib/quick-replica/minimax-voice-catalog";

export const dynamic = "force-dynamic";

function mapVoiceCatalogItem(v: {
  voiceId: string;
  label?: string;
  language?: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter?: string;
}) {
  const label = String(v.label ?? v.voiceId ?? "").trim() || v.voiceId;
  const avatar =
    v.avatarLetter?.trim() ||
    (label.charAt(0) ? label.charAt(0).toUpperCase() : "?");
  return {
    voiceId: v.voiceId,
    label,
    subtitle: v.language ?? "",
    language: v.language,
    previewUrl: v.previewUrl,
    tags: v.tags,
    avatarLetter: avatar,
  };
}

/** MiniMax 音色分页列表（与快速复制共用 manifest） */
export async function GET(request: Request) {
  const auth = await resolveAiSpaceIdentity(request);
  if (!auth.ok) return auth.res;

  try {
    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(
      url.searchParams.get("pageSize") ?? "40",
      10,
    );
    const result = getMinimaxVoicePage({ page, pageSize });

    return NextResponse.json({
      items: result.items.map(mapVoiceCatalogItem),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
    });
  } catch (e) {
    console.error("[ai-space/voices] GET failed", e);
    return NextResponse.json({ error: "加载音色失败" }, { status: 500 });
  }
}
