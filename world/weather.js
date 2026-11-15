// OJ Weather: the weather in Odyssey Jr.'s yard (Day 3).
// It is made up, not real, but it is the same for every visitor: each day's weather is rolled from the date,
// hour by hour, like a little forecast. Clouds roll in, showers come and go, the wind picks up and dies down,
// and if the sun comes out right after rain there's a rainbow.
//
//   weatherFor(date)  -> { kind, hours: [24 x { kind, cloud, rain, wind, dir }] }   the whole day
//   weatherAt(date)   -> { kind, icon, name, cloud, rain, wind, knots, dir, from, rainbow, afterRain, rainMM }   right now
//
// cloud, rain, wind are 0..1. wind 1 = about 20 knots. dir is the way the wind blows FROM, in radians
// (0 = from the north, which is -z in the yard; PI/2 = from the east, +x).

function rng(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

export const KINDS = {
  clear:   { icon: "☀️", name: "Clear skies",   cloud: 0.05, rain: 0 },
  fair:    { icon: "🌤️", name: "Fair weather",  cloud: 0.35, rain: 0 },
  cloudy:  { icon: "☁️", name: "Cloudy",        cloud: 0.8,  rain: 0 },
  showers: { icon: "🌦️", name: "Showers",       cloud: 0.75, rain: 0.45 },
  rain:    { icon: "🌧️", name: "Rain",          cloud: 1.0,  rain: 1 }
};
// Which way the weather tends to go next hour, for each kind of day.
const NEXT = {
  sunny: { clear: { clear: 6, fair: 3 },          fair: { clear: 3, fair: 5, cloudy: 1 },              cloudy: { fair: 3, cloudy: 2 },             showers: { fair: 2, cloudy: 2 },             rain: { showers: 3, cloudy: 1 } },
  mixed: { clear: { clear: 3, fair: 4 },          fair: { clear: 2, fair: 4, cloudy: 2, showers: 1 },  cloudy: { fair: 2, cloudy: 3, showers: 2 }, showers: { fair: 2, cloudy: 2, showers: 2 }, rain: { showers: 3, cloudy: 1 } },
  rainy: { clear: { fair: 3, cloudy: 1 },         fair: { fair: 2, cloudy: 3, showers: 1 },            cloudy: { cloudy: 3, showers: 3, rain: 1 }, showers: { cloudy: 2, showers: 3, rain: 2, fair: 1 }, rain: { rain: 3, showers: 3, cloudy: 1 } }
};
const pick = (table, r) => { let t = 0; for (const k in table) t += table[k]; let x = r() * t; for (const k in table) { x -= table[k]; if (x <= 0) return k; } return Object.keys(table)[0]; };
const ymd = d => d.toLocaleDateString("en-CA");

const cache = new Map();
export function weatherFor(date) {
  const key = ymd(date);
  if (cache.has(key)) return cache.get(key);
  const r = rng("oj-weather " + key);
  const roll = r(), kind = roll < 0.4 ? "sunny" : roll < 0.75 ? "mixed" : "rainy";
  let now = kind === "sunny" ? "clear" : kind === "mixed" ? "fair" : "cloudy";
  const baseWind = 0.15 + r() * 0.45, baseDir = r() * Math.PI * 2;
  const hours = [];
  for (let h = 0; h < 24; h++) {
    now = pick(NEXT[kind][now], r);
    const k = KINDS[now];
    const wind = Math.min(1, Math.max(0.03, baseWind + (r() - 0.5) * 0.3 + k.rain * 0.25 + (h > 11 && h < 18 ? 0.1 : -0.05)));
    hours.push({ kind: now, cloud: k.cloud, rain: k.rain, wind, dir: baseDir + Math.sin(h / 4 + r()) * 0.6 });
  }
  const out = { kind, hours };
  cache.set(key, out);
  return out;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = dir => COMPASS[Math.round(((dir % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8];

export function weatherAt(date = new Date()) {
  const day = weatherFor(date), h = date.getHours(), m = date.getMinutes() + date.getSeconds() / 60;
  const a = day.hours[h], b = h < 23 ? day.hours[h + 1] : a;
  // ease into the next hour during the last 15 minutes so clouds and rain fade in and out
  const f = Math.max(0, (m - 45) / 15), mix = (x, y) => x + (y - x) * f;
  const cloud = mix(a.cloud, b.cloud), rain = mix(a.rain, b.rain), wind = mix(a.wind, b.wind), dir = mix(a.dir, b.dir);
  const prev = h > 0 ? day.hours[h - 1] : null;
  const afterRain = !!(prev && prev.rain > 0 && a.rain === 0);
  // a rainbow needs the sun out (low-ish, in the day) right after rain
  const rainbow = afterRain && a.cloud < 0.6 && h >= 7 && h < 18 ? Math.max(0, Math.min(1, (40 - m) / 10)) : 0;
  let rainMM = 0;
  for (let i = 0; i < h; i++) rainMM += day.hours[i].rain * 2.5;
  rainMM += a.rain * 2.5 * (m / 60);
  const k = KINDS[a.kind];
  return { kind: a.kind, icon: k.icon, name: k.name, cloud, rain, wind, knots: Math.round(wind * 20), dir, from: compass(dir), rainbow, afterRain, rainMM, day };
}
