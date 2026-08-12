-- Wallet authentication was removed from the public API. These tables contain
-- only disposable nonce/session state and are no longer part of the schema.
DROP TABLE IF EXISTS "wallet_sessions";
DROP TABLE IF EXISTS "auth_nonces";
DROP TABLE IF EXISTS "users";
