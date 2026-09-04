import { describe, expect, it } from "vitest";

import { buildWorkflowEnvelope } from "@/lib/ecom/video-workflow/envelope";
import { parseEcomVideoWorkflow } from "@/lib/ecom/video-workflow/parse-dispatch";
import { sanitizeOutfitSceneList } from "@/lib/ecom/video-workflow/templates/outfit-v1/parser";
import { OUTFIT_V1_TEMPLATE_ID } from "@/lib/ecom/video-workflow/templates/outfit-v1/constants";

describe("ecom video workflow outfit-v1", () => {
  it("parses scene_split_complete envelope", () => {
    const envelope = buildWorkflowEnvelope({
      templateId: OUTFIT_V1_TEMPLATE_ID,
      action: "scene_split_complete",
      taskStatus: "success",
      taskId: "scene_split_test",
      payload: {
        mediaInput: { referenceVideoUrl: "https://example.com/ref.mp4", aspectRatio: "9:16" },
        totalSceneNum: 2,
        sceneList: [
          {
            sceneId: "s1",
            index: 1,
            startTimeSec: 0,
            endTimeSec: 3,
            durationSec: 3,
            cameraType: "front_static",
            motionType: "stand_pose",
            previewImageUrl: "https://example.com/p1.jpg",
            status: "pending",
          },
          {
            sceneId: "s2",
            index: 2,
            startTimeSec: 3,
            endTimeSec: 6,
            durationSec: 3,
            cameraType: "slow_pan",
            motionType: "turn_body",
            previewImageUrl: "https://example.com/p2.jpg",
            status: "pending",
          },
        ],
      },
    });

    const result = parseEcomVideoWorkflow(envelope);
    expect(result).not.toBeNull();
    expect(result?.parsed.sceneList).toHaveLength(2);
    expect(result?.parsed.sceneList?.[0]?.sceneId).toBe("s1");
  });

  it("parses compose_complete envelope", () => {
    const envelope = buildWorkflowEnvelope({
      templateId: OUTFIT_V1_TEMPLATE_ID,
      action: "compose_complete",
      taskStatus: "success",
      taskId: "compose_test",
      payload: {
        composeResult: {
          videoUrl: "https://example.com/final.mp4",
          videoInfo: {
            durationSec: 12,
            resolution: "1080*1920",
            fps: 30,
            aspectRatio: "9:16",
          },
        },
      },
    });

    const result = parseEcomVideoWorkflow(envelope);
    expect(result).not.toBeNull();
    expect(result?.envelope.action).toBe("compose_complete");
  });

  it("normalizes scene indices", () => {
    const scenes = sanitizeOutfitSceneList([
      {
        sceneId: "s2",
        index: 5,
        startTimeSec: 3,
        endTimeSec: 6,
        durationSec: 3,
      },
      {
        sceneId: "s1",
        index: 2,
        startTimeSec: 0,
        endTimeSec: 3,
        durationSec: 3,
      },
    ]);
    expect(scenes[0]?.sceneId).toBe("s1");
    expect(scenes[0]?.index).toBe(1);
    expect(scenes[1]?.index).toBe(2);
  });
});
