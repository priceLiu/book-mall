import { describe, expect, it, vi, afterEach } from "vitest";

import { dashscopeCreateWan27ImageTask } from "@/lib/gateway/dashscope-client";

describe("dashscopeCreateWan27ImageTask", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows wan2.7-image-pro text-only T2I (no silent downgrade)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          input: { messages: Array<{ content: unknown[] }> };
        };
        expect(body.model).toBe("wan2.7-image-pro");
        expect(body.input.messages[0]?.content).toEqual([
          { text: "简约电商摄影棚场景" },
        ]);
        return new Response(
          JSON.stringify({ output: { task_id: "task-wan27-t2i" } }),
          { status: 200 },
        );
      }),
    );

    const result = await dashscopeCreateWan27ImageTask({
      apiKey: "sk-test",
      model: "wan2.7-image-pro",
      content: [{ text: "简约电商摄影棚场景" }],
      size: "1440*1440",
      contentOrder: "text-first",
    });

    expect(result).toEqual({ ok: true, taskId: "task-wan27-t2i" });
  });

  it("still rejects image-only content without text", async () => {
    const result = await dashscopeCreateWan27ImageTask({
      apiKey: "sk-test",
      model: "wan2.7-image-pro",
      content: [{ image: "https://example.com/a.jpg" }],
    });
    expect(result).toEqual({ ok: false, error: "缺少 text 提示词" });
  });
});
