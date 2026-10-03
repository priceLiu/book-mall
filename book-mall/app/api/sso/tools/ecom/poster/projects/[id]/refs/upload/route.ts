import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { randomUUID } from "crypto";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  getEcomPosterProject,
  updateEcomPosterProject,
  uploadPosterRef,
} from "@/lib/ecom/ecom-poster-service";
import type { PosterRefRole, PosterReference } from "@/lib/ecom/ecom-poster-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const role = String(form.get("role") ?? "product") as PosterRefRole;
  if (!(file instanceof File)) {
    return ecomJson({ error: "缺少 file" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomPosterProject(auth.userId, params.id);
    if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await uploadPosterRef(auth.userId, params.id, buf, file.type || "image/jpeg");
    const ref: PosterReference = {
      id: randomUUID(),
      role:
        role === "model" ||
        role === "garment" ||
        role === "scene" ||
        role === "brand" ||
        role === "style"
          ? role
          : "product",
      ossUrl: url,
      label: file.name,
    };
    const references = [...project.references, ref];
    const updated = await updateEcomPosterProject(auth.userId, params.id, { references });
    return ecomJson({ url, ref, project: updated });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "上传失败" }, { status: 400 });
  }
}
