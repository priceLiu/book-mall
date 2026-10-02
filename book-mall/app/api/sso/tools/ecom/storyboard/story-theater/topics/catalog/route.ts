import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  listPlatformStoryTheaterTopicsAll,
  readStoryTheaterCatalogForUser,
} from "@/lib/ecom/ecom-story-theater-topic-service";
import { parseStoryTheaterVertical } from "@/lib/ecom/story-theater-vertical-parse";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vertical = parseStoryTheaterVertical(url.searchParams.get("vertical")) ?? undefined;
  const auth = verifyToolsBearer(req);
  if (auth.ok) {
    try {
      await assertEcomToolkitGatewayAccess(auth.userId);
      const catalog = await readStoryTheaterCatalogForUser(auth.userId, vertical);
      return ecomJson(catalog);
    } catch (e) {
      const message = e instanceof Error ? e.message : "加载失败";
      return ecomJson({ error: message }, { status: 500 });
    }
  }
  try {
    const platform = await listPlatformStoryTheaterTopicsAll(vertical);
    return ecomJson({ topics: platform, platform, user: [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return ecomJson({ error: message, topics: [], platform: [], user: [] }, { status: 500 });
  }
}
