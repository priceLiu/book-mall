import { describe, expect, it } from "vitest";

import {
  buildWorkflowTabEntries,
  countWorkflowTabEntries,
} from "@/lib/ecom-library-workflow-entries";
import type { EcomLibrarySection } from "@/lib/ecom-library-api";

function emptySection(overrides: Partial<EcomLibrarySection>): EcomLibrarySection {
  return {
    moduleId: "storyboard-micro-drama",
    title: "微剧故事版",
    kind: "video",
    domainLabel: "视频",
    assets: [],
    assetGroups: [],
    storyboardBundles: [],
    productDesignBundles: [],
    seedVideoBundles: [],
    handCraftBundles: [],
    mediaDecomposeBundles: [],
    ...overrides,
  };
}

describe("buildWorkflowTabEntries", () => {
  it("includes saved storyboard bundles", () => {
    const section = emptySection({
      storyboardBundles: [
        {
          projectId: "p1",
          savedAt: "2026-08-30T07:00:00.000Z",
          title: "测试项目_20260830-150000",
          panelCount: 6,
          hasScript: true,
          hasVideo: false,
          thumbnailUrl: null,
          snapshot: { savedAt: "2026-08-30T07:00:00.000Z", title: "测试", sheet: { overview: {}, cast: [], panels: [] }, references: [], panelVideos: [] },
        },
      ],
    });
    const entries = buildWorkflowTabEntries(section);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("storyboard");
  });

  it("adds draft storyboard project when assets exist without saved bundle", () => {
    const section = emptySection({
      assetGroups: [
        {
          projectId: "p2",
          projectName: "女装风衣项目",
          assets: [
            {
              id: "a1",
              module: "storyboard-micro-drama",
              kind: "video",
              title: "镜1",
              prompt: null,
              ossUrl: "https://example.com/v.mp4",
              thumbnailUrl: null,
              createdAt: "2026-08-30T08:00:00.000Z",
              projectId: "p2",
              projectName: "女装风衣项目",
            },
          ],
        },
      ],
    });
    const entries = buildWorkflowTabEntries(section);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "storyboard-draft",
      projectId: "p2",
      projectName: "女装风衣项目",
    });
  });

  it("does not duplicate draft when bundle already covers project", () => {
    const section = emptySection({
      storyboardBundles: [
        {
          projectId: "p1",
          savedAt: "2026-08-30T07:00:00.000Z",
          title: "已保存",
          panelCount: 1,
          hasScript: true,
          hasVideo: false,
          thumbnailUrl: null,
          snapshot: { savedAt: "2026-08-30T07:00:00.000Z", title: "已保存", sheet: { overview: {}, cast: [], panels: [] }, references: [], panelVideos: [] },
        },
      ],
      assetGroups: [
        {
          projectId: "p1",
          projectName: "已保存",
          assets: [
            {
              id: "a1",
              module: "storyboard-micro-drama",
              kind: "image",
              title: "镜1",
              prompt: null,
              ossUrl: "https://example.com/i.png",
              thumbnailUrl: null,
              createdAt: "2026-08-30T08:00:00.000Z",
            },
          ],
        },
      ],
    });
    expect(buildWorkflowTabEntries(section)).toHaveLength(1);
  });
});

describe("countWorkflowTabEntries", () => {
  it("sums entries across sections", () => {
    const sections = [
      emptySection({
        storyboardBundles: [
          {
            projectId: "p1",
            savedAt: "2026-08-30T07:00:00.000Z",
            title: "A",
            panelCount: 1,
            hasScript: false,
            hasVideo: false,
            thumbnailUrl: null,
            snapshot: { savedAt: "2026-08-30T07:00:00.000Z", title: "A", sheet: { overview: {}, cast: [], panels: [] }, references: [], panelVideos: [] },
          },
        ],
      }),
    ];
    expect(countWorkflowTabEntries(sections)).toBe(1);
  });
});
