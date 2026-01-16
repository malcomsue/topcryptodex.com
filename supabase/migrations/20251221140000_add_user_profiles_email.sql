/*
  # Add email to user_profiles for admin search
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email);
