import { describe, expect, it } from "vitest";

import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  hydrateCanvasFramePromptMentions,
  prepareWizardShotEditorState,
} from "@/lib/canvas/pro2-frame-shot-ref-prep";

const script: Pro2ProductionScript = {
  schemaVersion: 3,
  meta: { packProfile: "industrial" },
  visualStyle: "测试",
  coreConflict: "测试",
  characters: [{ id: "c1", name: "沈昭昭", role: "女主" }],
  scenes: [{ id: "s1", name: "深夜办公室" }],
  props: [{ id: "p1", name: "手机", description: "通知屏" }],
  shots: [
    {
      index: 2,
      sceneId: "s1",
      characterIds: ["c1"],
      propIds: ["p1"],
      shotSize: "中近景",
      sceneDescription: "沈昭昭抬头看手机",
      dialogue: "沈昭昭（内心OS）：\"好累…\"",
      frameImagePrompt:
        "中近景。深夜办公室，低饱和冷蓝光。沈昭昭抬头，视线模糊，手机亮起。",
      videoPrompt: "镜头缓慢推近沈昭昭",
      durationSec: 12,
    },
  ],
  handoff: {},
};

describe("prepareWizardShotEditorState", () => {
  it("hydrates plain names to @ tokens and builds refImages from drafts", () => {
    const shot = script.shots![0]!;
    const prompt = shot.frameImagePrompt!;
    const { prompt: hydrated, refImages } = prepareWizardShotEditorState({
      prompt,
      mediaKind: "frame",
      script,
      shot,
      assetDrafts: {
        "character:c1": {
          kind: "character",
          assetId: "c1",
          previewUrl: "https://cdn.example/char.png",
        },
        "scene:s1": {
          kind: "scene",
          assetId: "s1",
          previewUrl: "https://cdn.example/scene.png",
        },
      },
    });

    expect(hydrated).toContain("@<wiz-char-c1>");
    expect(hydrated).toContain("@<wiz-scene-s1>");
    expect(refImages.some((r) => r.id === "wiz-char-c1" && r.url)).toBe(true);
    expect(refImages.some((r) => r.id === "wiz-scene-s1" && r.url)).toBe(true);
  });

  it("video without Pass2 videoPrompt falls back to Pass1 and linked @ refs", () => {
    const shot = {
      index: 1,
      sceneId: "s1",
      characterIds: ["c1"],
      shotSize: "中近景",
      cameraMove: "缓慢推近",
      sceneDescription: "沈昭昭抬头",
      dialogue: "—",
      durationSec: 12,
    };
    const videoScript: Pro2ProductionScript = {
      ...script,
      shots: [shot],
    };
    const { prompt: hydrated, refImages } = prepareWizardShotEditorState({
      prompt: "",
      mediaKind: "video",
      script: videoScript,
      shot,
      assetDrafts: {
        "character:c1": {
          kind: "character",
          assetId: "c1",
          previewUrl: "https://cdn.example/char.png",
        },
      },
    });

    expect(hydrated).toContain("@<wiz-char-c1>");
    expect(hydrated).toContain("运镜：缓慢推近");
    expect(refImages.some((r) => r.id === "wiz-char-c1")).toBe(true);
  });
});

describe("hydrateCanvasFramePromptMentions", () => {
  it("wraps character name in ref-char token", () => {
    const out = hydrateCanvasFramePromptMentions(
      "沈昭昭抬头看手机",
      [{ id: "ref-char-k1", name: "沈昭昭" }],
    );
    expect(out).toContain("@<ref-char-k1>");
    expect(out).not.toContain("沈昭昭抬头");
  });
});
