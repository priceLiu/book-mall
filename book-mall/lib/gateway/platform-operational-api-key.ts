import { prisma } from "@/lib/prisma";

/** Platform Admin Key（平台代付）不计入用户/团队积分。 */
export async function isPlatformOperationalApiKey(apiKeyId: string): Promise<boolean> {
  const key = await prisma.gatewayApiKey.findUnique({
    where: { id: apiKeyId },
    select: { scope: true },
  });
  return key?.scope === "PLATFORM";
}
