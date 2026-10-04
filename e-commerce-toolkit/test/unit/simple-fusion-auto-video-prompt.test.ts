import { describe, expect, it } from "vitest";

import { buildSimpleFusionAutoVideoPrompt } from "@/lib/simple-fusion-auto-video-prompt";

describe("buildSimpleFusionAutoVideoPrompt", () => {
  it("prefixes successful fusion tokens only", () => {
    const p = buildSimpleFusionAutoVideoPrompt("dance", [
      { key: "1", caption: "套1", fusedImageUrl: "https://x/a.jpg", status: "fused" },
      { key: "2", caption: "套2", status: "failed", failReason: "x" },
    ]);
    expect(p).toContain("@融合1");
    expect(p).not.toContain("@融合2");
  });
});
