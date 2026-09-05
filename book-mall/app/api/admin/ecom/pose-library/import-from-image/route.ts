import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { importPoseFromImage } from "@/lib/ecom/ecom-pose-library-import";

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

  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl 必填" }, { status: 400 });
  }

  const savePrompt = body.savePrompt === true;
  const prompt = typeof body.prompt === "string" ? body.prompt : undefined;
  const category = typeof body.category === "string" ? body.category : undefined;
  const sourceModule = typeof body.sourceModule === "string" ? body.sourceModule : undefined;
  const sourceAssetId = typeof body.sourceAssetId === "string" ? body.sourceAssetId : undefined;

  try {
    const result = await importPoseFromImage({
      imageUrl,
      savePrompt,
      prompt,
      category,
      sourceModule,
      sourceAssetId,
      adminUserId: auth.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "该图片已在姿势库中",
          existingId: result.existingId,
          existingTitle: result.existingTitle,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ entry: result.entry }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "入库失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
