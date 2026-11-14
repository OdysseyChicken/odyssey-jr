// Safety check for Odyssey Jr.'s world. Run: node scripts/check.mjs
// Exits with code 1 if anything would break the site. Never commit if this fails.
import { readFileSync, existsSync, writeFileSync, mkdtempSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = new URL("..", import.meta.url).pathname;
const errors = [];
const warn = [];
const read = p => readFileSync(join(root, p), "utf8");
const json = p => { try { return JSON.parse(read(p)); } catch (e) { errors.push(`${p}: invalid JSON (${e.message})`); return null; } };

// 1. JSON files parse
const world = json("world/world.json");
const state = json("world/state.json");
const projects = json("world/projects.json");
for (const f of ["brain/log.json", "brain/wants.json", "brain/journal/index.json"]) if (existsSync(join(root, f))) json(f);
const character = existsSync(join(root, "world/character.json")) ? json("world/character.json") : null;

// 2. Engine is intact and its JavaScript parses
const html = read("index.html");
if (!html.includes("ODYSSEY-JR-ENGINE")) errors.push("index.html: engine marker missing");
if (!html.includes('type="importmap"')) errors.push("index.html: importmap missing");
const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/);
let builtinTypes = [];
if (!mod) errors.push("index.html: module script missing");
else {
  const dir = mkdtempSync(join(tmpdir(), "oj-"));
  const f = join(dir, "engine.mjs");
  writeFileSync(f, mod[1]);
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { errors.push("index.html: JavaScript syntax error\n" + String(e.stderr)); }
  const block = mod[1].match(/const builtins = \{([\s\S]*?)\n\};/);
  if (block) builtinTypes = [...block[1].matchAll(/^\s{2}(\w+): o =>/gm)].map(m => m[1]);
}

// 3. World data makes sense
const isNum = n => typeof n === "number" && Number.isFinite(n);
if (world) {
  const half = (world.ground?.size ?? 40) / 2;
  const custom = Object.keys(world.custom ?? {});
  const known = new Set([...builtinTypes, ...custom]);
  const ids = new Set();
  if (!Array.isArray(world.objects)) errors.push("world.json: objects must be an array");
  for (const o of world.objects ?? []) {
    if (!o.id) errors.push(`world.json: an object of type ${o.type} has no id`);
    else if (ids.has(o.id)) errors.push(`world.json: duplicate id ${o.id}`);
    ids.add(o.id);
    if (o.type === "model") { if (!o.src || !existsSync(join(root, o.src))) errors.push(`world.json: model ${o.id} file ${o.src} not found`); }
    else if (!known.has(o.type)) errors.push(`world.json: ${o.id} uses unknown type "${o.type}" (add it under "custom")`);
    if (!Array.isArray(o.pos) || o.pos.length !== 2 || !o.pos.every(isNum)) errors.push(`world.json: ${o.id} pos must be [x, z]`);
    else if (Math.abs(o.pos[0]) > half || Math.abs(o.pos[1]) > half) errors.push(`world.json: ${o.id} is outside the ground`);
  }
  for (const [name, parts] of Object.entries(world.custom ?? {})) {
    if (!Array.isArray(parts) || !parts.length) { errors.push(`world.json: custom "${name}" needs a list of parts`); continue; }
    if (parts.length > 200) errors.push(`world.json: custom "${name}" has over 200 parts`);
    for (const p of parts) {
      if (!["box", "roundbox", "sphere", "cylinder", "cone", "torus", "capsule"].includes(p.shape)) errors.push(`world.json: custom "${name}" has unknown shape ${p.shape}`);
      if (p.size && !(Array.isArray(p.size) && p.size.every(isNum))) errors.push(`world.json: custom "${name}" has bad size`);
      if (p.pos && !(Array.isArray(p.pos) && p.pos.length === 3 && p.pos.every(isNum))) errors.push(`world.json: custom "${name}" has bad pos`);
    }
  }
  if ((world.objects ?? []).length > 2000) errors.push("world.json: over 2000 objects, the page will get slow");
  for (const [k, v] of Object.entries(world.spots ?? {}))
    if (!Array.isArray(v) || v.length !== 2 || !v.every(isNum)) errors.push(`world.json: spot ${k} must be [x, z]`);
}

// 4. State is valid
if (state) {
  for (const k of ["activity", "spot", "mood", "thought", "today", "day", "updated"])
    if (state[k] === undefined) errors.push(`state.json: missing "${k}"`);
  if (world && !(state.spot in (world.spots ?? {}))) errors.push(`state.json: spot "${state.spot}" is not in world.spots`);
  const jp = state.journal ?? `brain/journal/${state.updated}.md`;
  if (!existsSync(join(root, jp))) errors.push(`state.json: journal file ${jp} does not exist`);
  const acts = ["explore", "peck", "build", "dance", "think", "read", "sleep", "look"];
  if (!acts.includes(String(state.activity).toLowerCase())) warn.push(`state.json: activity "${state.activity}" has no animation, it will just look around`);
}
if (character) {
  for (const slot of ["head", "neck", "body"]) {
    const parts = character.outfit?.[slot] ?? [];
    if (!Array.isArray(parts)) { errors.push(`character.json: outfit.${slot} must be a list`); continue; }
    if (parts.length > 80) errors.push(`character.json: outfit.${slot} has over 80 parts`);
    for (const p of parts) {
      if (!["box", "roundbox", "sphere", "cylinder", "cone", "torus", "capsule"].includes(p.shape)) errors.push(`character.json: outfit.${slot} has unknown shape ${p.shape}`);
      if (p.pos && !(Array.isArray(p.pos) && p.pos.length === 3 && p.pos.every(isNum))) errors.push(`character.json: outfit.${slot} has bad pos`);
    }
  }
}
if (projects && !(Array.isArray(projects.making) && Array.isArray(projects.done))) errors.push("projects.json: needs making[] and done[]");

// 5. Memory stays small
const memLines = read("brain/memory.md").split("\n").length;
if (memLines > 120) errors.push(`brain/memory.md is ${memLines} lines, summarize it under 80`);
else if (memLines > 80) warn.push(`brain/memory.md is ${memLines} lines, summarize soon`);

// 6. No secrets or huge files anywhere
const secret = /(ghp_[A-Za-z0-9]{20,}|github_pat_|sk-ant-|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/;
const walk = d => readdirSync(join(root, d), { withFileTypes: true }).flatMap(e =>
  e.name === ".git" || e.name === "node_modules" ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
for (const f of walk(".")) {
  const sz = statSync(join(root, f)).size;
  const limit = f.endsWith(".glb") ? 8_000_000 : 2_000_000;
  if (sz > limit) errors.push(`${f} is over ${limit / 1_000_000} MB`);
  else if (!f.endsWith("check.mjs") && /\.(md|json|html|js|mjs|css|txt)$/.test(f) && secret.test(read(f))) errors.push(`${f} looks like it contains a secret key`);
}

for (const w of warn) console.log("WARN  " + w);
if (errors.length) { for (const e of errors) console.log("FAIL  " + e); console.log(`\n${errors.length} problem(s). Fix them or undo your changes. Do not commit.`); process.exit(1); }
console.log("PASS  Odyssey Jr.'s world is healthy.");
