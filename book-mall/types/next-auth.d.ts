import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      primaryTenantId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    role?: string;
    name?: string | null;
    picture?: string | null;
    primaryTenantId?: string | null;
    /** 单会话挤下线：JWT 内缓存的 sessionVersion 及上次核对时间（epoch 秒） */
    sv?: number;
    svAt?: number;
  }
}
