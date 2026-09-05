"use client";

import dynamic from "next/dynamic";

export {
  TAG_RICH_TEXT_PROSE_CLASS,
  TagRichTextStaticView,
} from "./tag-rich-text-editor";

export const TagRichTextEditor = dynamic(
  () =>
    import("./tag-rich-text-editor").then((m) => ({
      default: m.TagRichTextEditor,
    })),
  { ssr: false },
);
