import { NextResponse } from "next/server";

import { uploadDetailPageSuiteReplicaReference } from "@/lib/ecom/detail-page-suite/project-service";
import type { DetailPageSuiteReferenceRole } from "@/lib/ecom/detail-page-suite/types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

function parseRole(raw: FormDataEntryValue | null): DetailPageSuiteReferenceRole {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "reference_suite" || v === "model") return v;
  return "product";
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file 必填" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const rawLabel = form.get("label");
  const role = parseRole(form.get("role"));
  const project = await uploadDetailPageSuiteReplicaReference({
    userId: auth.userId,
    projectId: id,
    buf,
    contentType: file.type || "image/jpeg",
    label: typeof rawLabel === "string" ? rawLabel : undefined,
    role,
  });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ project });
}
