BEGIN;

CREATE TABLE IF NOT EXISTS draft_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(40) NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name varchar(180),
  customer_phone varchar(32),
  delivery_location text,
  sale_type varchar(16) NOT NULL DEFAULT 'retail',
  discount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'converted', 'cancelled')),
  converted_sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS draft_orders_order_number_uq ON draft_orders(order_number);
CREATE INDEX IF NOT EXISTS draft_orders_status_created_idx ON draft_orders(status, created_at);
CREATE INDEX IF NOT EXISTS draft_orders_creator_idx ON draft_orders(created_by);

CREATE TABLE IF NOT EXISTS draft_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_order_id uuid NOT NULL REFERENCES draft_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name varchar(180) NOT NULL,
  unit_name varchar(32) NOT NULL,
  quantity numeric(14,3) NOT NULL,
  base_quantity numeric(14,3) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  line_total numeric(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS draft_order_items_order_idx ON draft_order_items(draft_order_id);

COMMIT;
