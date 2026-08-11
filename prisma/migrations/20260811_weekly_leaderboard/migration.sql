CREATE TABLE "leaderboard_periods" (
    "id" VARCHAR(10) NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leaderboard_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leaderboard_entries" (
    "id" UUID NOT NULL,
    "periodId" VARCHAR(10) NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "scoreMicros" BIGINT NOT NULL,
    "effectiveMineralsPerDayMicros" BIGINT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leaderboard_periods_startsAt_endsAt_key" ON "leaderboard_periods"("startsAt", "endsAt");
CREATE INDEX "leaderboard_periods_endsAt_idx" ON "leaderboard_periods"("endsAt");
CREATE UNIQUE INDEX "leaderboard_entries_periodId_walletAddress_key" ON "leaderboard_entries"("periodId", "walletAddress");
CREATE UNIQUE INDEX "leaderboard_entries_periodId_rank_key" ON "leaderboard_entries"("periodId", "rank");
CREATE INDEX "leaderboard_entries_walletAddress_periodId_idx" ON "leaderboard_entries"("walletAddress", "periodId");

ALTER TABLE "leaderboard_entries"
ADD CONSTRAINT "leaderboard_entries_periodId_fkey"
FOREIGN KEY ("periodId") REFERENCES "leaderboard_periods"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
