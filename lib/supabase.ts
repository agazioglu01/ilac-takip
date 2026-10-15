import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_SUPABASE_AUTH === 'true';

export const isSupabaseConfigured = Boolean(
  supabaseAuthEnabled && supabaseUrl && supabaseAnonKey
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;