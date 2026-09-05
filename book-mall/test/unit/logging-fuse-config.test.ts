import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getLoggingFuseConfig,
  invalidateLoggingFuseConfigCache,
  resolveModelDailyLimitConfigAsync,
  resolveUsageReconPolicyAsync,
  resolveVendorDirectBlockHostsAsync,
  updateLoggingFuseConfig,
} from "@/lib/admin/logging-fuse-config-service";

const mockFind = vi.mocked(prisma.platformConfig.findUnique);
const mockUpsert = vi.mocked(prisma.platformConfig.upsert);

function row(partial: Partial<Record<string, unknown>> = {}) {
  return {
    gatewayModelDailyLimit: 300,
    gatewayModelDailyLimitOverrides: null,
    vendorDirectBlockHosts: null,
    usageReconResidentEnabled: true,
    usageReconIntervalMin: 30,
    ...partial,
  };
}

describe("logging-fuse-config-service", () => {
  beforeEach(() => {
    mockFind.mockReset();
    mockUpsert.mockReset();
    invalidateLoggingFuseConfigCache();
    vi.unstubAllEnvs();
  });

  it("DB 优先：读 PlatformConfig 行", async () => {
    mockFind.mockResolvedValue(
      row({ gatewayModelDailyLimit: 150 }) as never,
    );
    const c = await getLoggingFuseConfig();
    expect(c.modelDailyLimit).toBe(150);
    expect(c.source).toBe("platform");
  });

  it("DB 无行：回退 env", async () => {
    mockFind.mockResolvedValue(null);
    vi.stubEnv("GATEWAY_MODEL_DAILY_LIMIT", "88");
    vi.stubEnv("VENDOR_DIRECT_BLOCK_HOSTS", "api.deepseek.com, api.moonshot.cn");
    const c = await getLoggingFuseConfig();
    expect(c.modelDailyLimit).toBe(88);
    expect(c.vendorDirectBlockHosts).toEqual(["api.deepseek.com", "api.moonshot.cn"]);
    expect(c.source).toBe("env-fallback");
  });

  it("modelDailyLimit=0 → resolveModelDailyLimitConfigAsync 返回 enabled=false", async () => {
    mockFind.mockResolvedValue(row({ gatewayModelDailyLimit: 0 }) as never);
    const c = await resolveModelDailyLimitConfigAsync();
    expect(c.enabled).toBe(false);
    expect(c.defaultLimit).toBe(0);
  });

  it("overrides 从 DB JSON 读取", async () => {
    mockFind.mockResolvedValue(
      row({ gatewayModelDailyLimitOverrides: { "deepseek-v4-flash": 1000, "kling-x": 0 } }) as never,
    );
    const c = await resolveModelDailyLimitConfigAsync();
    expect(c.overrides).toEqual({ "deepseek-v4-flash": 1000, "kling-x": 0 });
  });

  it("resolveVendorDirectBlockHostsAsync 读 DB 数组", async () => {
    mockFind.mockResolvedValue(
      row({ vendorDirectBlockHosts: ["api.deepseek.com"] }) as never,
    );
    await expect(resolveVendorDirectBlockHostsAsync()).resolves.toEqual(["api.deepseek.com"]);
  });

  it("resolveUsageReconPolicyAsync 读开关与间隔", async () => {
    mockFind.mockResolvedValue(
      row({ usageReconResidentEnabled: false, usageReconIntervalMin: 10 }) as never,
    );
    const p = await resolveUsageReconPolicyAsync();
    expect(p.enabled).toBe(false);
    expect(p.intervalMs).toBe(10 * 60000);
  });

  it("updateLoggingFuseConfig upsert 并清缓存", async () => {
    mockUpsert.mockResolvedValue({} as never);
    mockFind.mockResolvedValue(row({ gatewayModelDailyLimit: 200 }) as never);
    const out = await updateLoggingFuseConfig({ modelDailyLimit: 200 });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const arg = mockUpsert.mock.calls[0]![0]!;
    expect((arg.update as Record<string, unknown>).gatewayModelDailyLimit).toBe(200);
    expect(out.modelDailyLimit).toBe(200);
  });

  it("缓存：30s 内不重复查库", async () => {
    mockFind.mockResolvedValue(row() as never);
    await getLoggingFuseConfig();
    await getLoggingFuseConfig();
    expect(mockFind).toHaveBeenCalledTimes(1);
    invalidateLoggingFuseConfigCache();
    await getLoggingFuseConfig();
    expect(mockFind).toHaveBeenCalledTimes(2);
  });
});
