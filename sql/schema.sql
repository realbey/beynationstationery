-- =====================================================================
-- MFINANGA STATIONERY — schema.sql  (re-runnable)
-- Run order on a fresh project:  schema.sql  only.
-- If the project holds OLD versions of these tables:  01_reset.sql  first.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
do $$ begin create type user_role as enum ('ADMIN','MANAGER','CASHIER','STOREKEEPER'); exception when duplicate_object then null; end $$;
do $$ begin create type movement_type as enum ('PURCHASE','SALE','RETURN','DAMAGE','ADJUSTMENT','OPENING_STOCK'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_method as enum ('CASH','MPESA','AIRTEL_MONEY','TIGO_PESA','BANK','OTHER'); exception when duplicate_object then null; end $$;
do $$ begin create type transaction_type as enum ('SALE','PURCHASE','EXPENSE','CUSTOMER_PAYMENT','SUPPLIER_PAYMENT','OTHER_INCOME','OTHER_EXPENSE','REFUND'); exception when duplicate_object then null; end $$;
do $$ begin create type unit_type as enum ('Piece','Box','Packet','Ream','Carton','Bottle','Dozen','Set','Other'); exception when duplicate_object then null; end $$;

-- ---------- HELPERS ----------
drop function if exists get_user_role(uuid) cascade;
create or replace function get_user_role(uid uuid) returns text
language plpgsql security definer stable set search_path = public as
$$ declare r text; begin select role::text into r from profiles where id = uid; return r; end $$;

create or replace function set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

create or replace function _require(roles text[]) returns void
language plpgsql stable security definer set search_path = public as
$$ begin
  if auth.uid() is null or not (get_user_role(auth.uid()) = any(roles)) then
    raise exception 'Not authorised';
  end if;
end $$;

-- ---------- TABLES ----------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text, role user_role not null default 'CASHIER',
  avatar_url text, active boolean not null default true,
  updated_at timestamptz default now());

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null, description text, created_at timestamptz default now());

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null, company text, phone text, email text, address text, tin_vat text, notes text,
  balance_due numeric(14,2) not null default 0 check (balance_due >= 0),
  created_at timestamptz default now());

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, email text, address text,
  customer_type text default 'RETAIL',
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),   -- 0 = no limit
  outstanding_balance numeric(14,2) not null default 0 check (outstanding_balance >= 0),
  notes text, created_at timestamptz default now());

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null, sku text unique, barcode text unique,
  category_id uuid references categories on delete set null,
  description text,
  buying_price numeric(14,2) not null default 0 check (buying_price >= 0),
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  current_stock integer not null default 0 check (current_stock >= 0),
  minimum_stock integer not null default 5 check (minimum_stock >= 0),
  unit unit_type not null default 'Piece',
  supplier_id uuid references suppliers on delete set null,
  active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now());

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique not null,
  customer_id uuid references customers,
  cashier_id uuid references profiles,
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  net_total numeric(14,2) not null default 0 check (net_total >= 0),
  payment_status text not null default 'PAID' check (payment_status in ('PAID','PARTIAL','CREDIT')),
  is_voided boolean not null default false,
  voided_by uuid, void_reason text, notes text,
  created_at timestamptz default now());

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales on delete cascade,
  product_id uuid not null references products,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  buying_price_at_sale numeric(14,2) not null check (buying_price_at_sale >= 0),   -- historical COGS snapshot
  subtotal numeric(14,2) not null check (subtotal >= 0),
  unique (sale_id, product_id));

create table if not exists sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales on delete cascade,
  payment_method payment_method not null,
  amount_paid numeric(14,2) not null check (amount_paid > 0),
  reference_number text, created_at timestamptz default now());

create table if not exists sales_returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales,
  returned_by uuid, reason text,
  net_refund numeric(14,2) not null default 0,           -- excl. tax (used by P&L)
  total_refund_amount numeric(14,2) not null default 0,  -- incl. tax
  credit_offset numeric(14,2) not null default 0,        -- part settled against customer's debt
  created_at timestamptz default now());

create table if not exists sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references sales_returns on delete cascade,
  product_id uuid not null references products,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  unit_cost numeric(14,2) not null default 0);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_order_no text unique not null,
  supplier_id uuid references suppliers, created_by uuid,
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'PAID' check (status in ('PAID','PARTIAL','UNPAID')),
  notes text, created_at timestamptz default now());

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases on delete cascade,
  product_id uuid not null references products,
  quantity integer not null check (quantity > 0),
  unit_buying_price numeric(14,2) not null check (unit_buying_price >= 0),
  subtotal numeric(14,2) not null check (subtotal >= 0));

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products,
  movement_type movement_type not null,
  quantity integer not null, reference_id uuid, created_by uuid, notes text,
  created_at timestamptz default now());

create sequence if not exists expense_seq;
create sequence if not exists po_seq;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text unique not null default ('EXP-' || lpad(nextval('expense_seq')::text, 5, '0')),
  category text not null, description text,
  amount numeric(14,2) not null check (amount > 0),
  payment_method payment_method not null default 'CASH',
  recorded_by uuid, expense_date date not null default current_date, notes text,
  created_at timestamptz default now());

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  budgeted_amount numeric(14,2) not null check (budgeted_amount > 0),
  period_type text not null default 'MONTHLY' check (period_type in ('WEEKLY','MONTHLY','YEARLY','CUSTOM')),
  start_date date not null, end_date date not null check (end_date >= start_date),
  created_at timestamptz default now());

create table if not exists financial_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type transaction_type not null,
  reference_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  flow_type text not null check (flow_type in ('IN','OUT')),
  payment_method payment_method, description text, recorded_by uuid,
  transaction_date timestamptz not null default now(), created_at timestamptz default now());

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete set null,
  action text, module text, record_id uuid,
  previous_state jsonb, new_state jsonb, created_at timestamptz default now());

create table if not exists business_settings (
  id int primary key default 1 check (id = 1),
  business_name text default 'MFINANGA STATIONERY', logo_url text,
  phone text, email text, address text, tin_vat text,
  currency text default 'TZS', default_tax_rate numeric default 18,
  receipt_footer text default 'Asante kwa kununua! / Thank you!',
  timezone text default 'Africa/Dar_es_Salaam');

-- ---------- INDEXES ----------
create index if not exists idx_sales_created on sales (created_at);
create index if not exists idx_sales_customer on sales (customer_id);
create index if not exists idx_sale_items_sale on sale_items (sale_id);
create index if not exists idx_sale_items_product on sale_items (product_id);
create index if not exists idx_sale_pay_sale on sale_payments (sale_id);
create index if not exists idx_returns_sale on sales_returns (sale_id);
create index if not exists idx_stock_mov_product on stock_movements (product_id, created_at);
create index if not exists idx_expenses_date on expenses (expense_date);
create index if not exists idx_fin_date on financial_transactions (transaction_date);
create index if not exists idx_fin_ref on financial_transactions (reference_id);
create index if not exists idx_audit_created on audit_logs (created_at);
create index if not exists idx_products_cat on products (category_id);

-- ---------- TRIGGERS ----------
drop trigger if exists trg_products_upd on products;
create trigger trg_products_upd before update on products for each row execute function set_updated_at();

create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as
$$
declare v_old jsonb; v_new jsonb; rid uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  begin rid := (coalesce(v_new, v_old) ->> 'id')::uuid; exception when others then rid := null; end;
  insert into audit_logs (user_id, action, module, record_id, previous_state, new_state)
  values (auth.uid(), tg_op, tg_table_name, rid, v_old, v_new);
  return coalesce(new, old);
end $$;

-- attach audit: insert/delete always, update only when a "real" column changed
create or replace function _audit_attach(tbl text, ignore text[]) returns void language plpgsql as
$$
begin
  execute format('drop trigger if exists %I on public.%I', 'trg_audit_iud_' || tbl, tbl);
  execute format('drop trigger if exists %I on public.%I', 'trg_audit_u_' || tbl, tbl);
  execute format('create trigger %I after insert or delete on public.%I for each row execute function audit_row()', 'trg_audit_iud_' || tbl, tbl);
  execute format('create trigger %I after update on public.%I for each row when ((to_jsonb(old) - %L::text[]) is distinct from (to_jsonb(new) - %L::text[])) execute function audit_row()',
                 'trg_audit_u_' || tbl, tbl, ignore, ignore);
end $$;

select _audit_attach('products',  array['current_stock','updated_at']);
select _audit_attach('customers', array['outstanding_balance']);
select _audit_attach('suppliers', array['balance_due']);
select _audit_attach('categories', array[]::text[]);
select _audit_attach('expenses',  array[]::text[]);
select _audit_attach('budgets',   array[]::text[]);
select _audit_attach('business_settings', array[]::text[]);

-- auto-create profile on signup (first account ever = ADMIN / owner)
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as
$$
declare r user_role;
begin
  if not exists (select 1 from profiles) then r := 'ADMIN'; else r := 'CASHIER'; end if;
  insert into profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), r)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- =====================================================================
-- ATOMIC RPC FUNCTIONS
-- =====================================================================

-- ---- 1. POS SALE ----
create or replace function process_pos_sale(
  p_customer_id uuid, p_items jsonb, p_payments jsonb,
  p_discount numeric, p_tax numeric, p_cashier_id uuid)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  rec record; pay jsonb; prod products%rowtype; cust customers%rowtype;
  v_sale uuid := gen_random_uuid();
  v_total numeric := 0; v_disc numeric := coalesce(p_discount, 0); v_tax numeric := coalesce(p_tax, 0);
  v_net numeric; v_paid numeric := 0; v_due numeric; v_amt numeric;
  v_rc text; v_seq int; v_tz text; v_status text;
begin
  perform _require(array['ADMIN','MANAGER','CASHIER']);
  if p_cashier_id is distinct from auth.uid() then raise exception 'Cashier mismatch'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty'; end if;
  if v_disc < 0 or v_tax < 0 then raise exception 'Invalid discount or tax'; end if;

  perform pg_advisory_xact_lock(hashtext('receipt_no'));
  select coalesce(timezone, 'Africa/Dar_es_Salaam') into v_tz from business_settings where id = 1;
  v_tz := coalesce(v_tz, 'Africa/Dar_es_Salaam');
  select count(*) + 1 into v_seq from sales
    where (created_at at time zone v_tz)::date = (now() at time zone v_tz)::date;
  v_rc := 'REC-' || to_char(now() at time zone v_tz, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  insert into sales (id, receipt_number, customer_id, cashier_id) values (v_sale, v_rc, p_customer_id, auth.uid());

  for rec in
    select (e ->> 'product_id')::uuid as pid, sum((e ->> 'quantity')::int) as q
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if rec.q <= 0 then raise exception 'Invalid quantity'; end if;
    select * into prod from products where id = rec.pid and active for update;
    if not found then raise exception 'Product not found or inactive'; end if;
    if prod.current_stock < rec.q then
      raise exception 'Insufficient stock for %: available %, requested %', prod.name, prod.current_stock, rec.q; end if;
    insert into sale_items (sale_id, product_id, quantity, unit_price, buying_price_at_sale, subtotal)
      values (v_sale, prod.id, rec.q, prod.selling_price, prod.buying_price, prod.selling_price * rec.q);
    update products set current_stock = current_stock - rec.q where id = prod.id;
    insert into stock_movements (product_id, movement_type, quantity, reference_id, created_by)
      values (prod.id, 'SALE', -rec.q, v_sale, auth.uid());
    v_total := v_total + prod.selling_price * rec.q;
  end loop;

  if v_disc > v_total then raise exception 'Discount exceeds total'; end if;
  v_net := v_total - v_disc + v_tax;

  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_amt := (pay ->> 'amount')::numeric;
    if v_amt is null or v_amt <= 0 then raise exception 'Invalid payment amount'; end if;
    insert into sale_payments (sale_id, payment_method, amount_paid, reference_number)
      values (v_sale, (pay ->> 'method')::payment_method, v_amt, nullif(pay ->> 'reference', ''));
    insert into financial_transactions (transaction_type, reference_id, amount, flow_type, payment_method, description, recorded_by)
      values ('SALE', v_sale, v_amt, 'IN', (pay ->> 'method')::payment_method, v_rc, auth.uid());
    v_paid := v_paid + v_amt;
  end loop;
  if v_paid > v_net then raise exception 'Payment exceeds the sale total'; end if;

  v_due := v_net - v_paid;
  if v_due > 0 then
    if p_customer_id is null then raise exception 'Select a customer for credit sales'; end if;
    select * into cust from customers where id = p_customer_id for update;
    if not found then raise exception 'Customer not found'; end if;
    if cust.credit_limit > 0 and cust.outstanding_balance + v_due > cust.credit_limit then
      raise exception 'Credit limit exceeded for %', cust.name; end if;
    update customers set outstanding_balance = outstanding_balance + v_due where id = p_customer_id;
    v_status := case when v_paid = 0 then 'CREDIT' else 'PARTIAL' end;
  else
    v_status := 'PAID';
  end if;

  update sales set total_amount = v_total, discount_amount = v_disc, tax_amount = v_tax,
                   net_total = v_net, payment_status = v_status where id = v_sale;
  insert into audit_logs (user_id, action, module, record_id, new_state)
    values (auth.uid(), 'CREATE', 'sales', v_sale, jsonb_build_object('receipt', v_rc, 'net_total', v_net, 'paid', v_paid, 'status', v_status));
  return jsonb_build_object('sale_id', v_sale, 'receipt_number', v_rc, 'net_total', v_net, 'paid', v_paid, 'due', v_due);
end $$;

-- ---- 2. SALE RETURN ----
create or replace function process_sale_return(
  p_sale_id uuid, p_items jsonb, p_reason text, p_user_id uuid, p_method text default 'CASH')
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  s sales%rowtype; si sale_items%rowtype; rec record; cust customers%rowtype;
  v_ret uuid := gen_random_uuid(); v_prev int; v_factor numeric;
  v_net numeric := 0; v_tax numeric := 0; v_total numeric; v_paid numeric; v_prev_off numeric;
  v_unpaid numeric := 0; v_off numeric := 0; v_cash numeric;
begin
  perform _require(array['ADMIN','MANAGER','CASHIER']);
  if p_user_id is distinct from auth.uid() then raise exception 'User mismatch'; end if;
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if s.is_voided then raise exception 'Sale is already void'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nothing to return'; end if;

  v_factor := case when s.total_amount > 0 then 1 - (s.discount_amount / s.total_amount) else 1 end;
  insert into sales_returns (id, sale_id, returned_by, reason) values (v_ret, p_sale_id, auth.uid(), p_reason);

  for rec in
    select (e ->> 'product_id')::uuid as pid, sum((e ->> 'quantity')::int) as q
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if rec.q <= 0 then continue; end if;
    select * into si from sale_items where sale_id = p_sale_id and product_id = rec.pid;
    if not found then raise exception 'Product not part of this sale'; end if;
    select coalesce(sum(ri.quantity), 0) into v_prev
      from sales_return_items ri join sales_returns r on r.id = ri.return_id
      where r.sale_id = p_sale_id and ri.product_id = rec.pid;
    if rec.q > si.quantity - v_prev then
      raise exception 'Return quantity exceeds what is left to return (max %)', si.quantity - v_prev; end if;
    insert into sales_return_items (return_id, product_id, quantity, unit_price, unit_cost)
      values (v_ret, rec.pid, rec.q, si.unit_price, si.buying_price_at_sale);
    update products set current_stock = current_stock + rec.q where id = rec.pid;
    insert into stock_movements (product_id, movement_type, quantity, reference_id, created_by, notes)
      values (rec.pid, 'RETURN', rec.q, v_ret, auth.uid(), 'Return ' || s.receipt_number);
    v_net := v_net + round(rec.q * si.unit_price * v_factor, 2);
  end loop;
  if v_net <= 0 then raise exception 'Nothing to return'; end if;

  if s.tax_amount > 0 and (s.total_amount - s.discount_amount) > 0 then
    v_tax := round(v_net * s.tax_amount / (s.total_amount - s.discount_amount), 2); end if;
  v_total := v_net + v_tax;

  if s.customer_id is not null then
    select coalesce(sum(amount_paid), 0) into v_paid from sale_payments where sale_id = s.id;
    select coalesce(sum(r.credit_offset), 0) into v_prev_off from sales_returns r where r.sale_id = s.id;
    v_unpaid := greatest(s.net_total - v_paid - v_prev_off, 0);
    select * into cust from customers where id = s.customer_id for update;
    v_off := least(v_total, v_unpaid, cust.outstanding_balance);
    if v_off > 0 then
      update customers set outstanding_balance = outstanding_balance - v_off where id = s.customer_id; end if;
  end if;

  v_cash := v_total - v_off;
  if v_cash > 0 then
    insert into financial_transactions (transaction_type, reference_id, amount, flow_type, payment_method, description, recorded_by)
      values ('REFUND', v_ret, v_cash, 'OUT', coalesce(p_method, 'CASH')::payment_method, 'Return ' || s.receipt_number, auth.uid());
  end if;

  update sales_returns set net_refund = v_net, total_refund_amount = v_total, credit_offset = v_off where id = v_ret;
  insert into audit_logs (user_id, action, module, record_id, new_state)
    values (auth.uid(), 'RETURN', 'sales', p_sale_id, jsonb_build_object('receipt', s.receipt_number, 'refund', v_total, 'reason', p_reason));
  return jsonb_build_object('return_id', v_ret, 'refund', v_total, 'cash_out', v_cash, 'credit_offset', v_off);
end $$;

-- ---- 3. VOID SALE ----
create or replace function void_sale(p_sale_id uuid, p_reason text, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare s sales%rowtype; it record; pay record; cust customers%rowtype; v_paid numeric; v_due numeric;
begin
  perform _require(array['ADMIN','MANAGER']);
  if p_user_id is distinct from auth.uid() then raise exception 'User mismatch'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'A reason is required'; end if;
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if s.is_voided then raise exception 'Sale is already void'; end if;
  if exists (select 1 from sales_returns where sale_id = p_sale_id) then
    raise exception 'This sale already has returns and cannot be voided'; end if;

  for it in select product_id, quantity from sale_items where sale_id = p_sale_id order by product_id loop
    update products set current_stock = current_stock + it.quantity where id = it.product_id;
    insert into stock_movements (product_id, movement_type, quantity, reference_id, created_by, notes)
      values (it.product_id, 'RETURN', it.quantity, p_sale_id, auth.uid(), 'VOID ' || s.receipt_number);
  end loop;

  v_paid := 0;
  for pay in select payment_method, amount_paid from sale_payments where sale_id = p_sale_id loop
    insert into financial_transactions (transaction_type, reference_id, amount, flow_type, payment_method, description, recorded_by)
      values ('REFUND', p_sale_id, pay.amount_paid, 'OUT', pay.payment_method, 'VOID ' || s.receipt_number, auth.uid());
    v_paid := v_paid + pay.amount_paid;
  end loop;

  v_due := s.net_total - v_paid;
  if s.customer_id is not null and v_due > 0 then
    select * into cust from customers where id = s.customer_id for update;
    update customers set outstanding_balance = greatest(outstanding_balance - v_due, 0) where id = s.customer_id;
  end if;

  update sales set is_voided = true, voided_by = auth.uid(), void_reason = p_reason where id = p_sale_id;
  insert into audit_logs (user_id, action, module, record_id, new_state)
    values (auth.uid(), 'VOID', 'sales', p_sale_id, jsonb_build_object('receipt', s.receipt_number, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

-- ---- 4. PURCHASE ----
create or replace function process_purchase(
  p_supplier_id uuid, p_items jsonb, p_paid_amount numeric, p_payment_method text, p_user_id uuid, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  it jsonb; v_id uuid := gen_random_uuid(); v_po text; v_total numeric := 0; v_paid numeric := coalesce(p_paid_amount, 0);
  v_qty int; v_price numeric; v_status text; v_tz text;
begin
  perform _require(array['ADMIN','MANAGER','STOREKEEPER']);
  if p_user_id is distinct from auth.uid() then raise exception 'User mismatch'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No items'; end if;
  if v_paid < 0 then raise exception 'Invalid paid amount'; end if;

  perform 1 from products where id in (select (e ->> 'product_id')::uuid from jsonb_array_elements(p_items) e) order by id for update;

  select coalesce(timezone, 'Africa/Dar_es_Salaam') into v_tz from business_settings where id = 1;
  v_po := 'PO-' || to_char(now() at time zone coalesce(v_tz, 'Africa/Dar_es_Salaam'), 'YYYYMMDD') || '-' || lpad(nextval('po_seq')::text, 4, '0');
  insert into purchases (id, purchase_order_no, supplier_id, created_by, notes) values (v_id, v_po, p_supplier_id, auth.uid(), p_notes);

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it ->> 'quantity')::int; v_price := (it ->> 'unit_buying_price')::numeric;
    if v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then raise exception 'Invalid item'; end if;
    insert into purchase_items (purchase_id, product_id, quantity, unit_buying_price, subtotal)
      values (v_id, (it ->> 'product_id')::uuid, v_qty, v_price, v_qty * v_price);
    update products set current_stock = current_stock + v_qty, buying_price = v_price
      where id = (it ->> 'product_id')::uuid;
    if not found then raise exception 'Product not found'; end if;
    insert into stock_movements (product_id, movement_type, quantity, reference_id, created_by, notes)
      values ((it ->> 'product_id')::uuid, 'PURCHASE', v_qty, v_id, auth.uid(), v_po);
    v_total := v_total + v_qty * v_price;
  end loop;

  if v_paid > v_total then raise exception 'Paid amount exceeds the purchase total'; end if;
  if v_paid < v_total and p_supplier_id is null then raise exception 'Select a supplier for unpaid purchases'; end if;
  v_status := case when v_paid >= v_total then 'PAID' when v_paid = 0 then 'UNPAID' else 'PARTIAL' end;
  update purchases set total_amount = v_total, paid_amount = v_paid, status = v_status where id = v_id;

  if p_supplier_id is not null and v_total - v_paid > 0 then
    update suppliers set balance_due = balance_due + (v_total - v_paid) where id = p_supplier_id; end if;
  if v_paid > 0 then
    insert into financial_transactions (transaction_type, reference_id, amount, flow_type, payment_method, description, recorded_by)
      values ('PURCHASE', v_id, v_paid, 'OUT', coalesce(p_payment_method, 'CASH')::payment_method, v_po, auth.uid()); end if;

  insert into audit_logs (user_id, action, module, record_id, new_state)
    values (auth.uid(), 'CREATE', 'purchases', v_id, jsonb_build_object('po', v_po, 'total', v_total, 'paid', v_paid));
  return jsonb_build_object('purchase_id', v_id, 'po', v_po, 'total', v_total, 'paid', v_paid, 'status', v_status);
end $$;

-- ---- 5. PAYMENTS (customers / suppliers) ----
create or replace function receive_customer_payment(p_customer_id uuid, p_amount numeric, p_method text, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare c customers%rowtype;
begin
  perform _require(array['ADMIN','MANAGER','CASHIER']);
  if p_amount is null or p_amount <= 0 then raise exception 'Invalid amount'; end if;
  select * into c from customers where id = p_customer_id for update;
  if not found then raise exception 'Customer not found'; end if;
  if p_amount > c.outstanding_balance then raise exception 'Amount exceeds the outstanding balance (%)', c.outstanding_balance; end if;
  update customers set outstanding_balance = outstanding_balance - p_amount where id = p_customer_id;
  insert into financial_transactions (transaction_type, reference_id, amount, flow_type, payment_method, description, recorded_by)
    values ('CUSTOMER_PAYMENT', p_customer_id, p_amount, 'IN', coalesce(p_method, 'CASH')::payment_method, coalesce(p_notes, 'Debt payment: ' || c.name), auth.uid());
  insert into audit_logs (user_id, action, module, record_id, new_state)
    values (auth.uid(), 'PAYMENT', 'customers', p_customer_id, jsonb_build_object('amount', p_amount));
  return jsonb_build_object('balance', c.outstanding_balance - p_amount);
end $$;

create or replace function pay_supplier(p_supplier_id uuid, p_amount numeric, p_method text, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare s suppliers%rowtype;
begin
  perform _require(array['ADMIN','MANAGER']);
  if p_amount is null or p_amount <= 0 then raise exception 'Invalid amount'; end if;
  select * into s from suppliers where id = p_supplier_id for update;
  if not found then raise exception 'Supplier not found'; end if;
  if p_amount > s.balance_due then raise exception 'Amount exceeds the balance due (%)', s.balance_due; end if;
  update suppliers set balance_due = balance_due - p_amount where id = p_supplier_id;
  insert into financial_transactions (transaction_type, reference_id, amount, flow_type, payment_method, description, recorded_by)
    values ('SUPPLIER_PAYMENT', p_supplier_id, p_amount, 'OUT', coalesce(p_method, 'CASH')::payment_method, coalesce(p_notes, 'Supplier payment: ' || s.name), auth.uid());
  insert into audit_logs (user_id, action, module, record_id, new_state)
    values (auth.uid(), 'PAYMENT', 'suppliers', p_supplier_id, jsonb_build_object('amount', p_amount));
  return jsonb_build_object('balance', s.balance_due - p_amount);
end $$;

-- ---- 6. EXPENSE ----
create or replace function record_expense(p_category text, p_description text, p_amount numeric, p_method text, p_date date, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as
$$
declare v_id uuid := gen_random_uuid(); v_no text;
begin
  perform _require(array['ADMIN','MANAGER']);
  if p_amount is null or p_amount <= 0 then raise exception 'Invalid amount'; end if;
  if p_category is null or length(trim(p_category)) = 0 then raise exception 'Category required'; end if;
  v_no := 'EXP-' || lpad(nextval('expense_seq')::text, 5, '0');
  insert into expenses (id, expense_number, category, description, amount, payment_method, recorded_by, expense_date, notes)
    values (v_id, v_no, trim(p_category), p_description, p_amount, coalesce(p_method, 'CASH')::payment_method, auth.uid(), coalesce(p_date, current_date), p_notes);
  insert into financial_transactions (transaction_type, reference_id, amount, flow_type, payment_method, description, recorded_by, transaction_date)
    values ('EXPENSE', v_id, p_amount, 'OUT', coalesce(p_method, 'CASH')::payment_method, trim(p_category) || coalesce(' - ' || p_description, ''), auth.uid(), now());
  return v_id;
end $$;

-- ---- 7. STOCK ADJUSTMENT ----
create or replace function adjust_stock(p_product_id uuid, p_delta int, p_type text, p_notes text default null)
returns int language plpgsql security definer set search_path = public as
$$
declare p products%rowtype; v_delta int := p_delta;
begin
  perform _require(array['ADMIN','MANAGER','STOREKEEPER']);
  if p_type not in ('ADJUSTMENT','DAMAGE','OPENING_STOCK') then raise exception 'Invalid movement type'; end if;
  if p_type = 'DAMAGE' then v_delta := -abs(p_delta); end if;
  if v_delta = 0 then raise exception 'Quantity cannot be zero'; end if;
  select * into p from products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if p.current_stock + v_delta < 0 then raise exception 'Stock cannot go below zero (current %)', p.current_stock; end if;
  update products set current_stock = current_stock + v_delta where id = p_product_id;
  insert into stock_movements (product_id, movement_type, quantity, created_by, notes)
    values (p_product_id, p_type::movement_type, v_delta, auth.uid(), p_notes);
  insert into audit_logs (user_id, action, module, record_id, previous_state, new_state)
    values (auth.uid(), p_type, 'products', p_product_id, jsonb_build_object('stock', p.current_stock), jsonb_build_object('stock', p.current_stock + v_delta, 'notes', p_notes));
  return p.current_stock + v_delta;
end $$;

-- =====================================================================
-- ANALYTICS (SECURITY INVOKER -> RLS applies)
-- =====================================================================
create or replace function app_tz() returns text language sql stable as
$$ select coalesce((select timezone from business_settings where id = 1), 'Africa/Dar_es_Salaam') $$;

create or replace function get_financial_summary(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable as
$$
declare
  v_rev numeric; v_disc numeric; v_tax numeric; v_cnt int; v_cogs numeric; v_ref numeric; v_rcogs numeric;
  v_exp numeric; v_in numeric; v_out numeric; v_cash numeric; v_credit numeric; v_sdue numeric;
  v_sval numeric; v_rval numeric; v_prod int; v_low int; v_zero int; v_net_rev numeric; v_gross numeric;
begin
  select coalesce(sum(total_amount - discount_amount), 0), coalesce(sum(discount_amount), 0), coalesce(sum(tax_amount), 0), count(*)
    into v_rev, v_disc, v_tax, v_cnt
    from sales where not is_voided and created_at >= p_from and created_at < p_to;
  select coalesce(sum(si.quantity * si.buying_price_at_sale), 0) into v_cogs
    from sale_items si join sales s on s.id = si.sale_id
    where not s.is_voided and s.created_at >= p_from and s.created_at < p_to;
  select coalesce(sum(r.net_refund), 0) into v_ref
    from sales_returns r join sales s on s.id = r.sale_id
    where not s.is_voided and r.created_at >= p_from and r.created_at < p_to;
  select coalesce(sum(ri.quantity * ri.unit_cost), 0) into v_rcogs
    from sales_return_items ri join sales_returns r on r.id = ri.return_id join sales s on s.id = r.sale_id
    where not s.is_voided and r.created_at >= p_from and r.created_at < p_to;
  select coalesce(sum(amount), 0) into v_exp from expenses
    where expense_date >= (p_from at time zone app_tz())::date and expense_date < (p_to at time zone app_tz())::date;
  select coalesce(sum(amount) filter (where flow_type = 'IN'), 0), coalesce(sum(amount) filter (where flow_type = 'OUT'), 0)
    into v_in, v_out from financial_transactions where transaction_date >= p_from and transaction_date < p_to;
  select coalesce(sum(case when flow_type = 'IN' then amount else -amount end), 0) into v_cash from financial_transactions;
  select coalesce(sum(outstanding_balance), 0) into v_credit from customers;
  select coalesce(sum(balance_due), 0) into v_sdue from suppliers;
  select coalesce(sum(current_stock * buying_price), 0), coalesce(sum(current_stock * selling_price), 0),
         count(*), count(*) filter (where current_stock > 0 and current_stock <= minimum_stock), count(*) filter (where current_stock <= 0)
    into v_sval, v_rval, v_prod, v_low, v_zero from products where active;
  v_net_rev := v_rev - v_ref;
  v_gross := v_net_rev - (v_cogs - v_rcogs);
  return jsonb_build_object(
    'revenue_gross', v_rev, 'refunds', v_ref, 'revenue', v_net_rev, 'discounts', v_disc, 'tax', v_tax, 'sales_count', v_cnt,
    'cogs', v_cogs - v_rcogs, 'gross_profit', v_gross, 'expenses', v_exp, 'net_profit', v_gross - v_exp,
    'cash_in', v_in, 'cash_out', v_out, 'cash_balance', v_cash, 'credit_outstanding', v_credit, 'supplier_due', v_sdue,
    'stock_value', v_sval, 'retail_value', v_rval, 'products', v_prod, 'low_stock', v_low, 'out_of_stock', v_zero);
end $$;

create or replace function get_series(p_from timestamptz, p_to timestamptz, p_unit text default 'day')
returns table (bucket date, revenue numeric, spent numeric) language sql stable as
$$
  with t as (
    select (s.created_at at time zone app_tz())::date as d, (s.total_amount - s.discount_amount) as rev, 0::numeric as sp
      from sales s where not s.is_voided and s.created_at >= p_from and s.created_at < p_to
    union all
    select (r.created_at at time zone app_tz())::date, -r.net_refund, 0::numeric
      from sales_returns r join sales s on s.id = r.sale_id
      where not s.is_voided and r.created_at >= p_from and r.created_at < p_to
    union all
    select e.expense_date, 0::numeric, e.amount from expenses e
      where e.expense_date >= (p_from at time zone app_tz())::date and e.expense_date < (p_to at time zone app_tz())::date
  )
  select date_trunc(case when p_unit = 'month' then 'month' else 'day' end, d::timestamp)::date, sum(rev), sum(sp)
  from t group by 1 order by 1
$$;

create or replace function get_top_products(p_from timestamptz, p_to timestamptz, p_limit int default 10)
returns table (product_id uuid, name text, qty bigint, revenue numeric) language sql stable as
$$
  select p.id, p.name, sum(si.quantity)::bigint, sum(si.subtotal)
  from sale_items si join sales s on s.id = si.sale_id join products p on p.id = si.product_id
  where not s.is_voided and s.created_at >= p_from and s.created_at < p_to
  group by p.id, p.name order by sum(si.subtotal) desc limit p_limit
$$;

create or replace function get_category_breakdown(p_from timestamptz, p_to timestamptz)
returns table (category text, revenue numeric) language sql stable as
$$
  select coalesce(c.name, 'Uncategorised'), sum(si.subtotal)
  from sale_items si join sales s on s.id = si.sale_id join products p on p.id = si.product_id
  left join categories c on c.id = p.category_id
  where not s.is_voided and s.created_at >= p_from and s.created_at < p_to
  group by 1 order by 2 desc
$$;

create or replace function get_payment_breakdown(p_from timestamptz, p_to timestamptz)
returns table (method text, flow text, total numeric) language sql stable as
$$
  select coalesce(payment_method::text, 'OTHER'), flow_type, sum(amount)
  from financial_transactions where transaction_date >= p_from and transaction_date < p_to
  group by 1, 2 order by 1, 2
$$;

create or replace function get_cash_opening(p_before timestamptz) returns numeric language sql stable as
$$ select coalesce(sum(case when flow_type = 'IN' then amount else -amount end), 0) from financial_transactions where transaction_date < p_before $$;

create or replace view low_stock_products with (security_invoker = true) as
  select id, name, sku, current_stock, minimum_stock, unit from products
  where active and current_stock <= minimum_stock;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
do $do$ declare t text; begin
  foreach t in array array['profiles','categories','suppliers','customers','products','sales','sale_items','sale_payments',
    'sales_returns','sales_return_items','purchases','purchase_items','stock_movements','expenses','budgets',
    'financial_transactions','audit_logs','business_settings'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $do$;

create or replace function _pol(t text, n text, c text, r text[]) returns void language plpgsql as
$fn$
declare cond text := format('get_user_role(auth.uid()) = any(%L::text[])', r); u text := ''; w text := '';
begin
  execute format('drop policy if exists %I on public.%I', n, t);
  if c in ('select','delete','update','all') then u := 'using (' || cond || ')'; end if;
  if c in ('insert','update','all') then w := 'with check (' || cond || ')'; end if;
  execute format('create policy %I on public.%I for %s to authenticated %s %s', n, t, c, u, w);
end $fn$;

do $do$ declare t text; begin
  -- ADMIN: everything
  foreach t in array array['profiles','categories','suppliers','customers','products','sales','sale_items','sale_payments',
    'sales_returns','sales_return_items','purchases','purchase_items','stock_movements','expenses','budgets',
    'financial_transactions','audit_logs','business_settings'] loop
    perform _pol(t, t || '_admin', 'all', array['ADMIN']);
  end loop;
  -- MANAGER: sales, purchases, inventory, expenses, reports, finance
  foreach t in array array['categories','suppliers','customers','products','sales','sale_items','sale_payments','sales_returns',
    'sales_return_items','purchases','purchase_items','stock_movements','expenses','budgets','financial_transactions'] loop
    perform _pol(t, t || '_mgr', 'all', array['MANAGER']);
  end loop;
  perform _pol('audit_logs', 'audit_logs_mgr_r', 'select', array['MANAGER']);
  -- STOREKEEPER: products, categories, stock, purchases, suppliers
  foreach t in array array['products','categories','stock_movements','purchases','purchase_items','suppliers'] loop
    perform _pol(t, t || '_sk', 'all', array['STOREKEEPER']);
  end loop;
  -- CASHIER: read products/customers/categories, add customers
  foreach t in array array['products','categories','customers'] loop
    perform _pol(t, t || '_cash_r', 'select', array['CASHIER']);
  end loop;
  perform _pol('customers', 'customers_cash_i', 'insert', array['CASHIER']);
  -- everyone signed in can read shop settings and staff names
  perform _pol('business_settings', 'settings_read', 'select', array['ADMIN','MANAGER','CASHIER','STOREKEEPER']);
  perform _pol('profiles', 'profiles_read', 'select', array['ADMIN','MANAGER','CASHIER','STOREKEEPER']);
end $do$;

-- own profile (name / avatar only; role cannot change)
drop policy if exists profiles_self_upd on profiles;
create policy profiles_self_upd on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role::text = get_user_role(auth.uid()));

-- cashiers see only their own sales (and the lines belonging to them)
drop policy if exists sales_cash_own on sales;
create policy sales_cash_own on sales for select to authenticated using (cashier_id = auth.uid());
drop policy if exists sale_items_cash_own on sale_items;
create policy sale_items_cash_own on sale_items for select to authenticated
  using (exists (select 1 from sales s where s.id = sale_items.sale_id and s.cashier_id = auth.uid()));
drop policy if exists sale_pay_cash_own on sale_payments;
create policy sale_pay_cash_own on sale_payments for select to authenticated
  using (exists (select 1 from sales s where s.id = sale_payments.sale_id and s.cashier_id = auth.uid()));
drop policy if exists returns_cash_own on sales_returns;
create policy returns_cash_own on sales_returns for select to authenticated
  using (exists (select 1 from sales s where s.id = sales_returns.sale_id and s.cashier_id = auth.uid()));
drop policy if exists return_items_cash_own on sales_return_items;
create policy return_items_cash_own on sales_return_items for select to authenticated
  using (exists (select 1 from sales_returns r join sales s on s.id = r.sale_id where r.id = sales_return_items.return_id and s.cashier_id = auth.uid()));

drop function _pol(text, text, text, text[]);

-- lock down RPC execution to signed-in users
do $do$ declare f text; begin
  foreach f in array array[
    'process_pos_sale(uuid,jsonb,jsonb,numeric,numeric,uuid)',
    'process_sale_return(uuid,jsonb,text,uuid,text)',
    'void_sale(uuid,text,uuid)',
    'process_purchase(uuid,jsonb,numeric,text,uuid,text)',
    'receive_customer_payment(uuid,numeric,text,text)',
    'pay_supplier(uuid,numeric,text,text)',
    'record_expense(text,text,numeric,text,date,text)',
    'adjust_stock(uuid,int,text,text)',
    'get_financial_summary(timestamptz,timestamptz)',
    'get_series(timestamptz,timestamptz,text)',
    'get_top_products(timestamptz,timestamptz,int)',
    'get_category_breakdown(timestamptz,timestamptz)',
    'get_payment_breakdown(timestamptz,timestamptz)',
    'get_cash_opening(timestamptz)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $do$;

-- =====================================================================
-- STORAGE (logo + avatars)
-- =====================================================================
do $do$ begin
  insert into storage.buckets (id, name, public) values ('branding', 'branding', true), ('avatars', 'avatars', true)
    on conflict (id) do nothing;
  drop policy if exists branding_admin_all on storage.objects;
  create policy branding_admin_all on storage.objects for all to authenticated
    using (bucket_id = 'branding' and get_user_role(auth.uid()) = 'ADMIN')
    with check (bucket_id = 'branding' and get_user_role(auth.uid()) = 'ADMIN');
  drop policy if exists avatars_own_all on storage.objects;
  create policy avatars_own_all on storage.objects for all to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
exception when others then
  raise notice 'Storage setup skipped: %', sqlerrm;
end $do$;

-- =====================================================================
-- SEED DATA
-- =====================================================================
insert into business_settings (id) values (1) on conflict (id) do nothing;
insert into categories (name) values ('Pens & Pencils'), ('Notebooks & Books'), ('Paper & Printing'), ('Files & Folders'),
  ('Art & Craft'), ('Office Supplies'), ('School Supplies'), ('Other')
  on conflict (name) do nothing;

-- If nobody has a profile yet, make the OLDEST existing login the owner (ADMIN).
insert into profiles (id, full_name, role)
  select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), 'ADMIN'
  from auth.users where not exists (select 1 from profiles) order by created_at limit 1
on conflict (id) do nothing;
