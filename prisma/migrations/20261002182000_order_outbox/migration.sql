CREATE TABLE "OrderOutboxEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OrderOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderOutboxEvent_orderId_kind_key" ON "OrderOutboxEvent"("orderId", "kind");
CREATE INDEX "OrderOutboxEvent_status_availableAt_idx" ON "OrderOutboxEvent"("status", "availableAt");
CREATE INDEX "OrderOutboxEvent_lockedAt_idx" ON "OrderOutboxEvent"("lockedAt");

ALTER TABLE "OrderOutboxEvent"
ADD CONSTRAINT "OrderOutboxEvent_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
