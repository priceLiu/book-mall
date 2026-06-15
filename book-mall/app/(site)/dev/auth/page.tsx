import { notFound } from "next/navigation";

import { DevAuthClient } from "@/components/auth/dev-auth-client";
import { allowDevMockAuth } from "@/lib/dev-mock-auth";

export const dynamic = "force-dynamic";

export default function DevAuthPage() {
  if (!allowDevMockAuth()) notFound();
  return (
    <main className="container flex min-h-[60vh] items-center py-12">
      <DevAuthClient />
    </main>
  );
}
