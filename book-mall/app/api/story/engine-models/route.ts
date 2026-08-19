import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { storyCorsHeaders } from "@/lib/story/cors";
import { listStoryRegistryEngineModels } from "@/lib/story/story-registry-models";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "public, max-age=300", ...storyCorsHeaders(request) },
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const billingPersona = session?.user?.id
    ? await getUserBillingPersona(session.user.id)
    : null;
  const models = session?.user?.id
    ? await listStoryRegistryEngineModels(session.user.id)
    : [];
  return NextResponse.json(
    { models, billingPersona },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        ...storyCorsHeaders(request),
      },
    },
  );
}
