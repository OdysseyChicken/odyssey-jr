// OJ Rail (Day 9): Biscuit (engine No. 9) and her two open cars run round the loop on the timetable in world/rail.js,
// so everybody sees the train in the same place. This script also lays the track (ballast, sleepers, rails), the
// footpath from my yard to Coop Junction, puffs smoke out of the chimney four times every turn of the wheels (two
// cylinders, each pushing both ways = four "chuffs"), blows real whistle codes, and gives me rides.
//   — —      = "release brakes, proceed" (every departure)
//   — — o —  = the crossing whistle (I blow it before my tunnel; click Biscuit to hear it)
import { trackAt, trainAt, LENGTH, GAUGE, departures, clockStr } from "../world/rail.js";

const CAR1 = 3.15, CAR2 = 5.8;                     // how far behind the engine each car rides (centers)
const TUNNEL_S = LENGTH / 2;                        // Tunnel Hill is straight across the loop from the station
let ac = null;
addEventListener("pointerdown", () => { try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch { } }, { capture: true });

export default function setup({ THREE, obj, scene, say, chicken, sim, objects, texFor, openModal, chickenInfo, camera }) {
  // ---------- the track ----------
  const STEP = 0.25, n = Math.round(LENGTH / STEP), pts = [];
  for (let i = 0; i < n; i++) pts.push(trackAt(i * LENGTH / n));
  const side = (p, off) => [p.x + Math.cos(p.yaw) * off, p.z - Math.sin(p.yaw) * off];
  function ribbon(width, y, mat, vScale) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n], a = side(p, -width / 2), b = side(p, width / 2), v = i * STEP / vScale;
      pos.push(a[0], y, a[1], b[0], y, b[1]); uv.push(0, v, 1, v);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  const stoneTex = texFor("stone", 1, 1)?.clone(); if (stoneTex) { stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.needsUpdate = true; }
  ribbon(1.9, 0.025, new THREE.MeshStandardMaterial({ color: "#b8ad9c", map: stoneTex, roughness: 1, side: THREE.DoubleSide }), 1.9);
  { // sleepers (ties), every 0.55
    const k = Math.floor(LENGTH / 0.55), ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1.45, 0.08, 0.24), new THREE.MeshStandardMaterial({ color: "#8a6648", map: texFor("wood", 1, 0.3), roughness: 0.9 }), k);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < k; i++) { const p = trackAt(i * LENGTH / k); q.setFromAxisAngle(up, p.yaw); m4.compose(new THREE.Vector3(p.x, 0.07, p.z), q, one); ties.setMatrixAt(i, m4); }
    ties.receiveShadow = ties.castShadow = true; scene.add(ties);
  }
  const railMat = new THREE.MeshStandardMaterial({ color: "#8e8f96", metalness: 0.35, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3(pts.filter((_, i) => i % 2 === 0).map(p => { const [x, z] = side(p, s * GAUGE / 2); return new THREE.Vector3(x, 0.12, z); }), true);
    const r = new THREE.Mesh(new THREE.TubeGeometry(c, 900, 0.045, 6, true), railMat); r.castShadow = true; scene.add(r);
  }
  { // the footpath from my yard (between OJ Music and the Meteor Watch) to the back of the platform
    const c = new THREE.CatmullRomCurve3([[2.4, 15.6], [2.9, 18], [4.2, 20.6], [5.6, 22.6], [5.9, 23.9]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const N = 60, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = c.getPoint(i / N), t = c.getTangent(i / N), w = 0.6 + Math.sin(i * 1.7) * 0.05;
      pos.push(p.x - t.z * w, 0.02, p.z + t.x * w, p.x + t.z * w, 0.02, p.z - t.x * w); uv.push(0, i / 6, 1, i / 6);
      if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const dt = texFor("dirt", 1, 1)?.clone(); if (dt) { dt.wrapS = dt.wrapT = THREE.RepeatWrapping; dt.needsUpdate = true; }
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#d8c09a", map: dt, roughness: 1, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m);
  }

  // ---------- the train ----------
  const loco = obj, cars = [objects["oj-car-1"], objects["oj-car-2"]];
  let ready = false, wheels = [], rods = [], rodBase = [], stackTop, whistlePt, lampMat, fireMat, seat;
  const headLight = new THREE.SpotLight("#ffe2a8", 0, 26, 0.45, 0.6, 1.2); scene.add(headLight, headLight.target);
  function init() {
    stackTop = loco.getObjectByName("stack_top"); if (!stackTop || cars.some(c => !c?.getObjectByName("seat"))) return false;
    whistlePt = loco.getObjectByName("whistle_pt"); seat = cars[0].getObjectByName("seat");
    for (const v of [loco, ...cars]) wheels.push([1, 2, 3, 4].map(i => v.getObjectByName("wheel_" + i)).filter(Boolean));
    for (const nm of ["rod_L", "rod_R"]) { const r = loco.getObjectByName(nm); if (r) { rods.push(r); rodBase.push(r.position.clone()); } }
    const hl = loco.getObjectByName("headlamp"); if (hl?.isMesh) { hl.material = hl.material.clone(); lampMat = hl.material; }
    const fb = loco.getObjectByName("firebox_glow"); if (fb?.isMesh) { fb.material = fb.material.clone(); fireMat = fb.material; }
    loco.add(headLight); headLight.position.set(0, 1.8, 1.7); loco.add(headLight.target); headLight.target.position.set(0, 0, 12);
    return (ready = true);
  }
  const place = (v, s, half) => {
    const a = trackAt(s + half), b = trackAt(s - half);
    v.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2); v.rotation.y = Math.atan2(a.x - b.x, a.z - b.z);
  };

  // ---------- smoke and steam ----------
  const puffMat = new THREE.MeshStandardMaterial({ color: "#eeeae4", emissive: "#6a6560", roughness: 1, transparent: true, opacity: 0.8, depthWrite: false });
  const puffGeo = new THREE.SphereGeometry(0.5, 10, 8), puffs = [];
  for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(puffGeo, puffMat.clone()); m.visible = false; m.userData = { age: 9, life: 1, v: new THREE.Vector3(), s0: 0.3, s1: 1 }; scene.add(m); puffs.push(m); }
  let pi = 0; const wp = new THREE.Vector3();
  function puff(from, big, grey, up = 1.4) {
    const p = puffs[pi++ % puffs.length]; from.getWorldPosition(wp);
    p.position.copy(wp); p.visible = true;
    Object.assign(p.userData, { age: 0, life: 2.2 + big * 1.6, s0: 0.25 + big * 0.15, s1: 0.9 + big * 1.1 });
    p.userData.v.set((Math.random() - 0.5) * 0.4, up + big * 0.8, (Math.random() - 0.5) * 0.4);
    p.material.color.set(grey ? "#b9b4ae" : "#f6f4f0");
  }

  // ---------- sound (only after you've clicked somewhere, like all my sounds) ----------
  const near = () => { const d = camera.position.distanceTo(loco.position); return Math.max(0, 1 - d / 60); };
  function whistle(code) { // code like "--o-"
    if (!ac || ac.state !== "running") return; const vol = 0.16 * near(); if (vol < 0.01) return;
    let t = ac.currentTime + 0.05;
    for (const ch of code) {
      const len = ch === "-" ? 1.0 : 0.32, g = ac.createGain(); g.connect(ac.destination);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.07); g.gain.setValueAtTime(vol, t + len - 0.1); g.gain.linearRampToValueAtTime(0, t + len);
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200; lp.connect(g);
      for (const f of [370, 440, 554]) { const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.12); const og = ac.createGain(); og.gain.value = 0.33; o.connect(og).connect(lp); o.start(t); o.stop(t + len + 0.05); }
      t += len + 0.22;
    }
    whistleSteam = code.length * 0.8;
  }
  let noiseBuf = null;
  function chuff(loud) {
    if (!ac || ac.state !== "running") return; const vol = 0.09 * loud * near(); if (vol < 0.005) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2; }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 350 + Math.random() * 120; bp.Q.value = 0.8;
    const g = ac.createGain(); g.gain.value = vol; s.connect(bp).connect(g).connect(ac.destination); s.start();
  }

  // ---------- riding (that's me in the front car!) ----------
  let aboard = false; const sv = new THREE.Vector3();
  const ride = () => { if (!aboard || !seat) return null; seat.getWorldPosition(sv); return { x: sv.x, y: sv.y + 0.02, z: sv.z, yaw: cars[0].rotation.y, wind: Math.min(1, lastSpeed / 5) }; };

  let T = trainAt(), tick = 0, lastS = 0, phi = 0, chuffN = 0, lastStage = T.stage, tunnelWarned = false, whistleSteam = 0, simmer = 0, spoutA = -0.9, lastSpeed = 0;
  return {
    update(dt, t) {
      if (!ready && !init()) return;
      T = trainAt();
      const s = T.s;
      let ds = s - lastS; if (ds < -LENGTH / 2) ds += LENGTH; if (ds < 0 || ds > 20) ds = 0; lastS = s; lastSpeed = T.speed ?? 0;
      place(loco, s, 0.65); place(cars[0], s - CAR1, 0.72); place(cars[1], s - CAR2, 0.72);
      // wheels roll, rods go round with the crank pins (the two sides are a quarter turn apart: "quartered")
      phi += ds / 0.32;
      for (const w of wheels[0]) w.rotation.x = phi;
      for (const v of [1, 2]) for (const w of wheels[v]) w.rotation.x = phi * 0.32 / 0.24;
      rods.forEach((r, i) => { const a = phi + i * Math.PI / 2; r.position.set(rodBase[i].x, rodBase[i].y + Math.cos(a) * 0.14, rodBase[i].z + Math.sin(a) * 0.14); });
      // four chuffs a turn: a puff of smoke out of the chimney (and a chuff you can hear)
      const c = Math.floor(phi / (Math.PI / 2));
      if (c !== chuffN) { chuffN = c; const hard = T.tt >= 0 && T.tt < 8 ? 1 : 0.45; puff(stackTop, hard, true, 1.2 + lastSpeed * 0.1); chuff(hard + 0.3); }
      if (T.stage !== "running" && T.stage !== "night" && (simmer -= dt) <= 0) { simmer = 1.4 + Math.random(); puff(stackTop, 0, true, 0.8); }
      if (whistleSteam > 0 && whistlePt) { whistleSteam -= dt; if (Math.random() < dt * 12) puff(whistlePt, 0, false, 2.2); }
      for (const p of puffs) {
        const u = p.userData; if (u.age >= u.life) { p.visible = false; continue; }
        u.age += dt; const k = u.age / u.life;
        p.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - dt * 0.6); p.position.x += dt * 0.3;
        p.scale.setScalar(u.s0 + (u.s1 - u.s0) * Math.sqrt(k)); p.material.opacity = 0.75 * (1 - k) * (1 - k);
      }
      // whistles: two longs when we leave, the crossing whistle before the tunnel
      if (T.stage === "running" && lastStage === "boarding") { whistle("--"); if (aboard) say("Two longs: release the brakes, here we go! Bawk!", 4); }
      if (T.stage === "running") {
        const toTunnel = TUNNEL_S - (T.s % LENGTH);
        if (toTunnel > 0 && toTunnel < 16 && !tunnelWarned) { tunnelWarned = true; whistle("--o-"); if (aboard) say("Tunnel! Whoooo! (Long, long, short, long!)", 4); }
        if (toTunnel < 0 || toTunnel > 30) tunnelWarned = false;
      }
      lastStage = T.stage;
      // lamps: headlamp and firehole glow when it's getting dark
      const h = new Date().getHours() + new Date().getMinutes() / 60, dark = h < 7.4 || h > 16.6;
      if (lampMat) lampMat.emissiveIntensity = dark ? 3 : 0.4;
      headLight.intensity = dark && T.stage !== "night" ? 18 : 0;
      if (fireMat) fireMat.emissiveIntensity = T.stage === "night" ? 0.3 : 1.6 + Math.sin(t * 9) * 0.4 + Math.sin(t * 23) * 0.2;
      // the water tower: swing the spout down and fill her tanks while she waits at the platform
      const sp = objects["oj-watertower"]?.getObjectByName("spout");
      if (sp) { const want = T.stage === "boarding" && T.wait > 25 && T.wait < 140 ? 0.05 : -0.9; spoutA += (want - spoutA) * Math.min(1, dt * 0.8); sp.rotation.x = spoutA; }

      // me: hop in when I'm here for a ride and she's waiting; hop out when we're back and I want to go do something else
      tick -= dt;
      if (tick <= 0) {
        tick = 0.25;
        const info = chickenInfo(), want = sim.act === "train" && info.room === "outside" && !info.up;
        if (!aboard && want && T.stage === "boarding") {
          seat.getWorldPosition(sv);
          if (Math.hypot(chicken.position.x - sv.x, chicken.position.z - sv.z) < 2.6) { aboard = true; say(["All aboard! (That's me. I'm all of the aboard.)", "Front car, front seat. Bawk!", "Tickets? I made my own."][Math.floor(Math.random() * 3)], 4); }
        }
        if (aboard && !want && T.stage !== "running") {
          aboard = false; const st = objects["oj-station"]; chicken.position.set(st ? st.position.x - 2.35 : 3.15, 0, st ? st.position.z + 0.7 : 25.7);
          say("Thank you, Biscuit! Same time tomorrow.", 3);
        }
        chicken.userData.ride = aboard ? ride : null;
      }
    },
    onClick() {
      whistle("--o-"); if (whistlePt) whistleSteam = 3;
      const next = T.stage === "running" ? `On the ${T.depStr} run, lap ${T.lap} of 2.` : T.stage === "boarding" ? `Next train: ${T.nextStr}.` : "Asleep at the platform till 7:00 am.";
      say(T.stage === "night" ? "Shh, Biscuit's asleep. …Okay, ONE toot." : `Toot toot! ${next}`, 4);
    },
    railInfo: () => ({ T, departures: departures() })
  };
}
