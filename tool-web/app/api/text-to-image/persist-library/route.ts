import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { persistTextToImageResultToOss } from "@/lib/ai-fit-oss-upload";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";

const UPSTREAM = "/api/sso/tools/text-to-image/library";
const MAX_PROMPT = 2000;

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
 * 将 DashScope 短期 URL 拉到自有 OSS，再写入「我的图片库」（主站 SSO）。
 */
export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("text-to-image");
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
      { error: "sourceUrl 须为 https 图片地址（阿里云 OSS 的 http 链会自动升为 https）" },
      { status: 400 },
    );
  }

  let ossUrl: string;
  try {
    ossUrl = await persistTextToImageResultToOss(sourceUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "上传到 OSS 失败" }, { status: 502 });
  }

  const promptRaw =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
  const prompt = promptRaw.length > 0 ? promptRaw : null;

  const r = await fetch(`${origin}${UPSTREAM}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl: ossUrl, prompt }),
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
