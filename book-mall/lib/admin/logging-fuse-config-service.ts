/**
 * 日志与保险丝配置 · 读写服务。
 *
 * 优先级：**PlatformConfig（管理后台 /admin/settings）> 环境变量 > 代码默认**。
 * 读路径带 30s 进程内缓存（与 generationSlowWarn 一致）。
 */
import { prisma } from "@/lib/prisma";
import {
  MODEL_DAILY_LIMIT_DEFAULT,
  type ModelDailyLimitConfig,
} from "@/lib/gateway/model-daily-limit";
import { DEFAULT_USAGE_RECON_INTERVAL_MS } from "@/lib/gateway/usage-recon-scheduler";

const CACHE_TTL_MS = 30_000;

export type LoggingFuseConfig = {
  modelDailyLimit: number;
  modelDailyLimitOverrides: Record<string, number>;
  vendorDirectBlockHosts: string[];
  usageReconEnabled: boolean;
  usageReconIntervalMin: number;
};

export type LoggingFuseConfigWithSource = LoggingFuseConfig & {
  /** 全量来自后台 = platform；任一字段回退 env/默认 = env-fallback */
  source: "platform" | "env-fallback";
};

// —— env 解析（回退用）——

function envModelDailyLimit(): number {
  const raw = process.env.GATEWAY_MODEL_DAILY_LIMIT?.trim().toLowerCase() ?? "";
  if (raw === "" ) return MODEL_DAILY_LIMIT_DEFAULT;
  if (raw === "0" || raw === "off" || raw === "false") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function envOverrides(): Record<string, number> {
  const raw = process.env.GATEWAY_MODEL_DAILY_LIMIT_OVERRIDES?.trim() ?? "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (k.trim() && Number.isFinite(n) && n >= 0) out[k.trim()] = Math.floor(n);
    }
    return out;
  } catch {
    return {};
  }
}

function envBlockHosts(): string[] {
  const raw = process.env.VENDOR_DIRECT_BLOCK_HOSTS?.trim() ?? "";
  if (!raw) return [];
  return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function envUsageReconEnabled(): boolean {
  const v = process.env.USAGE_RECON_RESIDENT?.trim().toLowerCase();
  return !(v === "0" || v === "false");
}

function envUsageReconIntervalMin(): number {
  const n = Number(process.env.USAGE_RECON_INTERVAL_MS);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n / 60000)) : 30;
}

// —— 行 → 配置 ——

type ConfigRow = {
  gatewayModelDailyLimit: number;
  gatewayModelDailyLimitOverrides: unknown;
  vendorDirectBlockHosts: unknown;
  usageReconResidentEnabled: boolean;
  usageReconIntervalMin: number;
};

function overridesFromJson(v: unknown): Record<string, number> | null {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(val);
    if (k.trim() && Number.isFinite(n) && n >= 0) out[k.trim()] = Math.floor(n);
  }
  return out;
}

function blockHostsFromJson(v: unknown): string[] | null {
  if (v == null || !Array.isArray(v)) return null;
  return v
    .map((x) => String(x).trim().toLowerCase())
    .filter(Boolean);
}

function rowToConfig(row: ConfigRow): LoggingFuseConfigWithSource {
  const overrides = overridesFromJson(row.gatewayModelDailyLimitOverrides);
  const blockHosts = blockHostsFromJson(row.vendorDirectBlockHosts);
  return {
    modelDailyLimit:
      row.gatewayModelDailyLimit >= 0
        ? row.gatewayModelDailyLimit
        : envModelDailyLimit(),
    modelDailyLimitOverrides: overrides ?? envOverrides(),
    vendorDirectBlockHosts: blockHosts ?? envBlockHosts(),
    usageReconEnabled: row.usageReconResidentEnabled ?? envUsageReconEnabled(),
    usageReconIntervalMin:
      row.usageReconIntervalMin >= 1 ? row.usageReconIntervalMin : envUsageReconIntervalMin(),
    source: "platform",
  };
}

// —— 缓存读取 ——

let cached: LoggingFuseConfigWithSource | null = null;
let cachedAt = 0;

export function invalidateLoggingFuseConfigCache(): void {
  cached = null;
  cachedAt = 0;
}

export async function getLoggingFuseConfig(): Promise<LoggingFuseConfigWithSource> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const row = await prisma.platformConfig.findUnique({
      where: { id: "default" },
      select: {
        gatewayModelDailyLimit: true,
        gatewayModelDailyLimitOverrides: true,
        vendorDirectBlockHosts: true,
        usageReconResidentEnabled: true,
        usageReconIntervalMin: true,
      },
    });
    if (row) {
      cached = rowToConfig(row);
      cachedAt = now;
      return cached;
    }
  } catch {
    /* fallback */
  }
  const fallback: LoggingFuseConfigWithSource = {
    modelDailyLimit: envModelDailyLimit(),
    modelDailyLimitOverrides: envOverrides(),
    vendorDirectBlockHosts: envBlockHosts(),
    usageReconEnabled: envUsageReconEnabled(),
    usageReconIntervalMin: envUsageReconIntervalMin(),
    source: "env-fallback",
  };
  cached = fallback;
  cachedAt = now;
  return fallback;
}

/** 供 model-daily-limit 消费（DB > env > 默认） */
export async function resolveModelDailyLimitConfigAsync(): Promise<ModelDailyLimitConfig> {
  const c = await getLoggingFuseConfig();
  return {
    enabled: c.modelDailyLimit > 0,
    defaultLimit: c.modelDailyLimit,
    overrides: c.modelDailyLimitOverrides,
  };
}

/** 供 vendor-egress-audit 消费（DB > env > 默认空） */
export async function resolveVendorDirectBlockHostsAsync(): Promise<string[]> {
  const c = await getLoggingFuseConfig();
  return c.vendorDirectBlockHosts;
}

/** 供 usage-recon-scheduler 消费（DB > env > 默认） */
export async function resolveUsageReconPolicyAsync(): Promise<{
  enabled: boolean;
  intervalMs: number;
}> {
  const c = await getLoggingFuseConfig();
  return {
    enabled: c.usageReconEnabled,
    intervalMs: c.usageReconIntervalMin * 60000,
  };
}

// —— 后台读写 ——

export async function readLoggingFuseConfigForAdmin(): Promise<LoggingFuseConfigWithSource> {
  return getLoggingFuseConfig();
}

export async function updateLoggingFuseConfig(input: {
  modelDailyLimit?: number;
  modelDailyLimitOverrides?: Record<string, number>;
  vendorDirectBlockHosts?: string[];
  usageReconEnabled?: boolean;
  usageReconIntervalMin?: number;
}): Promise<LoggingFuseConfigWithSource> {
  const data: Record<string, unknown> = {};
  if (typeof input.modelDailyLimit === "number" && Number.isFinite(input.modelDailyLimit)) {
    data.gatewayModelDailyLimit = Math.max(0, Math.floor(input.modelDailyLimit));
  }
  if (input.modelDailyLimitOverrides !== undefined) {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(input.modelDailyLimitOverrides)) {
      const n = Number(v);
      if (k.trim() && Number.isFinite(n) && n >= 0) clean[k.trim()] = Math.floor(n);
    }
    data.gatewayModelDailyLimitOverrides = clean;
  }
  if (input.vendorDirectBlockHosts !== undefined) {
    data.vendorDirectBlockHosts = input.vendorDirectBlockHosts
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof input.usageReconEnabled === "boolean") {
    data.usageReconResidentEnabled = input.usageReconEnabled;
  }
  if (typeof input.usageReconIntervalMin === "number" && Number.isFinite(input.usageReconIntervalMin)) {
    data.usageReconIntervalMin = Math.max(1, Math.floor(input.usageReconIntervalMin));
  }

  await prisma.platformConfig.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  invalidateLoggingFuseConfigCache();
  return getLoggingFuseConfig();
}
