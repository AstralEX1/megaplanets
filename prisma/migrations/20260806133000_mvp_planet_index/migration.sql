CREATE TYPE "PlanetKind" AS ENUM ('NORMAL', 'SPECIAL');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_nonces" (
    "id" UUID NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "nonceHash" CHAR(64) NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_purchases" (
    "id" UUID NOT NULL,
    "chainId" INTEGER NOT NULL,
    "jackpotAddress" VARCHAR(42) NOT NULL,
    "ticketId" DECIMAL(78,0) NOT NULL,
    "drawingId" DECIMAL(78,0) NOT NULL,
    "recipient" VARCHAR(42) NOT NULL,
    "normals" INTEGER[],
    "bonusBall" INTEGER NOT NULL,
    "source" CHAR(66) NOT NULL,
    "originTxHash" CHAR(66) NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" CHAR(66) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mint_vouchers" (
    "id" UUID NOT NULL,
    "ticketPurchaseId" UUID NOT NULL,
    "recipient" VARCHAR(42) NOT NULL,
    "voucher" JSONB NOT NULL,
    "signature" VARCHAR(132) NOT NULL,
    "signer" VARCHAR(42) NOT NULL,
    "digest" CHAR(66) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mint_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "planets" (
    "id" UUID NOT NULL,
    "ticketPurchaseId" UUID,
    "chainId" INTEGER NOT NULL,
    "contractAddress" VARCHAR(42) NOT NULL,
    "tokenId" DECIMAL(78,0) NOT NULL,
    "ticketId" DECIMAL(78,0),
    "kind" "PlanetKind" NOT NULL,
    "ownerAddress" VARCHAR(42) NOT NULL,
    "seasonId" CHAR(66) NOT NULL,
    "seed" CHAR(66),
    "traitsHash" CHAR(66),
    "metadataHash" CHAR(66),
    "metadataUri" TEXT NOT NULL,
    "baseMineralsPerDay" BIGINT,
    "generatorVersion" INTEGER,
    "planetType" VARCHAR(32),
    "terrain" VARCHAR(32),
    "rarity" VARCHAR(16),
    "satelliteCount" INTEGER,
    "hasRing" BOOLEAN,
    "mintTxHash" CHAR(66) NOT NULL,
    "mintBlockNumber" BIGINT NOT NULL,
    "mintBlockHash" CHAR(66) NOT NULL,
    "mintLogIndex" INTEGER NOT NULL,
    "mintedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "planets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "planet_ownership_history" (
    "id" UUID NOT NULL,
    "planetId" UUID NOT NULL,
    "fromAddress" VARCHAR(42),
    "toAddress" VARCHAR(42),
    "transactionHash" CHAR(66) NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" CHAR(66) NOT NULL,
    "blockTimestamp" TIMESTAMPTZ(3) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planet_ownership_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processed_blockchain_events" (
    "id" UUID NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" VARCHAR(42) NOT NULL,
    "transactionHash" CHAR(66) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" CHAR(66) NOT NULL,
    "eventName" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "processed_blockchain_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "indexer_cursors" (
    "id" UUID NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" VARCHAR(42) NOT NULL,
    "stream" VARCHAR(64) NOT NULL,
    "nextBlock" BIGINT NOT NULL,
    "lastBlockHash" CHAR(66),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "indexer_cursors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_snapshots" (
    "id" UUID NOT NULL,
    "seasonId" CHAR(66) NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");
CREATE UNIQUE INDEX "auth_nonces_nonceHash_key" ON "auth_nonces"("nonceHash");
CREATE INDEX "auth_nonces_walletAddress_expiresAt_idx" ON "auth_nonces"("walletAddress", "expiresAt");
CREATE UNIQUE INDEX "wallet_sessions_tokenHash_key" ON "wallet_sessions"("tokenHash");
CREATE INDEX "wallet_sessions_userId_expiresAt_idx" ON "wallet_sessions"("userId", "expiresAt");
CREATE INDEX "ticket_purchases_recipient_purchasedAt_idx" ON "ticket_purchases"("recipient", "purchasedAt");
CREATE UNIQUE INDEX "ticket_purchases_chainId_jackpotAddress_ticketId_key" ON "ticket_purchases"("chainId", "jackpotAddress", "ticketId");
CREATE UNIQUE INDEX "ticket_purchases_chainId_originTxHash_logIndex_key" ON "ticket_purchases"("chainId", "originTxHash", "logIndex");
CREATE UNIQUE INDEX "mint_vouchers_ticketPurchaseId_key" ON "mint_vouchers"("ticketPurchaseId");
CREATE INDEX "mint_vouchers_recipient_expiresAt_idx" ON "mint_vouchers"("recipient", "expiresAt");
CREATE UNIQUE INDEX "planets_ticketPurchaseId_key" ON "planets"("ticketPurchaseId");
CREATE INDEX "planets_ownerAddress_mintedAt_idx" ON "planets"("ownerAddress", "mintedAt");
CREATE UNIQUE INDEX "planets_chainId_contractAddress_tokenId_key" ON "planets"("chainId", "contractAddress", "tokenId");
CREATE UNIQUE INDEX "planets_chainId_mintTxHash_mintLogIndex_key" ON "planets"("chainId", "mintTxHash", "mintLogIndex");
CREATE UNIQUE INDEX "planet_ownership_history_transactionHash_logIndex_key" ON "planet_ownership_history"("transactionHash", "logIndex");
CREATE INDEX "planet_ownership_history_planetId_blockNumber_idx" ON "planet_ownership_history"("planetId", "blockNumber");
CREATE INDEX "planet_ownership_history_toAddress_blockTimestamp_idx" ON "planet_ownership_history"("toAddress", "blockTimestamp");
CREATE UNIQUE INDEX "processed_blockchain_events_chainId_contractAddress_transac_key" ON "processed_blockchain_events"("chainId", "contractAddress", "transactionHash", "logIndex");
CREATE INDEX "processed_blockchain_events_chainId_contractAddress_blockNu_idx" ON "processed_blockchain_events"("chainId", "contractAddress", "blockNumber");
CREATE UNIQUE INDEX "indexer_cursors_chainId_contractAddress_stream_key" ON "indexer_cursors"("chainId", "contractAddress", "stream");
CREATE UNIQUE INDEX "daily_snapshots_seasonId_blockNumber_key" ON "daily_snapshots"("seasonId", "blockNumber");

ALTER TABLE "wallet_sessions" ADD CONSTRAINT "wallet_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mint_vouchers" ADD CONSTRAINT "mint_vouchers_ticketPurchaseId_fkey" FOREIGN KEY ("ticketPurchaseId") REFERENCES "ticket_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "planets" ADD CONSTRAINT "planets_ticketPurchaseId_fkey" FOREIGN KEY ("ticketPurchaseId") REFERENCES "ticket_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "planet_ownership_history" ADD CONSTRAINT "planet_ownership_history_planetId_fkey" FOREIGN KEY ("planetId") REFERENCES "planets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
