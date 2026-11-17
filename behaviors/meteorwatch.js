// OJ Meteor Watch (Day 5): real meteor showers over my yard, and a hay bale bed to lie back on and count them.
// - Meteors fall at the REAL rate for right now (world/meteors.js: real showers, real radiants, the real moon washing
//   out the faint ones, more sporadics before dawn), but squished in time: an hour of meteors falls in 7½ minutes.
// - Shower meteors streak AWAY from their radiant. Ones close to the radiant are short (coming almost at you), ones
//   far away are long. Fast showers (Leonids, 71 km/s) zip; slow ones (Geminids, 35 km/s) take their time.
// - Bright fast ones leave a glowing green train for a couple of seconds (that's oxygen glowing, 100 km up).
// - Click the hay bales for tonight's meteor forecast and a sky chart, then lie back and count with me.
// - The slate shows my own tally from last night (I see about 6 in 10 of what you would: chicken eyes).
import { meteorRates, tonight, upcoming, SHOWERS, limitingMag } from "../world/meteors.js";
import { altAz, toYard, daylight, moonPos, moonName } from "../world/sky.js";
import { planetsAt } from "../world/planets.js";

// time squish for the yard: 1 real hour of meteors = 7.5 minutes. Add ?storm to the address for a pretend 1966-style
// Leonid STORM (way faster than real life, just for fun).
const STORM = /[?&]storm/.test(location.search);
const SPEED = STORM ? 400 : 8;
const R = 220;                // meteors live on a dome just inside the stars
const D = Math.PI / 180;
const N = 10;                 // how many streaks (and trains) can be in the sky at once
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const dirWord = az => DIRS[Math.round(az / 45) % 8];

export default function setup({ THREE, obj, scene, camera, controls, say, sim, chicken, weatherAt, weatherFor, openModal, setFollow }) {
  // ---------- the streaks: camera-facing ribbons, bright at the head, fading to nothing at the tail ----------
  const pos = new Float32Array(N * 4 * 3), col = new Float32Array(N * 4 * 4), idx = [];
  for (let i = 0; i < N; i++) { const b = i * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 4)); geo.setIndex(idx);
  const ribbon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  ribbon.frustumCulled = false; ribbon.renderOrder = 2; scene.add(ribbon);
  const pool = Array.from({ length: N }, () => null);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), side = new THREE.Vector3(), view = new THREE.Vector3();

  let rates = null, dark = 0, slow = 0, acc = 0;
  let counting = null;   // the visitor's counting session
  const heard = [];      // when meteors that were in the visitor's view ended (for "did I really see one?")

  function popMag(r) { // brighter meteors are rarer: each magnitude brighter is r times rarer
    let m = 6; while (m > -6 && Math.random() < 1 / r) m -= 1; return m - Math.random();
  }
  function rotateToward(p, t, ang) { return p.clone().multiplyScalar(Math.cos(ang)).addScaledVector(t, Math.sin(ang)).normalize(); }
  function spawn(now) {
    const list = rates.showers.filter(x => x.hr > 0), total = rates.total;
    let pick = Math.random() * total, src = null;
    for (const x of list) { pick -= x.hr; if (pick <= 0) { src = x; break; } }
    let start, dir, v, color, mag;
    if (src) {
      const rad = new THREE.Vector3(...toYard(src.rad.alt, src.rad.az));
      // a point in the sky 8 to 100 degrees from the radiant, above the trees
      for (let k = 0; k < 20; k++) {
        const a = Math.random() * 360, h = 12 + Math.asin(Math.random()) / D * 0.85 * (78 / 90);
        const p = new THREE.Vector3(...toYard(h, a)), dd = Math.acos(Math.min(1, p.dot(rad))) / D;
        if (dd > 8 && dd < 100) { start = p; break; }
      }
      if (!start) return;
      dir = start.clone().multiplyScalar(start.dot(rad)).sub(rad).normalize();          // straight away from the radiant
      const dd = Math.acos(Math.min(1, start.dot(rad)));
      v = src.s.v; color = src.s.color; mag = popMag(src.s.r);
      start.lenAng = (6 + Math.random() * 14) * Math.sin(dd) * (mag < 1 ? 1.4 : 1);       // short near the radiant
      start.name = src.s.name;
    } else {
      const a = Math.random() * 360, h = 15 + Math.random() * 60; start = new THREE.Vector3(...toYard(h, a));
      const r = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      dir = r.sub(start.clone().multiplyScalar(r.dot(start))).normalize();
      if (dir.y > 0.3) dir.y *= -1;                                                       // most sporadics fall downward-ish
      dir.sub(start.clone().multiplyScalar(dir.dot(start))).normalize();
      v = 20 + Math.random() * 45; color = [1, 0.97, 0.9]; mag = popMag(3.0);
      start.lenAng = 5 + Math.random() * 15; start.name = "sporadic";
    }
    if (mag > rates.lm) return;                                                           // too faint to see tonight
    const end = rotateToward(start, dir, start.lenAng * D);
    const bright = Math.min(1.6, 0.45 + (rates.lm - mag) / 5);
    const m = { a: start, b: end, t: 0, dur: Math.max(0.4, 0.75 * start.lenAng / 12 * (40 / v)), bright, color, w: 0.32 + bright * 0.45, train: v > 55 && mag < 0, name: start.name };
    const slot = pool.findIndex(x => !x); if (slot < 0) return;
    pool[slot] = m;
    if (counting) {
      tmpA.copy(m.a).lerp(m.b, 0.5).multiplyScalar(R).add(camera.position).project(camera);
      m.inView = Math.abs(tmpA.x) < 0.95 && Math.abs(tmpA.y) < 0.95 && tmpA.z < 1;
      if (m.inView) counting.fell++; else counting.elsewhere++;
    }
    if (m.name !== "sporadic" && (sim.act === "meteors" || sim.act === "stargaze") && Math.random() < 0.35)
      say(["One!", "Whoosh! " + m.name + "!", "Did you see THAT one?", "Out of Leo, I knew it!", "Bawk! Tally!"][Math.floor(Math.random() * 5)].replace("Out of Leo", m.name === "Leonids" ? "Out of Leo" : "From the radiant"), 2.5);
    chicken.userData.meteorAt = performance.now();
  }
  function draw(i, m, k) {
    // k: 0..1 how far the head has gone. The tail lags behind. A train just glows along the whole path and fades.
    const b = i * 4, cp = camera.position;
    let head, tail, aH, aT, w = m.w;
    if (m.trainT !== undefined) { head = m.b; tail = m.a; const f = Math.max(0, 1 - m.trainT / 2.6); aH = aT = 0.28 * f; w *= 1.6 + m.trainT * 0.6; }
    else {
      head = tmpA.copy(m.a).lerp(m.b, Math.min(1, k)).clone(); tail = tmpB.copy(m.a).lerp(m.b, Math.max(0, k - 0.6)).clone();
      const fade = k < 0.15 ? k / 0.15 : k > 0.85 ? Math.max(0, (1.1 - k) / 0.25) : 1;
      aH = Math.min(1, 0.5 + m.bright * 0.5) * fade * dark; aT = 0;
    }
    const H = head.clone().multiplyScalar(R).add(cp), T = tail.clone().multiplyScalar(R).add(cp);
    view.copy(H).sub(cp); side.copy(H).sub(T).cross(view).normalize();
    const wh = w, wt = m.trainT !== undefined ? w : w * 0.05;
    pos.set([T.x + side.x * wt, T.y + side.y * wt, T.z + side.z * wt, T.x - side.x * wt, T.y - side.y * wt, T.z - side.z * wt,
      H.x + side.x * wh, H.y + side.y * wh, H.z + side.z * wh, H.x - side.x * wh, H.y - side.y * wh, H.z - side.z * wh], b * 3);
    const c = m.trainT !== undefined ? [0.45, 1, 0.6] : m.color;
    col.set([...c, aT, ...c, aT, ...c, aH, ...c, aH], b * 4);
  }

  // ---------- the slate: my tally from last night, in chalk ----------
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 360;
  const slateTex = new THREE.CanvasTexture(cv); slateTex.colorSpace = THREE.SRGBColorSpace;
  const slate = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.46), new THREE.MeshBasicMaterial({ map: slateTex, transparent: true }));
  slate.position.set(-1.2, 1.05, 0.575); obj.add(slate);
  function lastNight(now) {
    // my count: the most recent 1:30 to 5:30 am that has already started, using the real rates and the weather then
    const end = new Date(now); end.setHours(5, 30, 0, 0); if (end > now) end.setDate(end.getDate() - 1);
    const start = new Date(end); start.setHours(1, 30, 0, 0);
    let sum = 0, best = null;
    for (let t = start.getTime(); t < end.getTime(); t += 600000) {
      const d = new Date(t), r = meteorRates(d, weatherAt(d).cloud); sum += r.total / 6;
      for (const x of r.showers) if (x.hr > 0.5 && (!best || x.hr > best.hr)) best = x;
    }
    return { count: Math.round(sum * 0.6), night: start, best };
  }
  function drawSlate() {
    const now = new Date(), g = cv.getContext("2d"), ln = lastNight(now);
    g.fillStyle = "#2b3436"; g.fillRect(0, 0, 512, 360);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 360, 18, 3); } // old chalk smudges
    g.fillStyle = "#f4f1e6"; g.font = "700 38px 'Comic Sans MS', 'Chalkboard SE', cursive"; g.textAlign = "center";
    const act = SHOWERS.map(s => ({ s, z: meteorRates(now).showers.find(x => x.s === s)?.zhr ?? 0 })).sort((a, b) => b.z - a.z)[0];
    g.fillText(act && act.z > 1 ? act.s.name.toUpperCase() : "NO BIG SHOWER", 256, 54);
    g.font = "600 24px 'Comic Sans MS', 'Chalkboard SE', cursive";
    g.fillText(`night of ${ln.night.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: OJ saw`, 256, 96);
    // tally marks, in bundles of five
    g.strokeStyle = "#f4f1e6"; g.lineWidth = 5; g.lineCap = "round";
    const n = Math.min(ln.count, 60);
    for (let i = 0; i < n; i++) {
      const grp = Math.floor(i / 5), j = i % 5, gx = 40 + (grp % 6) * 75, gy = 130 + Math.floor(grp / 6) * 80;
      g.beginPath();
      if (j < 4) { g.moveTo(gx + j * 13, gy + (Math.random() * 4)); g.lineTo(gx + j * 13 + 2, gy + 56); }
      else { g.moveTo(gx - 6, gy + 44); g.lineTo(gx + 50, gy + 10); }
      g.stroke();
    }
    if (!n) { g.font = "600 30px 'Comic Sans MS', cursive"; g.fillText("zero. (clouds? bed?)", 256, 190); }
    g.font = "700 30px 'Comic Sans MS', 'Chalkboard SE', cursive"; g.fillText(`= ${ln.count}`, 440, 330);
    slateTex.needsUpdate = true;
  }
  drawSlate(); setInterval(drawSlate, 5 * 60000);

  // the lantern glows after dark
  let lamp = null, red = null;

  // ---------- lie back and count ----------
  let btns = null, saved = null;
  function hud() {
    if (!counting) return;
    btns.querySelector("#mwCount").textContent = counting.n;
    const left = Math.max(0, Math.ceil((counting.until - performance.now()) / 1000));
    btns.querySelector("#mwTime").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    if (left <= 0) stopCount();
  }
  function startCount() {
    document.getElementById("modal")?.classList.remove("open");
    if (counting) return;
    setFollow?.(false);
    saved = { pos: camera.position.clone(), tgt: controls.target.clone(), minD: controls.minDistance, maxD: controls.maxDistance, maxP: controls.maxPolarAngle, minP: controls.minPolarAngle, zoom: controls.enableZoom, pan: controls.enablePan };
    // you lie in the grass right in front of my hay bales (I'm on the bales, so you get the grass. Sorry.)
    const p = new THREE.Vector3(0, 0, 2.2); obj.localToWorld(p);
    const eye = new THREE.Vector3(p.x, 0.9, p.z);
    // look about 45 degrees up, a quarter of the sky away from the strongest radiant (the classic trick: longer streaks)
    const best = (rates?.showers ?? []).filter(x => x.hr > 0).sort((a, b) => b.hr - a.hr)[0];
    const az = best ? best.rad.az + 70 : 180, dir = new THREE.Vector3(...toYard(62, az));
    Object.assign(controls, { minDistance: 0.01, maxDistance: 0.2, maxPolarAngle: Math.PI * 0.97, minPolarAngle: 0.05, enableZoom: false, enablePan: false });
    camera.position.copy(eye); controls.target.copy(eye).addScaledVector(dir, 0.1); controls.update();
    counting = { n: 0, fell: 0, elsewhere: 0, until: performance.now() + 120000, hits: 0 };
    btns = document.createElement("div");
    Object.assign(btns.style, { position: "fixed", left: "50%", bottom: "84px", transform: "translateX(-50%)", zIndex: 30, display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: "calc(100vw - 32px)" });
    btns.innerHTML = `<span class="btn paper pill" style="padding:10px 14px;font-weight:800">☄️ <span id="mwCount">0</span> &nbsp;·&nbsp; ⏱ <span id="mwTime">2:00</span></span>
      <button class="btn paper pill" id="mwSaw" style="padding:12px 20px;font-weight:900;font-size:17px;cursor:pointer">✋ I saw one! <span style="opacity:.6;font-weight:600">(space)</span></button>
      <button class="btn paper pill" id="mwStop" style="padding:10px 14px;font-weight:800;cursor:pointer">Done</button>`;
    document.body.appendChild(btns);
    btns.querySelector("#mwSaw").onclick = saw; btns.querySelector("#mwStop").onclick = stopCount;
    say(best ? `Lie back! The ${best.s.name} come from ${dirWord(best.rad.az)}, so we look a bit to the side of it. Shout when you see one!` : "Lie back! No big shower tonight, but there are always a few random ones. Shout when you see one!", 7);
  }
  function saw() {
    if (!counting) return;
    counting.n++; hud();
    const recent = heard.some(t => performance.now() - t < 1600);
    if (recent) counting.hits++;
    say(recent ? ["Yes! I saw it too!", "Got it! Tally!", "Ooh, that was a good one."][counting.n % 3] : ["Hmm, I missed that one. Chicken eyes.", "Where?! …Okay, I believe you."][counting.n % 2], 2);
  }
  function stopCount() {
    if (!counting) return;
    const c = counting; counting = null;
    Object.assign(controls, { minDistance: saved.minD, maxDistance: saved.maxD, maxPolarAngle: saved.maxP, minPolarAngle: saved.minP, enableZoom: saved.zoom, enablePan: saved.pan });
    camera.position.copy(saved.pos); controls.target.copy(saved.tgt); controls.update(); setFollow?.(true);
    btns?.remove(); btns = null;
    let best = 0; try { best = +(localStorage.getItem("oj-meteor-best") || 0); if (c.n > best) localStorage.setItem("oj-meteor-best", String(c.n)); } catch (e) { }
    openModal("☄️ Your meteor count", "Two minutes under my sky", `
      <p style="font-size:18px">You counted <b>${c.n}</b>. ${c.fell} fell where you were looking, and ${c.elsewhere} more fell somewhere else in the sky (that always happens: nobody can watch the whole sky).</p>
      <p>${c.hits ? `I'm sure about <b>${c.hits}</b> of yours, because I saw them too. ` : ""}${c.n > c.fell + 1 ? "You saw a couple more than I think fell in your patch of sky. Maybe your eyes are better than mine! (Very possible. I'm a chicken.)" : c.n === 0 && c.fell === 0 ? "Quiet sky! That happens. Real meteor watchers sit out for an hour or more." : "Not bad at all."}</p>
      ${best && c.n <= best ? `<p style="color:var(--muted)">Your best so far: ${best}.</p>` : c.n > best && best ? `<p><b>A new best!</b> (Your old best was ${best}.)</p>` : ""}
      <p style="color:var(--muted);font-size:14px">Real counters (the International Meteor Organization) write down every one, plus how faint a star they can see, and turn it into a ZHR, a "perfect sky" number, so everyone's counts can be added up.</p>`);
  }
  addEventListener("keydown", e => { if (counting && (e.code === "Space" || e.key === " ")) { e.preventDefault(); saw(); } if (e.key === "Escape") stopCount(); });

  // ---------- the panel: tonight's meteor forecast with a little sky chart ----------
  function chart(now, r) {
    const c = document.createElement("canvas"), S = 300; c.width = c.height = S * 2; const g = c.getContext("2d"); g.scale(2, 2);
    const cx = S / 2, cy = S / 2, RR = S / 2 - 22, xy = (alt, az) => { const rr = RR * (90 - alt) / 90; return [cx - rr * Math.sin(az * D), cy - rr * Math.cos(az * D)]; }; // looking UP: east is on the left
    const night = daylight(now) < 0.3;
    g.fillStyle = night ? "#141b33" : "#5b7fb6"; g.beginPath(); g.arc(cx, cy, RR, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1; for (const a of [30, 60]) { g.beginPath(); g.arc(cx, cy, RR * (90 - a) / 90, 0, 7); g.stroke(); }
    g.fillStyle = "#3a4a2a"; g.font = "900 16px Nunito, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    for (const [t, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) { const [x, y] = xy(-9, az); g.fillText(t, x, y); }
    const m = moonPos(now), ma = altAz(m.ra, m.dec, now);
    if (ma.alt > 0) { const [x, y] = xy(ma.alt, ma.az); g.fillStyle = "#fff6d8"; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.fillStyle = "#e9e3cf"; g.font = "700 11px Nunito"; g.fillText("Moon", x, y + 15); }
    const placed = [];
    for (const p of planetsAt(now)) { const a = altAz(p.ra, p.dec, now); if (a.alt > 0 && p.mag < 2) { const [x, y] = xy(a.alt, a.az); g.fillStyle = `rgb(${p.color.map(v => v * 255).join(",")})`; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
      const near = placed.filter(q => Math.hypot(q[0] - x, q[1] - y) < 14).length; placed.push([x, y]);
      g.font = "700 10px Nunito"; g.fillStyle = "#ffe6b0"; g.textAlign = near ? "left" : "right"; g.fillText(p.name, near ? x + 6 : x - 6, y - 8); g.textAlign = "center"; } }
    for (const x of r.showers) {
      if (x.rad.alt <= -5) continue;
      const [px, py] = xy(Math.max(-4, x.rad.alt), x.rad.az), big = x.zhr > 4;
      g.strokeStyle = big ? "rgba(140,255,170,0.75)" : "rgba(255,220,150,0.45)"; g.lineWidth = big ? 2 : 1;
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.3; g.beginPath(); g.moveTo(px + Math.cos(a) * 10, py + Math.sin(a) * 10); g.lineTo(px + Math.cos(a) * (big ? 30 : 18), py + Math.sin(a) * (big ? 30 : 18)); g.stroke(); }
      const near = placed.filter(q => Math.hypot(q[0] - px, q[1] - py) < 30).length; placed.push([px, py]);
      g.fillStyle = big ? "#b6ffc8" : "#ffe0a6"; g.font = `800 ${big ? 13 : 10}px Nunito`; g.fillText(x.s.name, px, py + (big ? 40 : 26) + near * 13);
    }
    return c.toDataURL();
  }
  function panel() {
    const now = new Date(), w = weatherAt(now), r = meteorRates(now, w.cloud), dl = daylight(now);
    const tn = tonight(now, t => weatherAt(t).cloud), time = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const max = Math.max(1, ...tn.hours.map(h => h.total));
    const bars = tn.hours.map(h => `<div title="${time(h.t)}: about ${h.total.toFixed(1)} an hour" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px">
      <div style="width:100%;height:${Math.max(2, h.total / max * 70)}px;border-radius:4px 4px 0 0;background:${h === tn.best ? "#55c37a" : "#8a6dff"}"></div>
      <span style="font-size:10px;color:var(--muted)">${h.t.toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", "").toLowerCase()}</span></div>`).join("");
    const act = r.showers.filter(x => x.zhr > 0.5).sort((a, b) => b.zhr - a.zhr);
    const showerRows = act.map(x => `<li><b>${x.s.name}</b>: ${x.zhr >= 1 ? `ZHR ${x.zhr.toFixed(0)} right now` : "just a trickle"} (peak ${new Date(Date.UTC(2026, x.s.peak[0] - 1, x.s.peak[1])).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}). Radiant ${x.rad.alt > 0 ? `${Math.round(x.rad.alt)}° up in the ${dirWord(x.rad.az)}` : "below the horizon"}. ${x.s.v} km/s. From ${x.s.parent}.<br><span style="color:var(--muted);font-size:14px">${x.s.note}</span></li>`).join("");
    const up = upcoming(now, 4).map(u => `<li><b>${u.s.name}</b>: ${u.when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, up to ${u.s.zhr}/hour in a perfect sky. Moon ${Math.round(u.moon.lit * 100)}% lit${u.moon.lit > 0.7 ? " (bright, boo)" : u.moon.lit < 0.3 ? " (nice and dark!)" : ""}.</li>`).join("");
    const m = moonPos(now), ma = altAz(m.ra, m.dec, now);
    const status = dl > 0.35 ? `It's daytime. Meteors are falling right now too, but the sky is way too bright to see them. Best hour tonight: <b>${time(tn.best.t)}</b>, about <b>${tn.best.total.toFixed(0)} an hour</b>.`
      : w.cloud > 0.7 || w.rain > 0.3 ? `It's dark, but cloudy. Meteors are up there, behind the clouds. 😞`
      : `It's dark! Right now you'd see about <b>${r.total.toFixed(0)} meteors an hour</b> from my yard (faintest star: magnitude ${r.lm.toFixed(1)}${ma.alt > 0 && m.lit > 0.3 ? ", the moon is washing out the faint ones" : ""}). In my yard they fall ${SPEED}× fast, so that's about <b>${(r.total * SPEED / 60).toFixed(1)} a minute</b>.`;
    openModal("☄️ OJ Meteor Watch", "Real meteor showers over my yard, right now. Same sky for every visitor.", `
      <p style="font-size:16px">${status}</p>
      ${dl <= 0.35 ? `<p style="margin:10px 0"><button class="btn paper pill" id="mwGo" style="padding:9px 15px;font-weight:800;cursor:pointer">🛌 Lie back and count with me (2 minutes)</button></p>` : ""}
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <div style="flex:0 0 auto;text-align:center"><img src="${chart(now, r)}" width="240" height="240" alt="sky chart" style="border-radius:50%;max-width:100%"><div style="font-size:12px;color:var(--muted)">The sky right now, looking straight up<br>(east is on the left when you look up!)</div></div>
        <div style="flex:1 1 220px;min-width:0">
          <p style="margin-top:0"><b>Tonight, hour by hour</b> <span style="color:var(--muted);font-size:13px">(what you'd really count, with my weather)</span></p>
          <div style="display:flex;gap:2px;height:92px;align-items:stretch">${bars}</div>
        </div>
      </div>
      <p><b>Showers going on now:</b></p><ul style="margin-top:0">${showerRows || "<li>None right now. Just sporadics: the random ones, about 6 to 10 an hour before dawn.</li>"}</ul>
      <p><b>Coming up:</b></p><ul style="margin-top:0">${up}</ul>
      <p style="color:var(--muted);font-size:14px">🐔 A meteor is a speck of comet dust, usually smaller than a grain of sand, hitting the air so fast (up to 71 km a second!) that it squishes the air in front of it until it glows, about 100 km up. All the specks in a shower move in parallel, so they seem to come out of one spot: the <b>radiant</b>. Tips: give your eyes 20 minutes in the dark, use a <b>red</b> flashlight (red doesn't ruin your night eyes), and look a little to the side of the radiant.</p>`);
    setTimeout(() => { const b = document.getElementById("mwGo"); if (b) b.onclick = startCount; }, 0);
  }

  return {
    update(dt) {
      slow -= dt;
      if (slow <= 0) {
        slow = 2;
        const now = new Date(), w = weatherAt(now);
        rates = meteorRates(now, w.cloud);
        dark = (1 - daylight(now)) * (1 - w.rain);
        if (!lamp) { lamp = obj.getObjectByName("mw_lamp"); red = obj.getObjectByName("mw_red"); }
        const night = 1 - daylight(now);
        if (lamp?.material?.emissiveIntensity !== undefined) lamp.material.emissiveIntensity = 0.3 + night * 2.2;
        if (red?.material?.emissiveIntensity !== undefined) red.material.emissiveIntensity = 0.3 + night * 2.5;
      }
      // new meteors at the real rate (squished)
      if (rates && dark > 0.4 && rates.total > 0) {
        acc += dt * rates.total * SPEED / 3600;
        while (acc > 0) { acc -= -Math.log(1 - Math.random()); spawn(); }   // random (Poisson) gaps, like the real thing
      } else acc = 0;
      for (let i = 0; i < N; i++) {
        const m = pool[i];
        if (!m) { col.fill(0, i * 16, i * 16 + 16); continue; }
        if (m.trainT !== undefined) { m.trainT += dt; if (m.trainT > 2.6) { pool[i] = null; continue; } }
        else {
          m.t += dt / m.dur;
          if (m.t > 1.15) {
            if (m.inView) heard.push(performance.now());
            if (m.train) { m.trainT = 0; m.w *= 0.8; } else { pool[i] = null; continue; }
          }
        }
        draw(i, m, m.t);
      }
      while (heard.length && performance.now() - heard[0] > 3000) heard.shift();
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      if (counting) hud();
    },
    onClick() { panel(); }
  };
}
