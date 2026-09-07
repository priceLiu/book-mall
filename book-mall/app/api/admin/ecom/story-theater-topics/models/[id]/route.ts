import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  deleteStoryTheaterTopic,
  getStoryTheaterTopicById,
  upsertStoryTheaterTopic,
  type StoryTheaterVertical,
} from "@/lib/ecom/ecom-story-theater-topic-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function parseVertical(raw: unknown): StoryTheaterVertical | null {
  if (raw === "fashion_apparel" || raw === "bags" || raw === "digital_3c") return raw;
  return null;
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const existing = await getStoryTheaterTopicById(id);
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const vertical = parseVertical(body.vertical) ?? existing.vertical;
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string")
    : existing.tags;

  const saved = await upsertStoryTheaterTopic({
    ...existing,
    vertical,
    title: typeof body.title === "string" ? body.title : existing.title,
    storyCore: typeof body.storyCore === "string" ? body.storyCore : existing.storyCore,
    storyType: typeof body.storyType === "string" ? body.storyType : existing.storyType,
    tags,
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : existing.sortOrder ?? 0,
  });
  return NextResponse.json({ entry: saved });
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const ok = await deleteStoryTheaterTopic(id);
  if (!ok) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
