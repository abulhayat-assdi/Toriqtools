-- AlterTable
ALTER TABLE "products" ADD COLUMN "related_product_ids" JSONB NOT NULL DEFAULT '[]';
