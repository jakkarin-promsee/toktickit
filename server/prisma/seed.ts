import { getPrisma } from "../src/prisma.js";
import { seedDatabase } from "./seed-database.js";
import {
  CATEGORY_SEEDS,
  INTERNAL_NOTE_SEEDS,
  PUBLIC_COMMENT_SEEDS,
  RELATED_SYSTEM_SEEDS,
  TICKET_SEEDS,
  USER_SEEDS,
} from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD;
  if (!initialPassword) {
    throw new Error("LAB3_SEED_INITIAL_PASSWORD is required for local Lab 3 seed credentials.");
  }

  await seedDatabase(prisma, { initialPassword });

  console.log(
    `Seeded ${CATEGORY_SEEDS.length} categories, ` +
      `${RELATED_SYSTEM_SEEDS.length} related systems, and ` +
      `${USER_SEEDS.length} Users, ${TICKET_SEEDS.length} Tickets, ` +
      `${PUBLIC_COMMENT_SEEDS.length} Public Comments, and ` +
      `${INTERNAL_NOTE_SEEDS.length} Internal Notes.`
  );
}

// process.exitCode, not process.exit(): exit() tears the process down without
// draining the microtask queue, so the .finally() below never runs and the
// connection is left open on the failure path. Setting the code lets the chain
// finish and Node still exits non-zero once the event loop empties.
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
