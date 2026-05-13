import { NavbarShell } from "./navbar-shell";
import { NavbarAuth } from "./navbar-auth";

export async function Navbar() {
  return (
    <NavbarShell>
      <NavbarAuth />
    </NavbarShell>
  );
}
