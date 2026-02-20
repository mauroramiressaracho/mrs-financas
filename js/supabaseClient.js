import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const invalidUrl = !SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT_ID');
const invalidKey = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY');
const hasSupabaseLib = typeof window !== 'undefined' && !!window.supabase?.createClient;

export const isSupabaseConfigured = !invalidUrl && !invalidKey && hasSupabaseLib;

export const supabase = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
