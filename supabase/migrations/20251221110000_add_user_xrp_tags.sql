/*
  # Add per-user XRP destination tags
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS xrp_destination_tag int;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_xrp_destination_tag_unique
  ON user_profiles(xrp_destination_tag)
  WHERE xrp_destination_tag IS NOT NULL;

