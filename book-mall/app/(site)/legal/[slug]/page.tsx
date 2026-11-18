import Link from "next/link";
import { notFound } from "next/navigation";

import { AiLegalMarkdown } from "@/components/legal/ai-legal-markdown";
import {
  AI_LEGAL_DOC_BY_SLUG,
  AI_LEGAL_DOC_SLUGS,
  type AiLegalDocSlug,
} from "@/lib/legal/ai-legal-catalog";
import { readAiLegalMarkdown } from "@/lib/legal/read-ai-legal-doc";

export function generateStaticParams() {
  return AI_LEGAL_DOC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = AI_LEGAL_DOC_BY_SLUG[slug as AiLegalDocSlug];
  if (!meta) return { title: "法律文档" };
  return { title: meta.title };
}

export default async function AiLegalDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!AI_LEGAL_DOC_SLUGS.includes(slug as AiLegalDocSlug)) {
    notFound();
  }
  const source = await readAiLegalMarkdown(slug as AiLegalDocSlug);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <p className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          返回首页
        </Link>
      </p>
      <AiLegalMarkdown source={source} />
    </main>
  );
}