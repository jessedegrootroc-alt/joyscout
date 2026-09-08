-- Remove Better Auth tables: the app runs as a single workspace without login.
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "verification";
