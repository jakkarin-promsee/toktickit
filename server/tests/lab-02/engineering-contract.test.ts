import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docsDirectory = resolve(process.cwd(), "..", "docs", "lab-02");

function readDocument(name: string): string {
  return readFileSync(resolve(docsDirectory, name), "utf8");
}

function ids(document: string, prefix: "FR" | "BR" | "AC"): string[] {
  return [...document.matchAll(new RegExp(`^[-| ]*(${prefix}-\\d{2})\\b`, "gm"))].map(
    ([, id]) => id,
  );
}

function expectContinuous(values: string[], prefix: string): void {
  expect(values.length, `${prefix} IDs must exist`).toBeGreaterThan(0);
  expect(new Set(values).size, `${prefix} IDs must be unique`).toBe(values.length);
  expect(values).toEqual(
    values.map((_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Lab 2 engineering contract", () => {
  it("contains every required document and specification section", () => {
    const specification = readDocument("specification.md");

    for (const section of [
      "Sprint Goal",
      "Stakeholder Request",
      "Scope",
      "Functional Requirements",
      "Business Rules",
      "UI Specification Summary",
      "Data Changes",
      "API Contract",
      "Acceptance Criteria",
      "Definition of Done",
      "Assumptions and Decisions",
    ]) {
      expect(specification).toMatch(new RegExp(`^## \\d+\\. ${section}`, "m"));
    }

    expect(readDocument("ui-spec.md")).toContain("# Lab 2 UI Specification");
    expect(readDocument("api-spec.md")).toContain("# Lab 2 REST API Specification");
    expect(readDocument("tests.md")).toContain("# Lab 2 Test Plan and Results");
  });

  it("uses unique, continuous requirement and acceptance IDs", () => {
    const specification = readDocument("specification.md");

    expectContinuous(ids(specification, "FR"), "FR");
    expectContinuous(ids(specification, "BR"), "BR");
    expectContinuous(ids(specification, "AC"), "AC");
  });

  it("defines every required REST capability", () => {
    const api = readDocument("api-spec.md");

    for (const contract of [
      "GET /api/requesters",
      "GET /api/categories",
      "GET /api/related-systems",
      "POST /api/tickets",
      "GET /api/tickets",
      "GET /api/tickets/:ticketId",
      "POST /api/tickets/:ticketId/attachments",
      "GET /api/tickets/:ticketId/attachments",
      "GET /api/attachments/:attachmentId/download",
      "DELETE /api/attachments/:attachmentId",
    ]) {
      expect(api).toMatch(new RegExp(`^### ${escapeRegExp(contract)}$`, "m"));
    }

    expect(api).toContain("404");
    expect(api).toContain("422");
    expect(api).toContain("5 MB");
  });

  it("maps every acceptance criterion to at least one planned test", () => {
    const specification = readDocument("specification.md");
    const testPlan = readDocument("tests.md");

    for (const acceptanceId of ids(specification, "AC")) {
      expect(
        testPlan,
        `${acceptanceId} needs an explicit acceptance-criterion traceability row`,
      ).toMatch(new RegExp(`^\\| ${acceptanceId} \\| [^|]+ \\|$`, "m"));
    }

    for (const level of ["Unit", "API", "UI", "Style", "Responsive", "E2E"]) {
      expect(testPlan).toMatch(new RegExp(`\\| [^|]+ \\| ${level} \\|`));
    }
  });

  it("records fixed attachment and explicit out-of-scope rules", () => {
    const specification = readDocument("specification.md");

    for (const rule of [
      "JPG",
      "JPEG",
      "PNG",
      "WEBP",
      "PDF",
      "5 MB",
      "five\\s+active\\s+attachments",
      "soft removal",
      "authentication",
      "IT Staff",
      "Internal Notes",
      "Actions Taken",
    ]) {
      expect(specification).toMatch(new RegExp(rule, "i"));
    }
  });

  it("locks down cross-document implementation decisions", () => {
    const specification = readDocument("specification.md");
    const api = readDocument("api-spec.md");
    const ui = readDocument("ui-spec.md");
    const testPlan = readDocument("tests.md");

    for (const category of ["Account and Access", "Hardware", "Software", "Network"]) {
      expect(specification).toContain(category);
    }

    expect(specification).toContain("internal `id` in the requested direction");
    expect(api).toContain("`id` in the same direction");
    expect(specification).toMatch(/dirty[\s\S]{0,120}confirmation/i);
    expect(ui).toMatch(
      /(?:dirty[\s\S]{0,120}confirmation|confirmation[\s\S]{0,120}dirty)/i,
    );
    expect(testPlan).toContain("concurrent final-slot uploads");
    expect(testPlan).toContain("inactive Requester context on every scoped endpoint family");
  });
});
