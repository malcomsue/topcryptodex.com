/*
  # Add KYC fields to user_profiles
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kyc_document_url text,
  ADD COLUMN IF NOT EXISTS kyc_document_type text,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;
