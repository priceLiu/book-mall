import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  rehostRemoteImageToOss,
  shouldRehostRemoteUrl,
  uploadAiFitImageToOss,
} from "@/lib/ai-fit-oss-upload";
import { parseImageDataUrl } from "@/lib/ai-fit-data-url";
import {
  dashscopeCreateTryOnTask,
  dashscopeExtractTaskImageUrl,
  dashscopeGetTask,
} from "@/lib/ai-fit-dashscope";
import { readOssEnv } from "@/lib/oss-client";

export const runtime = "nodejs";

function urlBlockedForDashscope(u: string): boolean {
  try {
    const x = new URL(u);
    return x.hostname === "localhost" || x.hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

function needsOssUpload(ref: string): boolean {
  const t = ref.trim();
  if (t.startsWith("data:")) return true;
  if (t.startsWith("http://") || t.startsWith("https://")) {
    return shouldRehostRemoteUrl(t);
  }
  return false;
}

async function resolveImageRef(
  ref: string,
): Promise<{ url: string } | { error: string }> {
  const t = ref.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) {
    /** 已知 TLS/可达性问题的 URL 由服务端中转上传到 OSS，避免百炼拉取失败 */
    if (shouldRehostRemoteUrl(t)) {
      try {
        const url = await rehostRemoteImageToOss(t);
        return { url };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: msg || "图片中转到 OSS 失败" };
      }
    }
    return { url: t };
  }
  if (t.startsWith("data:")) {
    const parsed = parseImageDataUrl(t);
    if (!parsed) {
      return {
        error:
          "无效的图片 Data URL（须为 JPG/PNG/WebP 等 base64，且不超过 6MB）",
      };
    }
    try {
      const url = await uploadAiFitImageToOss(parsed.buffer, parsed.contentType);
      return { url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: msg || "上传到 OSS 失败" };
    }
  }
  return { error: "图片须为 https 公网 URL 或上传生成的 Data URL" };
}

/** 创建百炼 AI 试衣异步任务（aitryon）。 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 DASHSCOPE_API_KEY，无法调用 AI 试衣" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const garmentMode = body.garmentMode;
  const personImage =
    typeof body.personImage === "string" ? body.personImage.trim() : "";
  const topGarment =
    typeof body.topGarment === "string" ? body.topGarment.trim() : "";
  const bottomGarment =
    typeof body.bottomGarment === "string" ? body.bottomGarment.trim() : "";

  if (!personImage) {
    return NextResponse.json({ error: "缺少模特图 personImage" }, { status: 400 });
  }

  if (garmentMode !== "two_piece" && garmentMode !== "one_piece") {
    return NextResponse.json(
      { error: "garmentMode 须为 two_piece 或 one_piece" },
      { status: 400 },
    );
  }

  if (garmentMode === "two_piece") {
    if (!topGarment || !bottomGarment) {
      return NextResponse.json(
        { error: "上下装模式须同时提供 topGarment 与 bottomGarment" },
        { status: 400 },
      );
    }
  } else if (!topGarment) {
    return NextResponse.json(
      { error: "连体模式须提供 topGarment（连衣裙图）" },
      { status: 400 },
    );
  }

  const ossNeeded =
    garmentMode === "two_piece"
      ? [personImage, topGarment, bottomGarment].some(needsOssUpload)
      : [personImage, topGarment].some(needsOssUpload);
  if (ossNeeded) {
    const ossCfg = readOssEnv();
    if ("error" in ossCfg) {
      return NextResponse.json({ error: ossCfg.error }, { status: 503 });
    }
  }

  const personRes = await resolveImageRef(personImage);
  if ("error" in personRes) {
    return NextResponse.json({ error: personRes.error }, { status: 400 });
  }

  let topUrl: string | undefined;
  let bottomUrl: string | undefined;

  if (garmentMode === "two_piece") {
    const tr = await resolveImageRef(topGarment);
    if ("error" in tr) {
      return NextResponse.json({ error: tr.error }, { status: 400 });
    }
    const br = await resolveImageRef(bottomGarment);
    if ("error" in br) {
      return NextResponse.json({ error: br.error }, { status: 400 });
    }
    topUrl = tr.url;
    bottomUrl = br.url;
  } else {
    const tr = await resolveImageRef(topGarment);
    if ("error" in tr) {
      return NextResponse.json({ error: tr.error }, { status: 400 });
    }
    topUrl = tr.url;
  }

  const allUrls = [personRes.url, topUrl, bottomUrl].filter(
    (x): x is string => Boolean(x),
  );
  for (const u of allUrls) {
    if (urlBlockedForDashscope(u)) {
      return NextResponse.json(
        {
          error:
            "百炼无法拉取 localhost 或非公网图片地址，请使用 OSS 上传后的 URL 或已是公网 HTTPS 的图片。",
        },
        { status: 503 },
      );
    }
  }

  const created = await dashscopeCreateTryOnTask({
    apiKey,
    personImageUrl: personRes.url,
    topGarmentUrl: topUrl,
    bottomGarmentUrl: bottomUrl,
    model: process.env.DASHSCOPE_TRYON_MODEL?.trim() || "aitryon",
  });

  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 502 });
  }

  return NextResponse.json({
    taskId: created.taskId,
    resolvedUrls: {
      personImage: personRes.url,
      topGarment: topUrl ?? null,
      bottomGarment: bottomUrl ?? null,
    },
  });
}

/** 查询百炼试衣任务状态。 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 DASHSCOPE_API_KEY" },
      { status: 503 },
    );
  }
  const taskId = req.nextUrl.searchParams.get("taskId")?.trim();
  if (!taskId) {
    return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
  }

  const json = await dashscopeGetTask({ apiKey, taskId });
  const output = json.output as Record<string, unknown> | undefined;
  if (!output) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.code === "string"
          ? json.code
          : "无效响应";
    return NextResponse.json({ status: "UNKNOWN", error: msg }, { status: 502 });
  }

  const status =
    typeof output.task_status === "string" ? output.task_status : "UNKNOWN";
  const imageUrl = dashscopeExtractTaskImageUrl(output);
  const message =
    typeof output.message === "string" ? output.message : undefined;
  const code = typeof output.code === "string" ? output.code : undefined;

  return NextResponse.json({
    status,
    imageUrl: imageUrl ?? null,
    message: message ?? null,
    code: code ?? null,
  });
}
