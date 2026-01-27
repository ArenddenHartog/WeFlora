import type { SupabaseClient } from '@supabase/supabase-js';
import { agentProfiles } from './agents.ts';
import { upsertAgentProfile } from '../runtime/persist.ts';

export const seedAgentRegistry = async (supabase: SupabaseClient): Promise<void> => {
  for (const profile of agentProfiles) {
    await upsertAgentProfile(supabase, profile);
  }
};
