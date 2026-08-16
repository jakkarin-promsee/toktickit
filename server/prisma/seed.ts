import { getPrisma } from "../src/prisma.js";

// Issue 3 — seed the four supported categories.
// Insertion order fixes the autoincrement ids, which is what lets
// GET /api/categories return a predictable order later (Issue 4).
const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;

// upsert, not create: `create` would crash on the second run because `name` is
// @unique. `update: {}` means "row already there — leave it alone", so the seed
// is idempotent (same result no matter how many times it runs).
async function main() {
  const prisma = getPrisma();

  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const total = await prisma.category.count();
  console.log(`Seeded ${CATEGORY_NAMES.length} categories (${total} rows total).`);
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
