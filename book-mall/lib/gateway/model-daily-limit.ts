/**
 * 单模型日调用上限（平台级保险丝 / kill switch）。
 *
 * 背景：厂商 Key 异常高调用（如 canvas Key 单日 3.5k 次）平台无感知。
 * 在 Gateway 唯一入口 createRequestLog 预检：同一 model 当日（CST 业务日）
 * GatewayRequestLog 数 >= 上限 → 429 拒绝，并写 PlatformErrorLog 告警。
 *
 * 配置：**管理后台 `/admin/settings`（PlatformConfig）> 环境变量 > 默认**：
 *   GATEWAY_MODEL_DAILY_LIMIT            全局每模型每日上限，默认 300；0 / off / false = 关闭
 *   GATEWAY_MODEL_DAILY_LIMIT_OVERRIDES  JSON 按模型覆盖，如 {"deepseek-v4-flash":1000,"kling-x":0}（0=该模型不限）
 *   环境变量仅作 DB 不可用时的回退。
 *
 * 计数口径：当日提交的全部请求（含 FAILED；失败循环同样要熔断）。
 */
import { prisma } from "@/lib/prisma";
import {
  cstBusinessDate,
  cstDayEndUtc,
  cstDayStartUtc,
} from "@/lib/billing/cst-business-date";
import { recordPlatformError } from "@/lib/platform-error-log";

export const MODEL_DAILY_LIMIT_DEFAULT = 300;

export class ModelDailyLimitError extends Error {
  readonly code = "MODEL_DAILY_LIMIT" as const;
  readonly model: string;
  readonly limit: number;
  readonly used: number;

  constructor(input: { model: string; limit: number; used: number }) {
    super(
      `模型 ${input.model} 今日调用已达平台上限 ${input.limit} 次（当前 ${input.used} 次），已暂停该模型当日调用；如需调整请联系管理员`,
    );
    this.name = "ModelDailyLimitError";
    this.model = input.model;
    this.limit = input.limit;
    this.used = input.used;
  }
}

export type ModelDailyLimitConfig = {
  enabled: boolean;
  defaultLimit: number;
  /** modelKey → limit；0 表示该模型不受限 */
  overrides: Record<string, number>;
};

export function resolveModelDailyLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): ModelDailyLimitConfig {
  const raw = env.GATEWAY_MODEL_DAILY_LIMIT?.trim().toLowerCase() ?? "";
  let enabled = true;
  let defaultLimit = MODEL_DAILY_LIMIT_DEFAULT;
  if (raw === "" || raw === "0" || raw === "off" || raw === "false") {
    // 空 = 未配置 → 用默认上限；显式 0/off/false = 关闭
    if (raw !== "") enabled = false;
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      enabled = false;
    } else {
      defaultLimit = Math.floor(n);
    }
  }

  let overrides: Record<string, number> = {};
  const rawOverrides = env.GATEWAY_MODEL_DAILY_LIMIT_OVERRIDES?.trim() ?? "";
  if (rawOverrides) {
    try {
      const parsed = JSON.parse(rawOverrides) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        const n = Number(v);
        if (k.trim() && Number.isFinite(n) && n >= 0) {
          overrides[k.trim()] = Math.floor(n);
        }
      }
    } catch {
      // 配置 JSON 非法：忽略覆盖，不阻断主流程
    }
  }

  return { enabled, defaultLimit, overrides };
}

/** 该模型当日上限；null = 不限 */
export function resolveModelDailyLimit(
  model: string,
  config: ModelDailyLimitConfig,
): number | null {
  const override = config.overrides[model];
  if (override !== undefined) return override > 0 ? override : null;
  if (!config.enabled) return null;
  return config.defaultLimit;
}

export async function assertModelDailyLimitAllowed(
  model: string,
  input?: { now?: Date; config?: ModelDailyLimitConfig },
): Promise<void> {
  let config = input?.config;
  if (!config) {
    // 后台配置（PlatformConfig）> env > 默认；失败则回退 env
    try {
      const { resolveModelDailyLimitConfigAsync } = await import(
        "@/lib/admin/logging-fuse-config-service"
      );
      config = await resolveModelDailyLimitConfigAsync();
    } catch {
      config = resolveModelDailyLimitConfig();
    }
  }
  const limit = resolveModelDailyLimit(model, config);
  if (limit === null) return;

  const day = cstBusinessDate(input?.now ?? new Date());
  const used = await prisma.gatewayRequestLog.count({
    where: {
      model,
      submittedAt: { gte: cstDayStartUtc(day), lte: cstDayEndUtc(day) },
    },
  });
  if (used < limit) return;

  recordPlatformError({
    source: "GATEWAY",
    severity: "ERROR",
    code: "MODEL_DAILY_LIMIT",
    message: `模型 ${model} 当日调用 ${used} 次已达上限 ${limit}，当日后续调用被拒绝`,
    context: {
      modelKey: model,
      businessDate: day,
      usedCount: used,
      dailyLimit: limit,
    },
  });
  throw new ModelDailyLimitError({ model, limit, used });
}
