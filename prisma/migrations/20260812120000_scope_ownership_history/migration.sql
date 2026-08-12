-- Scope ownership history identity to the active chain and Planet deployment.
ALTER TABLE "planet_ownership_history"
  ADD COLUMN "chainId" INTEGER,
  ADD COLUMN "contractAddress" VARCHAR(42);

UPDATE "planet_ownership_history" AS history
SET "chainId" = planet."chainId",
    "contractAddress" = planet."contractAddress"
FROM "planets" AS planet
WHERE history."planetId" = planet."id";

ALTER TABLE "planet_ownership_history"
  ALTER COLUMN "chainId" SET NOT NULL,
  ALTER COLUMN "contractAddress" SET NOT NULL;

DROP INDEX "planet_ownership_history_transactionHash_logIndex_key";
CREATE UNIQUE INDEX "planet_ownership_history_chainId_contractAddress_transactionHash_logIndex_key"
  ON "planet_ownership_history"("chainId", "contractAddress", "transactionHash", "logIndex");
CREATE INDEX "planet_ownership_history_chainId_contractAddress_blockNumber_idx"
  ON "planet_ownership_history"("chainId", "contractAddress", "blockNumber");
