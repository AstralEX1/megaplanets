CREATE TABLE "planet_accrual_state" (
    "id" UUID NOT NULL,
    "planetId" UUID NOT NULL,
    "ownerAddress" VARCHAR(42) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "multiplierBps" INTEGER NOT NULL,
    "remainder" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "planet_accrual_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mineral_ledger" (
    "id" UUID NOT NULL,
    "planetId" UUID NOT NULL,
    "ownerAddress" VARCHAR(42) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3) NOT NULL,
    "baseMineralsPerDay" BIGINT NOT NULL,
    "multiplierBps" INTEGER NOT NULL,
    "amountMicros" BIGINT NOT NULL,
    "fractionalRemainder" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mineral_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "planet_accrual_state_planetId_key" ON "planet_accrual_state"("planetId");
CREATE INDEX "planet_accrual_state_ownerAddress_startedAt_idx" ON "planet_accrual_state"("ownerAddress", "startedAt");
CREATE UNIQUE INDEX "mineral_ledger_planetId_ownerAddress_startedAt_endedAt_key" ON "mineral_ledger"("planetId", "ownerAddress", "startedAt", "endedAt");
CREATE INDEX "mineral_ledger_ownerAddress_endedAt_idx" ON "mineral_ledger"("ownerAddress", "endedAt");
CREATE INDEX "mineral_ledger_planetId_endedAt_idx" ON "mineral_ledger"("planetId", "endedAt");

ALTER TABLE "planet_accrual_state" ADD CONSTRAINT "planet_accrual_state_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "planets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mineral_ledger" ADD CONSTRAINT "mineral_ledger_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "planets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
