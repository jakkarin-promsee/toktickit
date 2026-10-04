-- Create the one-role User enum before evolving the Development Requester table.
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- Abort rather than merge accounts when lowercasing and trimming would collide.
DO $$
BEGIN
  IF EXISTS (
    SELECT lower(btrim("email"))
    FROM "RequesterUser"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Requester email normalization would create duplicates';
  END IF;
END $$;

UPDATE "RequesterUser" SET "email" = lower(btrim("email")), "displayName" = btrim("displayName");

-- Preserve every existing integer ID by renaming the table instead of copying rows.
ALTER TABLE "RequesterUser" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "RequesterUser_pkey" TO "User_pkey";
ALTER INDEX "RequesterUser_email_key" RENAME TO "User_email_key";
ALTER INDEX "RequesterUser_isActive_displayName_id_idx" RENAME TO "User_isActive_displayName_id_idx";

ALTER TABLE "User"
  ALTER COLUMN "email" TYPE VARCHAR(254),
  ALTER COLUMN "displayName" TYPE VARCHAR(100),
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized_check" CHECK ("email" = lower(btrim("email")) AND char_length("email") BETWEEN 3 AND 254);
ALTER TABLE "User" ADD CONSTRAINT "User_display_name_check" CHECK ("displayName" = btrim("displayName") AND char_length("displayName") BETWEEN 2 AND 100);
ALTER TABLE "User" ADD CONSTRAINT "User_version_check" CHECK ("version" >= 0);
CREATE INDEX "User_role_isActive_displayName_id_idx" ON "User"("role", "isActive", "displayName", "id");

-- Rename existing ownership/audit columns in place so Ticket and Attachment rows remain intact.
ALTER TABLE "Ticket" RENAME COLUMN "requesterId" TO "submittedByUserId";
ALTER TABLE "Ticket" RENAME CONSTRAINT "Ticket_requesterId_fkey" TO "Ticket_submittedByUserId_fkey";
ALTER INDEX "Ticket_requesterId_updatedAt_id_idx" RENAME TO "Ticket_submittedByUserId_updatedAt_id_idx";
ALTER INDEX "Ticket_requesterId_createdAt_id_idx" RENAME TO "Ticket_submittedByUserId_createdAt_id_idx";
ALTER INDEX "Ticket_requesterId_categoryId_idx" RENAME TO "Ticket_submittedByUserId_categoryId_idx";
ALTER INDEX "Ticket_requesterId_relatedSystemId_idx" RENAME TO "Ticket_submittedByUserId_relatedSystemId_idx";
ALTER INDEX "Ticket_requesterId_currentStatus_idx" RENAME TO "Ticket_submittedByUserId_currentStatus_idx";
ALTER INDEX "Ticket_requesterId_requestedPriority_idx" RENAME TO "Ticket_submittedByUserId_requestedPriority_idx";
ALTER INDEX "Ticket_requesterId_ticketNumber_idx" RENAME TO "Ticket_submittedByUserId_ticketNumber_idx";

ALTER TABLE "Attachment" RENAME COLUMN "uploadedByRequesterId" TO "uploadedByUserId";
ALTER TABLE "Attachment" RENAME COLUMN "removedByRequesterId" TO "removedByUserId";
ALTER TABLE "Attachment" RENAME CONSTRAINT "Attachment_uploadedByRequesterId_fkey" TO "Attachment_uploadedByUserId_fkey";
ALTER TABLE "Attachment" RENAME CONSTRAINT "Attachment_removedByRequesterId_fkey" TO "Attachment_removedByUserId_fkey";
ALTER INDEX "Attachment_uploadedByRequesterId_idx" RENAME TO "Attachment_uploadedByUserId_idx";
ALTER INDEX "Attachment_removedByRequesterId_idx" RENAME TO "Attachment_removedByUserId_idx";
ALTER TABLE "Attachment" RENAME CONSTRAINT "Attachment_removal_metadata_check" TO "Attachment_removal_metadata_check_v2";

-- Lab 3 starts IT Priority from Requested Priority and removes the transitional UNASSIGNED value.
UPDATE "Ticket" SET "itPriority" = "requestedPriority"::text::"ItPriority" WHERE "itPriority" = 'UNASSIGNED';
ALTER TYPE "ItPriority" RENAME TO "ItPriority_old";
CREATE TYPE "ItPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
ALTER TABLE "Ticket" ALTER COLUMN "itPriority" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "itPriority" TYPE "ItPriority" USING ("itPriority"::text::"ItPriority");
DROP TYPE "ItPriority_old";

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Ticket"
  ADD COLUMN "ownerId" INTEGER,
  ADD COLUMN "requesterResolvedAt" TIMESTAMP(3),
  ADD COLUMN "requesterResolvedByUserId" INTEGER,
  ADD COLUMN "lastStatusChangedAt" TIMESTAMP(3),
  ADD COLUMN "lastStatusChangedByUserId" INTEGER,
  ADD COLUMN "lastOwnerChangedAt" TIMESTAMP(3),
  ADD COLUMN "lastOwnerChangedByUserId" INTEGER,
  ADD COLUMN "lastPriorityChangedAt" TIMESTAMP(3),
  ADD COLUMN "lastPriorityChangedByUserId" INTEGER,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_version_check" CHECK ("version" >= 0);
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requester_resolution_check" CHECK (("requesterResolvedAt" IS NULL AND "requesterResolvedByUserId" IS NULL) OR ("requesterResolvedAt" IS NOT NULL AND "requesterResolvedByUserId" IS NOT NULL));
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_status_actor_check" CHECK (("lastStatusChangedAt" IS NULL AND "lastStatusChangedByUserId" IS NULL) OR ("lastStatusChangedAt" IS NOT NULL AND "lastStatusChangedByUserId" IS NOT NULL));
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_owner_actor_check" CHECK (("lastOwnerChangedAt" IS NULL AND "lastOwnerChangedByUserId" IS NULL) OR ("lastOwnerChangedAt" IS NOT NULL AND "lastOwnerChangedByUserId" IS NOT NULL));
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_priority_actor_check" CHECK (("lastPriorityChangedAt" IS NULL AND "lastPriorityChangedByUserId" IS NULL) OR ("lastPriorityChangedAt" IS NOT NULL AND "lastPriorityChangedByUserId" IS NOT NULL));

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterResolvedByUserId_fkey" FOREIGN KEY ("requesterResolvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_lastStatusChangedByUserId_fkey" FOREIGN KEY ("lastStatusChangedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_lastOwnerChangedByUserId_fkey" FOREIGN KEY ("lastOwnerChangedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_lastPriorityChangedByUserId_fkey" FOREIGN KEY ("lastPriorityChangedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Ticket_updatedAt_id_idx" ON "Ticket"("updatedAt", "id");
CREATE INDEX "Ticket_createdAt_id_idx" ON "Ticket"("createdAt", "id");
CREATE INDEX "Ticket_ownerId_updatedAt_id_idx" ON "Ticket"("ownerId", "updatedAt", "id");
CREATE INDEX "Ticket_currentStatus_updatedAt_id_idx" ON "Ticket"("currentStatus", "updatedAt", "id");
CREATE INDEX "Ticket_itPriority_updatedAt_id_idx" ON "Ticket"("itPriority", "updatedAt", "id");
CREATE INDEX "Ticket_requestedPriority_updatedAt_id_idx" ON "Ticket"("requestedPriority", "updatedAt", "id");
CREATE INDEX "Ticket_categoryId_updatedAt_id_idx" ON "Ticket"("categoryId", "updatedAt", "id");
CREATE INDEX "Ticket_relatedSystemId_updatedAt_id_idx" ON "Ticket"("relatedSystemId", "updatedAt", "id");
CREATE INDEX "Ticket_requesterResolvedByUserId_idx" ON "Ticket"("requesterResolvedByUserId");
CREATE INDEX "Ticket_lastStatusChangedByUserId_idx" ON "Ticket"("lastStatusChangedByUserId");
CREATE INDEX "Ticket_lastOwnerChangedByUserId_idx" ON "Ticket"("lastOwnerChangedByUserId");
CREATE INDEX "Ticket_lastPriorityChangedByUserId_idx" ON "Ticket"("lastPriorityChangedByUserId");

CREATE TABLE "Credential" (
  "userId" INTEGER NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Credential_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "csrfToken" CHAR(64) NOT NULL,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicComment" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicComment_content_check" CHECK (char_length(btrim("content")) BETWEEN 1 AND 2000)
);

CREATE TABLE "InternalNote" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalNote_content_check" CHECK (char_length(btrim("content")) BETWEEN 1 AND 2000)
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_revokedAt_expiresAt_idx" ON "Session"("userId", "revokedAt", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "PublicComment_ticketId_createdAt_id_idx" ON "PublicComment"("ticketId", "createdAt", "id");
CREATE INDEX "PublicComment_authorId_idx" ON "PublicComment"("authorId");
CREATE INDEX "InternalNote_ticketId_createdAt_id_idx" ON "InternalNote"("ticketId", "createdAt", "id");
CREATE INDEX "InternalNote_authorId_idx" ON "InternalNote"("authorId");

ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce the active IT Staff/Administrator owner rule at the database boundary.
CREATE FUNCTION "validate_ticket_owner"() RETURNS trigger AS $$
BEGIN
  IF NEW."ownerId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "User"
    WHERE "id" = NEW."ownerId" AND "isActive" = true AND "role" IN ('IT_STAFF', 'ADMINISTRATOR')
  ) THEN
    RAISE EXCEPTION 'Ticket owner must be an active IT Staff or Administrator' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Ticket_owner_eligibility_trigger"
BEFORE INSERT OR UPDATE OF "ownerId" ON "Ticket"
FOR EACH ROW EXECUTE FUNCTION "validate_ticket_owner"();

CREATE FUNCTION "prevent_ineligible_ticket_owner"() RETURNS trigger AS $$
BEGIN
  IF (NEW."isActive" = false OR NEW."role" NOT IN ('IT_STAFF', 'ADMINISTRATOR')) AND EXISTS (
    SELECT 1 FROM "Ticket" WHERE "ownerId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Reassign owned Tickets before changing owner eligibility' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_owner_eligibility_trigger"
BEFORE UPDATE OF "role", "isActive" ON "User"
FOR EACH ROW EXECUTE FUNCTION "prevent_ineligible_ticket_owner"();
