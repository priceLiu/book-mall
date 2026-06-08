import Link from "next/link";
import { ChevronsDownIcon } from "lucide-react";

const footerNav = [
  {
    title: "联系",
    links: [
      { text: "GitHub", href: "#" },
      { text: "微博 / X", href: "#" },
      { text: "小红书", href: "#" },
    ],
  },
  {
    title: "平台",
    links: [
      { text: "iOS", href: "#" },
      { text: "Android", href: "#" },
      { text: "Web", href: "#" },
    ],
  },
  {
    title: "帮助",
    links: [
      { text: "联系我们", href: "#" },
      { text: "积分报价", href: "/pricing" },
      { text: "计费与提现", href: "/pricing-disclosure#billing-policy" },
      { text: "价格公示", href: "/pricing-disclosure" },
      { text: "意见反馈", href: "#" },
    ],
  },
  {
    title: "社交",
    links: [
      { text: "哔哩哔哩", href: "#" },
      { text: "Discord", href: "#" },
      { text: "Dribbble", href: "#" },
    ],
  },
] as const;

const socialLinks = [
  {
    label: "GitHub",
    href: "#",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 .29a12 12 0 00-3.797 23.401c.6.11.82-.26.82-.577v-2.17c-3.338.726-4.042-1.415-4.042-1.415-.546-1.387-1.332-1.756-1.332-1.756-1.09-.744.084-.729.084-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.835 2.809 1.306 3.495.999.106-.775.418-1.307.76-1.608-2.665-.301-5.466-1.332-5.466-5.933 0-1.31.469-2.381 1.236-3.222-.123-.303-.535-1.523.117-3.176 0 0 1.007-.322 3.301 1.23a11.502 11.502 0 016.002 0c2.292-1.552 3.297-1.23 3.297-1.23.654 1.653.242 2.873.119 3.176.77.841 1.235 1.912 1.235 3.222 0 4.61-2.805 5.629-5.476 5.925.429.369.813 1.096.813 2.211v3.285c0 .32.217.694.825.576A12 12 0 0012 .29" />
      </svg>
    ),
  },
  {
    label: "Twitter",
    href: "#",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M19.633 7.997c.013.176.013.353.013.53 0 5.387-4.099 11.605-11.604 11.605A11.561 11.561 0 010 18.29c.373.044.734.074 1.12.074a8.189 8.189 0 005.065-1.737 4.102 4.102 0 01-3.834-2.85c.25.04.5.065.765.065.37 0 .734-.049 1.08-.147A4.092 4.092 0 01.8 8.582v-.05a4.119 4.119 0 001.853.522A4.099 4.099 0 01.812 5.847c0-.02 0-.042.002-.062a11.653 11.653 0 008.457 4.287A4.62 4.62 0 0122 5.924a8.215 8.215 0 002.018-.559 4.108 4.108 0 01-1.803 2.268 8.233 8.233 0 002.368-.648 8.897 8.897 0 01-2.062 2.112z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "#",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M19 0h-14a5 5 0 00-5 5v14a5 5 0 005 5h14a5 5 0 005-5v-14a5 5 0 00-5-5zm-11 19h-3v-9h3zm-1.5-10.268a1.752 1.752 0 110-3.505 1.752 1.752 0 010 3.505zm15.5 10.268h-3v-4.5c0-1.07-.02-2.450-1.492-2.450-1.495 0-1.725 1.166-1.725 2.372v4.578h-3v-9h2.88v1.23h.04a3.157 3.157 0 012.847-1.568c3.042 0 3.605 2.003 3.605 4.612v4.726z" />
      </svg>
    ),
  },
] as const;

export function FooterSection() {
  const year = new Date().getFullYear();

  return (
    <footer id="footer" className="relative z-10 mt-8 w-full pt-12 pb-8">
      <div className="container relative z-10 px-4 sm:px-6">
        <div className="footer-glass relative mx-auto max-w-6xl overflow-hidden rounded-2xl px-6 py-10">
          {/* 光晕限制在卡片内，避免顶部溢出（红箭头处多出的背景块） */}
          <div
            className="pointer-events-none absolute inset-0 select-none"
            aria-hidden
          >
            <div className="absolute top-1/3 left-1/4 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute right-1/4 bottom-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="footer-glass-layout relative z-[1]">
            <div className="flex w-[260px] max-w-full shrink-0 flex-col items-start">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
                <ChevronsDownIcon className="h-5 w-5" aria-hidden />
              </span>
              <span className="bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
                智选 AI
              </span>
            </Link>

            <div className="mb-6 max-w-xs space-y-1 text-sm text-foreground">
              <p>一人公司, 创业老板 专属 AI 加油站</p>
              <p>找工具, 学 AI, 做应用, 学课程</p>
              <p>成为 AI 的老板.</p>
            </div>

            <div className="flex gap-3 text-primary">
              {socialLinks.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="transition hover:text-foreground"
                >
                  {icon}
                </a>
              ))}
            </div>
            </div>

            <nav className="footer-glass-nav">
            {footerNav.map((section) => (
              <div key={section.title} className="shrink-0">
                <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                  {section.title}
                </div>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.text}>
                      <Link
                        href={link.href}
                        className="text-sm text-foreground/70 transition hover:text-foreground"
                      >
                        {link.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            </nav>
          </div>
        </div>

        <p className="relative z-10 mt-10 text-center text-xs text-muted-foreground">
          © {year} 智选 AI Mall · ai-code8.com
        </p>
      </div>
    </footer>
  );
}
