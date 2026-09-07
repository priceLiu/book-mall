import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  listAllStoryTheaterTopicsForAdmin,
  upsertStoryTheaterTopic,
  type StoryTheaterVertical,
} from "@/lib/ecom/ecom-story-theater-topic-service";

export const dynamic = "force-dynamic";

function parseVertical(raw: unknown): StoryTheaterVertical | null {
  if (raw === "fashion_apparel" || raw === "bags" || raw === "digital_3c") return raw;
  return null;
}

export async function GET(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const vertical = parseVertical(url.searchParams.get("vertical"));
  try {
    const topics = await listAllStoryTheaterTopicsForAdmin(vertical ?? undefined);
    return NextResponse.json({ topics });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message, topics: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const storyCore = typeof body.storyCore === "string" ? body.storyCore.trim() : "";
  const storyType = typeof body.storyType === "string" ? body.storyType.trim() : "";
  const vertical = parseVertical(body.vertical);
  if (!id || !title || !storyCore || !storyType || !vertical) {
    return NextResponse.json(
      { error: "id/title/storyCore/storyType/vertical 必填" },
      { status: 400 },
    );
  }
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string")
    : undefined;
  const entry = await upsertStoryTheaterTopic({
    id,
    vertical,
    title,
    storyCore,
    storyType,
    tags,
    enabled: body.enabled !== false,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    scope: "platform",
  });
  return NextResponse.json({ entry }, { status: 201 });
}
