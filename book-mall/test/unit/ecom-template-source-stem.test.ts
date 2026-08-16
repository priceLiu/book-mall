import { describe, expect, it } from "vitest";

import {
  catalogEntryStemFromId,
  catalogIdMatchesSourceStem,
  fileStemFromUrl,
  parseSourceLookupQuery,
} from "@/lib/ecom/ecom-template-source-stem";

describe("ecom-template-source-stem", () => {
  it("extracts stem from yibaiaigc URL", () => {
    const url =
      "https://image.yibaiaigc.com/20260427/4f88b27f-de88-46ff-89d2-d7eea845e75e.png?x-oss-process=image/resize";
    expect(fileStemFromUrl(url)).toBe("4f88b27f-de8");
    expect(parseSourceLookupQuery(url)).toBe("4f88b27f-de8");
  });

  it("parses bare UUID", () => {
    expect(parseSourceLookupQuery("529f6533-f546-417e-8a22-6ea182288480")).toBe(
      "529f6533-f54",
    );
  });

  it("extracts stem from multi-segment category catalog id", () => {
    expect(catalogEntryStemFromId("home-textile-004-4f88b27f-de8")).toBe(
      "4f88b27f-de8",
    );
    expect(catalogEntryStemFromId("underwear-004-4f88b27f-de8")).toBe(
      "4f88b27f-de8",
    );
  });

  it("matches catalog id to source stem", () => {
    expect(
      catalogIdMatchesSourceStem("underwear-004-4f88b27f-de8", "4f88b27f-de8"),
    ).toBe(true);
    expect(
      catalogIdMatchesSourceStem("underwear-004-4f88b27f-de8", "529f6533-f54"),
    ).toBe(false);
  });
});
