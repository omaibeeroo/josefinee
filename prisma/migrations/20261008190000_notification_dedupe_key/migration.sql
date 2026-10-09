-- Dedupe key for at-least-once notification delivery. Concurrent outbox
-- workers racing the same (order, channel, template) hit the unique
-- constraint on the second insert instead of double-sending. NULL keys
-- (failed/pending rows) never conflict in PostgreSQL.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
