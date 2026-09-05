ALTER TYPE "public"."quotation_status" ADD VALUE 'EXPIRED';--> statement-breakpoint
ALTER TYPE "public"."quotation_status" ADD VALUE 'CANCELLED';--> statement-breakpoint
CREATE TABLE "quotation_sequence" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotation_lines" DROP CONSTRAINT "quotation_lines_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_sales_rep_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "discount_amount" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "discount_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "final_price" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "final_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "cost" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "margin" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "quotation_lines" ALTER COLUMN "margin" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "margin_percent" SET DATA TYPE numeric(7, 2);--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "margin_percent" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "risk_score" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "risk_score" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "approval_level" SET DEFAULT 'NONE';--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "approval_level" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "subscription_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "line_number" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "product_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "product_sku" text;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "category" "product_category" NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "unit_cost" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "tax_rate" numeric(5, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "gross_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "margin_percent" numeric(7, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "allocated_discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "net_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "line_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "max_discount_pct" numeric(5, 2) DEFAULT '100' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "discount_over_limit_pct" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "quotation_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "price_list_id" uuid;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "quotation_discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "line_discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "quotation_discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "total_cost" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sales_rep_id_users_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotation_lines_quotation_idx" ON "quotation_lines" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotation_lines_product_idx" ON "quotation_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "quotations_customer_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_sales_rep_idx" ON "quotations" USING btree ("sales_rep_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotations_created_at_idx" ON "quotations" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_quotation_number_unique" UNIQUE("quotation_number");