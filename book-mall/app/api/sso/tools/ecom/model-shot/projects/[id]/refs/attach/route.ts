import { NextResponse } from "next/server";

import {
  attachModelShotModelFromLibrary,
  attachModelShotReferenceFromAssets,
  attachModelShotTextReference,
  getEcomModelShotProject,
  updateEcomModelShotProject,
} from "@/lib/ecom/ecom-model-shot-service";
import type { ModelShotReference } from "@/lib/ecom/ecom-model-shot-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const roleRaw = body.role;
  const role =
    roleRaw === "garment" || roleRaw === "model" || roleRaw === "scene" || roleRaw === "prop"
      ? roleRaw
      : null;

  if (Array.isArray(body.assetIds) && role) {
    const project = await attachModelShotReferenceFromAssets(
      auth.userId,
      id,
      role,
      body.assetIds.filter((x): x is string => typeof x === "string"),
    );
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    return NextResponse.json({ project });
  }

  if (body.modelEntry && typeof body.modelEntry === "object" && role === "model") {
    const entry = body.modelEntry as { id?: string; name?: string; ossUrl?: string };
    if (!entry.id || !entry.ossUrl) {
      return NextResponse.json({ error: "modelEntry 无效" }, { status: 400 });
    }
    const project = await attachModelShotModelFromLibrary(auth.userId, id, {
      id: entry.id,
      name: entry.name ?? "模特",
      ossUrl: entry.ossUrl,
    });
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    return NextResponse.json({ project });
  }

  if (typeof body.description === "string" && role && role !== "garment") {
    const project = await attachModelShotTextReference(auth.userId, id, role, body.description);
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    return NextResponse.json({ project });
  }

  const ref = body.reference as ModelShotReference | undefined;
  if (!ref?.role) {
    return NextResponse.json({ error: "reference 无效" }, { status: 400 });
  }

  const project = await getEcomModelShotProject(auth.userId, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const refs = project.references.filter((r) => r.role !== ref.role);
  refs.push(ref);

  const updated = await updateEcomModelShotProject(auth.userId, id, { references: refs });
  return NextResponse.json({ project: updated });
}
