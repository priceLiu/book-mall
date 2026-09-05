import { describe, expect, it } from "vitest";

import { pro2FixedBlock } from "@/lib/canvas/pro2-prompt-template-types";
import { validatePro2TemplateBlocksForSave } from "@/lib/canvas/pro2-template-admin-validate";

describe("validatePro2TemplateBlocksForSave", () => {
  it("accepts plain markdown blocks", () => {
    expect(
      validatePro2TemplateBlocksForSave([
        pro2FixedBlock("prompt_body", "正文", "# 任务\n\n只输出 JSON"),
      ]),
    ).toBeNull();
  });

  it("rejects invalid json fence", () => {
    const err = validatePro2TemplateBlocksForSave([
      pro2FixedBlock("prompt_body", "正文", '```json\n{"a":\n```'),
    ]);
    expect(err).toMatch(/JSON 无效/);
  });

  it("accepts valid json fence", () => {
    expect(
      validatePro2TemplateBlocksForSave([
        pro2FixedBlock("prompt_body", "正文", '```json\n{"ok":true}\n```'),
      ]),
    ).toBeNull();
  });
});
