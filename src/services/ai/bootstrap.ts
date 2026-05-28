// ============================================================================
// AI Bootstrap - נקרא פעם אחת בהעלאת האפליקציה
// ----------------------------------------------------------------------------
// אם Supabase מוגדר -> מפעיל את RemoteProvider (הולך דרך Edge Function).
// אחרת -> LocalFallbackProvider (תשובות מקומיות).
//
// SECURITY: API keys are NEVER stored in the client bundle.
// All AI requests go through the Supabase Edge Function which holds the key
// in Supabase Secrets.
// ============================================================================

import { isSupabaseConfigured } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { LocalFallbackProvider, RemoteProvider, setAIProvider } from './core';

let initialized = false;

export function initAI(): void {
  if (initialized) return;
  initialized = true;

  if (isSupabaseConfigured()) {
    setAIProvider(new RemoteProvider());
    logger.ai.info('AI initialized · RemoteProvider (Supabase Edge Function)');
  } else {
    setAIProvider(new LocalFallbackProvider());
    logger.ai.info('AI initialized · LocalFallbackProvider (Supabase not configured)');
  }
}
