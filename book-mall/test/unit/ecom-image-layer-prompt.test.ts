import { describe, expect, it } from "vitest";

import {
  AUTO_DECOMPOSE_PROMPT,
  buildBatchEditPrompt,
  buildDecomposePrompt,
  normalizeBboxTuple,
  validateDecomposeBboxes,
} from "@/lib/ecom/ecom-image-layer-prompt";

describe("ecom-image-layer-prompt", () => {
  it("normalizeBboxTuple orders coords", () => {
    expect(normalizeBboxTuple([500, 400, 100, 200])).toEqual([100, 200, 500, 400]);
  });

  it("AUTO_DECOMPOSE_PROMPT asks to inpaint holes and keep the scene", () => {
    expect(AUTO_DECOMPOSE_PROMPT).toContain("对图片做完整图层语义分离");
    expect(AUTO_DECOMPOSE_PROMPT).toContain("从底图移除");
    expect(AUTO_DECOMPOSE_PROMPT).toContain("房间环境保持不变");
  });

  it("buildDecomposePrompt single bbox", () => {
    const p = buildDecomposePrompt([[10, 20, 90, 80]]);
    expect(p).toContain("需分离的区域坐标为 <bbox>10 20 90 80</bbox>");
    expect(p).toContain("从底图移除");
  });

  it("buildDecomposePrompt multi bbox uses region prefix per box", () => {
    const p = buildDecomposePrompt([
      [10, 20, 90, 80],
      [100, 100, 200, 200],
    ]);
    expect(p).toContain("区域1<bbox>10 20 90 80</bbox>");
    expect(p).toContain("区域2<bbox>100 100 200 200</bbox>");
    expect(p).not.toContain("坐标为 <bbox>10");
  });

  it("validateDecomposeBboxes rejects tiny boxes", () => {
    expect(() => validateDecomposeBboxes([[0, 0, 5, 5]])).toThrow(/过小/);
  });

  it("buildBatchEditPrompt joins multi-region edits", () => {
    const p = buildBatchEditPrompt([
      { bbox: [10, 20, 90, 80], prompt: "去掉文字" },
      { bbox: [100, 100, 200, 200], prompt: "去掉，并重绘" },
    ]);
    expect(p).toContain("<bbox>10 20 90 80</bbox> 区域去掉文字");
    expect(p).toContain("<bbox>100 100 200 200</bbox> 区域去掉，并重绘");
    expect(p).toContain("；");
  });

  it("buildBatchEditPrompt single edit matches buildEditPrompt", () => {
    const p = buildBatchEditPrompt([{ bbox: [1, 2, 3, 4], prompt: "换色" }]);
    expect(p).toBe("把图 1 <bbox>1 2 3 4</bbox> 区域换色");
  });
});
