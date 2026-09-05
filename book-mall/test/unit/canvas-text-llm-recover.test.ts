import { describe, expect, it } from "vitest";

import { extractChatTextFromGatewaySummary } from "@/lib/canvas/canvas-text-llm-recover";

describe("extractChatTextFromGatewaySummary", () => {
  it("reads chat kind text", () => {
    expect(
      extractChatTextFromGatewaySummary({ kind: "chat", text: "hello" }),
    ).toBe("hello");
  });

  it("reads plain text field", () => {
    expect(extractChatTextFromGatewaySummary({ text: "  world  " })).toBe(
      "world",
    );
  });

  it("reads OpenAI choices payload stored in resultSummary", () => {
    expect(
      extractChatTextFromGatewaySummary({
        choices: [{ message: { content: "outline body" } }],
      }),
    ).toBe("outline body");
  });

  it("reads nested data / choices[].text", () => {
    expect(
      extractChatTextFromGatewaySummary({
        data: { choices: [{ text: "nested text" }] },
      }),
    ).toBe("nested text");
  });
});
