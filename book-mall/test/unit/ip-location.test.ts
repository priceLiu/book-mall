import { describe, expect, it } from "vitest";

import { formatIpLocationLabel, mapIpLocations } from "@/lib/site-traffic/ip-location";

describe("formatIpLocationLabel", () => {
  it("labels localhost and private ranges", () => {
    expect(formatIpLocationLabel("127.0.0.1")).toBe("本地 / 内网");
    expect(formatIpLocationLabel("::1")).toBe("本地 / 内网");
    expect(formatIpLocationLabel("192.168.1.10")).toBe("本地 / 内网");
  });

  it("resolves public IPv4 via offline db", () => {
    const label = formatIpLocationLabel("120.230.76.220");
    expect(label).toContain("广东");
    expect(label).toContain("广州");
  });

  it("mapIpLocations dedupes ips", () => {
    const map = mapIpLocations(["1.1.1.1", "1.1.1.1", "::1"]);
    expect(map.size).toBe(2);
    expect(map.get("::1")).toBe("本地 / 内网");
  });
});
