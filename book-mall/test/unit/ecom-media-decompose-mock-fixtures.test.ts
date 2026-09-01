import { describe, expect, it } from "vitest";

import {
  MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH,
  MOCK_MEDIA_DECOMPOSE_VIDEO_PATCH,
  mockMediaDecomposePatchForKind,
} from "@/lib/ecom/ecom-media-decompose-mock-fixtures";
import { extractMediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";

describe("media-decompose mock fixtures", () => {
  it("video fixture parses from fence", () => {
    const text = `\`\`\`media-decompose\n${JSON.stringify(MOCK_MEDIA_DECOMPOSE_VIDEO_PATCH)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("video");
    expect(patch && "storyboardTable" in patch && patch.storyboardTable.length).toBe(3);
  });

  it("image fixture parses from fence", () => {
    const text = `\`\`\`media-decompose\n${JSON.stringify(MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("image");
    expect(patch && "positivePrompt" in patch && patch.positivePrompt.length).toBeGreaterThan(0);
  });

  it("mockMediaDecomposePatchForKind matches media kind", () => {
    expect(mockMediaDecomposePatchForKind("video").mediaType).toBe("video");
    expect(mockMediaDecomposePatchForKind("image").mediaType).toBe("image");
  });
});
