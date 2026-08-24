import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gatewayRequestLog: {
      count: vi.fn(),
    },
  },
}));
vi.mock("@/lib/platform-error-log", () => ({
  recordPlatformError: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { recordPlatformError } from "@/lib/platform-error-log";
import {
  MODEL_DAILY_LIMIT_DEFAULT,
  ModelDailyLimitError,
  assertModelDailyLimitAllowed,
  resolveModelDailyLimit,
  resolveModelDailyLimitConfig,
} from "@/lib/gateway/model-daily-limit";

const mockCount = vi.mocked(prisma.gatewayRequestLog.count);
const mockedRecord = vi.mocked(recordPlatformError);

describe("model-daily-limit 配置解析", () => {
  it("默认：开启，上限 300", () => {
    const c = resolveModelDailyLimitConfig({});
    expect(c.enabled).toBe(true);
    expect(c.defaultLimit).toBe(MODEL_DAILY_LIMIT_DEFAULT);
  });

  it("0 / off / false / 非法值 = 关闭", () => {
    for (const v of ["0", "off", "false", "abc", "-5"]) {
      expect(resolveModelDailyLimitConfig({ GATEWAY_MODEL_DAILY_LIMIT: v }).enabled).toBe(false);
    }
  });

  it("自定义上限 + 按模型覆盖（0=该模型不限）", () => {
    const c = resolveModelDailyLimitConfig({
      GATEWAY_MODEL_DAILY_LIMIT: "100",
      GATEWAY_MODEL_DAILY_LIMIT_OVERRIDES:
        '{"deepseek-v4-flash":1000,"kling-x":0,"bad":-1}',
    });
    expect(c.defaultLimit).toBe(100);
    expect(resolveModelDailyLimit("deepseek-v4-flash", c)).toBe(1000);
    expect(resolveModelDailyLimit("kling-x", c)).toBeNull();
    expect(resolveModelDailyLimit("other-model", c)).toBe(100);
  });

  it("覆盖 JSON 非法时忽略覆盖", () => {
    const c = resolveModelDailyLimitConfig({
      GATEWAY_MODEL_DAILY_LIMIT_OVERRIDES: "{not json",
    });
    expect(c.overrides).toEqual({});
  });

  it("关闭时所有模型不限", () => {
    const c = resolveModelDailyLimitConfig({ GATEWAY_MODEL_DAILY_LIMIT: "0" });
    expect(resolveModelDailyLimit("any", c)).toBeNull();
  });
});

describe("assertModelDailyLimitAllowed", () => {
  beforeEach(() => {
    mockCount.mockReset();
    mockedRecord.mockClear();
  });

  it("未达上限：放行", async () => {
    mockCount.mockResolvedValue(10);
    await expect(
      assertModelDailyLimitAllowed("deepseek-v4-flash", {
        now: new Date("2026-08-24T10:00:00+08:00"),
        config: { enabled: true, defaultLimit: 300, overrides: {} },
      }),
    ).resolves.toBeUndefined();
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("达到上限：抛 ModelDailyLimitError + 告警落库", async () => {
    mockCount.mockResolvedValue(300);
    await expect(
      assertModelDailyLimitAllowed("deepseek-v4-flash", {
        now: new Date("2026-08-24T10:00:00+08:00"),
        config: { enabled: true, defaultLimit: 300, overrides: {} },
      }),
    ).rejects.toBeInstanceOf(ModelDailyLimitError);
    expect(mockedRecord).toHaveBeenCalledTimes(1);
    const arg = mockedRecord.mock.calls[0]![0]!;
    expect(arg.code).toBe("MODEL_DAILY_LIMIT");
    expect(arg.source).toBe("GATEWAY");
  });

  it("关闭时：不查库直接放行", async () => {
    await assertModelDailyLimitAllowed("deepseek-v4-flash", {
      config: { enabled: false, defaultLimit: 300, overrides: {} },
    });
    expect(mockCount).not.toHaveBeenCalled();
  });

  it("计数口径为 CST 当日（+08:00 边界）", async () => {
    mockCount.mockResolvedValue(0);
    // UTC 2026-08-23 17:30 = CST 2026-08-24 01:30
    await assertModelDailyLimitAllowed("m", {
      now: new Date("2026-08-23T17:30:00Z"),
      config: { enabled: true, defaultLimit: 10, overrides: {} },
    });
    const where = mockCount.mock.calls[0]![0]!.where!;
    const gte = (where.submittedAt as { gte: Date }).gte;
    // CST 2026-08-24 00:00 = UTC 2026-08-23 16:00
    expect(gte.toISOString()).toBe("2026-08-23T16:00:00.000Z");
  });
});
