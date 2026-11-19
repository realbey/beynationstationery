-- WARNING: deletes ALL data in this app's tables (and the old enum types). Run only if you don't need it.
-- Your login users (Authentication) are NOT touched. Run schema.sql right after.
drop trigger if exists on_auth_user_created on auth.users;
drop view if exists low_stock_products;
drop table if exists audit_logs, financial_transactions, budgets, expenses, stock_movements,
  purchase_items, purchases, sales_return_items, sales_returns, sale_payments, sale_items, sales,
  products, customers, suppliers, categories, business_settings, profiles cascade;
drop function if exists process_pos_sale(uuid, jsonb, jsonb, numeric, numeric, uuid) cascade;
drop function if exists process_sale_return(uuid, jsonb, text, uuid) cascade;
drop function if exists process_sale_return(uuid, jsonb, text, uuid, text) cascade;
drop function if exists void_sale(uuid, text, uuid) cascade;
drop function if exists process_purchase(uuid, jsonb, numeric, text, uuid) cascade;
drop function if exists process_purchase(uuid, jsonb, numeric, text, uuid, text) cascade;
drop function if exists receive_customer_payment(uuid, numeric, text, text) cascade;
drop function if exists pay_supplier(uuid, numeric, text, text) cascade;
drop function if exists record_expense(text, text, numeric, text, date, text) cascade;
drop function if exists adjust_stock(uuid, int, text, text) cascade;
drop function if exists get_financial_summary(timestamptz, timestamptz) cascade;
drop function if exists get_series(timestamptz, timestamptz, text) cascade;
drop function if exists get_top_products(timestamptz, timestamptz, int) cascade;
drop function if exists get_category_breakdown(timestamptz, timestamptz) cascade;
drop function if exists get_payment_breakdown(timestamptz, timestamptz) cascade;
drop function if exists get_cash_opening(timestamptz) cascade;
drop function if exists app_tz() cascade;
drop function if exists audit_row() cascade;
drop function if exists _audit_attach(text, text[]) cascade;
drop function if exists _require(text[]) cascade;
drop function if exists handle_new_user() cascade;
drop function if exists get_user_role(uuid) cascade;
drop function if exists set_updated_at() cascade;
drop sequence if exists expense_seq, po_seq;
drop type if exists user_role, movement_type, payment_method, transaction_type, unit_type cascade;
