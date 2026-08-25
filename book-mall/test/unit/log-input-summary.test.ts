import { describe, expect, it } from "vitest";

import {
  buildDashscopeCreateTaskInputForLog,
  buildGatewayInputSummary,
} from "@/lib/gateway/log-input-summary";

describe("buildDashscopeCreateTaskInputForLog", () => {
  it("expands videoBody into log input (wan3.0 prompt + media + parameters)", () => {
    const input = buildDashscopeCreateTaskInputForLog({
      jobKind: "video",
      videoBody: {
        input: {
          prompt: "test prompt",
          media: [
            {
              type: "reference_image",
              url: "https://example.com/a.png",
            },
          ],
        },
        parameters: {
          resolution: "720P",
          ratio: "16:9",
          duration: 15,
          watermark: false,
        },
      },
    });
    expect(input).toEqual({
      jobKind: "video",
      prompt: "test prompt",
      media: [{ type: "reference_image", url: "https://example.com/a.png" }],
      parameters: {
        resolution: "720P",
        ratio: "16:9",
        duration: 15,
        watermark: false,
      },
    });
    const summary = buildGatewayInputSummary("wan3.0-video", input);
    expect(summary.model).toBe("wan3.0-video");
    expect(summary.input.prompt).toBe("test prompt");
    expect(summary.input.parameters).toMatchObject({ duration: 15 });
  });

  it("keeps wanx jobKind fields for non-video dashscope jobs", () => {
    expect(
      buildDashscopeCreateTaskInputForLog({
        jobKind: "wanx",
        prompt: "cat",
        n: 1,
      }),
    ).toEqual({
      jobKind: "wanx",
      prompt: "cat",
      content: undefined,
      size: undefined,
      n: 1,
      aspectRatio: undefined,
      resolution: undefined,
      contentOrder: undefined,
    });
  });
});
