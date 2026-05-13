import Link from "next/link";
import type { ReactNode } from "react";
import {
  TOOL_IMPLEMENTATION_AI_NOTE,
  TOOL_IMPLEMENTATION_CONTACT_NOTE,
} from "@/lib/tool-implementation-meta";
import styles from "./tool-implementation-doc.module.css";

export function ToolImplementationDoc({
  title,
  lead,
  useToolHref,
  useToolLabel,
  children,
}: {
  title: string;
  lead?: string;
  useToolHref: string;
  useToolLabel: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <p className={styles.crumb}>
          <Link href={useToolHref}>{useToolLabel}</Link>
          <span aria-hidden> · </span>
          <span>实现逻辑</span>
        </p>
        <h1 className={styles.title}>{title}</h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </header>

      {children}

      <footer className={styles.footer}>
        <p>{TOOL_IMPLEMENTATION_CONTACT_NOTE}</p>
        <p>{TOOL_IMPLEMENTATION_AI_NOTE}</p>
      </footer>
    </article>
  );
}

export function ToolImplementationSection({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <h2>{heading}</h2>
      {children}
    </section>
  );
}

export function ToolImplementationCode({
  caption,
  code,
}: {
  caption: string;
  code: string;
}) {
  return (
    <>
      <p className={styles.codeCaption}>{caption}</p>
      <pre className="tw-pre">
        <code>{code.trimEnd()}</code>
      </pre>
    </>
  );
}
