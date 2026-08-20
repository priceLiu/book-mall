import { describe, expect, it } from "vitest";
import {
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_PARSE_CONTRACT,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import {
  appendPro2ParseContract,
  buildPro2FullPackUserPrompt,
  isPro2FullPackRun,
} from "@/lib/canvas/pro2-pack-parse-contract";

describe("pro2 pack parse contract", () => {
  it("appendPro2ParseContract includes JSON-only contract and shot budget", () => {
    const suffix = appendPro2ParseContract({
      outlineMd: "预计时长 | 3分钟",
      scriptCategoryId: "default-master",
    });
    expect(suffix).toContain(STORY_PRO2_PACK_PARSE_CONTRACT.slice(0, 40));
    expect(suffix).toContain("镜数与时长预算");
    expect(suffix).toContain("交接清单结构参考");
    expect(suffix).toContain("pro2-production-script");
    expect(suffix).toContain(STORY_PRO2_JSON_OUTPUT_CONTRACT.slice(0, 40));
    expect(suffix).not.toContain("不要 JSON");
    expect(suffix).not.toContain("| 镜号 |");
  });

  it("buildPro2FullPackUserPrompt merges creative template with contract", () => {
    const user = buildPro2FullPackUserPrompt(
      "# 创意模板\n按大纲写制作包",
      "第一集\n3分钟",
      "default-master",
    );
    expect(user).toContain("# 创意模板");
    expect(user).toContain("系统解析契约");
    expect(user).toContain("镜数与时长预算");
    expect(user).toContain("JSON-only");
  });

  it("isPro2FullPackRun when outline non-empty", () => {
    expect(isPro2FullPackRun("## 大纲")).toBe(true);
    expect(isPro2FullPackRun("")).toBe(false);
  });
});
