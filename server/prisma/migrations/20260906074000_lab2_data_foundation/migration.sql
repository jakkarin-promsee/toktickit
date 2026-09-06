-- CreateEnum
CREATE TYPE "RequestedPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ItPriority" AS ENUM ('UNASSIGNED', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW');

-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "RequesterUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequesterUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatedSystem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatedSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "ticketNumber" VARCHAR(19) NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "relatedSystemId" INTEGER NOT NULL,
    "summary" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "requestedPriority" "RequestedPriority" NOT NULL,
    "itPriority" "ItPriority" NOT NULL DEFAULT 'UNASSIGNED',
    "currentStatus" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storageName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploadedByRequesterId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedByRequesterId" INTEGER,
    "removalReason" VARCHAR(250),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Attachment_size_bytes_check"
      CHECK ("sizeBytes" >= 0 AND "sizeBytes" <= 5242880),
    CONSTRAINT "Attachment_removal_metadata_check"
      CHECK (
        ("removedAt" IS NULL AND "removedByRequesterId" IS NULL AND "removalReason" IS NULL)
        OR
        ("removedAt" IS NOT NULL AND "removedByRequesterId" IS NOT NULL AND "removalReason" IS NOT NULL)
      )
);

-- CreateIndex
CREATE UNIQUE INDEX "RequesterUser_email_key" ON "RequesterUser"("email");
CREATE INDEX "RequesterUser_isActive_displayName_id_idx" ON "RequesterUser"("isActive", "displayName", "id");
CREATE UNIQUE INDEX "RelatedSystem_name_key" ON "RelatedSystem"("name");
CREATE INDEX "RelatedSystem_isActive_name_idx" ON "RelatedSystem"("isActive", "name");
CREATE INDEX "Category_isActive_name_idx" ON "Category"("isActive", "name");
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");
CREATE INDEX "Ticket_requesterId_updatedAt_id_idx" ON "Ticket"("requesterId", "updatedAt", "id");
CREATE INDEX "Ticket_requesterId_createdAt_id_idx" ON "Ticket"("requesterId", "createdAt", "id");
CREATE INDEX "Ticket_requesterId_categoryId_idx" ON "Ticket"("requesterId", "categoryId");
CREATE INDEX "Ticket_requesterId_relatedSystemId_idx" ON "Ticket"("requesterId", "relatedSystemId");
CREATE INDEX "Ticket_requesterId_currentStatus_idx" ON "Ticket"("requesterId", "currentStatus");
CREATE INDEX "Ticket_requesterId_requestedPriority_idx" ON "Ticket"("requesterId", "requestedPriority");
CREATE INDEX "Ticket_requesterId_ticketNumber_idx" ON "Ticket"("requesterId", "ticketNumber");
CREATE UNIQUE INDEX "Attachment_storageName_key" ON "Attachment"("storageName");
CREATE INDEX "Attachment_ticketId_removedAt_idx" ON "Attachment"("ticketId", "removedAt");
CREATE INDEX "Attachment_uploadedByRequesterId_idx" ON "Attachment"("uploadedByRequesterId");
CREATE INDEX "Attachment_removedByRequesterId_idx" ON "Attachment"("removedByRequesterId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_relatedSystemId_fkey"
FOREIGN KEY ("relatedSystemId") REFERENCES "RelatedSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedByRequesterId_fkey"
FOREIGN KEY ("uploadedByRequesterId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_removedByRequesterId_fkey"
FOREIGN KEY ("removedByRequesterId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
