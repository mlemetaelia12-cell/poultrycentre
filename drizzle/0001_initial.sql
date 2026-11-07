CREATE TYPE user_role AS ENUM ('owner','manager','cashier','stock_attendant');
CREATE TYPE access_mode AS ENUM ('full','dashboard');
CREATE TYPE record_status AS ENUM ('active','void','draft');
CREATE TYPE payment_method AS ENUM ('cash','mpesa','mixx','airtel_money','halopesa','bank_transfer');
CREATE TYPE sale_status AS ENUM ('completed','partial','credit','void');
CREATE TYPE movement_type AS ENUM ('purchase','sale','adjustment_in','adjustment_out','damage','expiry','loss','exchange_in','exchange_out','void_sale');
CREATE TYPE notification_type AS ENUM ('low_stock','expiry','expired','overdue_debt','cash_discrepancy','discount','stock_adjustment','security','system');

CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username varchar(40) NOT NULL, password_hash text NOT NULL,
 display_name varchar(120) NOT NULL, role user_role NOT NULL, language varchar(2) NOT NULL DEFAULT 'en', active boolean NOT NULL DEFAULT true,
 force_password_change boolean NOT NULL DEFAULT false, last_login_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_uq ON users(username);
CREATE UNIQUE INDEX users_single_owner_uq ON users(role) WHERE role = 'owner';
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash varchar(64) NOT NULL, access_mode access_mode NOT NULL, user_agent text, ip_hash varchar(64),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sessions_token_hash_uq ON sessions(token_hash);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE auth_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_key varchar(64) NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT now(), succeeded boolean NOT NULL DEFAULT false
);
CREATE INDEX auth_attempts_key_time_idx ON auth_attempts(attempt_key, attempted_at);
CREATE TABLE categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL, description text,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_uq ON categories(name);
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku varchar(64) NOT NULL, barcode varchar(80), name varchar(180) NOT NULL,
 generic_name varchar(180), category_id uuid REFERENCES categories(id) ON DELETE SET NULL, manufacturer varchar(160),
 active_ingredient text, species text, formulation text, storage_instructions text, registration_number varchar(100),
 base_unit varchar(24) NOT NULL DEFAULT 'piece', buying_price numeric(14,2) NOT NULL DEFAULT 0,
 retail_price numeric(14,2) NOT NULL DEFAULT 0, wholesale_price numeric(14,2) NOT NULL DEFAULT 0,
 minimum_price numeric(14,2) NOT NULL DEFAULT 0, reorder_level numeric(14,3) NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX products_sku_uq ON products(sku);
CREATE UNIQUE INDEX products_barcode_uq ON products(barcode);
CREATE INDEX products_name_idx ON products(name);
CREATE TABLE unit_conversions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 unit_name varchar(32) NOT NULL, base_quantity numeric(14,3) NOT NULL, barcode varchar(80),
 retail_price numeric(14,2), wholesale_price numeric(14,2)
);
CREATE UNIQUE INDEX unit_conversion_product_unit_uq ON unit_conversions(product_id,unit_name);
CREATE UNIQUE INDEX unit_conversions_barcode_uq ON unit_conversions(barcode) WHERE barcode IS NOT NULL;
CREATE TABLE suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(180) NOT NULL, contact_person varchar(120),
 phone varchar(32), email varchar(180), address text, notes text, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(180) NOT NULL, phone varchar(32), location varchar(180),
 customer_type varchar(24) NOT NULL DEFAULT 'retail', credit_limit numeric(14,2) NOT NULL DEFAULT 0,
 notes text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_name_idx ON customers(name);
CREATE INDEX customers_phone_idx ON customers(phone);
CREATE TABLE purchases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference varchar(40) NOT NULL, supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
 invoice_number varchar(100), purchased_at timestamptz NOT NULL DEFAULT now(), subtotal numeric(14,2) NOT NULL,
 notes text, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX purchases_reference_uq ON purchases(reference);
CREATE TABLE purchase_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
 amount numeric(14,2) NOT NULL, method payment_method NOT NULL, reference varchar(120),
 paid_by uuid NOT NULL REFERENCES users(id), paid_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE purchase_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES products(id), batch_number varchar(100) NOT NULL, expiry_date date NOT NULL,
 quantity numeric(14,3) NOT NULL, unit_cost numeric(14,2) NOT NULL, line_total numeric(14,2) NOT NULL
);
CREATE TABLE batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id),
 batch_number varchar(100) NOT NULL, expiry_date date NOT NULL, quantity_received numeric(14,3) NOT NULL,
 quantity_remaining numeric(14,3) NOT NULL, unit_cost numeric(14,2) NOT NULL, purchase_id uuid REFERENCES purchases(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX batches_product_expiry_idx ON batches(product_id,expiry_date);
CREATE TABLE sales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_number varchar(40) NOT NULL,
 customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, sale_type varchar(16) NOT NULL DEFAULT 'retail',
 subtotal numeric(14,2) NOT NULL, discount numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL,
 amount_paid numeric(14,2) NOT NULL DEFAULT 0, balance_due numeric(14,2) NOT NULL DEFAULT 0,
 status sale_status NOT NULL DEFAULT 'completed', notes text, created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sales_receipt_number_uq ON sales(receipt_number);
CREATE INDEX sales_created_at_idx ON sales(created_at);
CREATE TABLE sale_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES products(id), batch_id uuid NOT NULL REFERENCES batches(id),
 unit_name varchar(32) NOT NULL, quantity numeric(14,3) NOT NULL, base_quantity numeric(14,3) NOT NULL,
 unit_price numeric(14,2) NOT NULL, unit_cost numeric(14,2) NOT NULL, line_total numeric(14,2) NOT NULL,
 discount_amount numeric(14,2) NOT NULL DEFAULT 0
);
CREATE TABLE payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid REFERENCES sales(id) ON DELETE RESTRICT,
 customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, amount numeric(14,2) NOT NULL,
 method payment_method NOT NULL, reference varchar(120), payment_type varchar(24) NOT NULL DEFAULT 'sale',
 received_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_customer_idx ON payments(customer_id);
CREATE INDEX payments_created_at_idx ON payments(created_at);
CREATE TABLE payment_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
 sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE RESTRICT, amount numeric(14,2) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_allocations_sale_idx ON payment_allocations(sale_id);
CREATE TABLE expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category varchar(40) NOT NULL, description text NOT NULL,
 amount numeric(14,2) NOT NULL, method payment_method NOT NULL, reference varchar(120),
 spent_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE debt_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customers(id), sale_id uuid REFERENCES sales(id),
 transaction_type varchar(24) NOT NULL, amount numeric(14,2) NOT NULL, due_date date, notes text,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stock_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), batch_id uuid REFERENCES batches(id),
 movement_type movement_type NOT NULL, quantity numeric(14,3) NOT NULL, reference_type varchar(40), reference_id uuid,
 reason text, actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_product_created_idx ON stock_movements(product_id,created_at);
CREATE TABLE cashier_shifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, opening_cash numeric(14,2) NOT NULL DEFAULT 0,
 expected_cash numeric(14,2), counted_cash numeric(14,2), discrepancy numeric(14,2), notes text
);
CREATE UNIQUE INDEX cashier_shifts_one_open_per_user_uq ON cashier_shifts(user_id) WHERE closed_at IS NULL;
CREATE TABLE exchanges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), original_sale_id uuid NOT NULL REFERENCES sales(id),
 original_sale_item_id uuid NOT NULL REFERENCES sale_items(id), original_batch_id uuid NOT NULL REFERENCES batches(id),
 original_product_id uuid NOT NULL REFERENCES products(id), replacement_product_id uuid NOT NULL REFERENCES products(id),
 quantity numeric(14,3) NOT NULL, replacement_quantity numeric(14,3) NOT NULL, price_difference numeric(14,2) NOT NULL DEFAULT 0, reason text NOT NULL,
 approved_by uuid NOT NULL REFERENCES users(id), inspected boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE quarantined_stock (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exchange_id uuid NOT NULL REFERENCES exchanges(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES products(id), original_batch_id uuid NOT NULL REFERENCES batches(id),
 quantity numeric(14,3) NOT NULL, reason text NOT NULL, status varchar(30) NOT NULL DEFAULT 'pending_inspection',
 resolution_notes text, resolved_by uuid REFERENCES users(id), resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type notification_type NOT NULL, title varchar(180) NOT NULL,
 message text NOT NULL, record_type varchar(40), record_id uuid, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action varchar(100) NOT NULL, entity_type varchar(60) NOT NULL, entity_id uuid, details jsonb,
 ip_hash varchar(64), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_actor_created_idx ON audit_logs(actor_id,created_at);
CREATE TABLE business_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), business_name varchar(160) NOT NULL DEFAULT 'POULTRY CENTRE',
 phone varchar(32), address text, tin varchar(40), vat_registered boolean NOT NULL DEFAULT false,
 vat_rate numeric(5,2), currency varchar(3) NOT NULL DEFAULT 'TZS', timezone varchar(80) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
 default_language varchar(2) NOT NULL DEFAULT 'en', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tax_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id), tax_type varchar(40) NOT NULL,
 rate numeric(5,2) NOT NULL, taxable_amount numeric(14,2) NOT NULL, tax_amount numeric(14,2) NOT NULL,
 fiscal_reference varchar(120), created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO business_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO categories(name) VALUES
 ('Antibiotics'),('Dewormers'),('Vaccines'),('Vitamins & Supplements'),('Disinfectants'),('Sprays & Pesticides'),('Animal Feeds'),('Veterinary Equipment'),('Other')
ON CONFLICT (name) DO NOTHING;
