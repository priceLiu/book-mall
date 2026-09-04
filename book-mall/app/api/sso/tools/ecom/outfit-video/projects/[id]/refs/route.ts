import { NextResponse } from "next/server";

import {
  attachEcomOutfitVideoRefs,
  uploadEcomOutfitVideoRefImage,
} from "@/lib/ecom/ecom-outfit-video-service";
import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const UPLOAD_ROLES = ["model", "clothing", "topGarment", "bottomGarment"] as const;
type UploadRole = (typeof UPLOAD_ROLES)[number];

const PATCH_KEYS = ["model", "clothing", "topGarment", "bottomGarment"] as const;

function isUploadRole(v: unknown): v is UploadRole {
  return typeof v === "string" && (UPLOAD_ROLES as readonly string[]).includes(v);
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const roleRaw = form.get("role");
    const role = isUploadRole(roleRaw) ? roleRaw : null;
    if (!(file instanceof File) || !role) {
      return NextResponse.json(
        { error: "请上传图片并指定 role=model|clothing|topGarment|bottomGarment" },
        { status: 400 },
      );
    }
    try {
      const project = await uploadEcomOutfitVideoRefImage(auth.userId, id, role, file);
      return NextResponse.json({ project });
    } catch (e) {
      const message = e instanceof Error ? e.message : "上传失败";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const patch: Partial<WorkflowRefs> = {};
  for (const key of PATCH_KEYS) {
    const v = body[key];
    if (v && typeof v === "object") {
      const r = v as Record<string, unknown>;
      if (typeof r.ossUrl === "string" && r.ossUrl.trim()) {
        patch[key] = {
          ossUrl: r.ossUrl.trim(),
          label: typeof r.label === "string" ? r.label : undefined,
          source:
            typeof r.source === "string"
              ? (r.source as NonNullable<WorkflowRefs[typeof key]>["source"])
              : undefined,
        };
      }
    }
  }

  try {
    const project = await attachEcomOutfitVideoRefs(auth.userId, id, patch);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "绑定参考失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
