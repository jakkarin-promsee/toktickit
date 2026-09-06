import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CATEGORY_SEEDS,
  RELATED_SYSTEM_SEEDS,
  REQUESTER_SEEDS,
} from "../../prisma/seed-data.js";
import { seedDatabase } from "../../prisma/seed-database.js";

const prismaDir = resolve(process.cwd(), "prisma");
const schema = readFileSync(resolve(prismaDir, "schema.prisma"), "utf8");

describe("Issue #11 Prisma data contract", () => {
  it("defines the required models, enums, relationships, defaults, and soft removal", () => {
    for (const model of [
      "RequesterUser",
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
    expect(schema).toMatch(/itPriority\s+ItPriority\s+@default\(UNASSIGNED\)/);
    expect(schema).toMatch(/removedAt\s+DateTime\?/);
    expect(schema).toMatch(/removedByRequesterId\s+Int\?/);
    expect(schema).toMatch(/removalReason\s+String\?/);
    expect(schema.match(/onDelete:\s*Restrict/g)).toHaveLength(6);
  });

  it("defines uniqueness and indexes used by ownership, filtering, sorting, and soft removal", () => {
    expect(schema).toMatch(/email\s+String\s+@unique/);
    expect(schema).toMatch(/storageName\s+String\s+@unique/);
    expect(schema).toContain("@@index([requesterId, updatedAt, id])");
    expect(schema).toContain("@@index([requesterId, categoryId])");
    expect(schema).toContain("@@index([requesterId, relatedSystemId])");
    expect(schema).toContain("@@index([requesterId, currentStatus])");
    expect(schema).toContain("@@index([requesterId, requestedPriority])");
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

  it("uses stable unique upsert keys and remains duplicate-safe when run twice", async () => {
    const categoryUpsert = vi.fn().mockResolvedValue({});
    const relatedSystemUpsert = vi.fn().mockResolvedValue({});
    const requesterUserUpsert = vi.fn().mockResolvedValue({});
    const prisma = {
      category: { upsert: categoryUpsert },
      relatedSystem: { upsert: relatedSystemUpsert },
      requesterUser: { upsert: requesterUserUpsert },
    } as unknown as Parameters<typeof seedDatabase>[0];

    await seedDatabase(prisma);
    await seedDatabase(prisma);

    expect(categoryUpsert).toHaveBeenCalledTimes(CATEGORY_SEEDS.length * 2);
    expect(relatedSystemUpsert).toHaveBeenCalledTimes(
      RELATED_SYSTEM_SEEDS.length * 2,
    );
    expect(requesterUserUpsert).toHaveBeenCalledTimes(
      REQUESTER_SEEDS.length * 2,
    );
    expect(categoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "Account and Access" } }),
    );
    expect(requesterUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: REQUESTER_SEEDS[0].email } }),
    );
  });
});
