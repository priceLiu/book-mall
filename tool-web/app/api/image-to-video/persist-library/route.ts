import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { persistImageToVideoResultToOss } from "@/lib/ai-fit-oss-upload";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";

const UPSTREAM = "/api/sso/tools/image-to-video/library";
const MAX_PROMPT = 8000;
const LAB_MODES = new Set(["i2v", "t2v", "ref"]);

function tokenOrError(): string | NextResponse {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }
  return token;
}

function originOrError(): string | NextResponse {
  const origin = getMainSiteOrigin()?.replace(/\/$/, "") ?? "";
  if (!origin.length) {
    return NextResponse.json({ error: "main_origin_not_configured" }, { status: 503 });
  }
  return origin;
}

function normalizeSourceUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "http:" && /\.aliyuncs\.com$/i.test(u.hostname)) {
      u.protocol = "https:";
      return u.href;
    }
    if (u.protocol === "https:") return u.href;
    return null;
  } catch {
    return null;
  }
}

/**
 * 将 DashScope 短期视频 URL 拉到自有 OSS，再写入「我的视频库」（主站 SSO）。
 */
export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("image-to-video");
  if (!suite.ok) return suite.response;

  const origin = originOrError();
  if (origin instanceof NextResponse) return origin;
  const token = tokenOrError();
  if (token instanceof NextResponse) return token;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const rawSrc =
    typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const sourceUrl = normalizeSourceUrl(rawSrc);
  if (!sourceUrl) {
    return NextResponse.json(
      { error: "sourceUrl 须为 https 视频地址（阿里云 OSS 的 http 链会自动升为 https）" },
      { status: 400 },
    );
  }

  const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!LAB_MODES.has(modeRaw)) {
    return NextResponse.json({ error: "mode 须为 i2v、t2v 或 ref" }, { status: 400 });
  }

  const resolution =
    typeof body.resolution === "string" && /^(720P|1080P)$/.test(body.resolution.trim())
      ? body.resolution.trim()
      : null;
  if (!resolution) {
    return NextResponse.json({ error: "resolution 须为 720P 或 1080P" }, { status: 400 });
  }

  const durationRaw = body.durationSec;
  const durationSec =
    typeof durationRaw === "number" && Number.isFinite(durationRaw)
      ? Math.round(durationRaw)
      : typeof durationRaw === "string" && /^\d+$/.test(durationRaw.trim())
        ? Number.parseInt(durationRaw.trim(), 10)
        : NaN;
  if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > 600) {
    return NextResponse.json({ error: "durationSec 无效" }, { status: 400 });
  }

  let ossUrl: string;
  try {
    ossUrl = await persistImageToVideoResultToOss(sourceUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "上传到 OSS 失败" }, { status: 502 });
  }

  const promptRaw =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
  const prompt = promptRaw.length > 0 ? promptRaw : null;

  const seedRaw = typeof body.seed === "string" ? body.seed.trim().slice(0, 64) : "";
  const seed = seedRaw.length > 0 ? seedRaw : null;

  const modelLabelRaw =
    typeof body.modelLabel === "string" ? body.modelLabel.trim().slice(0, 200) : "";
  const modelLabel = modelLabelRaw.length > 0 ? modelLabelRaw : null;

  let r: Response;
  try {
    r = await fetch(`${origin}${UPSTREAM}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoUrl: ossUrl,
        prompt,
        mode: modeRaw,
        resolution,
        durationSec,
        seed,
        modelLabel,
      }),
      cache: "no-store",
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "main_site_unreachable",
        message: `无法请求主站（请确认 MAIN_SITE_ORIGIN 指向已启动的主站，且本机网络可达）：${detail}`,
      },
      { status: 502 },
    );
  }

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
