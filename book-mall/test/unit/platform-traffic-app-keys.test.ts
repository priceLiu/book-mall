import { describe, expect, it } from "vitest";

import { isPlatformTrafficAppKey, parsePlatformTrafficAppKey } from "@/lib/site-traffic/app-keys";

describe("platform traffic app keys", () => {
  it("parses aliases", () => {
    expect(parsePlatformTrafficAppKey("canvas")).toBe("canvas");
    expect(parsePlatformTrafficAppKey("ecommerce")).toBe("e-commerce");
    expect(parsePlatformTrafficAppKey("quick_replica")).toBe("quick-replica");
    expect(parsePlatformTrafficAppKey("unknown")).toBeNull();
  });

  it("validates known keys", () => {
    expect(isPlatformTrafficAppKey("book")).toBe(true);
    expect(isPlatformTrafficAppKey("nope")).toBe(false);
  });
});
