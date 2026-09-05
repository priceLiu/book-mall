import { cookies } from "next/headers";

export async function getPublisherToolsToken(): Promise<string | null> {
  const c = await cookies();
  return c.get("tools_token")?.value?.trim() || null;
}
