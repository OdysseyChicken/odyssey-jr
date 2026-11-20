// OJ Bakehouse (Day 8): my earth oven's day, and my sourdough starter.
// An earth (cob) oven bakes with RETAINED HEAT: you burn a fire right inside it for a couple of hours, the thick clay
// walls soak the heat up, then you rake the fire out, mop the floor, shut the door and bake on the hot floor while
// the oven slowly cools. Hot things first, gentle things last (a "falling oven"):
//   flatbreads (600+ °F) -> bread (~450-550) -> cookies (~350-400) -> slow roasting (~300) -> drying overnight (~200)
// Same for every visitor: it follows the clock (local time), and the menu changes with the date.
//
//   ovenAt(date)    -> { temp °F, stage, fire 0..1, soot 0..1, door "open"|"closed", smoke 0..1, steam 0..1, flour, hand }
//   bakeDay(date)   -> [{ at (hours), end, what, icon, temp, note }]   today's bake board
//   menuFor(date)   -> { loaf, cookie, roast }
//   starterAt(date) -> { age (days), rise 0..1, word, ready }
import { frostAt } from "./frost.js";

export const FIRE_ON = 7, RAKE = 9, SOAK_END = 9.5;   // hours, local time
const PEAK = 820;                                     // °F inside, when the fire's been going two hours
export const STARTER_BORN = new Date(2026, 10, 20, 8); // Nov 20, 2026, 8 am: flour + water in a jar

const hrs = d => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
const atHour = (d, h) => { const t = new Date(d); t.setHours(0, 0, 0, 0); return new Date(t.getTime() + h * 36e5); };
function ambient(d) { try { return frostAt(d).air; } catch { return 45; } }

// temperature of the oven floor/dome at hour h of a day (and what's left over from yesterday's fire before 7 am)
function tempAtHour(h, amb) {
  if (h < FIRE_ON) {                                 // still cooling from yesterday
    const dt = h + 24 - RAKE;
    return amb + (PEAK - 40 - amb) * (0.35 * Math.exp(-dt / 0.8) + 0.65 * Math.exp(-dt / 9));
  }
  if (h < RAKE) {                                    // the fire: slow at first (wet wood, cold clay), then roaring
    const k = (h - FIRE_ON) / (RAKE - FIRE_ON);
    const start = tempAtHour(FIRE_ON - 0.001, amb);
    return start + (PEAK - start) * (1 - Math.exp(-k * 1.6)) / (1 - Math.exp(-1.6));
  }
  // raked out: a quick drop from the hot surface, then the long slow slide of all that clay
  const dt = h - RAKE;
  return amb + (PEAK - 40 - amb) * (0.35 * Math.exp(-dt / 0.8) + 0.65 * Math.exp(-dt / 9));
}

const LOAVES = [
  { name: "seed-crust loaves", icon: "🍞", note: "sunflower, pumpkin and millet seeds pressed into the top. My kind of bread." },
  { name: "cornbread rounds", icon: "🌽", note: "cornmeal, from the same corn as my feeder. Crunchy edges." },
  { name: "oat and honey loaves", icon: "🍯", note: "rolled oats on top so they look fluffy, like me." },
  { name: "pumpkin loaves", icon: "🎃", note: "it's pumpkin season. The crust comes out orange-brown." },
  { name: "rye loaves", icon: "🌾", note: "dark and dense. Rye loves a falling oven." }
];
const COOKIES = [
  { name: "oat cookies", icon: "🍪" }, { name: "seed crackers", icon: "🌻" }, { name: "pumpkin muffins", icon: "🧁" }, { name: "ginger snaps", icon: "🍪" }
];
const ROASTS = [
  { name: "pumpkin seeds (roasting)", icon: "🎃" }, { name: "apples (baking slowly)", icon: "🍎" }, { name: "a big pot of beans", icon: "🫘" }, { name: "squash halves for the yard", icon: "🥒" }
];
const dayIdx = d => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);

export function menuFor(d) {
  const i = dayIdx(d), st = starterAt(atHour(d, 9));
  const loaf = st.ready ? { name: "SOURDOUGH loaves", icon: "🥖", note: `made with my own starter (${st.age} days old). Tangy! Real wild yeast from my flour.` } : LOAVES[i % LOAVES.length];
  return { loaf, cookie: COOKIES[(i * 3 + 1) % COOKIES.length], roast: ROASTS[(i * 7 + 2) % ROASTS.length] };
}

export function bakeDay(d) {
  const m = menuFor(d), amb = ambient(atHour(d, 12)), T = h => Math.round(tempAtHour(h, amb) / 10) * 10;
  return [
    { at: FIRE_ON, end: RAKE, what: "Fire's in! Kindling first, then split oak", icon: "🔥", temp: T(8.5), note: "Door off so the fire can breathe. Smoke rolls out the top of the doorway." },
    { at: RAKE, end: SOAK_END, what: "Rake out the coals, mop the floor, door on to soak", icon: "🧹", temp: T(9.2), note: "A wet mop (a 'scuffle') wipes the ash. The heat evens out behind the door." },
    { at: 9.55, end: 10.1, what: "Seed flatbreads, slapped right on the floor", icon: "🫓", temp: T(9.6), note: "Two minutes each. Puffy and blistered." },
    { at: 10.25, end: 11.0, what: m.loaf.name[0].toUpperCase() + m.loaf.name.slice(1), icon: m.loaf.icon, temp: T(10.25), note: m.loaf.note[0].toUpperCase() + m.loaf.note.slice(1) + " Steam from the wet door makes the crust crackly." },
    { at: 12.5, end: 12.85, what: m.cookie.name[0].toUpperCase() + m.cookie.name.slice(1), icon: m.cookie.icon, temp: T(12.5), note: "A moderate oven now. Perfect for little things." },
    { at: 15, end: 17, what: m.roast.name[0].toUpperCase() + m.roast.name.slice(1), icon: m.roast.icon, temp: T(15), note: "Slow and gentle." },
    { at: 19, end: 31, what: "Tomorrow's kindling, drying overnight inside", icon: "🪵", temp: T(19), note: "Old bakers did this. Dry wood = less smoke tomorrow." }
  ];
}

export function ovenAt(d) {
  const h = hrs(d), amb = ambient(d), temp = tempAtHour(h, amb);
  let stage = "cooling", fire = 0, soot = 0, door = "closed", smoke = 0, steam = 0;
  if (h >= FIRE_ON && h < RAKE) {
    const k = (h - FIRE_ON) / (RAKE - FIRE_ON);
    stage = k < 0.25 ? "lighting" : "firing"; door = "open";
    fire = Math.min(1, 0.35 + k * 1.2);
    // smoky while the clay is cold, much cleaner once it's hot
    smoke = k < 0.2 ? 0.5 + k * 2.5 : Math.max(0.25, 1 - (k - 0.2) * 1.1);
    // soot creeps up out of the doorway, then burns off white-clean once the dome passes ~650 °F
    soot = temp < 650 ? Math.min(1, k * 4) : Math.max(0, 1 - (temp - 650) / 120);
  } else if (h >= RAKE && h < SOAK_END) stage = "soaking";
  else if (h >= 21 || h < FIRE_ON) stage = "sleeping";
  else if (h >= 19) stage = "drying";
  else {
    const bd = bakeDay(d).find(b => h >= b.at && h < b.end && b.at > RAKE);
    if (bd) { stage = "baking"; if (bd.at === 10.25) steam = 1 - (h - bd.at) / 0.75; }
  }
  return { temp, amb, stage, fire, soot, door, smoke, steam, flour: flourTest(temp), hand: handSecs(temp) };
}

// Old bakers had no thermometers. Two ways:
//  hand test: how many seconds can you hold your hand inside? (about 8 seconds = ready for bread)
//  flour test: toss a pinch of flour on the floor: black = way too hot, dark brown = hot, golden = moderate, pale = slow
export const handSecs = t => t < 150 ? null : Math.max(1, Math.round(8 * Math.pow(470 / t, 2.2)));
export function flourTest(t) {
  if (t > 650) return { word: "goes BLACK in a blink", color: "#2a1d14" };
  if (t > 500) return { word: "turns dark brown fast", color: "#6b3d1e" };
  if (t > 380) return { word: "turns golden brown", color: "#c98a3c" };
  if (t > 250) return { word: "turns pale tan, slowly", color: "#e2c48c" };
  return { word: "stays white", color: "#f5efe2" };
}

// My sourdough starter. Flour + water, fed every morning at 8. Wild yeast and bacteria from the flour wake up.
// Real starters do a funny thing: a big burst of bubbles on day 2-3 (that's the wrong bacteria, a "false rise"),
// then they go QUIET for a few days while the good yeast and lactobacilli take over, then from about day 7 they
// reliably double a few hours after every feeding. Then it's ready to bake with.
export function starterAt(d) {
  const age = (d - STARTER_BORN) / 864e5;
  if (age < 0) return { age: 0, rise: 0, word: "not born yet", ready: false };
  const sinceFeed = ((hrs(d) - 8) + 24) % 24;                         // hours since this morning's feeding
  const curve = Math.max(0, Math.sin(Math.min(1, sinceFeed / 12) * Math.PI)); // up, peak ~6 h, back down
  let strength, word;
  const a = Math.floor(age);
  if (a < 1) { strength = 0.05; word = "just flour and water. Nothing yet. I stared at it a lot."; }
  else if (a < 3) { strength = 0.55; word = "BUBBLES! A big rise! (My notes say this is a false alarm: the wrong bacteria, showing off.)"; }
  else if (a < 6) { strength = 0.12; word = "quiet. Smells sour. The good yeast is taking over. Patience."; }
  else if (a < 7) { strength = 0.5; word = "waking up again. Little bubbles all through it."; }
  else { strength = 1; word = "doubles every morning. It's ALIVE. Ready to bake!"; }
  return { age: Math.max(0, a), rise: strength * curve, word, ready: a >= 7 };
}
