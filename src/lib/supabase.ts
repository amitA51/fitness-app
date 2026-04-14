/**
 * Supabase Client Configuration
 * SPARKOS Fitness App - Cloud Sync
 */

import { createClient, SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.info('Supabase not configured - cloud sync disabled. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable.');
}

export const supabase = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export const isSupabaseConfigured = (): boolean => isConfigured;

export type SupabaseClient = SupabaseClientType;
