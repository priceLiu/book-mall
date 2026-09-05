import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  checkAiSpaceVideoMaterialReferences,
  createAiSpaceVideoMaterial,
  deleteAiSpaceVideoMaterial,
  listAiSpaceVideoLibrary,
  listAiSpaceVideoMaterials,
  probeVideoDurationSec,
  updateAiSpaceVideoMaterial,
} from "@/lib/ai-space/ai-space-video-material-service";
import { isAiSpaceVideoCategory } from "@/lib/ai-space/ai-space-video-types";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 200 * 1024 * 1024;

const EXT_CONTENT_TYPE: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

function resolveExt(mime: string, fileName: string): string | null {
  const byName = /\.(mp4|mov|webm|m4v)$/i.exec(fileName)?.[1]?.toLowerCase();
  if (byName) return byName;
  const m = mime.toLowerCase();
  if (m.includes("mp4")) return "mp4";
  if (m.includes("quicktime")) return "mov";
  if (m.includes("webm")) return "webm";
  return null;
}

/**
 * 列表。默认返回「自有记录 + 作品墙视频 Pin」合并视图；
 * `ownedOnly=1` 只返回本库记录（合成台选背景用）。
 */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const checkRefsFor = url.searchParams.get("checkRefsFor")?.trim();

  try {
    if (checkRefsFor) {
      const refs = await checkAiSpaceVideoMaterialReferences(
        auth.actor.userId,
        checkRefsFor,
      );
      return NextResponse.json({ refs });
    }
    if (url.searchParams.get("ownedOnly") === "1") {
      const materials = await listAiSpaceVideoMaterials(auth.actor.userId);
      return NextResponse.json({ materials });
    }
    const items = await listAiSpaceVideoLibrary(auth.actor.userId);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[ai-space/video-materials] GET failed", e);
    return NextResponse.json({ error: "读取视频创作库失败" }, { status: 500 });
  }
}

/** 上传自拍视频（multipart/form-data：file + 可选 name / category） */
export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return NextResponse.json({ error: "须为 multipart/form-data" }, { status: 415 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "表单解析失败" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少视频文件" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `视频不能超过 ${Math.floor(MAX_BYTES / 1024 / 1024)}MB` },
      { status: 413 },
    );
  }

  const ext = resolveExt(file.type ?? "", file.name ?? "");
  if (!ext) {
    return NextResponse.json({ error: "仅支持 mp4 / mov / webm" }, { status: 415 });
  }

  const rawCategory = (form.get("category") as string | null)?.trim() ?? "upload";
  if (!isAiSpaceVideoCategory(rawCategory)) {
    return NextResponse.json({ error: "分类不合法" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawName = (form.get("name") as string | null)?.trim();

  try {
    const videoUrl = await uploadCanvasUserBuffer({
      userId: auth.actor.userId,
      buf: buffer,
      contentType: EXT_CONTENT_TYPE[ext] ?? "video/mp4",
      ext,
      preferBucketUrl: true,
    });
    const durationSec = await probeVideoDurationSec(buffer, ext);
    const material = await createAiSpaceVideoMaterial({
      userId: auth.actor.userId,
      tenantId: auth.actor.tenantCtx?.tenantId ?? null,
      name: rawName || file.name.replace(/\.[^.]+$/, "") || "上传视频",
      category: rawCategory,
      videoUrl,
      durationSec,
      sourceKind: "upload",
    });
    return NextResponse.json({ ok: true, material });
  } catch (e) {
    console.error("[ai-space/video-materials] POST failed", e);
    const msg = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** 改名 / 改分类 */
export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const category = body.category;
  if (category !== undefined && !isAiSpaceVideoCategory(category)) {
    return NextResponse.json({ error: "分类不合法" }, { status: 400 });
  }

  try {
    const ok = await updateAiSpaceVideoMaterial(auth.actor.userId, id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(isAiSpaceVideoCategory(category) ? { category } : {}),
    });
    if (!ok) return NextResponse.json({ error: "视频不存在或无改动" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-space/video-materials] PATCH failed", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/** 删除本库视频（前端须已完成二次确认）；同时移除作品墙展示 */
export async function DELETE(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  try {
    const res = await deleteAiSpaceVideoMaterial(auth.actor.userId, id);
    if (!res.deleted) {
      return NextResponse.json({ error: "视频不存在" }, { status: 404 });
    }
    if (res.videoUrl) {
      const oss = await deleteManagedOssObjectByUrl(res.videoUrl);
      if (!oss.ok) console.warn("[ai-space/video-materials] OSS 清理失败", oss.error);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-space/video-materials] DELETE failed", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
