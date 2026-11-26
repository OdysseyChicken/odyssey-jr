// OJ Mill (Day 14, Thanksgiving): my tower windmill. Is it grinding right now, how much cloth is on the sails,
// how fast is everything turning, and how much flour have I made today?
//
//   millAt(date) -> { knots, state, grinding, reef, cloth, rpm, spurRpm, stoneRpm, park, signal, why, flourToday, thanks }
//
// What I learned:
//  - In a TOWER mill only the CAP turns. A FANTAIL (Edmund Lee, 1745) is a little windmill on the back of the cap, at right
//    angles to the sails. When the wind comes round, it catches the wind, spins, and (through a LOT of gearing to a rack
//    round the top of the tower) slowly turns the cap. It stops by itself when the sails face the wind square on,
//    because then the fantail's own blades are edge-on to the wind.
//  - COMMON SAILS are a wooden lattice with canvas spread over it. The miller sets the cloth by hand, one sail at a time,
//    stopping each sail at the bottom: FULL SAIL in light wind, then DAGGER POINT, SWORD POINT and FIRST REEF as the
//    wind gets up. Too much wind = brake on, cloth off (a runaway mill can set its brake on fire!).
//    Later: spring sails (Andrew Meikle, 1772), roller reefing (Stephen Hooper, 1789), patent sails with shutters (William Cubitt).
//  - Gears: brake wheel (on the windshaft) -> wallower (top of the upright shaft) -> great spur wheel -> stone nut ->
//    quant -> RUNNER STONE, spinning on top of the BED STONE, which never moves. Mine are geared about 9 to 1.
//  - A centrifugal governor lifts or lowers the runner (tentering) as the speed changes. Windmills had governors
//    BEFORE steam engines did.
//  - Stopped sails talk: + (upright) = a long rest, X (St Andrew's cross) = a short rest, back soon. Top sail stopped
//    just BEFORE the top = rejoicing (a wedding, a birth, a feast). Just PAST the top = mourning.
// Add ?millwind=12 (knots) to the address to pretend.
import { weatherAt } from "./weather.js";
import { daylight } from "./sky.js";

const FAKE = (() => { try { const m = location.search.match(/[?&]millwind=([\d.]+)/); return m ? parseFloat(m[1]) : null; } catch { return null; } })();

export const REEFS = [
  { name: "Full sail", max: 9, cloth: 1.0, note: "every inch of canvas out: it's light wind" },
  { name: "Dagger point", max: 13, cloth: 0.72, note: "the cloth rolled back to a long point" },
  { name: "Sword point", max: 17, cloth: 0.5, note: "half the cloth, a skinny sword shape" },
  { name: "First reef", max: 22.5, cloth: 0.28, note: "just a strip of cloth. It's blowing!" }
];
export const CUT_IN = 5, CUT_OUT = 22.5;                 // knots
const TSR = 2.2, RADIUS = 11;                              // tip-speed ratio of old common sails; a real mill's sail is ~11 m
export const GEAR = { wallower: 2.25, stone: 9 };          // spur wheel turns 2.25x the sails, the runner stone 9x
// sail angle when parked (radians, from straight up, + = anticlockwise from the front)
export const PARK = { long: 0, short: Math.PI / 4, rejoice: -0.22, mourn: 0.22 };

// Thanksgiving (US): the 4th Thursday of November. On a feast day I park my sails in the rejoicing position.
export function isThanksgiving(d) {
  if (d.getMonth() !== 10 || d.getDay() !== 4) return false;
  return Math.ceil(d.getDate() / 7) === 4;
}

export function millAt(date = new Date()) {
  const w = weatherAt(date);
  const knots = FAKE ?? w.wind * 20;
  const light = daylight(date) > 0.4, h = date.getHours() + date.getMinutes() / 60;
  const thanks = isThanksgiving(date);
  let state = "grinding", why = "", park = PARK.short;
  if (!light || h < 7.5) { state = "night"; park = PARK.long; why = "Night. Brake on, cloth off, sails upright: a long rest. The miller (me) is asleep."; }
  else if (w.rain > 0.4 && FAKE == null) { state = "rain"; why = "Pouring. Wet canvas is heavy and slaps, so the cloth is rolled up on the whips."; }
  else if (knots < CUT_IN) { state = "calm"; why = `Only ${knots.toFixed(0)} knots. Not enough to turn the stones. Cloth out, waiting for a puff.`; }
  else if (knots > CUT_OUT) { state = "storm"; park = PARK.long; why = "Too much wind! Brake ON before she runs away and sets the brake wheel smoking."; }
  if (state !== "grinding" && state !== "night" && state !== "storm") park = thanks ? PARK.rejoice : PARK.short;
  if (state === "night" && thanks) park = PARK.rejoice;
  const grinding = state === "grinding";
  const reefI = Math.max(0, REEFS.findIndex(r => knots < r.max));
  const reef = REEFS[reefI];
  const cloth = state === "grinding" ? reef.cloth : state === "calm" ? 1.0 : 0.0;
  // sail speed: tip speed = TSR x wind speed. Reefing holds it down to ~13 rpm in strong winds.
  const raw = TSR * knots * 0.5144 / RADIUS * 60 / (2 * Math.PI);
  const rpm = grinding ? Math.min(raw, 12.5 + (raw - 12.5) * 0.15) : 0;
  return {
    knots, state, grinding, reef: reef.name, reefNote: reef.note, reefI, cloth, rpm, spurRpm: rpm * GEAR.wallower, stoneRpm: rpm * GEAR.stone,
    park, signal: signalName(park), why, thanks, dir: w.dir, from: w.from, flourToday: flourToday(date), fake: FAKE != null
  };
}
export const signalName = p => p === PARK.long ? "+ long rest" : p === PARK.short ? "X short rest (back soon)" : p === PARK.rejoice ? "rejoicing (top sail just before the top)" : "mourning";

// How much flour today, in sacks. A pair of stones at full speed fills about one of my sacks an hour (they're small sacks).
const flourCache = new Map();
export function flourToday(date) {
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  const key = day.getTime() + ":" + Math.floor((date - day) / 600000);
  if (flourCache.has(key)) return flourCache.get(key);
  let sacks = 0;
  for (let t = new Date(day.getTime() + 7.5 * 3600000); t < date; t = new Date(t.getTime() + 600000)) {
    const m = millAtLite(t); if (m > 0) sacks += m / 12.5 / 6;   // 10-minute steps
  }
  sacks = Math.round(sacks * 10) / 10;
  flourCache.set(key, sacks); return sacks;
}
function millAtLite(t) {   // just the sail rpm (no recursion into flourToday)
  const w = weatherAt(t), knots = FAKE ?? w.wind * 20;
  if (daylight(t) <= 0.4 || (w.rain > 0.4 && FAKE == null) || knots < CUT_IN || knots > CUT_OUT) return 0;
  const raw = TSR * knots * 0.5144 / RADIUS * 60 / (2 * Math.PI);
  return Math.min(raw, 12.5 + (raw - 12.5) * 0.15);
}
