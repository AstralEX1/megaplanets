-- Immutable media/metadata pointers are separate from expiring mint vouchers.
CREATE TABLE "planet_artifacts" (
    "id" UUID NOT NULL,
    "ticketPurchaseId" UUID NOT NULL,
    "artifactKey" VARCHAR(160) NOT NULL,
    "ticketId" DECIMAL(78,0) NOT NULL,
    "recipient" VARCHAR(42) NOT NULL,
    "seed" CHAR(66) NOT NULL,
    "traitsHash" CHAR(66) NOT NULL,
    "metadataHash" CHAR(66) NOT NULL,
    "metadataUri" TEXT NOT NULL,
    "mediaUri" TEXT NOT NULL,
    "mediaHash" CHAR(66) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planet_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "planet_artifacts_ticketPurchaseId_key" ON "planet_artifacts"("ticketPurchaseId");
CREATE UNIQUE INDEX "planet_artifacts_artifactKey_key" ON "planet_artifacts"("artifactKey");
CREATE INDEX "planet_artifacts_recipient_idx" ON "planet_artifacts"("recipient");

ALTER TABLE "planet_artifacts"
  ADD CONSTRAINT "planet_artifacts_ticketPurchaseId_fkey"
  FOREIGN KEY ("ticketPurchaseId") REFERENCES "ticket_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
