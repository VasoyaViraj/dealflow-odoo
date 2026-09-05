CREATE TYPE "public"."billing_schedule_status" AS ENUM('UPCOMING', 'INVOICED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_status" AS ENUM('FULFILLED', 'BACKORDERED');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('ONE_TIME', 'SUBSCRIPTION');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."warehouse_priority" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
ALTER TYPE "public"."quotation_status" ADD VALUE 'NEGOTIATION_REQUESTED' BEFORE 'EXPIRED';--> statement-breakpoint
ALTER TYPE "public"."quotation_status" ADD VALUE 'CONFIRMED' BEFORE 'EXPIRED';--> statement-breakpoint
CREATE TABLE "billing_schedule_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"due_date" timestamp NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status" "billing_schedule_status" DEFAULT 'UPCOMING' NOT NULL,
	"invoice_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fulfillment_order_id" uuid NOT NULL,
	"shipment_id" uuid,
	"quotation_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"quantity" integer NOT NULL,
	"is_backorder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"status" "fulfillment_status" DEFAULT 'FULFILLED' NOT NULL,
	"strategy" text NOT NULL,
	"plan_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"sub_scores" jsonb,
	"reasons" jsonb,
	"total_shipping_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shipment_count" integer DEFAULT 0 NOT NULL,
	"max_delivery_days" integer DEFAULT 0 NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillment_orders_quotation_id_unique" UNIQUE("quotation_id")
);
--> statement-breakpoint
CREATE TABLE "fulfillment_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"weight_completeness" numeric(5, 2) DEFAULT '30' NOT NULL,
	"weight_shipping_cost" numeric(5, 2) DEFAULT '25' NOT NULL,
	"weight_delivery_time" numeric(5, 2) DEFAULT '20' NOT NULL,
	"weight_shipment_count" numeric(5, 2) DEFAULT '15' NOT NULL,
	"weight_inventory_preservation" numeric(5, 2) DEFAULT '10' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillment_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fulfillment_order_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"total_units" integer DEFAULT 0 NOT NULL,
	"shipping_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"delivery_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_sequence" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"quotation_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"type" "invoice_type" DEFAULT 'ONE_TIME' NOT NULL,
	"status" "invoice_status" DEFAULT 'ISSUED' NOT NULL,
	"line_snapshot" jsonb DEFAULT '[]' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_at" timestamp,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_number" text NOT NULL,
	"quotation_id" uuid NOT NULL,
	"quotation_line_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"subscription_plan_id" uuid,
	"product_name" text NOT NULL,
	"billing_cycle" "subscription_billing_cycle" NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '18' NOT NULL,
	"cycle_amount" numeric(14, 2) NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"next_billing_date" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"last_prorated_amount" numeric(14, 2),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_subscription_number_unique" UNIQUE("subscription_number"),
	CONSTRAINT "subscriptions_quotation_line_id_unique" UNIQUE("quotation_line_id")
);
--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "shipping_base_cost" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "cost_per_unit" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "delivery_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "priority" "warehouse_priority" DEFAULT 'MEDIUM' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_schedule_entries" ADD CONSTRAINT "billing_schedule_entries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_fulfillment_order_id_fulfillment_orders_id_fk" FOREIGN KEY ("fulfillment_order_id") REFERENCES "public"."fulfillment_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_shipment_id_fulfillment_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."fulfillment_shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_quotation_line_id_quotation_lines_id_fk" FOREIGN KEY ("quotation_line_id") REFERENCES "public"."quotation_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_orders" ADD CONSTRAINT "fulfillment_orders_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_orders" ADD CONSTRAINT "fulfillment_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_shipments" ADD CONSTRAINT "fulfillment_shipments_fulfillment_order_id_fulfillment_orders_id_fk" FOREIGN KEY ("fulfillment_order_id") REFERENCES "public"."fulfillment_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_shipments" ADD CONSTRAINT "fulfillment_shipments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_quotation_line_id_quotation_lines_id_fk" FOREIGN KEY ("quotation_line_id") REFERENCES "public"."quotation_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_schedule_subscription_idx" ON "billing_schedule_entries" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_schedule_due_date_idx" ON "billing_schedule_entries" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "fulfillment_allocations_order_idx" ON "fulfillment_allocations" USING btree ("fulfillment_order_id");--> statement-breakpoint
CREATE INDEX "fulfillment_allocations_line_idx" ON "fulfillment_allocations" USING btree ("quotation_line_id");--> statement-breakpoint
CREATE INDEX "fulfillment_orders_status_idx" ON "fulfillment_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "fulfillment_shipment_warehouse_idx" ON "fulfillment_shipments" USING btree ("fulfillment_order_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "invoices_quotation_idx" ON "invoices" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_quotation_idx" ON "subscriptions" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_idx" ON "subscriptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");