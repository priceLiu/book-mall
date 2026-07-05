import { NextResponse } from "next/server";

import { ssoExchangeEnvStatus } from "@/lib/sso-exchange-env";

export const dynamic = "force-dynamic";

/** 运维：确认 e-commerce-toolkit **运行时** 是否读到 SSO 与主站地址（不返回密钥明文） */
export async function GET() {
  return NextResponse.json(ssoExchangeEnvStatus());
}
