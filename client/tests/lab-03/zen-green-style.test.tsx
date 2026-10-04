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

describe("STYLE-01 Issue #40 Zen Green consistency fixes", () => {
  it("maps Bootstrap primary, success, outline, and link colors onto the green tokens", () => {
    const primary = block(".btn-primary,\n.btn-success");
    expect(primary).toContain("--bs-btn-bg: var(--green-700)");
    expect(primary).toContain("--bs-btn-hover-bg: var(--green-800)");
    expect(block(".btn-outline-primary")).toContain("--bs-btn-color: var(--green-700)");
    expect(css).toMatch(/--bs-link-color: #006b3c/);
    expect(block(".form-check-input:checked")).toContain("var(--green-700)");
  });

  it("gives every status, priority, role, and account badge its own tint class", () => {
    for (const status of ["new", "open", "in-progress", "waiting-for-requester", "resolved", "closed", "reopened", "cancelled"]) expect(css).toContain(`.badge-status-${status} {`);
    for (const priority of ["low", "medium", "high"]) expect(css).toContain(`.badge-priority-${priority} {`);
    for (const role of ["requester", "it-staff", "administrator"]) expect(css).toContain(`.badge-role-${role} {`);
    for (const state of ["active", "inactive", "password-change-required"]) expect(css).toContain(`.badge-account-${state} {`);
  });

  it("marks required fields visibly without changing their accessible name and keeps errors adjacent", () => {
    expect(block(".form-label.required::after")).toContain('content: " *" / ""');
    expect(block(".field-error")).toContain("var(--danger)");
    expect(block("textarea.form-control")).toContain("min-height: 120px");
    expect(block(".form-control,\n.form-select,\n.btn")).toContain("min-height: 44px");
  });

  it("keeps Internal Note composition visually distinct and tab selection independent of color", () => {
    expect(block(".btn-note")).toContain("var(--note-border)");
    expect(block(".comm-tab-internal")).toContain("--bs-btn-hover-bg: var(--note)");
    const active = block(".comm-tab.is-active");
    expect(active).toContain("font-weight: 700");
    expect(active).toContain("box-shadow: inset");
    expect(block(".comm-tab")).toContain("transition: none");
    expect(block(".note-surface")).toContain("var(--note");
  });

  it("styles the shell with a white focus ring on green, aria-current navigation, and a collapsible mobile menu", () => {
    expect(block(".app-header :focus-visible")).toContain("outline-color: #ffffff");
    expect(block('.app-nav-link[aria-current="page"]')).toContain("font-weight: 700");
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.app-collapsible\.is-open \{\s*display: flex;/);
    expect(block(".zen-dialog-backdrop")).toContain("position: fixed");
  });
});
