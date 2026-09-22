import { describe, expect, it } from "vitest";

import {
  extractFenceJson,
  extractFirstBalancedJsonObject,
} from "@/lib/ecom/detail-page-vision-decompose/schemas";

describe("extractFenceJson", () => {
  it("parses named fence with nested objects", () => {
    const text = `\`\`\`detail-page-suite-hit
{"schemaVersion":"detail-page-suite-hit/v1","meta":{"a":1},"component_list":[]}
\`\`\``;
    const json = extractFenceJson(text, "detail-page-suite-hit") as {
      meta: { a: number };
    };
    expect(json.meta.a).toBe(1);
  });

  it("falls back to json fence", () => {
    const text = '```json\n{"ok":true,"nested":{"x":2}}\n```';
    const json = extractFenceJson(text, "detail-page-suite-hit") as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("balanced extractor stops at outer close", () => {
    const slice = extractFirstBalancedJsonObject('prefix {"a":{"b":1}} trailing }');
    expect(JSON.parse(slice)).toEqual({ a: { b: 1 } });
  });
});
