import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Avoid crashing during build/SSR when env vars are absent; runtime code should guard for null.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function assertSupabase() {
  if (!supabase) {
    throw new Error('Missing Supabase environment variables');
  }
  return supabase;
}

export interface Cryptocurrency {
  id: string;
  symbol: string;
  name: string;
  icon_color: string;
  current_price: number;
  price_change_24h: number;
  market_cap: number;
  volume_24h: number;
}

export interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  phone?: string | null;
  kyc_status?: string | null;
  kyc_document_url?: string | null;
  kyc_document_type?: string | null;
  kyc_submitted_at?: string | null;
  profile_completed?: boolean | null;
}

export interface EducationalContent {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string;
}
