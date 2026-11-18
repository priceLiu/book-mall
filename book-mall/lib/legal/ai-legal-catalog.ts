export const AI_LEGAL_DOC_SLUGS = ["user-agreement", "app-permissions", "privacy-policy"] as const;

export type AiLegalDocSlug = (typeof AI_LEGAL_DOC_SLUGS)[number];

export type AiLegalDocMeta = {
  slug: AiLegalDocSlug;
  title: string;
  shortLabel: string;
  fileName: string;
};

export const AI_LEGAL_DOCS: AiLegalDocMeta[] = [
  {
    slug: "user-agreement",
    title: "智选AI 用户协议",
    shortLabel: "用户协议",
    fileName: "user-agreement.md",
  },
  {
    slug: "app-permissions",
    title: "AI App 应用权限说明",
    shortLabel: "应用权限说明",
    fileName: "app-permissions.md",
  },
  {
    slug: "privacy-policy",
    title: "智选AI 隐私政策",
    shortLabel: "隐私政策",
    fileName: "privacy-policy.md",
  },
];

export const AI_LEGAL_DOC_BY_SLUG = Object.fromEntries(
  AI_LEGAL_DOCS.map((d) => [d.slug, d]),
) as Record<AiLegalDocSlug, AiLegalDocMeta>;

export function aiLegalDocPath(slug: string): string {
  return `/legal/${slug}`;
}