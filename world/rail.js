// OJ Rail (Day 9): my railway. The track is one big loop around my old yard, out in the new land.
// Everything here is plain math (no three.js), so the train is in the SAME place for everybody who visits:
// where it is only depends on the clock.
//
// The loop is a "superellipse" (|x/A|^N + |z/B|^N = 1): a rounded rectangle, straight-ish on the sides with
// gentle corners, so the train doesn't have to take any sharp curves (real trains HATE sharp curves).
// Coop Junction (my station) is on the south side at x = 0, z = +B. The tunnel is on the north side, through Tunnel Hill.

export const A = 29, B = 27, N = 4;
export const GAUGE = 0.9;                   // distance between the rails (I'm about 2 tall, so this is a ride-on garden railway)

// a point on the loop for angle u (0 = east, going counterclockwise seen from above... toward -z first)
function raw(u) {
  const c = Math.cos(u), s = Math.sin(u);
  return [A * Math.sign(c) * Math.abs(c) ** (2 / N), B * Math.sign(s) * Math.abs(s) ** (2 / N)];
}

// arc-length table, so the train moves at a steady speed (u alone bunches up on the straights)
const STEPS = 2000, us = [], ss = [];
{
  let s = 0, [px, pz] = raw(0);
  for (let i = 0; i <= STEPS; i++) {
    const u = (i / STEPS) * Math.PI * 2, [x, z] = raw(u);
    s += Math.hypot(x - px, z - pz); px = x; pz = z;
    us.push(u); ss.push(s);
  }
}
export const LENGTH = ss[STEPS];
const S0 = (() => { // arc length where the loop crosses z = +B at x = 0 (u = pi/2): that's the station
  const i = Math.round(STEPS / 4); return ss[i];
})();

// a point (and the heading) at distance s along the track, measured from the station
export function trackAt(s) {
  s = (((s + S0) % LENGTH) + LENGTH) % LENGTH;
  let lo = 0, hi = STEPS;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ss[m] < s) lo = m; else hi = m; }
  const f = (s - ss[lo]) / ((ss[hi] - ss[lo]) || 1), u = us[lo] + (us[hi] - us[lo]) * f;
  const [x, z] = raw(u), [x2, z2] = raw(u + 0.002);
  return { x, z, yaw: Math.atan2(x2 - x, z2 - z) };   // yaw: which way the train faces (+z = 0)
}

// ---------- the timetable ----------
// A train leaves Coop Junction every 4 minutes from 7:00 in the morning till 7:56 at night.
// It goes round the loop twice (through the tunnel twice!), then pulls back in and waits.
export const CYCLE = 240, LAPS = 2, TOP = 5.2, ACC = 0.9; // seconds, laps, top speed (units/s), speeding up (units/s²)
export const FIRST = 7 * 60, LAST = 19 * 60 + 56;        // minutes after midnight
const RUN_D = LAPS * LENGTH, TA = TOP / ACC, DA = 0.5 * ACC * TA * TA;
export const RUN_T = 2 * TA + (RUN_D - 2 * DA) / TOP;    // how long a trip takes (seconds)

function distAt(tt) { // distance travelled tt seconds after leaving
  if (tt <= 0) return 0;
  if (tt >= RUN_T) return RUN_D;
  if (tt < TA) return 0.5 * ACC * tt * tt;
  if (tt > RUN_T - TA) { const r = RUN_T - tt; return RUN_D - 0.5 * ACC * r * r; }
  return DA + (tt - TA) * TOP;
}

const pad = n => String(n).padStart(2, "0");
export const clockStr = mins => { const h = Math.floor(mins / 60), m = mins % 60; return `${(h + 11) % 12 + 1}:${pad(m)} ${h < 12 ? "am" : "pm"}`; };

// where the train is right now. stage: "night" (parked, lamps on), "boarding" (waiting at the platform),
// "running". s = distance along the track from the station. trip = minutes of the departure it's on/waiting for.
export function trainAt(now = new Date()) {
  const mid = new Date(now); mid.setHours(0, 0, 0, 0);
  const secs = (now - mid) / 1000, mins = secs / 60;
  const lastSec = LAST * 60 + RUN_T;
  if (secs < FIRST * 60 - 60 * 15 || secs > lastSec + 60) {
    const next = secs < FIRST * 60 ? FIRST : FIRST + 24 * 60;
    return { stage: "night", s: 0, speed: 0, next, nextStr: clockStr(FIRST), tt: -1 };
  }
  // which departure are we on? departures at FIRST + k*4 min
  let k = Math.floor((secs - FIRST * 60) / CYCLE);
  k = Math.max(0, Math.min(k, (LAST - FIRST) / (CYCLE / 60)));
  const dep = FIRST * 60 + k * CYCLE, tt = secs - dep;
  if (tt < 0 || tt >= RUN_T) { // waiting at the platform for the next one
    const nextDep = tt < 0 ? dep : dep + CYCLE, nm = Math.round(nextDep / 60);
    const more = nm <= LAST;
    return { stage: "boarding", s: 0, speed: 0, next: more ? nm : null, nextStr: more ? clockStr(nm) : "tomorrow, 7:00 am", wait: more ? nextDep - secs : Infinity, tt: -1 };
  }
  const d = distAt(tt), d2 = distAt(tt + 0.1);
  return { stage: "running", s: d % LENGTH, lap: Math.min(LAPS, 1 + Math.floor(d / LENGTH)), speed: (d2 - d) / 0.1, tt, dep: Math.round(dep / 60), depStr: clockStr(Math.round(dep / 60)), left: RUN_T - tt };
}

// the next few departures (for the board at the station)
export function departures(now = new Date(), n = 5) {
  const mid = new Date(now); mid.setHours(0, 0, 0, 0);
  const mins = (now - mid) / 60000, out = [];
  for (let m = FIRST; m <= LAST && out.length < n; m += CYCLE / 60) if (m >= mins - 0.01) out.push(clockStr(m));
  return out;
}
export const inService = (now = new Date()) => { const h = now.getHours() + now.getMinutes() / 60; return h >= FIRST / 60 && h < LAST / 60 + 0.05; };
