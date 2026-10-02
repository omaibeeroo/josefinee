import "server-only";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h2",
  "h3",
  "h4",
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "span",
  "hr",
];

/**
 * Sanitizes admin-authored rich text before it is ever rendered.
 * Only a small allow-list of formatting tags survives; scripts, styles,
 * event handlers and dangerous URLs are removed.
 */
export function cleanRichText(dirty: string): string {
  return sanitizeHtml(dirty ?? "", {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      span: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (_tagName, attribs) => {
        const rel = "noopener noreferrer nofollow";
        const target = attribs.target === "_blank" ? "_blank" : undefined;
        return { tagName: "a", attribs: { ...attribs, rel, ...(target ? { target } : {}) } };
      },
    },
    disallowedTagsMode: "discard",
  });
}

/** Strips every tag — used for short plain-text fields rendered as text. */
export function stripTags(dirty: string): string {
  return sanitizeHtml(dirty ?? "", { allowedTags: [], allowedAttributes: {} });
}
