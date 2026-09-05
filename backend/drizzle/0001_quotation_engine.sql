-- Phase 3 — Quotation Engine.
--
-- This migration also contains the Phase 2 master-data tables (customers,
-- products, discount configuration, warehouses, inventory, subscription plans,
-- price lists). Those tables were originally applied with `drizzle-kit push`
-- rather than a generated migration, so drizzle's snapshot at 0000 only knew
-- about the Phase 1 auth tables and re-emitted them here.
--
-- Every statement is therefore written to be idempotent — CREATE TABLE /
-- INDEX IF NOT EXISTS, and guarded DO blocks around CREATE TYPE and
-- ADD CONSTRAINT. The file applies cleanly both to an existing database that
-- already has the pushed Phase 2 tables and to a fresh one built from
-- migrations alone.

DO $$ BEGIN
	CREATE TYPE "public"."customer_tier" AS ENUM('BRONZE', 'SILVER', 'GOLD');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."product_category" AS ENUM('HARDWARE', 'SERVICES', 'SUBSCRIPTION');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."quotation_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."subscription_billing_cycle" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"risk_score_threshold" numeric(5, 2) NOT NULL,
	"approval_level" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category_discount_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "product_category" NOT NULL,
	"max_discount_pct" numeric(5, 2) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_discount_limits_category_unique" UNIQUE("category")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"tier" "customer_tier" DEFAULT 'BRONZE' NOT NULL,
	"linked_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discount_tier_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "customer_tier" NOT NULL,
	"max_discount_pct" numeric(5, 2) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discount_tier_configs_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_list_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"override_price" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"description" text,
	"category" "product_category" NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"cost_price" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"subscription_plan_id" uuid,
	"line_number" integer NOT NULL,
	"product_name" text NOT NULL,
	"product_sku" text,
	"category" "product_category" NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"final_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"margin" numeric(14, 2) DEFAULT '0' NOT NULL,
	"margin_pct" numeric(7, 2) DEFAULT '0' NOT NULL,
	"allocated_discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"max_discount_pct" numeric(5, 2) DEFAULT '100' NOT NULL,
	"discount_over_limit_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_sequence" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"sales_rep_id" uuid NOT NULL,
	"price_list_id" uuid,
	"status" "quotation_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"quotation_discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"quotation_discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"margin" numeric(14, 2) DEFAULT '0' NOT NULL,
	"margin_pct" numeric(7, 2) DEFAULT '0' NOT NULL,
	"blended_risk_score" numeric(7, 2) DEFAULT '0' NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"required_approval_level" text DEFAULT 'NONE' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quotation_number_unique" UNIQUE("quotation_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"billing_cycle" "subscription_billing_cycle" NOT NULL,
	"price_multiplier" numeric(6, 4) DEFAULT '1.0000' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "customers" ADD CONSTRAINT "customers_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sales_rep_id_users_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "quotations" ADD CONSTRAINT "quotations_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_product_warehouse_idx" ON "inventory" USING btree ("product_id","warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "price_list_product_idx" ON "price_list_items" USING btree ("price_list_id","product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotation_lines_quotation_idx" ON "quotation_lines" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotation_lines_product_idx" ON "quotation_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotations_customer_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotations_sales_rep_idx" ON "quotations" USING btree ("sales_rep_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotations_status_idx" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotations_created_at_idx" ON "quotations" USING btree ("created_at");