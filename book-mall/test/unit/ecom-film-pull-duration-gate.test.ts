import { describe, expect, it } from "vitest";

import { assertFilmPullDurationAllowed } from "@/lib/ecom/ecom-film-pull-media";
import { FILM_PULL_V1_MAX_SEC } from "@/lib/ecom/ecom-film-pull-types";

describe("assertFilmPullDurationAllowed", () => {
  it("allows videos within V1 limit", () => {
    expect(() => assertFilmPullDurationAllowed(FILM_PULL_V1_MAX_SEC)).not.toThrow();
    expect(() => assertFilmPullDurationAllowed(undefined)).not.toThrow();
  });

  it("rejects videos over V1 limit when segmented mode disabled", () => {
    expect(() => assertFilmPullDurationAllowed(FILM_PULL_V1_MAX_SEC + 1)).toThrow(
      new RegExp(String(FILM_PULL_V1_MAX_SEC)),
    );
    expect(() => assertFilmPullDurationAllowed(120)).toThrow(/分段/);
  });
});
