/*
  # Deposits tracking (v1)

  Adds a `deposits` table to record user-submitted deposit intents and on-chain transactions.
  This is designed to work with Privy auth (user_id stored as Privy user id string).

  Note:
  - RLS is enabled but no public policies are added. Server code should write using the Supabase
    service role key (bypasses RLS) and enforce auth/validation at the API layer.
*/

CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  chain text NOT NULL, -- evm | tron | bitcoin | xrp
  asset text NOT NULL, -- USDT | BTC | XRP | etc
  to_address text NOT NULL,
  from_address text,
  tx_hash text,
  amount numeric(38, 18),
  status text NOT NULL DEFAULT 'pending', -- pending | detected | confirmed | credited | failed
  confirmations int NOT NULL DEFAULT 0,
  destination_tag text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  detected_at timestamptz,
  confirmed_at timestamptz,
  credited_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS deposits_chain_tx_hash_unique
  ON deposits(chain, tx_hash)
  WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS deposits_user_id_idx ON deposits(user_id);
CREATE INDEX IF NOT EXISTS deposits_to_address_idx ON deposits(to_address);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON deposits(status);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
