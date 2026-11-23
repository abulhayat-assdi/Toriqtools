-- Steadfast tracking code (used for the QR code on the courier label)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_code" TEXT;
