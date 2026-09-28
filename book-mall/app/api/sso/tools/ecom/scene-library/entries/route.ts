import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { createUserSceneEntry } from "@/lib/ecom/ecom-scene-library-service";
import { isSceneArchetype } from "@/lib/ecom/model-shot/scene-pose-rules";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const visualPrompt = typeof body.visualPrompt === "string" ? body.visualPrompt.trim() : "";
    const archetypeRaw = typeof body.archetype === "string" ? body.archetype.trim() : "";
    if (!name || !visualPrompt || !isSceneArchetype(archetypeRaw)) {
      return ecomJson({ error: "name、visualPrompt、archetype 必填" }, { status: 400 });
    }
    const entry = await createUserSceneEntry(auth.userId, {
      name,
      visualPrompt,
      archetype: archetypeRaw,
    });
    return ecomJson({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
