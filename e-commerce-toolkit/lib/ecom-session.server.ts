import { cookies } from "next/headers";

import { decodeToolsTokenProfile } from "@/lib/tools-token-decode";

export type EcomShellUser = {
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
};

/**
 * 壳层用户信息：从 tools_token JWT 本地解码，避免每次路由切换都阻塞在 introspect（常 10s+）。
 * 计费 / 生成准入仍由各 API 与客户端 tools-session 心跳负责。
 */
export async function getEcomShellUser(): Promise<EcomShellUser | null> {
  const token = cookies().get("tools_token")?.value;
  const profile = decodeToolsTokenProfile(token);
  if (!profile) return null;

  return {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
  };
}
