import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchToolsSessionUncachedWithDiag } from "@/lib/tools-introspect";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get("tools_token")?.value;
  const { session } = await fetchToolsSessionUncachedWithDiag(token);
  return NextResponse.json(session);
}
