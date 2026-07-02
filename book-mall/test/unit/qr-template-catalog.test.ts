import { describe, expect, it } from "vitest";

import {
  filterBuiltinsForKindBrowse,
  filterTemplatesForGallery,
  isQrCharacterGalleryTemplate,
  isQrImageGalleryTemplate,
  isQrKindThumbBuiltin,
  isQrMotionSyncGalleryTemplate,
  isQrVideoGalleryTemplate,
  isQrWorldGalleryTemplate,
} from "@/lib/quick-replica/qr-template-catalog";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";

function tpl(
  id: string,
  kind: string,
  category: QrTemplateJson["category"] = "image",
  source: QrTemplateJson["source"] = "builtin",
): QrTemplateJson {
  return {
    schemaVersion: 1,
    id,
    category,
    kind,
    title: id,
    thumbnailUrl: "https://example.com/x.webp",
    source,
    visibility: "public",
    reference: {
      slots: {},
      prompt: { text: "p", locale: "en" },
      model: { role: "IMAGE", modelKey: "lib-nano-pro", params: {} },
    },
    sortOrder: 0,
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
  };
}

describe("qr-template-catalog", () => {
  it("gallery ids are detectable", () => {
    expect(isQrImageGalleryTemplate(tpl("qr-image-gallery-01", "create-image"))).toBe(true);
    expect(isQrKindThumbBuiltin(tpl("builtin-image-create", "create-image"))).toBe(true);
  });

  it("kind browse excludes gallery builtins", () => {
    const items = [
      tpl("qr-image-gallery-01", "create-image"),
      tpl("builtin-image-create", "create-image"),
    ];
    expect(filterBuiltinsForKindBrowse(items).map((t) => t.id)).toEqual(["builtin-image-create"]);
  });

  it("image gallery lists only qr-image-gallery when no kind filter", () => {
    const items = [
      tpl("qr-image-gallery-01", "create-image"),
      tpl("qr-image-gallery-02", "create-image"),
      tpl("builtin-image-create", "create-image"),
    ];
    const out = filterTemplatesForGallery(items, { category: "image", scope: "all" });
    expect(out.every(isQrImageGalleryTemplate)).toBe(true);
    expect(out).toHaveLength(2);
  });

  it("character gallery lists only qr-character-gallery when no kind filter", () => {
    const items = [
      tpl("qr-character-gallery-01", "create-character", "character"),
      tpl("qr-character-gallery-02", "create-character", "character"),
      tpl("builtin-character-create", "create-character", "character"),
    ];
    const out = filterTemplatesForGallery(items, { category: "character", scope: "all" });
    expect(out.every(isQrCharacterGalleryTemplate)).toBe(true);
    expect(out).toHaveLength(2);
  });

  it("kind browse excludes character gallery builtins", () => {
    const items = [
      tpl("qr-character-gallery-01", "create-character", "character"),
      tpl("builtin-character-create", "create-character", "character"),
    ];
    expect(filterBuiltinsForKindBrowse(items).map((t) => t.id)).toEqual(["builtin-character-create"]);
  });

  it("world gallery lists only qr-world-gallery when no kind filter", () => {
    const items = [
      tpl("qr-world-gallery-01", "create-world", "world"),
      tpl("qr-world-gallery-02", "create-world", "world"),
      tpl("builtin-world-create", "create-world", "world"),
    ];
    const out = filterTemplatesForGallery(items, { category: "world", scope: "all" });
    expect(out.every(isQrWorldGalleryTemplate)).toBe(true);
    expect(out).toHaveLength(2);
  });

  it("kind browse excludes world gallery builtins", () => {
    const items = [
      tpl("qr-world-gallery-01", "create-world", "world"),
      tpl("builtin-world-create", "create-world", "world"),
    ];
    expect(filterBuiltinsForKindBrowse(items).map((t) => t.id)).toEqual(["builtin-world-create"]);
  });

  it("video gallery lists gallery seeds and platform catalog when no kind filter", () => {
    const items = [
      tpl("qr-video-gallery-01", "text-to-video", "video"),
      tpl("qr-video-gallery-02", "frame-to-video", "video"),
      tpl("qr-motion-sync-gallery-01", "motion-sync", "video"),
      tpl("clxyz-abyss-fight", "text-to-video", "video", "catalog"),
      tpl("clxyz-tide-juggernaut", "text-to-video", "video", "catalog"),
      tpl("clxyz-image-only", "create-image", "image", "catalog"),
      tpl("builtin-video-text-to-video", "text-to-video", "video"),
    ];
    const out = filterTemplatesForGallery(items, { category: "video", scope: "all" });
    expect(out.map((t) => t.id)).toEqual([
      "qr-video-gallery-01",
      "qr-video-gallery-02",
      "qr-motion-sync-gallery-01",
      "clxyz-abyss-fight",
      "clxyz-tide-juggernaut",
    ]);
  });

  it("image category browse includes platform catalog templates", () => {
    const items = [
      tpl("qr-image-gallery-01", "create-image"),
      tpl("clxyz-admin-image", "create-image", "image", "catalog"),
      tpl("builtin-image-create", "create-image"),
    ];
    const out = filterTemplatesForGallery(items, { category: "image", scope: "all" });
    expect(out.map((t) => t.id)).toEqual(["qr-image-gallery-01", "clxyz-admin-image"]);
  });

  it("kind browse excludes video gallery builtins", () => {
    const items = [
      tpl("qr-video-gallery-01", "text-to-video", "video"),
      tpl("builtin-video-text-to-video", "text-to-video", "video"),
    ];
    expect(filterBuiltinsForKindBrowse(items).map((t) => t.id)).toEqual([
      "builtin-video-text-to-video",
    ]);
  });

  it("motion-sync gallery lists only qr-motion-sync-gallery when kind filter set", () => {
    const items = [
      tpl("qr-motion-sync-gallery-01", "motion-sync", "video"),
      tpl("qr-motion-sync-gallery-02", "motion-sync", "video"),
      tpl("builtin-video-motion-sync", "motion-sync", "video"),
    ];
    const out = filterTemplatesForGallery(items, {
      category: "video",
      kind: "motion-sync",
      scope: "all",
    });
    expect(out.every(isQrMotionSyncGalleryTemplate)).toBe(true);
    expect(out).toHaveLength(2);
  });

  it("motion-sync gallery includes platform catalog templates", () => {
    const items = [
      tpl("qr-motion-sync-gallery-01", "motion-sync", "video"),
      tpl("clxyz-multi-person", "motion-sync", "video", "catalog"),
      tpl("clxyz-other-kind", "text-to-video", "video", "catalog"),
    ];
    const out = filterTemplatesForGallery(items, {
      category: "video",
      kind: "motion-sync",
      scope: "all",
    });
    expect(out.map((t) => t.id)).toEqual([
      "qr-motion-sync-gallery-01",
      "clxyz-multi-person",
    ]);
  });

  it("motion-sync gallery includes catalog when filtered by toolKey", () => {
    const items = [
      tpl("clxyz-multi-person", "motion-sync", "video", "catalog"),
      tpl("qr-motion-sync-gallery-01", "motion-sync", "video"),
    ];
    const out = filterTemplatesForGallery(items, {
      category: "video",
      toolKey: "motion-sync",
      scope: "all",
    });
    expect(out.map((t) => t.id)).toContain("clxyz-multi-person");
  });

  it("kind browse excludes motion-sync gallery builtins", () => {
    const items = [
      tpl("qr-motion-sync-gallery-01", "motion-sync", "video"),
      tpl("builtin-video-motion-sync", "motion-sync", "video"),
    ];
    expect(filterBuiltinsForKindBrowse(items).map((t) => t.id)).toEqual([
      "builtin-video-motion-sync",
    ]);
  });

  it("image create-image kind lists gallery and platform catalog", () => {
    const items = [
      tpl("qr-image-gallery-01", "create-image"),
      tpl("clxyz-admin-image", "create-image", "image", "catalog"),
      tpl("clxyz-other-kind", "edit-image", "image", "catalog"),
    ];
    const out = filterTemplatesForGallery(items, {
      category: "image",
      kind: "create-image",
      scope: "all",
    });
    expect(out.map((t) => t.id)).toEqual([
      "qr-image-gallery-01",
      "clxyz-admin-image",
    ]);
  });

  it("video text-to-video kind lists gallery and platform catalog", () => {
    const items = [
      tpl("qr-video-gallery-01", "text-to-video", "video"),
      tpl("qr-motion-sync-gallery-01", "motion-sync", "video"),
      tpl("clxyz-abyss-fight", "text-to-video", "video", "catalog"),
      tpl("clxyz-tide-juggernaut", "text-to-video", "video", "catalog"),
      tpl("clxyz-motion-only", "motion-sync", "video", "catalog"),
    ];
    const out = filterTemplatesForGallery(items, {
      category: "video",
      kind: "text-to-video",
      scope: "all",
    });
    expect(out.map((t) => t.id)).toEqual([
      "qr-video-gallery-01",
      "clxyz-abyss-fight",
      "clxyz-tide-juggernaut",
    ]);
  });

  it("video lip-sync kind excludes gallery builtins", () => {
    const items = [
      tpl("qr-video-gallery-01", "text-to-video", "video"),
      tpl("qr-motion-sync-gallery-01", "motion-sync", "video"),
    ];
    const out = filterTemplatesForGallery(items, {
      category: "video",
      kind: "lip-sync",
      scope: "all",
    });
    expect(out).toHaveLength(0);
  });
});
