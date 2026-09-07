import { NextResponse } from "next/server";

import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { loadEcomStoryboardGatewayModels } from "@/lib/ecom/ecom-storyboard-models-loader";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 分镜工作室冷启动：模型 + 可选 project 一次返回，减少并发风暴 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const projectId = new URL(req.url).searchParams.get("projectId")?.trim() || null;

  const [models, project] = await Promise.all([
    loadEcomStoryboardGatewayModels(auth.userId),
    projectId
      ? getEcomStoryboardProject(auth.userId, projectId, {
          stripSnapshotHistory: true,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const res = NextResponse.json({ ...models, project });
  res.headers.set("Cache-Control", "private, max-age=0, stale-while-revalidate=120");
  return res;
}
