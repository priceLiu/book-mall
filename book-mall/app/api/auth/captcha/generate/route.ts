import { NextResponse } from "next/server";
import { generateCaptcha } from "@/lib/auth/captcha";

/** 禁止 build 时静态化：否则全站共用构建期的一道题，token 5 分钟后永久失效 */
export const dynamic = "force-dynamic";

export async function GET() {
  const challenge = generateCaptcha();
  return NextResponse.json(challenge, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
