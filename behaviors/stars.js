// OJ Stars (Day 3, bonus 4): the real night sky over my yard, and a brass telescope to look at it with.
// - 1,600+ real stars (brighter than magnitude 5) and the constellation stick figures, turning with the real time
//   (world/sky.js does the math: my yard is pretend-placed at 40° north, 90° west).
// - The moon is where the real moon is, with its real phase. You can see it in the daytime too, faintly, like real life.
// - Stars fade in at dusk (the real sunset) and hide behind cloudy OJ Weather. Sometimes a shooting star.
// - The telescope swings to the moon (or the brightest star that's up). Click it for tonight's sky and a "look up" view.
// Star data: d3-celestial by Olaf Frohn (BSD-3-Clause), see assets/CREDITS.md.
import { lst, sunPos, moonPos, altAz, toYard, daylight, skyMatrix, moonName } from "../world/sky.js";

const R = 250;               // how far away the sky dome is (the camera can see 300)
const D = Math.PI / 180;
const eq = (ra, dec, r = R) => [r * Math.cos(dec * D) * Math.cos(ra * D), r * Math.cos(dec * D) * Math.sin(ra * D), r * Math.sin(dec * D)];
const DIRS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
const dirWord = az => DIRS[Math.round(az / 45) % 8];
const altWord = alt => alt > 60 ? "almost straight up" : alt > 35 ? "high up" : alt > 15 ? "halfway up" : "low";
// B-V color index to a star color (blue-white hot stars to orange-red cool ones)
function bvColor(bv) {
  const t = Math.max(0, Math.min(1, (bv + 0.3) / 2.0));
  const stops = [[0.62, 0.74, 1.0], [0.85, 0.9, 1.0], [1.0, 0.97, 0.9], [1.0, 0.85, 0.62], [1.0, 0.7, 0.45]];
  const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), k = f - i;
  return stops[i].map((c, j) => c + (stops[i + 1][j] - c) * k);
}

export default function setup({ THREE, obj, scene, camera, controls, say, sim, weatherAt, openModal, setFollow }) {
  const sky = new THREE.Group(); sky.name = "oj-stars"; sky.matrixAutoUpdate = false; scene.add(sky);
  const rot = new THREE.Matrix4(), tmp = new THREE.Vector3();
  let data = null, stars = null, lines = null, labels = [], moon = null, mapUntil = 0, look = null;

  const starMat = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, time: { value: 0 }, px: { value: Math.min(2, window.devicePixelRatio || 1) } },
    vertexShader: `attribute float size; attribute vec3 color; attribute float seed; uniform float time; uniform float px;
      varying vec3 vColor; varying float vFade;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float up = (wp.y - cameraPosition.y) / ${R.toFixed(1)};
        vFade = smoothstep(0.0, 0.12, up);                       // stars near the horizon are dimmer (thick air)
        float tw = 0.82 + 0.18 * sin(time * (1.7 + seed * 2.3) + seed * 40.0) * (1.0 - smoothstep(0.3, 0.8, up)); // twinkle, more near the horizon
        vColor = color * tw;
        gl_PointSize = size * px;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform float opacity; varying vec3 vColor; varying float vFade;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float a = smoothstep(0.5, 0.1, d);
        if (a * vFade * opacity < 0.01) discard;
        gl_FragColor = vec4(vColor, a * vFade * opacity);
      }`,
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
  });
  const lineMat = new THREE.LineBasicMaterial({ color: "#9fb6ff", transparent: true, opacity: 0, depthWrite: false, fog: false });

  // the moon: a ball lit from wherever the real sun is, so it shows the real phase
  const moonMat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: new THREE.Vector3(1, 0, 0) }, opacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 sunDir; uniform float opacity; varying vec3 vN; varying vec3 vP;
      void main(){
        float lit = smoothstep(-0.05, 0.12, dot(normalize(vN), normalize(sunDir)));
        float spots = 0.88 + 0.12 * sin(vP.x * 1.7 + 1.0) * sin(vP.y * 1.3 + 2.0) * sin(vP.z * 1.9);  // a few soft "seas"
        vec3 col = mix(vec3(0.10, 0.12, 0.2), vec3(1.0, 0.98, 0.88) * spots, lit);
        gl_FragColor = vec4(col, opacity * max(lit, 0.12));
      }`,
    transparent: true, depthWrite: false, fog: false
  });
  moon = new THREE.Mesh(new THREE.SphereGeometry(6.5, 32, 20), moonMat); moon.renderOrder = -1; scene.add(moon);
  // a soft glow around the moon
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const r = g.createRadialGradient(64, 64, 8, 64, 64, 64); r.addColorStop(0, "rgba(255,250,225,0.55)"); r.addColorStop(1, "rgba(255,250,225,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(40); scene.add(glow);

  // shooting stars
  const meteorMat = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, fog: false, depthWrite: false });
  const meteorGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  const meteor = new THREE.Line(meteorGeo, meteorMat); meteor.frustumCulled = false; scene.add(meteor);
  let shoot = null;

  function label(text) {
    const c = document.createElement("canvas"), g = c.getContext("2d"); c.width = 256; c.height = 64;
    g.font = "700 30px Nunito, sans-serif"; g.textAlign = "center"; g.fillStyle = "rgba(200,215,255,0.95)"; g.fillText(text, 128, 42);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    s.scale.set(32, 8, 1); return s;
  }

  fetch("world/sky-data.json").then(r => r.json()).then(d => {
    data = d;
    const n = d.stars.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
    d.stars.forEach(([ra, dec, mag, bv], i) => {
      pos.set(eq(ra, dec), i * 3); col.set(bvColor(bv), i * 3);
      size[i] = Math.max(2.0, 9 - mag * 1.4); seed[i] = (i * 0.6180339) % 1;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1)); g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    stars = new THREE.Points(g, starMat); stars.frustumCulled = false; sky.add(stars);
    const lp = [];
    for (const c of d.constellations) {
      let sx = 0, sy = 0, sz = 0, k = 0;
      for (const seg of c.lines) for (let i = 0; i < seg.length; i++) {
        const p = eq(seg[i][0], seg[i][1], R * 0.995); sx += p[0]; sy += p[1]; sz += p[2]; k++;
        if (i) lp.push(...eq(seg[i - 1][0], seg[i - 1][1], R * 0.995), ...p);
      }
      const s = label(c.name); const v = new THREE.Vector3(sx, sy, sz).normalize().multiplyScalar(R * 0.98);
      s.position.copy(v); s.userData.dir = v.clone().normalize(); s.userData.name = c.name; sky.add(s); labels.push(s);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
    lines = new THREE.LineSegments(lg, lineMat); lines.frustumCulled = false; sky.add(lines);
  }).catch(e => console.warn("no star data", e));

  // ---- the telescope's moving parts ----
  let mount = null, tube = null, aimYaw = 0, aimAlt = 0.6, target = "";
  const find = () => { mount = obj.getObjectByName("mount"); tube = obj.getObjectByName("tube"); };
  function pickTarget(now) {
    const m = moonPos(now), ma = altAz(m.ra, m.dec, now);
    if (ma.alt > 8) return { name: "the Moon", alt: ma.alt, az: ma.az };
    let best = null;
    for (const [nm, ra, dec, mag] of data?.names ?? []) { const a = altAz(ra, dec, now); if (a.alt > 20 && (!best || mag < best.mag)) best = { name: nm, alt: a.alt, az: a.az, mag }; }
    return best ?? { name: "the sky", alt: 45, az: 180 };
  }

  // ---- "look up" view: stand at the telescope and look around the sky ----
  let btn = null;
  function startLook() {
    document.getElementById("modal")?.classList.remove("open");
    if (look) return;
    setFollow?.(false);
    look = { pos: camera.position.clone(), tgt: controls.target.clone(), minD: controls.minDistance, maxD: controls.maxDistance, maxP: controls.maxPolarAngle, minP: controls.minPolarAngle, zoom: controls.enableZoom, pan: controls.enablePan };
    obj.getWorldPosition(tmp);
    const eye = new THREE.Vector3(tmp.x + 1.2, 1.6, tmp.z + 1.2);
    const t = pickTarget(new Date()), dir = new THREE.Vector3(...toYard(Math.max(25, t.alt), t.az));
    controls.minDistance = 0.01; controls.maxDistance = 0.2; controls.maxPolarAngle = Math.PI * 0.97; controls.minPolarAngle = 0.05; controls.enableZoom = false; controls.enablePan = false;
    camera.position.copy(eye); controls.target.copy(eye).addScaledVector(dir, 0.1); controls.update();
    mapUntil = performance.now() + 60000;
    btn = document.createElement("button"); btn.className = "btn paper pill"; btn.textContent = "⬅ Back to the yard";
    Object.assign(btn.style, { position: "fixed", left: "50%", bottom: "90px", transform: "translateX(-50%)", zIndex: 30, padding: "10px 16px", fontWeight: 800, cursor: "pointer" });
    btn.onclick = endLook; document.body.appendChild(btn);
    say(`Look up! I aimed us at ${t.name}. Drag to look around the whole sky.`, 6);
  }
  function endLook() {
    if (!look) return;
    Object.assign(controls, { minDistance: look.minD, maxDistance: look.maxD, maxPolarAngle: look.maxP, minPolarAngle: look.minP, enableZoom: look.zoom, enablePan: look.pan });
    camera.position.copy(look.pos); controls.target.copy(look.tgt); controls.update();
    look = null; btn?.remove(); btn = null; setFollow?.(true);
  }
  addEventListener("keydown", e => { if (e.key === "Escape") endLook(); });

  let slow = 0, dark = 0, saidMoon = false;
  return {
    update(dt, t) {
      if (!mount) find();
      const now = new Date();
      // the sky turns: rebuild the rotation a few times a second, and keep the dome centered on the camera
      slow -= dt;
      if (slow <= 0) {
        slow = 0.5;
        const m = skyMatrix(now), w = weatherAt(now);
        rot.set(m[0][0], m[0][1], m[0][2], 0, m[1][0], m[1][1], m[1][2], 0, m[2][0], m[2][1], m[2][2], 0, 0, 0, 0, 1);
        dark = (1 - daylight(now)) * (1 - w.cloud * 0.92) * (1 - w.rain);
        const sp = sunPos(now), sa = altAz(sp.ra, sp.dec, now), mp = moonPos(now), ma = altAz(mp.ra, mp.dec, now);
        moonMat.uniforms.sunDir.value.set(...toYard(sa.alt, sa.az));
        moon.userData.dir = new THREE.Vector3(...toYard(ma.alt, ma.az));
        moon.userData.alt = ma.alt;
        const cloudy = 1 - w.cloud * 0.8;
        moonMat.uniforms.opacity.value = (0.35 + 0.65 * (1 - daylight(now))) * cloudy * (ma.alt > -3 ? 1 : 0);
        glow.material.opacity = (1 - daylight(now)) * mp.lit * cloudy * 0.8;
        // aim the telescope
        const tg = pickTarget(now); target = tg.name;
        const d = toYard(tg.alt, tg.az);
        aimYaw = Math.atan2(d[0], d[2]) - obj.rotation.y; aimAlt = Math.min(1.3, Math.max(0.15, tg.alt * D));
      }
      sky.matrix.copy(rot).setPosition(camera.position); sky.matrixWorldNeedsUpdate = true;
      starMat.uniforms.opacity.value = dark; starMat.uniforms.time.value = t;
      const map = performance.now() < mapUntil ? 1 : 0;
      lineMat.opacity += ((dark * (0.1 + map * 0.35)) - lineMat.opacity) * Math.min(1, dt * 2);
      for (const l of labels) {
        tmp.copy(l.userData.dir).applyMatrix4(rot);  // rot has no translation part here
        l.material.opacity += ((map && tmp.y > 0.05 ? dark : 0) - l.material.opacity) * Math.min(1, dt * 2);
        l.visible = l.material.opacity > 0.01;
      }
      if (moon.userData.dir) {
        moon.position.copy(camera.position).addScaledVector(moon.userData.dir, R * 0.9);
        glow.position.copy(moon.position); moon.visible = glow.visible = moon.userData.alt > -3;
      }
      // turn the telescope smoothly
      if (mount && tube) {
        let dy = aimYaw - mount.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        mount.rotation.y += dy * Math.min(1, dt * 0.6);
        tube.rotation.x += (-aimAlt - tube.rotation.x) * Math.min(1, dt * 0.6);
      }
      // shooting stars, only when it's properly dark
      if (!shoot && dark > 0.6 && Math.random() < dt / 45) {
        const az = Math.random() * 360, alt = 25 + Math.random() * 40, a = new THREE.Vector3(...toYard(alt, az)), b = new THREE.Vector3(...toYard(alt - 8 - Math.random() * 8, az + 6 + Math.random() * 10));
        shoot = { a, b, t: 0 };
        if (sim?.act === "stargaze") say(["A shooting star! Make a wish! (I wished for more seeds.)", "Did you see that?! Whoosh!", "Shooting star! That's a tiny space pebble burning up. Wow."][Math.floor(Math.random() * 3)], 4);
      }
      if (shoot) {
        shoot.t += dt / 0.8; const k = shoot.t, p = meteorGeo.attributes.position.array;
        const head = shoot.a.clone().lerp(shoot.b, Math.min(1, k)), tail = shoot.a.clone().lerp(shoot.b, Math.max(0, k - 0.35));
        p.set([camera.position.x + tail.x * R * 0.9, camera.position.y + tail.y * R * 0.9, camera.position.z + tail.z * R * 0.9, camera.position.x + head.x * R * 0.9, camera.position.y + head.y * R * 0.9, camera.position.z + head.z * R * 0.9]);
        meteorGeo.attributes.position.needsUpdate = true; meteorMat.opacity = Math.sin(Math.min(1, k) * Math.PI) * dark;
        if (k > 1.3) { shoot = null; meteorMat.opacity = 0; }
      }
      if (sim?.act === "stargaze" && !saidMoon && target === "the Moon" && dark > 0.3) { saidMoon = true; say(`The moon tonight: ${moonName(moonPos(now).phase).toLowerCase()}! I can see its craters!`, 5); }
    },
    onClick() {
      const now = new Date(), dl = daylight(now), w = weatherAt(now);
      const mp = moonPos(now), ma = altAz(mp.ra, mp.dec, now);
      const up = (data?.names ?? []).map(([nm, ra, dec, mag]) => ({ nm, mag, ...altAz(ra, dec, now) })).filter(s => s.alt > 10).sort((a, b) => a.mag - b.mag).slice(0, 8);
      const cons = (data?.constellations ?? []).map(c => { let x = 0, y = 0, z = 0; for (const seg of c.lines) for (const [ra, dec] of seg) { const p = eq(ra, dec, 1); x += p[0]; y += p[1]; z += p[2]; }
        const dec = Math.atan2(z, Math.hypot(x, y)) / D, ra = (Math.atan2(y, x) / D + 360) % 360; return { name: c.name, ...altAz(ra, dec, now) }; })
        .filter(c => c.alt > 25).sort((a, b) => b.alt - a.alt).slice(0, 10);
      // when does it get dark tonight?
      let dusk = null; for (let m = 0; m < 24 * 60; m += 5) { const t = new Date(now.getTime() + m * 60000); if (daylight(t) < 0.25) { dusk = t; break; } }
      const time = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const moonLine = `${moonName(mp.phase)} (${Math.round(mp.lit * 100)}% lit), ` + (ma.alt > 0 ? `${altWord(ma.alt)} in the ${dirWord(ma.az)}.` : "below the horizon right now.");
      const intro = dl > 0.6 ? `It's daytime, so the sun is too bright to see the stars. They're up there anyway! It gets dark around <b>${dusk ? time(dusk) : "later"}</b>.`
        : w.cloud > 0.6 ? "Too cloudy to see much right now. The stars are behind the clouds." : "It's dark! Here's what's up right now.";
      openModal("🔭 OJ Stars", "The real sky over my yard, right now (I live at a pretend 40° north). Same sky for every visitor.", `
        <p style="font-size:16px">${intro}</p>
        <p>🌙 <b>The Moon:</b> ${moonLine}</p>
        ${dl < 0.6 ? `<p>⭐ <b>Brightest stars up now:</b> ${up.map(s => `${s.nm} <span style="color:var(--muted)">(${dirWord(s.az)}, ${altWord(s.alt)})</span>`).join(", ") || "none yet"}</p>` : ""}
        <p>✨ <b>Constellations high up${dl > 0.6 ? " (hiding in the daylight)" : ""}:</b> ${cons.map(c => c.name).join(", ")}</p>
        <p style="margin:12px 0"><button class="btn paper pill" id="ojLookUp" style="padding:8px 14px;font-weight:800;cursor:pointer">🔭 Look up with me</button></p>
        <p style="color:var(--muted);font-size:14px">🐔 Chickens can't see well in the dark (our eyes are full of color cells and short on dark-seeing ones), so we go to bed at dusk. But stars are LIGHTS. Even I can see those.</p>`);
      setTimeout(() => { const b = document.getElementById("ojLookUp"); if (b) b.onclick = startLook; }, 0);
    }
  };
}
