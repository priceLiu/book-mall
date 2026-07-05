import { NextResponse } from "next/server";
import { ssoExchangeEnvStatus } from "@/lib/sso-exchange-env";

export const dynamic = "force-dynamic";

/** 运维：确认 story-web **运行时** 是否读到 SSO 密钥（不返回明文） */
export async function GET() {
  return NextResponse.json(ssoExchangeEnvStatus());
}
