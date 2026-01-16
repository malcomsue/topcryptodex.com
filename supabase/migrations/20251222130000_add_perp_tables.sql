/*
  # Add perp orders and positions
*/

CREATE TABLE IF NOT EXISTS perp_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  pair text NOT NULL,
  side text NOT NULL, -- long | short
  order_type text NOT NULL, -- market | limit
  price numeric(38, 18),
  amount numeric(38, 18) NOT NULL,
  leverage numeric(10, 4) NOT NULL,
  margin numeric(38, 18) NOT NULL,
  margin_asset text NOT NULL DEFAULT 'USDT',
  notional numeric(38, 18) NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | canceled | filled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perp_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  order_id uuid,
  pair text NOT NULL,
  side text NOT NULL, -- long | short
  size numeric(38, 18) NOT NULL,
  entry_price numeric(38, 18) NOT NULL,
  leverage numeric(10, 4) NOT NULL,
  margin numeric(38, 18) NOT NULL,
  margin_asset text NOT NULL DEFAULT 'USDT',
  notional numeric(38, 18) NOT NULL,
  take_profit numeric(38, 18),
  stop_loss numeric(38, 18),
  liquidation_price numeric(38, 18),
  status text NOT NULL DEFAULT 'open', -- open | closed | liquidated
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS perp_orders_user_id_idx ON perp_orders(user_id);
CREATE INDEX IF NOT EXISTS perp_positions_user_id_idx ON perp_positions(user_id);
