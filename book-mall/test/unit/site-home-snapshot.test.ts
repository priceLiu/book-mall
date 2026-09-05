import { describe, expect, it } from "vitest";

import { buildShowcaseForApp } from "@/lib/static-snapshots/platform-app-showcase-sources";
import {
  buildSiteHomeSnapshotFallback,
} from "@/lib/static-snapshots/build-site-home-snapshot";
import { hashDateKeySeed, seededShuffle } from "@/lib/static-snapshots/cst-date";
import {
  isSiteHomeSnapshotPayload,
  normalizePlatformAppReEnterHref,
  summarizeSiteHomePayload,
} from "@/lib/static-snapshots/site-home-payload";

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

  it("platform app hrefs use open pages or re-enter", () => {
    const payload = buildSiteHomeSnapshotFallback("2026-08-22");
    for (const app of payload.platformApps) {
      expect(app.href).not.toContain("localhost");
      if (app.key === "quick-replica" || app.key === "e-commerce" || app.key === "common-tools") {
        expect(app.href).toMatch(/^\/(quick-replica|ecom|common-tools)-open\?path=/);
      } else {
        expect(app.href.startsWith("/api/sso/tools/re-enter")).toBe(true);
      }
    }
  });
});

describe("normalizePlatformAppReEnterHref", () => {
  it("strips localhost absolute re-enter URLs", () => {
    expect(
      normalizePlatformAppReEnterHref(
        "http://localhost:3000/api/sso/tools/re-enter?app=canvas&redirect=%2Fprojects",
      ),
    ).toBe("/api/sso/tools/re-enter?app=canvas&redirect=%2Fprojects");
  });

  it("strips production book origin", () => {
    expect(
      normalizePlatformAppReEnterHref(
        "https://book.ai-code8.com/api/sso/tools/re-enter?app=story&redirect=%2F",
      ),
    ).toBe("/api/sso/tools/re-enter?app=story&redirect=%2F");
  });

  it("leaves relative paths unchanged", () => {
    const href = "/api/sso/tools/re-enter?app=tool&redirect=%2Ffitting-room";
    expect(normalizePlatformAppReEnterHref(href)).toBe(href);
  });
});
