import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform-error-log", () => ({
  recordPlatformError: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { recordPlatformError } from "@/lib/platform-error-log";
import {
  auditVendorDirectEgress,
  extractUrlHost,
  isKnownVendorHost,
  parseVendorDirectBlockHosts,
} from "@/lib/gateway/vendor-egress-audit";

const mockedRecord = vi.mocked(recordPlatformError);

/** fire-and-forget：等若干 tick 让动态 import + 记录完成 */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe("vendor-egress-audit", () => {
  beforeEach(() => {
    mockedRecord.mockClear();
  });

  it("extractUrlHost 解析并小写", () => {
    expect(extractUrlHost("https://API.DeepSeek.com/v1")).toBe("api.deepseek.com");
    expect(extractUrlHost("not a url")).toBe("");
  });

  it("isKnownVendorHost 命中已知厂商、放过自建域名", () => {
    expect(isKnownVendorHost("api.deepseek.com")).toBe(true);
    expect(isKnownVendorHost("dashscope.aliyuncs.com")).toBe(true);
    expect(isKnownVendorHost("ark.cn-beijing.volces.com")).toBe(true);
    expect(isKnownVendorHost("gw.example.com")).toBe(false);
  });

  it("parseVendorDirectBlockHosts 解析逗号列表（env 回退）", () => {
    expect(parseVendorDirectBlockHosts({})).toEqual([]);
    expect(
      parseVendorDirectBlockHosts({
        VENDOR_DIRECT_BLOCK_HOSTS: " api.deepseek.com , API.MOONSHOT.cn ",
      }),
    ).toEqual(["api.deepseek.com", "api.moonshot.cn"]);
  });

  it("非已知厂商域名静默放行（不记录）", async () => {
    auditVendorDirectEgress({
      baseUrl: "https://my-proxy.internal/v1",
      model: "m",
      apiKey: "sk-x",
      caller: "test",
    });
    await flush();
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("已知厂商直连：审计记录 VENDOR_DIRECT_EGRESS（WARN），key 只落指纹", async () => {
    auditVendorDirectEgress({
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "sk-secret-value",
      caller: "OpenAiCompatGateway.chat",
    });
    await flush();
    expect(mockedRecord).toHaveBeenCalledTimes(1);
    const arg = mockedRecord.mock.calls[0]![0]!;
    expect(["VENDOR_DIRECT_EGRESS", "VENDOR_DIRECT_BLOCKED"]).toContain(arg.code);
    expect(arg.source).toBe("SYSTEM");
    const ctx = arg.context as Record<string, unknown>;
    expect(ctx.vendorHost).toBe("api.deepseek.com");
    expect(ctx.caller).toBe("OpenAiCompatGateway.chat");
    expect(JSON.stringify(arg)).not.toContain("sk-secret-value");
    expect(ctx.keyFingerprint).toMatch(/^[0-9a-f]{12}$/);
  });
});
