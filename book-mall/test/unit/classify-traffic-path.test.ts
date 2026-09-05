import { describe, expect, it } from "vitest";

import {
  isProbeTrafficPath,
  trafficHitKind,
} from "../../../shared/platform-traffic/classify-traffic-path";

describe("isProbeTrafficPath", () => {
  it("marks classic scanner paths", () => {
    expect(isProbeTrafficPath("/wp-admin")).toBe(true);
    expect(isProbeTrafficPath("/.env")).toBe(true);
    expect(isProbeTrafficPath("/phpmyadmin/index.php")).toBe(true);
    expect(isProbeTrafficPath("/xmlrpc.php")).toBe(true);
    expect(isProbeTrafficPath("/.git/config")).toBe(true);
  });

  it("does not mark product pages", () => {
    expect(isProbeTrafficPath("/")).toBe(false);
    expect(isProbeTrafficPath("/login")).toBe(false);
    expect(isProbeTrafficPath("/ecom/storyboard")).toBe(false);
    expect(isProbeTrafficPath("/projects?id=1")).toBe(false);
  });
});

describe("trafficHitKind", () => {
  it("labels probe / mixed / page", () => {
    expect(trafficHitKind(198, 198)).toBe("probe");
    expect(trafficHitKind(10, 3)).toBe("mixed");
    expect(trafficHitKind(32, 0)).toBe("page");
  });
});
