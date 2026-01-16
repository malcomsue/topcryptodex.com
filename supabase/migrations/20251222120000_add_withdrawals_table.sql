/*
  # Add withdrawals table for history
*/

CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  asset text NOT NULL,
  amount numeric(38, 18) NOT NULL,
  fee numeric(38, 18) NOT NULL DEFAULT 0,
  address text,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed | canceled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawals(status);
