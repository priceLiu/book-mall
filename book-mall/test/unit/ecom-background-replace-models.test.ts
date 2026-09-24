import { describe, expect, it } from "vitest";

import { mergeBackgroundReplaceModels } from "@/lib/ecom/ecom-background-replace-models";

describe("mergeBackgroundReplaceModels", () => {
  it("always includes Seedream Pro even when the shelf is empty", () => {
    const models = mergeBackgroundReplaceModels({
      gatewayModels: [],
      boundKinds: ["VOLCENGINE"],
      platformOffering: false,
    });
    expect(models.map((m) => m.modelKey)).toEqual(["doubao-seedream-5-0-pro"]);
    expect(models.every((m) => m.credentialBound)).toBe(true);
  });

  it("keeps the Seedream card when the dated shelf key is listed", () => {
    const models = mergeBackgroundReplaceModels({
      gatewayModels: [
        {
          modelKey: "doubao-seedream-5-0-pro-260628",
          displayName: "Seedream from shelf",
          description: "shelf",
          role: "IMAGE",
          providerKind: "VOLCENGINE",
          credentialBound: true,
          platformOffering: false,
        },
      ],
      boundKinds: ["VOLCENGINE"],
      platformOffering: false,
    });
    expect(models).toHaveLength(1);
    expect(models[0]?.modelKey).toBe("doubao-seedream-5-0-pro");
    expect(models[0]?.displayName).toBe("Seedream from shelf");
  });
});
