import { getPrisma } from "../src/prisma.js";
import { seedDatabase } from "./seed-database.js";
import {
  CATEGORY_SEEDS,
  RELATED_SYSTEM_SEEDS,
  REQUESTER_SEEDS,
} from "./seed-data.js";

async function main() {
  const prisma = getPrisma();

  await seedDatabase(prisma);

  console.log(
    `Seeded ${CATEGORY_SEEDS.length} categories, ` +
      `${RELATED_SYSTEM_SEEDS.length} related systems, and ` +
      `${REQUESTER_SEEDS.length} Development Requesters.`
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
