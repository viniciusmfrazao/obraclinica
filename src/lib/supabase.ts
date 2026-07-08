import { createClient } from "@supabase/supabase-js";

// Fallback placeholders let the build succeed even if env vars aren't
// injected at build time (e.g. static prerendering). At runtime, in a real
// deployment with the env vars set, these are replaced by the real values.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && typeof window !== "undefined") {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL não está definida. Configure as variáveis de ambiente no Vercel (Project Settings → Environment Variables) e faça um novo deploy."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
