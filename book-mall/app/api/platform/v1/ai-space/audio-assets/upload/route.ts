import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  createAiSpaceAudioAsset,
  probeAudioDurationSec,
} from "@/lib/ai-space/ai-space-audio-service";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024;

const EXT_CONTENT_TYPE: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  webm: "audio/webm",
};

function resolveExt(mime: string, fileName: string): string | null {
  const lower = fileName.toLowerCase();
  const byName = /\.(mp3|wav|m4a|aac|ogg|webm)$/i.exec(lower)?.[1]?.toLowerCase();
  if (byName) return byName;
  const m = mime.toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("m4a") || m.includes("mp4")) return "m4a";
  if (m.includes("aac")) return "aac";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("webm")) return "webm";
  return null;
}

/** 上传本地音频到音频库（multipart/form-data，字段 file，可选 name） */
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
    return NextResponse.json({ error: "缺少音频文件" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `音频不能超过 ${Math.floor(MAX_BYTES / 1024 / 1024)}MB` },
      { status: 413 },
    );
  }

  const ext = resolveExt(file.type ?? "", file.name ?? "");
  if (!ext) {
    return NextResponse.json(
      { error: "仅支持 mp3 / wav / m4a / aac / ogg / webm" },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawName = (form.get("name") as string | null)?.trim();
  const name = rawName || file.name.replace(/\.[^.]+$/, "") || "上传音频";

  try {
    const audioUrl = await uploadCanvasUserBuffer({
      userId: auth.actor.userId,
      buf: buffer,
      contentType: EXT_CONTENT_TYPE[ext] ?? "audio/mpeg",
      ext,
      preferBucketUrl: true,
    });
    const durationSec = await probeAudioDurationSec(buffer, ext);
    const asset = await createAiSpaceAudioAsset({
      userId: auth.actor.userId,
      tenantId: auth.actor.tenantCtx?.tenantId ?? null,
      name,
      sourceType: "upload",
      audioUrl,
      durationSec,
      originApp: "ai-space",
    });
    return NextResponse.json({ ok: true, asset });
  } catch (e) {
    console.error("[ai-space/audio-assets/upload] failed", e);
    const msg = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
