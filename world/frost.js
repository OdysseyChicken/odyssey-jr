// OJ Frost (Day 7): how cold my yard is, and whether the grass grows frost overnight.
// Like OJ Weather it's made up but fair: the same for every visitor, rolled from the date, and it follows real rules:
//  - Normal highs and lows for each month at my pretend spot (40° N, 90° W, the middle of Illinois).
//  - Each day gets a warm or cold "air mass" nudge, and the nudges blend from day to day.
//  - Clouds are a blanket: cloudy nights stay warmer, clear calm nights get the coldest.
//  - The GRASS gets colder than the air on clear calm nights (up to ~6 °F colder). It loses its heat straight to the sky.
//    That's why there can be frost on the lawn when the thermometer on the post says 36 °F.
//  - Frost grows when the grass is at or below freezing AND at or below the dew point (water vapor turns right into ice).
//  - The sun melts it in the morning. In the shade of a tree or a house it lasts much longer ("frost shadows").
//
//   tempAt(date)     -> { air, grass, dew }                       °F, right now
//   frostAt(date)    -> { air, grass, dew, cover, shade, max, min, reset, word }   cover/shade 0..1
//   frostNights(date, n) -> [{ night: Date (the evening), low, grassLow, frost: 0..1, word }]
import { weatherFor } from "./weather.js";
import { sunAlt } from "./sky.js";

// normal high / low in °F, middle of each month (central Illinois)
const HI = [31, 36, 49, 62, 73, 82, 85, 83, 77, 64, 49, 35];
const LO = [16, 20, 30, 41, 52, 62, 66, 64, 55, 43, 32, 21];
export const FREEZE = 32;

function rng(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const ymd = d => d.toLocaleDateString("en-CA");
const noonOf = (d, add = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, 12);

function normals(d) { // blend between the middles of two months
  const m = d.getMonth() + (d.getDate() - 15) / 30;
  const a = ((Math.floor(m) % 12) + 12) % 12, b = (a + 1) % 12, f = m - Math.floor(m);
  return { hi: HI[a] + (HI[b] - HI[a]) * f, lo: LO[a] + (LO[b] - LO[a]) * f };
}
const massCache = new Map();
function mass(d) { // the day's air mass: -1 (cold snap) .. +1 (warm spell), smoothed with its neighbors
  const k = ymd(d); if (massCache.has(k)) return massCache.get(k);
  const raw = x => { const r = rng("oj-frost " + ymd(x)); return (r() + r() + r()) / 1.5 - 1; };
  const v = raw(noonOf(d, -1)) * 0.25 + raw(d) * 0.5 + raw(noonOf(d, 1)) * 0.25;
  massCache.set(k, v); return v;
}
const avg = (hours, a, b, key) => { let s = 0; for (let h = a; h < b; h++) s += hours[h][key]; return s / (b - a); };

const dayCache = new Map();
// the day's high (mid-afternoon) and the low (just around sunrise, the coldest part of the night)
function dayTemps(d) {
  const k = ymd(d); if (dayCache.has(k)) return dayCache.get(k);
  const n = normals(d), m = mass(d) * 9, w = weatherFor(d), prev = weatherFor(noonOf(d, -1));
  const nightHours = prev.hours.slice(19).concat(w.hours.slice(0, 7));
  const nCloud = nightHours.reduce((s, x) => s + x.cloud, 0) / nightHours.length;
  const nWind = nightHours.reduce((s, x) => s + x.wind, 0) / nightHours.length;
  const dCloud = avg(w.hours, 10, 16, "cloud"), dRain = avg(w.hours, 8, 18, "rain");
  const lo = n.lo + m + (nCloud - 0.4) * 9 + (nWind - 0.3) * 4;                 // clouds = blanket; wind stirs warmer air down
  const hi = Math.max(lo + 4, n.hi + m - (dCloud - 0.35) * 8 - dRain * 4);
  const wet = Math.max(avg(prev.hours, 12, 24, "rain"), avg(w.hours, 0, 12, "rain"));
  const out = { hi, lo, nCloud, nWind, wet };
  dayCache.set(k, out); return out;
}

// air temperature: lowest around 7 am, highest around 3 pm, cooling quickly after sunset then slowly all night
function airAt(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 7 && h < 15) { const t = dayTemps(date); return t.lo + (t.hi - t.lo) * (1 - Math.cos(Math.PI * (h - 7) / 8)) / 2; }
  const from = h >= 15 ? date : noonOf(date, -1), to = h >= 15 ? noonOf(date, 1) : date;
  const a = dayTemps(from).hi, b = dayTemps(to).lo, f = ((h >= 15 ? h : h + 24) - 15) / 16;
  return a + (b - a) * Math.pow(f, 0.55);
}
export function tempAt(date = new Date()) {
  const air = airAt(date), hr = weatherFor(date).hours[date.getHours()];
  const alt = sunAlt(date);
  // the grass: at night it radiates its heat to a clear sky (clouds send heat back, wind mixes warmer air in)
  const night = alt < 3 ? 1 : alt < 15 ? (15 - alt) / 12 : 0;
  const chill = night * (1 - hr.cloud * 0.85) * (1 - Math.min(1, hr.wind * 1.3) * 0.75) * 6.5;
  const sunWarm = alt > 0 ? Math.sin(alt * Math.PI / 180) * (1 - hr.cloud * 0.7) * 6 : 0;
  // dew point: on still autumn nights it's close to the night's low; wetter after rain
  const t = dayTemps(date.getHours() >= 15 ? noonOf(date, 1) : date);
  const dew = Math.min(air, t.lo + 1.5 + t.wet * 4);
  return { air, grass: air - chill + sunWarm, dew, cloud: hr.cloud, wind: hr.wind, rain: hr.rain, alt };
}

const STEP = 15; // minutes
const fCache = new Map();
export function frostAt(date = new Date()) {
  const key = Math.floor(date.getTime() / (STEP * 60000));
  if (fCache.has(key)) return fCache.get(key);
  // start at 3 pm yesterday-or-today (frost never survives a whole afternoon), walk forward
  const start = new Date(date); if (start.getHours() < 15) start.setDate(start.getDate() - 1); start.setHours(15, 0, 0, 0);
  // the Six's thermometer gets reset at 9 am every morning, like real weather observers do
  const reset = new Date(date); if (reset.getHours() < 9) reset.setDate(reset.getDate() - 1); reset.setHours(9, 0, 0, 0);
  let cover = 0, shade = 0, max = -99, min = 199;
  const t0 = new Date(Math.min(start, reset));
  for (let t = t0; t <= date; t = new Date(t.getTime() + STEP * 60000)) {
    const T = tempAt(t), dt = STEP / 60;
    if (t >= reset) { max = Math.max(max, T.air); min = Math.min(min, T.air); }
    if (t < start) continue;
    if (T.grass <= FREEZE && T.grass <= T.dew + 0.5 && T.rain < 0.1) { // ice crystals grow straight from the air
      const grow = 0.22 * dt * Math.min(1.6, 0.5 + (FREEZE - T.grass) / 4);
      cover = Math.min(1, cover + grow); shade = Math.min(1, shade + grow);
    }
    const sun = T.alt > 0 ? Math.sin(T.alt * Math.PI / 180) * (1 - T.cloud * 0.75) : 0;
    const warm = Math.max(0, T.air - 33) * 0.09;
    const wash = T.rain * 1.5;
    cover = Math.max(0, cover - dt * (sun * 3.2 + warm + wash + (T.grass > 34 ? 0.3 : 0)));
    shade = Math.max(0, shade - dt * (warm * 0.8 + wash + sun * 0.25));
  }
  const T = tempAt(date);
  const word = cover > 0.6 ? "a white frost" : cover > 0.25 ? "a light frost" : cover > 0.03 ? "a few frosty patches" : shade > 0.1 ? "frost only in the shadows" : T.grass <= FREEZE + 2 && T.alt < 0 ? "cold enough… maybe soon" : "no frost";
  const out = { ...T, cover, shade, max, min, reset, word };
  fCache.set(key, out);
  if (fCache.size > 400) fCache.delete(fCache.keys().next().value);
  return out;
}

// the next few nights: how cold, and will there be frost by sunrise?
export function frostNights(date = new Date(), n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const eve = new Date(date); eve.setDate(eve.getDate() + i + (date.getHours() >= 9 ? 0 : -1)); eve.setHours(18, 0, 0, 0);
    let low = 199, grassLow = 199, best = 0;
    for (let m = 0; m <= 15 * 60; m += 30) {
      const t = new Date(eve.getTime() + m * 60000), T = tempAt(t);
      low = Math.min(low, T.air); grassLow = Math.min(grassLow, T.grass);
      if (m % 60 === 0 && m >= 10 * 60) best = Math.max(best, frostAt(t).cover);
    }
    out.push({ night: eve, low, grassLow, frost: best, word: best > 0.6 ? "white frost" : best > 0.25 ? "light frost" : best > 0.03 ? "patchy frost" : grassLow <= FREEZE ? "frosty grass, but too dry" : "no frost" });
  }
  return out;
}
