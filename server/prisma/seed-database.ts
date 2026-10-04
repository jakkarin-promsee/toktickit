import type { PrismaClient } from "@prisma/client";
import { hashPassword, passwordPolicyError } from "../src/password.js";
import {
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
      update: { isActive: category.isActive },
      create: category,
    });
  }

  for (const relatedSystem of RELATED_SYSTEM_SEEDS) {
    await prisma.relatedSystem.upsert({
      where: { name: relatedSystem.name },
      update: { isActive: relatedSystem.isActive },
      create: relatedSystem,
    });
  }

  for (const user of USER_SEEDS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
      },
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
      update: {
        ...shared,
        owner: ticket.ownerEmail
          ? { connect: { email: ticket.ownerEmail } }
          : { disconnect: true },
      },
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
      update: {
        content: comment.content,
        ticket: { connect: { ticketNumber: comment.ticketNumber } },
        author: { connect: { email: comment.authorEmail } },
      },
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
      update: {
        content: note.content,
        ticket: { connect: { ticketNumber: note.ticketNumber } },
        author: { connect: { email: note.authorEmail } },
      },
      create: {
        id: note.id,
        content: note.content,
        ticket: { connect: { ticketNumber: note.ticketNumber } },
        author: { connect: { email: note.authorEmail } },
      },
    });
  }
}
