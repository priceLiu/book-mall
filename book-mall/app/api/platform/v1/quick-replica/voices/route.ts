import { NextResponse } from "next/server";

import { getMinimaxVoicePage } from "@/lib/quick-replica/minimax-voice-catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
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
