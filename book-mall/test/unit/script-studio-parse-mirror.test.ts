import { describe, expect, it } from "vitest";
import { summarizeScriptStudioBatchMd } from "@/lib/canvas/script-studio-parse-mirror";

describe("summarizeScriptStudioBatchMd", () => {
  it("counts episodes and shots", () => {
    const md = `# 世界观
x

# 第 1 集
### 镜 1
| a | b |
### 镜 2

# 第 2 集
### 镜 3
`;
    const s = summarizeScriptStudioBatchMd(md);
    expect(s.episodeCount).toBe(2);
    expect(s.shotCount).toBe(3);
    expect(s.hasFrozenBibles).toBe(true);
  });
});
