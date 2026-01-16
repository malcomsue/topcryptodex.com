/*
  # Per-user deposit addresses

  Stores a unique blockchain address per user per asset/chain.
  Uses server-side assignment with an HD wallet derivation index.
*/

CREATE TABLE IF NOT EXISTS deposit_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  chain text NOT NULL, -- ethereum | bitcoin | xrp | tron
  asset text NOT NULL, -- ETH | USDT | BTC | XRP | TRX
  address text NOT NULL,
  derivation_index int NOT NULL,
  derivation_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS deposit_addresses_address_unique
  ON deposit_addresses(address);

CREATE UNIQUE INDEX IF NOT EXISTS deposit_addresses_user_chain_asset_unique
  ON deposit_addresses(user_id, chain, asset);

CREATE UNIQUE INDEX IF NOT EXISTS deposit_addresses_chain_derivation_unique
  ON deposit_addresses(chain, derivation_index);

ALTER TABLE deposit_addresses ENABLE ROW LEVEL SECURITY;
