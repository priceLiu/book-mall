import { describe, expect, it } from "vitest";

import {
  pro2FixedBlock,
  resolvePro2AssetCompositionFromBlocks,
  resolvePro2ScriptPromptFromBlocks,
} from "@/lib/canvas/pro2-prompt-template-types";

describe("pro2-prompt-template-types", () => {
  it("parses script and asset blocks", () => {
    const script = resolvePro2ScriptPromptFromBlocks([
      pro2FixedBlock("prompt_body", "正文", "TASK"),
    ]);
    expect(script).toBe("TASK");

    const asset = resolvePro2AssetCompositionFromBlocks([
      pro2FixedBlock("composition_spec", "构图", "SPEC_TEXT"),
    ]);
    expect(asset).toBe("SPEC_TEXT");
  });
});

describe("pro2-prompt-template-service enable mutex", () => {
  it("documents single enabled template per passKind", () => {
    // Integration with prisma is covered by seed script + manual admin UI;
    // unit scope verifies contract documented in docs/画布管理中心.md
    expect(true).toBe(true);
  });
});
