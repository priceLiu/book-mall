import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StoryLoginForm } from "@/components/auth/story-login-form";
import { fetchToolsSession } from "@/lib/tools-introspect";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "登录",
  description: "登录 story-web 漫剧创作空间，继续你的故事、分镜与影像创作。",
};

function safeRedirect(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const target = safeRedirect(searchParams?.redirect);
  const token = cookies().get("tools_token")?.value;
  const session = await fetchToolsSession(token);
  if (session.active) redirect(target);

  return (
    <main className="flex min-h-dvh w-full items-center justify-center overflow-y-auto bg-[var(--story-bg)] px-4 py-10">
      <StoryLoginForm bookOrigin={getMainSiteOrigin()} redirect={target} />
    </main>
  );
}
