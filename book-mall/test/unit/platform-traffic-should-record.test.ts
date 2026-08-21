import { describe, expect, it } from "vitest";

import { shouldRecordTrafficHit } from "../../../shared/platform-traffic/should-record-traffic-hit";

describe("shouldRecordTrafficHit", () => {
  it("records GET page requests", () => {
    expect(
      shouldRecordTrafficHit({ method: "GET", pathname: "/", search: "", excludeAdmin: true }),
    ).toBe(true);
  });

  it("skips api and rsc", () => {
    expect(
      shouldRecordTrafficHit({ method: "GET", pathname: "/api/foo", search: "", excludeAdmin: false }),
    ).toBe(false);
    expect(
      shouldRecordTrafficHit({
        method: "GET",
        pathname: "/",
        search: "?_rsc=abc",
        excludeAdmin: false,
      }),
    ).toBe(false);
  });

  it("skips admin when excludeAdmin", () => {
    expect(
      shouldRecordTrafficHit({
        method: "GET",
        pathname: "/admin/traffic",
        search: "",
        excludeAdmin: true,
      }),
    ).toBe(false);
  });

  it("skips static assets", () => {
    expect(
      shouldRecordTrafficHit({
        method: "GET",
        pathname: "/favicon.ico",
        search: "",
        excludeAdmin: false,
      }),
    ).toBe(false);
  });

  it("skips non GET/HEAD", () => {
    expect(
      shouldRecordTrafficHit({ method: "POST", pathname: "/", search: "", excludeAdmin: false }),
    ).toBe(false);
  });
});
