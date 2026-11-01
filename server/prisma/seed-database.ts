import type { PrismaClient } from "@prisma/client";
import { hashPassword, passwordPolicyError } from "../src/password.js";
import {
  ACTION_SEEDS,
  CATEGORY_SEEDS,
  INTERNAL_NOTE_SEEDS,
  PUBLIC_COMMENT_SEEDS,
  RELATED_SYSTEM_SEEDS,
  TICKET_SEEDS,
  USER_SEEDS,
} from "./seed-data.js";

export type SeedOptions = {
  initialPassword: string;
};

export async function seedDatabase(prisma: PrismaClient, options: SeedOptions): Promise<void> {
  const passwordError = passwordPolicyError(options.initialPassword);
  if (passwordError) throw new Error(`LAB3_SEED_INITIAL_PASSWORD is invalid: ${passwordError}`);

  for (const category of CATEGORY_SEEDS) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  for (const relatedSystem of RELATED_SYSTEM_SEEDS) {
    await prisma.relatedSystem.upsert({
      where: { name: relatedSystem.name },
      update: {},
      create: relatedSystem,
    });
  }

  for (const user of USER_SEEDS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        mustChangePassword: true,
      },
    });
  }

  const usersWithoutCredentials = await prisma.user.findMany({
    where: { credential: null },
    select: { id: true },
  });
  for (const user of usersWithoutCredentials) {
    const passwordHash = await hashPassword(options.initialPassword);
    await prisma.credential.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, passwordHash },
    });
  }

  for (const ticket of TICKET_SEEDS) {
    const shared = {
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      currentStatus: ticket.currentStatus,
      submittedBy: { connect: { email: ticket.submittedByEmail } },
      category: { connect: { name: ticket.categoryName } },
      relatedSystem: { connect: { name: ticket.relatedSystemName } },
    };
    await prisma.ticket.upsert({
      where: { ticketNumber: ticket.ticketNumber },
      update: {},
      create: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ...shared,
        ...(ticket.ownerEmail
          ? { owner: { connect: { email: ticket.ownerEmail } } }
          : {}),
      },
    });
  }

  for (const comment of PUBLIC_COMMENT_SEEDS) {
    await prisma.publicComment.upsert({
      where: { id: comment.id },
      update: {},
      create: {
        id: comment.id,
        content: comment.content,
        ticket: { connect: { ticketNumber: comment.ticketNumber } },
        author: { connect: { email: comment.authorEmail } },
      },
    });
  }

  for (const note of INTERNAL_NOTE_SEEDS) {
    await prisma.internalNote.upsert({
      where: { id: note.id },
      update: {},
      create: {
        id: note.id,
        content: note.content,
        ticket: { connect: { ticketNumber: note.ticketNumber } },
        author: { connect: { email: note.authorEmail } },
      },
    });
  }

  // Lab 3 upgrade tests invoke this shared seed before the Lab 4 migration exists.
  const [actionTable] = await prisma.$queryRaw<{ name: string | null }[]>`SELECT to_regclass('"ActionTaken"')::text AS name`;
  if (!actionTable?.name) return;

  for (const fixture of ACTION_SEEDS) {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: fixture.ticketNumber } });
    const performer = await prisma.user.findUniqueOrThrow({ where: { email: fixture.performerEmail } });
    const assignee = fixture.assigneeEmail ? await prisma.user.findUniqueOrThrow({ where: { email: fixture.assigneeEmail } }) : null;
    const actionAt = new Date(ticket.createdAt.getTime() + 60_000);
    const completed = fixture.status === "COMPLETED";
    const cancelled = fixture.status === "CANCELLED";
    await prisma.actionTaken.upsert({
      where: { id: fixture.id },
      update: {},
      create: {
        id: fixture.id,
        ticketId: ticket.id,
        actionAt,
        description: fixture.description,
        result: fixture.result,
        status: fixture.status,
        createdByUserId: performer.id,
        performedByUserId: performer.id,
        assigneeId: assignee?.id ?? null,
        followUpRequired: fixture.followUpRequired,
        followUpNote: fixture.followUpNote,
        completedAt: completed ? actionAt : null,
        completedByUserId: completed ? performer.id : null,
        completedTicketVersion: completed ? ticket.version : null,
        cancelledAt: cancelled ? actionAt : null,
        cancelledByUserId: cancelled ? performer.id : null,
        cancellationReason: cancelled ? "Superseded by a new investigation" : null,
      },
    });
    const eventId = fixture.id.replace("34a00000", "34e00000");
    await prisma.actionEvent.upsert({
      where: { id: eventId }, update: {},
      create: { id: eventId, ticketId: ticket.id, actionId: fixture.id, actorId: performer.id, type: "CREATED", occurredAt: actionAt, resultingActionVersion: 0, resultingTicketVersion: ticket.version, changes: { status: { before: null, after: "PLANNED" }, description: { before: null, after: fixture.description } } },
    });
    if (completed || cancelled) {
      await prisma.actionEvent.upsert({
        where: { id: fixture.id.replace("34a00000", "34f00000") }, update: {},
        create: { id: fixture.id.replace("34a00000", "34f00000"), ticketId: ticket.id, actionId: fixture.id, actorId: performer.id, type: completed ? "COMPLETED" : "CANCELLED", occurredAt: new Date(actionAt.getTime() + 1_000), resultingActionVersion: 0, resultingTicketVersion: ticket.version, changes: { status: { before: "PLANNED", after: fixture.status } } },
      });
    }
  }
}
