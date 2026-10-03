import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  getEcomPosterProject,
  updateEcomPosterProject,
} from "@/lib/ecom/ecom-poster-service";
import { generatePosterImages } from "@/lib/ecom/ecom-poster-generate";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import type { EcomCopyImageArtifact } from "@private/ecom-copy-overlay";

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
  const lines = Array.isArray(body.lines)
    ? body.lines.flatMap((l) => (typeof l === "string" && l.trim() ? [l.trim()] : []))
    : [];
  if (lines.length === 0) {
    return ecomJson({ error: "请提供 lines 文案列表" }, { status: 400 });
  }
  if (lines.length > 20) {
    return ecomJson({ error: "单次最多 20 条文案" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomPosterProject(auth.userId, params.id);
    if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
    const artifacts: EcomCopyImageArtifact[] = [];
    for (const line of lines) {
      const { artifacts: batch } = await generatePosterImages({
        userId: auth.userId,
        projectId: params.id,
        plan: project.plan,
        settings: project.settings,
        references: project.references,
        slotCopy: line,
        count: 1,
        gatewayAction: "batch-generate",
      });
      if (batch[0]) artifacts.push(batch[0]);
    }
    const plan = {
      ...project.plan,
      artifacts: [...project.plan.artifacts, ...artifacts],
    };
    const updated = await updateEcomPosterProject(auth.userId, params.id, { plan });
    return ecomJson({ project: updated, count: artifacts.length });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "批量生成失败" }, { status: 400 });
  }
}
