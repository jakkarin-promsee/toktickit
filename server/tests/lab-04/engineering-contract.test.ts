import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const spec = readFileSync(resolve(root, "docs/lab-04/specification.md"), "utf8");
const plan = readFileSync(resolve(root, "docs/lab-04/tests.md"), "utf8");
const api = readFileSync(resolve(root, "docs/lab-04/api-spec.md"), "utf8");
const ui = readFileSync(resolve(root, "docs/lab-04/ui-spec.md"), "utf8");

function numberedIds(prefix: string, content: string) {
  return [...new Set([...content.matchAll(new RegExp(`\\b${prefix}-(\\d{2})\\b`, "g"))].map((match) => Number(match[1])))].sort((a, b) => a - b);
}

describe("Lab 4 engineering contract traceability", () => {
  it("keeps the numbered FR, BR, and AC sequences continuous", () => {
    for (const prefix of ["FR", "BR", "AC"]) {
      const ids = numberedIds(prefix, spec);
      expect(ids.length, prefix).toBeGreaterThan(0);
      expect(ids, prefix).toEqual(Array.from({ length: ids.at(-1)! }, (_, index) => index + 1));
    }
  });

  it("records eight Ticket and four Action statuses with complete transition tables", () => {
    const ticketRows = spec.split("### Complete Ticket status-transition matrix")[1].split("### Complete Action Taken status-transition matrix")[0];
    for (const status of ["New", "Open", "In Progress", "Waiting for Requester", "Resolved", "Closed", "Reopened", "Cancelled"]) expect(ticketRows).toContain(`| ${status} |`);
    const actionRows = spec.split("### Complete Action Taken status-transition matrix")[1].split("## 6.")[0];
    for (const status of ["Planned", "In Progress", "Completed", "Cancelled"]) expect(actionRows).toContain(`| ${status} |`);
    expect(api).toContain("RESOLUTION_ACTION_REQUIRED");
    expect(ui).toContain("200% zoom");
  });

  it("maps every AC to executed test IDs and existing test paths", () => {
    for (const id of numberedIds("AC", spec)) expect(plan).toMatch(new RegExp(`\\| AC-${String(id).padStart(2, "0")} \\|`));
    const rows = plan.split("## 2. Executed test matrix")[1].split("## 3.")[0].split("\n").filter((line) => /^\| (?:UNIT|API|DATA|UI|STYLE|RESP|A11Y|E2E|HEALTH|PERF|REG|DOC)-\d{2} \|/.test(line));
    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      expect(row).not.toMatch(/\| Planned \|/);
      const paths = row.match(/(?:server|client|e2e)\/[A-Za-z0-9./-]+\.(?:test\.tsx?|spec\.ts)/g) ?? [];
      expect(paths.length, row).toBeGreaterThan(0);
      for (const path of paths) expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });
});
