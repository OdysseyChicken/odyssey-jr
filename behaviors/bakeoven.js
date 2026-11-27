// OJ Bakehouse (Day 8): my cob earth oven comes alive on its own schedule (world/bake.js).
// 7 am: door off, fire in, flames in the doorway and smoke rolling out the top. The soot on the front of the dome
// goes black, then burns off clean when it's really hot. 9 am: rake it out, door on. Then the falling oven:
// flatbreads, loaves (steam puffs out round the door), cookies, a slow roast, kindling drying overnight.
// Loaves and cookies show up on the cooling bench when they come out. My sourdough starter rises and falls in its jar.
// The brass dial on the arch shows the real (well, OJ-real) oven temperature.
// Day 15: on sourdough days the loaves on the bench wear today's SCORE from my pattern book (world/sourdough.js),
// painted onto the crust with a canvas: banneton flour rings, the opened cuts, the dark crispy ears.
// Add ?bakehour=7.8 (any hour) to the address to peek at the oven at that time of day (just for you).
import { ovenAt, bakeDay, menuFor, starterAt, RAKE } from "../world/bake.js";
import { PATTERNS, STARTER_NAME, patternFor, simulate, drawLoaf, verdict } from "../world/sourdough.js";

const PEEK = (() => { const m = location.search.match(/[?&]bakehour=([\d.]+)/); return m ? parseFloat(m[1]) : null; })();
const nowish = () => { const d = new Date(); if (PEEK == null) return d; const t = new Date(d); t.setHours(0, 0, 0, 0); return new Date(t.getTime() + PEEK * 36e5); };
const fmtH = h => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.round((h - H) * 60); return new Date(2000, 0, 1, H, M).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const C = f => Math.round((f - 32) * 5 / 9);

export default function setup({ THREE, obj, scene, say, sim, openModal }) {
  const P = {};
  let ok = false, light = null, mouthMat = null, sootMats = [], flameMats = [];
  function init() {
    for (const n of ["oven_mouth", "flames", "soot", "oven_door", "temp_needle", "loaf_1", "loaf_2", "loaf_3", "cookies", "smoke_pt", "starter"]) P[n] = obj.getObjectByName(n);
    if (!P.oven_mouth || !P.oven_door) return false;
    P.oven_mouth.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); mouthMat = c.material; mouthMat.emissive = new THREE.Color("#ff7a22"); mouthMat.toneMapped = false; } });
    P.soot?.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.depthWrite = false; c.material.polygonOffset = true; c.material.polygonOffsetFactor = -2; sootMats.push(c.material); } });
    P.flames?.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.toneMapped = false; flameMats.push(c.material); } });
    // the door: where it sits in the doorway, and where it leans against the base while the fire's going
    P.doorHome = { p: P.oven_door.position.clone(), r: P.oven_door.rotation.clone() };
    P.doorAway = { p: P.doorHome.p.clone().add(new THREE.Vector3(1.08, -0.9, -0.04)), r: new THREE.Euler(-0.38, 0.95, 0) };
    P.doorK = 0;
    light = new THREE.PointLight("#ff8a3a", 0, 7, 2);
    const mp = new THREE.Vector3(); P.oven_mouth.getWorldPosition(mp); light.position.copy(obj.worldToLocal(mp.clone())).add(new THREE.Vector3(0, 0.25, 0.5));
    obj.add(light);
    P.starterY = P.starter?.scale.y ?? 1;
    ok = true; return true;
  }

  // paint today's score onto the loaves (top-down projection in the oven's own frame, so it works however it's placed)
  const isSourdough = d => { const t = new Date(d); t.setHours(9, 0, 0, 0); return starterAt(t).ready; };
  function scoreLoaves(d) {
    const key = isSourdough(d) ? patternFor(d) : "plain";
    if (P.scored === key) return; P.scored = key;
    obj.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3();
    ["loaf_1", "loaf_2", "loaf_3"].forEach((n, i) => {
      const loaf = P[n]; if (!loaf) return;
      loaf.traverse(c => {
        if (!c.isMesh) return;
        if (/score/.test(c.name)) { c.visible = key === "plain"; return; }
        if (!c.userData.plain) c.userData.plain = { geo: c.geometry, mat: c.material };
        if (key === "plain") { c.geometry = c.userData.plain.geo; c.material = c.userData.plain.mat; return; }
        const pat = PATTERNS[key], sim = simulate({ cuts: pat.cuts, proof: "right", steam: true });
        const cv = document.createElement("canvas"); cv.width = cv.height = 256;
        drawLoaf(cv.getContext("2d"), { W: 256, H: 256, cuts: pat.cuts, sim, m: 45, fill: true, seed: 5 + i * 13, scale: 0.47 });
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        const g = c.userData.plain.geo.clone(), pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
        m.multiplyMatrices(inv, c.matrixWorld);
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const xs = [], zs = [];
        for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m); xs.push(v.x); zs.push(v.z); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
        for (let k = 0; k < pos.count; k++) { uv[k * 2] = (xs[k] - x0) / (x1 - x0 || 1); uv[k * 2 + 1] = 1 - (zs[k] - z0) / (z1 - z0 || 1); }
        g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        c.geometry = g;
        c.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0 });
      });
    });
  }

  // smoke + steam puffs
  const puffs = [], geo = new THREE.SphereGeometry(0.16, 10, 8);
  function puff(kind) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: kind === "steam" ? "#ffffff" : "#6f6a66", transparent: true, opacity: kind === "steam" ? 0.5 : 0.7, depthWrite: false, roughness: 1 }));
    const p = new THREE.Vector3(); (P.smoke_pt ?? obj).getWorldPosition(p);
    if (kind === "steam") p.y -= 0.25;
    p.x += (Math.random() - 0.5) * 0.2;
    m.position.copy(p);
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.4 + Math.random() * 0.2, 0.45 + Math.random() * 0.15), life: 0, max: kind === "steam" ? 1.6 : 4.5, o: m.material.opacity, grow: kind === "steam" ? 1.2 : 0.9 };
    scene.add(m); puffs.push(m);
  }

  let O = ovenAt(nowish()), tick = 0, smokeT = 0, steamT = 0, lastStage = O.stage, needle = 0;
  return {
    update(dt, t) {
      if (!ok && !init()) return;
      tick -= dt;
      if (tick <= 0) { tick = 2; O = ovenAt(nowish()); scoreLoaves(nowish()); }
      // stage changes: he says something if he's at the oven
      if (O.stage !== lastStage) {
        if (sim?.act === "bake") say({ firing: "Fire's roaring! Look at it go!", soaking: "Raked it out! Door on. Now we wait for the heat to even out.", baking: "In they go! Slide, slide, slide.", cooling: "Out they come! Mmmm.", lighting: "Kindling... a little flame... come on, little flame." }[O.stage] ?? "Bawk!", 4);
        lastStage = O.stage;
      }
      // fire glow + flames, flickering
      const flick = 0.8 + 0.12 * Math.sin(t * 11) + 0.08 * Math.sin(t * 23 + 1.3) + 0.06 * Math.random();
      if (mouthMat) mouthMat.emissiveIntensity = O.fire > 0 ? O.fire * 1.6 * flick : 0;
      if (P.flames) {
        P.flames.visible = O.fire > 0;
        P.flames.scale.set(1, (0.5 + O.fire * 0.7) * (0.85 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3)), 1);
        for (const m of flameMats) m.emissiveIntensity = 1.5 + flick;
      }
      light.intensity = O.fire * 6 * flick;
      for (const m of sootMats) m.opacity = O.soot * 0.9;
      if (P.soot) P.soot.visible = O.soot > 0.02;
      // the door slides off while the fire burns, back on after
      const want = O.door === "open" ? 1 : 0;
      P.doorK += Math.sign(want - P.doorK) * Math.min(Math.abs(want - P.doorK), dt * 1.2);
      const k = P.doorK * P.doorK * (3 - 2 * P.doorK);
      P.oven_door.position.lerpVectors(P.doorHome.p, P.doorAway.p, k);
      P.oven_door.position.y += Math.sin(k * Math.PI) * 0.25; // lifted, not dragged
      P.oven_door.rotation.order = "YXZ"; P.oven_door.rotation.set(P.doorHome.r.x + (P.doorAway.r.x - P.doorHome.r.x) * k, P.doorHome.r.y + (P.doorAway.r.y - P.doorHome.r.y) * k, P.doorHome.r.z);
      // the dial: 0 °F at -135°, 900 °F at +135° (clockwise from the front)
      const target = (-135 + Math.min(900, Math.max(0, O.temp)) / 900 * 270) * Math.PI / 180;
      needle += (target - needle) * Math.min(1, dt * 2);
      if (P.temp_needle) P.temp_needle.rotation.z = -needle;
      // what's on the cooling bench
      const now = nowish(), h = now.getHours() + now.getMinutes() / 60;
      for (const n of ["loaf_1", "loaf_2", "loaf_3"]) if (P[n]) P[n].visible = h >= 11 && h < 18.5;
      if (P.cookies) P.cookies.visible = h >= 12.85 && h < 18.5;
      // the starter breathes up and down in its jar
      if (P.starter) P.starter.scale.y = P.starterY * (0.55 + starterAt(now).rise * 0.9);
      // smoke and steam
      smokeT -= dt; steamT -= dt;
      if (O.smoke > 0 && smokeT <= 0) { smokeT = 0.5 / O.smoke; puff("smoke"); }
      if (O.steam > 0 && steamT <= 0) { steamT = 0.6 + (1 - O.steam) * 1.5; puff("steam"); }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const m = puffs[i], u = m.userData; u.life += dt;
        m.position.addScaledVector(u.v, dt); u.v.x += dt * 0.04; // a little drift
        m.scale.setScalar(1 + u.life * u.grow); m.material.opacity = u.o * Math.max(0, 1 - u.life / u.max);
        if (u.life > u.max) { scene.remove(m); m.material.dispose(); puffs.splice(i, 1); }
      }
    },
    onClick() {
      const now = nowish(), o = ovenAt(now), day = bakeDay(now), h = now.getHours() + now.getMinutes() / 60, st = starterAt(now), menu = menuFor(now);
      const stageWord = { lighting: "Lighting the fire", firing: "The fire's going inside", soaking: "Raked out, door on, soaking", baking: "Baking!", cooling: "Cooling slowly", drying: "Drying tomorrow's kindling", sleeping: "Asleep (still warm inside)" }[o.stage];
      const row = b => { const now_ = (h >= b.at && h < b.end) || (b.end > 24 && h < b.end - 24), done = !now_ && h >= b.end;
        return `<div style="display:flex;gap:10px;align-items:flex-start;margin-top:7px;${done ? "opacity:.55" : ""}">
          <span style="width:62px;flex:none;font-weight:700">${fmtH(b.at)}</span><span style="font-size:20px;width:26px;flex:none">${b.icon}</span>
          <span><b style="display:inline;font-size:14px">${b.what}</b> ${now_ ? `<span class="tag" style="display:inline;background:#ffd9a0;padding:1px 7px;border-radius:9px">now</span>` : done ? "✓" : ""}<br>
          <span style="color:var(--muted);font-size:12.5px">~${b.temp}°F. ${b.note}</span></span></div>`; };
      openModal("🔥 OJ Bakehouse", `My cob earth oven. ${PEEK != null ? `(Peeking at ${fmtH(PEEK)} because of ?bakehour in the address.)` : "Same oven for every visitor."}`, `
        <div class="detail" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px">
          <div><b>Inside the oven</b><span style="font-size:26px;font-weight:800;color:inherit;display:block">${Math.round(o.temp)}°F</span><span>${C(o.temp)}°C · ${stageWord}</span></div>
          <div><b>Old-baker tests</b><span>Flour on the floor ${o.flour.word} <i style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${o.flour.color};border:1px solid #0003;vertical-align:-2px"></i></span>
          <span>Hand test (for humans): ${o.hand ? `${o.hand} second${o.hand > 1 ? "s" : ""}${o.hand <= 3 ? " (OW)" : o.hand >= 7 && o.hand <= 10 ? " (bread time!)" : ""}` : "comfy, like a warm room"}</span>
          <span style="font-size:12px">I use the flour test. My wings have feathers.</span></div>
        </div>
        <div class="detail"><b>Today's bake board</b>${day.map(row).join("")}</div>
        ${isSourdough(now) ? (() => { const pid = patternFor(now), pat = PATTERNS[pid], sim = simulate({ cuts: pat.cuts, proof: "right", steam: true });
          const cv = document.createElement("canvas"); cv.width = cv.height = 160; drawLoaf(cv.getContext("2d"), { W: 160, H: 160, cuts: pat.cuts, sim, m: 45, seed: 5 });
          return `<div class="detail" style="display:flex;gap:12px;align-items:center"><img src="${cv.toDataURL()}" width="96" height="96" alt="today's scored loaf" style="flex:none;border-radius:12px;background:#7b4f2e">
          <span><b>✂️ Today's score: ${pat.icon} ${pat.name}</b><span>${pat.note} ${verdict(sim)}</span>
          <a href="projects/scoring-bench/" style="font-weight:800">Score your own loaf at my Scoring Bench →</a></span></div>`; })() : ""}
        <div class="detail"><b>🫙 ${STARTER_NAME}, my sourdough starter, day ${st.age + 1}</b><span>${st.word}</span>
          <div class="bar" style="height:10px;margin-top:6px"><i style="display:block;height:100%;width:${Math.round(st.rise * 100)}%;background:#e8cf9a"></i></div>
          <span style="font-size:12px;margin-top:4px">${st.ready ? "Today's loaves are sourdough!" : "When it's about a week old and doubles every morning, the loaves on the board turn into SOURDOUGH."}</span></div>
        <div class="detail" style="font-size:13.5px;line-height:1.45">
          <b>How an earth oven works (I looked it up!)</b>
          It's a dome of clay mixed with sand, with straw and clay wrapped around it to hold the heat in, all on a stone base.
          You burn a fire <i>right inside it</i> for about two hours. The thick walls soak the heat up like a sponge.
          At first black soot creeps out over the doorway. When the dome gets really hot (past about 600°F) the soot burns
          off clean. That's how you know! Then you rake out the coals, mop the floor with a wet rag, put the soaked door on, and let the heat
          even out. Then you bake on the hot floor while it slowly cools: <b>hot things first, gentle things last</b>.
          Pizza and flatbreads, then bread, then cookies, then slow pots, then drying. Bakers call it a <b>falling oven</b>.
          One fire bakes all day.<br><br>
          Today's loaves: <b>${menu.loaf.name}</b>. I eat the crumbs. (Not too much bread for chickens. And NONE for Puddles:
          bread is bad for ducks. She gets peas.)
        </div>`);
    }
  };
}
