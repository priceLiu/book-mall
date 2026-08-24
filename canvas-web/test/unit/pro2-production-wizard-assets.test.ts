import { describe, expect, it } from "vitest";
import {
  appendWizardAsset,
  buildEntityHighlightMatchers,
  longestEntityAliasInText,
  propIdsFromDisplayNames,
  resolveShotLinkedEntities,
  splitTextByEntityMatchers,
  splitTextByLinkedEntities,
} from "@/lib/canvas/pro2-production-wizard-assets";
import { buildEntityHighlightMatchersForShot } from "@/lib/canvas/pro2-shot-entity-reconcile";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";

const script: Pro2ProductionScript = {
  characters: [
    { id: "c1", name: "现代沈昭昭", role: "女主" },
    { id: "c2", name: "皇帝", role: "配角" },
  ],
  scenes: [
    { id: "s1", name: "盛唐金銮殿", environmentTimeMood: "白天" },
  ],
  props: [{ id: "p1", name: "办公电脑显示器", description: "键盘" }],
  shots: [
    {
      index: 1,
      sceneDescription: "现代沈昭昭在键盘前敲击，背景是金銮殿。",
      characterIds: ["c1"],
      sceneId: "s1",
      propIds: ["p1"],
      durationSec: 5,
    },
  ],
};

describe("resolveShotLinkedEntities", () => {
  it("merges ids and inline name matches", () => {
    const shot = script.shots![0];
    const linked = resolveShotLinkedEntities(shot, script);
    expect(linked.map((e) => e.name).sort()).toEqual(
      ["现代沈昭昭", "盛唐金銮殿", "办公电脑显示器"].sort(),
    );
  });

  it("dedupes by asset key", () => {
    const shot = {
      ...script.shots![0],
      sceneDescription: "现代沈昭昭在现代沈昭昭的键盘前",
    };
    const linked = resolveShotLinkedEntities(shot, script);
    const charHits = linked.filter((e) => e.name === "现代沈昭昭");
    expect(charHits).toHaveLength(1);
  });
});

describe("splitTextByLinkedEntities", () => {
  it("highlights longest names first without overlap bugs", () => {
    const matchers = buildEntityHighlightMatchers(script);
    const segments = splitTextByEntityMatchers(
      script.shots![0].sceneDescription,
      matchers,
    );
    const entityValues = segments
      .filter((s) => s.type === "entity")
      .map((s) => s.value);
    expect(entityValues).toContain("现代沈昭昭");
    expect(entityValues).toContain("金銮殿");
    expect(entityValues).toContain("键盘");
  });

  it("returns plain text when no entities", () => {
    expect(splitTextByLinkedEntities("纯文本", [])).toEqual([
      { type: "text", value: "纯文本" },
    ]);
  });

  it("propIdsFromDisplayNames maps prop labels to ids", () => {
    const ids = propIdsFromDisplayNames(script, "办公电脑显示器");
    expect(ids).toEqual(["p1"]);
  });
});

describe("entity highlight matchers", () => {
  it("longestEntityAliasInText resolves scene suffix", () => {
    expect(
      longestEntityAliasInText("盛唐金銮殿", "背景是金銮殿。"),
    ).toBe("金銮殿");
  });

  it("buildEntityHighlightMatchers includes scene and prop terms", () => {
    const matchers = buildEntityHighlightMatchers(script);
    const terms = matchers.map((m) => m.term);
    expect(terms).toContain("现代沈昭昭");
    expect(terms).toContain("金銮殿");
    expect(terms).toContain("键盘");
  });

  it("splitTextByEntityMatchers highlights scene and prop in description", () => {
    const matchers = buildEntityHighlightMatchersForShot(
      script.shots![0],
      script,
    );
    const segments = splitTextByEntityMatchers(
      script.shots![0].sceneDescription,
      matchers,
    );
    const entityTerms = segments
      .filter((s) => s.type === "entity")
      .map((s) => s.value);
    expect(entityTerms).toContain("现代沈昭昭");
    expect(entityTerms).toContain("金銮殿");
  });

  it("per-shot matchers exclude unlinked props from other shots", () => {
    const multiShotScript: Pro2ProductionScript = {
      ...script,
      props: [
        ...(script.props ?? []),
        { id: "p2", name: "智能手机", description: "手机" },
      ],
      shots: [
        script.shots![0],
        {
          index: 2,
          sceneDescription: "空镜",
          sceneId: "s1",
          durationSec: 8,
        },
      ],
    };
    const matchers = buildEntityHighlightMatchersForShot(
      multiShotScript.shots![1],
      multiShotScript,
    );
    const terms = matchers.map((m) => m.term);
    expect(terms).not.toContain("智能手机");
    expect(terms).toContain("盛唐金銮殿");
  });
});

describe("appendWizardAsset", () => {
  it("appends character with required fields", () => {
    const next = appendWizardAsset(script, "character", "新角色");
    expect(next.characters).toHaveLength(3);
    const added = next.characters!.find((c) => c.name === "新角色");
    expect(added?.role).toBe("待补充");
    expect(added?.imagePrompt).toContain("新角色");
  });

  it("appends scene and prop", () => {
    const withScene = appendWizardAsset(script, "scene", "新场景");
    expect(withScene.scenes).toHaveLength(2);
    const withProp = appendWizardAsset(withScene, "prop", "新道具");
    expect(withProp.props).toHaveLength(2);
  });
});
