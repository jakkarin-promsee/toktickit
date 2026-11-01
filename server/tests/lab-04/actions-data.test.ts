import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { ACTION_SEEDS, TICKET_SEEDS } from "../../prisma/seed-data.js";
import { seedDatabase } from "../../prisma/seed-database.js";

const prisma = getPrisma();

afterAll(async () => { await prisma.$disconnect(); });

describe("Actions Taken migration and repeatable seed", () => {
  it("keeps legacy zero-action Tickets and prior Lab 3 relationships readable", async () => {
    const zero = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: TICKET_SEEDS[0].ticketNumber }, include: { submittedBy: true, category: true, relatedSystem: true, attachments: true, publicComments: true, internalNotes: true, actions: true } });
    expect(zero.actions).toEqual([]);
    expect(zero.submittedBy.email).toBe("anan@example.test");
    expect(zero.category.name).toBeTruthy();
    expect(zero.relatedSystem.name).toBeTruthy();
    expect(await prisma.ticket.count()).toBeGreaterThanOrEqual(TICKET_SEEDS.length);
    expect(await prisma.publicComment.count()).toBeGreaterThanOrEqual(3);
    expect(await prisma.internalNote.count()).toBeGreaterThanOrEqual(2);
  });

  it("reruns the seed without duplicating Actions or resetting an edited fixture", async () => {
    const before = await prisma.actionTaken.count();
    const original = await prisma.actionTaken.findUniqueOrThrow({ where: { id: ACTION_SEEDS[0].id } });
    expect(before).toBeGreaterThanOrEqual(ACTION_SEEDS.length);
    await prisma.actionTaken.update({ where: { id: original.id }, data: { description: "Manually edited work" } });
    await seedDatabase(prisma, { initialPassword: process.env.LAB3_SEED_INITIAL_PASSWORD! });
    await seedDatabase(prisma, { initialPassword: process.env.LAB3_SEED_INITIAL_PASSWORD! });
    expect(await prisma.actionTaken.count()).toBe(before);
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: original.id } })).description).toBe("Manually edited work");
    await prisma.actionTaken.update({ where: { id: original.id }, data: { description: original.description } });
    const multi = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: TICKET_SEEDS[1].ticketNumber }, include: { actions: true } });
    expect(multi.actions).toHaveLength(2);
    expect(new Set(multi.actions.map((action) => action.performedByUserId)).size).toBe(2);
  }, 30_000);

  it("has a guarded, deterministic baseline backfill with a non-destructive recovery path", async () => {
    const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20261031090000_lab4_actions_foundation/migration.sql"), "utf8");
    expect(sql).toContain("ON CONFLICT (\"id\") DO NOTHING");
    expect(sql).toContain("'BASELINE', NULL, NULL");
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM "Ticket"/i);
    const template = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: TICKET_SEEDS[0].ticketNumber } });
    const legacy = await prisma.ticket.create({ data: { ticketNumber: `TKT-${Date.now()}`.slice(0, 19), submittedByUserId: template.submittedByUserId, categoryId: template.categoryId, relatedSystemId: template.relatedSystemId, summary: "Legacy migration test", description: "Existing Lab 3 Ticket", requestedPriority: "LOW", itPriority: "LOW", currentStatus: "WAITING_FOR_REQUESTER" } });
    try {
      const backfill = sql.slice(sql.indexOf('INSERT INTO "TicketWorkflowEvent"'));
      expect(backfill).toContain("ON CONFLICT");
      await prisma.$executeRawUnsafe(backfill);
      await prisma.$executeRawUnsafe(backfill);
      const baseline = await prisma.ticketWorkflowEvent.findMany({ where: { ticketId: legacy.id, type: "BASELINE" } });
      expect(baseline).toHaveLength(1);
      expect(baseline[0].actorId).toBeNull();
      expect(baseline[0].changes).toMatchObject({ currentStatus: { before: null, after: "WAITING_FOR_REQUESTER" } });
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: legacy.id }, include: { actions: true } });
      expect(after.version).toBe(legacy.version);
      expect(after.updatedAt).toEqual(legacy.updatedAt);
      expect(after.actions).toEqual([]);
    } finally {
      await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId: legacy.id } });
      await prisma.ticket.delete({ where: { id: legacy.id } });
    }
  });
});
