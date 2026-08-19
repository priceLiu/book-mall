import { describe, expect, it } from "vitest";

import {
  PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT,
  PRO2_GU_FENG_DEEPSEEK_SYSTEM_PROMPT,
} from "@/lib/canvas/data/pro2-gu-feng-deepseek-full-pack-prompt";
import {
  buildPro2GuFengFullPackUserPrompt,
  formatPro2GuFengFullPackStoryInput,
  isPro2GuFengFullPackRun,
  resolvePro2GuFengOutlinePromptForRun,
} from "@/lib/canvas/pro2-gu-feng-full-pack-run";
import { resolvePro2HubScriptGenerationSections } from "@/lib/canvas/pro2-script-generation-sections";

describe("pro2 gu-feng DeepSeek full pack", () => {
  it("uses single outline LLM when any category has story outline", () => {
    expect(
      resolvePro2HubScriptGenerationSections("第一集\n3分钟", "gu-feng-tian-chong"),
    ).toEqual(["outline"]);
    expect(
      resolvePro2HubScriptGenerationSections("第一集\n3分钟", "default-master"),
    ).toEqual(["outline"]);
  });

  it("user prompt matches DeepSeek console template markers", () => {
    expect(PRO2_GU_FENG_DEEPSEEK_SYSTEM_PROMPT).toContain(
      "精通古风甜宠与短视频节奏",
    );
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).toContain("道具六视图生成");
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).toContain(
      "场景名 | 环境/时间/气氛 | 生图关键词(英文) | 固定反向提示词",
    );
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).toContain(
      "画面描述（含起始→终止站位）",
    );
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).not.toContain(
      "# 任务：场景视觉提示词",
    );
  });

  it("appends shot budget and story input like DeepSeek", () => {
    const user = buildPro2GuFengFullPackUserPrompt("时长\n3分钟");
    expect(user).toContain("镜数与时长预算");
    expect(user).toContain("不得少于 **12** 镜");
    const story = formatPro2GuFengFullPackStoryInput("第一集《未婚夫…》");
    expect(story).toContain("【以下为故事大纲，请严格按上述规则生成完整制作包】");
    expect(story).toContain("第一集");
  });

  it("replaces segmented outline prompt for gu-feng full pack", () => {
    const resolved = resolvePro2GuFengOutlinePromptForRun(
      "gu-feng-tian-chong",
      "3分钟",
      "# 任务：故事剧本 · 大纲段",
    );
    expect(resolved).not.toContain("# 任务：故事剧本 · 大纲段");
    expect(resolved).toContain("道具六视图生成");
    expect(isPro2GuFengFullPackRun("gu-feng-tian-chong", "3分钟")).toBe(true);
    expect(isPro2GuFengFullPackRun("gu-feng-tian-chong", "")).toBe(false);
  });
});
