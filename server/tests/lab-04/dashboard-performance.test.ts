import { randomUUID } from "node:crypto";
import { cpus, platform } from "node:os";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";

// Run explicitly with LAB4_PERF_SMOKE=1. The normal server suite stays fast and deterministic.
it.runIf(process.env.LAB4_PERF_SMOKE === "1")("serves bounded dashboards below the local 2 s p95 smoke threshold with 1,000 Tickets and 5,000 Actions", async () => {
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema");
  if (!schema || schema === "public") throw new Error("Performance smoke requires an isolated test schema.");
  const prisma = getPrisma();
  const prefix = "TKT-20991231-";
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: "anan@example.test" } });
  const staff = await prisma.user.findUniqueOrThrow({ where: { email: "narin.staff@example.test" } });
  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();
  const ids: string[] = [];
  try {
    await prisma.ticket.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({ id: randomUUID(), ticketNumber: `${prefix}${String(index).padStart(6, "0")}`, submittedByUserId: requester.id, categoryId: category.id, relatedSystemId: system.id, ownerId: index % 3 ? staff.id : null, summary: `Performance fixture ${index}`, description: "Isolated synthetic dashboard load fixture", requestedPriority: "MEDIUM" as const, itPriority: (index % 4 === 0 ? "HIGH" : "MEDIUM") as "HIGH" | "MEDIUM", currentStatus: (index % 5 === 0 ? "RESOLVED" : index % 2 === 0 ? "OPEN" : "IN_PROGRESS") as "RESOLVED" | "OPEN" | "IN_PROGRESS" })) });
    ids.push(...(await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: prefix } }, select: { id: true } })).map((ticket) => ticket.id));
    expect(ids).toHaveLength(1000);
    for (let offset = 0; offset < ids.length; offset += 100) {
      await prisma.actionTaken.createMany({ data: ids.slice(offset, offset + 100).flatMap((ticketId, ticketIndex) => Array.from({ length: 5 }, (_, actionIndex) => ({ id: randomUUID(), ticketId, actionAt: new Date(), description: `Performance action ${offset + ticketIndex}-${actionIndex}`, result: "Checked", status: (actionIndex % 2 ? "IN_PROGRESS" : "PLANNED") as "IN_PROGRESS" | "PLANNED", createdByUserId: staff.id, performedByUserId: staff.id, assigneeId: staff.id, followUpRequired: false }))) });
    }
    expect(await prisma.actionTaken.count({ where: { ticketId: { in: ids } } })).toBe(5000);
    await prisma.user.update({ where: { id: requester.id }, data: { mustChangePassword: false } });
    await prisma.user.update({ where: { id: staff.id }, data: { mustChangePassword: false } });
    for (const user of [requester, staff]) await prisma.credential.update({ where: { userId: user.id }, data: { passwordHash: await hashPassword(process.env.LAB3_SEED_INITIAL_PASSWORD!) } });
    const timings: Record<string, number[]> = {};
    for (const [label, email, path] of [["requester", requester.email, "/api/dashboard/requester"], ["staff", staff.email, "/api/dashboard/staff"]] as const) {
      const agent = request.agent(app);
      const login = await agent.post("/api/auth/login").set("Origin", "http://localhost:5173").send({ email, password: process.env.LAB3_SEED_INITIAL_PASSWORD });
      expect(login.status).toBe(200);
      const values: number[] = [];
      for (let index = 0; index < 30; index += 1) {
        const start = performance.now();
        const response = await agent.get(path);
        values.push(performance.now() - start);
        expect(response.status).toBe(200);
        expect(response.body.data.recentTickets.length).toBeLessThanOrEqual(5);
        if (label === "staff") { expect(response.body.data.urgentTickets.length).toBeLessThanOrEqual(5); expect(response.body.data.myActions.length).toBeLessThanOrEqual(5); }
      }
      timings[label] = values;
    }
    const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
    const result = { dataset: { tickets: ids.length, actions: 5000 }, environment: { node: process.version, platform: platform(), cpu: cpus()[0]?.model ?? "unknown", schema }, requestsPerEndpoint: 30, requesterP95Ms: Math.round(p95(timings.requester)), staffP95Ms: Math.round(p95(timings.staff)) };
    console.info(`LAB4_PERF_SMOKE ${JSON.stringify(result)}`);
    expect(p95(timings.requester)).toBeLessThan(2000);
    expect(p95(timings.staff)).toBeLessThan(2000);
  } finally {
    if (ids.length) { await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ids } } }); await prisma.ticket.deleteMany({ where: { id: { in: ids } } }); }
    await prisma.user.updateMany({ where: { id: { in: [requester.id, staff.id] } }, data: { mustChangePassword: true } });
    await prisma.$disconnect();
  }
}, 240_000);
