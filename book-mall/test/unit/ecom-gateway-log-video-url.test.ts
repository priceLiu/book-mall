import { describe, expect, it } from "vitest";

import { extractVideoUrlFromGatewayLogSummary } from "@/lib/ecom/ecom-gateway-log-video-url";

describe("extractVideoUrlFromGatewayLogSummary", () => {
  it("reads MiniMax content.url", () => {
    expect(
      extractVideoUrlFromGatewayLogSummary(
        {
          status: "Success",
          content: { url: "https://cdn.example/minimax.mp4" },
        },
        { pollProvider: "minimax" },
      ),
    ).toBe("https://cdn.example/minimax.mp4");
  });

  it("reads slim videoUrl on MiniMax summary", () => {
    expect(
      extractVideoUrlFromGatewayLogSummary(
        { videoUrl: "https://cdn.example/slim-minimax.mp4" },
        { pollProvider: "minimax" },
      ),
    ).toBe("https://cdn.example/slim-minimax.mp4");
  });

  it("reads MiniMax nested task.content.url", () => {
    expect(
      extractVideoUrlFromGatewayLogSummary(
        {
          task: {
            status: "succeeded",
            content: { url: "https://cdn.example/nested-minimax.mp4" },
          },
        },
        { pollProvider: "minimax" },
      ),
    ).toBe("https://cdn.example/nested-minimax.mp4");
  });

  it("reads KIE resultJson video url", () => {
    expect(
      extractVideoUrlFromGatewayLogSummary(
        {
          state: "success",
          resultJson: JSON.stringify({
            resultUrls: ["https://cdn.example/kie.mp4"],
          }),
        },
        { pollProvider: "kie" },
      ),
    ).toBe("https://cdn.example/kie.mp4");
  });

  it("reads DashScope sync multimodal imageUrls", () => {
    expect(
      extractVideoUrlFromGatewayLogSummary(
        {
          sync: true,
          imageUrls: ["https://cdn.example/qwen-edit.png"],
          output: {
            task_status: "SUCCEEDED",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: [{ image: "https://cdn.example/qwen-edit.png" }],
                },
              },
            ],
          },
        },
        { pollProvider: "dashscope" },
      ),
    ).toBe("https://cdn.example/qwen-edit.png");
  });
});
