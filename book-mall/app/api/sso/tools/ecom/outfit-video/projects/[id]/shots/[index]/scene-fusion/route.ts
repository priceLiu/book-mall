import { NextResponse } from "next/server";

import {
  applyEcomOutfitSceneFusionToAll,
  fuseEcomOutfitVideoShotScene,
  patchEcomOutfitShotSceneFusionConfig,
  uploadEcomOutfitSceneRefImage,
} from "@/lib/ecom/ecom-outfit-video-service";
import type { OutfitSceneFusion } from "@/lib/ecom/video-workflow/shot-spine";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; index: string }> };

const MODES = ["follow_reference", "library", "upload_ref"] as const;

function parseIndex(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type OutfitSceneFusionMode = NonNullable<OutfitSceneFusion["mode"]>;

function isMode(v: unknown): v is OutfitSceneFusionMode {
  return typeof v === "string" && (MODES as readonly string[]).includes(v);
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, index: indexRaw } = await ctx.params;
  const sceneIndex = parseIndex(indexRaw);
  if (!sceneIndex) {
    return NextResponse.json({ error: "无效分镜序号" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传场景参考图" }, { status: 400 });
    }
    try {
      const project = await uploadEcomOutfitSceneRefImage(
        auth.userId,
        id,
        sceneIndex,
        file,
      );
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

  if (body.action === "apply_all") {
    const sourceIndex =
      typeof body.sourceIndex === "number"
        ? body.sourceIndex
        : parseIndex(String(body.sourceIndex ?? sceneIndex));
    if (!sourceIndex) {
      return NextResponse.json({ error: "无效来源镜号" }, { status: 400 });
    }
    try {
      const project = await applyEcomOutfitSceneFusionToAll(auth.userId, id, sourceIndex);
      return NextResponse.json({ project });
    } catch (e) {
      const message = e instanceof Error ? e.message : "应用全部失败";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (body.configOnly === true && body.fusion && typeof body.fusion === "object") {
    try {
      const project = await patchEcomOutfitShotSceneFusionConfig(
        auth.userId,
        id,
        sceneIndex,
        body.fusion as Partial<OutfitSceneFusion>,
      );
      return NextResponse.json({ project });
    } catch (e) {
      const message = e instanceof Error ? e.message : "更新场景配置失败";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const mode = isMode(body.mode) ? body.mode : null;
  if (!mode) {
    return NextResponse.json({ error: "请指定 mode" }, { status: 400 });
  }

  try {
    const project = await fuseEcomOutfitVideoShotScene(auth.userId, id, sceneIndex, {
      mode,
      libraryEntryId:
        typeof body.libraryEntryId === "string" ? body.libraryEntryId : undefined,
      sceneRefUrl: typeof body.sceneRefUrl === "string" ? body.sceneRefUrl : undefined,
      fusionModelKey:
        typeof body.fusionModelKey === "string" ? body.fusionModelKey : undefined,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "场景融图失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
