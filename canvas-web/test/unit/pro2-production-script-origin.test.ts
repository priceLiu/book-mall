import { describe, expect, it } from "vitest";

import { buildProductionScriptOriginPatch } from "@/lib/canvas/pro2-production-script-origin";
import { buildPro2HubMediaIncrementalPatch } from "@/lib/canvas/pro2-hub-media-persist";
import { PRO2_FIXTURE_FULL_PACK } from "../fixtures/pro2-production-script-fixture";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";

describe("pro2 production script origin", () => {
  it("captures LLM raw output as productionScriptOrigin on first apply", () => {
    const hub = {
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
    } as StoryProScriptHubNodeData;
    const raw = "human pack\n```pro2-production-script\n{}\n```";
    const applied = {
      outlineMd: "## 视觉风格",
      productionScript: PRO2_FIXTURE_FULL_PACK.patch,
      storyboardMd: "## 分镜脚本\n\n| 镜号 | 景别 |",
    };
    const patch = buildProductionScriptOriginPatch(
      hub,
      "outline",
      { status: "done", taskId: "t1" },
      raw,
      applied,
    );
    expect(patch.productionScriptOrigin?.rawTextOutput).toBe(raw);
    expect(patch.productionScriptOrigin?.taskId).toBe("t1");
    expect(patch.productionScriptOrigin?.productionScript?.shots?.length).toBe(12);
    expect(patch.productionScriptOriginHistory).toBeUndefined();
  });

  it("archives previous origin when taskId changes", () => {
    const hub = {
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      productionScriptOrigin: {
        savedAt: "2026-01-01T00:00:00.000Z",
        taskId: "old",
        section: "outline" as const,
        rawTextOutput: "old raw",
      },
    } as StoryProScriptHubNodeData;
    const patch = buildProductionScriptOriginPatch(
      hub,
      "outline",
      { status: "done", taskId: "new" },
      "new raw",
      {
        outlineMd: "## 新",
        productionScript: PRO2_FIXTURE_FULL_PACK.patch,
      },
    );
    expect(patch.productionScriptOrigin?.taskId).toBe("new");
    expect(patch.productionScriptOriginHistory?.[0]?.taskId).toBe("old");
  });
});

describe("pro2 hub media incremental persist", () => {
  it("writes frame runtime back to hub scriptStudioFrameRows", () => {
    const hub = {
      scriptStudioFrameRows: [
        {
          key: "f1",
          frameIndex: 1,
          scene: "s",
          description: "d",
          dialogue: "—",
          videoPrompt: "",
          prompt: "",
        },
      ],
    } as StoryProScriptHubNodeData;
    const frameRows = [
      {
        ...hub.scriptStudioFrameRows![0]!,
        runtime: {
          status: "done" as const,
          ossUrl: "https://example.com/frame.png",
        },
      },
    ];
    const patch = buildPro2HubMediaIncrementalPatch(hub, frameRows);
    expect(patch?.scriptStudioFrameRows?.[0]?.runtime?.ossUrl).toContain(
      "frame.png",
    );
    expect(patch?.productionScriptMediaRevisionAt).toBeTruthy();
  });
});
