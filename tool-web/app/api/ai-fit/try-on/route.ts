import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import {
  persistTryOnResultImageToOss,
  rehostRemoteImageToOss,
  shouldRehostRemoteUrl,
  uploadAiFitImageToOss,
} from "@/lib/ai-fit-oss-upload";
import { parseImageDataUrl } from "@/lib/ai-fit-data-url";
import {
  createDashscopeJobFromServer,
  pollDashscopeJobFromServer,
} from "@/lib/forward-gateway-dashscope-server";
import { dashscopeExtractTaskImageUrl } from "@/lib/ai-fit-dashscope";
import { readOssEnv } from "@/lib/oss-client";

export const runtime = "nodejs";

/** 同一 task 轮询多次时复用已持久化的成片 URL，避免重复上传 OSS */
const persistedTryOnResultUrlByTask = new Map<
  string,
  { url: string; at: number }
>();
const PERSISTED_TRY_ON_TTL_MS = 20 * 60 * 1000;

function cachedPersistedUrl(taskId: string): string | undefined {
  const row = persistedTryOnResultUrlByTask.get(taskId);
  if (!row) return undefined;
  if (Date.now() - row.at > PERSISTED_TRY_ON_TTL_MS) {
    persistedTryOnResultUrlByTask.delete(taskId);
    return undefined;
  }
  return row.url;
}

function rememberPersistedUrl(taskId: string, url: string) {
  persistedTryOnResultUrlByTask.set(taskId, { url, at: Date.now() });
}

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

/** 创建百炼 AI 试衣异步任务（aitryon）。扣费见 Gateway finalize。 */
export async function POST(req: NextRequest) {
  const suite = await requireToolSuiteNavAccess("fitting-room");
  if (!suite.ok) return suite.response;

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

  const tryOnModel = process.env.DASHSCOPE_TRYON_MODEL?.trim() || "aitryon";
  const created = await createDashscopeJobFromServer({
    kind: "tryon",
    model: tryOnModel,
    personImageUrl: personRes.url,
    topGarmentUrl: topUrl,
    bottomGarmentUrl: bottomUrl,
    clientPage: "fitting-room/ai-fit",
  });

  if (!created.ok) {
    return NextResponse.json(
      { error: created.error ?? "Gateway 调用失败" },
      { status: created.status ?? 502 },
    );
  }

  return NextResponse.json({
    taskId: created.taskId,
    gatewayLogId: created.logId,
    resolvedUrls: {
      personImage: personRes.url,
      topGarment: topUrl ?? null,
      bottomGarment: bottomUrl ?? null,
    },
  });
}

/** 查询百炼试衣任务状态。成功时 Gateway poll 已完成积分/BYOK 结算。 */
export async function GET(req: NextRequest) {
  const suite = await requireToolSuiteNavAccess("fitting-room");
  if (!suite.ok) return suite.response;

  const taskId = req.nextUrl.searchParams.get("taskId")?.trim();
  const gatewayLogId = req.nextUrl.searchParams.get("gatewayLogId")?.trim() || undefined;
  if (!taskId) {
    return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
  }

  const polled = await pollDashscopeJobFromServer({ taskId, gatewayLogId });
  if (!polled.ok) {
    return NextResponse.json(
      { status: "UNKNOWN", error: polled.error },
      { status: polled.status ?? 502 },
    );
  }

  const output = polled.output;
  const status =
    typeof output.task_status === "string" ? output.task_status : "UNKNOWN";
  const rawEphemeralUrl = dashscopeExtractTaskImageUrl(output);
  const message =
    typeof output.message === "string" ? output.message : undefined;
  const code = typeof output.code === "string" ? output.code : undefined;

  const stUpper = status.toUpperCase();
  const succeeded =
    (stUpper === "SUCCEEDED" || stUpper === "SUCCESS") &&
    Boolean(rawEphemeralUrl?.trim());

  let imageUrl = rawEphemeralUrl ?? null;
  let persistedToOwnOss = false;

  if (succeeded && rawEphemeralUrl && taskId) {
    const cached = cachedPersistedUrl(taskId);
    if (cached) {
      imageUrl = cached;
      persistedToOwnOss = true;
    } else {
      const ossCfg = readOssEnv();
      if (!("error" in ossCfg)) {
        try {
          const stable = await persistTryOnResultImageToOss(rawEphemeralUrl);
          imageUrl = stable;
          persistedToOwnOss = true;
          rememberPersistedUrl(taskId, stable);
        } catch (e) {
          console.error("[ai-fit try-on] persist result to OSS failed:", e);
        }
      }
    }
  }

  return NextResponse.json({
    status,
    imageUrl,
    message: message ?? null,
    code: code ?? null,
    billing: { creditBilling: true, gatewaySettled: succeeded },
    persistedToOwnOss,
  });
}
