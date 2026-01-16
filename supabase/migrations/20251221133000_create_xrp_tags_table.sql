/*
  # XRP destination tags (Privy user ids)
*/

CREATE TABLE IF NOT EXISTS xrp_destination_tags (
  user_id text PRIMARY KEY,
  destination_tag int NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE xrp_destination_tags ENABLE ROW LEVEL SECURITY;
