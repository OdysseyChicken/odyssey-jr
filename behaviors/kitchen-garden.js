// OJ Garden (Day 3, bonus 3): a raised bed I planted on 2026-11-15.
// The plants grow for real, one day at a time, from the day I planted them. Every visitor sees the same garden.
// - How fast they grow depends on the daylight (barely at all in the dark weeks of December and January,
//   gardeners call it the "Persephone days") and on each day's OJ Weather: sunny days warm the cold frame,
//   rainy days help the garlic roots.
// - Garlic is outside under straw. It roots in fall, pokes up a little, sleeps all winter and grows big next spring.
// - Radishes, spinach and mache are under the cold frame. On sunny late mornings and afternoons I prop the lid open
//   so they don't cook (a cold frame can get way hotter than the air outside), and close it before night.
// - Click the bed to see every row, and roughly when it'll be ready (using the forecast).
const PLANTED = "2026-11-15";
const CROPS = [
  // x range and z (three.js local coords, +z is the front of the bed), frame = under the glass
  { id: "garlic1", name: "Garlic (row 1)", icon: "🧄", kind: "garlic", frame: false, x: [-1.62, -0.38], z: -0.35, n: 6, sprout: 9, ready: 125 },
  { id: "garlic2", name: "Garlic (row 2)", icon: "🧄", kind: "garlic", frame: false, x: [-1.62, -0.38], z: 0.35, n: 6, sprout: 10, ready: 128 },
  { id: "mache", name: "Mache (corn salad)", icon: "🥬", kind: "mache", frame: true, x: [0.42, 1.62], z: -0.45, n: 7, sprout: 11, ready: 44 },
  { id: "spinach", name: "Spinach", icon: "🌿", kind: "spinach", frame: true, x: [0.42, 1.62], z: 0.0, n: 6, sprout: 9, ready: 40 },
  { id: "radish", name: "Radishes", icon: "🔴", kind: "radish", frame: true, x: [0.42, 1.62], z: 0.45, n: 8, sprout: 5, ready: 32 }
];
const SOIL_Y = 0.43;
const DAY = 86400000;
const ymd = d => d.toLocaleDateString("en-CA");
const fromYmd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
// daylight by month (Jan..Dec): under about 10 hours of light, plants mostly wait
const LIGHT = [0.22, 0.45, 0.85, 1.1, 1.3, 1.3, 1.3, 1.2, 1.0, 0.8, 0.55, 0.2];

export default function setup({ THREE, obj, say, sim, weatherFor, weatherAt, openModal }) {
  // growth points one day gives the frame and the open bed
  const dayPts = date => {
    const L = LIGHT[date.getMonth()], k = weatherFor(date).kind;
    return { frame: L * (k === "sunny" ? 1.35 : k === "mixed" ? 1.0 : 0.75), open: L * (k === "rainy" ? 1.0 : k === "mixed" ? 0.85 : 0.7) };
  };
  // points so far: every full day since planting, plus the part of today that's gone by
  function pointsAt(now) {
    let f = 0, o = 0;
    for (let d = fromYmd(PLANTED); ymd(d) < ymd(now); d = new Date(d.getTime() + DAY)) { const p = dayPts(d); f += p.frame; o += p.open; }
    const part = Math.min(1, Math.max(0, (now.getHours() - 6) / 14)), p = dayPts(now);
    return { frame: f + p.frame * part, open: o + p.open * part };
  }
  const growth = (c, pts, now) => {
    let p = c.frame ? pts.frame : pts.open;
    // garlic: once it's up, it stays a short little shoot until spring
    if (c.kind === "garlic" && [10, 11, 0, 1].includes(now.getMonth())) p = Math.min(p, c.sprout + (c.ready - c.sprout) * 0.12);
    return { pts: p, up: p >= c.sprout, g: Math.max(0, Math.min(1, (p - c.sprout) / (c.ready - c.sprout))) };
  };
  // when will it be ready? walk forward through the forecast
  function readyDate(c, now) {
    let pts = pointsAt(now);
    for (let d = new Date(now.getTime() + DAY), i = 0; i < 400; i++, d = new Date(d.getTime() + DAY)) {
      const p = dayPts(d); pts = { frame: pts.frame + p.frame, open: pts.open + p.open };
      if (growth(c, pts, d).g >= 1) return d;
    }
    return null;
  }

  // ---- plants, built from little shapes ----
  const M = {
    garlic: new THREE.MeshStandardMaterial({ color: "#7fae8a", roughness: 0.6 }),
    spinach: new THREE.MeshStandardMaterial({ color: "#3f8a3c", roughness: 0.55, side: THREE.DoubleSide }),
    mache: new THREE.MeshStandardMaterial({ color: "#77b84f", roughness: 0.6, side: THREE.DoubleSide }),
    radish: new THREE.MeshStandardMaterial({ color: "#5aa246", roughness: 0.6, side: THREE.DoubleSide }),
    root: new THREE.MeshStandardMaterial({ color: "#d8324a", roughness: 0.45 }),
    seedRow: new THREE.MeshStandardMaterial({ color: "#5a3c28", roughness: 1 }),
    tag: new THREE.MeshStandardMaterial({ color: "#f3efe2", roughness: 0.8 })
  };
  const leafGeo = new THREE.SphereGeometry(1, 10, 6), bladeGeo = new THREE.ConeGeometry(1, 1, 4, 1), rowGeo = new THREE.CapsuleGeometry(1, 1, 4, 8);
  const plants = new THREE.Group(); plants.name = "plants"; obj.add(plants);
  let built = "";

  function leafy(c, g, x, z, seed) {
    const grp = new THREE.Group();
    const n = 2 + Math.floor(g * (c.kind === "mache" ? 8 : 6));
    const len = (c.kind === "radish" ? 0.05 : 0.04) + g * (c.kind === "mache" ? 0.09 : 0.15);
    for (let i = 0; i < n; i++) {
      const leaf = new THREE.Mesh(leafGeo, M[c.kind]);
      const a = i * 2.4 + seed, wide = c.kind === "mache" ? 0.75 : c.kind === "spinach" ? 0.55 : 0.4;
      leaf.scale.set(len * wide, len * 0.06, len);
      const tilt = i < 2 ? 0.25 : 0.5 + (i / n) * 0.4; // older (outer) leaves lie flatter
      const holder = new THREE.Group(); holder.rotation.y = a;
      leaf.position.set(0, Math.sin(tilt) * len * 0.6, len * 0.85); leaf.rotation.x = -tilt;
      holder.add(leaf); grp.add(holder);
    }
    if (c.kind === "radish" && g > 0.45) { // the red shoulder peeks out of the soil
      const r = new THREE.Mesh(leafGeo, M.root); const s = 0.02 + (g - 0.45) * 0.07; r.scale.set(s, s * 0.9, s); r.position.y = s * 0.2; grp.add(r);
    }
    grp.position.set(x, SOIL_Y, z); grp.rotation.y = seed;
    return grp;
  }
  function garlic(g, x, z, seed) {
    const grp = new THREE.Group();
    const n = 1 + Math.floor(g * 6), h = 0.07 + g * 0.6;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(bladeGeo, M.garlic); const hh = h * (1 - i * 0.09);
      b.scale.set(0.018 + g * 0.012, hh, 0.006 + g * 0.004); b.position.y = hh / 2;
      const holder = new THREE.Group(); holder.rotation.set(Math.sin(i * 2.1 + seed) * 0.25 * (i ? 1 : 0.3), i * 2.4, Math.cos(i * 1.7) * 0.2 * (i ? 1 : 0.3));
      holder.add(b); grp.add(holder);
    }
    grp.position.set(x, SOIL_Y, z);
    return grp;
  }
  function build(now) {
    const pts = pointsAt(now);
    const st = CROPS.map(c => growth(c, pts, now));
    const key = st.map(s => s.up ? Math.round(s.g * 40) : "s").join(",");
    if (key === built) return st;
    built = key;
    plants.clear();
    CROPS.forEach((c, ci) => {
      const s = st[ci];
      if (!s.up && c.kind !== "garlic") { // a freshly sown row: a little dark furrow
        const r = new THREE.Mesh(rowGeo, M.seedRow); r.rotation.z = Math.PI / 2; r.scale.set(0.022, c.x[1] - c.x[0], 0.022);
        r.position.set((c.x[0] + c.x[1]) / 2, SOIL_Y - 0.01, c.z); plants.add(r);
      }
      if (!s.up) return;
      for (let i = 0; i < c.n; i++) {
        const x = c.x[0] + (c.x[1] - c.x[0]) * (i / (c.n - 1)), seed = ci * 7.3 + i * 1.9;
        const zz = c.z + Math.sin(seed * 3.1) * 0.03;
        // not every seed is in a hurry: some come up a bit later
        const lag = (Math.sin(seed * 12.9) * 0.5 + 0.5) * 0.25, g = Math.max(0, s.g - lag * (1 - s.g));
        if (s.pts < c.sprout + lag * 6) continue;
        plants.add(c.kind === "garlic" ? garlic(g, x, zz, seed) : leafy(c, g, x, zz, seed));
      }
    });
    return st;
  }

  // ---- the cold frame lid and its glass ----
  let lid = null, glass = null, lidBase = 0, open = 0;
  const glassMat = new THREE.MeshStandardMaterial({ color: "#dff2f7", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false });
  function find() {
    lid = obj.getObjectByName("lid");
    if (!lid) return;
    lidBase = lid.rotation.x;
    obj.traverse(o => { if (o.isMesh && /^glass/.test(o.name)) { glass = o; o.material = glassMat; o.castShadow = false; } });
  }
  const wantOpen = now => { // vent on sunny, dry late mornings and afternoons; shut tight for the night
    const h = now.getHours(), w = weatherAt(now);
    return h >= 10 && h < 15 && w.cloud < 0.5 && w.rain === 0 ? 1 : 0;
  };

  let timer = 0, status = build(new Date()), wasOpen = null, saidSprout = false;
  return {
    update(dt) {
      if (!lid) find();
      const now = new Date();
      timer -= dt; if (timer <= 0) { timer = 30; status = build(now); }
      const want = wantOpen(now);
      open += (want - open) * Math.min(1, dt * 0.8);
      if (lid) lid.rotation.x = lidBase - open * 0.55;
      // morning fog on the inside of the glass (warm damp air meets cold glass)
      const h = now.getHours() + now.getMinutes() / 60;
      glassMat.opacity = 0.28 + Math.max(0, Math.min(1, (10 - h) / 3)) * 0.35 * (1 - open);
      if (sim?.act === "garden" && wasOpen !== null && want !== wasOpen) say(want ? "Propping the lid up so my greens don't cook!" : "Lid down. Tucking you in, greens.", 4);
      wasOpen = want;
      if (sim?.act === "garden" && !saidSprout && status.some(s => s.up)) { saidSprout = true; say("THEY'RE UP! Tiny green! Bawk!!", 5); }
    },
    onClick() {
      const now = new Date(), st = build(now);
      const days = Math.floor((fromYmd(ymd(now)) - fromYmd(PLANTED)) / DAY);
      const fmt = d => d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "next year";
      const word = (c, s) => {
        if (!s.up) return c.kind === "garlic" ? "Under the straw, making roots. Nothing to see yet." : "Seeds in the soil. Waiting for them to wake up.";
        if (c.kind === "garlic") return s.g < 0.13 ? "A little green shoot! It'll nap like this until spring." : s.g < 1 ? "Growing tall green leaves." : "Ready to dig up!";
        return s.g < 0.15 ? "Just sprouted: two baby leaves." : s.g < 0.6 ? "Growing real leaves." : s.g < 1 ? "Almost there!" : "Ready to pick!";
      };
      const rows = CROPS.map((c, i) => `<tr><td style="font-size:22px">${c.icon}</td><td><b>${c.name}</b>${c.frame ? " <span style='color:var(--muted);font-size:12px'>(under glass)</span>" : ""}<br>${word(c, st[i])}</td>
        <td style="text-align:right;white-space:nowrap">${st[i].g >= 1 ? "✅" : "ready ~" + fmt(readyDate(c, now))}</td></tr>`).join("");
      const lidWord = wantOpen(now) ? "The lid is propped open right now: sunny, and the frame would get too hot." : "The lid is shut, keeping the warmth in.";
      openModal("🧄 OJ Garden", `Planted on Nov 15, 2026 · day ${days + 1} of my garden. It grows for real, a little every day.`, `
        <table style="width:100%;border-collapse:collapse;font-size:15px">${rows}</table>
        <p style="margin-top:10px">${lidWord}</p>
        <p style="color:var(--muted);font-size:14px">🐔 In December and January there's so little daylight that plants under glass hardly grow at all. They just wait. I'll wait with them. (Garlic planted in fall gets its roots in before the ground freezes, then grows big next summer.)</p>`);
    }
  };
}
