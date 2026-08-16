import { NextResponse } from "next/server";
import { generateCaptcha } from "@/lib/auth/captcha";

export async function GET() {
  const challenge = generateCaptcha();
  return NextResponse.json(challenge);
}
