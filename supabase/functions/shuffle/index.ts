// Edge Function: shuffle — server-authoritative library shuffle for fair PvP (plan §5.4).
// The server picks the seed (clients can't manipulate it); the algorithm is byte-identical to
// table-core.js shuffle(), so every client rebuilds the same library order from {seed}.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr: string[], seed: string): string[] {
  const rng = mulberry32(hashSeed(seed));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    const seed: string = body.seed || crypto.randomUUID();
    return new Response(JSON.stringify({ seed, order: shuffle(ids, seed) }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
});
