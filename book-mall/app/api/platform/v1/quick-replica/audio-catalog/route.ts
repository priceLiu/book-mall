import { NextResponse } from "next/server";

import { getQrAudioCatalog } from "@/lib/quick-replica/qr-audio-catalog";

export async function GET() {
  return NextResponse.json(getQrAudioCatalog());
}
