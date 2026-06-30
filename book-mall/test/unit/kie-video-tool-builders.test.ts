import { describe, expect, it } from "vitest";

import {
  buildKieHappyHorseR2vCreateArgs,
  buildKieKlingMotionControlCreateArgs,
  buildKieToolVideoCreateArgs,
} from "@/lib/canvas/kie-video-tool-builders";

const IMAGE = "https://example.com/char.jpg";
const VIDEO = "https://example.com/motion.mp4";

describe("buildKieKlingMotionControlCreateArgs", () => {
  it("maps std/pro UI values to KIE 720p/1080p", () => {
    const std = buildKieKlingMotionControlCreateArgs({
      model: "kling-2.6/motion-control",
      imageUrls: [IMAGE],
      videoUrls: [VIDEO],
      mode: "std",
      characterOrientation: "video",
    });
    expect(std.input.mode).toBe("720p");

    const pro = buildKieKlingMotionControlCreateArgs({
      model: "kling-3.0/motion-control",
      imageUrls: [IMAGE],
      videoUrls: [VIDEO],
      mode: "pro",
      characterOrientation: "image",
    });
    expect(pro.input.mode).toBe("1080p");
    expect(pro.input.character_orientation).toBe("image");
  });

  it("defaults mode to 720p and orientation to video", () => {
    const body = buildKieKlingMotionControlCreateArgs({
      model: "kling-2.6/motion-control",
      imageUrls: [IMAGE],
      videoUrls: [VIDEO],
    });
    expect(body.input.mode).toBe("720p");
    expect(body.input.character_orientation).toBe("video");
  });
});

describe("buildKieHappyHorseR2vCreateArgs", () => {
  it("builds reference-to-video payload", () => {
    const body = buildKieHappyHorseR2vCreateArgs({
      prompt: "[Image 1] dances",
      referenceImages: [IMAGE, "https://example.com/ref2.jpg"],
      resolution: "720p",
      aspectRatio: "9:16",
      duration: 8,
    });
    expect(body.model).toBe("happyhorse-1-1/reference-to-video");
    expect(body.input.reference_image).toEqual([
      IMAGE,
      "https://example.com/ref2.jpg",
    ]);
    expect(body.input.prompt).toBe("[Image 1] dances");
    expect(body.input.resolution).toBe("720p");
    expect(body.input.aspect_ratio).toBe("9:16");
    expect(body.input.duration).toBe(8);
  });

  it("passes prompt unchanged when same image is referenced multiple times", () => {
    const prompt =
      "[Image 1] and [Image 2] fight fiercely while [Image 1] keeps pace";
    const body = buildKieHappyHorseR2vCreateArgs({
      prompt,
      referenceImages: [IMAGE, "https://example.com/ref2.jpg"],
      duration: 5,
    });
    expect(body.input.prompt).toBe(prompt);
    expect(body.input.reference_image).toEqual([
      IMAGE,
      "https://example.com/ref2.jpg",
    ]);
  });

  it("is wired through buildKieToolVideoCreateArgs", () => {
    const body = buildKieToolVideoCreateArgs({
      model: "happyhorse-1-1/reference-to-video",
      prompt: "test",
      imageUrls: [IMAGE],
      duration: 15,
    });
    expect(body.model).toBe("happyhorse-1-1/reference-to-video");
    expect(body.input.duration).toBe(15);
  });
});
