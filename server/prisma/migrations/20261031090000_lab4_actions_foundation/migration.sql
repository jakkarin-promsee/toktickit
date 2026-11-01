-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionEventType" AS ENUM ('CREATED', 'EDITED', 'ASSIGNED', 'STATUS_CHANGED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketWorkflowEventType" AS ENUM ('BASELINE', 'CREATED', 'STATUS_CHANGED', 'OWNER_CHANGED', 'PRIORITY_CHANGED', 'REQUESTER_SIGNAL', 'ACTION_CHANGED');

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "actionAt" TIMESTAMPTZ(3) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "result" VARCHAR(2000) NOT NULL DEFAULT '',
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdByUserId" INTEGER NOT NULL,
    "performedByUserId" INTEGER NOT NULL,
    "assigneeId" INTEGER,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" VARCHAR(1000),
    "attachmentNotes" VARCHAR(500),
    "completedAt" TIMESTAMPTZ(3),
    "completedByUserId" INTEGER,
    "completedTicketVersion" INTEGER,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledByUserId" INTEGER,
    "cancellationReason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionEvent" (
    "id" UUID NOT NULL,
    "actionId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "type" "ActionEventType" NOT NULL,
    "actorId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultingActionVersion" INTEGER NOT NULL,
    "resultingTicketVersion" INTEGER NOT NULL,
    "changes" JSONB NOT NULL,

    CONSTRAINT "ActionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionCreateRequest" (
    "actorId" INTEGER NOT NULL,
    "ticketId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "actionId" UUID NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionCreateRequest_pkey" PRIMARY KEY ("actorId","ticketId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "TicketWorkflowEvent" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "type" "TicketWorkflowEventType" NOT NULL,
    "actorId" INTEGER,
    "subjectActionId" UUID,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultingTicketVersion" INTEGER NOT NULL,
    "changes" JSONB NOT NULL,

    CONSTRAINT "TicketWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_createdAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_assigneeId_status_actionAt_idx" ON "ActionTaken"("assigneeId", "status", "actionAt");

-- CreateIndex
CREATE INDEX "ActionTaken_performedByUserId_idx" ON "ActionTaken"("performedByUserId");

-- CreateIndex
CREATE INDEX "ActionTaken_status_completedTicketVersion_idx" ON "ActionTaken"("status", "completedTicketVersion");

-- CreateIndex
CREATE INDEX "ActionEvent_actionId_occurredAt_id_idx" ON "ActionEvent"("actionId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ActionEvent_ticketId_occurredAt_id_idx" ON "ActionEvent"("ticketId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ActionCreateRequest_actionId_idx" ON "ActionCreateRequest"("actionId");

-- CreateIndex
CREATE INDEX "TicketWorkflowEvent_ticketId_occurredAt_id_idx" ON "TicketWorkflowEvent"("ticketId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "TicketWorkflowEvent_ticketId_type_resultingTicketVersion_idx" ON "TicketWorkflowEvent"("ticketId", "type", "resultingTicketVersion");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionCreateRequest" ADD CONSTRAINT "ActionCreateRequest_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionCreateRequest" ADD CONSTRAINT "ActionCreateRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionCreateRequest" ADD CONSTRAINT "ActionCreateRequest_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWorkflowEvent" ADD CONSTRAINT "TicketWorkflowEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWorkflowEvent" ADD CONSTRAINT "TicketWorkflowEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the observed state of each pre-Lab-4 Ticket without inventing a historical actor or changing the Ticket.
-- The UUID is stable, so this guarded backfill can be rerun during forward recovery.
INSERT INTO "TicketWorkflowEvent" ("id", "ticketId", "type", "actorId", "subjectActionId", "occurredAt", "resultingTicketVersion", "changes")
SELECT (
  substr(md5('lab4-baseline:' || t."id"::text), 1, 8) || '-' ||
  substr(md5('lab4-baseline:' || t."id"::text), 9, 4) || '-' ||
  substr(md5('lab4-baseline:' || t."id"::text), 13, 4) || '-' ||
  substr(md5('lab4-baseline:' || t."id"::text), 17, 4) || '-' ||
  substr(md5('lab4-baseline:' || t."id"::text), 21, 12)
)::uuid, t."id", 'BASELINE', NULL, NULL, CURRENT_TIMESTAMP, t."version",
jsonb_build_object(
  'currentStatus', jsonb_build_object('before', NULL, 'after', t."currentStatus"::text),
  'ownerId', jsonb_build_object('before', NULL, 'after', t."ownerId"),
  'itPriority', jsonb_build_object('before', NULL, 'after', t."itPriority"::text)
)
FROM "Ticket" t
ON CONFLICT ("id") DO NOTHING;
