ALTER TABLE "Review" ADD COLUMN "guestIdentityHash" TEXT;

CREATE UNIQUE INDEX "Review_productId_guestIdentityHash_key"
ON "Review"("productId", "guestIdentityHash");
