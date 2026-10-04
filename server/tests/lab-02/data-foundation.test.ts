import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_SEEDS,
  RELATED_SYSTEM_SEEDS,
  REQUESTER_SEEDS,
} from "../../prisma/seed-data.js";

const prismaDir = resolve(process.cwd(), "prisma");
const schema = readFileSync(resolve(prismaDir, "schema.prisma"), "utf8");

describe("Issue #11 Prisma data contract", () => {
  it("retains the Lab 2 models, enums, defaults, and soft-removal fields after the Lab 3 evolution", () => {
    for (const model of [
      "User",
      "Category",
      "RelatedSystem",
      "Ticket",
      "Attachment",
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }

    for (const enumName of [
      "RequestedPriority",
      "ItPriority",
      "TicketStatus",
    ]) {
      expect(schema).toContain(`enum ${enumName} {`);
    }

    expect(schema).toMatch(/ticketNumber\s+String\s+@unique/);
    expect(schema).toMatch(/currentStatus\s+TicketStatus\s+@default\(NEW\)/);
    expect(schema).toMatch(/itPriority\s+ItPriority/);
    expect(schema).toMatch(/submittedByUserId\s+Int/);
    expect(schema).toMatch(/removedAt\s+DateTime\?/);
    expect(schema).toMatch(/removedByUserId\s+Int\?/);
    expect(schema).toMatch(/removalReason\s+String\?/);
    expect(schema.match(/onDelete:\s*Restrict/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("defines uniqueness and indexes used by ownership, filtering, sorting, and soft removal", () => {
    expect(schema).toMatch(/email\s+String\s+@unique/);
    expect(schema).toMatch(/storageName\s+String\s+@unique/);
    expect(schema).toContain("@@index([submittedByUserId, updatedAt, id])");
    expect(schema).toContain("@@index([submittedByUserId, categoryId])");
    expect(schema).toContain("@@index([submittedByUserId, relatedSystemId])");
    expect(schema).toContain("@@index([submittedByUserId, currentStatus])");
    expect(schema).toContain("@@index([submittedByUserId, requestedPriority])");
    expect(schema).toContain("@@index([ticketId, removedAt])");
  });

  it("has a reviewable Lab 2 migration with foreign keys and removal consistency", () => {
    const migrationDirectory = readdirSync(
      resolve(prismaDir, "migrations"),
    ).find((entry) => entry.endsWith("_lab2_data_foundation"));

    expect(migrationDirectory).toBeDefined();

    const sql = readFileSync(
      resolve(prismaDir, "migrations", migrationDirectory!, "migration.sql"),
      "utf8",
    );

    expect(sql).toContain('CREATE TABLE "RequesterUser"');
    expect(sql).toContain('CREATE TABLE "RelatedSystem"');
    expect(sql).toContain('CREATE TABLE "Ticket"');
    expect(sql).toContain('CREATE TABLE "Attachment"');
    expect(sql.match(/ON DELETE RESTRICT/g)).toHaveLength(6);
    expect(sql).toContain("Attachment_removal_metadata_check");
  });
});

describe("Issue #11 seed contract", () => {
  it("contains the fixed categories, realistic systems, and active/inactive requesters", () => {
    expect(CATEGORY_SEEDS.map(({ name }) => name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
    expect(RELATED_SYSTEM_SEEDS.length).toBeGreaterThanOrEqual(6);
    expect(
      REQUESTER_SEEDS.filter(({ isActive }) => isActive).length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      REQUESTER_SEEDS.filter(({ isActive }) => !isActive).length,
    ).toBeGreaterThanOrEqual(1);

    expect(new Set(CATEGORY_SEEDS.map(({ name }) => name)).size).toBe(
      CATEGORY_SEEDS.length,
    );
    expect(new Set(RELATED_SYSTEM_SEEDS.map(({ name }) => name)).size).toBe(
      RELATED_SYSTEM_SEEDS.length,
    );
    expect(new Set(REQUESTER_SEEDS.map(({ email }) => email)).size).toBe(
      REQUESTER_SEEDS.length,
    );
  });

  it("keeps stable unique keys for reference data and requester-compatible users", () => {
    expect(CATEGORY_SEEDS).toContainEqual(expect.objectContaining({ name: "Account and Access" }));
    expect(REQUESTER_SEEDS[0]).toEqual(expect.objectContaining({ email: expect.any(String), role: "REQUESTER" }));
  });
});
