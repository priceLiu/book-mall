import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { generatePoseLibraryPreviews } from "@/lib/ecom/ecom-pose-library-generate-preview";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const poseIds = Array.isArray(body.poseIds)
    ? body.poseIds.filter((id): id is string => typeof id === "string")
    : [];
  const modelCatalogId =
    typeof body.modelCatalogId === "string" ? body.modelCatalogId.trim() : "";
  if (poseIds.length === 0 || !modelCatalogId) {
    return NextResponse.json({ error: "poseIds 与 modelCatalogId 必填" }, { status: 400 });
  }

  try {
    const { results } = await generatePoseLibraryPreviews({
      adminUserId: auth.userId,
      poseIds,
      modelCatalogId,
      garmentOssUrl:
        typeof body.garmentOssUrl === "string" ? body.garmentOssUrl.trim() : undefined,
      garmentDescription:
        typeof body.garmentDescription === "string" ? body.garmentDescription : undefined,
      sceneText: typeof body.sceneText === "string" ? body.sceneText : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      ratio:
        body.ratio === "1:1" ||
        body.ratio === "4:5" ||
        body.ratio === "16:9" ||
        body.ratio === "3:4"
          ? body.ratio
          : undefined,
    });
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
