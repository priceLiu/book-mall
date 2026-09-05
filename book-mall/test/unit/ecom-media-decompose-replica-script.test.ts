import { describe, expect, it } from "vitest";

import { extractReplicaScriptPatch } from "@/lib/ecom/ecom-media-decompose-replica-script";

describe("extractReplicaScriptPatch", () => {
  const sample = {
    shots: [
      {
        index: 1,
        sceneDescription: "模特展示新产品",
        videoPrompt: "@图片1 @图片2 中景推镜",
        voiceover: "夏季必备针织开衫",
        durationSec: 5,
      },
    ],
  };

  it("parses replica-script fence", () => {
    const text = `说明\n\`\`\`replica-script\n${JSON.stringify(sample)}\n\`\`\``;
    expect(extractReplicaScriptPatch(text)?.shots).toHaveLength(1);
  });

  it("parses json fence alias", () => {
    const text = `\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``;
    expect(extractReplicaScriptPatch(text)?.shots[0]?.voiceover).toContain("针织");
  });

  it("parses bare shots JSON", () => {
    const text = `前言 ${JSON.stringify(sample)} 后记`;
    expect(extractReplicaScriptPatch(text)?.shots).toHaveLength(1);
  });
});
