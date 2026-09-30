/*
  Warnings:

  - Made the column `is_deleted` on table `addresses` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `addresses` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `addresses` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `branches` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `branches` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `branches` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `branches` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `country` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `department` required. This step will fail if there are existing NULL values in that column.
  - Made the column `active` on table `discounts` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `discounts` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `discounts` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `discounts` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `employees` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `employees` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `employees` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `employees` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `locations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `locations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `locations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `municipality` required. This step will fail if there are existing NULL values in that column.
  - Made the column `read` on table `notifications` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `notifications` required. This step will fail if there are existing NULL values in that column.
  - Made the column `order_id` on table `order_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `orders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `orders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `people` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `people` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `people` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `people` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `permissions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `permissions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `product_id` on table `product_suppliers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `supplier_id` on table `product_suppliers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `product_suppliers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `product_suppliers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `product_id` on table `product_variants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `product_variants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `product_variants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `product_variants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `product_variants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `purchase_order_id` on table `purchase_order_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `purchase_orders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `purchase_orders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `purchase_orders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `role_id` on table `role_permissions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `permission_id` on table `role_permissions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `role_permissions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `role_permissions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `roles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `roles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `quantity` on table `stock_levels` required. This step will fail if there are existing NULL values in that column.
  - Made the column `reserved` on table `stock_levels` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `stock_levels` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `stock_movements` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `stock_movements` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `suppliers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `suppliers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `suppliers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `suppliers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `active` on table `tax_rates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `tax_rates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `tax_rates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `tax_rates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `user_roles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `role_id` on table `user_roles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `user_roles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `user_roles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_deleted` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_country_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_department_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_municipality_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_person_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."audit_logs" DROP CONSTRAINT "audit_logs_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."branches" DROP CONSTRAINT "fk_manager_employee";

-- DropForeignKey
ALTER TABLE "public"."categories" DROP CONSTRAINT "categories_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."customers" DROP CONSTRAINT "customers_person_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."customers" DROP CONSTRAINT "customers_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."customers" DROP CONSTRAINT "fk_default_billing_address";

-- DropForeignKey
ALTER TABLE "public"."department" DROP CONSTRAINT "department_country_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_person_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employees" DROP CONSTRAINT "employees_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."import_export_jobs" DROP CONSTRAINT "import_export_jobs_created_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."locations" DROP CONSTRAINT "locations_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."municipality" DROP CONSTRAINT "municipality_department_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."order_items" DROP CONSTRAINT "order_items_order_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."order_items" DROP CONSTRAINT "order_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."order_items" DROP CONSTRAINT "order_items_product_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_location_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_created_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_order_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_suppliers" DROP CONSTRAINT "product_suppliers_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_suppliers" DROP CONSTRAINT "product_suppliers_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_variants" DROP CONSTRAINT "product_variants_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_tax_rate_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."purchase_order_items" DROP CONSTRAINT "purchase_order_items_product_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."purchase_order_items" DROP CONSTRAINT "purchase_order_items_purchase_order_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."purchase_orders" DROP CONSTRAINT "purchase_orders_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."purchase_orders" DROP CONSTRAINT "purchase_orders_created_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."purchase_orders" DROP CONSTRAINT "purchase_orders_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_levels" DROP CONSTRAINT "stock_levels_location_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_levels" DROP CONSTRAINT "stock_levels_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_levels" DROP CONSTRAINT "stock_levels_product_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_movements" DROP CONSTRAINT "stock_movements_created_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_movements" DROP CONSTRAINT "stock_movements_from_location_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_movements" DROP CONSTRAINT "stock_movements_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_movements" DROP CONSTRAINT "stock_movements_product_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_movements" DROP CONSTRAINT "stock_movements_to_location_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_roles" DROP CONSTRAINT "user_roles_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- DropIndex
DROP INDEX "public"."idx_categories_is_deleted";

-- DropIndex
DROP INDEX "public"."idx_categories_parent";

-- DropIndex
DROP INDEX "public"."idx_order_items_order";

-- DropIndex
DROP INDEX "public"."idx_order_items_product";

-- DropIndex
DROP INDEX "public"."idx_order_items_variant";

-- DropIndex
DROP INDEX "public"."idx_orders_branch";

-- DropIndex
DROP INDEX "public"."idx_orders_created_at";

-- DropIndex
DROP INDEX "public"."idx_orders_customer";

-- DropIndex
DROP INDEX "public"."idx_people_email";

-- DropIndex
DROP INDEX "public"."idx_people_is_deleted";

-- DropIndex
DROP INDEX "public"."idx_product_variants_barcode";

-- DropIndex
DROP INDEX "public"."idx_product_variants_product";

-- DropIndex
DROP INDEX "public"."idx_product_variants_sku";

-- DropIndex
DROP INDEX "public"."idx_products_barcode";

-- DropIndex
DROP INDEX "public"."idx_products_category";

-- DropIndex
DROP INDEX "public"."idx_products_is_deleted";

-- DropIndex
DROP INDEX "public"."idx_products_sku";

-- DropIndex
DROP INDEX "public"."idx_role_permissions_permission";

-- DropIndex
DROP INDEX "public"."idx_role_permissions_role";

-- DropIndex
DROP INDEX "public"."idx_stock_levels_location";

-- DropIndex
DROP INDEX "public"."idx_stock_levels_product_variant";

-- DropIndex
DROP INDEX "public"."idx_stock_movements_created_at";

-- DropIndex
DROP INDEX "public"."idx_stock_movements_location_from";

-- DropIndex
DROP INDEX "public"."idx_stock_movements_location_to";

-- DropIndex
DROP INDEX "public"."idx_stock_movements_product_variant";

-- DropIndex
DROP INDEX "public"."idx_user_roles_role";

-- DropIndex
DROP INDEX "public"."idx_user_roles_user";

-- DropIndex
DROP INDEX "public"."idx_users_email";

-- DropIndex
DROP INDEX "public"."idx_users_is_deleted";

-- AlterTable
ALTER TABLE "public"."addresses" ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."audit_logs" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."branches" ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."categories" ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."country" ALTER COLUMN "is_deleted" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."customers" ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."department" ALTER COLUMN "is_deleted" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."discounts" ALTER COLUMN "active" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."employees" ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."locations" ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."municipality" ALTER COLUMN "is_deleted" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."notifications" ALTER COLUMN "read" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."order_items" ALTER COLUMN "order_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."orders" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."people" ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."permissions" ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."product_suppliers" ALTER COLUMN "product_id" SET NOT NULL,
ALTER COLUMN "supplier_id" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."product_variants" ALTER COLUMN "product_id" SET NOT NULL,
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."products" ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."purchase_order_items" ALTER COLUMN "purchase_order_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."purchase_orders" ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."role_permissions" ALTER COLUMN "role_id" SET NOT NULL,
ALTER COLUMN "permission_id" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."roles" ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."stock_levels" ALTER COLUMN "quantity" SET NOT NULL,
ALTER COLUMN "reserved" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."stock_movements" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."suppliers" ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."tax_rates" ALTER COLUMN "active" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."user_roles" ALTER COLUMN "user_id" SET NOT NULL,
ALTER COLUMN "role_id" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "password" VARCHAR(255),
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "is_deleted" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."branches" ADD CONSTRAINT "branches_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_default_billing_address_id_fkey" FOREIGN KEY ("default_billing_address_id") REFERENCES "public"."addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."department" ADD CONSTRAINT "department_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."municipality" ADD CONSTRAINT "municipality_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_levels" ADD CONSTRAINT "stock_levels_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_levels" ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_levels" ADD CONSTRAINT "stock_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_export_jobs" ADD CONSTRAINT "import_export_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
