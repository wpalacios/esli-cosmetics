/*
  Warnings:

  - You are about to drop the column `parent_order_item_id` on the `order_items` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."order_items" DROP CONSTRAINT "order_items_parent_order_item_id_fkey";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "parent_order_item_id";
