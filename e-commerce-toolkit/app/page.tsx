import { cookies } from "next/headers";

import { EcomHomeLoggedIn } from "@/components/ecom-home-logged-in";
import { EcomLanding } from "@/components/ecom-landing";
import { fetchEcomToolsSessionWithIntrospect } from "@/lib/ecom-tools-introspect";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = cookies().get("tools_token")?.value;
  const session = await fetchEcomToolsSessionWithIntrospect(token ?? "");
  if (!session.active) {
    return <EcomLanding />;
  }
  return <EcomHomeLoggedIn />;
}
