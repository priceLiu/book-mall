import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { parseEcomCopyImageArtifact } from "@private/ecom-copy-overlay";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { runPosterCompose } from "@/lib/ecom/ecom-poster-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }
  const artifact = parseEcomCopyImageArtifact(body.artifact);
  if (!artifact) return ecomJson({ error: "artifact 无效" }, { status: 400 });
  const artifactIndex =
    typeof body.artifactIndex === "number" ? Math.round(body.artifactIndex) : -1;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await runPosterCompose(
      auth.userId,
      params.id,
      artifactIndex,
      artifact,
      typeof body.slotCopy === "string" ? body.slotCopy : undefined,
    );
    return ecomJson(result);
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "合成失败" }, { status: 400 });
  }
}
