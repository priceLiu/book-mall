import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  createUserStoryTheaterTopic,
  type StoryTheaterVertical,
} from "@/lib/ecom/ecom-story-theater-topic-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

function parseVertical(raw: unknown): StoryTheaterVertical | null {
  if (raw === "fashion_apparel" || raw === "bags" || raw === "digital_3c") return raw;
  return null;
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const vertical = parseVertical(body.vertical);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const storyCore = typeof body.storyCore === "string" ? body.storyCore.trim() : "";
    const storyType = typeof body.storyType === "string" ? body.storyType.trim() : "";
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
      : undefined;
    if (!vertical || !title || !storyCore || !storyType) {
      return NextResponse.json(
        { error: "vertical、title、storyCore、storyType 必填" },
        { status: 400 },
      );
    }
    const entry = await createUserStoryTheaterTopic(auth.userId, {
      vertical,
      title,
      storyCore,
      storyType,
      tags,
    });
    return NextResponse.json({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
