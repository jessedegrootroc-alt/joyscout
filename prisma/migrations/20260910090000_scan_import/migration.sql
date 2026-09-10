-- Import scans (pasted lists)
ALTER TABLE "Scan" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'search', ADD COLUMN "importItems" JSONB;
