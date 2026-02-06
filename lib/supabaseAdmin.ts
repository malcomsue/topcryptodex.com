import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!url) {
    throw new Error('Missing SUPABASE_URL (or NEXT_PUBLIC_VITE_SUPABASE_URL)');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabaseAdmin = getSupabaseAdmin();
