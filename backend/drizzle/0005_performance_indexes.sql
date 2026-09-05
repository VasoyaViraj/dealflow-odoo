CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_active_name_idx" ON "customers" USING btree ("is_active","name");--> statement-breakpoint
CREATE INDEX "customers_linked_user_idx" ON "customers" USING btree ("linked_user_id");--> statement-breakpoint
CREATE INDEX "products_active_category_name_idx" ON "products" USING btree ("is_active","category","name");--> statement-breakpoint
CREATE INDEX "quotations_status_updated_at_idx" ON "quotations" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "quotations_sales_rep_created_at_idx" ON "quotations" USING btree ("sales_rep_id","created_at");--> statement-breakpoint
CREATE INDEX "quotations_customer_created_at_idx" ON "quotations" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "fulfillment_orders_created_at_idx" ON "fulfillment_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "fulfillment_orders_status_created_at_idx" ON "fulfillment_orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "fulfillment_allocations_order_backorder_idx" ON "fulfillment_allocations" USING btree ("fulfillment_order_id","is_backorder");--> statement-breakpoint
CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoices_status_created_at_idx" ON "invoices" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "invoices_customer_created_at_idx" ON "invoices" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_status_created_at_idx" ON "subscriptions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_created_at_idx" ON "subscriptions" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_schedule_subscription_status_due_idx" ON "billing_schedule_entries" USING btree ("subscription_id","status","due_date");
