import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { createUserSceneEntry } from "@/lib/ecom/ecom-scene-library-service";
import { isSceneArchetype } from "@/lib/ecom/model-shot/scene-pose-rules";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const visualPrompt = typeof body.visualPrompt === "string" ? body.visualPrompt.trim() : "";
    const archetypeRaw = typeof body.archetype === "string" ? body.archetype.trim() : "";
    if (!name || !visualPrompt || !isSceneArchetype(archetypeRaw)) {
      return NextResponse.json({ error: "name、visualPrompt、archetype 必填" }, { status: 400 });
    }
    const entry = await createUserSceneEntry(auth.userId, {
      name,
      visualPrompt,
      archetype: archetypeRaw,
    });
    return NextResponse.json({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
