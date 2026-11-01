export type HomeV2SkillIconKey =
  | "doc"
  | "layout"
  | "video"
  | "bolt"
  | "slides"
  | "research";

export function HomeV2SkillIcon({ name }: { name: HomeV2SkillIconKey }) {
  const common = {
    className: "od-icon",
    style: { width: 20, height: 20 } as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "doc":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      );
    case "layout":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 13h6M8 17h4" />
        </svg>
      );
    case "video":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="m15 10 4.55-2.27A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.89L15 14" />
          <rect x="3" y="6" width="12" height="12" rx="2" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
        </svg>
      );
    case "slides":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M4 6h16M4 12h16M4 18h10" />
          <path d="m15 15 2 2 4-4" />
        </svg>
      );
    case "research":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}

export function HomeV2SkillsHeadIcon() {
  return (
    <div className="skills-head-icon" aria-hidden>
      <svg className="od-icon" style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.5 13.8 8h5.7l-4.6 3.4 1.8 5.6L12 13.7 7.3 17l1.8-5.6L4.5 8h5.7L12 2.5Z" />
      </svg>
    </div>
  );
}
