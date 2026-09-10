import { NextResponse } from "next/server";

import {
  importCatalogFromImage,
  type CatalogImportFromImageInput,
} from "@/lib/ecom/ecom-catalog-import-from-image";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import type { GlobalAssetCatalogKind } from "@/lib/ecom/ecom-global-asset-catalog";
import type { EcomPoseGender } from "@/lib/ecom/ecom-pose-library-meta";
import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

function readCatalogKind(raw: unknown): GlobalAssetCatalogKind | null {
  if (
    raw === "pose" ||
    raw === "avatar" ||
    raw === "garment" ||
    raw === "full-body"
  ) {
    return raw;
  }
  return null;
}

function readScope(raw: unknown): EcomCatalogScope | undefined {
  if (raw === "platform" || raw === "user" || raw === "team") return raw;
  return undefined;
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const catalogKind = readCatalogKind(body.catalogKind);
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!catalogKind || !imageUrl) {
    return NextResponse.json(
      { error: "catalogKind 与 imageUrl 必填" },
      { status: 400 },
    );
  }

  const elig = await getToolsSsoEligibility(auth.userId);
  const isPlatformAdmin = elig.isAdmin;

  const scope = readScope(body.scope);
  if (scope === "platform" && !isPlatformAdmin) {
    return NextResponse.json({ error: "仅平台管理员可设为全平台" }, { status: 403 });
  }
  if (scope === "team") {
    return NextResponse.json({ error: "团队可见暂未开放" }, { status: 501 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);

    const input: CatalogImportFromImageInput = {
      catalogKind,
      imageUrl,
      actorUserId: auth.userId,
      isPlatformAdmin,
      scope: scope ?? (isPlatformAdmin ? undefined : "user"),
      tenantId:
        typeof body.tenantId === "string" ? body.tenantId : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      gender: body.gender === "male" ? "male" : "female",
      savePrompt: body.savePrompt === true,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      genders: Array.isArray(body.genders)
        ? (body.genders.filter((g) => typeof g === "string") as EcomPoseGender[])
        : undefined,
      sceneTags: Array.isArray(body.sceneTags)
        ? body.sceneTags.filter((t): t is string => typeof t === "string")
        : undefined,
      sourceModule: typeof body.sourceModule === "string" ? body.sourceModule : undefined,
      sourceAssetId:
        typeof body.sourceAssetId === "string" ? body.sourceAssetId : undefined,
    };

    const result = await importCatalogFromImage(input);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "该图片已在库中",
          existingId: result.existingId,
          existingTitle: result.existingTitle,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "入库失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
