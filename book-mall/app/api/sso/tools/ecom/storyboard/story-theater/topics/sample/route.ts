import { NextResponse } from "next/server";

import {
  sampleStoryTheaterTopics,
  type StoryTheaterVertical,
} from "@/lib/ecom/ecom-story-theater-topic-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

function parseVertical(raw: string | null): StoryTheaterVertical | null {
  if (raw === "fashion_apparel" || raw === "bags" || raw === "digital_3c") return raw;
  return null;
}

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const url = new URL(req.url);
  const vertical = parseVertical(url.searchParams.get("vertical"));
  if (!vertical) {
    return NextResponse.json({ error: "vertical 必填" }, { status: 400 });
  }
  const countRaw = url.searchParams.get("count");
  const count = countRaw ? Number.parseInt(countRaw, 10) : 5;
  const exclude = url.searchParams.getAll("excludeId").filter(Boolean);
  try {
    const topics = await sampleStoryTheaterTopics({
      vertical,
      userId: auth.userId,
      count: Number.isFinite(count) ? Math.min(Math.max(count, 1), 10) : 5,
      excludeIds: exclude,
    });
    return NextResponse.json({ topics });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message, topics: [] }, { status: 500 });
  }
}
