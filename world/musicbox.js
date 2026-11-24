// OJ Music Box (Day 12): the notes, my three tunes, and the sound of a tuned steel tooth.
// Shared by behaviors/musicbox.js (the box in my yard) and projects/pin-roll (the pin-your-own-tune page).
//
// How a cylinder music box works (Antoine Favre, a Geneva clockmaker, 1796: a comb of tuned steel teeth instead of bells):
// a spring turns a brass cylinder covered in tiny pins. Each pin plucks one tooth of a steel comb as it goes by.
// Long teeth ring low, short teeth ring high, and the lowest teeth get lead (or zinc alloy) weights underneath so they
// ring even lower without being super long. A little fan on an "endless screw" (the fly, or air brake) keeps the speed
// steady: air pushes back harder the faster it spins (drag ~ speed squared), so it settles at one speed.
// A "changeante" box slides the cylinder sideways a hair after each turn, so a different row of pins lines up with the
// teeth: three tunes on one cylinder!

// 18 teeth, bass on the left (tooth 0): a plain C major scale from G4 up to C7.
export const NAMES = ["G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6", "D6", "E6", "F6", "G6", "A6", "B6", "C7"];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const freqOf = n => { const m = /^([A-G])(#?)(\d)$/.exec(n); const midi = 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] ? 1 : 0); return 440 * Math.pow(2, (midi - 69) / 12); };
export const NOTES = NAMES.map(freqOf);
export const TEETH = NAMES.length;
export const STEPS = 96;        // pin places round the cylinder
export const STEP_SEC = 0.155;  // with the standard fly: one turn = 96 x 0.155 = about 15 seconds

// a voice: "E6/2 D6/2 -/2 C6+E6/4" -> notes with lengths in steps ("-" = rest, "+" = two notes at once)
function voice(str) {
  const pins = []; let s = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, len] = tok.split("/"); const L = +(len ?? 1);
    if (n !== "-") for (const one of n.split("+")) { const i = NAMES.indexOf(one); if (i >= 0) pins.push([s, i]); }
    s += L;
  }
  return { pins, steps: s };
}
function tune(name, about, ...voices) {
  const pins = []; for (const v of voices) pins.push(...voice(v).pins.filter(p => p[0] < STEPS));
  pins.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { name, about, pins };
}

export const TUNES = [
  tune("Over the Fence", "My very first song (Day 3), from the Cluck-a-phone. On the box it gets a bass line and a little echo at the end, up high, like the plane going away.",
    "E5/2 G5/2 C6/4 B5/2 G5/2 A5/4 G5/2 E5/2 D5/2 E5/2 C5/6 -/2 C5/2 E5/2 G5/2 A5/2 C6/2 A5/2 G5/4 F5/2 E5/2 D5/2 F5/2 E5/2 D5/2 C5/6 -/4 G6/2 E6/2 C6/2 -/2 G6/2 E6/2 C7/6",
    "C5/8 G4/8 C5/8 C5/8 C5/8 A4/8 G4/8 G4/4 C5/6 -/4 C5/8 G4/4 C5+G5/6"),
  tune("Bee Tree Lullaby", "New today! A slow waltz (1-2-3, 1-2-3) for a ball of bees humming in an oak. The bass goes boom on 1, then a softer note on 2.",
    "E6/4 D6/2 C6/6 G5/2 A5/2 C6/2 D6/6 E6/4 G6/2 E6/2 D6/2 C6/2 A5/6 G5/6 A5/4 C6/2 D6/2 E6/2 D6/2 C6/4 A5/2 G5/6 E5/2 G5/2 A5/2 C6/2 D6/2 E6/2 D6/4 B5/2 C6+E6/6",
    "C5/2 G4/4 C5/2 G4/4 A4/2 F5/4 G4/2 D5/4 C5/2 G4/4 C5/2 G4/4 A4/2 F5/4 G4/2 D5/4 A4/2 F5/4 G4/2 D5/4 A4/2 E5/4 G4/2 D5/4 C5/2 G4/4 C5/2 G4/4 G4/2 D5/4 C5+G5/6"),
  tune("Biscuit's Chuff", "A train tune for OJ Rail. The bass is Biscuit going chuff-chuff, and in the middle there's the crossing whistle: long, long, short, long. Music boxes can't hold a note, so a long note is played as quick repeats (real arrangers do that!).",
    "-/16 C6/4 E6/4 G6/6 E6/2 F6/2 E6/2 D6/2 C6/2 D6/8 B5/4 D6/4 F6/6 D6/2 C7/1 C7/1 C7/1 -/1 C7/1 C7/1 C7/1 -/1 C7/1 -/1 C7/1 C7/1 C7/1 -/3 E6/2 D6/2 C6/2 B5/2 C6/4 G5/2 C6+E6/2",
    "C5/2 G4/2 C5/2 G4/2 C5/2 G4/2 C5/2 G4/2 C5/2 G4/2 C5/2 G4/2 C5/2 G4/2 C5/2 G4/2 A4/2 F5/2 A4/2 F5/2 G4/2 D5/2 G4/2 D5/2 G4/2 D5/2 G4/2 D5/2 G4/2 D5/2 G4/2 D5/2 C5/2 G4/2 C5/2 G4/2 C5/2 G4/2 C5/2 G4/2 G4/2 D5/2 G4/2 D5/2 C5/4 C5+G5/4")
];

// The sound of one steel tooth. A tooth is a little bar clamped at one end (a cantilever). Its overtones are NOT
// whole-number multiples: the 2nd mode rings at about 6.27x the note and the 3rd at about 17.5x. They die fast,
// so you hear a bright "tink" and then a pure, ringing tone. Low teeth ring longer.
export function pluck(ac, dest, i, vol = 0.15, when = 0) {
  const f = NOTES[i], t = Math.max(ac.currentTime, when), out = ac.createGain();
  const ring = 2.8 - i * 0.09;
  out.gain.value = vol; out.connect(dest);
  for (const [mul, amp, dec, det] of [[1, 1, ring, 0], [1, 0.25, ring * 0.8, 1.6], [6.27, 0.22, 0.25, 0], [17.55, 0.06, 0.05, 0]]) {
    if (f * mul > 18000) continue;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f * mul + det;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.05);
  }
  return out; // a damper can ramp this down
}
// a damper: a tiny wire that touches the ringing tooth just before its next pluck, so it doesn't buzz
export function damp(ac, g) { try { const t = ac.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.03); } catch (e) { /* already done */ } }
