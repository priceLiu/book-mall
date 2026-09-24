import { NextResponse } from "next/server";

import { saveImageLayerResultToLibrary } from "@/lib/ecom/ecom-image-layer-project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const projectId =
    typeof body.projectId === "string" ? body.projectId.trim() : "";
  const ossUrl = typeof body.ossUrl === "string" ? body.ossUrl.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : undefined;

  if (!projectId) {
    return NextResponse.json({ error: "缺少 projectId" }, { status: 400 });
  }
  if (!ossUrl) {
    return NextResponse.json({ error: "缺少 ossUrl" }, { status: 400 });
  }

  try {
    const result = await saveImageLayerResultToLibrary(auth.userId, projectId, {
      ossUrl,
      title,
      prompt: prompt ?? null,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存失败";
    const status = msg === "项目不存在" ? 404 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
