/** 轨道上的技术栈图标（SVG，对齐 modern-animated-sign-in 参考稿） */

const ORBIT_ICON_SHELL =
  "w-[calc(4.5rem*var(--orbit-icon-scale,1.55))] h-[calc(4.5rem*var(--orbit-icon-scale,1.55))]";
const ORBIT_ICON_GLYPH = "size-[calc(2.75rem*var(--orbit-icon-scale,1.55))]";

function IconShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-transparent ${ORBIT_ICON_SHELL} ${className}`}
    >
      {children}
    </div>
  );
}

export function IconReact() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" className={ORBIT_ICON_GLYPH} aria-hidden>
        <circle cx="12" cy="12" r="2" fill="#61DAFB" />
        <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1.2" />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4"
          fill="none"
          stroke="#61DAFB"
          strokeWidth="1.2"
          transform="rotate(60 12 12)"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4"
          fill="none"
          stroke="#61DAFB"
          strokeWidth="1.2"
          transform="rotate(-60 12 12)"
        />
      </svg>
    </IconShell>
  );
}

export function IconTypeScript() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" className={ORBIT_ICON_GLYPH} aria-hidden>
        <rect width="24" height="24" rx="3" fill="#3178C6" />
        <path
          fill="#fff"
          d="M5.5 10.5h2.2v7.2H5.5zm6.1 0h2.1v1.1c.5-.9 1.4-1.4 2.6-1.4 2 0 3.1 1.2 3.1 3.5v4h-2.2v-3.5c0-1.1-.4-1.6-1.3-1.6-.9 0-1.4.6-1.4 1.7v3.4h-2.2V10.5z"
        />
      </svg>
    </IconShell>
  );
}

export function IconNextJs() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" className={ORBIT_ICON_GLYPH} aria-hidden>
        <path
          fill="#fff"
          d="M11.26 4.8H3v14.4h8.26V4.8zm1.48 0H21v6.72h-8.26V4.8zm0 7.68H21V19.2h-8.26v-6.72z"
        />
      </svg>
    </IconShell>
  );
}

export function IconTailwind() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" className={ORBIT_ICON_GLYPH} aria-hidden>
        <path
          fill="#38BDF8"
          d="M12 6c-3.3 0-5.4 1.6-6.3 4.8h2.5c.6-2 2-3 3.8-3 1.6 0 2.7.9 3.1 2.2h2.5C14.8 7.4 13.6 6 12 6zm6.3 5.2c-3.3 0-5.4 1.6-6.3 4.8h2.5c.6-2 2-3 3.8-3 1.6 0 2.7.9 3.1 2.2h2.5c-.8-2.9-2-4.2-3.6-4.2z"
        />
      </svg>
    </IconShell>
  );
}

export function IconJavaScript() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" className={ORBIT_ICON_GLYPH} aria-hidden>
        <rect width="24" height="24" rx="3" fill="#F7DF1E" />
        <path
          fill="#000"
          d="M8.2 17.5c.5.9 1.5 1.6 2.8 1.6 1.8 0 2.7-1 2.7-2.3 0-1.6-1.1-2.2-2.9-3.1-1-.5-1.6-.9-1.6-1.7 0-.7.5-1.2 1.4-1.2.8 0 1.4.4 1.8 1.1l1.6-.9c-.6-1-1.7-1.8-3.4-1.8-2 0-3.3 1.2-3.3 2.8 0 1.7 1.1 2.3 2.9 3.1 1 .5 1.5.9 1.5 1.8 0 .8-.6 1.3-1.6 1.3-1.1 0-1.9-.6-2.3-1.4l-1.6.9zM14.2 17.6l1.6-.1-.5-3.1h2.4l.3-1.6h-2.4l.2-1c0-.6.3-1 1-1h1.3l.3-1.6h-1.8c-1.7 0-2.5.9-2.7 2.3l-.2 1.3h-1.2l-.3 1.6h1.2l.5 3.1z"
        />
      </svg>
    </IconShell>
  );
}

export function IconHtml5() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" className={ORBIT_ICON_GLYPH} aria-hidden>
        <path fill="#E44D26" d="M4 3l1.5 17 7.5 2 7.5-2L22 3H4z" />
        <path fill="#F16529" d="M12 20.8 6.6 19.1 5.2 5h13.6L18.4 19 12 20.8z" />
        <path
          fill="#EBEBEB"
          d="M12 7.4H8.3l.3 3.4H12l-.1 3.2H9l.2 2.4L12 17.1V7.4zm4.2 0h-3.6l-.1 6.7 3.5 1 .3-3.4h-2l-.2-2.3h2l.1-2z"
        />
      </svg>
    </IconShell>
  );
}

export function IconCss3() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" className={ORBIT_ICON_GLYPH} aria-hidden>
        <path fill="#1572B6" d="M4 3l1.5 17 7.5 2 7.5-2L22 3H4z" />
        <path fill="#33A9DC" d="M12 20.8 6.6 19.1 5.2 5h13.6L18.4 19 12 20.8z" />
        <path
          fill="#fff"
          d="M12 7.4H8.9l.2 2.2H12l-.2 2.6H9.1l.2 2.5 2.7.8.3-3.4h2.8l.4-4.7H12V7.4z"
        />
      </svg>
    </IconShell>
  );
}

export function IconFigma() {
  return (
    <IconShell>
      <svg
        viewBox="0 0 38 57"
        className="h-[calc(2.75rem*var(--orbit-icon-scale,1.55))] w-auto"
        aria-hidden
      >
        <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
        <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 0 9.5 57H19V38H9.5A9.5 9.5 0 0 0 0 47.5z" />
        <path fill="#FF7262" d="M0 9.5A9.5 9.5 0 0 0 9.5 0H19v19H9.5A9.5 9.5 0 0 0 0 9.5z" />
        <path fill="#F24E1E" d="M0 28.5A9.5 9.5 0 0 0 9.5 19H19v19H9.5A9.5 9.5 0 0 0 0 28.5z" />
        <path fill="#A259FF" d="M19 0h9.5a9.5 9.5 0 1 1 0 19H19V0z" />
        <path fill="#A259FF" d="M19 38h9.5a9.5 9.5 0 1 1 0 19H19V38z" />
      </svg>
    </IconShell>
  );
}

export function IconGit() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" className={ORBIT_ICON_GLYPH} aria-hidden>
        <path
          fill="#F05032"
          d="M23.5 10.5L13.5.5a1.7 1.7 0 0 0-2.4 0L9.6 2 14 6.4l-2.8 2.8-4.4-4.4L2 9.6a1.7 1.7 0 0 0 0 2.4l10 10a1.7 1.7 0 0 0 2.4 0l2.5-2.5-4.4-4.4 2.8-2.8 4.4 4.4 2.5-2.5a1.7 1.7 0 0 0 0-2.4z"
        />
      </svg>
    </IconShell>
  );
}
