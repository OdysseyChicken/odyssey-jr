// What Odyssey Jr. finds lying around each day. The same date always gives the same finds, so the website
// (index.html) and his own daily run (node scripts/finds.mjs <date>) agree on what he picked up.
function rng(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }

// dateStr: "YYYY-MM-DD". findables: [{ name, icon, where, weight? }]. Returns 1 to 3 finds, sorted by time of day.
export function findsFor(dateStr, findables) {
  if (!Array.isArray(findables) || !findables.length) return [];
  const rnd = rng("finds:" + dateStr), out = [];
  const total = findables.reduce((s, f) => s + (f.weight ?? 1), 0);
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const minute = 7 * 60 + Math.floor(rnd() * 13 * 60); // between 7:00 AM and 8:00 PM
    let r = rnd() * total, pick = findables[0];
    for (const f of findables) { r -= (f.weight ?? 1); if (r <= 0) { pick = f; break; } }
    out.push({ minute, date: dateStr, id: `find-${dateStr}-${i}`, name: pick.name, icon: pick.icon, from: `Found ${pick.where ?? "in the yard"}` });
  }
  return out.sort((a, b) => a.minute - b.minute);
}
