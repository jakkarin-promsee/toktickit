import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { seedDatabase } from "../../prisma/seed-database.js";
import {
  INTERNAL_NOTE_SEEDS,
  PUBLIC_COMMENT_SEEDS,
  TICKET_SEEDS,
  USER_SEEDS,
} from "../../prisma/seed-data.js";

const prisma = new PrismaClient();

type Counts = {
  users: number;
  credentials: number;
  tickets: number;
  comments: number;
  notes: number;
};

async function counts(): Promise<Counts> {
  const [users, credentials, tickets, comments, notes] = await Promise.all([
    prisma.user.count(),
    prisma.credential.count(),
    prisma.ticket.count(),
    prisma.publicComment.count(),
    prisma.internalNote.count(),
  ]);
  return { users, credentials, tickets, comments, notes };
}

describe("Issue #31 idempotent Lab 3 seed", () => {
  it("creates the required role, activation, workflow, priority, and ownership distribution exactly once", async () => {
    const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD;
    expect(initialPassword, "global test setup must provide a generated initial password").toBeTruthy();

    await seedDatabase(prisma, { initialPassword: initialPassword! });
    const firstCounts = await counts();
    const firstUsers = await prisma.user.findMany({
      where: { email: { in: USER_SEEDS.map((entry) => entry.email) } },
      include: { credential: true },
      orderBy: { email: "asc" },
    });
    const firstHashes = new Map(firstUsers.map((user) => [user.id, user.credential?.passwordHash]));

    await seedDatabase(prisma, { initialPassword: initialPassword! });

    expect(await counts()).toEqual(firstCounts);
    expect(await prisma.user.count({ where: { role: "REQUESTER", isActive: true } })).toBeGreaterThanOrEqual(4);
    expect(await prisma.user.count({ where: { role: "REQUESTER", isActive: false } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.count({ where: { role: "IT_STAFF", isActive: true } })).toBeGreaterThanOrEqual(3);
    expect(await prisma.user.count({ where: { role: "IT_STAFF", isActive: false } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBeGreaterThanOrEqual(1);

    expect(await prisma.ticket.count({ where: { ownerId: null } })).toBeGreaterThan(0);
    expect(await prisma.ticket.count({ where: { ownerId: { not: null } } })).toBeGreaterThan(0);
    expect(new Set((await prisma.ticket.findMany({ select: { submittedByUserId: true } })).map((ticket) => ticket.submittedByUserId)).size).toBeGreaterThan(1);
    expect(new Set((await prisma.ticket.findMany({ select: { currentStatus: true } })).map((ticket) => ticket.currentStatus)).size).toBeGreaterThan(3);
    expect(new Set((await prisma.ticket.findMany({ select: { requestedPriority: true } })).map((ticket) => ticket.requestedPriority)).size).toBe(3);
    expect(new Set((await prisma.ticket.findMany({ select: { itPriority: true } })).map((ticket) => ticket.itPriority)).size).toBe(3);

    expect(await prisma.ticket.count({ where: { ticketNumber: { in: TICKET_SEEDS.map((entry) => entry.ticketNumber) } } })).toBe(TICKET_SEEDS.length);
    expect(await prisma.publicComment.count({ where: { id: { in: PUBLIC_COMMENT_SEEDS.map((entry) => entry.id) } } })).toBe(PUBLIC_COMMENT_SEEDS.length);
    expect(await prisma.internalNote.count({ where: { id: { in: INTERNAL_NOTE_SEEDS.map((entry) => entry.id) } } })).toBe(INTERNAL_NOTE_SEEDS.length);

    const secondUsers = await prisma.user.findMany({
      where: { email: { in: USER_SEEDS.map((entry) => entry.email) } },
      include: { credential: true },
    });
    for (const user of secondUsers) {
      expect(user.mustChangePassword).toBe(true);
      expect(user.credential?.passwordHash).toBe(firstHashes.get(user.id));
      expect(user.credential?.passwordHash).not.toBe(initialPassword);
      expect(user.credential?.passwordHash.startsWith("$argon2id$")).toBe(true);
      await expect(argon2.verify(user.credential!.passwordHash, initialPassword!)).resolves.toBe(true);
    }
  }, 30_000);

  it("keeps seed content non-sensitive and documents environment-supplied local credentials", () => {
    for (const entry of [...PUBLIC_COMMENT_SEEDS, ...INTERNAL_NOTE_SEEDS]) {
      expect(entry.content).not.toMatch(/password|secret|token|credential|private key/i);
    }

    const seedSource = readFileSync(resolve(process.cwd(), "prisma", "seed-data.ts"), "utf8");
    const credentialDocumentation = readFileSync(resolve(process.cwd(), "..", "docs", "lab-03", "seed-credentials.md"), "utf8");
    expect(seedSource).not.toMatch(/initialPassword\s*:/);
    expect(seedSource).not.toMatch(/passwordHash\s*:/);
    expect(credentialDocumentation).toContain("LAB3_SEED_INITIAL_PASSWORD");
    expect(credentialDocumentation).toContain("local development only");
    expect(credentialDocumentation).not.toMatch(/LAB3_SEED_INITIAL_PASSWORD\s*=\s*["'][^"']+["']/);
  });
});
