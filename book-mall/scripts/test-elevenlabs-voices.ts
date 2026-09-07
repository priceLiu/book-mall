import { prisma } from "@/lib/prisma";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { forwardElevenLabsListVoices } from "@/lib/gateway/elevenlabs-proxy";
import { qrListElevenLabsVoices } from "@/lib/quick-replica/qr-text-to-audio-service";

const email = process.argv[2]?.trim() || "13808816802@126.com";

async function main() {
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, gatewayApiKeyId: true, billingPersona: true },
  });
  if (!user) {
    console.log(JSON.stringify({ error: "user_not_found", email }));
    return;
  }

  const auth = await resolveGatewayAuthForBookUser(user.id);
  const credentialId = auth ? pickCredentialForKind(auth.credentials, "ELEVENLABS") : null;

  let raw: Awaited<ReturnType<typeof forwardElevenLabsListVoices>> | null = null;
  if (credentialId) {
    raw = await forwardElevenLabsListVoices({ credentialId });
  }

  let listed: Awaited<ReturnType<typeof qrListElevenLabsVoices>> | null = null;
  let listError: string | null = null;
  try {
    listed = await qrListElevenLabsVoices(user.id);
  } catch (e) {
    listError = e instanceof Error ? e.message : String(e);
  }

  console.log(
    JSON.stringify(
      {
        user: { email: user.email, billingPersona: user.billingPersona, hasGatewayKey: Boolean(user.gatewayApiKeyId) },
        credentialId,
        rawStatus: raw?.status ?? null,
        rawVoiceCount: raw?.voices.length ?? 0,
        rawSample: raw?.voices.slice(0, 3) ?? [],
        rawVendorDetail:
          raw && raw.status >= 300
            ? JSON.stringify(raw.vendorJson).slice(0, 400)
            : null,
        qrListSuccess: listed != null,
        qrListCount: listed?.length ?? 0,
        qrListError: listError,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
