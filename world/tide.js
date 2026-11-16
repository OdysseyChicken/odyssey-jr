// OJ Tides (Day 4, bonus 2): the tide on Pip's beach, worked out from where the REAL moon and sun are, right now.
// How tides work (in chicken words): the moon pulls the near side of the Earth a bit more than the middle, and the
// middle a bit more than the far side, so the sea gets stretched into TWO bulges, one under the moon and one on the
// opposite side. The Earth spins under both bulges, so most beaches get two high tides and two low tides a day.
// The moon moves along its orbit too, so the bulges come back about 50 minutes later every day (12 h 25 min apart).
// The sun makes its own smaller bulges (less than half as strong). When sun and moon line up (new and full moon) they
// add up: SPRING tides, big. When they're at right angles (quarter moons) they partly cancel: NEAP tides, small.
//
// The model: two "constituents", like real tide predictions use.
//   M2 (the moon's, every 12.42 h) and S2 (the sun's, every 12 h), each peaking when its body crosses the meridian
//   (above OR below), plus a lag, because real water is slow and has to slosh around coasts to get there.
//   tideAt(date) -> { h, range, rising, phase }   h in meters above mean sea level at Pip's beach
//   nextTurns(date, n) -> [{ kind: "high"|"low", time: Date, h }]
//   beachOpen(date) -> true when the tide is low enough to land OJ-1 on the sand
import { lst, moonPos, sunPos } from "./sky.js";

const D = Math.PI / 180;
export const M2 = 1.25, S2 = 0.45;       // meters: Pip's beach has a medium-big tide (spring range ~3.4 m, neap ~1.6 m)
export const LAG_HOURS = 1.8;            // high water comes ~1.8 hours after the moon crosses the meridian there
export const PLACE = "Pip's beach on the island";

// hour angle of a body in degrees (0 = on the meridian, south)
const hourAngle = (ra, date) => lst(date) - ra;

export function tideAt(date = new Date()) {
  const lag = new Date(date.getTime() - LAG_HOURS * 3600000);
  const m = moonPos(lag), s = sunPos(lag);
  const h = M2 * Math.cos(2 * hourAngle(m.ra, lag) * D) + S2 * Math.cos(2 * hourAngle(s.ra, lag) * D);
  const soon = tideAtRaw(new Date(date.getTime() + 10 * 60000));
  // how strong the tides are today: 1 = spring (sun and moon in line), 0 = neap (at right angles)
  const spring = (1 + Math.cos(4 * Math.PI * m.phase)) / 2;
  return { h, rising: soon > h, range: 2 * (M2 - S2 + 2 * S2 * spring), spring, phase: m.phase };
}
function tideAtRaw(date) {
  const lag = new Date(date.getTime() - LAG_HOURS * 3600000);
  return M2 * Math.cos(2 * hourAngle(moonPos(lag).ra, lag) * D) + S2 * Math.cos(2 * hourAngle(sunPos(lag).ra, lag) * D);
}

// the next n highs and lows after `date` (step forward 5 minutes at a time and look for the turn)
export function nextTurns(date = new Date(), n = 4) {
  const out = [], step = 5 * 60000;
  let t = date.getTime(), prev = tideAtRaw(new Date(t)), cur = tideAtRaw(new Date(t + step));
  for (let i = 0; i < 2000 && out.length < n; i++) {
    const nx = tideAtRaw(new Date(t + 2 * step));
    if (cur >= prev && cur > nx) out.push({ kind: "high", time: new Date(t + step), h: cur });
    if (cur <= prev && cur < nx) out.push({ kind: "low", time: new Date(t + step), h: cur });
    prev = cur; cur = nx; t += step;
  }
  return out;
}

// the beach where OJ-1 can land is only uncovered when the water is well below middle
export const BEACH_LINE = -0.5;
export const beachOpen = (date = new Date()) => tideAtRaw(date) < BEACH_LINE;

// a day of tide (for drawing a curve): points every `mins` minutes
export function tideCurve(from = new Date(), hours = 24, mins = 15) {
  const pts = [];
  for (let k = 0; k <= hours * 60 / mins; k++) { const d = new Date(from.getTime() + k * mins * 60000); pts.push({ time: d, h: tideAtRaw(d) }); }
  return pts;
}
// rule of twelfths: in the ~6 hours from low to high, the water rises 1, 2, 3, 3, 2, 1 twelfths in each hour
export const TWELFTHS = [1, 2, 3, 3, 2, 1];
