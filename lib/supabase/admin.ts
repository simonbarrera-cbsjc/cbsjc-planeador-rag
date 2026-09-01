import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Guard: this module must never be imported in a browser bundle.
 * Service role keys bypass Row Level Security — keep them server-only.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "[supabaseAdmin] This module must only be used on the server. " +
      "Do not import lib/supabase/admin.ts in client components.",
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("[supabaseAdmin] Missing env var: NEXT_PUBLIC_SUPABASE_URL");
}
if (!serviceRoleKey) {
  throw new Error(
    "[supabaseAdmin] Missing env var: SUPABASE_SERVICE_ROLE_KEY",
  );
}

/**
 * Singleton admin client with the service role key.
 * Bypasses Row Level Security — use only in trusted server contexts
 * (API routes, server actions, background jobs).
 */
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      // Disable automatic session persistence — admin client is stateless.
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
