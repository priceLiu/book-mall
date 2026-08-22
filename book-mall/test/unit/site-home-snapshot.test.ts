import { describe, expect, it } from "vitest";

import { buildShowcaseForApp } from "@/lib/static-snapshots/platform-app-showcase-sources";
import {
  buildSiteHomeSnapshotFallback,
} from "@/lib/static-snapshots/build-site-home-snapshot";
import { hashDateKeySeed, seededShuffle } from "@/lib/static-snapshots/cst-date";
import { summarizeSiteHomePayload } from "@/lib/static-snapshots/site-home-payload";

describe("hashDateKeySeed", () => {
  it("is deterministic for same inputs", () => {
    expect(hashDateKeySeed("2026-08-22", "hero-bg", 10)).toBe(
      hashDateKeySeed("2026-08-22", "hero-bg", 10),
    );
  });

  it("varies by dateKey", () => {
    const a = hashDateKeySeed("2026-08-22", "hero-bg", 100);
    const b = hashDateKeySeed("2026-08-23", "hero-bg", 100);
    expect(a).not.toBe(b);
  });
});

describe("seededShuffle", () => {
  it("is deterministic", () => {
    const items = [1, 2, 3, 4, 5];
    expect(seededShuffle(items, "2026-08-22", "test")).toEqual(
      seededShuffle(items, "2026-08-22", "test"),
    );
  });
});

describe("buildShowcaseForApp", () => {
  it("returns up to 5 items for story app", () => {
    const items = buildShowcaseForApp("story", "2026-08-22");
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items[0]?.posterUrl).toBeTruthy();
  });
});

describe("buildSiteHomeSnapshotFallback", () => {
  it("produces valid payload without DB", () => {
    const payload = buildSiteHomeSnapshotFallback("2026-08-22");
    expect(payload.version).toBe(1);
    expect(payload.hero.clips.length).toBeGreaterThan(0);
    expect(payload.hero.background.url).toBeTruthy();
    if (payload.platformApps.length > 0) {
      const summary = summarizeSiteHomePayload(payload);
      expect(summary.showcaseItemCount).toBeGreaterThan(0);
    }
  });

  it("hero is stable for same dateKey", () => {
    const a = buildSiteHomeSnapshotFallback("2026-08-22");
    const b = buildSiteHomeSnapshotFallback("2026-08-22");
    expect(a.hero.background.url).toBe(b.hero.background.url);
  });
});
