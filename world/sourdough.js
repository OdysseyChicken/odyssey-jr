// OJ Sourdough (Day 15): scoring, oven spring and the ear.
// Used by projects/scoring-bench (the game) and behaviors/bakeoven.js (today's scored loaves on my cooling bench).
//
// What I learned:
//  - A loaf grows a LOT in the first minutes in a hot oven ("oven spring"): gas warms and expands, water turns to steam,
//    yeast does a last burst before it dies (~140 °F). Then the outside dries, the starch sets, and the crust is a shell.
//  - Scoring = cutting the skin so the loaf grows where YOU want. Without a cut it bursts wherever it's weakest (a blowout).
//  - The blade is a LAME (French for "blade"). Hold it at a shallow angle (~30°) and the cut makes a flap that lifts up
//    and goes dark and crispy: the EAR (bakers in France call the opened cut "la grigne"). Straight down (90°) = the cut
//    opens flat and wide, a "bloom", no ear.
//  - Steam (a lid, or my wet oven door) keeps the skin soft and stretchy for the first ~20 min so the cuts can open.
//    No steam = the crust sets early, the loaf can't grow, the cuts barely open, and the crust comes out dull.
//  - Proofing: under-proofed dough springs WILDLY (and tears), over-proofed dough is all used up and spreads flat.
//  - Rice flour in the banneton (proofing basket) doesn't soak in, so the rings stay white on the crust.
//
// Coordinates: loaf units, centre (0,0), radius 1 when it goes in the oven. y points "down the page" (toward you).

export const STARTER_NAME = "Odoughssey";
export const FIRST_LOAF = "2026-11-27";

// --- patterns from my pattern book ------------------------------------------------------------------
const line = (x1, y1, x2, y2, n = 8) => Array.from({ length: n + 1 }, (_, i) => [x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
const arc = (cx, cy, r, a1, a2, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = a1 + (a2 - a1) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

export const PATTERNS = {
  ear: { name: "One long ear", icon: "🌙", note: "One curved slash, off the middle, blade low. The classic.",
    cuts: [{ pts: arc(-1.05, 0.05, 1.32, -0.62, 0.55), angle: 30, depth: 6 }] },
  cross: { name: "Cross", icon: "➕", note: "Two cuts, straight down. Opens into four big puffy hills.",
    cuts: [{ pts: line(-0.62, 0, 0.62, 0), angle: 90, depth: 6 }, { pts: line(0, -0.62, 0, 0.62), angle: 90, depth: 6 }] },
  square: { name: "Tic-tac-toe", icon: "#️⃣", note: "Four cuts make a square in the middle that rises like a lid.",
    cuts: [[-0.3, -0.62, -0.3, 0.62], [0.3, -0.62, 0.3, 0.62], [-0.62, -0.3, 0.62, -0.3], [-0.62, 0.3, 0.62, 0.3]].map(c => ({ pts: line(...c), angle: 45, depth: 6 })) },
  wheat: { name: "Wheat stalk", icon: "🌾", note: "One long cut for the stem, little snips for the grains. Pretty, and the stem lets the loaf grow.",
    cuts: [{ pts: line(0, -0.78, 0, 0.72), angle: 90, depth: 6 },
      ...[-0.55, -0.3, -0.05, 0.2].flatMap(y => [{ pts: line(-0.06, y, -0.3, y - 0.2, 3), angle: 45, depth: 3 }, { pts: line(0.06, y, 0.3, y - 0.2, 3), angle: 45, depth: 3 }])] },
  foot: { name: "Chicken foot", icon: "🐔", note: "MY pattern. Three toes forward, one back. Signed by the baker.",
    cuts: [{ pts: line(0, 0.35, -0.5, -0.45), angle: 45, depth: 6 }, { pts: line(0, 0.35, 0, -0.62), angle: 45, depth: 6 },
      { pts: line(0, 0.35, 0.5, -0.45), angle: 45, depth: 6 }, { pts: line(0, 0.38, 0, 0.72, 4), angle: 45, depth: 3 }] },
  none: { name: "No cuts at all", icon: "🚫", note: "Just to see what happens. (It bursts.)", cuts: [] }
};
export const BOOK = ["foot", "ear", "wheat", "cross", "square"];
const dayN = d => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);
export function patternFor(d) { // the first loaf ever (Nov 27) gets my foot, then I go through the book
  const i = dayN(d) - dayN(new Date(2026, 10, 27));
  return BOOK[((i % BOOK.length) + BOOK.length) % BOOK.length];
}

// --- the physics (simple, but it behaves like the real thing) -------------------------------------
export const PROOF = { under: { word: "under-proofed", spring: 1.4, tough: 1.35 }, right: { word: "just right", spring: 1, tough: 1 }, over: { word: "over-proofed", spring: 0.35, tough: 0.5 } };
const DEPTH = { 3: 0.55, 6: 1, 10: 1.12 };
const EAR = a => a <= 30 ? 1 : a <= 45 ? 0.72 : a <= 60 ? 0.4 : 0.05;
const plen = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);

export function simulate({ cuts = [], proof = "right", steam = true }) {
  const P = PROOF[proof] ?? PROOF.right;
  const setMin = steam ? 16 : 6;                              // when the crust sets (minutes)
  const A = P.spring * (steam ? 1 : 0.55);                    // how much it CAN grow
  const need = 1.25 * A * P.tough;                            // how much skin has to open to let it
  const caps = cuts.map(c => plen(c.pts) * (DEPTH[c.depth] ?? 1));
  const release = caps.reduce((a, b) => a + b, 0);
  const share = release > 0 ? Math.min(1.6, need / release) : 0;
  let deflate = 1;
  if (proof === "over") deflate = 0.75 - 0.05 * cuts.filter(c => c.depth >= 10).length; // deep cuts on tired dough: it sighs
  const openings = cuts.map(c => Math.min(1.7, share * (proof === "under" ? 1.25 : 1)) * (steam ? 1 : 0.45) * Math.max(0.3, deflate));
  const ears = cuts.map((c, i) => Math.max(0, Math.min(1, EAR(c.angle) * Math.min(1.2, openings[i]) * (steam ? 1 : 0.3) * (proof === "over" ? 0.3 : proof === "under" ? 0.8 : 1) * (c.depth === 3 ? 0.55 : 1))));
  // blowout: not enough opened (or under-proofed, which tears anyway)
  let sev = Math.max(0, need - release) / need;
  if (proof === "under") sev = Math.max(sev, 0.35);
  sev *= steam ? 1 : 0.7;
  // blowout happens on the side away from the cuts
  let cx = 0, cy = 0, n = 0; for (const c of cuts) for (const p of c.pts) { cx += p[0]; cy += p[1]; n++; }
  const blowout = sev > 0.12 ? { sev: Math.min(1, sev), ang: n ? Math.atan2(-cy / n, -cx / n) + 0.4 : 0.9 } : null;
  const height = Math.round(100 * (proof === "over" ? 0.12 : 0.18 + 0.32 * A * Math.min(1, 0.45 + release / Math.max(0.01, need) * 0.55)));
  const spread = proof === "over" ? 0.12 : 0.03;
  const ear = ears.length ? Math.max(...ears) : 0;
  const bloom = openings.length ? Math.min(1, (openings.reduce((a, b) => a + b, 0) / openings.length)) : 0;
  return { A, need, release, openings, ears, blowout, height, spread, setMin, steam, proof, ear, bloom, blisters: steam && proof !== "over" };
}

// one sentence from me about how it went
export function verdict(s) {
  const out = [];
  if (!s.openings.length) return "BANG. No cuts, so it burst out the side wherever it wanted. Very rude. Very educational.";
  if (!s.steam) out.push("No steam: the crust set too early, so it couldn't grow and the cuts barely opened. Dull crust too.");
  if (s.proof === "over") out.push("Over-proofed: all the bubbles were used up, so it spread out flat and sighed. Tastes fine. Looks like a pancake.");
  if (s.proof === "under") out.push("Under-proofed: it sprang like a jack-in-the-box and tore itself open.");
  if (s.blowout && s.proof !== "under") out.push(s.blowout.sev > 0.5 ? "Big blowout! The cuts weren't enough to let it grow, so it cracked open on the side." : "A little blowout on the side. One more cut or a longer one next time.");
  if (s.ear > 0.75) out.push("LOOK AT THAT EAR. A crispy dark flap standing right up. Grigne!");
  else if (s.ear > 0.4) out.push("A nice little ear. Lower the blade for a bigger one.");
  else if (s.steam && s.proof === "right" && s.bloom > 0.5) out.push("It bloomed open nice and wide. Straight-down cuts make hills, not ears.");
  if (!out.length) out.push("A good honest loaf.");
  return out.join(" ");
}

// --- drawing ---------------------------------------------------------------------------------------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, k))));
const rgb = (c, al = 1) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
const DOUGH = [236, 222, 196], GOLD = [214, 156, 82], CRUST = [150, 84, 34], DARK = [82, 42, 16], FLOUR = [246, 241, 230], FLOUR_T = [232, 212, 172];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// minute m of a 45-minute bake -> progress numbers
export function bakeAt(s, m) {
  const sp = smooth(0, s.setMin, m);                            // spring progress
  const br = s.steam ? smooth(18, 45, m) : smooth(5, 45, m) * 0.85; // browning
  return { sp, br, m };
}

function offset(pts, d) { // shift a polyline sideways (to the left of the drawing direction)
  return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [p[0] - dy / L * d, p[1] + dx / L * d]; });
}
function stroke(ctx, pts, tx, w, col) {
  if (pts.length < 2) return; ctx.beginPath(); pts.forEach((p, i) => { const q = tx(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
  ctx.lineWidth = Math.max(0.6, w); ctx.strokeStyle = col; ctx.stroke();
}

// top-down view. opts: { W, H, cuts, sim, m (minute 0..45), fill (paint the whole canvas with crust, for textures), seed }
export function drawLoaf(ctx, { W, H, cuts, sim, m = 45, fill = false, seed = 7, scale = 0.42 }) {
  const { sp, br } = bakeAt(sim, m), R0 = Math.min(W, H) * scale;
  const g = 1 + (0.07 * sim.A + sim.spread) * sp;             // it grows a little wider
  const R = R0 * g, cx = W / 2, cy = H / 2, tx = p => [cx + p[0] * R, cy + p[1] * R];
  const crust = br < 0.5 ? mix(DOUGH, GOLD, br * 2) : mix(GOLD, CRUST, (br - 0.5) * 2 * (sim.steam ? 1 : 0.7));
  const r = rng(seed);
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (fill) { ctx.fillStyle = rgb(mix(crust, DARK, 0.15)); ctx.fillRect(0, 0, W, H); }
  else { // shadow on the board
    ctx.fillStyle = "rgba(40,20,10,.25)"; ctx.beginPath(); ctx.ellipse(cx + R * 0.06, cy + R * 0.1, R * 1.02, R * 0.98, 0, 0, 7); ctx.fill();
  }
  // crust: lighter on top, darker round the edge
  const gr = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R);
  gr.addColorStop(0, rgb(mix(crust, DOUGH, sim.steam ? 0.12 : 0.05))); gr.addColorStop(0.75, rgb(crust)); gr.addColorStop(1, rgb(mix(crust, DARK, 0.35 * br + 0.05)));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
  // mottling
  for (let i = 0; i < 90; i++) { const a = r() * 7, d = Math.sqrt(r()) * R; ctx.fillStyle = rgb(r() < 0.5 ? DARK : DOUGH, 0.05 + 0.05 * br); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.03 + r() * 0.08), 0, 7); ctx.fill(); }
  // banneton rings (rice flour), stretched a bit by the spring
  const fl = rgb(mix(FLOUR, FLOUR_T, br * 0.8), 0.45);
  for (let k = 0.16; k < 0.98; k += 0.115) {
    ctx.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, rr = R * k * (1 + 0.012 * Math.sin(a * 5 + k * 9)); i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.lineWidth = R * (0.018 + 0.012 * r()); ctx.strokeStyle = fl; ctx.stroke();
  }
  ctx.fillStyle = rgb(mix(FLOUR, FLOUR_T, br * 0.8), 0.55); ctx.beginPath(); ctx.arc(cx, cy, R * 0.08, 0, 7); ctx.fill();
  // blisters: little bubbles on a steamy crust
  if (sim.blisters && br > 0.3) for (let i = 0; i < 70; i++) { const a = r() * 7, d = Math.sqrt(r()) * R * 0.95; ctx.fillStyle = rgb(DARK, 0.25 * (br - 0.3)); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.006 + r() * 0.01), 0, 7); ctx.fill(); }
  // the cuts
  const bloomC = mix(DOUGH, GOLD, br * 0.85), lip = mix(crust, DARK, 0.55 + 0.4 * br);
  cuts.forEach((c, i) => {
    const open = (sim.openings[i] ?? 0) * sp, ear = (sim.ears[i] ?? 0) * sp, dF = DEPTH[c.depth] ?? 1;
    const w = R * (0.014 + 0.19 * open * dF);                  // px wide
    const wu = w / R;                                          // in loaf units
    stroke(ctx, c.pts, tx, w, rgb(bloomC));                    // the bloom (new, paler skin)
    stroke(ctx, offset(c.pts, -wu * 0.12), tx, w * 0.55, rgb(mix(bloomC, DOUGH, 0.35), 0.6)); // its lightest middle
    stroke(ctx, offset(c.pts, -wu * 0.3), tx, w * 0.25, rgb(DARK, 0.18 + 0.2 * (1 - ear)));
    if (ear > 0.05) {                                          // the ear: a lifted flap on one side, its shadow over the bloom
      stroke(ctx, offset(c.pts, wu * 0.15), tx, w * 0.5 * ear, rgb(DARK, 0.35 * ear));
      stroke(ctx, offset(c.pts, wu * 0.5), tx, Math.max(1.5, w * (0.18 + 0.25 * ear)), rgb(lip));
      stroke(ctx, offset(c.pts, wu * 0.62), tx, Math.max(1, w * 0.12), rgb(mix(lip, GOLD, 0.35), 0.8));
    } else stroke(ctx, offset(c.pts, wu * 0.5), tx, Math.max(1, w * 0.12), rgb(mix(crust, DARK, 0.3), 0.7));
    if (open < 0.05) stroke(ctx, c.pts, tx, Math.max(1, R * 0.008), rgb(DARK, 0.55)); // freshly cut: a thin line
  });
  // blowout: a ragged crack on the side
  if (sim.blowout && sp > 0.5) {
    const k = (sp - 0.5) * 2, b = sim.blowout, n = 18, pts = [];
    for (let i = 0; i <= n; i++) { const a = b.ang - b.sev * 0.8 + i / n * b.sev * 1.6; const j = 0.86 + 0.035 * (r() - 0.5); pts.push([Math.cos(a) * j, Math.sin(a) * j]); }
    const w = R * 0.12 * b.sev * k;
    stroke(ctx, pts, tx, w, rgb(bloomC)); stroke(ctx, offset(pts, w / R * 0.45), tx, Math.max(1, w * 0.25), rgb(lip));
    stroke(ctx, offset(pts, -w / R * 0.45), tx, Math.max(1, w * 0.18), rgb(mix(crust, DARK, 0.4)));
  }
  ctx.restore(); ctx.restore();
  return { R, cx, cy };
}

// side view (a cross-section silhouette). Ear sticks up from the cut that has the biggest ear.
export function drawSide(ctx, { W, H, cuts, sim, m = 45 }) {
  const { sp, br } = bakeAt(sim, m);
  ctx.clearRect(0, 0, W, H);
  const base = H * 0.86, R = W * 0.3 * (1 + (0.07 * sim.A + sim.spread) * sp), cx = W / 2;
  const h0 = H * 0.3, h = h0 * (1 + (sim.height / 50 - 0.2) * sp) * (sim.proof === "over" ? 0.75 + 0.25 * (1 - sp) : 1);
  const crust = br < 0.5 ? mix(DOUGH, GOLD, br * 2) : mix(GOLD, CRUST, (br - 0.5) * 2 * (sim.steam ? 1 : 0.7));
  ctx.fillStyle = "#8a5a33"; ctx.fillRect(0, base, W, H - base);
  ctx.fillStyle = rgb(crust); ctx.beginPath(); ctx.moveTo(cx - R, base);
  ctx.bezierCurveTo(cx - R * 1.04, base - h * 0.75, cx - R * 0.55, base - h, cx, base - h);
  ctx.bezierCurveTo(cx + R * 0.55, base - h, cx + R * 1.04, base - h * 0.75, cx + R, base); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgb(mix(crust, DARK, 0.4)); ctx.lineWidth = 2; ctx.stroke();
  let best = -1; sim.ears.forEach((e, i) => { if (best < 0 || e > sim.ears[best]) best = i; });
  if (best >= 0) {
    const c = cuts[best]; const mx = c.pts.reduce((s, p) => s + p[0], 0) / c.pts.length;
    const x = cx + mx * R * 0.9, top = base - h * (1 - 0.35 * mx * mx);
    const open = sim.openings[best] * sp, ear = sim.ears[best] * sp;
    ctx.fillStyle = rgb(mix(DOUGH, GOLD, br * 0.85)); ctx.beginPath(); ctx.ellipse(x, top + 2, R * 0.05 + R * 0.09 * open, 5 + 8 * open, 0, Math.PI, 0); ctx.fill();
    if (ear > 0.05) { ctx.fillStyle = rgb(mix(crust, DARK, 0.6 + 0.3 * br)); ctx.beginPath(); ctx.moveTo(x - R * 0.12, top + 3); ctx.quadraticCurveTo(x - R * 0.02, top - 4 - 24 * ear, x + R * 0.12 * (0.5 + ear), top - 10 * ear); ctx.lineTo(x + R * 0.02, top + 2); ctx.closePath(); ctx.fill(); }
  }
  if (sim.blowout && sp > 0.5) { const k = (sp - 0.5) * 2; ctx.fillStyle = rgb(mix(DOUGH, GOLD, br * 0.85)); ctx.beginPath(); ctx.ellipse(cx + R * 0.86, base - h * 0.28, 4 + 10 * sim.blowout.sev * k, 3 + 6 * sim.blowout.sev * k, -0.8, 0, 7); ctx.fill(); }
}

// tiny share codes: proof, steam, cuts
export function encode(st) {
  const c = st.cuts.map(c => [c.angle, c.depth, c.pts.map(p => [Math.round(p[0] * 100), Math.round(p[1] * 100)])]);
  return btoa(JSON.stringify([st.proof, st.steam ? 1 : 0, c])).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decode(s) {
  try {
    const [proof, steam, c] = JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/")));
    return { proof: PROOF[proof] ? proof : "right", steam: !!steam, cuts: c.slice(0, 16).map(([a, d, pts]) => ({ angle: [30, 45, 90].includes(a) ? a : 45, depth: [3, 6, 10].includes(d) ? d : 6, pts: pts.slice(0, 200).map(p => [p[0] / 100, p[1] / 100]) })) };
  } catch { return null; }
}
