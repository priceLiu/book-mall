import Link from "next/link";
import { getBookMallOrigin, getToolWebOrigin } from "@/lib/site-config";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "首页", href: "/" },
      { label: "创作室", href: "/studio" },
      { label: "影像室", href: "/media" },
      { label: "模型配置", href: "/models" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "tool-web 漫剧剧场", href: "_tool" },
      { label: "book-mall 主站", href: "_book" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "Twenty CRM（参考）", href: "https://twenty.com/why-twenty" },
      { label: "GitHub twenty", href: "https://github.com/twentyhq/twenty" },
    ],
  },
] as const;

export function TwentyFooter() {
  const tool = getToolWebOrigin();
  const book = getBookMallOrigin();

  return (
    <footer className="relative border-t border-white/10 bg-white text-black">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 opacity-[0.07]"
        aria-hidden
        style={{
          background:
            "repeating-linear-gradient(0deg, #000 0 8px, transparent 8px 16px), repeating-linear-gradient(90deg, #000 0 8px, transparent 8px 16px)",
        }}
      />
      <div className="story-container py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {COLS.map((col) => (
            <div key={col.title}>
              <h3 className="story-sans text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => {
                  const href =
                    link.href === "_tool"
                      ? `${tool}/story-theater`
                      : link.href === "_book"
                        ? book
                        : link.href;
                  const external = href.startsWith("http");
                  return (
                    <li key={link.label}>
                      {external ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="story-sans text-sm text-neutral-600 hover:text-black"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={href}
                          className="story-sans text-sm text-neutral-600 hover:text-black"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div>
            <h3 className="story-sans text-sm font-semibold">Get started</h3>
            <p className="mt-4 story-sans text-sm text-neutral-600">
              登录 book-mall 同一账号，自动创建个人空间。
            </p>
            <Link href="/studio" className="twenty-btn mt-4 bg-black text-white hover:bg-neutral-800">
              打开创作室
            </Link>
          </div>
        </div>
        <p className="mt-12 border-t border-neutral-200 pt-6 story-sans text-xs text-neutral-500">
          story-web · 视觉参考{" "}
          <a href="https://twenty.com/why-twenty" className="underline">
            Twenty why-twenty
          </a>
          ，非 Twenty 官方资产。
        </p>
      </div>
    </footer>
  );
}
