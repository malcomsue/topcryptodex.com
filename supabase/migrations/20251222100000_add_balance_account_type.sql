/*
  # Add account_type to balances
*/

ALTER TABLE balances
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'funding';

UPDATE balances
  SET account_type = 'funding'
  WHERE account_type IS NULL;

ALTER TABLE balances
  DROP CONSTRAINT IF EXISTS balances_user_id_asset_key;

CREATE UNIQUE INDEX IF NOT EXISTS balances_user_asset_account_unique
  ON balances(user_id, asset, account_type);
