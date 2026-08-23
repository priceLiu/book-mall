import { getServerSession } from "next-auth";

import { NavbarShell } from "./navbar-shell";
import { NavbarAuth } from "./navbar-auth";
import { authOptions } from "@/lib/auth";

export async function Navbar() {
  const session = await getServerSession(authOptions);
  return (
    <NavbarShell isLoggedIn={Boolean(session?.user)}>
      <NavbarAuth />
    </NavbarShell>
  );
}
