/*
  # Fix Security Issues

  1. Performance Optimization - RLS Policies
    - Replace direct auth.uid() calls with (select auth.uid()) for optimal query performance
    - Affects user_profiles table: "Users can insert own profile" and "Users can update own profile" policies
  
  2. Remove Unused Indexes
    - deposits_user_id_idx - Unused index
    - deposits_to_address_idx - Unused index  
    - deposits_status_idx - Unused index
  
  3. Add RLS Policies to Deposits Table
    - deposits table had RLS enabled but no policies
    - Add policy for authenticated users to view their own deposits

  Important Notes:
  - The auth.uid() optimization prevents re-evaluation for each row, improving performance at scale
  - Unused indexes are removed to reduce storage and improve write performance
  - Deposits table policies allow read-only access for authenticated users viewing their own records
  - Server-side deposit writes continue to use service role key for validation at the API layer
*/

-- Drop unused indexes on deposits table
DROP INDEX IF EXISTS deposits_user_id_idx;
DROP INDEX IF EXISTS deposits_to_address_idx;
DROP INDEX IF EXISTS deposits_status_idx;

-- Drop and recreate the user_profiles RLS policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Add RLS policies for deposits table
CREATE POLICY "Users can view own deposits"
  ON deposits FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()::text));
