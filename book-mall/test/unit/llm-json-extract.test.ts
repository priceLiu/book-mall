import { describe, expect, it } from "vitest";

import { extractFirstJsonObjectFromLlmText } from "@/lib/ecom/llm-json-extract";

describe("extractFirstJsonObjectFromLlmText", () => {
  it("parses object with trailing prose", () => {
    const obj = extractFirstJsonObjectFromLlmText(`{
  "product_name": "测试",
  "core_selling_points": ["a"]
}

以上是卖点说明。`) as Record<string, unknown>;
    expect(obj.product_name).toBe("测试");
  });

  it("parses fenced json", () => {
    const obj = extractFirstJsonObjectFromLlmText(
      '说明\n```json\n{"product_name":"x","core_selling_points":[]}\n```\n完',
    ) as Record<string, unknown>;
    expect(obj.product_name).toBe("x");
  });

  it("ignores braces inside strings", () => {
    const obj = extractFirstJsonObjectFromLlmText(
      '{"product_name":"含}括号","core_selling_points":["ok"]} trailing',
    ) as Record<string, unknown>;
    expect(obj.product_name).toBe("含}括号");
  });
});