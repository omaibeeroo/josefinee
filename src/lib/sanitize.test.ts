import { describe, expect, it } from "vitest";
import { cleanRichText, stripTags } from "@/lib/sanitize";

describe("cleanRichText", () => {
  it("strips script tags and their content", () => {
    const out = cleanRichText("<p>Hello</p><script>alert('xss')</script>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>Hello</p>");
  });

  it("strips event handlers and dangerous attributes", () => {
    const out = cleanRichText('<p onclick="steal()">Hi</p><a href="https://example.com" title="t">x</a>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("<p>Hi</p>");
  });

  it("blocks javascript: URLs but keeps https links", () => {
    const bad = cleanRichText('<a href="javascript:alert(1)">click</a>');
    expect(bad).not.toContain("javascript:");
    const good = cleanRichText('<a href="https://example.com">click</a>');
    expect(good).toContain('href="https://example.com"');
  });

  it("strips style tags, iframes and objects", () => {
    const out = cleanRichText("<style>body{}</style><iframe src='x'></iframe><object></object><p>ok</p>");
    expect(out).not.toContain("<style>");
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<object");
    expect(out).toContain("<p>ok</p>");
  });

  it("keeps the formatting allow-list", () => {
    const html = "<h2>T</h2><p><strong>B</strong> and <em>I</em></p><ul><li>one</li></ul><blockquote>q</blockquote>";
    const out = cleanRichText(html);
    for (const tag of ["<h2>", "<strong>", "<em>", "<ul>", "<li>", "<blockquote>"]) {
      expect(out).toContain(tag);
    }
  });

  it("neutralizes SVG-based XSS", () => {
    const out = cleanRichText('<svg onload="alert(1)"><circle></circle></svg>');
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("onload");
  });

  it("handles empty and malformed input", () => {
    expect(cleanRichText("")).toBe("");
    expect(cleanRichText("<p>unclosed")).toContain("unclosed");
  });
});

describe("stripTags", () => {
  it("removes every tag", () => {
    expect(stripTags("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
    expect(stripTags("<script>alert(1)</script>")).toBe("");
  });
});
