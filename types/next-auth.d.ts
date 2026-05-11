import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: DefaultSession["user"] & { id: string; role: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    role?: string;
    name?: string | null;
    picture?: string | null;
  }
}
