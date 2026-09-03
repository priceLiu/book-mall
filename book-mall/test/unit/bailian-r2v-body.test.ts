import { describe, expect, it } from "vitest";
import {
  buildBailianR2vMediaItems,
  buildBailianR2vRequestBody,
  enrichBailianR2vInputForLog,
} from "@/lib/canvas/bailian-r2v-body";

describe("buildBailianR2vMediaItems", () => {
  it("uses first_frame for single HappyHorse ref (分镜静帧)", () => {
    const media = buildBailianR2vMediaItems("happyhorse-1.1-r2v", [
      "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/frame.png",
    ]);
    expect(media).toEqual([
      {
        type: "first_frame",
        url: "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/frame.png",
      },
    ]);
  });

  it("uses first_frame + reference_image for frame + @ 资产", () => {
    const frame =
      "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/frame.png";
    const char =
      "https://tempfile.aiquickdraw.com/workers/images/char.png";
    const media = buildBailianR2vMediaItems("happyhorse-1.1-r2v", [
      frame,
      char,
    ]);
    expect(media).toEqual([
      { type: "first_frame", url: frame },
      { type: "reference_image", url: char },
    ]);
  });
});

describe("buildBailianR2vRequestBody", () => {
  it("maps wizard shot 7 style refs to first_frame + reference_image", () => {
    const frame =
      "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/cmtkvleuj009oif35iwvb79l6/73735338-b6a6-43da-b6ec-b15f965d49a1.png";
    const refs = [
      frame,
      "https://tempfile.aiquickdraw.com/workers/images/image_4736ab46daa4779b08e29814b083738a.png",
    ];
    const body = buildBailianR2vRequestBody({
      model: "happyhorse-1.1-r2v",
      prompt: "镜 7 特写",
      referenceImageUrls: refs,
      resolution: "720P",
      ratio: "16:9",
      duration: 8,
    });
    expect(body.input.media).toEqual([
      { type: "first_frame", url: frame },
      {
        type: "reference_image",
        url: refs[1],
      },
    ]);
  });
});

describe("enrichBailianR2vInputForLog", () => {
  it("adds mainFrameImageUrl for gateway log UI", () => {
    const frame =
      "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/proj/frame.png";
    const built = buildBailianR2vRequestBody({
      model: "happyhorse-1.1-r2v",
      prompt: "镜 7",
      referenceImageUrls: [frame, "https://cdn.example/char.png"],
      resolution: "720P",
      ratio: "16:9",
      duration: 8,
    });
    const logInput = enrichBailianR2vInputForLog(built, [
      frame,
      "https://cdn.example/char.png",
    ]);
    expect(logInput.mainFrameImageUrl).toBe(frame);
    expect(logInput.media).toBeDefined();
  });
});
