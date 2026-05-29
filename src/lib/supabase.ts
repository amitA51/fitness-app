/**
 * Supabase Client Configuration
 * SPARKOS Fitness App - Cloud Sync
 */

import { type SupabaseClient as SupabaseClientType, createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Supabase configuration is optional — when missing, the app runs in local-only mode.

export const supabase = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const isSupabaseConfigured = (): boolean => isConfigured;

export type SupabaseClient = SupabaseClientType;
