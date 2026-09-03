import { describe, expect, it } from "vitest";

import {
  PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT,
  PRO2_GU_FENG_DEEPSEEK_SYSTEM_PROMPT,
} from "@/lib/canvas/data/pro2-gu-feng-deepseek-full-pack-prompt";
import {
  buildPro2GuFengFullPackUserPrompt,
  formatPro2GuFengFullPackStoryInput,
  isPro2GuFengFullPackRun,
  resolvePro2FullPackSystemPrompt,
  resolvePro2GuFengOutlinePromptForRun,
} from "@/lib/canvas/pro2-gu-feng-full-pack-run";
import { STORY_PRO2_HUB_LLM_SYSTEM } from "@/lib/canvas/story-pro2-theme-outline-prompt";
import {
  PRO2_GU_FENG_JSON_OUTPUT_RULES,
  PRO2_GU_FENG_TEXT_SYSTEM,
} from "@/lib/canvas/data/pro2-gu-feng-tian-chong-rules";
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
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).toContain("JSON-only v13");
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).toContain(
      "pro2-production-script",
    );
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).toContain("12–18 镜");
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).toContain("traits");
    expect(PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT).not.toContain(
      "# 任务：场景视觉提示词",
    );
  });

  it("appends shot budget and story input like DeepSeek", () => {
    const user = buildPro2GuFengFullPackUserPrompt("时长\n3分钟");
    expect(user).toContain("镜数与时长预算");
    expect(user).toContain("不得少于 **12** 镜");
    const story = formatPro2GuFengFullPackStoryInput("第一集《未婚夫…》");
    expect(story).toContain("【以下为故事大纲，请严格按上述规则生成完整制作包 JSON】");
    expect(story).toContain("第一集");
  });

  it("replaces segmented outline prompt for gu-feng full pack", () => {
    const resolved = resolvePro2GuFengOutlinePromptForRun(
      "gu-feng-tian-chong",
      "3分钟",
      "# 任务：故事剧本 · 大纲段",
    );
    expect(resolved).not.toContain("# 任务：故事剧本 · 大纲段");
    expect(resolved).toContain("JSON-only v13");
    expect(isPro2GuFengFullPackRun("gu-feng-tian-chong", "3分钟")).toBe(true);
    expect(isPro2GuFengFullPackRun("gu-feng-tian-chong", "")).toBe(false);
  });

  it("resolvePro2FullPackSystemPrompt returns JSON-only for all categories", () => {
    expect(resolvePro2FullPackSystemPrompt("gu-feng-tian-chong")).toContain(
      "pro2-production-script",
    );
    expect(resolvePro2FullPackSystemPrompt("default-master")).toBe(
      STORY_PRO2_HUB_LLM_SYSTEM,
    );
    expect(STORY_PRO2_HUB_LLM_SYSTEM).toContain("json-only-v13");
    expect(STORY_PRO2_HUB_LLM_SYSTEM).not.toContain("GFM Markdown");
  });

  it("gu-feng text system and json rules forbid GFM output", () => {
    expect(PRO2_GU_FENG_TEXT_SYSTEM).toContain("step=outline");
    expect(PRO2_GU_FENG_TEXT_SYSTEM).not.toContain("Markdown 制作包");
    expect(PRO2_GU_FENG_JSON_OUTPUT_RULES).toContain("json-only-v13");
    expect(PRO2_GU_FENG_JSON_OUTPUT_RULES).not.toContain("## 分镜脚本");
  });
});
