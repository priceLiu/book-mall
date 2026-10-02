import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { createUserStoryTheaterTopic } from "@/lib/ecom/ecom-story-theater-topic-service";
import { parseStoryTheaterVertical } from "@/lib/ecom/story-theater-vertical-parse";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const vertical = parseStoryTheaterVertical(
      typeof body.vertical === "string" ? body.vertical : null,
    );
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const storyCore = typeof body.storyCore === "string" ? body.storyCore.trim() : "";
    const storyType = typeof body.storyType === "string" ? body.storyType.trim() : "";
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
      : undefined;
    if (!vertical || !title || !storyCore || !storyType) {
      return ecomJson(
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
    return ecomJson({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
