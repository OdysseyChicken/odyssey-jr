// OJ Kites (Day 8 bonus): is it kite weather in my yard right now?
// Reads OJ Weather (world/weather.js) and turns the wind into a Beaufort number and a kite plan.
//
//   kiteAt(date) -> { knots, bft, word, sign, flyable, why, elev, line, swoop }
//
// What I learned (Beaufort numbers, the land signs, and kite winds):
//   0 calm (<1 kt): smoke goes straight up.            1 light air (1-3): smoke drifts. Only super-light kites.
//   2 light breeze (4-6): leaves rustle. Kites go up.  3 gentle breeze (7-10): twigs dance. BEST kite wind.
//   4 moderate (11-16): small branches move. Pulls!     5 fresh (17-21): small trees sway. Spars can snap.
//   6 strong (22-27): big branches move. Reel in.
// A kite flies higher (a steeper line) in a steady breeze. In light wind it hangs low, and in too much wind it
// swoops around and drags. Add ?kitewind=12 (knots) to the address to pretend.
import { weatherAt } from "./weather.js";
import { daylight } from "./sky.js";

const FAKE = (() => { try { const m = location.search.match(/[?&]kitewind=([\d.]+)/); return m ? parseFloat(m[1]) : null; } catch { return null; } })();

const BFT = [
  { max: 1, word: "Calm", sign: "smoke goes straight up" },
  { max: 4, word: "Light air", sign: "smoke drifts a little" },
  { max: 7, word: "Light breeze", sign: "leaves rustle, you feel it on your face" },
  { max: 11, word: "Gentle breeze", sign: "twigs dance and flags stand out" },
  { max: 17, word: "Moderate breeze", sign: "small branches move, dust and paper fly" },
  { max: 22, word: "Fresh breeze", sign: "small trees sway" },
  { max: 99, word: "Strong breeze", sign: "big branches move" }
];
export const beaufort = kn => BFT.findIndex(b => kn < b.max);

export function kiteAt(date = new Date()) {
  const w = weatherAt(date);
  const knots = FAKE ?? w.wind * 20, bft = beaufort(knots), b = BFT[bft];
  const light = daylight(date) > 0.35;
  let flyable = true, why = "";
  if (!light) { flyable = false; why = "It's dark. My kite sleeps on its post."; }
  else if (w.rain > 0.15 && FAKE == null) { flyable = false; why = "It's raining. A wet kite is a heavy kite."; }
  else if (knots < 4) { flyable = false; why = "Not enough wind. I ran up and down the yard anyway. It flopped."; }
  else if (knots > 19) { flyable = false; why = "Too much wind! My spars would snap. Reeled in."; }
  // line angle (elevation) above the horizon: low in light wind, steep in a steady breeze, droopy-swoopy when it's too strong
  const elev = knots < 4 ? 0.25 : knots < 7 ? 0.62 + (knots - 4) * 0.06 : knots < 14 ? 0.98 + Math.min(knots - 7, 4) * 0.02 : 1.06 - (knots - 14) * 0.05;
  const line = Math.min(20, 9 + knots * 0.7);           // more wind, more line out
  const swoop = knots > 13 ? Math.min(1, (knots - 13) / 6) : knots < 6 ? 0.4 : 0.1;
  return { knots, bft, word: b.word, sign: b.sign, flyable, why, elev, line, swoop, dir: w.dir, from: w.from, fake: FAKE != null };
}
