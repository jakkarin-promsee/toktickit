import { expect, type Page } from "@playwright/test";

/** Required evidence viewports from ui-spec.md section 11, plus a 200% zoom equivalent of the desktop width. */
export const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** 200% browser zoom on a 1440 px window lays out like a 720 CSS px viewport. */
export const zoom200 = { name: "zoom-200", width: 720, height: 450 } as const;

export type Viewport = (typeof viewports)[number] | typeof zoom200;

/** No page-level horizontal scroll and no visible interactive control outside the viewport. */
export async function expectNoOverflow(page: Page, label: string) {
  const width = page.viewportSize()!.width;
  const result = await page.evaluate((viewportWidth) => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    };
    const clipped = [...document.querySelectorAll("button, a, input, select, textarea, label, h1, h2, .badge")]
      .filter(visible)
      .filter((element) => { const box = element.getBoundingClientRect(); return box.left < -1 || box.right > viewportWidth + 1; })
      .map((element) => `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 40)}"`);
    return { scrollWidth: document.documentElement.scrollWidth, clipped };
  }, width);
  expect(result.scrollWidth, `${label}: page-level horizontal scroll`).toBeLessThanOrEqual(width);
  expect(result.clipped, `${label}: controls outside the viewport`).toEqual([]);
}

/** Touch targets on mobile: visible buttons and form controls are at least 44 px high (checkboxes excluded). */
export async function expectTouchTargets(page: Page, label: string) {
  const small = await page.locator("button:visible, .btn:visible, input:visible:not([type=checkbox]), select:visible").evaluateAll((elements) =>
    elements
      .filter((element) => !element.closest(".zen-dialog-backdrop[hidden]"))
      .map((element) => ({ name: (element.textContent || element.id || element.getAttribute("aria-label") || "").trim().slice(0, 40), height: element.getBoundingClientRect().height }))
      .filter((item) => item.height < 43.5));
  expect(small, `${label}: touch targets under 44 px`).toEqual([]);
}

/** Text elements whose foreground/background contrast is under WCAG AA 4.5:1 (disabled controls are exempt). */
export async function contrastViolations(page: Page) {
  return page.evaluate(() => {
    const parse = (value: string) => { const match = value.match(/rgba?\(([^)]+)\)/); if (!match) return null; const [r, g, b, a = "1"] = match[1].split(/[ ,/]+/).filter(Boolean); return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) }; };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const channel = (value: number) => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const background = (element: Element | null): { r: number; g: number; b: number } => {
      for (let node = element; node; node = node.parentElement) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color && color.a > 0.9) return color;
      }
      return { r: 255, g: 255, b: 255 };
    };
    const selectors = "p, label, a, button, .badge, .form-text, .field-error, dt, dd, td, th, h1, h2, h3, li, .alert, strong, span";
    const violations: string[] = [];
    for (const element of document.querySelectorAll(selectors)) {
      const html = element as HTMLElement;
      if (!html.innerText?.trim() || html.closest("[disabled], :disabled") || html.matches(":disabled")) continue;
      const box = html.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || getComputedStyle(html).visibility === "hidden") continue;
      const foreground = parse(getComputedStyle(html).color);
      if (!foreground) continue;
      const back = background(html);
      const [light, dark] = [luminance(foreground), luminance(back)].sort((a, b) => b - a);
      const ratio = (light + 0.05) / (dark + 0.05);
      if (ratio < 4.5) violations.push(`${html.tagName.toLowerCase()}.${html.className} "${html.innerText.trim().slice(0, 30)}" ${ratio.toFixed(2)}`);
    }
    return [...new Set(violations)];
  });
}

/** Structural accessibility checks that do not need an external engine. */
export async function structureViolations(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const visible = (element: Element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden"; };
    const h1 = [...document.querySelectorAll("h1")].filter(visible);
    if (h1.length !== 1) problems.push(`expected one h1, found ${h1.length}`);
    let previous = 0;
    for (const heading of [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(visible)) {
      const level = Number(heading.tagName[1]);
      if (previous && level > previous + 1) problems.push(`heading level skips from h${previous} to h${level}: "${heading.textContent?.trim()}"`);
      previous = level;
    }
    for (const control of [...document.querySelectorAll("input, select, textarea")].filter(visible) as HTMLInputElement[]) {
      const named = (control.labels?.length ?? 0) > 0 || control.getAttribute("aria-label") || control.getAttribute("aria-labelledby");
      if (!named) problems.push(`unlabelled ${control.tagName.toLowerCase()}#${control.id}`);
    }
    for (const button of [...document.querySelectorAll("button, a[href], [role=tab]")].filter(visible)) {
      if (!(button.textContent?.trim() || button.getAttribute("aria-label"))) problems.push(`unnamed ${button.tagName.toLowerCase()}`);
    }
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) problems.push(`duplicate id ${id}`);
    for (const element of document.querySelectorAll("[aria-describedby], [aria-labelledby], [aria-controls]")) {
      for (const attribute of ["aria-describedby", "aria-labelledby", "aria-controls"]) {
        for (const ref of (element.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(ref)) problems.push(`${attribute} points at missing #${ref}`);
        }
      }
    }
    for (const invalid of document.querySelectorAll("[aria-invalid='true']")) {
      if (!invalid.getAttribute("aria-describedby")) problems.push(`invalid #${invalid.id} has no aria-describedby error`);
    }
    return problems;
  });
}

/** The focused element shows the approved 3 px outline (or the Bootstrap focus ring on form controls). */
export async function expectVisibleFocus(page: Page, label: string) {
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return { tag: element.tagName, outline: style.outlineStyle, width: parseFloat(style.outlineWidth), shadow: style.boxShadow, focusVisible: element.matches(":focus-visible") };
  });
  expect(focus, `${label}: something is focused`).not.toBeNull();
  const hasOutline = focus!.outline !== "none" && focus!.width >= 2;
  const hasRing = focus!.shadow !== "none";
  expect(hasOutline || hasRing, `${label}: visible focus indicator on ${focus!.tag}`).toBe(true);
}
