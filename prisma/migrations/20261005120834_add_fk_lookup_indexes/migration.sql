-- Existing databases should use `npm run db:deploy`, which creates these indexes
-- concurrently before Prisma Migrate. IF NOT EXISTS keeps this transactional
-- migration safe and idempotent, including fresh databases and partial retries.
CREATE INDEX IF NOT EXISTS "Address_wilayaId_idx" ON "Address"("wilayaId");
CREATE INDEX IF NOT EXISTS "Address_communeId_idx" ON "Address"("communeId");
CREATE INDEX IF NOT EXISTS "CartItem_variantId_idx" ON "CartItem"("variantId");
CREATE INDEX IF NOT EXISTS "CouponCollection_collectionId_idx" ON "CouponCollection"("collectionId");
CREATE INDEX IF NOT EXISTS "CouponProduct_productId_idx" ON "CouponProduct"("productId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_customerId_idx" ON "CouponRedemption"("customerId");
CREATE INDEX IF NOT EXISTS "CouponWilaya_wilayaId_idx" ON "CouponWilaya"("wilayaId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_userId_idx" ON "InventoryTransaction"("userId");
CREATE INDEX IF NOT EXISTS "Order_communeId_idx" ON "Order"("communeId");
CREATE INDEX IF NOT EXISTS "Order_couponId_idx" ON "Order"("couponId");
CREATE INDEX IF NOT EXISTS "Order_promotionId_idx" ON "Order"("promotionId");
CREATE INDEX IF NOT EXISTS "OrderStatusHistory_changedByUserId_idx" ON "OrderStatusHistory"("changedByUserId");
CREATE INDEX IF NOT EXISTS "Promotion_collectionId_idx" ON "Promotion"("collectionId");
CREATE INDEX IF NOT EXISTS "PromotionProduct_productId_idx" ON "PromotionProduct"("productId");
CREATE INDEX IF NOT EXISTS "Review_customerId_idx" ON "Review"("customerId");
CREATE INDEX IF NOT EXISTS "Review_orderId_idx" ON "Review"("orderId");
