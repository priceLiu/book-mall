import { describe, expect, it } from "vitest";

import {
  extractWorldSplatTiers,
  extractWorldSplatUrl,
  type WorldlabsWorld,
} from "@/lib/gateway/worldlabs-proxy";

describe("extractWorldSplatUrl", () => {
  const world: WorldlabsWorld = {
    world_id: "w1",
    display_name: "Test",
    world_marble_url: "https://marble.worldlabs.ai/world/w1",
    assets: {
      splats: {
        spz_urls: {
          "100k": "https://cdn.example/100k.spz",
          "500k": "https://cdn.example/500k.spz",
          full_res: "https://cdn.example/full.spz",
        },
      },
    },
  };

  it("prefers full_res by default", () => {
    expect(extractWorldSplatUrl(world)).toBe("https://cdn.example/full.spz");
  });

  it("falls back when preferred missing", () => {
    expect(
      extractWorldSplatUrl({
        ...world,
        assets: { splats: { spz_urls: { full_res: "https://cdn.example/full.spz" } } },
      }),
    ).toBe("https://cdn.example/full.spz");
  });

  it("returns null when no splats", () => {
    expect(extractWorldSplatUrl({ ...world, assets: {} })).toBeNull();
  });

  it("prefers 3m when full_res missing", () => {
    expect(
      extractWorldSplatUrl({
        ...world,
        assets: { splats: { spz_urls: { "500k": "https://cdn.example/500k.spz", "3m": "https://cdn.example/3m.spz" } } },
      }),
    ).toBe("https://cdn.example/3m.spz");
  });
});

describe("extractWorldSplatTiers", () => {
  it("picks 150k low, full_res high, rad when present", () => {
    const tiers = extractWorldSplatTiers({
      world_id: "w2",
      display_name: "Full",
      world_marble_url: "https://marble.worldlabs.ai/world/w2",
      assets: {
        splats: {
          spz_urls: {
            "100k": "https://cdn.example/100k.spz",
            "150k": "https://cdn.example/150k.spz",
            "500k": "https://cdn.example/500k.spz",
            full_res: "https://cdn.example/full.spz",
            rad: "https://cdn.example/world.rad",
          },
        },
      },
    });
    expect(tiers).toEqual({
      lowRes: "https://cdn.example/150k.spz",
      highRes: "https://cdn.example/full.spz",
      radUrl: "https://cdn.example/world.rad",
    });
  });

  it("falls back low→100k, high→500k, rad→null", () => {
    const tiers = extractWorldSplatTiers({
      world_id: "w3",
      display_name: "Partial",
      world_marble_url: "https://marble.worldlabs.ai/world/w3",
      assets: {
        splats: {
          spz_urls: {
            "100k": "https://cdn.example/100k.spz",
            "500k": "https://cdn.example/500k.spz",
          },
        },
      },
    });
    expect(tiers).toEqual({
      lowRes: "https://cdn.example/100k.spz",
      highRes: "https://cdn.example/500k.spz",
      radUrl: null,
    });
  });

  it("returns all null when no splats", () => {
    const tiers = extractWorldSplatTiers({
      world_id: "w4",
      display_name: "Empty",
      world_marble_url: "https://marble.worldlabs.ai/world/w4",
      assets: {},
    });
    expect(tiers).toEqual({ lowRes: null, highRes: null, radUrl: null });
  });
});
