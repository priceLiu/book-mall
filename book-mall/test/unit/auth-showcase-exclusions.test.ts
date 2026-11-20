import { describe, expect, it } from "vitest";

import {
  filterPortalFilmShowcaseForAuth,
  isAuthShowcaseExcludedOwner,
} from "@/lib/auth/auth-showcase-exclusions";
import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";

describe("auth-showcase-exclusions", () => {
  it("excludes Pilot owner by default email or name", () => {
    expect(
      isAuthShowcaseExcludedOwner({
        id: "u1",
        name: "Pilot",
        email: "other@example.com",
      }),
    ).toBe(true);
    expect(
      isAuthShowcaseExcludedOwner({
        id: "u2",
        name: "Someone",
        email: "13808816802@126.com",
      }),
    ).toBe(true);
    expect(
      isAuthShowcaseExcludedOwner({
        id: "u3",
        name: "Customer",
        email: "user@example.com",
      }),
    ).toBe(false);
  });

  it("filters showcase items for auth", () => {
    const items: PortalFilmShowcaseMedia[] = [
      {
        id: "1",
        url: "https://x/a.mp4",
        kind: "video",
        sourceKind: "project",
        sourceId: "p1",
        projectName: "A",
        description: "",
        owner: { id: "u1", name: "Pilot", email: "p@x.com" },
      },
      {
        id: "2",
        url: "https://x/b.mp4",
        kind: "video",
        sourceKind: "project",
        sourceId: "p2",
        projectName: "B",
        description: "",
        owner: { id: "u2", name: "Studio", email: "s@x.com" },
      },
    ];
    const filtered = filterPortalFilmShowcaseForAuth(items);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.sourceId).toBe("p2");
  });
});