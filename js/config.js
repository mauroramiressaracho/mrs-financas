const runtimeConfig = (typeof window !== 'undefined' && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : {};

// For GitHub Pages you can inject these values in index.html through window.__APP_CONFIG__.
// Fallback values below keep local development working.
export const SUPABASE_URL = runtimeConfig.supabaseUrl || 'https://dytmaofmnosnadphcqwc.supabase.co';
export const SUPABASE_ANON_KEY = runtimeConfig.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dG1hb2Ztbm9zbmFkcGhjcXdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzM5ODcsImV4cCI6MjA4NzAwOTk4N30.wZEeEIC8WGJ-d6oVnlQdNMDllCVuNheEgIPwc4WGKes';
