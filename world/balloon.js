// OJ Balloons (Day 10): my hot-air balloon, Montauciel II. Plain math, no three.js, so the balloon is in the SAME
// place for everybody who visits: where it is only depends on the clock (and the made-up weather in world/weather.js).
//
// What I learned:
// - Sept 19, 1783, Versailles: the Montgolfier brothers' balloon carried the first passengers ever: a sheep called
//   Montauciel ("climb-to-the-sky"), a duck and a ROOSTER. About 8 minutes, landed in a wood ~2 miles away, all fine
//   (the sheep kicked the rooster). So: a chicken was one of the first three aeronauts in history. I'm continuing the family business.
// - Hot air is lighter than cool air, so a big bag of it floats. Pilots keep the envelope around 100-120 °C. Burn = go up.
//   Pull the parachute valve (a lid in the crown) = let hot air out = go down. There is NO steering.
// - You steer by going UP or DOWN: the wind blows different ways at different heights. Before a flight you let go a little
//   "pibal" (pilot balloon) and watch which way it goes as it climbs.
// - The Albuquerque Box: on calm cold mornings, cold heavy air slides downhill and pools low, blowing one way, while the wind
//   above blows the other way. Fly low one way, climb, ride back, come down, land where you started! My yard has a tiny box:
//   cold air slides off Tunnel Hill on calm mornings and evenings.
// - Balloons fly just after sunrise and in the last hours before sunset: the wind is calm then. In the middle of the day
//   the sun heats the ground and makes bubbly rising air (thermals) that bounce balloons around. Land before dark.
// - In a balloon you feel NO wind, because you're moving WITH it. A candle in the basket wouldn't even flicker.
//
//   flightsFor(date)  -> [{ name, L (liftoff Date), go, why, knots, from, aloftFrom, ... }]  morning + evening
//   balloonAt(date)   -> { stage, x, y, z, fill, up, lay, burn, valve, aboard, pibal, flight, next }
//   hopAt(sec, base)  -> same shape: a quick tethered hop (anybody can ask for one by clicking)
// stage: packed | pibal | layout | cold | hot | weighoff | flying | landed | deflate | pack
import { weatherAt } from "./weather.js";
import { sunAlt } from "./sky.js";

export const FIELD = [-19, 16];          // my launch field, inside the loop of OJ Rail, south-west of the yard
export const MAX_KNOTS = 8;              // surface wind limit (a calm-ish morning)
export const LOW = 8, HIGH = 26;         // cruising heights (I'm 2 tall)
const FLY_MIN = 19;                      // liftoff to touchdown, minutes

const FAKE = (() => { try { const s = new URLSearchParams(location.search); return s.has("balloon") ? { load: Date.now(), m: parseFloat(s.get("balloon")) || -4 } : null; } catch { return null; } })();

function rng(str) {
  let h = 2166136261 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 16777619); }
  return () => { h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compass = dir => COMPASS[Math.round(((dir % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8];
const pad = n => String(n).padStart(2, "0");
export const timeStr = d => `${(d.getHours() + 11) % 12 + 1}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "am" : "pm"}`;

// sunrise / sunset (sun's top edge on the horizon) by stepping minute by minute
const sunCache = new Map();
export function sunTimes(date) {
  const key = date.toDateString(); if (sunCache.has(key)) return sunCache.get(key);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  let rise = null, set = null, prev = sunAlt(d);
  for (let m = 2; m <= 1440; m += 2) {
    const t = new Date(d.getTime() + m * 60000), a = sunAlt(t);
    if (prev < -0.83 && a >= -0.83 && !rise) rise = t;
    if (prev >= -0.83 && a < -0.83 && rise) { set = t; break; }
    prev = a;
  }
  const out = { rise: rise ?? new Date(d.getTime() + 7 * 3600000), set: set ?? new Date(d.getTime() + 17 * 3600000) };
  sunCache.set(key, out); return out;
}

// the altitude plan (minutes after liftoff -> height): up to LOW, drift, climb to HIGH, drift back, come down, land
function heightAt(m) {
  if (m <= 0) return 0;
  if (m < 2.5) return LOW * ss(m / 2.5) + 0.6 * Math.sin(m * 1.3) * ss(m / 2.5);
  if (m < 6) return LOW + 0.8 * Math.sin(m * 1.7);
  if (m < 8.5) return lerp(LOW, HIGH, ss((m - 6) / 2.5));
  if (m < 14) return HIGH + 1.0 * Math.sin(m * 1.1);
  if (m < 17.5) return lerp(HIGH, 3.5, ss((m - 14) / 3.5));
  if (m < FLY_MIN) return 3.5 * (1 - ss((m - 17.5) / 1.5));
  return 0;
}
const upperness = y => ss((y - 12) / 9);

// keep a leg inside my land (radius ~36)
function room(from, dir, R = 36) {
  const [x, z] = from, dx = Math.sin(dir), dz = -Math.cos(dir);
  const b = x * dx + z * dz, c = x * x + z * z - R * R;
  return -b + Math.sqrt(Math.max(0, b * b - c));
}

const planCache = new Map();
function makeFlight(name, L) {
  const key = name + L.getTime(); if (planCache.has(key)) return planCache.get(key);
  const r = rng("oj-balloon " + key);
  const w = weatherAt(L), wLater = weatherAt(new Date(L.getTime() + 20 * 60000)), wPrep = weatherAt(new Date(L.getTime() - 14 * 60000));
  // morning air is calmer than the weather station's hourly number (that's the whole point), so knock a bit off
  const knots = Math.max(0, w.wind * 20 * 0.75 - 1);
  let go = true, why = "";
  if (Math.max(w.rain, wLater.rain, wPrep.rain) > 0.05) { go = false; why = "Rain. A wet envelope is heavy and the burner hisses. Grounded."; }
  else if (knots > MAX_KNOTS) { go = false; why = `Too windy (${Math.round(knots)} knots at the field). The pibal went sideways like a rocket. Grounded.`; }
  else if (w.cloud > 0.9) { go = false; why = "Low clouds. You have to SEE where you're going. Grounded."; }
  // which way things drift: low = with the surface wind (blows FROM w.dir, so TO w.dir + PI); up high = back the other way, a bit off
  const lowDir = w.dir + Math.PI, highDir = w.dir + (r() - 0.5) * 0.7;
  const s1 = Math.min(2.2, 1.1 + knots * 0.15);                // units per minute, low
  // integrate the flight (no fudge yet)
  const dt = 0.05, pts = [];
  let x = 0, z = 0, lowT = 0, highT = 0;
  for (let m = 0; m <= FLY_MIN + 1e-6; m += dt) {
    const k = upperness(heightAt(m)); lowT += (1 - k) * dt; highT += k * dt;
  }
  const along = s1 * lowT, out = Math.min(along, room(FIELD, lowDir) * 0.85), s1b = out / lowT;
  const cosd = -Math.cos(highDir - lowDir) || 1, s2 = (s1b * lowT) / (highT * Math.max(0.6, cosd));
  for (let m = 0; m <= FLY_MIN + 1e-6; m += dt) {
    const k = upperness(heightAt(m));
    pts.push([x, z]);
    x += ((1 - k) * Math.sin(lowDir) * s1b + k * Math.sin(highDir) * s2) * dt;
    z += ((1 - k) * -Math.cos(lowDir) * s1b + k * -Math.cos(highDir) * s2) * dt;
  }
  // a gentle correction so I always touch down on my field (a perfect box!)
  const n = pts.length - 1, ex = pts[n][0], ez = pts[n][1];
  for (let i = 0; i <= n; i++) { const f = ss(i / n); pts[i] = [FIELD[0] + pts[i][0] - ex * f, FIELD[1] + pts[i][1] - ez * f]; }
  const far = Math.max(...pts.map(p => Math.hypot(p[0] - FIELD[0], p[1] - FIELD[1])));
  const f = { name, L, go, why, knots, from: compass(w.dir), aloftFrom: compass(highDir + Math.PI), lowDir, highDir, pts, far, lay: lowDir };
  planCache.set(key, f); return f;
}

export function flightsFor(date) {
  const { rise, set } = sunTimes(date);
  return [makeFlight("Sunrise flight", new Date(rise.getTime() + 30 * 60000)), makeFlight("Evening flight", new Date(set.getTime() - 55 * 60000))];
}

// the timeline around a liftoff (m = minutes after liftoff; negative = getting ready)
function stateFor(m, f, posFn) {
  const s = { stage: "packed", x: FIELD[0], y: 0, z: FIELD[1], fill: 0, up: 0, lay: f.lay, burn: 0, valve: 0, aboard: false, pibal: -1, fan: 0, m, flight: f };
  if (m < -14 || m > 26) return s;
  s.pibal = m >= -14 && m < -10 ? (m + 14) * 60 : -1;
  if (m < -12) { s.stage = "pibal"; return s; }
  if (m < -7) { s.stage = "layout"; s.fill = 0.08 * ss((m + 12) / 2); s.fan = m > -8 ? 1 : 0; return s; }
  if (m < -3) { s.stage = "cold"; s.fan = 1; s.fill = lerp(0.08, 0.75, ss((m + 7) / 4)); return s; }
  if (m < -1) { s.stage = "hot"; s.fan = ss((-2 - m) / 1); s.fill = lerp(0.75, 1, ss((m + 3) / 1.5)); s.up = ss((m + 2.8) / 1.8); s.burn = 1; return s; }
  s.fill = 1; s.up = 1;
  if (m < 0) { s.stage = "weighoff"; s.aboard = true; s.burn = m > -0.3 ? 1 : 0.15; return s; }
  if (m < FLY_MIN) {
    s.stage = "flying"; s.aboard = true;
    const [x, z] = posFn(m); s.x = x; s.z = z; s.y = heightAt(m);
    const vy = (heightAt(m + 0.05) - heightAt(m)) / 0.05;
    s.burn = vy > 0.6 ? 1 : vy < -0.4 ? 0 : 0.12;       // burn to climb, little blips to hold height, nothing on the way down
    s.valve = vy < -1.5 ? 1 : 0;
    return s;
  }
  if (m < 20.5) { s.stage = "landed"; s.aboard = true; s.burn = 0.05; return s; }
  if (m < 23.5) { s.stage = "deflate"; s.valve = 1; const k = ss((m - 20.5) / 3); s.up = 1 - k; s.fill = lerp(1, 0.08, ss((m - 21.2) / 2.3)); return s; }
  s.stage = "pack"; s.up = 0; s.fill = 0.08 * (1 - ss((m - 23.5) / 2.5)); return s;
}

function posIn(f) {
  return m => { const i = Math.min(f.pts.length - 2, Math.max(0, m / 0.05)), a = Math.floor(i), k = i - a, p = f.pts[a], q = f.pts[a + 1]; return [lerp(p[0], q[0], k), lerp(p[1], q[1], k)]; };
}

export function balloonAt(now = new Date()) {
  let fl = flightsFor(now);
  if (FAKE) { // ?balloon=-4 : pretend a flight is happening, starting at minute -4 when the page loads
    const L = new Date(FAKE.load - FAKE.m * 60000), f = makeFlight("Pretend flight", L); f.go = true; f.why = "";
    fl = [f];
  }
  const tomorrow = new Date(now.getTime() + 86400000);
  const all = [...fl, ...(FAKE ? [] : flightsFor(tomorrow))];
  const next = all.find(f => f.go && f.L.getTime() > now.getTime() - 26 * 60000 && (f.L.getTime() - now) / 60000 < 30 * 60) ?? null;
  for (const f of fl) {
    const m = (now - f.L) / 60000;
    if (m >= -14 && m <= 26) {
      if (!f.go) return { ...stateFor(99, f, posIn(f)), grounded: f, next: all.find(g => g.go && g.L > now) ?? null };
      const s = stateFor(m, f, posIn(f)); s.next = next; return s;
    }
  }
  const s = stateFor(99, fl[0], posIn(fl[0])); s.next = all.find(g => g.go && g.L > now) ?? null; s.today = fl; return s;
}

// a quick tethered hop: 3 ropes to stakes, up to ~11, hang there, back down. Anybody can ask (it's local, just for them).
export const HOP_LEN = 95;
export function hopAt(sec, lay = 0) {
  const s = { stage: "packed", x: FIELD[0], y: 0, z: FIELD[1], fill: 0, up: 0, lay, burn: 0, valve: 0, aboard: false, pibal: -1, fan: 0, tether: true };
  if (sec < 0 || sec > HOP_LEN) return s;
  if (sec < 14) { s.stage = "cold"; s.fan = 1; s.fill = lerp(0.08, 0.8, ss(sec / 10)); return s; }
  if (sec < 24) { s.stage = "hot"; s.fill = lerp(0.8, 1, ss((sec - 14) / 5)); s.up = ss((sec - 15) / 8); s.burn = 1; return s; }
  s.fill = 1; s.up = 1; s.aboard = true;
  if (sec < 27) { s.stage = "weighoff"; s.burn = 1; return s; }
  if (sec < 70) { s.stage = "flying"; const k = sec < 40 ? ss((sec - 27) / 13) : sec < 58 ? 1 : 1 - ss((sec - 58) / 12); s.y = 11 * k + (k > 0.9 ? Math.sin(sec) * 0.3 : 0); s.burn = sec < 40 ? 1 : sec < 58 ? (Math.sin(sec * 0.9) > 0.8 ? 1 : 0) : 0; s.valve = sec > 58 && sec < 64 ? 1 : 0; return s; }
  if (sec < 76) { s.stage = "landed"; return s; }
  s.aboard = false;
  s.stage = "deflate"; s.valve = 1; const k = ss((sec - 76) / 12); s.up = 1 - k; s.fill = lerp(1, 0, ss((sec - 78) / 16)); return s;
}

// how often can I fly? (for my notes) count go flights over the next n days
export function goRate(start = new Date(), n = 60) {
  let go = 0, all = 0;
  for (let i = 0; i < n; i++) for (const f of flightsFor(new Date(start.getTime() + i * 86400000))) { all++; if (f.go) go++; }
  return { go, all };
}
