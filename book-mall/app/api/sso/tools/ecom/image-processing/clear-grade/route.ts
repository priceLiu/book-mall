import { randomUUID } from "node:crypto";

import { InsufficientCreditsError } from "@/lib/billing/credit-account-service";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import {
  chargeImageEditorColorGrade,
  refundImageEditorColorGrade,
} from "@/lib/ecom/image-editor-color-grade-billing";
import {
  isClearGradeSourceUrl,
  parseColorAdjust,
  renderClearGradeJpeg,
  type ColorAdjust,
} from "@/lib/ecom/image-editor-clear-grade";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

async function readSource(req: Request): Promise<{ buf: Buffer; gradeId: string; adjust: ColorAdjust | null }> {
  const form = await req.formData();
  const gradeRaw = form.get("grade");
  const gradeId = typeof gradeRaw === "string" && gradeRaw.trim() ? gradeRaw.trim() : "clear";
  const adjustRaw = form.get("adjust");
  const adjust = typeof adjustRaw === "string" && adjustRaw.trim() ? parseColorAdjust(adjustRaw) : null;
  const file = form.get("file");
  if (file instanceof Blob) {
    if (file.size > MAX_BYTES) throw new Error("图片过大");
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength < 32) throw new Error("图片内容为空");
    return { buf, gradeId, adjust };
  }
  const imageUrl = form.get("imageUrl");
  if (typeof imageUrl !== "string" || !isClearGradeSourceUrl(imageUrl)) {
    throw new Error("无法读取这张图片");
  }
  const res = await fetch(imageUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error("读取图片失败");
  const type = res.headers.get("content-type") ?? "";
  if (type && !type.toLowerCase().startsWith("image/")) {
    throw new Error("无法读取这张图片");
  }
  const len = Number(res.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > MAX_BYTES) throw new Error("图片过大");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("图片过大");
  return { buf, gradeId, adjust };
}

/**
 * 调色是像素运算，不调用生图模型。完成后扣一笔调色积分，并把扣减值交给前端弹出。
 */
export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  try {
    const { buf, gradeId, adjust } = await readSource(req);
    const jpeg = await renderClearGradeJpeg(buf, gradeId, adjust);
    const billed = await chargeImageEditorColorGrade({
      userId: auth.userId,
      chargeId: randomUUID(),
      gradeId,
    });
    try {
      const imageUrl = await uploadCanvasUserBuffer({
        userId: auth.userId,
        buf: jpeg,
        contentType: "image/jpeg",
        ext: "jpg",
      });
      return ecomJson({
        imageUrl,
        creditsCharged: billed.credits,
        chargeId: billed.chargeId,
      });
    } catch (uploadError) {
      await refundImageEditorColorGrade(billed).catch(() => undefined);
      throw uploadError;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "调色失败";
    const status = e instanceof InsufficientCreditsError ? 402 : 400;
    return ecomJson({ error: message }, { status });
  }
}
