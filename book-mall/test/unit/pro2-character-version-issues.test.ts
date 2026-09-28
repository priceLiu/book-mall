import { describe, expect, it } from "vitest";
import { listPro2CharacterVersionIssues } from "@/lib/canvas/data/pro2-production-script-schema";

type Patch = Parameters<typeof listPro2CharacterVersionIssues>[0];

const characters = [
  { id: "char-modern", name: "沈昭昭（现代）" },
  { id: "char-tang", name: "沈昭昭（盛唐）" },
];

function patch(shots: Record<string, unknown>[], chars = characters): Patch {
  return { characters: chars, shots } as unknown as Patch;
}

describe("listPro2CharacterVersionIssues", () => {
  it("passes when every mention names the version and characterIds lists it", () => {
    expect(
      listPro2CharacterVersionIssues(
        patch([
          {
            index: 1,
            sceneDescription: "沈昭昭（现代）穿着衬衫跌进盛唐金銮殿",
            dialogue: "沈昭昭（现代）（惊慌）：\"这是哪？\"",
            characterIds: ["char-modern"],
          },
        ]),
      ),
    ).toEqual([]);
  });

  it("flags a bare name without version", () => {
    const issues = listPro2CharacterVersionIssues(
      patch([
        {
          index: 2,
          sceneDescription: "沈昭昭抬头，视线模糊",
          characterIds: ["char-modern"],
        },
      ]),
    );
    expect(issues.some((i) => i.includes("镜 2") && i.includes("未写明版本"))).toBe(
      true,
    );
  });

  it("flags a version on screen but missing from characterIds", () => {
    const issues = listPro2CharacterVersionIssues(
      patch([
        {
          index: 3,
          sceneDescription: "沈昭昭（现代）梦见沈昭昭（盛唐）",
          characterIds: ["char-modern"],
        },
      ]),
    );
    expect(issues).toEqual([
      "镜 3 画面出现「沈昭昭（盛唐）」但 characterIds 未包含 char-tang",
    ]);
  });

  it("flags versions that are not distinctly named", () => {
    const issues = listPro2CharacterVersionIssues(
      patch([], [
        { id: "a", name: "沈昭昭" },
        { id: "b", name: "沈昭昭（盛唐）" },
      ]),
    );
    expect(issues[0]).toContain("name 须写成「沈昭昭（版本）」");
  });

  it("ignores scripts without multi-version characters", () => {
    expect(
      listPro2CharacterVersionIssues(
        patch(
          [{ index: 1, sceneDescription: "萧景珩回头", characterIds: [] }],
          [{ id: "p", name: "萧景珩" }],
        ),
      ),
    ).toEqual([]);
  });
});
