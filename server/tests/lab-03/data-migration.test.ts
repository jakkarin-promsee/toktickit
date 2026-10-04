import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "../../prisma/seed-database.js";

const prismaDirectory = resolve(process.cwd(), "prisma");
const schema = readFileSync(resolve(prismaDirectory, "schema.prisma"), "utf8");
const lab1Migration = resolve(prismaDirectory, "migrations", "20260812131716_add_category_model", "migration.sql");
const lab2Migration = resolve(prismaDirectory, "migrations", "20260906074000_lab2_data_foundation", "migration.sql");
const lab3Migration = resolve(prismaDirectory, "migrations", "20261004090000_lab3_user_data_foundation", "migration.sql");
const cleanSchema = "lab3_migration_clean";
const upgradeSchema = "lab3_migration_upgrade";
const prismaCli = resolve(process.cwd(), "node_modules", "prisma", "build", "index.js");
const admin = new PrismaClient();

function databaseUrlFor(schemaName: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("schema", schemaName);
  return url.toString();
}

function prismaFor(schemaName: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: databaseUrlFor(schemaName) } } });
}

function runPrisma(args: string[], schemaName: string): void {
  execFileSync(process.execPath, [prismaCli, ...args], {
    cwd: resolve(process.cwd()),
    env: { ...process.env, DATABASE_URL: databaseUrlFor(schemaName) },
    stdio: "pipe",
  });
}

async function resetSchema(schemaName: string): Promise<void> {
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
}

async function tableNames(client: PrismaClient, schemaName: string): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schemaName}' ORDER BY table_name`,
  );
  return rows.map((row) => row.table_name);
}

beforeAll(async () => {
  await resetSchema(cleanSchema);
  await resetSchema(upgradeSchema);
});

afterAll(async () => {
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${cleanSchema}" CASCADE`);
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${upgradeSchema}" CASCADE`);
  await admin.$disconnect();
});

describe("Issue #31 Lab 3 data migration", () => {
  it("defines the approved User, credential, session, Ticket workflow, Comment, and Note schema", () => {
    for (const expected of [
      "enum UserRole",
      "REQUESTER",
      "IT_STAFF",
      "ADMINISTRATOR",
      "model User",
      "model Credential",
      "model Session",
      "model PublicComment",
      "model InternalNote",
      "submittedByUserId",
      "ownerId",
      "requesterResolvedAt",
      "lastStatusChangedByUserId",
      "lastOwnerChangedByUserId",
      "lastPriorityChangedByUserId",
      "uploadedByUserId",
      "removedByUserId",
      "version",
    ]) {
      expect(schema).toContain(expected);
    }

    expect(schema).not.toContain("model RequesterUser");
    expect(schema).not.toContain("UNASSIGNED");
    expect(schema).toMatch(/passwordHash\s+String\s+@db\.VarChar\(255\)/);
    expect(schema).toMatch(/content\s+String\s+@db\.VarChar\(2000\)/);
    expect(schema).toContain("@@index([ticketId, createdAt, id])");
    expect(schema).toContain("@@index([ownerId, updatedAt, id])");
    expect(schema).toContain("@@index([currentStatus, updatedAt, id])");
  });

  it("applies the complete migration history to a clean database", async () => {
    runPrisma(["migrate", "deploy"], cleanSchema);
    const clean = prismaFor(cleanSchema);
    try {
      expect(await tableNames(clean, cleanSchema)).toEqual(
        expect.arrayContaining([
          "User",
          "Credential",
          "Session",
          "Category",
          "RelatedSystem",
          "Ticket",
          "Attachment",
          "PublicComment",
          "InternalNote",
        ]),
      );

      const enums = await clean.$queryRawUnsafe<Array<{ typname: string; labels: string[] }>>(
        `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = '${cleanSchema}' GROUP BY t.typname`,
      );
      expect(enums.find((entry) => entry.typname === "UserRole")?.labels).toEqual([
        "REQUESTER",
        "IT_STAFF",
        "ADMINISTRATOR",
      ]);
      expect(enums.find((entry) => entry.typname === "TicketStatus")?.labels).toEqual([
        "NEW",
        "OPEN",
        "IN_PROGRESS",
        "WAITING_FOR_REQUESTER",
        "RESOLVED",
        "CLOSED",
        "REOPENED",
        "CANCELLED",
      ]);
      expect(enums.find((entry) => entry.typname === "ItPriority")?.labels).toEqual([
        "LOW",
        "MEDIUM",
        "HIGH",
      ]);

      const indexes = await clean.$queryRawUnsafe<Array<{ indexname: string }>>(
        `SELECT indexname FROM pg_indexes WHERE schemaname = '${cleanSchema}'`,
      );
      expect(indexes.map((entry) => entry.indexname)).toEqual(
        expect.arrayContaining([
          "User_email_key",
          "User_role_isActive_displayName_id_idx",
          "Session_userId_revokedAt_expiresAt_idx",
          "Ticket_submittedByUserId_updatedAt_id_idx",
          "Ticket_ownerId_updatedAt_id_idx",
          "Ticket_currentStatus_updatedAt_id_idx",
          "PublicComment_ticketId_createdAt_id_idx",
          "InternalNote_ticketId_createdAt_id_idx",
        ]),
      );

      const constraints = await clean.$queryRawUnsafe<Array<{ conname: string }>>(
        `SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = '${cleanSchema}'`,
      );
      expect(constraints.map((entry) => entry.conname)).toEqual(
        expect.arrayContaining([
          "User_email_normalized_check",
          "Credential_userId_fkey",
          "Ticket_ownerId_fkey",
          "PublicComment_ticketId_fkey",
          "PublicComment_content_check",
          "InternalNote_ticketId_fkey",
          "InternalNote_content_check",
        ]),
      );

      const triggers = await clean.$queryRawUnsafe<Array<{ trigger_name: string }>>(
        `SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = '${cleanSchema}'`,
      );
      expect(triggers.map((entry) => entry.trigger_name)).toEqual(
        expect.arrayContaining(["Ticket_owner_eligibility_trigger", "User_owner_eligibility_trigger"]),
      );
    } finally {
      await clean.$disconnect();
    }
  }, 30_000);

  it("preserves representative Lab 2 records and backfills credentials during the upgrade", async () => {
    runPrisma(["db", "execute", "--file", lab1Migration], upgradeSchema);
    runPrisma(["db", "execute", "--file", lab2Migration], upgradeSchema);
    const upgrade = prismaFor(upgradeSchema);
    const ticketId = "11111111-1111-4111-8111-111111111111";
    const attachmentId = "22222222-2222-4222-8222-222222222222";
    const initialPassword = `Migration-${crypto.randomBytes(12).toString("hex")}!Aa1`;

    try {
      await upgrade.$executeRawUnsafe(`INSERT INTO "Category" ("id", "name", "isActive", "createdAt", "updatedAt") VALUES (41, 'Legacy Hardware', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
      await upgrade.$executeRawUnsafe(`INSERT INTO "RelatedSystem" ("id", "name", "isActive", "createdAt", "updatedAt") VALUES (51, 'Legacy Laptop', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
      await upgrade.$executeRawUnsafe(`INSERT INTO "RequesterUser" ("id", "email", "displayName", "isActive", "createdAt", "updatedAt") VALUES (101, ' Legacy.Requester@Example.Test ', 'Legacy Requester', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), (102, 'legacy.remover@example.test', 'Legacy Remover', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
      await upgrade.$executeRawUnsafe(`INSERT INTO "Ticket" ("id", "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "summary", "description", "requestedPriority", "itPriority", "currentStatus", "createdAt", "updatedAt") VALUES ('${ticketId}', 'TKT-20260906-900001', 101, 41, 51, 'Legacy ticket', 'Legacy ticket description', 'HIGH', 'UNASSIGNED', 'NEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
      await upgrade.$executeRawUnsafe(`INSERT INTO "Attachment" ("id", "ticketId", "originalName", "storageName", "mimeType", "sizeBytes", "sha256", "uploadedByRequesterId", "createdAt", "removedAt", "removedByRequesterId", "removalReason") VALUES ('${attachmentId}', '${ticketId}', 'legacy.pdf', 'legacy-storage.pdf', 'application/pdf', 12, '${"a".repeat(64)}', 101, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 102, 'Legacy removal reason')`);

      const before = {
        categories: await upgrade.$queryRawUnsafe<Array<{ id: number; name: string }>>(`SELECT "id", "name" FROM "Category" ORDER BY "id"`),
        relatedSystems: await upgrade.$queryRawUnsafe<Array<{ id: number; name: string }>>(`SELECT "id", "name" FROM "RelatedSystem" ORDER BY "id"`),
        users: await upgrade.$queryRawUnsafe<Array<{ id: number; email: string }>>(`SELECT "id", "email" FROM "RequesterUser" ORDER BY "id"`),
        tickets: await upgrade.$queryRawUnsafe<Array<{ id: string; ticketNumber: string; requesterId: number }>>(`SELECT "id"::text, "ticketNumber", "requesterId" FROM "Ticket"`),
        attachments: await upgrade.$queryRawUnsafe<Array<{ id: string; ticketId: string; storageName: string; uploadedByRequesterId: number; removedAt: Date | null; removedByRequesterId: number | null; removalReason: string | null }>>(`SELECT "id"::text, "ticketId"::text, "storageName", "uploadedByRequesterId", "removedAt", "removedByRequesterId", "removalReason" FROM "Attachment"`),
      };

      runPrisma(["db", "execute", "--file", lab3Migration], upgradeSchema);

      const migratedUsers = await upgrade.$queryRawUnsafe<Array<{ id: number; email: string; role: string; mustChangePassword: boolean }>>(`SELECT "id", "email", "role"::text, "mustChangePassword" FROM "User" WHERE "id" IN (101, 102) ORDER BY "id"`);
      const migratedTickets = await upgrade.$queryRawUnsafe<Array<{ id: string; ticketNumber: string; submittedByUserId: number; requestedPriority: string; itPriority: string; currentStatus: string; ownerId: number | null; version: number }>>(`SELECT "id"::text, "ticketNumber", "submittedByUserId", "requestedPriority"::text, "itPriority"::text, "currentStatus"::text, "ownerId", "version" FROM "Ticket" WHERE "id" = '${ticketId}'`);
      const migratedAttachments = await upgrade.$queryRawUnsafe<Array<{ id: string; ticketId: string; storageName: string; uploadedByUserId: number; removedAt: Date | null; removedByUserId: number | null; removalReason: string | null }>>(`SELECT "id"::text, "ticketId"::text, "storageName", "uploadedByUserId", "removedAt", "removedByUserId", "removalReason" FROM "Attachment" WHERE "id" = '${attachmentId}'`);

      expect(await upgrade.$queryRawUnsafe(`SELECT "id", "name" FROM "Category" ORDER BY "id"`)).toEqual(before.categories);
      expect(await upgrade.$queryRawUnsafe(`SELECT "id", "name" FROM "RelatedSystem" ORDER BY "id"`)).toEqual(before.relatedSystems);

      expect(migratedUsers).toEqual([
        { id: before.users[0].id, email: "legacy.requester@example.test", role: "REQUESTER", mustChangePassword: true },
        { id: before.users[1].id, email: "legacy.remover@example.test", role: "REQUESTER", mustChangePassword: true },
      ]);
      expect(migratedTickets).toEqual([
        {
          id: before.tickets[0].id,
          ticketNumber: before.tickets[0].ticketNumber,
          submittedByUserId: before.tickets[0].requesterId,
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          currentStatus: "NEW",
          ownerId: null,
          version: 0,
        },
      ]);
      expect(migratedAttachments).toEqual([
        {
          id: before.attachments[0].id,
          ticketId: before.attachments[0].ticketId,
          storageName: before.attachments[0].storageName,
          uploadedByUserId: before.attachments[0].uploadedByRequesterId,
          removedAt: before.attachments[0].removedAt,
          removedByUserId: before.attachments[0].removedByRequesterId,
          removalReason: before.attachments[0].removalReason,
        },
      ]);

      await seedDatabase(upgrade, { initialPassword });
      const credentials = await upgrade.$queryRawUnsafe<Array<{ userId: number; passwordHash: string }>>(`SELECT "userId", "passwordHash" FROM "Credential" WHERE "userId" IN (101, 102) ORDER BY "userId"`);
      expect(credentials).toHaveLength(2);
      expect(credentials.every((entry) => entry.passwordHash.startsWith("$argon2id$"))).toBe(true);
      expect(credentials.every((entry) => entry.passwordHash !== initialPassword)).toBe(true);
    } finally {
      await upgrade.$disconnect();
    }
  }, 30_000);

  it("enforces normalized email, eligible Ticket owners, and immutable message relationships", async () => {
    const database = new PrismaClient();
    const suffix = crypto.randomUUID();
    const requester = await database.user.findFirstOrThrow({ where: { role: "REQUESTER", isActive: true } });
    const staff = await database.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true } });
    const ticket = await database.ticket.findFirstOrThrow({ where: { ownerId: null } });

    try {
      await expect(
        database.user.create({ data: { email: requester.email, displayName: "Duplicate Email", role: "REQUESTER" } }),
      ).rejects.toThrow();

      await expect(
        database.$executeRawUnsafe(`INSERT INTO "User" ("email", "displayName", "role", "isActive", "mustChangePassword", "version", "createdAt", "updatedAt") VALUES ('Upper.${suffix}@Example.Test', 'Upper Email', 'REQUESTER', true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`),
      ).rejects.toThrow();

      await expect(
        database.$executeRawUnsafe(`INSERT INTO "User" ("email", "displayName", "isActive", "mustChangePassword", "version", "createdAt", "updatedAt") VALUES ('missing-role-${suffix}@example.test', 'Missing Role', true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`),
      ).rejects.toThrow();

      await expect(
        database.$executeRawUnsafe(`INSERT INTO "User" ("email", "displayName", "role", "isActive", "mustChangePassword", "version", "createdAt", "updatedAt") VALUES ('invalid-role-${suffix}@example.test', 'Invalid Role', 'INVALID_ROLE', true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`),
      ).rejects.toThrow();

      await expect(database.ticket.update({ where: { id: ticket.id }, data: { ownerId: requester.id } })).rejects.toThrow();
      await database.ticket.update({ where: { id: ticket.id }, data: { ownerId: staff.id } });
      await expect(database.user.update({ where: { id: staff.id }, data: { isActive: false } })).rejects.toThrow();

      await expect(
        database.$executeRawUnsafe(`INSERT INTO "PublicComment" ("id", "ticketId", "authorId", "content") VALUES ('${crypto.randomUUID()}', '${ticket.id}', ${requester.id}, '   ')`),
      ).rejects.toThrow();

      await expect(
        database.$executeRawUnsafe(`INSERT INTO "PublicComment" ("id", "ticketId", "authorId", "content") VALUES ('${crypto.randomUUID()}', '${crypto.randomUUID()}', ${requester.id}, 'Missing Ticket')`),
      ).rejects.toThrow();

      const noteId = crypto.randomUUID();
      await database.$executeRawUnsafe(`INSERT INTO "InternalNote" ("id", "ticketId", "authorId", "content") VALUES ('${noteId}', '${ticket.id}', ${staff.id}, 'Foundation constraint check')`);
      const note = await database.internalNote.findUniqueOrThrow({ where: { id: noteId } });
      expect(note.createdAt).toBeInstanceOf(Date);
      await database.internalNote.delete({ where: { id: noteId } });
    } finally {
      await database.ticket.update({ where: { id: ticket.id }, data: { ownerId: null } });
      await database.$disconnect();
    }
  });
});
