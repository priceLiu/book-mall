import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

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
  const kinds: GlobalAssetCatalogKind[] = [
    "pose",
    "avatar",
    "garment",
    "full-body",
    "style",
    "scene",
    "character",
    "reference",
    "prop",
    "storyboard-image",
    "storyboard-video",
    "audio",
  ];
  if (typeof raw === "string" && (kinds as string[]).includes(raw)) {
    return raw as GlobalAssetCatalogKind;
  }
  return null;
}

function readScope(raw: unknown): EcomCatalogScope | undefined {
  if (raw === "platform" || raw === "user" || raw === "team" || raw === "project") {
    return raw;
  }
  return undefined;
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "Invalid JSON" }, { status: 400 });
  }

  const catalogKind = readCatalogKind(body.catalogKind);
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!catalogKind || !imageUrl) {
    return ecomJson(
      { error: "catalogKind 与 imageUrl 必填" },
      { status: 400 },
    );
  }

  const elig = await getToolsSsoEligibility(auth.userId);
  const isPlatformAdmin = elig.isAdmin;

  const scope = readScope(body.scope);
  if (scope === "platform" && !isPlatformAdmin) {
    return ecomJson({ error: "仅平台管理员可设为全平台" }, { status: 403 });
  }
  const sourceModule =
    typeof body.sourceModule === "string" ? body.sourceModule : undefined;
  const canvasVisionImport =
    sourceModule === "canvas" &&
    (catalogKind === "style" || catalogKind === "scene");

  try {
    if (!canvasVisionImport) {
      await assertEcomToolkitGatewayAccess(auth.userId);
    }

    const input: CatalogImportFromImageInput = {
      catalogKind,
      imageUrl,
      actorUserId: auth.userId,
      isPlatformAdmin,
      scope: scope ?? (isPlatformAdmin ? undefined : "user"),
      tenantId:
        typeof body.tenantId === "string" ? body.tenantId : undefined,
      sourceProjectId:
        typeof body.sourceProjectId === "string" ? body.sourceProjectId : undefined,
      preferredTenantId: auth.preferredTenantId,
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
      sourceModule,
      sourceAssetId:
        typeof body.sourceAssetId === "string" ? body.sourceAssetId : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey.trim() : undefined,
      canvasProjectId:
        typeof body.projectId === "string" ? body.projectId.trim() : undefined,
    };

    const result = await importCatalogFromImage(input);
    if (!result.ok) {
      return ecomJson(
        {
          error: "该图片已在库中",
          existingId: result.existingId,
          existingTitle: result.existingTitle,
        },
        { status: 409 },
      );
    }
    return ecomJson(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "入库失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
