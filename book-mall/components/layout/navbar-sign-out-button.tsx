"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function NavbarSignOutButton() {
  return (
    <Button variant="outline" size="sm" className="h-9 shrink-0 px-3" onClick={() => signOut({ callbackUrl: "/" })}>
      退出
    </Button>
  );
}
