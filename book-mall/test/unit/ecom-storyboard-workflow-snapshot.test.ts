import { describe, expect, it } from "vitest";

import { mergeStoryboardDeliverableSnapshotMedia } from "@/lib/ecom/ecom-storyboard-snapshot";
import { buildStoryboardDeliverablePreviewFromWorkflow } from "@/lib/ecom/ecom-storyboard-workflow-snapshot";
import type { StoryboardWorkflowSnapshot } from "@/lib/ecom/ecom-storyboard-workflow-snapshot";

describe("buildStoryboardDeliverablePreviewFromWorkflow", () => {
  it("preserves workflow snapshot title when sheet exists", () => {
    const snap: StoryboardWorkflowSnapshot = {
      savedAt: "2026-08-30T07:23:15.638Z",
      title: "女士潮流街头高端轻奢手提包_20260830-152315",
      projectName: "女士潮流街头高端轻奢手提包",
      brief: null,
      settings: null,
      references: [],
      chatHistory: [],
      sheet: {
        overview: {
          title: "A版·经典叙事",
          logline: "通勤救场",
          productHighlight: "轻奢手提",
        },
        cast: [],
        panels: [
          {
            index: 1,
            shotType: "中景",
            scene: "街角",
            action: "转身",
            dialogue: "台词",
            emotion: "自然",
            camera: "固定",
            timeline: "0-4s",
          },
        ],
      },
      meta: {},
    };

    const preview = buildStoryboardDeliverablePreviewFromWorkflow(snap);
    expect(preview.title).toBe("女士潮流街头高端轻奢手提包_20260830-152315");
    expect(preview.savedAt).toBe("2026-08-30T07:23:15.638Z");
  });

  it("merges panel imageUrl from embedded deliverableSnapshot in workflow meta", () => {
    const snap: StoryboardWorkflowSnapshot = {
      savedAt: "2026-08-30T07:23:15.638Z",
      title: "手提包_20260830-152315",
      brief: null,
      settings: null,
      references: [],
      chatHistory: [],
      sheet: {
        overview: { title: "A版", logline: "—", productHighlight: "包" },
        cast: [],
        panels: [{ index: 1, shotType: "中景", scene: "街角", action: "走", dialogue: "", emotion: "", camera: "", timeline: "0-4s" }],
      },
      meta: {
        deliverableSnapshot: {
          savedAt: "2026-08-30T08:00:00.000Z",
          title: "A版",
          sheet: {
            overview: { title: "A版", logline: "—" },
            cast: [],
            panels: [
              {
                index: 1,
                shotType: "中景",
                scene: "街角",
                action: "走",
                dialogue: "",
                emotion: "",
                camera: "",
                timeline: "0-4s",
                imageUrl: "https://bucket.oss-cn-shanghai.aliyuncs.com/panel-1.png",
                videoUrl: "https://bucket.oss-cn-shanghai.aliyuncs.com/panel-1.mp4",
              },
            ],
          },
          references: [],
          panelVideos: [{ index: 1, videoUrl: "https://bucket.oss-cn-shanghai.aliyuncs.com/panel-1.mp4" }],
          videoUrl: "https://bucket.oss-cn-shanghai.aliyuncs.com/final.mp4",
        },
      },
    };

    const preview = buildStoryboardDeliverablePreviewFromWorkflow(snap);
    expect(preview.sheet.panels[0]?.imageUrl).toContain("panel-1.png");
    expect(preview.panelVideos).toHaveLength(1);
    expect(preview.videoUrl).toContain("final.mp4");
  });
});

describe("mergeStoryboardDeliverableSnapshotMedia", () => {
  it("fills missing panel media from a later deliverable snapshot", () => {
    const base = {
      savedAt: "2026-08-30T07:00:00.000Z",
      title: "工作流",
      sheet: {
        overview: { title: "A", logline: "—" },
        cast: [],
        panels: [{ index: 1, shotType: "中景", scene: "a", action: "b", dialogue: "", emotion: "", camera: "", timeline: "0-4s" }],
      },
      references: [],
      panelVideos: [],
    };
    const merged = mergeStoryboardDeliverableSnapshotMedia(base, [
      {
        savedAt: "2026-08-30T08:00:00.000Z",
        title: "交付",
        sheet: {
          overview: { title: "A", logline: "—" },
          cast: [],
          panels: [
            {
              index: 1,
              shotType: "中景",
              scene: "a",
              action: "b",
              dialogue: "",
              emotion: "",
              camera: "",
              timeline: "0-4s",
              imageUrl: "https://example.com/p1.png",
            },
          ],
        },
        references: [],
        panelVideos: [],
      },
    ]);
    expect(merged.sheet.panels[0]?.imageUrl).toBe("https://example.com/p1.png");
  });
});
