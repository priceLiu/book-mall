import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { BindPhoneForm } from "@/components/auth/bind-phone-form";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BindPhonePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phoneVerifiedAt: true, passwordHash: true },
  });

  if (user?.phoneVerifiedAt) redirect("/account");

  return <BindPhoneForm needsPassword={!user?.passwordHash} />;
}
