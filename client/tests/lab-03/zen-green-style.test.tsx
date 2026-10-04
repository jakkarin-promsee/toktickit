import css from "../../src/styles.css?raw";
import app from "../../src/App.tsx?raw";
import { describe, expect, it } from "vitest";

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} exists`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("STYLE-01 Zen Green tokens and semantic hooks", () => {
  it("keeps the Lab 2 Zen Green palette tokens and the Internal Note tokens", () => {
    const tokens = block(':root[data-theme="zen-green"]');
    for (const token of ["--green-700", "--green-600", "--green-050", "--page", "--surface", "--text", "--muted", "--border", "--readonly", "--danger", "--warning"]) {
      expect(tokens).toContain(`${token}:`);
    }
    expect(css).toMatch(/--note:\s*#[0-9a-f]{6}/i);
    expect(css).toMatch(/--note-border:\s*#[0-9a-f]{6}/i);
    expect(app).toContain(`document.documentElement.dataset.theme = "zen-green"`);
  });

  it("styles the shell, cards, badges, read-only fields, and Internal Note surface from tokens", () => {
    expect(block(".app-header")).toContain("var(--green-700)");
    expect(block(".readonly-field")).toContain("var(--readonly)");
    expect(block(".readonly-fields dd")).toContain("var(--readonly)");
    expect(block(".note-surface")).toContain("var(--note)");
    expect(block(".note-surface")).toContain("var(--note-border)");
    for (const selector of [".zen-card", ".badge-zen", ".badge-priority", ".badge-muted", ".auth-card"]) block(selector);
  });

  it("keeps a visible focus indicator for every interactive element", () => {
    const focus = block(":where(button, a, input, select, textarea):focus-visible");
    expect(focus).toMatch(/outline/);
  });

  it("wraps long content in tables and comments instead of overflowing the page", () => {
    expect(block(".user-table")).toContain("overflow-wrap: anywhere");
    expect(block(".readonly-fields dd")).toContain("overflow-wrap: anywhere");
    expect(css).toMatch(/\.comment-text\s*\{[^}]*(white-space: pre-wrap|overflow-wrap)/);
  });

  it("declares responsive breakpoints for the table-to-card switch", () => {
    expect(css).toMatch(/@media \((min|max)-width:/);
  });
});
