import { describe, expect, it } from "vitest";

import { extractLogInputImages } from "../../../gateway-web/lib/gateway-log-params";

describe("extractLogInputImages · 分镜图", () => {
  it("shows 分镜图 for HappyHorse R2V media first_frame", () => {
    const frame =
      "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/p/frame.png";
    const images = extractLogInputImages({
      model: "happyhorse-1.1-r2v",
      input: {
        media: [
          { type: "first_frame", url: frame },
          { type: "reference_image", url: "https://cdn.example/char.png" },
        ],
        referenceImageUrls: [frame, "https://cdn.example/char.png"],
      },
    });
    expect(images[0]?.label).toBe("分镜图");
    expect(images[0]?.url).toBe(frame);
    expect(images[1]?.label).toBe("参考图 1");
  });

  it("infers 分镜图 when legacy media marks canvas frame as reference_image", () => {
    const frame =
      "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/cmtkvleuj009oif35iwvb79l6/73735338-b6a6-43da-b6ec-b15f965d49a1.png";
    const images = extractLogInputImages({
      model: "happyhorse-1.1-r2v",
      input: {
        media: [
          { type: "reference_image", url: frame },
          {
            type: "reference_image",
            url: "https://tempfile.aiquickdraw.com/workers/images/char.png",
          },
        ],
        referenceImageUrls: [
          frame,
          "https://tempfile.aiquickdraw.com/workers/images/char.png",
        ],
      },
    });
    expect(images[0]?.label).toBe("分镜图");
    expect(images[0]?.url).toBe(frame);
    expect(images).toHaveLength(2);
  });
});
