import { describe, expect, it } from "vitest";

import { buildDailyLeftSessionImages } from "@/lib/image-layer-daily-session";
import type { ImageLayerSavedImage } from "@/lib/image-layer-types";

function item(url: string, at: string): ImageLayerSavedImage {
  return { url, at, title: url, source: "library" };
}

describe("buildDailyLeftSessionImages", () => {
  const now = new Date("2026-09-24T12:00:00+08:00");

  it("keeps only images saved today", () => {
    const list = buildDailyLeftSessionImages(
      [
        item("https://oss.example/d1-a.png", "2026-09-23T10:00:00.000Z"),
        item("https://oss.example/d2-a.png", "2026-09-24T01:00:00.000Z"),
        item("https://oss.example/d2-b.png", "2026-09-24T08:00:00.000Z"),
      ],
      now,
    );
    expect(list.map((row) => row.url)).toEqual([
      "https://oss.example/d2-a.png",
      "https://oss.example/d2-b.png",
    ]);
  });

  it("carries the last image from the most recent working day", () => {
    const list = buildDailyLeftSessionImages(
      [
        item("https://oss.example/d1-a.png", "2026-09-22T02:00:00.000Z"),
        item("https://oss.example/d1-last.png", "2026-09-22T09:00:00.000Z"),
        item("https://oss.example/older.png", "2026-09-20T09:00:00.000Z"),
      ],
      now,
    );
    expect(list.map((row) => row.url)).toEqual(["https://oss.example/d1-last.png"]);
  });

  it("skips idle days and still uses the last working day's final image", () => {
    const dayAfterIdle = new Date("2026-09-26T09:00:00+08:00");
    const list = buildDailyLeftSessionImages(
      [
        item("https://oss.example/first-last.png", "2026-09-23T15:00:00.000Z"),
        item("https://oss.example/first-a.png", "2026-09-23T01:00:00.000Z"),
      ],
      dayAfterIdle,
    );
    expect(list.map((row) => row.url)).toEqual(["https://oss.example/first-last.png"]);
  });
});
