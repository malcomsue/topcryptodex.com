/*
  # Add balances and ledger entries
*/

CREATE TABLE IF NOT EXISTS balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  asset text NOT NULL,
  available numeric(38, 18) NOT NULL DEFAULT 0,
  locked numeric(38, 18) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  asset text NOT NULL,
  amount numeric(38, 18) NOT NULL,
  entry_type text NOT NULL, -- credit | debit | lock | unlock
  reference_type text, -- deposit | trade | adjustment
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS balances_user_id_idx ON balances(user_id);
CREATE INDEX IF NOT EXISTS ledger_entries_user_id_idx ON ledger_entries(user_id);

ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
