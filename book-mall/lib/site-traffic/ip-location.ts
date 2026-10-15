import IP2Region from "ip2region";

let resolver: IP2Region | null = null;

function getIp2Region(): IP2Region {
  if (!resolver) {
    resolver = new IP2Region();
  }
  return resolver;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

function isLocalOrPrivateIp(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase();
  if (trimmed === "::1" || trimmed === "0:0:0:0:0:0:0:1") return true;
  if (trimmed.startsWith("fe80:") || trimmed.startsWith("fc") || trimmed.startsWith("fd")) {
    return true;
  }
  if (trimmed.includes(".")) return isPrivateIpv4(trimmed);
  return false;
}

function cleanGeoPart(part: string | undefined): string | null {
  const v = part?.trim();
  if (!v || v === "0" || v === "内网IP") return null;
  return v;
}

/** 将 ip2region 结果格式化为后台展示的归属地（离线库，仅服务端） */
export function formatIpLocationLabel(ip: string): string {
  if (isLocalOrPrivateIp(ip)) return "本地 / 内网";

  try {
    const hit = getIp2Region().search(ip.trim());
    if (!hit) return "—";

    const parts = [
      cleanGeoPart(hit.country),
      cleanGeoPart(hit.province),
      cleanGeoPart(hit.city),
      cleanGeoPart(hit.isp),
    ].filter((p): p is string => Boolean(p));

    if (parts.length === 0) return "—";
    return parts.join(" · ");
  } catch {
    return "—";
  }
}

/** 批量解析（Top N IP 去重后调用） */
export function mapIpLocations(ips: string[]): Map<string, string> {
  const unique = [...new Set(ips.map((ip) => ip.trim()).filter(Boolean))];
  const out = new Map<string, string>();
  for (const ip of unique) {
    out.set(ip, formatIpLocationLabel(ip));
  }
  return out;
}
