// OJ Turkeys (Day 13): a wild turkey flock that lives in my east field. Everything runs on the real clock, so every
// visitor sees the flock in the same place at the same time.
// What I learned (and built in):
//  - Turkeys SLEEP IN TREES (safe from foxes). They fly up one by one around sunset, then hop branch to branch to get
//    higher. At dawn they talk quietly in the tree ("tree yelps"), a male gobbles, then they fly down. Lots of crash landings.
//  - In fall they're creatures of habit: the same loop every day, following food (acorns = "mast") and cover.
//  - Fall flocks: hens stay with their daughters (and this year's young males, the "jakes", until they split off in winter).
//  - Scratching for acorns leaves big bare patches in the leaves. That's how you find a flock.
//  - A jake practices STRUTTING to settle the pecking order: tail up and fanned, wings dragging, head red-white-blue, "pfft... vrrrum".
// turkeysAt(date) -> { stage, s (0 = under the roost .. 1 = at the feeding oak), label, rise, set }
import { sunTimes } from "./balloon.js";

export const ROOST = [31, -20];          // the old bare white oak in the east field
export const FEED = [28.4, 23.2];        // under far-oak-2: acorns!
// the daily path between them (outside the railway loop, round the pines)
export const ROUTE = [[34.6, -16.8], [36.0, -9.5], [34.4, -4.5], [33.2, 3.5], [31.6, 12.5], [29.8, 19.5], FEED];
export const FLOCK = [
  { id: "turkey-jake", name: "Rusty", kind: "jake", note: "this year's young male. Tiny beard. HUGE ideas. Struts at everybody." },
  { id: "turkey-hen-1", name: "Big Hazel", kind: "hen", note: "the boss hen. She picks the route, and she putts first." },
  { id: "turkey-hen-2", name: "Clover", kind: "hen", note: "Hazel's daughter. Best acorn finder in the flock." },
  { id: "turkey-hen-3", name: "Juniper", kind: "hen", note: "Hazel's other daughter. Always last up the tree." },
  { id: "turkey-hen-4", name: "Maple", kind: "hen", note: "a hen from the next flock over who decided to stay." },
  { id: "turkey-hen-5", name: "Pepper", kind: "hen", note: "the smallest. Yelps the loudest." }
];
const M = 60000;
const pts = ROUTE.reduce((a, p, i) => (i && (a.len += Math.hypot(p[0] - ROUTE[i - 1][0], p[1] - ROUTE[i - 1][1])), a.cum.push(a.len), a), { len: 0, cum: [] });
export const ROUTE_LEN = pts.len;
// a point on the route at distance d (clamped), plus the direction it's heading
export function routeAt(d) {
  d = Math.max(0, Math.min(pts.len, d));
  let i = 1; while (i < ROUTE.length - 1 && pts.cum[i] < d) i++;
  const a = ROUTE[i - 1], b = ROUTE[i], k = (d - pts.cum[i - 1]) / ((pts.cum[i] - pts.cum[i - 1]) || 1);
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, dir: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
// the times for one day (all Dates)
export function dayPlan(date) {
  const { rise, set } = sunTimes(date), at = (base, mins) => new Date(base.getTime() + mins * M);
  const noon = new Date(date); noon.setHours(11, 15, 0, 0);
  return {
    rise, set,
    talk: at(rise, -32),              // tree talk starts
    down: i => at(rise, -14 + i * 2.2), // fly-down times, one by one (Hazel first, she's the boss... Rusty is index 0 but waits)
    outStart: at(rise, 45), outEnd: noon,
    backStart: at(set, -125), backEnd: at(set, -38),
    up: i => at(set, -17 + i * 2.6)   // fly-up times, one by one, finishing near sunset
  };
}
// the flock's stage right now
export function turkeysAt(date = new Date()) {
  const p = dayPlan(date), t = date.getTime();
  const lastDown = p.down(FLOCK.length - 1).getTime() + 8000, firstUp = p.up(0).getTime();
  let stage, s = 0;
  if (t < p.talk.getTime()) stage = "roost";
  else if (t < p.down(0).getTime()) stage = "treetalk";
  else if (t < lastDown) stage = "flydown";
  else if (t < p.outStart.getTime()) stage = "gather";
  else if (t < p.outEnd.getTime()) { stage = "out"; s = (t - p.outStart) / (p.outEnd - p.outStart); }
  else if (t < p.backStart.getTime()) { stage = "feed"; s = 1; }
  else if (t < p.backEnd.getTime()) { stage = "back"; s = 1 - (t - p.backStart) / (p.backEnd - p.backStart); }
  else if (t < firstUp) stage = "gather2";
  else if (t < p.up(FLOCK.length - 1).getTime() + 8000) stage = "flyup";
  else stage = "roost";
  // they don't walk at a steady speed: they stop to feed, then catch up. Ease it with a little wobble.
  if (stage === "out" || stage === "back") s = Math.max(0, Math.min(1, s + Math.sin(s * Math.PI * 7) * 0.035));
  const LABELS = {
    roost: "asleep up in the Roost tree", treetalk: "awake in the Roost tree, yelping softly before fly-down", flydown: "flying down from the Roost (crash landings!)",
    gather: "under the Roost, scratching and strutting", out: "walking the east field to the acorn oak", feed: "scratching for acorns under the far oak",
    back: "walking home along the east field", gather2: "milling under the Roost, getting ready for bed", flyup: "flying up into the Roost for the night"
  };
  return { stage, s, label: LABELS[stage], ...p };
}
// small deterministic wobble (so all visitors see the same wandering)
export const wob = (t, i, k = 1) => Math.sin(t * 0.000021 * k + i * 1.7) * 0.6 + Math.sin(t * 0.000053 * k + i * 4.1) * 0.4;
