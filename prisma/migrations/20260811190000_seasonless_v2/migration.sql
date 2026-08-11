-- Seasonless V2 migration. Historical migrations remain unchanged.
-- Refuse to continue if removing the season dimension would collapse snapshots.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "daily_snapshots"
        GROUP BY "blockNumber"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot drop DailySnapshotRecord.seasonId: duplicate blockNumber rows exist';
    END IF;
END $$;

DROP INDEX "daily_snapshots_seasonId_blockNumber_key";

ALTER TABLE "planets" DROP COLUMN "seasonId";
ALTER TABLE "daily_snapshots" DROP COLUMN "seasonId";

CREATE UNIQUE INDEX "daily_snapshots_blockNumber_key" ON "daily_snapshots"("blockNumber");
