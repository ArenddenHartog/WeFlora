import { createClient } from "@supabase/supabase-js";

const env = ((import.meta as ImportMeta & { env?: Record<string, string> }).env ?? process.env) as Record<
  string,
  string | undefined
>;
const url = env.VITE_SUPABASE_URL as string;
const anon = env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  throw new Error("Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon);
