import type { Prisma } from "@prisma/client";
import {
  CATEGORY_SEEDS,
  RELATED_SYSTEM_SEEDS,
  REQUESTER_SEEDS,
} from "./seed-data.js";

type UpsertDelegate<Args> = {
  upsert: (args: Args) => PromiseLike<unknown>;
};

type SeedClient = {
  category: UpsertDelegate<Prisma.CategoryUpsertArgs>;
  relatedSystem: UpsertDelegate<Prisma.RelatedSystemUpsertArgs>;
  requesterUser: UpsertDelegate<Prisma.RequesterUserUpsertArgs>;
};

export async function seedDatabase(prisma: SeedClient): Promise<void> {
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

  for (const requester of REQUESTER_SEEDS) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: {
        displayName: requester.displayName,
        isActive: requester.isActive,
      },
      create: requester,
    });
  }
}
