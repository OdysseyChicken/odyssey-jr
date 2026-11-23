// OJ Bees (Day 11): the wild honeybee colony in the hollow of my bee tree (far-oak-4, north-west corner).
// Everything runs on my yard's real-feeling weather (world/frost.js) and the real date, so every visitor sees the same bees.
//
// What I learned (and put in here):
// - Honeybees don't hibernate. Below about 57 °F they pull together into a WINTER CLUSTER, a ball of bees on the comb.
// - Bees in the middle shiver their flight muscles (wings still) to make heat. All together it's about a 20-40 W bulb.
// - The outside "shell" of bees is the blanket. It stays a bit above 50 °F; colder than that and a bee goes stiff (chill coma).
// - With no babies (brood) in early winter, the middle is kept above ~64 °F. Once the queen starts laying again after the
//   shortest day, the brood nest is held at 90-97 °F. In hard cold the ball squeezes smaller (less outside = less heat lost).
// - On a sunny day around 50 °F they zip out for a CLEANSING FLIGHT (a bathroom break: bees won't poop inside), then go
//   straight back in. In spring and summer (warm days) they forage.
// - They eat their honey all winter. A colony goes into winter with something like 60 lb.
// - Swarms (half the bees + the old queen leave to find a new home) happen on warm, calm, sunny days in late spring.
//   Scout bees (Seeley) like a dark ~40 litre hollow, a small (~15 cm²) entrance near the bottom, facing south, up high.
import { tempAt } from "./frost.js";

export const CLUSTER_F = 57;     // below this the bees ball up
export const FLY_F = 50;         // warm enough (with sun) for a quick flight out
export const SHELL_F = 50;       // the outside layer stays a bit above this
const DAY = 86400000;

// is the queen laying? (brood) she slows to a stop in the fall and starts again after the winter solstice
export function broodAt(date = new Date()) {
  const m = date.getMonth(), d = date.getDate();
  if (m === 11 && d >= 22) return 0.15 + (d - 22) * 0.02;           // a small patch in the middle, right after the solstice
  if (m === 0) return 0.25 + d * 0.01; if (m === 1) return 0.5; if (m >= 2 && m <= 8) return 1; if (m === 9) return 0.4;
  if (m === 10) return d < 10 ? 0.1 : 0;                              // November: hardly any, then none
  return 0;                                                           // early December: broodless
}

// honey left (lb): ~60 lb on Nov 1, eaten slowly in the cold, faster once brood starts; refilled from spring flowers
export function storesAt(date = new Date()) {
  const y = date.getMonth() >= 10 ? date.getFullYear() : date.getFullYear() - 1;
  const start = new Date(y, 10, 1), days = (date - start) / DAY;
  if (days < 0 || days > 200) return 60;                              // (summer: they're busy making it)
  const eaten = Math.min(days, 55) * 0.13 + Math.max(0, days - 55) * 0.25;
  return Math.max(12, 60 - eaten);
}

export function beesAt(date = new Date()) {
  const T = tempAt(date), air = T.air, sun = T.alt > 6 && T.cloud < 0.85, wet = T.rain > 0.1;
  const brood = broodAt(date), m = date.getMonth();
  const season = m >= 3 && m <= 9 ? "busy" : "winter";
  let mode, n = 0, say;
  if (T.alt < 0 && air < 60) { mode = "night"; }
  else if (air >= FLY_F && sun && !wet) { mode = season === "busy" ? "forage" : "cleansing"; n = Math.round(Math.min(1, (air - FLY_F + 3) / 14) * (season === "busy" ? 46 : 34)); }
  else if (air >= 44 && !wet && T.alt > 0) { mode = "guards"; n = 3; }
  else mode = "cluster";
  // the cluster: tighter when it's colder. radius in "comb" units (1 = loose, ~0.45 = squeezed)
  const clustered = air < CLUSTER_F;
  const radius = clustered ? Math.max(0.45, Math.min(1, 0.45 + (air - 5) / 95)) : 1.15;
  const core = brood > 0.12 ? 93 : clustered ? Math.round(Math.max(64, Math.min(86, 92 - (air - 10) * 0.35))) : 88;
  const shell = clustered ? Math.round(SHELL_F + 2 + Math.max(0, air - 20) * 0.08) : Math.round(Math.max(air, 60));
  return { mode, n, air, sun, wet, cloud: T.cloud, alt: T.alt, brood, season, clustered, radius, core, shell, stores: storesAt(date) };
}

// the next few hours when bees could fly (sunny, >= 50 °F, dry), from now, hour by hour
export function flightWindows(from = new Date(), days = 3) {
  const out = []; const t = new Date(from); t.setMinutes(0, 0, 0);
  let cur = null;
  for (let h = 0; h < days * 24; h++, t.setHours(t.getHours() + 1)) {
    const T = tempAt(t), ok = T.air >= FLY_F && T.alt > 6 && T.cloud < 0.85 && T.rain <= 0.1;
    if (ok && !cur) cur = { from: new Date(t), to: new Date(t), max: T.air };
    else if (ok) { cur.to = new Date(t); cur.max = Math.max(cur.max, T.air); }
    if (!ok && cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

// how long until swarm season (my bait hive's grand opening): roughly May 1 to June 30
export function swarmSeason(date = new Date()) {
  const y = date.getMonth() > 5 ? date.getFullYear() + 1 : date.getFullYear();
  const open = new Date(y, 4, 1), close = new Date(y, 5, 30);
  if (date >= open && date <= close) return { now: true, days: 0 };
  return { now: false, days: Math.ceil((open - date) / DAY) };
}
