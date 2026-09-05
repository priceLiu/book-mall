import { describe, expect, it } from "vitest";
import {
  listPro2SemanticPatchIssues,
  listPro2ShotEntityLinkIssues,
} from "@/lib/canvas/data/pro2-production-script-schema";
import { coercePro2ProductionScriptEnvelopeForParse } from "@/lib/canvas/pro2-production-script-structured";

describe("pro2-production-script-parse-enrich", () => {
  it("infers characterIds from dialogue before validation", () => {
    const raw = {
      schemaVersion: 3,
      tier: "pro",
      step: "full_pack",
      patch: {
        meta: { title: "t", packProfile: "director", source: "creative" },
        visualStyle: {
          worldBackground: "近未来",
          era: "2026",
          styleAnchor: "赛博冷蓝",
        },
        coreConflict: [{ dimension: "冲突", content: "x" }],
        scenes: [
          {
            id: "s1",
            name: "未来废墟数据风暴中心",
            environmentTimeMood: "黄昏",
            imagePrompt: "数据风暴，冷蓝粒子",
          },
        ],
        characters: [
          {
            id: "char-a",
            name: "林深",
            role: "主角",
            description: "男，30岁，短发，黑瞳",
            clothing: "黑色战术外套",
            traits: "①刀疤左眉 ②肩宽 ③指节厚茧",
            appearance:
              "① 外貌：男，30岁\n② 服装：黑色战术外套\n③ 特征：①刀疤左眉 ②肩宽 ③指节厚茧",
            imagePrompt: "名称：林深，主角",
          },
        ],
        props: [
          {
            id: "p1",
            name: "碎裂全息屏幕",
            description: "悬浮碎片",
            imagePrompt: "碎裂的全息屏",
          },
        ],
        shots: [
          {
            index: 10,
            shotSize: "中景",
            lighting: "未来废墟数据风暴中心，黄昏冷蓝",
            cameraMove: "固定机位缓慢推近主体面部细节",
            sceneDescription: "【起始】林深站立。【结束】抬手",
            dialogue: '林深（冷静）："数据不会说谎。"',
            durationSec: 12,
            sfxNote: "—",
            audioNote: "—",
            sceneId: "s1",
          },
        ],
        handoff: [{ index: 1, item: "三视图", owner: "美术", note: "—" }],
      },
    };

    const coerced = coercePro2ProductionScriptEnvelopeForParse(raw) as typeof raw;
    const shot = (coerced.patch.shots as Record<string, unknown>[])[0]!;
    expect(shot.characterIds).toEqual(["char-a"]);

    const scenePrompt = String(
      (coerced.patch.scenes as Record<string, unknown>[])[0]!.imagePrompt,
    );
    expect(scenePrompt).toContain("构图规范");
    expect(scenePrompt).toMatch(/\[视觉风格：/);

    const propPrompt = String(
      (coerced.patch.props as Record<string, unknown>[])[0]!.imagePrompt,
    );
    expect(propPrompt).toContain("构图规范");
    expect(propPrompt).toMatch(/\[视觉风格：/);

    const charPrompt = String(
      (coerced.patch.characters as Record<string, unknown>[])[0]!.imagePrompt,
    );
    expect(charPrompt).toContain("构图规范");
    expect(charPrompt).toMatch(/\[视觉风格：/);

    const patch = coerced.patch as Parameters<typeof listPro2SemanticPatchIssues>[0];
    expect(
      listPro2ShotEntityLinkIssues(patch).some((i) =>
        i.includes("缺少 characterIds"),
      ),
    ).toBe(false);
    expect(
      listPro2SemanticPatchIssues(patch, "full_pack").some((i) =>
        i.includes("imagePrompt 须含"),
      ),
    ).toBe(false);
  });
});
