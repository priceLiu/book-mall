import { describe, expect, it } from "vitest";
import {
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import {
  handoffSectionPresent,
  storyboardMeetsPackQuality,
} from "@/lib/canvas/pro2-pack-readiness";

function buildStoryboardFixture(shotCount: number): string {
  const rows = Array.from({ length: shotCount }, (_, i) => {
    const n = i + 1;
    return `| ${n} | 中景 | 暖调侧光 | 固定机位平拍，人物入画 | 【起始】镜${n}起始。【结束】镜${n}终止。 | — | — | 10 | 环境音 ${n} | lip ${n} |`;
  });
  return `${STORY_PRO2_STORYBOARD_TABLE_HEADER}\n${rows.join("\n")}`;
}

describe("pro2 pack readiness", () => {
  it("storyboardMeetsPackQuality requires min shots and v2 completeness", () => {
    const outline = "预计时长 | 3分钟";
    expect(storyboardMeetsPackQuality(buildStoryboardFixture(12), outline)).toBe(
      true,
    );
    expect(storyboardMeetsPackQuality(buildStoryboardFixture(2), outline)).toBe(
      false,
    );
    const incomplete = `${STORY_PRO2_STORYBOARD_TABLE_HEADER}
| 1 | 中景 |  | 固定机位平拍，人物入画 | desc | — | — | 10 |  | lip |`;
    expect(storyboardMeetsPackQuality(incomplete, outline)).toBe(false);
  });

  it("handoffSectionPresent requires at least 6 rows", () => {
    const ok = `## 下一步交接清单
| 序号 | 交接项 | 负责方 | 备注 |
|------|--------|--------|------|
| 1 | a | x | n |
| 2 | b | x | n |
| 3 | c | x | n |
| 4 | d | x | n |
| 5 | e | x | n |
| 6 | f | x | n |`;
    expect(handoffSectionPresent(ok)).toBe(true);
    expect(handoffSectionPresent(ok.replace("| 6 |", "| 6x |").slice(0, -20))).toBe(
      false,
    );
  });
});
