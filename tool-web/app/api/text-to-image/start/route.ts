import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getQwenApiKey } from "@/lib/qwen-env";
import { wanxCreateTextToImageTask } from "@/lib/text-to-image-dashscope";
import {
  reserveWalletHoldFromServer,
  releaseWalletHoldFromServer,
} from "@/lib/forward-tools-usage-server";
import {
  computeTextToImageChargePoints,
  getTextToImageSchemeModelId,
} from "@/lib/tools-scheme-a-pricing";
import { getSchemeARetailMultiplierServer } from "@/lib/scheme-a-retail-multiplier-server";

export const runtime = "nodejs";

const MAX_PROMPT = 800;

/**
 * v003：文生图在调云前按"批次张数 × 单价 × 系数"预占用。
 * - 估算偏保守（按用户请求的 n 上限算，主站 reserveWalletHold 内还会再叠 1.2x 安全边际）；
 * - 命中失败（catalog 缺单价）则跳过 reserve，让 settle 时再尝试 ToolBillablePrice；
 * - reserve 失败（余额不足 / 水位线）→ 402 直接透传给前端，避免一次无谓的百炼调用。
 */
async function reserveBeforeTextToImageStart(opts: {
  imageCount: number;
}): Promise<
  | { ok: true; holdId: string | null; reservedPoints: number }
  | { ok: false; status: number; data: Record<string, unknown> }
> {
  try {
    const imgModel = getTextToImageSchemeModelId();
    const { multiplier } = await getSchemeARetailMultiplierServer({
      toolKey: "text-to-image",
      modelKey: imgModel,
    });
    const estimatedMaxPoints = computeTextToImageChargePoints(opts.imageCount, imgModel, multiplier);
    if (estimatedMaxPoints <= 0) {
      return { ok: true, holdId: null, reservedPoints: 0 };
    }
    const r = await reserveWalletHoldFromServer({
      toolKey: "text-to-image",
      action: "invoke",
      estimatedMaxPoints,
      meta: { modelId: imgModel, imageCount: opts.imageCount },
    });
    if (!r.ok) {
      return {
        ok: false,
        status: 503,
        data: {
          error: r.reason === "no_session" ? "请先登录工具站" : "工具站未配置 MAIN_SITE_ORIGIN",
        },
      };
    }
    if (r.status >= 200 && r.status < 300) {
      const holdId = typeof r.data.holdId === "string" ? r.data.holdId : null;
      const reservedPoints =
        typeof r.data.reservedPoints === "number" ? r.data.reservedPoints : 0;
      return { ok: true, holdId, reservedPoints };
    }
    return { ok: false, status: r.status, data: r.data };
  } catch (e) {
    console.error("[reserveBeforeTextToImageStart]", e);
    return { ok: true, holdId: null, reservedPoints: 0 };
  }
}

export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("text-to-image");
  if (!suite.ok) return suite.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const apiKey = getQwenApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务端未配置 QWEN_API_KEY 或 DASHSCOPE_API_KEY，无法调用通义文生图" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
  if (!prompt) {
    return NextResponse.json({ error: "请输入提示词" }, { status: 400 });
  }

  const negativePrompt =
    typeof body.negativePrompt === "string"
      ? body.negativePrompt.trim().slice(0, 500)
      : undefined;

  const nRaw = body.n;
  const n =
    typeof nRaw === "number" && Number.isFinite(nRaw)
      ? Math.floor(nRaw)
      : typeof nRaw === "string" && /^\d+$/.test(nRaw.trim())
        ? parseInt(nRaw.trim(), 10)
        : 4;

  const reserved = await reserveBeforeTextToImageStart({ imageCount: n });
  if (!reserved.ok) {
    return NextResponse.json(reserved.data, { status: reserved.status });
  }

  const created = await wanxCreateTextToImageTask({
    apiKey,
    prompt,
    negativePrompt,
    n,
  });

  if (!created.ok) {
    if (reserved.holdId) {
      await releaseWalletHoldFromServer({
        holdId: reserved.holdId,
        reason: `tti_create_failed:${created.error.slice(0, 100)}`,
      });
    }
    return NextResponse.json({ error: created.error }, { status: 502 });
  }

  return NextResponse.json({ taskId: created.taskId, holdId: reserved.holdId });
}
