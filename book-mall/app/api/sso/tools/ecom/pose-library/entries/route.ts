import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  normalizePoseGenders,
  normalizePoseSceneTags,
  type EcomPoseGender,
} from "@/lib/ecom/ecom-pose-library-meta";
import { createUserPoseEntry } from "@/lib/ecom/ecom-pose-library-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const category = typeof body.category === "string" ? body.category.trim().toUpperCase() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const baseDescription =
      typeof body.baseDescription === "string" ? body.baseDescription.trim() : "";
    if (!category || !title || !baseDescription) {
      return ecomJson(
        { error: "category、title、baseDescription 必填" },
        { status: 400 },
      );
    }
    const genders = normalizePoseGenders(
      Array.isArray(body.genders) ? (body.genders as EcomPoseGender[]) : ["unisex"],
    );
    const sceneTags = normalizePoseSceneTags(Array.isArray(body.sceneTags) ? body.sceneTags : []);
    const entry = await createUserPoseEntry(auth.userId, {
      category,
      title,
      baseDescription,
      genders,
      sceneTags,
      tags: { genders, sceneTags },
    });
    return ecomJson({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
