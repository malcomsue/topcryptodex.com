/*
  # Add orders table for spot trading
*/

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  pair text NOT NULL,
  side text NOT NULL, -- buy | sell
  order_type text NOT NULL, -- market | limit
  price numeric(38, 18),
  amount numeric(38, 18) NOT NULL,
  filled_amount numeric(38, 18) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open', -- open | canceled | filled
  locked_asset text NOT NULL,
  locked_amount numeric(38, 18) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
