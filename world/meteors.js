// OJ Meteor Watch (Day 5): real meteor showers over my yard.
// Every shower is a river of dust left behind by a comet (or a rock-comet). Once a year the Earth drives through it,
// and all the bits hit the air going the SAME direction, so if you trace the streaks backwards they all come from one
// point in the sky: the RADIANT. (Like snowflakes in your headlights: they all seem to fly out from one spot ahead.)
//
//   SHOWERS                      the yearly showers (radiant RA/Dec in degrees, ZHR, speed km/s, parent)
//   showerZHR(s, date)           how strong a shower is right now (peaks, then fades off on both sides)
//   meteorRates(date, cloud)     what you'd REALLY count in an hour from my yard right now, shower by shower
//   upcoming(date, n)            the next shower peaks
//   tonight(date, cloud)         hour-by-hour counts for tonight, and the best hour
//
// The math is the one real meteor counters use (International Meteor Organization):
//   ZHR(t)  = ZHRmax · 10^(−B·|days from peak|)
//   HR      = ZHR · sin(radiant altitude) / r^(6.5 − LM)
// where LM is the faintest star you can see (6.5 in perfect dark, much less with the moon up), and r is the shower's
// "population index" (how many more faint ones there are than bright ones; ~2 to 3).
import { altAz, sunPos, moonPos, lst, daylight } from "./sky.js";
const D = Math.PI / 180;

export const SHOWERS = [
  { id: "QUA", name: "Quadrantids", ra: 230, dec: 49, zhr: 80, v: 41, r: 2.1, peak: [1, 3, 14], start: [12, 28], end: [1, 12], B: [0.8, 1.6], parent: "asteroid 2003 EH1 (probably a dead comet)", color: [0.85, 0.9, 1], note: "Named after a constellation that doesn't exist any more (Quadrans Muralis). Super sharp peak, only a few hours." },
  { id: "LYR", name: "Lyrids", ra: 271, dec: 34, zhr: 18, v: 49, r: 2.1, peak: [4, 22, 18], start: [4, 14], end: [4, 30], B: [0.35, 0.6], parent: "Comet Thatcher (C/1861 G1)", color: [1, 1, 0.92], note: "The oldest shower anyone wrote down: Chinese sky-watchers saw it in 687 BC." },
  { id: "ETA", name: "Eta Aquariids", ra: 338, dec: -1, zhr: 50, v: 66, r: 2.4, peak: [5, 6, 8], start: [4, 19], end: [5, 28], B: [0.08, 0.08], parent: "Halley's Comet", color: [1, 0.95, 0.8], note: "Bits of Halley's Comet. Better from the south half of the world." },
  { id: "SDA", name: "Southern Delta Aquariids", ra: 340, dec: -16, zhr: 25, v: 41, r: 2.5, peak: [7, 31, 0], start: [7, 12], end: [8, 23], B: [0.09, 0.09], parent: "Comet 96P/Machholz (probably)", color: [1, 1, 0.95], note: "Low in the south for me at 40° north. Lots of faint ones." },
  { id: "PER", name: "Perseids", ra: 48, dec: 58, zhr: 100, v: 59, r: 2.2, peak: [8, 12, 20], start: [7, 17], end: [8, 24], B: [0.05, 0.2], parent: "Comet Swift-Tuttle", color: [1, 0.96, 0.85], note: "The famous warm-summer-night shower. Lots of bright ones with smoky trains." },
  { id: "DRA", name: "Draconids", ra: 262, dec: 54, zhr: 5, v: 20, r: 2.6, peak: [10, 8, 18], start: [10, 6], end: [10, 10], B: [1.2, 1.2], parent: "Comet Giacobini-Zinner", color: [1, 0.88, 0.7], note: "Super slow (20 km/s). Usually sleepy, but once in a while it explodes into a storm." },
  { id: "ORI", name: "Orionids", ra: 95, dec: 16, zhr: 20, v: 66, r: 2.5, peak: [10, 21, 6], start: [10, 2], end: [11, 7], B: [0.1, 0.1], parent: "Halley's Comet", color: [1, 0.97, 0.88], note: "Halley's Comet AGAIN. Earth crosses its dust twice a year (May and October)." },
  { id: "STA", name: "Southern Taurids", ra: 52, dec: 15, zhr: 7, v: 27, r: 2.3, peak: [11, 5, 0], start: [9, 20], end: [11, 20], B: [0.03, 0.03], parent: "Comet Encke", color: [1, 0.85, 0.6], note: "Slow and famous for fireballs: big, bright, orange." },
  { id: "NTA", name: "Northern Taurids", ra: 58, dec: 22, zhr: 5, v: 29, r: 2.3, peak: [11, 12, 0], start: [10, 20], end: [12, 10], B: [0.03, 0.03], parent: "asteroid 2004 TG10", color: [1, 0.85, 0.6], note: "The Southern Taurids' twin. Slow fireballs in the fall." },
  { id: "LEO", name: "Leonids", ra: 152, dec: 22, zhr: 15, v: 71, r: 2.5, peak: [11, 17, 23.75], start: [11, 6], end: [11, 30], B: [0.4, 0.4], parent: "Comet Tempel-Tuttle (comes back every 33 years, next in 2031)", color: [0.82, 1, 0.88], note: "The FASTEST shower: 71 km/s. They hit the air head-on, and the bright ones leave glowing green trains. In 1833 and 1966 there were meteor STORMS: thousands a minute." },
  { id: "GEM", name: "Geminids", ra: 112, dec: 33, zhr: 150, v: 35, r: 2.6, peak: [12, 14, 12], start: [12, 4], end: [12, 20], B: [0.39, 0.81], parent: "asteroid 3200 Phaethon (a rock-comet)", color: [1, 1, 0.82], note: "The BEST shower of the year. Slow, bright, yellow-white, and you can see them before midnight." },
  { id: "URS", name: "Ursids", ra: 217, dec: 76, zhr: 10, v: 33, r: 3.0, peak: [12, 22, 9], start: [12, 17], end: [12, 26], B: [0.8, 0.8], parent: "Comet Tuttle", color: [1, 1, 0.92], note: "Come out of the Little Dipper, right by the North Star. Up all night." }
];
const DAY = 86400000;
const at = (y, md, h = 0) => Date.UTC(y, md[0] - 1, md[1]) + h * 3600000;
// the peak nearest to this date (looking at last year, this year and next year), in days (+ = after the peak)
function sincePeak(s, date) {
  const y = date.getUTCFullYear(); let best = null;
  for (const yy of [y - 1, y, y + 1]) { const d = (date.getTime() - at(yy, s.peak, s.peak[2])) / DAY; if (best === null || Math.abs(d) < Math.abs(best)) best = d; }
  return best;
}
function isActive(s, date) {
  const y = date.getUTCFullYear(), t = date.getTime();
  for (const yy of [y - 1, y]) { const a = at(yy, s.start), b = at(s.end[0] < s.start[0] ? yy + 1 : yy, s.end) + DAY; if (t >= a && t < b) return true; }
  return false;
}
export function showerZHR(s, date) {
  if (!isActive(s, date)) return 0;
  const d = sincePeak(s, date);
  return s.zhr * Math.pow(10, -(d < 0 ? s.B[0] : s.B[1]) * Math.abs(d));
}
// how dark the sky is: the faintest star you can see (my yard is a farm yard, nice and dark: 6.2 on a perfect night)
export function limitingMag(date) {
  const dl = daylight(date); if (dl > 0.35) return 0;
  const m = moonPos(date), ma = altAz(m.ra, m.dec, date).alt;
  let lm = 6.2 - dl * 12;                                        // twilight washes the faint stars away
  if (ma > 0) lm -= m.lit * Math.sqrt(Math.sin(ma * D)) * 1.8;   // a bright moon up high: lose almost 2 magnitudes
  return Math.max(0, lm);
}
// sporadic meteors: the random ones from no shower. More before dawn, because then my side of the Earth faces the way
// the Earth is going around the sun (the "apex"), like a windshield driving through rain.
export function sporadicHR(date, lm) {
  const sun = sunPos(date), solarHour = (((lst(date) - sun.ra) / 15 + 12) % 24 + 24) % 24;
  const apex = Math.cos((solarHour - 6) / 24 * 2 * Math.PI);    // +1 at 6 am, -1 at 6 pm
  return Math.max(0, (6 + 4 * apex) / Math.pow(2.8, 6.5 - lm));
}
export function meteorRates(date, cloud = 0) {
  const lm = limitingMag(date), clear = Math.max(0, 1 - cloud * 1.1);
  const showers = SHOWERS.map(s => {
    const zhr = showerZHR(s, date), rad = altAz(s.ra, s.dec, date);
    const hr = zhr > 0 && rad.alt > 0 && lm > 0 ? zhr * Math.sin(rad.alt * D) / Math.pow(s.r, 6.5 - lm) * clear : 0;
    return { s, zhr, hr, rad };
  }).filter(x => x.zhr > 0.5);
  const sporadic = lm > 0 ? sporadicHR(date, lm) * clear : 0;
  return { lm, showers, sporadic, total: sporadic + showers.reduce((a, x) => a + x.hr, 0) };
}
export function upcoming(date, n = 4) {
  const out = [];
  for (const s of SHOWERS) for (const yy of [date.getUTCFullYear(), date.getUTCFullYear() + 1]) {
    const t = at(yy, s.peak, s.peak[2]);
    if (t > date.getTime() - DAY) { out.push({ s, when: new Date(t), moon: moonPos(new Date(t)) }); break; }
  }
  return out.sort((a, b) => a.when - b.when).slice(0, n);
}
// tonight, hour by hour from 5 pm to 7 am (in the visitor's own clock), using the weather forecast if one is given
export function tonight(date, cloudAt = () => 0) {
  const start = new Date(date); if (start.getHours() < 7) start.setDate(start.getDate() - 1);
  start.setHours(17, 0, 0, 0);
  const hours = [];
  for (let h = 0; h <= 14; h++) {
    const t = new Date(start.getTime() + h * 3600000 + 1800000), r = meteorRates(t, cloudAt(t));
    hours.push({ t, total: r.total, lm: r.lm, showers: r.showers });
  }
  const best = hours.reduce((a, b) => (b.total > a.total ? b : a), hours[0]);
  return { hours, best };
}
