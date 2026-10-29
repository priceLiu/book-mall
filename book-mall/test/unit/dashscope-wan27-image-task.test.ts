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

  it("routes text-only wan2.6-image to wan2.6-t2i without enable_interleave", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          input: { messages: Array<{ content: unknown[] }> };
          parameters: Record<string, unknown>;
        };
        expect(body.model).toBe("wan2.6-t2i");
        expect(body.parameters.enable_interleave).toBeUndefined();
        expect(body.parameters.size).toBe("1696*960");
        expect(body.input.messages[0]?.content).toEqual([
          { text: "角色三视图，白底" },
        ]);
        return new Response(
          JSON.stringify({ output: { task_id: "task-wan26-t2i" } }),
          { status: 200 },
        );
      }),
    );

    const result = await dashscopeCreateWan27ImageTask({
      apiKey: "sk-test",
      model: "wan2.6-image",
      content: [{ text: "角色三视图，白底" }],
      size: "1696*960",
      contentOrder: "text-first",
    });

    expect(result).toEqual({ ok: true, taskId: "task-wan26-t2i" });
  });

  it("keeps wan2.6-image edit mode when a reference image is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          parameters: { enable_interleave?: boolean; size?: string };
        };
        expect(body.model).toBe("wan2.6-image");
        expect(body.parameters.enable_interleave).toBe(false);
        expect(body.parameters.size).toBe("2K");
        return new Response(
          JSON.stringify({ output: { task_id: "task-wan26-edit" } }),
          { status: 200 },
        );
      }),
    );

    const result = await dashscopeCreateWan27ImageTask({
      apiKey: "sk-test",
      model: "wan2.6-image",
      content: [
        { text: "保持脸部" },
        { image: "https://example.com/ref.png" },
      ],
    });

    expect(result).toEqual({ ok: true, taskId: "task-wan26-edit" });
  });

  it("passes bbox_list for wan2.7 local edit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          parameters: { bbox_list?: number[][][] };
        };
        expect(body.parameters.bbox_list).toEqual([[[10, 20, 100, 200]]]);
        return new Response(
          JSON.stringify({ output: { task_id: "task-wan27-bbox" } }),
          { status: 200 },
        );
      }),
    );

    const result = await dashscopeCreateWan27ImageTask({
      apiKey: "sk-test",
      model: "wan2.7-image-pro",
      content: [
        { image: "https://example.com/a.jpg" },
        { text: "replace sky" },
      ],
      bboxList: [[[10, 20, 100, 200]]],
    });

    expect(result).toEqual({ ok: true, taskId: "task-wan27-bbox" });
  });
});
