import { Fragment, type ReactNode } from "react";
import styles from "./plan-rules.module.css";

const VARIANT_BOX: Record<
  "banner" | "warn" | "danger" | "neutral",
  { wrap: string; showInnerHead: boolean }
> = {
  banner: {
    wrap: "tool-reminder-banner tool-reminder-banner--block",
    showInnerHead: true,
  },
  warn: {
    wrap: "tool-reminder-warn",
    showInnerHead: true,
  },
  danger: {
    wrap: "tool-reminder-danger",
    showInnerHead: true,
  },
  neutral: {
    wrap: "",
    showInnerHead: true,
  },
};

function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/** 段落 / 列表项内的 `**粗体**` */
function renderInlineMd(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function renderBodyChunk(block: string): ReactNode {
  const t = block.trim();
  if (!t) return null;
  const lines = t.split("\n");
  if (lines.every((l) => l.trimStart().startsWith("- "))) {
    return (
      <ul className={styles.ul}>
        {lines.map((l, j) => (
          <li key={j}>
            {renderInlineMd(l.replace(/^\s*-\s+/, "").trim())}
          </li>
        ))}
      </ul>
    );
  }
  if (lines[0]?.trimStart().startsWith("> ")) {
    const text = lines
      .map((l) => l.replace(/^\s*>\s?/, "").trim())
      .join(" ");
    return (
      <blockquote className={styles.quote}>
        {renderInlineMd(text)}
      </blockquote>
    );
  }
  return (
    <p>{renderInlineMd(t.replace(/\n/g, " "))}</p>
  );
}

function renderSectionBody(body: string): ReactNode {
  const cleaned = stripHtmlComments(body);
  if (!cleaned) return null;
  const blocks = cleaned.split(/\n\n+/).filter(Boolean);
  return (
    <div className={styles.bodyProse}>
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBodyChunk(block)}</Fragment>
      ))}
    </div>
  );
}

export type ParsedPlanRules = {
  pageTitle: string;
  preamble: string;
  sections: Array<{
    title: string;
    variant: keyof typeof VARIANT_BOX;
    body: string;
  }>;
  footerNote: string | null;
};

export function parsePlanRulesMarkdown(source: string): ParsedPlanRules {
  const lines = source.split("\n");
  let i = 0;
  let pageTitle = "计划规则说明";
  if (lines[0]?.startsWith("# ")) {
    pageTitle = lines[0].slice(2).trim();
    i = 1;
  }
  const preambleLines: string[] = [];
  while (i < lines.length && !lines[i].startsWith("## ")) {
    const line = lines[i];
    if (!line.trim().startsWith("<!--")) {
      preambleLines.push(line);
    }
    i++;
  }
  let preamble = stripHtmlComments(preambleLines.join("\n")).trim();

  const sections: ParsedPlanRules["sections"] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      const m = line.match(
        /^## (.+?)(?:\s*\{\.(banner|warn|danger|neutral)\})?\s*$/,
      );
      const rawTitle = m?.[1]?.trim() ?? line.slice(3).trim();
      let variant = (m?.[2] ?? "neutral") as keyof typeof VARIANT_BOX;
      if (!(variant in VARIANT_BOX)) variant = "neutral";
      i++;
      const bodyLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("## ")) {
        bodyLines.push(lines[i]);
        i++;
      }
      const body = bodyLines.join("\n").trim();
      sections.push({ title: rawTitle, variant, body });
      continue;
    }
    i++;
  }

  let footerNote: string | null = null;
  const last = sections[sections.length - 1];
  if (last?.body.includes("*文档路径")) {
    const idx = last.body.lastIndexOf("\n\n---");
    if (idx >= 0) {
      const foot = last.body.slice(idx).replace(/^\n\n---\s*\n/, "").trim();
      last.body = last.body.slice(0, idx).trim();
      const star = foot.match(/\*([^*]+)\*/);
      footerNote = star ? star[1].trim() : foot;
    }
  }

  return { pageTitle, preamble, sections, footerNote };
}

export function PlanRulesDocument({ parsed }: { parsed: ParsedPlanRules }) {
  return (
    <article className={styles.doc}>
      {parsed.preamble ? (
        <p className={styles.intro}>
          {renderInlineMd(parsed.preamble.replace(/\n/g, " "))}
        </p>
      ) : null}

      {parsed.sections.map((sec, idx) => {
        const cfg = VARIANT_BOX[sec.variant];
        const inner = (
          <>
            {cfg.showInnerHead ? (
              <h2 className={styles.sectionHead}>{sec.title}</h2>
            ) : null}
            {renderSectionBody(sec.body)}
          </>
        );

        if (sec.variant === "neutral") {
          return (
            <section key={idx} className={styles.section}>
              <div className={styles.sectionNeutralPanel}>{inner}</div>
            </section>
          );
        }

        return (
          <section key={idx} className={styles.section}>
            <div className={`${cfg.wrap} ${styles.sectionInner}`}>{inner}</div>
          </section>
        );
      })}

      {parsed.footerNote ? (
        <p className={styles.footerNote}>{parsed.footerNote}</p>
      ) : null}
    </article>
  );
}
