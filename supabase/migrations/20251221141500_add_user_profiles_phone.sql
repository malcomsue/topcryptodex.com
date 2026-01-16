/*
  # Add phone to user_profiles for admin search
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone text;

CREATE INDEX IF NOT EXISTS user_profiles_phone_idx ON user_profiles(phone);
