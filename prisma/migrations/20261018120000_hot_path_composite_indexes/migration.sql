-- Composite indexes for the hottest listing, checkout, and retention paths:
--   Order(phone, createdAt)        — duplicate-order check + COD risk history
--   Order(status, createdAt)       — admin order list filtered by status
--   Order(customerId, createdAt)   — account order history
--   Cart(status, updatedAt)        — abandoned-cart item purge
--   Notification(status, createdAt)— notification retention purge
-- db:deploy pre-creates them concurrently on populated databases; IF NOT
-- EXISTS keeps this transactional migration safe and idempotent for fresh
-- databases and partial retries.
CREATE INDEX IF NOT EXISTS "Order_phone_createdAt_idx" ON "Order"("phone", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Cart_status_updatedAt_idx" ON "Cart"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
