"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  bookMallLoginHref,
  fetchStoryViewerUser,
  type StoryViewerUser,
} from "@/lib/story-viewer-session";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";

export function StoryAuthBar() {
  const pathname = usePathname() || "/";
  const base = useBookMallBaseUrl();
  const [user, setUser] = useState<StoryViewerUser | null | undefined>(undefined);

  useEffect(() => {
    if (!base) {
      setUser(null);
      return;
    }
    void fetchStoryViewerUser(base).then(setUser);
  }, [base]);

  if (pathname.startsWith("/project/")) {
    return null;
  }

  if (user === undefined) {
    return (
      <div className="border-b border-white/10 bg-black px-4 py-2 text-center text-xs text-[var(--story-muted)]">
        正在检查登录状态…
      </div>
    );
  }

  if (!user) {
    const returnTo = typeof window !== "undefined" ? window.location.href : "/";
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
        使用 book-mall 同一账号登录后可保存空间与模型配置。{" "}
        <a
          href={base ? bookMallLoginHref(base, returnTo) : "#"}
          className="font-medium text-white underline"
        >
          去登录
        </a>
      </div>
    );
  }

  return (
    <div className="border-b border-white/10 bg-black px-4 py-2 text-center text-xs text-[var(--story-muted)]">
      已登录：{user.name ?? user.phone ?? user.email ?? user.id}
      {base ? (
        <>
          {" · "}
          <Link href={`${base}/account`} className="text-[var(--story-accent)] hover:underline">
            主站账户
          </Link>
        </>
      ) : null}
    </div>
  );
}
