// Prints what Odyssey Jr. found on the given dates. Run: node scripts/finds.mjs 2026-11-14 [more dates]
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const root = new URL("..", import.meta.url).pathname;
const tmp = join(mkdtempSync(join(tmpdir(), "oj-finds-")), "finds.mjs");
writeFileSync(tmp, readFileSync(join(root, "world/finds.js")));
const { findsFor } = await import(tmp);
const bag = JSON.parse(readFileSync(join(root, "brain/bag.json"), "utf8"));
const dates = process.argv.slice(2);
if (!dates.length) { console.log("Usage: node scripts/finds.mjs YYYY-MM-DD [YYYY-MM-DD ...]"); process.exit(1); }
for (const d of dates) for (const f of findsFor(d, bag.findables)) {
  const hh = Math.floor(f.minute / 60), mm = String(f.minute % 60).padStart(2, "0");
  console.log(JSON.stringify({ id: f.id, name: f.name, icon: f.icon, from: f.from, got: d, time: `${hh}:${mm}` }));
}
