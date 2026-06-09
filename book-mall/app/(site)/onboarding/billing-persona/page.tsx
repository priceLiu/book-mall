import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BillingPersonaOnboardingClient } from "@/components/onboarding/billing-persona-onboarding-client";

export const metadata = { title: "选择计费身份" };
export const dynamic = "force-dynamic";

export default async function BillingPersonaOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding/billing-persona");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { billingPersonaLockedAt: true, billingPersona: true },
  });

  if (user?.billingPersonaLockedAt) {
    redirect(`/onboarding/welcome?persona=${user.billingPersona}`);
  }

  return <BillingPersonaOnboardingClient />;
}
