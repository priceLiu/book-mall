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
  dashscopeCreateTryOnTask,
  dashscopeExtractTaskImageUrl,
  dashscopeGetTask,
} from "@/lib/ai-fit-dashscope";
import { readOssEnv } from "@/lib/oss-client";
import { postToolUsageFromServerWithRetries } from "@/lib/forward-tools-usage-server";
import {
  computeAiTryOnChargePoints,
  resolveAiTryOnBillingModelId,
} from "@/lib/tools-scheme-a-pricing";
import { getSchemeARetailMultiplierServer } from "@/lib/scheme-a-retail-multiplier-server";

export const runtime = "nodejs";

/** 同一 task 轮询多次时复用已持久化的成片 URL，避免重复上传 OSS */
const persistedTryOnResultUrlByTask = new Map<
  string,
  { url: string; at: number }
>();
const PERSISTED_TRY_ON_TTL_MS = 20 * 60 * 1000;
const recordedTryOnUsageTasks = new Set<string>();
const recordedTryOnUsageInsufficientTasks = new Set<string>();

/** 成片计费展示：幂等 / 金额（与 taskId 绑定，TTL 与 OSS 缓存一致时清理） */
type TryOnBillingSnap = { chargedPoints?: number; billingDuplicate?: boolean };
const tryOnBillingSnapByTaskId = new Map<string, TryOnBillingSnap>();

/**
 * 计费锚定：仅在任务成功且写出结果图 URL 后打点一次 try_on（等价于用户一次「试衣」成功成片），
 * 与台帐单价一致；toolKey 须为 AI智能试衣页 `fitting-room__ai-fit`（与 Beacon 路径规则一致）。
 */
const AI_FIT_USAGE_TOOL_KEY = "fitting-room__ai-fit";

type AiFitTryOnUsagePayload = {
  recorded: boolean;
  insufficientBalance?: boolean;
  error?: string | null;
  chargedPoints?: number;
  billingDuplicate?: boolean;
};

async function reportAiFitTryOnUsage(opts: {
  taskId: string;
  imageUrl: string;
  persistedToOwnOss: boolean;
}): Promise<AiFitTryOnUsagePayload> {
  try {
    const tryOnModelId = resolveAiTryOnBillingModelId();
    const { multiplier: retailMult } = await getSchemeARetailMultiplierServer({
      toolKey: AI_FIT_USAGE_TOOL_KEY,
      modelKey: tryOnModelId,
    });
    const billingPoints = computeAiTryOnChargePoints(tryOnModelId, retailMult);
    if (billingPoints <= 0) {
      return { recorded: false, error: "试衣方案 A 标价未配置或无效" };
    }
    const usage = await postToolUsageFromServerWithRetries({
      toolKey: AI_FIT_USAGE_TOOL_KEY,
      action: "try_on",
      costPoints: billingPoints,
      meta: {
        taskId: opts.taskId,
        resultImageUrl: opts.imageUrl,
        persistedToOwnOss: opts.persistedToOwnOss,
        pricingScheme: "tools_scheme_a",
        tryOnModel: tryOnModelId,
        retailMultiplier: retailMult,
      },
    });
    if (!usage.ok) {
      const msg =
        usage.reason === "no_session"
          ? "未检测到工具站令牌，无法上报计费"
          : "工具站未配置 MAIN_SITE_ORIGIN，无法上报计费";
      return { recorded: false, error: msg };
    }
    if (usage.status === 402) {
      const req = usage.data.requiredPoints;
      return {
        recorded: false,
        insufficientBalance: true,
        error:
          typeof req === "number"
            ? `账户余额不足（约需 ${req / 100} 元）`
            : "账户余额不足，无法完成本次计费",
      };
    }
    if (usage.status !== 200) {
      const err =
        typeof usage.data.error === "string"
          ? usage.data.error
          : `计费上报失败（HTTP ${usage.status}）`;
      return { recorded: false, error: err };
    }
    const d = usage.data;
    const costPoints =
      typeof d.costPoints === "number" && Number.isFinite(d.costPoints)
        ? Math.max(0, Math.floor(d.costPoints))
        : undefined;

    if (d.duplicate === true) {
      return {
        recorded: true,
        billingDuplicate: true,
        chargedPoints: costPoints,
      };
    }
    if (d.recorded === true) {
      return {
        recorded: true,
        chargedPoints: costPoints,
      };
    }
    return { recorded: true };
  } catch (e) {
    console.error("[ai-fit try-on] usage reporting failed after retries", e);
    return {
      recorded: false,
      error: "计费上报失败（网络异常），将自动重试",
    };
  }
}

function cachedPersistedUrl(taskId: string): string | undefined {
  const row = persistedTryOnResultUrlByTask.get(taskId);
  if (!row) return undefined;
  if (Date.now() - row.at > PERSISTED_TRY_ON_TTL_MS) {
    persistedTryOnResultUrlByTask.delete(taskId);
    recordedTryOnUsageTasks.delete(taskId);
    recordedTryOnUsageInsufficientTasks.delete(taskId);
    tryOnBillingSnapByTaskId.delete(taskId);
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
  const suite = await requireToolSuiteNavAccess("fitting-room");
  if (!suite.ok) return suite.response;

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
  const suite = await requireToolSuiteNavAccess("fitting-room");
  if (!suite.ok) return suite.response;

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
          /** 退回百炼短期 URL，客户端仍可短暂预览 */
        }
      }
    }

  }

  let usage:
    | {
        recorded: boolean;
        insufficientBalance?: boolean;
        error?: string | null;
        chargedPoints?: number;
        billingDuplicate?: boolean;
      }
    | undefined;

  if (succeeded && imageUrl && taskId) {
    if (recordedTryOnUsageTasks.has(taskId)) {
      const snap = tryOnBillingSnapByTaskId.get(taskId);
      usage = {
        recorded: true,
        chargedPoints: snap?.chargedPoints,
        billingDuplicate: snap?.billingDuplicate,
      };
    } else if (recordedTryOnUsageInsufficientTasks.has(taskId)) {
      usage = {
        recorded: false,
        insufficientBalance: true,
        error: "账户余额不足，无法记入本次试衣扣费；成片仍可预览。",
      };
    } else {
      const reported = await reportAiFitTryOnUsage({
        taskId,
        imageUrl,
        persistedToOwnOss,
      });
      usage = reported;
      if (reported.recorded) {
        recordedTryOnUsageTasks.add(taskId);
        tryOnBillingSnapByTaskId.set(taskId, {
          chargedPoints: reported.chargedPoints,
          billingDuplicate: reported.billingDuplicate,
        });
      } else if (reported.insufficientBalance) {
        recordedTryOnUsageInsufficientTasks.add(taskId);
      }
    }
  }

  return NextResponse.json({
    status,
    imageUrl,
    message: message ?? null,
    code: code ?? null,
    ...(usage ? { usage } : {}),
  });
}
