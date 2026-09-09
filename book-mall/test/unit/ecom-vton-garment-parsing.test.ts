import { describe, expect, it } from "vitest";

import { pickFullSetGarmentPiecesFromOutput } from "@/lib/ecom/ecom-vton/garment-parsing";
import { resolveLookTryonUrls } from "@/lib/ecom/ecom-vton/validate";

describe("ecom-vton garment parsing", () => {
  it("pickFullSetGarmentPiecesFromOutput sorts by bbox vertical position", () => {
    const picked = pickFullSetGarmentPiecesFromOutput({
      crop_img_url: ["https://x/lower.jpg", "https://x/upper.jpg"],
      bbox: [
        [0, 600, 100, 900],
        [0, 50, 100, 350],
      ],
    });
    expect(picked.topGarmentUrl).toBe("https://x/upper.jpg");
    expect(picked.bottomGarmentUrl).toBe("https://x/lower.jpg");
  });

  it("resolveLookTryonUrls uses pre-parsed full_set as two_piece", () => {
    expect(
      resolveLookTryonUrls({
        look: { id: "l1", kind: "full_set", fullSetGarmentId: "s1" },
        garmentPool: [
          {
            id: "s1",
            kind: "full_set",
            ossUrl: "https://x/set.jpg",
            parsedTopUrl: "https://x/set-top.jpg",
            parsedBottomUrl: "https://x/set-bottom.jpg",
          },
        ],
        modelUrl: "https://x/model.jpg",
      }),
    ).toMatchObject({
      lookKind: "two_piece",
      topGarmentUrl: "https://x/set-top.jpg",
      bottomGarmentUrl: "https://x/set-bottom.jpg",
    });
  });
});
