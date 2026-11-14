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
const requests = existsSync(join(root, "brain/requests.json")) ? json("brain/requests.json") : null;
if (requests) for (const r of requests.requests ?? []) {
  if (!r.id || !r.item) errors.push("requests.json: every request needs an id and an item");
  if (r.place && !(Array.isArray(r.place.pos) && r.place.pos.length === 2)) errors.push(`requests.json: ${r.id} place.pos must be [x, z]`);
}
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
    if (o.script) {
      if (!/^(behaviors|projects)\/[\w./-]+\.js$/.test(o.script) || o.script.includes("..")) errors.push(`world.json: ${o.id} script must be a .js file in behaviors/ or projects/`);
      else if (!existsSync(join(root, o.script))) errors.push(`world.json: ${o.id} script ${o.script} not found`);
      else { const tmp = join(mkdtempSync(join(tmpdir(), "oj-b-")), "b.mjs"); writeFileSync(tmp, readFileSync(join(root, o.script))); try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); } catch (e) { errors.push(`${o.script}: JavaScript syntax error\n` + String(e.stderr)); } }
    }
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
const SHAPES = ["box", "roundbox", "sphere", "cylinder", "cone", "torus", "capsule"];
const checkOutfit = (where, outfit) => {
  for (const slot of ["head", "neck", "body"]) {
    const parts = outfit?.[slot] ?? [];
    if (!Array.isArray(parts)) { errors.push(`${where}: ${slot} must be a list`); continue; }
    if (parts.length > 80) errors.push(`${where}: ${slot} has over 80 parts`);
    for (const p of parts) {
      if (!SHAPES.includes(p.shape)) errors.push(`${where}: ${slot} has unknown shape ${p.shape}`);
      if (p.pos && !(Array.isArray(p.pos) && p.pos.length === 3 && p.pos.every(isNum))) errors.push(`${where}: ${slot} has bad pos`);
    }
  }
};
if (character?.outfit) checkOutfit("character.json outfit", character.outfit);
// his closet
if (existsSync(join(root, "world/wardrobe.json"))) {
  const wd = json("world/wardrobe.json");
  if (wd) {
    if (!Array.isArray(wd.outfits) || !wd.outfits.length) errors.push("wardrobe.json: needs at least one outfit");
    const ids = new Set();
    for (const x of wd.outfits ?? []) {
      if (!x.id || !x.name) errors.push("wardrobe.json: every outfit needs an id and a name");
      if (ids.has(x.id)) errors.push(`wardrobe.json: duplicate outfit id ${x.id}`); ids.add(x.id);
      checkOutfit(`wardrobe.json outfit ${x.id}`, x);
    }
    if (!ids.has(wd.wearing)) errors.push(`wardrobe.json: "wearing" (${wd.wearing}) is not one of the outfits`);
  }
}
// his bag and shelves
if (existsSync(join(root, "brain/bag.json"))) {
  const bg = json("brain/bag.json");
  if (bg) {
    const slots = bg.slots ?? 9;
    if (!Array.isArray(bg.bag)) errors.push("bag.json: bag must be a list");
    else if (bg.bag.length > slots) errors.push(`bag.json: the bag holds ${slots} things but has ${bg.bag.length}. Put some on a shelf.`);
    const okItem = (it, where) => { if (!it || !it.name || !it.icon) errors.push(`bag.json: an item in ${where} needs a name and an icon`); };
    for (const it of bg.bag ?? []) okItem(it, "the bag");
    for (const [k, sh] of Object.entries(bg.shelves ?? {})) { if (!Array.isArray(sh?.items)) errors.push(`bag.json: shelf ${k} needs an items list`); else for (const it of sh.items) okItem(it, `shelf ${k}`); }
    for (const f of bg.findables ?? []) if (!f.name || !f.icon) errors.push("bag.json: every findable needs a name and an icon");
    if (bg.synced && !/^\d{4}-\d{2}-\d{2}$/.test(bg.synced)) errors.push("bag.json: synced must be a date like 2026-11-14");
  }
}
if (!existsSync(join(root, "world/finds.js"))) errors.push("world/finds.js is missing (the site needs it)");
// rooms you can walk into
if (world) {
  const roomIds = Object.keys(world.interiors ?? {}).filter(k => !k.startsWith("_"));
  const doorOk = d => d === "outside" || roomIds.includes(d);
  for (const o of world.objects ?? []) if (o.door && !doorOk(o.door)) errors.push(`world.json: ${o.id} has a door to "${o.door}", which is not a room in interiors`);
  for (const id of roomIds) {
    const R = world.interiors[id];
    if (!(Array.isArray(R.size) && R.size.length === 2 && R.size.every(isNum))) { errors.push(`world.json: room ${id} needs size [width, depth]`); continue; }
    const [W, D] = R.size;
    if (W > 60 || D > 60) errors.push(`world.json: room ${id} is bigger than 60 units`);
    if (!Array.isArray(R.objects)) errors.push(`world.json: room ${id} needs an objects list`);
    let wayOut = false;
    for (const o of R.objects ?? []) {
      if (!o.id) errors.push(`world.json: an object in room ${id} has no id`);
      if (!Array.isArray(o.pos) || o.pos.length !== 2 || !o.pos.every(isNum)) errors.push(`world.json: ${o.id} in room ${id} needs pos [x, z]`);
      else if (Math.abs(o.pos[0]) > W / 2 + 0.01 || Math.abs(o.pos[1]) > D / 2 + 0.01) errors.push(`world.json: ${o.id} is outside room ${id}`);
      if (o.type === "model") { if (!o.src || !existsSync(join(root, o.src))) errors.push(`world.json: model ${o.id} file ${o.src} not found`); }
      else if (!(o.type in (world.custom ?? {})) && !builtinTypes.includes(o.type)) errors.push(`world.json: ${o.id} in room ${id} uses unknown type "${o.type}"`);
      if (o.door) { if (!doorOk(o.door)) errors.push(`world.json: ${o.id} has a door to unknown room "${o.door}"`); else wayOut = true; }
      if (o.panel && !["closet", "bag"].includes(o.panel)) errors.push(`world.json: ${o.id} has unknown panel "${o.panel}"`);
    }
    if (!wayOut) errors.push(`world.json: room ${id} has no door out (add an object with "door": "outside")`);
  }
  if (roomIds.includes("home") && !(world.interiors.home.objects ?? []).some(o => o.panel === "closet")) errors.push("world.json: his house must keep its closet (an object with \"panel\": \"closet\")");
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
