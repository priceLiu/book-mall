import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AiLegalMarkdown({ source }: { source: string }) {
  return (
    <article className="prose prose-neutral max-w-3xl dark:prose-invert prose-headings:scroll-mt-24">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </article>
  );
}