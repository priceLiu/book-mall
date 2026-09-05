import { describe, expect, it } from "vitest";
import {
  buildEntityHighlightMatchersForShot,
  expandWizardMentionsForPrompt,
  formatWizardMentionsForDisplay,
  hydrateShotEntityMentionsForEdit,
  hydrateWizardMentionsInText,
  inferCharacterIdsFromDialogue,
  parseWizardMentionAssetRefs,
  reconcileProductionScriptEntityLinks,
  reconcileShotEntityLinks,
  resolvePropIdsFromDisplayText,
  resolveShotSceneName,
  wizardMentionId,
} from "@/lib/canvas/pro2-shot-entity-reconcile";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";

const script: Pro2ProductionScript = {
  characters: [{ id: "c1", name: "现代沈昭昭", role: "女主" }],
  scenes: [{
    id: "s1",
    name: "现代办公室",
    environmentTimeMood: "现代，深夜，极低饱和冷蓝",
  }],
  props: [
    { id: "p1", name: "智能手机", description: "黑色全面屏" },
    { id: "p2", name: "办公电脑显示器", description: "键盘" },
  ],
  shots: [
    {
      index: 1,
      sceneDescription: "沈昭昭看手机屏幕",
      lighting: "深夜室内，极低饱和冷蓝光影",
      dialogue: "现代沈昭昭（疲惫）：\"又加班\"",
      durationSec: 10,
    },
    {
      index: 2,
      sceneDescription: "另一镜只有办公室环境",
      propIds: ["p2"],
      sceneId: "s1",
      durationSec: 12,
    },
  ],
};

describe("parseWizardMentionAssetRefs", () => {
  it("parses wiz-char/scene/prop tokens", () => {
    const text =
      "画面 @<wiz-char-c1> 在 @<wiz-scene-s1> 使用 @<wiz-prop-p1>";
    expect(parseWizardMentionAssetRefs(text)).toEqual({
      characterIds: ["c1"],
      sceneIds: ["s1"],
      propIds: ["p1"],
    });
  });
});

describe("resolvePropIdsFromDisplayText", () => {
  it("fuzzy matches prop names", () => {
    expect(resolvePropIdsFromDisplayText("智能手机、办公电脑显示器", script)).toEqual(
      ["p1", "p2"],
    );
  });
});

describe("inferCharacterIdsFromDialogue", () => {
  it("extracts speaker from dialogue line", () => {
    const shot = script.shots![0];
    expect(inferCharacterIdsFromDialogue(shot, script)).toEqual(["c1"]);
  });
});

describe("reconcileShotEntityLinks", () => {
  it("infers sceneId and propIds from narrative text", () => {
    const shot = script.shots![0];
    const reconciled = reconcileShotEntityLinks(shot, script);
    expect(reconciled.sceneId).toBe("s1");
    expect(reconciled.propIds).toContain("p1");
    expect(reconciled.characterIds).toContain("c1");
  });

  it("keeps explicit ids over infer", () => {
    const shot = script.shots![1];
    const reconciled = reconcileShotEntityLinks(shot, script);
    expect(reconciled.sceneId).toBe("s1");
    expect(reconciled.propIds).toEqual(["p2"]);
  });

  it("merges @ mentions from narrative", () => {
    const reconciled = reconcileShotEntityLinks(
      {
        index: 3,
        sceneDescription: "特写 @<wiz-prop-p1>",
        durationSec: 8,
      },
      script,
    );
    expect(reconciled.propIds).toEqual(["p1"]);
  });
});

describe("reconcileProductionScriptEntityLinks", () => {
  it("updates all shots when links change", () => {
    const next = reconcileProductionScriptEntityLinks(script);
    expect(next.shots![0].sceneId).toBe("s1");
    expect(next.shots![0].propIds).toContain("p1");
  });
});

describe("buildEntityHighlightMatchersForShot", () => {
  it("does not bleed matchers from other shots", () => {
    const shot1Matchers = buildEntityHighlightMatchersForShot(
      script.shots![0],
      script,
    );
    const shot2Matchers = buildEntityHighlightMatchersForShot(
      script.shots![1],
      script,
    );
    const shot1Terms = shot1Matchers.map((m) => m.term);
    const shot2Terms = shot2Matchers.map((m) => m.term);
    expect(shot1Terms).toContain("智能手机");
    expect(shot2Terms).not.toContain("智能手机");
    expect(shot2Terms).toContain("办公电脑显示器");
  });
});

describe("resolveShotSceneName", () => {
  it("returns scene catalog name", () => {
    expect(
      resolveShotSceneName({ index: 1, sceneId: "s1", durationSec: 5 }, script),
    ).toBe("现代办公室");
  });

  it("infers scene from environmentTimeMood in lighting", () => {
    const richScript: Pro2ProductionScript = {
      ...script,
      scenes: [
        {
          id: "s-palace",
          name: "金銮殿",
          environmentTimeMood: "盛唐，白日，暖金朱红",
        },
      ],
      shots: [
        {
          index: 1,
          sceneDescription: "皇帝端坐龙椅",
          lighting: "白日殿内，侧光打亮龙椅",
          durationSec: 8,
        },
      ],
    };
    expect(
      resolveShotSceneName(richScript.shots![0], richScript),
    ).toBe("金銮殿");
  });

  it("disambiguates multiple 盛唐 scenes by lighting tokens", () => {
    const multi: Pro2ProductionScript = {
      scenes: [
        {
          id: "s-office",
          name: "现代深夜办公室",
          environmentTimeMood: "现代，深夜，极低饱和冷蓝",
        },
        {
          id: "s-palace",
          name: "盛唐金銮殿",
          environmentTimeMood: "盛唐，白日，暖金朱红",
        },
        {
          id: "s-street",
          name: "盛唐长安街市与山河",
          environmentTimeMood: "盛唐，黄昏入夜，暖金灯火",
        },
      ],
      shots: [
        {
          index: 1,
          lighting: "深夜室内，极低饱和冷蓝",
          sceneDescription: "伏案加班",
          durationSec: 10,
        },
        {
          index: 2,
          lighting: "白日殿内，侧光打亮龙椅",
          sceneDescription: "皇帝登基",
          durationSec: 12,
        },
        {
          index: 3,
          lighting: "黄昏入夜，暖金灯火连绵",
          sceneDescription: "长安街市",
          durationSec: 11,
        },
      ],
    };
    const linked = reconcileProductionScriptEntityLinks(multi);
    expect(linked.shots![0].sceneId).toBe("s-office");
    expect(linked.shots![1].sceneId).toBe("s-palace");
    expect(linked.shots![2].sceneId).toBe("s-street");
  });
});

describe("expandWizardMentionsForPrompt", () => {
  it("expands wiz tokens to asset summaries", () => {
    const out = expandWizardMentionsForPrompt(
      "角色 @<wiz-char-c1> 在 @<wiz-scene-s1>",
      script,
    );
    expect(out).toContain("【现代沈昭昭");
    expect(out).toContain("【现代办公室");
  });
});

describe("hydrateWizardMentionsInText", () => {
  it("replaces plain entity names with wiz tokens", () => {
    const entities = [
      { kind: "character" as const, id: "c1", name: "现代沈昭昭" },
      { kind: "scene" as const, id: "s1", name: "现代办公室" },
      { kind: "prop" as const, id: "p2", name: "办公电脑显示器" },
    ];
    const plain =
      "现代沈昭昭在现代办公室伏案加班，双手飞速敲击键盘，电脑屏幕刺眼蓝光。";
    const out = hydrateWizardMentionsInText(plain, entities);
    expect(out).toContain(`@<${wizardMentionId("character", "c1")}>`);
    expect(out).toContain(`@<${wizardMentionId("scene", "s1")}>`);
    expect(out).not.toContain("@<wiz-char-c1> 在 @<wiz-char-c1>");
  });

  it("skips ranges already tokenized", () => {
    const entities = [{ kind: "character" as const, id: "c1", name: "现代沈昭昭" }];
    const already = `@<wiz-char-c1> 看手机`;
    expect(hydrateWizardMentionsInText(already, entities)).toBe(already);
  });
});

describe("hydrateShotEntityMentionsForEdit", () => {
  it("hydrates reconciled shot fields for edit modal", () => {
    const shot = script.shots![0];
    const { shot: hydrated, propDisplayText } = hydrateShotEntityMentionsForEdit(
      shot,
      script,
    );
    expect(hydrated.sceneDescription).toContain("@<wiz-char-c1>");
    expect(hydrated.sceneDescription).toContain("@<wiz-prop-p1>");
    expect(hydrated.sceneId).toBe("s1");
    expect(hydrated.dialogue).toContain("@<wiz-char-c1>");
    expect(propDisplayText).toContain("@<wiz-prop-p1>");
  });

  it("hydrates frameImagePrompt and videoPrompt with @ tokens", () => {
    const shot = {
      ...script.shots![0],
      frameImagePrompt:
        "特写，现代沈昭昭在现代办公室伏案，智能手机屏幕冷蓝光映脸。",
      videoPrompt: "出场角色：现代沈昭昭\n背景场景：现代办公室",
    };
    const { shot: hydrated } = hydrateShotEntityMentionsForEdit(shot, script);
    expect(hydrated.frameImagePrompt).toContain("@<wiz-char-c1>");
    expect(hydrated.frameImagePrompt).toContain("@<wiz-scene-s1>");
    expect(hydrated.videoPrompt).toContain("@<wiz-char-c1>");
    expect(hydrated.videoPrompt).toContain("@<wiz-scene-s1>");
  });
});

describe("reconcileShotEntityLinks · Pass2 prompts", () => {
  it("infers entity ids from frame/video prompt text", () => {
    const shot = {
      index: 3,
      sceneDescription: "—",
      dialogue: "—",
      durationSec: 5,
      frameImagePrompt: "现代沈昭昭在现代办公室看手机",
      videoPrompt: "道具：智能手机",
    };
    const reconciled = reconcileShotEntityLinks(shot, script);
    expect(reconciled.characterIds).toContain("c1");
    expect(reconciled.sceneId).toBe("s1");
    expect(reconciled.propIds).toContain("p1");
  });
});

describe("formatWizardMentionsForDisplay", () => {
  it("renders wiz tokens as canonical names", () => {
    const raw = `@<wiz-char-c1> 在 @<wiz-scene-s1>`;
    expect(formatWizardMentionsForDisplay(raw, script)).toBe(
      "现代沈昭昭 在 现代办公室",
    );
  });
});
