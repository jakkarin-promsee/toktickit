import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docsDirectory = resolve(process.cwd(), "..", "docs", "lab-03");

function readDocument(name: string): string {
  return readFileSync(resolve(docsDirectory, name), "utf8");
}

function requirementIds(document: string, prefix: "FR" | "BR" | "AC"): string[] {
  return [...document.matchAll(new RegExp(`^- (${prefix}-\\d{2})\\b`, "gm"))].map(([, id]) => id);
}

function expectContinuous(values: string[], prefix: string): void {
  expect(values.length, `${prefix} IDs must exist`).toBeGreaterThan(0);
  expect(new Set(values).size, `${prefix} IDs must be unique`).toBe(values.length);
  expect(values).toEqual(values.map((_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Lab 3 engineering contract", () => {
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
      expect(specification).toMatch(new RegExp(`^## \\d+\\. ${section}$`, "m"));
    }

    expect(readDocument("api-spec.md")).toContain("# Lab 3 REST API Specification");
    expect(readDocument("ui-spec.md")).toContain("# Lab 3 UI Specification");
    expect(readDocument("tests.md")).toContain("# Lab 3 Test Plan");
  });

  it("uses unique, continuous Functional Requirement, Business Rule, and Acceptance Criterion IDs", () => {
    const specification = readDocument("specification.md");

    expectContinuous(requirementIds(specification, "FR"), "FR");
    expectContinuous(requirementIds(specification, "BR"), "BR");
    expectContinuous(requirementIds(specification, "AC"), "AC");
  });

  it("defines every required REST capability with exact endpoint headings", () => {
    const api = readDocument("api-spec.md");

    for (const endpoint of [
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "GET /api/auth/me",
      "POST /api/auth/change-password",
      "GET /api/categories",
      "GET /api/related-systems",
      "POST /api/tickets",
      "GET /api/tickets",
      "GET /api/tickets/:ticketId",
      "POST /api/tickets/:ticketId/problem-appears-resolved",
      "POST /api/tickets/:ticketId/attachments",
      "GET /api/tickets/:ticketId/attachments",
      "GET /api/attachments/:attachmentId/download",
      "DELETE /api/attachments/:attachmentId",
      "GET /api/tickets/:ticketId/comments",
      "POST /api/tickets/:ticketId/comments",
      "GET /api/staff/tickets",
      "GET /api/staff/tickets/:ticketId",
      "GET /api/staff/assignees",
      "POST /api/staff/tickets/:ticketId/claim",
      "PATCH /api/staff/tickets/:ticketId/owner",
      "PATCH /api/staff/tickets/:ticketId/it-priority",
      "PATCH /api/staff/tickets/:ticketId/status",
      "GET /api/staff/tickets/:ticketId/internal-notes",
      "POST /api/staff/tickets/:ticketId/internal-notes",
      "GET /api/admin/users",
      "POST /api/admin/users",
      "PATCH /api/admin/users/:userId",
      "POST /api/admin/users/:userId/initial-password",
    ]) {
      expect(api).toMatch(new RegExp(`^### ${escapeRegExp(endpoint)}$`, "m"));
    }

    for (const contractTerm of ["HttpOnly", "SameSite=Lax", "X-CSRF-Token", "401", "403", "404", "409", "422", "429", "500", "503"]) {
      expect(api).toContain(contractTerm);
    }
  });

  it("locks down authorization, workflow, migration, and content decisions", () => {
    const specification = readDocument("specification.md");

    for (const requiredStatus of ["New", "Open", "In Progress", "Waiting for Requester", "Resolved", "Closed", "Reopened", "Cancelled"]) {
      expect(specification).toContain(requiredStatus);
    }

    for (const decision of [
      "Argon2id",
      "eight hours",
      "Administrator read-only",
      "frontend visibility is not authorization",
      "1–2,000",
      "Problem Appears Resolved",
      "last active Administrator",
      "Development Requester",
      "idempotent",
      "Attachments",
    ]) {
      expect(specification).toMatch(new RegExp(decision, "i"));
    }

    expect(specification).toMatch(/Administrator[^\n]+shall not[^\n]+claim/i);
    expect(specification).toMatch(/Requester[^\n]+cannot[^\n]+Resolved[^\n]+Closed/i);
  });

  it("plans every required test category and maps every acceptance criterion", () => {
    const specification = readDocument("specification.md");
    const testPlan = readDocument("tests.md");

    for (const acceptanceId of requirementIds(specification, "AC")) {
      expect(testPlan, `${acceptanceId} needs an explicit traceability row`).toMatch(new RegExp(`^\\| ${acceptanceId} \\| [^|]+ \\|$`, "m"));
    }

    for (const type of ["Contract", "Unit", "Schema / migration", "API / integration", "UI component", "UI style", "Responsive", "Security / authorization", "Regression", "Accessibility", "Visual", "E2E"]) {
      expect(testPlan).toMatch(new RegExp(`\\| [^|]+ \\| ${escapeRegExp(type)} \\|`));
    }

    for (const administratorCase of ["duplicate email", "self-deactivation", "last active Administrator", "initial password", "non-Administrator"]) {
      expect(testPlan).toMatch(new RegExp(administratorCase, "i"));
    }
  });

  it("records review gates and an end-to-end traceability example", () => {
    const specification = readDocument("specification.md");
    const tests = readDocument("tests.md");

    expect(specification).toContain("Reviewer checklist");
    expect(specification).toContain("must not report Sprint 3 complete");
    expect(tests).toMatch(/FR-\d{2}.*BR-\d{2}.*AC-\d{2}.*(?:DOC|UNIT|DB|API|SEC|UI|STYLE|RESP|A11Y|VISUAL|E2E)-\d{2}/s);
  });
});
