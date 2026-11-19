// OJ Frost (Day 7): my frost post, and the frost itself.
// - The Six's max-min thermometer on the post shows the real (well, OJ-real) air temperature from world/frost.js,
//   and its two little blue markers stay at the warmest and coldest point since 9 am.
// - The grass thermometer lying on its forks shows how cold the GRASS is (colder than the air on clear nights).
// - On frosty mornings the whole yard turns white and sparkly. The sun melts it, but in the shadows of my oak, my coop,
//   the hangar and the pines it hangs on longer ("frost shadows"). Wherever I walk, I leave three-toed footprints.
// - When it's cold you can see my breath. Bawk = little cloud.
// - Add ?frost to the address to see a frosty morning any time (just for you, not the real yard).
import { frostAt, frostNights, FREEZE } from "../world/frost.js";
import { sunPos, altAz } from "../world/sky.js";

const FORCE = /[?&]frost\b/.test(location.search);
const N = 768;                 // frost canvas pixels
const fmtT = t => `${Math.round(t)}°F`;
const toC = t => `${Math.round((t - 32) * 5 / 9)}°C`;

export default function setup({ THREE, obj, scene, say, chicken, objects, world, openModal, chickenInfo, sim }) {
  const R = (world.ground?.size ?? 40) / 2 + 4;
  const px = x => (x + R) / (2 * R) * N;

  // ---------- the frost layer over the grass ----------
  const cv = document.createElement("canvas"); cv.width = cv.height = N;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0.05,
    emissive: new THREE.Color("#9fc2ea"), emissiveIntensity: 0.12, polygonOffset: true, polygonOffsetFactor: -2 });
  const layer = new THREE.Mesh(new THREE.CircleGeometry(R, 96), mat);
  layer.rotation.x = -Math.PI / 2; layer.position.y = 0.025; layer.receiveShadow = true; layer.renderOrder = 1;
  scene.add(layer);

  // crystal noise: lumpy patches (big) + crystals (tiny), so it melts in patches instead of fading all at once
  const noise = new Float32Array(N * N);
  { const lat = (s, seed) => { const a = new Float32Array((s + 1) * (s + 1)); let h = seed; for (let i = 0; i < a.length; i++) { h = (h * 1103515245 + 12345) & 0x7fffffff; a[i] = h / 0x7fffffff; } return a; };
    const oct = [[6, 0.45, 7], [18, 0.3, 11], [60, 0.15, 13], [200, 0.1, 17]].map(([s, w, seed]) => ({ s, w, a: lat(s, seed) }));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0;
      for (const o of oct) { const fx = x / N * o.s, fy = y / N * o.s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, W = o.s + 1;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = o.a[iy * W + ix], b = o.a[iy * W + ix + 1], c = o.a[(iy + 1) * W + ix], d = o.a[(iy + 1) * W + ix + 1];
        v += o.w * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy); }
      noise[y * N + x] = v;
    } }

  // where the frost can't be: water. Where it lasts: the shade.
  const SD = N / 2, shadeCv = document.createElement("canvas"); shadeCv.width = shadeCv.height = SD;
  const sg = shadeCv.getContext("2d");
  let boxes = [];
  const box3 = new THREE.Box3();
  function measure() {
    boxes = [];
    for (const [id, o] of Object.entries(objects)) {
      if (Math.abs(o.position.x) > R || Math.abs(o.position.z) > R || id === "oj-frost") continue;
      box3.setFromObject(o); if (box3.isEmpty()) continue;
      const h = box3.max.y, w = box3.max.x - box3.min.x, d = box3.max.z - box3.min.z;
      if (h < 0.7 && !/pond/.test(id)) continue;
      boxes.push({ id, x: (box3.min.x + box3.max.x) / 2, z: (box3.min.z + box3.max.z) / 2, w, d, h, water: /^pond$/.test(id) });
    }
  }
  function drawShade(now) {
    const S = SD, k = S / (2 * R);
    sg.clearRect(0, 0, S, S);
    const s = sunPos(now), aa = altAz(s.ra, s.dec, now);
    if (aa.alt <= 1) return aa;
    // same sun angle the yard's real shadows use (the engine keeps the sun at least 22° up so shadows don't get silly)
    const len = Math.min(26, 1 / Math.tan(Math.max(22, aa.alt) * Math.PI / 180));
    const dx = -Math.sin(aa.az * Math.PI / 180), dz = Math.cos(aa.az * Math.PI / 180); // shadows point away from the sun (yard north = -z)
    sg.lineCap = "round";
    // soft edges: draw each shadow a few times, wide and faint to narrow and solid
    for (const [grow, al] of [[1.5, 0.25], [1.2, 0.35], [1, 0.6], [0.75, 1]]) {
      sg.strokeStyle = `rgba(0,0,0,${al})`;
      for (const b of boxes) {
        if (b.water) continue;
        const r = Math.min(b.w, b.d) * 0.42, L = b.h * len * (0.9 + grow * 0.1);
        sg.lineWidth = Math.max(2, r * 2 * k * grow);
        sg.beginPath(); sg.moveTo((b.x + R) * k, (b.z + R) * k); sg.lineTo((b.x + dx * L + R) * k, (b.z + dz * L + R) * k); sg.stroke();
      }
    }
    return aa;
  }

  // footprints: three toes forward, one back
  const prints = []; let lastPrint = null, side = 1;
  function stamp(p) {
    const s = 0.3 / (2 * R) * N, x = px(p.x), y = px(p.z);
    g.save(); g.translate(x, y); g.rotate(-p.a); g.globalCompositeOperation = "destination-out";
    g.lineWidth = Math.max(1.6, s * 0.28); g.lineCap = "round"; g.strokeStyle = "rgba(0,0,0,0.85)";
    g.beginPath();
    for (const t of [-0.55, 0, 0.55]) { g.moveTo(0, 0); g.lineTo(Math.sin(t) * s, Math.cos(t) * s * 1.1); }
    g.moveTo(0, 0); g.lineTo(0, -s * 0.5);
    g.stroke(); g.restore();
  }

  let img = g.createImageData(N, N), drawn = -1;
  function paint(F) {
    const S = SD, sd = sg.getImageData(0, 0, S, S).data, a = img.data;
    const cov = F.cover, sh = Math.max(F.cover, F.shade);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, shadeK = sd[((y >> 1) * S + (x >> 1)) * 4 + 3] / 255;
      const c = cov + (sh - cov) * shadeK, n = noise[i];
      // grows from the crystals: the tips of the grass go white first, then the whole patch
      let al = Math.min(1, Math.max(0, (c * 1.25 - n + 0.18) / 0.22));
      const dxw = x - N / 2, dyw = y - N / 2; if (dxw * dxw + dyw * dyw > (N / 2 - 3) ** 2) al = 0;
      const grain = (n * 9973) % 1, sparkle = grain > 0.985 ? 1 : 0;
      // feathery: lots of tiny gaps where the green grass shows through, thicker where the patch is old
      const thin = grain < 0.35 ? 0.45 : 1;
      a[i * 4] = 226 + sparkle * 29; a[i * 4 + 1] = 238 + sparkle * 17; a[i * 4 + 2] = 252;
      a[i * 4 + 3] = Math.min(255, al * thin * (130 + n * 90 + sparkle * 120));
    }
    g.putImageData(img, 0, 0);
    // no frost on the pond
    g.save(); g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000";
    for (const b of boxes) if (b.water) { g.beginPath(); g.ellipse(px(b.x), px(b.z), b.w / 2 / (2 * R) * N * 0.8, b.d / 2 / (2 * R) * N * 0.8, 0, 0, 7); g.fill(); }
    g.restore();
    for (const p of prints) stamp(p);
    tex.needsUpdate = true;
  }

  // ---------- breath clouds ----------
  const puffs = [], puffMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false });
  const puffGeo = new THREE.SphereGeometry(0.09, 10, 8);
  let puffT = 1.5;
  function puff() {
    const m = new THREE.Mesh(puffGeo, puffMat.clone());
    m.position.copy(chicken.localToWorld(new THREE.Vector3(0, 1.38, 0.95)));
    m.userData = { v: chicken.localToWorld(new THREE.Vector3(0, 1.45, 1.4)).sub(m.position).multiplyScalar(0.7), life: 0 };
    scene.add(m); puffs.push(m);
  }

  // ---------- the thermometers ----------
  const P = {};
  let lamp = null;
  const findParts = () => {
    for (const n of ["max_col", "min_col", "max_mark", "min_mark", "grass_col"]) { const o = obj.getObjectByName(n); if (o) P[n] = { o, y: o.position.y }; }
    const l = obj.getObjectByName("frost_lamp");
    if (l && !lamp) l.traverse(c => { if (c.isMesh && !lamp) { c.material = c.material.clone(); lamp = c.material; lamp.emissive = new THREE.Color(0.55, 0.8, 1); lamp.toneMapped = false; } });
  };
  const frac = t => Math.min(1, Math.max(0.015, t / 100));       // 0..100 °F on the board
  const show = { air: null, grass: null };

  let F = frostAt(new Date()), tick = 0, shadeTick = 0, said = false;
  const force = f => FORCE ? { ...f, cover: Math.max(f.cover, f.alt > 0 ? Math.max(0.15, 1 - f.alt / 30) : 1), shade: 1, air: Math.min(f.air, 30), grass: Math.min(f.grass, 26), min: Math.min(f.min, 27) } : f;
  F = force(F);

  return {
    update(dt) {
      const now = new Date();
      if (!P.max_col) findParts();
      tick -= dt; shadeTick -= dt;
      if (tick <= 0) { tick = 20; F = force(frostAt(now)); }
      if (shadeTick <= 0) {
        shadeTick = 30; measure(); drawShade(now);
        layer.visible = F.cover > 0.01 || F.shade > 0.01 || FORCE;
        const key = Math.round(F.cover * 200) + "/" + Math.round(F.shade * 200) + "/" + (F.alt > 0 ? Math.floor(now.getMinutes() / 5) : "");
        if (layer.visible && key !== drawn) { drawn = key; paint(F); }
        if (!layer.visible && prints.length) prints.length = 0;
      }
      // the mercury creeps (it doesn't jump)
      show.air = show.air == null ? F.air : show.air + (F.air - show.air) * Math.min(1, dt * 0.5);
      show.grass = show.grass == null ? F.grass : show.grass + (F.grass - show.grass) * Math.min(1, dt * 0.5);
      if (P.max_col) {
        P.max_col.o.scale.y = frac(show.air);                 // right arm: up = warmer
        P.min_col.o.scale.y = 1 - frac(show.air) + 0.015;     // left arm is upside down: up = colder
        P.max_mark.o.position.y = P.max_mark.y + frac(Math.max(F.max, show.air)) * 1.0;
        P.min_mark.o.position.y = P.min_mark.y + (1 - frac(Math.min(F.min, show.air))) * 1.0;
      }
      if (P.grass_col) P.grass_col.o.scale.x = Math.min(1, Math.max(0.03, (show.grass + 10) / 100));
      if (lamp) { lamp.emissiveIntensity = (F.cover > 0.05 || F.shade > 0.2 || F.grass <= FREEZE) ? 1.6 + Math.sin(now.getTime() / 600) * 0.4 : 0; }

      // footprints in the frost
      const info = chickenInfo?.();
      if (layer.visible && info?.room === "outside" && !info.up && chicken.position.y < 0.2) {
        const p = chicken.position;
        if (!lastPrint || Math.hypot(p.x - lastPrint.x, p.z - lastPrint.z) > 0.34) {
          if (lastPrint) {
            const a = Math.atan2(p.x - lastPrint.x, p.z - lastPrint.z); side = -side;
            const q = { x: p.x + Math.cos(a) * 0.13 * side, z: p.z - Math.sin(a) * 0.13 * side, a };
            prints.push(q); if (prints.length > 700) prints.shift(); stamp(q); tex.needsUpdate = true;
          }
          lastPrint = { x: p.x, z: p.z };
        }
      } else lastPrint = null;

      // breath: below about 40 °F, a little cloud with each breath
      if (show.air < 40 && info?.room === "outside" && sim?.act !== "sleep") {
        puffT -= dt; if (puffT <= 0) { puffT = 2.2 + Math.random() * 1.2; puff(); }
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const m = puffs[i], u = m.userData; u.life += dt;
        m.position.addScaledVector(u.v, dt); u.v.y += dt * 0.15; m.scale.setScalar(1 + u.life * 3.5); m.material.opacity = Math.max(0, 0.5 - u.life * 0.4);
        if (u.life > 1.25) { scene.remove(m); m.material.dispose(); puffs.splice(i, 1); }
      }
      if (!said && sim?.act === "frost" && F.cover > 0.2) { said = true; say("FROST! The whole yard is sugar-coated!", 5); }
    },
    onClick() {
      const now = new Date(), f = force(frostAt(now)), nights = frostNights(now, 3);
      const day = d => { const t = new Date(now); t.setHours(0, 0, 0, 0); const e = new Date(d); e.setHours(0, 0, 0, 0); const k = Math.round((e - t) / 864e5); return k === -1 ? "Last night" : k === 0 ? "Tonight" : k === 1 ? "Tomorrow night" : e.toLocaleDateString("en-US", { weekday: "long" }) + " night"; };
      const bar = v => `<div class="bar" style="height:10px"><i style="display:block;height:100%;width:${Math.round(v * 100)}%;background:#9fc2ea"></i></div>`;
      const icon = v => v > 0.6 ? "❄️❄️❄️" : v > 0.25 ? "❄️❄️" : v > 0.03 ? "❄️" : "🌱";
      openModal("❄️ OJ Frost", `My frost post. ${FORCE ? "(Pretend frosty morning, because of ?frost in the address.)" : "Same cold for every visitor."}`, `
        <div class="detail" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px">
          <div><b>Air</b> (on the post)<br><span style="font-size:24px;font-weight:800">${fmtT(f.air)}</span> <span style="color:var(--muted)">${toC(f.air)}</span></div>
          <div><b>Grass</b> (lying on the ground)<br><span style="font-size:24px;font-weight:800">${fmtT(f.grass)}</span> <span style="color:var(--muted)">${toC(f.grass)}</span></div>
          <div><b>Dew point</b><br>${fmtT(f.dew)}</div>
          <div><b>Since 9 am</b><br>max ${fmtT(f.max)} · min ${fmtT(f.min)}</div>
        </div>
        <div class="detail"><b>Right now: ${f.word}.</b> ${bar(Math.max(f.cover, f.shade * 0.5))}
          <div style="margin-top:6px;color:var(--muted);font-size:13px">${f.cover > 0.03 ? "Walk on it with me! My footprints stay where I step." : f.shade > 0.1 ? "The sun melted it, but it's hiding in the shadows of my oak and my buildings." : f.grass <= FREEZE + 3 && f.alt < 0 ? "The grass is getting close to freezing. Clear sky + no wind = frost by morning." : "Too warm, too cloudy or too windy for frost right now."}</div></div>
        <div class="detail"><b>Frost forecast</b>${nights.map(n => `<div style="display:flex;gap:10px;align-items:center;margin-top:6px"><span style="width:118px">${day(n.night)}</span><span style="width:70px">${icon(n.frost)}</span><span>low ${fmtT(n.low)} · grass ${fmtT(n.grassLow)} · <b>${n.word}</b></span></div>`).join("")}</div>
        <div class="detail" style="font-size:13.5px;line-height:1.45">
          <b>How frost grows (I looked it up!)</b><br>
          On a clear, still night the grass sends its heat straight up into space. With no cloud blanket, it gets colder than the air,
          sometimes 4 to 6 degrees colder. When it's below freezing <i>and</i> below the dew point, water vapor skips being dew
          and turns right into ice feathers. That's <b>hoar frost</b>. Weather people even measure "grass minimum" with a thermometer lying
          just over the lawn, like mine. So frost can happen when the post says 36°F!<br><br>
          My post thermometer is a <b>Six's max-min thermometer</b> (James Six, 1780): a U-shaped tube. The little blue markers get pushed
          to the warmest and coldest point and stay there. Every morning at 9 I slide them back with the red magnet.<br><br>
          Chickens get cold too: we fluff up our feathers (trapped air = a puffy coat) and tuck one foot up into our belly feathers.
          The comb is the part that worries farmers most. Mine is fine. I checked. Twice.
        </div>`);
    }
  };
}
