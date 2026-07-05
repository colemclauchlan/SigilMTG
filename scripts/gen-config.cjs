// Vercel build step: generate supabase-config.js from env vars so the anon key stays out of git.
// Falls back to any existing local file if the env vars are absent (so local dev still works).
const fs = require("fs");
const u = process.env.SUPABASE_URL, k = process.env.SUPABASE_ANON_KEY;
if (u && k) {
  fs.writeFileSync("supabase-config.js",
    "window.MTG_SYNC_CONFIG = { enabled: true, supabaseUrl: " + JSON.stringify(u) + ", supabaseAnonKey: " + JSON.stringify(k) + " };\n");
  console.log("supabase-config.js generated from env vars");
} else if (fs.existsSync("supabase-config.js")) {
  console.log("SUPABASE_URL/ANON_KEY not set — keeping existing supabase-config.js");
} else {
  console.warn("WARNING: no Supabase env vars and no supabase-config.js — multiplayer disabled");
}
