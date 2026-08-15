import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  AiSpaceDigitalHumanError,
  assertDigitalHumanImageSize,
  checkAiSpaceDigitalHumanReferences,
  createAiSpaceDigitalHuman,
  deleteAiSpaceDigitalHuman,
  listAiSpaceDigitalHumans,
  updateAiSpaceDigitalHuman,
} from "@/lib/ai-space/ai-space-digital-human-service";
import {
  S2V_DETECT_FAILED_HINT,
  detectAiSpaceDigitalHumanImage,
} from "@/lib/ai-space/ai-space-s2v-detect-service";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  normalizeCanvasUploadImageBuffer,
  sniffImageMimeFromBuffer,
} from "@/lib/canvas/canvas-image-upload-normalize";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 30 * 1024 * 1024;

/** 形象列表；`activeOnly=1` 供合成台与子应用选材 */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const checkRefsFor = url.searchParams.get("checkRefsFor")?.trim();

  try {
    if (checkRefsFor) {
      const refs = await checkAiSpaceDigitalHumanReferences(
        auth.actor.userId,
        checkRefsFor,
      );
      return NextResponse.json({ refs });
    }
    const items = await listAiSpaceDigitalHumans(auth.actor.userId, {
      activeOnly: url.searchParams.get("activeOnly") === "1",
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[ai-space/digital-humans] GET failed", e);
    return NextResponse.json({ error: "读取数字人库失败" }, { status: 500 });
  }
}

/** 上传形象（multipart/form-data：file + 可选 name） */
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
    return NextResponse.json({ error: "缺少形象图片" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `图片不能超过 ${Math.floor(MAX_BYTES / 1024 / 1024)}MB` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = (file.type || sniffImageMimeFromBuffer(buffer) || "").toLowerCase();
  if (!mime.startsWith("image/")) {
    return NextResponse.json({ error: "仅支持图片文件" }, { status: 415 });
  }

  try {
    const size = await assertDigitalHumanImageSize(buffer);
    const normalized = await normalizeCanvasUploadImageBuffer(buffer);
    const avatarImageUrl = await uploadCanvasUserBuffer({
      userId: auth.actor.userId,
      buf: Buffer.from(normalized.buf),
      contentType: normalized.contentType,
      ext: normalized.ext,
      preferBucketUrl: true,
    });

    const rawName = (form.get("name") as string | null)?.trim();
    const item = await createAiSpaceDigitalHuman({
      userId: auth.actor.userId,
      tenantId: auth.actor.tenantCtx?.tenantId ?? null,
      name: rawName || file.name.replace(/\.[^.]+$/, "") || "数字人形象",
      avatarImageUrl,
      width: size.width,
      height: size.height,
    });

    // 入库即预检（0.004 元/张）：不合格的图早说，别等 S2V 排队几十分钟才失败。
    // 检测本身失败（网络/凭证）不阻断上传，合成前还会再补一次。
    const detect = await detectAiSpaceDigitalHumanImage({
      userId: auth.actor.userId,
      digitalHumanId: item.id,
    }).catch((e) => {
      console.warn("[ai-space/digital-humans] 形象预检失败", e);
      return null;
    });

    return NextResponse.json({
      ok: true,
      item: detect ? { ...item, detect, status: detect.checkPass ? item.status : "detect_failed" } : item,
      ...(detect && !detect.checkPass ? { warning: S2V_DETECT_FAILED_HINT } : {}),
    });
  } catch (e) {
    if (e instanceof AiSpaceDigitalHumanError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/digital-humans] POST failed", e);
    const msg = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** 改名 / 启停 */
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

  // 重新预检（换图或首次检测失败后重试）
  if (body.action === "detect") {
    try {
      const detect = await detectAiSpaceDigitalHumanImage({
        userId: auth.actor.userId,
        digitalHumanId: id,
      });
      return NextResponse.json({
        ok: true,
        detect,
        ...(detect.checkPass ? {} : { warning: S2V_DETECT_FAILED_HINT }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "形象检测失败";
      console.error("[ai-space/digital-humans] detect failed", e);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const status = body.status;
  if (status !== undefined && status !== "active" && status !== "inactive") {
    return NextResponse.json({ error: "status 仅支持 active / inactive" }, { status: 400 });
  }

  try {
    const ok = await updateAiSpaceDigitalHuman(auth.actor.userId, id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(status ? { status } : {}),
    });
    if (!ok) return NextResponse.json({ error: "形象不存在或无改动" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-space/digital-humans] PATCH failed", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/** 删除形象（前端须已完成二次确认） */
export async function DELETE(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  try {
    const res = await deleteAiSpaceDigitalHuman(auth.actor.userId, id);
    if (!res.deleted) {
      return NextResponse.json({ error: "形象不存在" }, { status: 404 });
    }
    if (res.avatarImageUrl) {
      const oss = await deleteManagedOssObjectByUrl(res.avatarImageUrl);
      if (!oss.ok) console.warn("[ai-space/digital-humans] OSS 清理失败", oss.error);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-space/digital-humans] DELETE failed", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
