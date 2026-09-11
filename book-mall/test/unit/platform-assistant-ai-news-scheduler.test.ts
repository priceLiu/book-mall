import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform-assistant/platform-assistant-model-config-service", () => ({
  getAssistantNewsRuntimeConfig: vi.fn(async () => ({
    enabled: true,
    modelKey: "qwen3.5-27b",
    fallbackModelKeys: ["qwen3.5-flash"],
  })),
}));

vi.mock("@/lib/platform-assistant/ai-news-service", () => ({
  cstDateKey: vi.fn(() => "2026-09-11"),
  readDailyAiNews: vi.fn(async () => null),
  runDailyAiNewsGeneration: vi.fn(async () => ({
    ok: true,
    dateKey: "2026-09-11",
    row: { generatedAt: new Date() },
    pruned: { deleted: 0 },
  })),
}));

import { getAssistantNewsRuntimeConfig } from "@/lib/platform-assistant/platform-assistant-model-config-service";
import {
  readDailyAiNews,
  runDailyAiNewsGeneration,
} from "@/lib/platform-assistant/ai-news-service";
import {
  ensureTodayAiNewsIfMissing,
  resetAiNewsSchedulerForTests,
} from "@/lib/platform-assistant/ai-news-scheduler";

describe("platform-assistant ai-news scheduler", () => {
  afterEach(() => {
    resetAiNewsSchedulerForTests();
    vi.clearAllMocks();
  });

  it("generates when today is missing", async () => {
    const r = await ensureTodayAiNewsIfMissing(new Date("2026-09-11T08:00:00.000Z"));
    expect(r).toBe("ok");
    expect(runDailyAiNewsGeneration).toHaveBeenCalledTimes(1);
  });

  it("skips when today already ready", async () => {
    vi.mocked(readDailyAiNews).mockResolvedValueOnce({
      dateKey: "2026-09-11",
      content: "ok",
      status: "READY",
      generatedAt: new Date(),
      errorMessage: null,
    });
    const r = await ensureTodayAiNewsIfMissing();
    expect(r).toBe("skipped");
    expect(runDailyAiNewsGeneration).not.toHaveBeenCalled();
  });

  it("skips when news disabled in admin config", async () => {
    vi.mocked(getAssistantNewsRuntimeConfig).mockResolvedValueOnce({
      enabled: false,
      modelKey: "qwen3.5-27b",
      fallbackModelKeys: [],
    });
    const r = await ensureTodayAiNewsIfMissing();
    expect(r).toBe("skipped");
    expect(runDailyAiNewsGeneration).not.toHaveBeenCalled();
  });
});
