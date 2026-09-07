import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  listPlatformStoryTheaterTopicsAll,
  readStoryTheaterCatalogForUser,
  type StoryTheaterVertical,
} from "@/lib/ecom/ecom-story-theater-topic-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

function parseVertical(raw: string | null): StoryTheaterVertical | undefined {
  if (raw === "fashion_apparel" || raw === "bags" || raw === "digital_3c") return raw;
  return undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vertical = parseVertical(url.searchParams.get("vertical"));
  const auth = verifyToolsBearer(req);
  if (auth.ok) {
    try {
      await assertEcomToolkitGatewayAccess(auth.userId);
      const catalog = await readStoryTheaterCatalogForUser(auth.userId, vertical);
      return NextResponse.json(catalog);
    } catch (e) {
      const message = e instanceof Error ? e.message : "加载失败";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  try {
    const platform = await listPlatformStoryTheaterTopicsAll(vertical);
    return NextResponse.json({ topics: platform, platform, user: [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message, topics: [], platform: [], user: [] }, { status: 500 });
  }
}
