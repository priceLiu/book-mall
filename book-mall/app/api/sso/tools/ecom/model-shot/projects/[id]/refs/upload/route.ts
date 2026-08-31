import { NextResponse } from "next/server";

import {
  getEcomModelShotProject,
  updateEcomModelShotProject,
  uploadModelShotReference,
} from "@/lib/ecom/ecom-model-shot-service";
import { rebuildModelShotItemPrompt } from "@/lib/ecom/model-shot/prompt-assembler";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const form = await req.formData();
  const file = form.get("file");
  const roleRaw = form.get("role");
  const role =
    roleRaw === "garment" || roleRaw === "model" || roleRaw === "scene" || roleRaw === "prop"
      ? roleRaw
      : null;
  if (!file || !(file instanceof File) || !role) {
    return NextResponse.json({ error: "file 与 role 必填" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const project = await uploadModelShotReference({
    userId: auth.userId,
    projectId: id,
    role,
    buf,
    contentType: file.type || "image/jpeg",
    label: typeof form.get("label") === "string" ? form.get("label") as string : undefined,
    source: typeof form.get("source") === "string" ? form.get("source") as string : "upload",
    catalogId: typeof form.get("catalogId") === "string" ? form.get("catalogId") as string : undefined,
    name: typeof form.get("name") === "string" ? form.get("name") as string : undefined,
    description:
      typeof form.get("description") === "string" ? form.get("description") as string : undefined,
  });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const project = await getEcomModelShotProject(auth.userId, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const index = typeof body.index === "number" ? body.index : null;
  if (!index) {
    return NextResponse.json({ error: "index 必填" }, { status: 400 });
  }

  const target = project.plan.items.find((item) => item.index === index);
  if (!target) {
    return NextResponse.json({ error: "姿势条目不存在" }, { status: 404 });
  }

  const hasStructuredPatch =
    typeof body.poseDescription === "string" ||
    typeof body.sceneText === "string" ||
    typeof body.propText === "string" ||
    typeof body.sceneCatalogId === "string" ||
    body.sceneCatalogId === null ||
    typeof body.propCatalogId === "string" ||
    body.propCatalogId === null ||
    body.applySceneToAll === true ||
    body.applyPropToAll === true;

  if (typeof body.prompt === "string" && !hasStructuredPatch) {
    const items = project.plan.items.map((item) =>
      item.index === index ? { ...item, prompt: body.prompt as string, promptEdited: true } : item,
    );
    const updated = await updateEcomModelShotProject(auth.userId, id, {
      plan: { ...project.plan, items },
    });
    return NextResponse.json({ project: updated });
  }

  if (!hasStructuredPatch) {
    return NextResponse.json({ error: "请提供 prompt 或姿势/场景/道具字段" }, { status: 400 });
  }

  const sceneCatalogId =
    typeof body.sceneCatalogId === "string"
      ? body.sceneCatalogId
      : body.sceneCatalogId === null
        ? undefined
        : undefined;
  const propCatalogId =
    typeof body.propCatalogId === "string"
      ? body.propCatalogId
      : body.propCatalogId === null
        ? undefined
        : undefined;

  const patchOne = (item: typeof target) => {
    const nextItem = {
      ...item,
      ...(typeof body.poseDescription === "string"
        ? { poseDescription: body.poseDescription }
        : {}),
      ...(typeof body.sceneText === "string" ? { sceneText: body.sceneText } : {}),
      ...(typeof body.propText === "string" ? { propText: body.propText } : {}),
      ...(body.sceneCatalogId !== undefined ? { sceneCatalogId: sceneCatalogId ?? undefined } : {}),
      ...(body.propCatalogId !== undefined ? { propCatalogId: propCatalogId ?? undefined } : {}),
      promptEdited: true,
    };
    nextItem.prompt = rebuildModelShotItemPrompt({
      item: nextItem,
      brief: project.brief,
      references: project.references,
    });
    return nextItem;
  };

  const applySceneAll = body.applySceneToAll === true;
  const applyPropAll = body.applyPropToAll === true;
  const items = project.plan.items.map((item) => {
    if (applySceneAll || applyPropAll) {
      const shouldPatch =
        (applySceneAll &&
          (typeof body.sceneText === "string" || body.sceneCatalogId !== undefined)) ||
        (applyPropAll &&
          (typeof body.propText === "string" || body.propCatalogId !== undefined));
      if (!shouldPatch) return item;
      return patchOne(item);
    }
    if (item.index !== index) return item;
    return patchOne(item);
  });

  const updated = await updateEcomModelShotProject(auth.userId, id, {
    plan: { ...project.plan, items },
  });
  return NextResponse.json({ project: updated });
}
