import { describe, expect, it } from "vitest";
import { findCrewBulletinHub } from "@/lib/canvas/crew-bulletin-hub-find";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";

function scriptHub(
  id: string,
  data: Partial<StoryProScriptHubNodeData>,
): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-script-hub",
    position: { x: 0, y: 0 },
    data: data as StoryProScriptHubNodeData,
  };
}

describe("findCrewBulletinHub", () => {
  it("prefers script-studio hub over other published hubs", () => {
    const nodes = [
      scriptHub("prod-hub", { scriptPublished: true, outlineMd: "# a" }),
      scriptHub("studio-hub", {
        scriptStudioMode: true,
        outlineMd: "# studio",
      }),
    ];
    expect(findCrewBulletinHub(nodes)?.id).toBe("studio-hub");
  });

  it("finds published script hub without scriptStudioMode", () => {
    const nodes = [
      scriptHub("prod-hub", {
        scriptPublished: true,
        outlineMd: "# published",
        crewBulletin: {
          scriptTitle: "测试",
          totalEpisodes: 1,
          tasks: [{ id: "t1", kind: "script", rowKey: "script", label: "剧本", status: "unclaimed" }],
        },
      }),
    ];
    expect(findCrewBulletinHub(nodes)?.id).toBe("prod-hub");
  });

  it("ignores unpublished non-studio hubs", () => {
    const nodes = [
      scriptHub("draft-hub", { outlineMd: "# draft", scriptPublished: false }),
    ];
    expect(findCrewBulletinHub(nodes)).toBeUndefined();
  });
});

describe("findCrewBulletinHub · published production hub", () => {
  it("shows bulletin rail after publish on same canvas", () => {
    const nodes = [
      scriptHub("hub-1", {
        scriptPublished: true,
        outlineMd: "# 大纲",
        crewBulletin: {
          scriptTitle: "剧",
          totalEpisodes: 10,
          tasks: [
            { id: "s1", kind: "script", rowKey: "script", label: "剧本已定", status: "unclaimed" },
          ],
        },
      }),
    ];
    expect(findCrewBulletinHub(nodes)?.id).toBe("hub-1");
  });
});
